import { BadRequestException, Controller, Get, Ip, Query, Res } from "@nestjs/common";
import { AGEING_BUCKETS, LOAN_VIEWS, LoanView } from "@anzelu/contracts";
import { addDays, dec, m, portfolioAtRisk, sum, todayIn } from "@anzelu/finance";
import { aliasedTable, and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { Response } from "express";
import { AuthUser, CurrentUser, RequirePermissions, scope, tenantOf } from "../common/auth";
import { AuditService } from "../core/audit.service";
import { DB, InjectDb } from "../db/database";
import {
  auditLogs,
  branches,
  chartOfAccounts,
  creditDecisions,
  customers,
  journalEntries,
  journalLines,
  loanGroups,
  loanProducts,
  loans,
  loanScheduleItems,
  paymentReversals,
  payments,
  users,
} from "../db/schema";
import { positionOf, scheduleRowsByLoan } from "../loans/servicing";
import { csvCell } from "./reports.controller";
import { PortfolioLoan, ReportsService } from "./reports.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A reporting period from the query string, defaulting to the month to date. */
function period(user: AuthUser, q: { from?: string; to?: string }) {
  const today = todayIn(user.timezone);
  const to = q.to && DATE_RE.test(q.to) ? q.to : today;
  const from = q.from && DATE_RE.test(q.from) ? q.from : `${to.slice(0, 8)}01`;
  if (from > to) throw new BadRequestException("The start date must be on or before the end date");
  return { from, to };
}

function sendCsv(res: Response, name: string, header: string[], rows: unknown[][]) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  // A byte-order mark so Excel opens the file as UTF-8.
  res.send("﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n"));
}

const listRow = (l: PortfolioLoan) => ({
  id: l.id,
  loanNumber: l.loanNumber,
  customerId: l.customerId,
  customerName: l.customerName,
  phone: l.phone,
  branchName: l.branchName,
  officerName: l.officerName,
  productName: l.productName,
  principal: l.principal,
  disbursedOn: l.disbursedOn,
  maturityDate: l.maturityDate,
  totalOutstanding: l.position.totalOutstanding,
  overdueAmount: l.position.overdueAmount,
  daysPastDue: l.position.daysPastDue,
  nextDueDate: l.position.nextDueDate,
  nextDueAmount: l.position.nextDueAmount,
  bucket: l.position.bucket,
});

/** Day-to-day lending lists, portfolio quality, officer arrears, collections, auditor pack and exports. */
@Controller("reports")
export class OperationsReportsController {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
  ) {}

  /** Due today, in arrears, past maturity or maturing within 14 days. */
  @Get("loans")
  @RequirePermissions("loans:read")
  async loanView(@CurrentUser() user: AuthUser, @Query("view") view: string) {
    if (!LOAN_VIEWS.includes(view as LoanView)) throw new BadRequestException(`view must be one of ${LOAN_VIEWS.join(", ")}`);
    const asOf = todayIn(user.timezone);
    const soon = addDays(asOf, 14);
    const book = (await this.reports.portfolio(user, asOf)).filter((l) => !l.position.paidOff);
    const picked =
      view === "due_today"
        ? book.filter((l) => l.position.nextDueDate === asOf).sort((a, b) => a.customerName.localeCompare(b.customerName))
        : view === "arrears"
          ? book.filter((l) => l.position.daysPastDue > 0).sort((a, b) => b.position.daysPastDue - a.position.daysPastDue)
          : view === "past_maturity"
            ? book.filter((l) => l.maturityDate && l.maturityDate < asOf).sort((a, b) => a.maturityDate!.localeCompare(b.maturityDate!))
            : book
                .filter((l) => l.maturityDate && l.maturityDate >= asOf && l.maturityDate <= soon)
                .sort((a, b) => a.maturityDate!.localeCompare(b.maturityDate!));
    return {
      view,
      asOf,
      items: picked.map(listRow),
      totals: {
        count: picked.length,
        outstanding: m(sum(picked.map((l) => l.position.totalOutstanding))),
        overdue: m(sum(picked.map((l) => l.position.overdueAmount))),
        dueToday: m(sum(picked.filter((l) => l.position.nextDueDate === asOf).map((l) => l.position.nextDueAmount))),
      },
    };
  }

  @Get("portfolio-quality")
  @RequirePermissions("reports:read")
  async portfolioQuality(@CurrentUser() user: AuthUser) {
    const asOf = todayIn(user.timezone);
    const book = (await this.reports.portfolio(user, asOf)).filter((l) => !l.position.paidOff);
    const positions = book.map((l) => l.position);
    const total = sum(positions.map((p) => p.principalOutstanding));
    const share = (x: ReturnType<typeof sum>) => (total.isZero() ? "0.00" : x.div(total).times(100).toFixed(2));
    const buckets = AGEING_BUCKETS.map((b) => {
      const inB = positions.filter((p) => p.bucket === b);
      const principal = sum(inB.map((p) => p.principalOutstanding));
      return { bucket: b, loans: inB.length, principalOutstanding: m(principal), sharePct: share(principal) };
    });
    const byProduct = [...new Set(book.map((l) => l.productName))].sort().map((name) => {
      const ls = book.filter((l) => l.productName === name);
      return {
        productName: name,
        loans: ls.length,
        principalOutstanding: m(sum(ls.map((l) => l.position.principalOutstanding))),
        par30: portfolioAtRisk(
          ls.map((l) => l.position),
          30,
        ),
      };
    });
    return {
      asOf,
      loans: book.length,
      principalOutstanding: m(total),
      totalOutstanding: m(sum(positions.map((p) => p.totalOutstanding))),
      par: {
        par1: portfolioAtRisk(positions, 0),
        par30: portfolioAtRisk(positions, 30),
        par60: portfolioAtRisk(positions, 60),
        par90: portfolioAtRisk(positions, 90),
      },
      buckets,
      byProduct,
    };
  }

  @Get("arrears-by-officer")
  @RequirePermissions("reports:read")
  async arrearsByOfficer(@CurrentUser() user: AuthUser) {
    const asOf = todayIn(user.timezone);
    const book = (await this.reports.portfolio(user, asOf)).filter((l) => !l.position.paidOff);
    const officers = new Map<string, PortfolioLoan[]>();
    for (const l of book) officers.set(l.officerId, [...(officers.get(l.officerId) ?? []), l]);
    const rows = [...officers.entries()].map(([officerId, ls]) => {
      const late = ls.filter((l) => l.position.daysPastDue > 0);
      return {
        officerId,
        officerName: ls[0].officerName,
        loans: ls.length,
        outstanding: m(sum(ls.map((l) => l.position.totalOutstanding))),
        loansInArrears: late.length,
        arrearsAmount: m(sum(late.map((l) => l.position.overdueAmount))),
        par30: portfolioAtRisk(
          ls.map((l) => l.position),
          30,
        ),
        worstDaysPastDue: Math.max(0, ...ls.map((l) => l.position.daysPastDue)),
        loansLate: late.sort((a, b) => b.position.daysPastDue - a.position.daysPastDue).map(listRow),
      };
    });
    return { asOf, officers: rows.sort((a, b) => Number(b.arrearsAmount) - Number(a.arrearsAmount)) };
  }

  /** What fell due against what came in, by day, channel, branch and loan officer. */
  @Get("collections")
  @RequirePermissions("reports:read")
  async collections(@CurrentUser() user: AuthUser, @Query() q: { from?: string; to?: string }) {
    const { from, to } = period(user, q);
    const officer = aliasedTable(users, "officer");
    const inScope = and(
      scope(user, loans.tenantId, loans.branchId),
      eq(payments.status, "posted"),
      gte(payments.receivedOn, from),
      lte(payments.receivedOn, to),
    );
    const amount = sql<string>`coalesce(sum(${payments.amount}), 0)::text`;
    const [byDay, byChannel, byBranch, byOfficer, [expected], recent] = await Promise.all([
      this.db
        .select({ date: payments.receivedOn, amount, count: count() })
        .from(payments)
        .innerJoin(loans, eq(payments.loanId, loans.id))
        .where(inScope)
        .groupBy(payments.receivedOn)
        .orderBy(asc(payments.receivedOn)),
      this.db
        .select({ channel: payments.channel, amount, count: count() })
        .from(payments)
        .innerJoin(loans, eq(payments.loanId, loans.id))
        .where(inScope)
        .groupBy(payments.channel),
      this.db
        .select({ name: branches.name, amount, count: count() })
        .from(payments)
        .innerJoin(loans, eq(payments.loanId, loans.id))
        .innerJoin(branches, eq(loans.branchId, branches.id))
        .where(inScope)
        .groupBy(branches.name)
        .orderBy(desc(amount)),
      this.db
        .select({ name: officer.fullName, amount, count: count() })
        .from(payments)
        .innerJoin(loans, eq(payments.loanId, loans.id))
        .innerJoin(officer, eq(loans.officerId, officer.id))
        .where(inScope)
        .groupBy(officer.fullName)
        .orderBy(desc(amount)),
      this.db
        .select({
          due: sql<string>`coalesce(sum(${loanScheduleItems.principalDue} + ${loanScheduleItems.interestDue} + ${loanScheduleItems.feeDue} + ${loanScheduleItems.penaltyDue}), 0)::text`,
        })
        .from(loanScheduleItems)
        .innerJoin(loans, eq(loanScheduleItems.loanId, loans.id))
        .where(and(scope(user, loans.tenantId, loans.branchId), gte(loanScheduleItems.dueDate, from), lte(loanScheduleItems.dueDate, to))),
      this.db
        .select({
          id: payments.id,
          receiptNumber: payments.receiptNumber,
          receivedOn: payments.receivedOn,
          amount: payments.amount,
          channel: payments.channel,
          loanId: loans.id,
          loanNumber: loans.loanNumber,
          customerName: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
        })
        .from(payments)
        .innerJoin(loans, eq(payments.loanId, loans.id))
        .innerJoin(customers, eq(loans.customerId, customers.id))
        .where(inScope)
        .orderBy(desc(payments.receivedOn), desc(payments.createdAt))
        .limit(100),
    ]);
    const collected = sum(byDay.map((d) => d.amount));
    const due = dec(expected.due);
    return {
      from,
      to,
      collected: m(collected),
      payments: byDay.reduce((n, d) => n + d.count, 0),
      expected: m(due),
      collectionRatePct: due.isZero() ? null : collected.div(due).times(100).toFixed(1),
      byDay,
      byChannel,
      byBranch,
      byOfficer,
      recent,
    };
  }

  /** The pack an external auditor asks for: activity in the period, controls and ledger integrity. */
  @Get("auditor")
  @RequirePermissions("reports:read")
  async auditor(@CurrentUser() user: AuthUser, @Query() q: { from?: string; to?: string }) {
    const tenantId = tenantOf(user);
    const { from, to } = period(user, q);
    const inLoans = scope(user, loans.tenantId, loans.branchId);
    const [[disbursed], [repaid], [reversed], decisions, [selfApproved], [tb], activity, chain, book] = await Promise.all([
      this.db
        .select({ count: count(), amount: sql<string>`coalesce(sum(${loans.principal}), 0)::text` })
        .from(loans)
        .where(and(inLoans, gte(loans.disbursedOn, from), lte(loans.disbursedOn, to))),
      this.db
        .select({ count: count(), amount: sql<string>`coalesce(sum(${payments.amount}), 0)::text` })
        .from(payments)
        .innerJoin(loans, eq(payments.loanId, loans.id))
        .where(and(inLoans, eq(payments.status, "posted"), gte(payments.receivedOn, from), lte(payments.receivedOn, to))),
      this.db
        .select({ count: count(), amount: sql<string>`coalesce(sum(${payments.amount}), 0)::text` })
        .from(paymentReversals)
        .innerJoin(payments, eq(paymentReversals.paymentId, payments.id))
        .innerJoin(loans, eq(payments.loanId, loans.id))
        .where(and(inLoans, eq(paymentReversals.status, "approved"), sql`${paymentReversals.decidedAt}::date BETWEEN ${from}::date AND ${to}::date`)),
      this.db
        .select({ decision: creditDecisions.decision, count: count() })
        .from(creditDecisions)
        .where(and(eq(creditDecisions.tenantId, tenantId), sql`${creditDecisions.decidedAt}::date BETWEEN ${from}::date AND ${to}::date`))
        .groupBy(creditDecisions.decision),
      // Maker-checker: a loan should never be approved by the officer who booked it.
      this.db
        .select({ count: count() })
        .from(loans)
        .where(and(inLoans, eq(loans.approvedBy, loans.officerId))),
      this.db
        .select({
          debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)::text`,
          credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)::text`,
          entries: sql<number>`count(distinct ${journalEntries.id})::int`,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(eq(journalLines.tenantId, tenantId), lte(journalEntries.entryDate, to))),
      this.db
        .select({ name: sql<string>`coalesce(${users.fullName}, 'System')`, role: users.role, actions: count() })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(and(eq(auditLogs.tenantId, tenantId), sql`${auditLogs.createdAt}::date BETWEEN ${from}::date AND ${to}::date`))
        .groupBy(users.fullName, users.role)
        .orderBy(desc(count()))
        .limit(15),
      this.audit.verify(tenantId),
      this.reports.portfolio(user, to),
    ]);
    const positions = book.filter((l) => !l.position.paidOff).map((l) => l.position);
    return {
      from,
      to,
      disbursements: disbursed,
      repayments: repaid,
      reversals: reversed,
      decisions: Object.fromEntries(decisions.map((d) => [d.decision, d.count])),
      makerChecker: { selfApprovedLoans: selfApproved.count },
      ledger: { ...tb, balanced: dec(tb.debit).eq(dec(tb.credit)) },
      auditChain: chain,
      activity,
      portfolio: {
        loans: positions.length,
        principalOutstanding: m(sum(positions.map((p) => p.principalOutstanding))),
        par30: portfolioAtRisk(positions, 30),
      },
    };
  }

  /* ----------------------------------------------------------------- Exports */

  private async logExport(user: AuthUser, what: string, ip: string, data: Record<string, unknown> = {}) {
    await this.audit.record(this.db, {
      tenantId: tenantOf(user),
      userId: user.id,
      action: "export.downloaded",
      entityType: "export",
      entityId: what,
      data,
      ip,
    });
  }

  @Get("export/loans.csv")
  @RequirePermissions("reports:read")
  async exportLoans(@CurrentUser() user: AuthUser, @Ip() ip: string, @Res() res: Response) {
    const tenantId = tenantOf(user);
    const officer = aliasedTable(users, "officer");
    const rows = await this.db
      .select({
        loan: loans,
        customerName: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
        nrc: customers.nrc,
        phone: customers.phone,
        branchName: branches.name,
        officerName: officer.fullName,
        productName: loanProducts.name,
      })
      .from(loans)
      .innerJoin(customers, eq(loans.customerId, customers.id))
      .innerJoin(branches, eq(loans.branchId, branches.id))
      .innerJoin(officer, eq(loans.officerId, officer.id))
      .innerJoin(loanProducts, eq(loans.productId, loanProducts.id))
      .where(scope(user, loans.tenantId, loans.branchId))
      .orderBy(asc(loans.loanNumber));
    const schedules = await scheduleRowsByLoan(
      this.db,
      tenantId,
      rows.map((r) => r.loan.id),
    );
    const asOf = todayIn(user.timezone);
    await this.logExport(user, "loans", ip, { rows: rows.length });
    sendCsv(
      res,
      "loans",
      [
        "Loan",
        "Customer",
        "NRC",
        "Phone",
        "Branch",
        "Officer",
        "Product",
        "Principal",
        "Rate %",
        "Interest method",
        "Frequency",
        "Term",
        "Disbursed",
        "Maturity",
        "Status",
        "Total outstanding",
        "Overdue",
        "Days past due",
      ],
      rows.map((r) => {
        const p = positionOf(schedules.get(r.loan.id) ?? [], asOf);
        const live = r.loan.status === "active";
        return [
          r.loan.loanNumber,
          r.customerName,
          r.nrc,
          r.phone,
          r.branchName,
          r.officerName,
          r.productName,
          r.loan.principal,
          r.loan.annualRatePct,
          r.loan.interestMethod,
          r.loan.frequency,
          r.loan.term,
          r.loan.disbursedOn,
          r.loan.maturityDate,
          r.loan.status,
          live ? p.totalOutstanding : "0.00",
          live ? p.overdueAmount : "0.00",
          live ? p.daysPastDue : 0,
        ];
      }),
    );
  }

  @Get("export/repayments.csv")
  @RequirePermissions("reports:read")
  async exportRepayments(@CurrentUser() user: AuthUser, @Query() q: { from?: string; to?: string }, @Ip() ip: string, @Res() res: Response) {
    const { from, to } = period(user, q);
    const recorder = aliasedTable(users, "recorder");
    const rows = await this.db
      .select({
        p: payments,
        loanNumber: loans.loanNumber,
        customerName: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
        branchName: branches.name,
        recordedBy: recorder.fullName,
      })
      .from(payments)
      .innerJoin(loans, eq(payments.loanId, loans.id))
      .innerJoin(customers, eq(loans.customerId, customers.id))
      .innerJoin(branches, eq(loans.branchId, branches.id))
      .leftJoin(recorder, eq(payments.recordedBy, recorder.id))
      .where(and(scope(user, loans.tenantId, loans.branchId), gte(payments.receivedOn, from), lte(payments.receivedOn, to)))
      .orderBy(asc(payments.receivedOn), asc(payments.createdAt));
    await this.logExport(user, "repayments", ip, { from, to, rows: rows.length });
    sendCsv(
      res,
      `repayments-${from}-to-${to}`,
      ["Receipt", "Date", "Loan", "Customer", "Branch", "Amount", "Channel", "Reference", "Status", "Recorded by"],
      rows.map((r) => [
        r.p.receiptNumber,
        r.p.receivedOn,
        r.loanNumber,
        r.customerName,
        r.branchName,
        r.p.amount,
        r.p.channel,
        r.p.externalRef,
        r.p.status,
        r.recordedBy ?? "Mobile money callback",
      ]),
    );
  }

  @Get("export/borrowers.csv")
  @RequirePermissions("customers:read", "reports:read")
  async exportBorrowers(@CurrentUser() user: AuthUser, @Ip() ip: string, @Res() res: Response) {
    const rows = await this.db
      .select({ c: customers, branchName: branches.name, groupName: loanGroups.name })
      .from(customers)
      .innerJoin(branches, eq(customers.branchId, branches.id))
      .leftJoin(loanGroups, eq(customers.groupId, loanGroups.id))
      .where(scope(user, customers.tenantId, customers.branchId))
      .orderBy(asc(customers.customerNumber));
    await this.logExport(user, "borrowers", ip, { rows: rows.length });
    sendCsv(
      res,
      "borrowers",
      [
        "Customer no.",
        "First name",
        "Last name",
        "NRC",
        "Phone",
        "Gender",
        "Date of birth",
        "Address",
        "Branch",
        "Group",
        "Occupation",
        "Employer",
        "Monthly income",
        "KYC",
        "Registered",
      ],
      rows.map(({ c, branchName, groupName }) => [
        c.customerNumber,
        c.firstName,
        c.lastName,
        c.nrc,
        c.phone,
        c.gender,
        c.dateOfBirth,
        c.address,
        branchName,
        groupName,
        c.occupation,
        c.employer,
        c.monthlyIncome,
        c.kycStatus,
        c.createdAt.toISOString().slice(0, 10),
      ]),
    );
  }

  /** Journal lines in QuickBooks Online's journal-entry import layout (one row per line, grouped by journal number). */
  @Get("export/quickbooks.csv")
  @RequirePermissions("accounting:read")
  async exportQuickBooks(@CurrentUser() user: AuthUser, @Query() q: { from?: string; to?: string }, @Ip() ip: string, @Res() res: Response) {
    const tenantId = tenantOf(user);
    const { from, to } = period(user, q);
    const rows = await this.db
      .select({
        number: journalEntries.entryNumber,
        date: journalEntries.entryDate,
        description: journalEntries.description,
        account: sql<string>`${chartOfAccounts.code} || ' ' || ${chartOfAccounts.name}`,
        debit: journalLines.debit,
        credit: journalLines.credit,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalLines.accountId, chartOfAccounts.id))
      .where(and(eq(journalLines.tenantId, tenantId), gte(journalEntries.entryDate, from), lte(journalEntries.entryDate, to)))
      .orderBy(asc(journalEntries.entryDate), asc(journalEntries.entryNumber), desc(journalLines.debit));
    await this.logExport(user, "quickbooks", ip, { from, to, rows: rows.length });
    const ddmmyyyy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
    sendCsv(
      res,
      `quickbooks-journals-${from}-to-${to}`,
      ["Journal No", "Journal Date", "Account", "Debits", "Credits", "Description"],
      rows.map((r) => [r.number, ddmmyyyy(r.date), r.account, Number(r.debit) ? r.debit : "", Number(r.credit) ? r.credit : "", r.description]),
    );
  }
}
