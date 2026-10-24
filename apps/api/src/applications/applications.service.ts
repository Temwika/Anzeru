import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationCreateInput, ApplicationStatus } from '@anzelu/contracts';
import { assessAffordability, dec, generateSchedule, m, todayIn } from '@anzelu/finance';
import { aliasedTable, and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { assertBranchAccess, AuthUser, scope, tenantOf } from '../common/auth';
import { BusinessRuleError, Paged, paging } from '../common/http';
import { AuditService } from '../core/audit.service';
import { NumberingService } from '../core/numbering.service';
import { DB, InjectDb } from '../db/database';
import { creditDecisions, customers, guarantors, loanApplications, loanProducts, loans, users } from '../db/schema';
import { positionOf, scheduleRowsByLoan } from '../loans/servicing';
import { Assessment, score } from './scorecard';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, q: { status?: string; search?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, offset } = paging(q);
    const conditions = [scope(user, loanApplications.tenantId, loanApplications.branchId)];
    if (q.status) conditions.push(inArray(loanApplications.status, q.status.split(',') as ApplicationStatus[]));
    if (q.search) {
      const t = `%${q.search.trim()}%`;
      conditions.push(
        or(ilike(loanApplications.applicationNumber, t), ilike(customers.firstName, t), ilike(customers.lastName, t), ilike(customers.nrc, t))!,
      );
    }
    const where = and(...conditions);
    const officer = aliasedTable(users, 'officer');
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: loanApplications.id,
          applicationNumber: loanApplications.applicationNumber,
          amount: loanApplications.amount,
          term: loanApplications.term,
          status: loanApplications.status,
          submittedAt: loanApplications.submittedAt,
          customerId: customers.id,
          customerName: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
          productName: loanProducts.name,
          frequency: loanProducts.repaymentFrequency,
          officerName: officer.fullName,
          grade: sql<string>`${loanApplications.assessment}->>'grade'`,
          recommendation: sql<string>`${loanApplications.assessment}->>'recommendation'`,
        })
        .from(loanApplications)
        .innerJoin(customers, eq(loanApplications.customerId, customers.id))
        .innerJoin(loanProducts, eq(loanApplications.productId, loanProducts.id))
        .innerJoin(officer, eq(loanApplications.submittedBy, officer.id))
        .where(where)
        .orderBy(desc(loanApplications.submittedAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(loanApplications)
        .innerJoin(customers, eq(loanApplications.customerId, customers.id))
        .where(where),
    ]);
    return new Paged(rows, count, page, pageSize);
  }

  async get(user: AuthUser, id: string) {
    const officer = aliasedTable(users, 'officer');
    const [row] = await this.db
      .select({ application: loanApplications, customer: customers, product: loanProducts, officerName: officer.fullName })
      .from(loanApplications)
      .innerJoin(customers, eq(loanApplications.customerId, customers.id))
      .innerJoin(loanProducts, eq(loanApplications.productId, loanProducts.id))
      .innerJoin(officer, eq(loanApplications.submittedBy, officer.id))
      .where(and(eq(loanApplications.id, id), scope(user, loanApplications.tenantId, loanApplications.branchId)));
    if (!row) throw new NotFoundException('Application not found');
    const tenantId = row.application.tenantId;
    const [guarantorRows, decisions, [loan]] = await Promise.all([
      this.db.select().from(guarantors).where(and(eq(guarantors.applicationId, id), eq(guarantors.tenantId, tenantId))),
      this.db
        .select({
          id: creditDecisions.id,
          decision: creditDecisions.decision,
          reason: creditDecisions.reason,
          decidedAt: creditDecisions.decidedAt,
          decidedBy: users.fullName,
        })
        .from(creditDecisions)
        .innerJoin(users, eq(creditDecisions.decidedBy, users.id))
        .where(and(eq(creditDecisions.applicationId, id), eq(creditDecisions.tenantId, tenantId)))
        .orderBy(desc(creditDecisions.decidedAt)),
      this.db
        .select({ id: loans.id, loanNumber: loans.loanNumber, status: loans.status })
        .from(loans)
        .where(and(eq(loans.applicationId, id), eq(loans.tenantId, tenantId))),
    ]);
    const canDecide =
      user.permissions.includes('applications:decide') &&
      row.application.status === 'submitted' &&
      row.application.submittedBy !== user.id &&
      dec(user.approvalLimit).gte(dec(row.application.amount));
    return {
      ...row.application,
      assessment: row.application.assessment as Assessment,
      customer: row.customer,
      product: row.product,
      officerName: row.officerName,
      guarantors: guarantorRows,
      decisions,
      loan: loan ?? null,
      canDecide,
    };
  }

  async create(user: AuthUser, input: ApplicationCreateInput, ip?: string, submittedOn?: Date) {
    const tenantId = tenantOf(user);
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, input.customerId), scope(user, customers.tenantId, customers.branchId)));
    if (!customer) throw new BusinessRuleError('INVALID_CUSTOMER', 'Select a customer from your branch');
    assertBranchAccess(user, customer.branchId);

    const [product] = await this.db
      .select()
      .from(loanProducts)
      .where(and(eq(loanProducts.id, input.productId), eq(loanProducts.tenantId, tenantId)));
    if (!product || !product.isActive) throw new BusinessRuleError('INVALID_PRODUCT', 'Select an active loan product');

    const amount = dec(input.amount);
    if (amount.lt(dec(product.minAmount)) || amount.gt(dec(product.maxAmount))) {
      throw new BusinessRuleError('AMOUNT_OUT_OF_RANGE', `${product.name} lends between K${product.minAmount} and K${product.maxAmount}`);
    }
    if (input.term < product.minTerm || input.term > product.maxTerm) {
      throw new BusinessRuleError('TERM_OUT_OF_RANGE', `${product.name} allows ${product.minTerm} to ${product.maxTerm} instalments`);
    }

    const assessment = await this.assess(tenantId, customer, product, input);

    return this.db.transaction(async (tx) => {
      const [app] = await tx
        .insert(loanApplications)
        .values({
          tenantId,
          branchId: customer.branchId,
          applicationNumber: await this.numbering.next(tx, tenantId, 'application'),
          customerId: customer.id,
          productId: product.id,
          amount: m(input.amount),
          term: input.term,
          purpose: input.purpose,
          monthlyIncome: m(input.monthlyIncome),
          monthlyExpenses: m(input.monthlyExpenses),
          existingDebtRepayments: m(input.existingDebtRepayments),
          assessment,
          submittedBy: user.id,
          ...(submittedOn ? { submittedAt: submittedOn } : {}),
        })
        .returning();
      if (input.guarantors.length) {
        await tx.insert(guarantors).values(input.guarantors.map((g) => ({ ...g, tenantId, applicationId: app.id })));
      }
      await this.audit.record(tx, {
        tenantId,
        userId: user.id,
        action: 'application.submitted',
        entityType: 'loan_application',
        entityId: app.id,
        data: { applicationNumber: app.applicationNumber, amount: app.amount, score: assessment.score, recommendation: assessment.recommendation },
        ip,
      });
      return { ...app, assessment };
    });
  }

  private async assess(
    tenantId: string,
    customer: typeof customers.$inferSelect,
    product: typeof loanProducts.$inferSelect,
    input: ApplicationCreateInput,
  ): Promise<Assessment> {
    const preview = generateSchedule({
      principal: input.amount,
      annualRatePct: product.annualRatePct,
      term: input.term,
      method: product.interestMethod,
      frequency: product.repaymentFrequency,
      startDate: todayIn('Africa/Lusaka'),
      processingFeePct: product.processingFeePct,
    });
    const affordability = assessAffordability({
      monthlyIncome: input.monthlyIncome,
      monthlyExpenses: input.monthlyExpenses,
      existingDebtRepayments: input.existingDebtRepayments,
      installment: preview.installmentAmount,
      frequency: product.repaymentFrequency,
      maxDtiPct: product.maxDtiPct,
    });

    const history = await this.db
      .select({ id: loans.id, status: loans.status })
      .from(loans)
      .where(and(eq(loans.tenantId, tenantId), eq(loans.customerId, customer.id)));
    const active = history.filter((l) => l.status === 'active');
    const schedules = await scheduleRowsByLoan(this.db, tenantId, active.map((l) => l.id));
    const asOf = todayIn('Africa/Lusaka');
    const worstDpd = Math.max(0, ...active.map((l) => positionOf(schedules.get(l.id) ?? [], asOf).daysPastDue));

    return {
      installmentAmount: preview.installmentAmount,
      totalRepayable: preview.totals.repayable,
      totalInterest: preview.totals.interest,
      processingFee: preview.processingFee,
      aprPct: preview.disclosure.aprPct,
      affordability,
      ...score({
        affordability,
        maxDtiPct: product.maxDtiPct,
        kycVerified: customer.kycStatus === 'verified',
        hasEmployer: Boolean(customer.employer),
        priorClosedLoans: history.filter((l) => l.status === 'closed').length,
        worstCurrentDpd: worstDpd,
        activeLoans: active.length,
        guarantorRequired: product.requiresGuarantor,
        guarantorCount: input.guarantors.length,
      }),
    };
  }

  /**
   * Maker-checker credit decision. The approver must not be the officer who
   * submitted the application, and the amount must be within their delegated limit.
   */
  async decide(user: AuthUser, id: string, decision: 'approve' | 'reject', reason: string, ip?: string) {
    const tenantId = tenantOf(user);
    return this.db.transaction(async (tx) => {
      const [app] = await tx
        .select()
        .from(loanApplications)
        .where(and(eq(loanApplications.id, id), scope(user, loanApplications.tenantId, loanApplications.branchId)))
        .for('update');
      if (!app) throw new NotFoundException('Application not found');
      if (app.status !== 'submitted') throw new BusinessRuleError('ALREADY_DECIDED', `This application is already ${app.status}`);
      if (app.submittedBy === user.id) {
        throw new ForbiddenException({ code: 'MAKER_CHECKER', message: 'You cannot decide an application you submitted' });
      }

      let loanId: string | null = null;
      if (decision === 'approve') {
        if (dec(app.amount).gt(dec(user.approvalLimit))) {
          throw new ForbiddenException({
            code: 'APPROVAL_LIMIT',
            message: `K${app.amount} exceeds your approval limit of K${user.approvalLimit}; refer to a senior approver`,
          });
        }
        const [customer] = await tx.select().from(customers).where(and(eq(customers.id, app.customerId), eq(customers.tenantId, tenantId)));
        if (customer.kycStatus !== 'verified') throw new BusinessRuleError('KYC_NOT_VERIFIED', 'Verify the customer’s KYC before approving');
        const [product] = await tx.select().from(loanProducts).where(eq(loanProducts.id, app.productId));
        if (product.requiresGuarantor) {
          const [{ count }] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(guarantors)
            .where(eq(guarantors.applicationId, app.id));
          if (!count) throw new BusinessRuleError('GUARANTOR_REQUIRED', `${product.name} requires a guarantor`);
        }
        const [loan] = await tx
          .insert(loans)
          .values({
            tenantId,
            branchId: app.branchId,
            loanNumber: await this.numbering.next(tx, tenantId, 'loan'),
            applicationId: app.id,
            customerId: app.customerId,
            productId: app.productId,
            officerId: app.submittedBy,
            approvedBy: user.id,
            principal: app.amount,
            annualRatePct: product.annualRatePct,
            interestMethod: product.interestMethod,
            frequency: product.repaymentFrequency,
            term: app.term,
            processingFee: m(dec(app.amount).times(dec(product.processingFeePct)).div(100)),
            penaltyPct: product.penaltyPct,
            graceDays: product.graceDays,
          })
          .returning({ id: loans.id, loanNumber: loans.loanNumber });
        loanId = loan.id;
      }

      await tx
        .update(loanApplications)
        .set({ status: decision === 'approve' ? 'approved' : 'rejected', decidedAt: new Date() })
        .where(eq(loanApplications.id, app.id));
      await tx.insert(creditDecisions).values({
        tenantId,
        applicationId: app.id,
        decision,
        reason,
        approverLimit: user.approvalLimit,
        decidedBy: user.id,
      });
      await this.audit.record(tx, {
        tenantId,
        userId: user.id,
        action: `application.${decision === 'approve' ? 'approved' : 'rejected'}`,
        entityType: 'loan_application',
        entityId: app.id,
        data: { amount: app.amount, reason, loanId },
        ip,
      });
      return { id: app.id, status: decision === 'approve' ? 'approved' : 'rejected', loanId };
    });
  }
}
