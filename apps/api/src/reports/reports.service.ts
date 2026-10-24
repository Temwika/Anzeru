import { Injectable } from "@nestjs/common";
import { AGEING_BUCKETS, AgeingBucket, Permission } from "@anzelu/contracts";
import { addMonths, dec, LoanPosition, m, portfolioAtRisk, sum, todayIn } from "@anzelu/finance";
import { and, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { AuthUser, scope, tenantOf } from "../common/auth";
import { DB, InjectDb } from "../db/database";
import { branches, customers, loanApplications, loanDisbursements, loanProducts, loans, paymentReversals, payments, users } from "../db/schema";
import { positionOf, scheduleRowsByLoan } from "../loans/servicing";

export interface PortfolioLoan {
  id: string;
  loanNumber: string;
  status: string;
  principal: string;
  disbursedOn: string | null;
  maturityDate: string | null;
  customerId: string;
  customerName: string;
  phone: string;
  branchId: string;
  branchName: string;
  officerId: string;
  officerName: string;
  productName: string;
  position: LoanPosition;
}

@Injectable()
export class ReportsService {
  constructor(@InjectDb() private readonly db: DB) {}

  /** All active loans in the caller's scope with live balances and arrears. */
  async portfolio(user: AuthUser, asOf = todayIn(user.timezone)): Promise<PortfolioLoan[]> {
    const tenantId = tenantOf(user);
    const rows = await this.db
      .select({
        id: loans.id,
        loanNumber: loans.loanNumber,
        status: loans.status,
        principal: loans.principal,
        disbursedOn: loans.disbursedOn,
        maturityDate: loans.maturityDate,
        customerId: loans.customerId,
        customerName: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
        phone: customers.phone,
        branchId: loans.branchId,
        branchName: branches.name,
        officerId: loans.officerId,
        officerName: users.fullName,
        productName: loanProducts.name,
      })
      .from(loans)
      .innerJoin(customers, eq(loans.customerId, customers.id))
      .innerJoin(branches, eq(loans.branchId, branches.id))
      .innerJoin(users, eq(loans.officerId, users.id))
      .innerJoin(loanProducts, eq(loans.productId, loanProducts.id))
      .where(and(scope(user, loans.tenantId, loans.branchId), eq(loans.status, "active")));
    const schedules = await scheduleRowsByLoan(
      this.db,
      tenantId,
      rows.map((r) => r.id),
    );
    return rows.map((r) => ({ ...r, position: positionOf(schedules.get(r.id) ?? [], asOf) }));
  }

  async dashboard(user: AuthUser) {
    const tenantId = tenantOf(user);
    const asOf = todayIn(user.timezone);
    const monthStart = `${asOf.slice(0, 7)}-01`;
    const book = await this.portfolio(user, asOf);

    const outstandingPrincipal = sum(book.map((l) => l.position.principalOutstanding));
    const overdueAmount = sum(book.map((l) => l.position.overdueAmount));
    const buckets = AGEING_BUCKETS.map((bucket) => {
      const inBucket = book.filter((l) => l.position.bucket === bucket);
      return { bucket, count: inBucket.length, principal: m(sum(inBucket.map((l) => l.position.principalOutstanding))) };
    });

    const loanScope = scope(user, loans.tenantId, loans.branchId);
    const trendStart = addMonths(monthStart, -5);
    const [collections, disbursements, statusCounts, recentApplications, pendingApps, pendingDisb, pendingRev] = await Promise.all([
      this.db
        .select({ month: sql<string>`to_char(${payments.receivedOn}, 'YYYY-MM')`, total: sql<string>`sum(${payments.amount})::text` })
        .from(payments)
        .innerJoin(loans, eq(payments.loanId, loans.id))
        .where(and(loanScope, eq(payments.status, "posted"), gte(payments.receivedOn, trendStart), lte(payments.receivedOn, asOf)))
        .groupBy(sql`1`),
      this.db
        .select({ month: sql<string>`to_char(${loanDisbursements.valueDate}, 'YYYY-MM')`, total: sql<string>`sum(${loanDisbursements.amount})::text` })
        .from(loanDisbursements)
        .innerJoin(loans, eq(loanDisbursements.loanId, loans.id))
        .where(and(loanScope, eq(loanDisbursements.status, "completed"), gte(loanDisbursements.valueDate, trendStart)))
        .groupBy(sql`1`),
      this.db
        .select({ status: loans.status, count: sql<number>`count(*)::int` })
        .from(loans)
        .where(loanScope)
        .groupBy(loans.status),
      this.db
        .select({
          id: loanApplications.id,
          applicationNumber: loanApplications.applicationNumber,
          amount: loanApplications.amount,
          status: loanApplications.status,
          submittedAt: loanApplications.submittedAt,
          customerName: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
          grade: sql<string>`${loanApplications.assessment}->>'grade'`,
        })
        .from(loanApplications)
        .innerJoin(customers, eq(loanApplications.customerId, customers.id))
        .where(scope(user, loanApplications.tenantId, loanApplications.branchId))
        .orderBy(desc(loanApplications.submittedAt))
        .limit(6),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(loanApplications)
        .where(and(scope(user, loanApplications.tenantId, loanApplications.branchId), eq(loanApplications.status, "submitted"))),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(loanDisbursements)
        .innerJoin(loans, eq(loanDisbursements.loanId, loans.id))
        .where(and(loanScope, eq(loanDisbursements.status, "requested"))),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(paymentReversals)
        .where(and(eq(paymentReversals.tenantId, tenantId), eq(paymentReversals.status, "pending"))),
    ]);

    const months = Array.from({ length: 6 }, (_, i) => addMonths(trendStart, i).slice(0, 7));
    const byMonth = (rows: { month: string; total: string }[]) => new Map(rows.map((r) => [r.month, r.total]));
    const c = byMonth(collections);
    const d = byMonth(disbursements);
    const thisMonth = asOf.slice(0, 7);

    // Collection efficiency this month: cash received vs. instalments that fell due this month.
    const dueThisMonth = await this.db.execute<{ due: string | null }>(sql`
      SELECT sum(s.principal_due + s.interest_due + s.fee_due + s.penalty_due)::text AS due
      FROM loan_schedule_items s JOIN loans l ON l.id = s.loan_id
      WHERE l.tenant_id = ${tenantId} AND s.due_date >= ${monthStart} AND s.due_date <= ${asOf}
        AND l.status IN ('active','closed')`);
    const dueRows = (dueThisMonth as unknown as { rows: { due: string | null }[] }).rows;
    const due = dec(dueRows?.[0]?.due ?? 0);
    const collected = dec(c.get(thisMonth) ?? 0);

    return {
      asOf,
      currency: user.currency,
      kpis: {
        activeLoans: book.length,
        outstandingPrincipal: m(outstandingPrincipal),
        totalOutstanding: m(sum(book.map((l) => l.position.totalOutstanding))),
        overdueAmount: m(overdueAmount),
        loansInArrears: book.filter((l) => l.position.daysPastDue > 0).length,
        disbursedThisMonth: m(d.get(thisMonth) ?? 0),
        collectedThisMonth: m(collected),
        dueThisMonth: m(due),
        collectionEfficiencyPct: due.gt(0) ? collected.div(due).times(100).toFixed(1) : null,
        par30: portfolioAtRisk(
          book.map((l) => ({ principalOutstanding: l.position.principalOutstanding, daysPastDue: l.position.daysPastDue })),
          30,
        ),
        par90: portfolioAtRisk(
          book.map((l) => ({ principalOutstanding: l.position.principalOutstanding, daysPastDue: l.position.daysPastDue })),
          90,
        ),
      },
      buckets,
      trend: months.map((month) => ({ month, collected: m(c.get(month) ?? 0), disbursed: m(d.get(month) ?? 0) })),
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s.count])),
      recentApplications,
      tasks: { applications: pendingApps[0].count, disbursements: pendingDisb[0].count, reversals: pendingRev[0].count },
      branches: this.groupPerformance(book, (l) => ({ id: l.branchId, name: l.branchName })),
      officers: this.groupPerformance(book, (l) => ({ id: l.officerId, name: l.officerName })),
    };
  }

  /**
   * Work waiting for this user specifically: only items their role may act on,
   * excluding their own submissions (maker-checker would block them anyway).
   */
  async tasks(user: AuthUser) {
    const none = { applications: 0, disbursements: 0, reversals: 0, kyc: 0, total: 0 };
    if (!user.tenantId) return none;
    const can = (p: Permission) => user.permissions.includes(p);
    const count = sql<number>`count(*)::int`;
    const zero = Promise.resolve([{ count: 0 }]);
    const [apps, disb, revs, kyc] = await Promise.all([
      can("applications:decide")
        ? this.db
            .select({ count })
            .from(loanApplications)
            .where(
              and(
                scope(user, loanApplications.tenantId, loanApplications.branchId),
                eq(loanApplications.status, "submitted"),
                ne(loanApplications.submittedBy, user.id),
                lte(loanApplications.amount, user.approvalLimit),
              ),
            )
        : zero,
      can("disbursements:authorise")
        ? this.db
            .select({ count })
            .from(loanDisbursements)
            .innerJoin(loans, eq(loanDisbursements.loanId, loans.id))
            .where(
              and(
                scope(user, loans.tenantId, loans.branchId),
                eq(loanDisbursements.status, "requested"),
                ne(loanDisbursements.requestedBy, user.id),
                ne(loans.approvedBy, user.id),
              ),
            )
        : zero,
      can("payments:reverse:approve")
        ? this.db
            .select({ count })
            .from(paymentReversals)
            .where(and(eq(paymentReversals.tenantId, user.tenantId), eq(paymentReversals.status, "pending"), ne(paymentReversals.requestedBy, user.id)))
        : zero,
      can("customers:verify")
        ? this.db
            .select({ count })
            .from(customers)
            .where(and(scope(user, customers.tenantId, customers.branchId), eq(customers.kycStatus, "pending")))
        : zero,
    ]);
    const result = { applications: apps[0].count, disbursements: disb[0].count, reversals: revs[0].count, kyc: kyc[0].count };
    return { ...result, total: result.applications + result.disbursements + result.reversals + result.kyc };
  }

  private groupPerformance(book: PortfolioLoan[], key: (l: PortfolioLoan) => { id: string; name: string }) {
    const groups = new Map<string, { name: string; loans: PortfolioLoan[] }>();
    for (const l of book) {
      const k = key(l);
      const g = groups.get(k.id) ?? { name: k.name, loans: [] };
      g.loans.push(l);
      groups.set(k.id, g);
    }
    return [...groups.entries()]
      .map(([id, g]) => ({
        id,
        name: g.name,
        activeLoans: g.loans.length,
        outstandingPrincipal: m(sum(g.loans.map((l) => l.position.principalOutstanding))),
        par30: portfolioAtRisk(
          g.loans.map((l) => ({ principalOutstanding: l.position.principalOutstanding, daysPastDue: l.position.daysPastDue })),
          30,
        ),
      }))
      .sort((a, b) => Number(b.outstandingPrincipal) - Number(a.outstandingPrincipal));
  }

  async overdue(user: AuthUser, bucket?: AgeingBucket) {
    const book = await this.portfolio(user);
    return book
      .filter((l) => l.position.daysPastDue > 0 && (!bucket || l.position.bucket === bucket))
      .sort((a, b) => b.position.daysPastDue - a.position.daysPastDue)
      .map((l) => ({ ...l, ...l.position, position: undefined }));
  }
}
