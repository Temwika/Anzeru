import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Channel, LoanStatus } from '@anzelu/contracts';
import { costOfCredit, dec, generateSchedule, m, settlementQuote, sum, todayIn } from '@anzelu/finance';
import { aliasedTable, and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { AuthUser, scope, tenantOf } from '../common/auth';
import { BusinessRuleError, Paged, paging } from '../common/http';
import { AuditService } from '../core/audit.service';
import { ACCOUNTS, channelAccount, LedgerService } from '../core/ledger.service';
import { NotificationsService } from '../core/notifications.service';
import { DB, InjectDb } from '../db/database';
import {
  branches,
  collectionActivities,
  customers,
  loanDisbursements,
  loanProducts,
  loans,
  loanScheduleItems,
  payments,
  users,
} from '../db/schema';
import { adapterFor } from '../integrations/providers';
import { itemStatus, positionOf, scheduleRows, scheduleRowsByLoan, toServicingItem } from './servicing';

@Injectable()
export class LoansService {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, q: { status?: string; search?: string; bucket?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, offset } = paging(q);
    const tenantId = tenantOf(user);
    const conditions = [scope(user, loans.tenantId, loans.branchId)];
    if (q.status) conditions.push(inArray(loans.status, q.status.split(',') as LoanStatus[]));
    if (q.search) {
      const t = `%${q.search.trim()}%`;
      conditions.push(or(ilike(loans.loanNumber, t), ilike(customers.firstName, t), ilike(customers.lastName, t), ilike(customers.nrc, t))!);
    }
    const where = and(...conditions);
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: loans.id,
          loanNumber: loans.loanNumber,
          principal: loans.principal,
          status: loans.status,
          disbursedOn: loans.disbursedOn,
          maturityDate: loans.maturityDate,
          customerId: customers.id,
          customerName: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
          productName: loanProducts.name,
          branchName: branches.name,
        })
        .from(loans)
        .innerJoin(customers, eq(loans.customerId, customers.id))
        .innerJoin(loanProducts, eq(loans.productId, loanProducts.id))
        .innerJoin(branches, eq(loans.branchId, branches.id))
        .where(where)
        .orderBy(desc(loans.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(loans)
        .innerJoin(customers, eq(loans.customerId, customers.id))
        .where(where),
    ]);
    const asOf = todayIn(user.timezone);
    const schedules = await scheduleRowsByLoan(this.db, tenantId, rows.map((r) => r.id));
    const items = rows.map((r) => {
      const pos = positionOf(schedules.get(r.id) ?? [], asOf);
      return {
        ...r,
        principalOutstanding: pos.principalOutstanding,
        totalOutstanding: pos.totalOutstanding,
        daysPastDue: r.status === 'active' ? pos.daysPastDue : 0,
        bucket: r.status === 'active' ? pos.bucket : null,
        nextDueDate: pos.nextDueDate,
      };
    });
    return new Paged(items, count, page, pageSize);
  }

  async get(user: AuthUser, id: string) {
    const officer = aliasedTable(users, 'officer');
    const [row] = await this.db
      .select({ loan: loans, customer: customers, product: loanProducts, branchName: branches.name, officerName: officer.fullName })
      .from(loans)
      .innerJoin(customers, eq(loans.customerId, customers.id))
      .innerJoin(loanProducts, eq(loans.productId, loanProducts.id))
      .innerJoin(branches, eq(loans.branchId, branches.id))
      .innerJoin(officer, eq(loans.officerId, officer.id))
      .where(and(eq(loans.id, id), scope(user, loans.tenantId, loans.branchId)));
    if (!row) throw new NotFoundException('Loan not found');
    const tenantId = row.loan.tenantId;
    const asOf = todayIn(user.timezone);
    const requester = aliasedTable(users, 'requester');
    const [schedule, disbursements, paymentRows, activities] = await Promise.all([
      scheduleRows(this.db, tenantId, id),
      this.db
        .select({ d: loanDisbursements, requestedByName: requester.fullName })
        .from(loanDisbursements)
        .innerJoin(requester, eq(loanDisbursements.requestedBy, requester.id))
        .where(and(eq(loanDisbursements.loanId, id), eq(loanDisbursements.tenantId, tenantId)))
        .orderBy(desc(loanDisbursements.requestedAt)),
      this.db
        .select()
        .from(payments)
        .where(and(eq(payments.loanId, id), eq(payments.tenantId, tenantId)))
        .orderBy(desc(payments.receivedOn), desc(payments.createdAt)),
      this.db
        .select({ a: collectionActivities, by: users.fullName })
        .from(collectionActivities)
        .innerJoin(users, eq(collectionActivities.createdBy, users.id))
        .where(and(eq(collectionActivities.loanId, id), eq(collectionActivities.tenantId, tenantId)))
        .orderBy(desc(collectionActivities.createdAt)),
    ]);
    const position = positionOf(schedule, asOf);
    const pendingDisbursement = disbursements.find((d) => d.d.status === 'requested');
    return {
      ...row.loan,
      customer: row.customer,
      product: row.product,
      branchName: row.branchName,
      officerName: row.officerName,
      position,
      schedule: schedule.map((s) => ({ ...s, status: itemStatus(s, asOf) })),
      disbursements: disbursements.map((d) => ({ ...d.d, requestedByName: d.requestedByName })),
      payments: paymentRows,
      activities: activities.map((a) => ({ ...a.a, createdByName: a.by })),
      settlement: row.loan.status === 'active' ? settlementQuote(schedule.map(toServicingItem), asOf) : null,
      disclosure: schedule.length
        ? costOfCredit(
            dec(row.loan.principal).minus(dec(row.loan.processingFee)),
            schedule.map((s) => sum([s.principalDue, s.interestDue])),
            row.loan.frequency,
          )
        : null,
      permissions: {
        canRequestDisbursement:
          user.permissions.includes('disbursements:request') && row.loan.status === 'pending_disbursement' && !pendingDisbursement,
        canAuthoriseDisbursement:
          user.permissions.includes('disbursements:authorise') &&
          !!pendingDisbursement &&
          pendingDisbursement.d.requestedBy !== user.id &&
          row.loan.approvedBy !== user.id,
        canRecordPayment: user.permissions.includes('payments:record') && row.loan.status === 'active',
      },
    };
  }

  async listDisbursements(user: AuthUser, status: 'requested' | 'completed' | 'rejected' = 'requested') {
    const requester = aliasedTable(users, 'requester');
    return this.db
      .select({
        id: loanDisbursements.id,
        loanId: loans.id,
        loanNumber: loans.loanNumber,
        approvedBy: loans.approvedBy,
        customerName: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
        amount: loanDisbursements.amount,
        fee: loanDisbursements.fee,
        netAmount: loanDisbursements.netAmount,
        channel: loanDisbursements.channel,
        destination: loanDisbursements.destination,
        valueDate: loanDisbursements.valueDate,
        status: loanDisbursements.status,
        requestedAt: loanDisbursements.requestedAt,
        requestedBy: loanDisbursements.requestedBy,
        requestedByName: requester.fullName,
      })
      .from(loanDisbursements)
      .innerJoin(loans, eq(loanDisbursements.loanId, loans.id))
      .innerJoin(customers, eq(loans.customerId, customers.id))
      .innerJoin(requester, eq(loanDisbursements.requestedBy, requester.id))
      .where(and(scope(user, loans.tenantId, loans.branchId), eq(loanDisbursements.status, status)))
      .orderBy(desc(loanDisbursements.requestedAt))
      .limit(200);
  }

  async requestDisbursement(user: AuthUser, loanId: string, input: { channel: Channel; destination: string; valueDate?: string }) {
    const tenantId = tenantOf(user);
    const asOf = todayIn(user.timezone);
    const valueDate = input.valueDate ?? asOf;
    if (valueDate > asOf) throw new BusinessRuleError('FUTURE_VALUE_DATE', 'The value date cannot be in the future');
    return this.db.transaction(async (tx) => {
      const [loan] = await tx
        .select()
        .from(loans)
        .where(and(eq(loans.id, loanId), scope(user, loans.tenantId, loans.branchId)))
        .for('update');
      if (!loan) throw new NotFoundException('Loan not found');
      if (loan.status !== 'pending_disbursement') throw new BusinessRuleError('NOT_PENDING', 'This loan has already been disbursed');
      const [open] = await tx
        .select({ id: loanDisbursements.id })
        .from(loanDisbursements)
        .where(and(eq(loanDisbursements.loanId, loanId), eq(loanDisbursements.status, 'requested')));
      if (open) throw new BusinessRuleError('ALREADY_REQUESTED', 'A disbursement request is already awaiting authorisation');
      const net = m(dec(loan.principal).minus(dec(loan.processingFee)));
      const [d] = await tx
        .insert(loanDisbursements)
        .values({
          tenantId,
          loanId,
          amount: loan.principal,
          fee: loan.processingFee,
          netAmount: net,
          channel: input.channel,
          destination: input.destination,
          valueDate,
          requestedBy: user.id,
        })
        .returning();
      await this.audit.record(tx, {
        tenantId,
        userId: user.id,
        action: 'disbursement.requested',
        entityType: 'loan',
        entityId: loanId,
        data: { disbursementId: d.id, amount: d.amount, channel: d.channel },
      });
      return d;
    });
  }

  /**
   * Second pair of eyes on money leaving the institution. The authoriser must
   * differ from both the requester and the credit approver. Authorisation pays
   * out through the channel adapter, books the schedule and posts the journal.
   */
  async decideDisbursement(user: AuthUser, loanId: string, decision: 'authorise' | 'reject', note?: string) {
    const tenantId = tenantOf(user);
    const result = await this.db.transaction(async (tx) => {
      const [loan] = await tx
        .select()
        .from(loans)
        .where(and(eq(loans.id, loanId), scope(user, loans.tenantId, loans.branchId)))
        .for('update');
      if (!loan) throw new NotFoundException('Loan not found');
      const [d] = await tx
        .select()
        .from(loanDisbursements)
        .where(and(eq(loanDisbursements.loanId, loanId), eq(loanDisbursements.status, 'requested')))
        .for('update');
      if (!d) throw new BusinessRuleError('NO_REQUEST', 'There is no disbursement awaiting authorisation');
      if (d.requestedBy === user.id) throw new ForbiddenException({ code: 'MAKER_CHECKER', message: 'You cannot authorise a disbursement you requested' });
      if (loan.approvedBy === user.id) {
        throw new ForbiddenException({ code: 'SEGREGATION_OF_DUTIES', message: 'The credit approver cannot also release the funds' });
      }

      if (decision === 'reject') {
        await tx.update(loanDisbursements).set({ status: 'rejected', decidedBy: user.id, decidedAt: new Date(), note }).where(eq(loanDisbursements.id, d.id));
        await this.audit.record(tx, { tenantId, userId: user.id, action: 'disbursement.rejected', entityType: 'loan', entityId: loanId, data: { note } });
        return { status: 'rejected' as const };
      }

      const payout = await adapterFor(d.channel).payout({ amount: d.netAmount, destination: d.destination, reference: loan.loanNumber });
      if (payout.status === 'failed') throw new BusinessRuleError('PAYOUT_FAILED', payout.message ?? 'The payment provider rejected the payout');

      const schedule = generateSchedule({
        principal: loan.principal,
        annualRatePct: loan.annualRatePct,
        term: loan.term,
        method: loan.interestMethod,
        frequency: loan.frequency,
        startDate: d.valueDate,
      });
      await tx.insert(loanScheduleItems).values(
        schedule.installments.map((i) => ({
          tenantId,
          loanId,
          installmentNo: i.number,
          dueDate: i.dueDate,
          principalDue: i.principal,
          interestDue: i.interest,
        })),
      );
      const journalId = await this.ledger.post(tx, {
        tenantId,
        date: d.valueDate,
        description: `Disbursement ${loan.loanNumber}`,
        sourceType: 'disbursement',
        sourceId: d.id,
        postedBy: user.id,
        lines: [
          { account: ACCOUNTS.loansReceivable, debit: loan.principal },
          { account: channelAccount(d.channel), credit: d.netAmount },
          { account: ACCOUNTS.feeIncome, credit: d.fee },
        ],
      });
      await tx
        .update(loanDisbursements)
        .set({ status: 'completed', decidedBy: user.id, decidedAt: new Date(), providerRef: payout.providerRef, note, journalEntryId: journalId })
        .where(eq(loanDisbursements.id, d.id));
      await tx
        .update(loans)
        .set({ status: 'active', disbursedOn: d.valueDate, maturityDate: schedule.installments.at(-1)!.dueDate })
        .where(eq(loans.id, loanId));
      await this.audit.record(tx, {
        tenantId,
        userId: user.id,
        action: 'disbursement.completed',
        entityType: 'loan',
        entityId: loanId,
        data: { disbursementId: d.id, net: d.netAmount, providerRef: payout.providerRef, journalId },
      });
      const [customer] = await tx.select({ phone: customers.phone, firstName: customers.firstName }).from(customers).where(eq(customers.id, loan.customerId));
      await this.notifications.send(tx, {
        tenantId,
        channel: 'sms',
        recipient: customer.phone,
        template: 'disbursement',
        message: `Dear ${customer.firstName}, K${d.netAmount} for loan ${loan.loanNumber} has been sent. First instalment K${schedule.installmentAmount} due ${schedule.installments[0].dueDate}.`,
        relatedType: 'loan',
        relatedId: loanId,
        dedupeKey: `disbursement:${d.id}`,
      });
      return { status: 'completed' as const, providerRef: payout.providerRef };
    });
    return result;
  }

  async addActivity(
    user: AuthUser,
    loanId: string,
    input: { type: 'call' | 'sms' | 'visit' | 'promise_to_pay' | 'note'; note: string; promisedAmount?: string; promisedDate?: string },
  ) {
    const tenantId = tenantOf(user);
    const [loan] = await this.db.select({ id: loans.id }).from(loans).where(and(eq(loans.id, loanId), scope(user, loans.tenantId, loans.branchId)));
    if (!loan) throw new NotFoundException('Loan not found');
    return this.db.transaction(async (tx) => {
      const [a] = await tx
        .insert(collectionActivities)
        .values({ tenantId, loanId, ...input, createdBy: user.id })
        .returning();
      await this.audit.record(tx, { tenantId, userId: user.id, action: `collections.${input.type}`, entityType: 'loan', entityId: loanId, data: { activityId: a.id } });
      return a;
    });
  }
}
