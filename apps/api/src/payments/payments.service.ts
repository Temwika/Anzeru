import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentCreateInput } from "@anzelu/contracts";
import { allocatePayment, Component, dec, m, settlementQuote, settlementWaivers, sum, todayIn } from "@anzelu/finance";
import { aliasedTable, and, desc, eq, sql } from "drizzle-orm";
import { AuthUser, scope, tenantOf } from "../common/auth";
import { BusinessRuleError, Paged, paging } from "../common/http";
import { AuditService } from "../core/audit.service";
import { ACCOUNTS, channelAccount, LedgerService } from "../core/ledger.service";
import { NotificationsService } from "../core/notifications.service";
import { NumberingService } from "../core/numbering.service";
import { DB, InjectDb, Tx } from "../db/database";
import { customers, loans, loanScheduleItems, paymentAllocations, paymentReversals, payments, tenants, users } from "../db/schema";
import { positionOf, scheduleRows, toServicingItem } from "../loans/servicing";

const PAID_COLUMN = {
  penalty: "penaltyPaid",
  fee: "feePaid",
  interest: "interestPaid",
  principal: "principalPaid",
} as const satisfies Record<Component, keyof typeof loanScheduleItems.$inferSelect>;

const INCOME_ACCOUNT: Record<Component, string> = {
  principal: ACCOUNTS.loansReceivable,
  interest: ACCOUNTS.interestIncome,
  fee: ACCOUNTS.feeIncome,
  penalty: ACCOUNTS.penaltyIncome,
};

export interface RecordPaymentOptions {
  /** Set for system-originated payments such as verified mobile-money callbacks. */
  systemTenantId?: string;
  ip?: string;
  /**
   * Early settlement: future-period interest is waived on the schedule in the same
   * transaction, so the settlement amount clears the loan exactly. The amount must
   * cover the settlement quote as at the payment date.
   */
  settlement?: boolean;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly numbering: NumberingService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, q: { loanId?: string; status?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, offset } = paging(q);
    const conditions = [scope(user, loans.tenantId, loans.branchId)];
    if (q.loanId) conditions.push(eq(payments.loanId, q.loanId));
    if (q.status === "posted" || q.status === "reversed") conditions.push(eq(payments.status, q.status));
    const where = and(...conditions);
    const recorder = aliasedTable(users, "recorder");
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: payments.id,
          receiptNumber: payments.receiptNumber,
          amount: payments.amount,
          unallocated: payments.unallocated,
          channel: payments.channel,
          externalRef: payments.externalRef,
          status: payments.status,
          receivedOn: payments.receivedOn,
          createdAt: payments.createdAt,
          loanId: loans.id,
          loanNumber: loans.loanNumber,
          customerName: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
          recordedBy: recorder.fullName,
          pendingReversal: sql<boolean>`EXISTS (SELECT 1 FROM ${paymentReversals} WHERE ${paymentReversals.paymentId} = ${payments.id} AND ${paymentReversals.status} = 'pending')`,
        })
        .from(payments)
        .innerJoin(loans, eq(payments.loanId, loans.id))
        .innerJoin(customers, eq(loans.customerId, customers.id))
        .leftJoin(recorder, eq(payments.recordedBy, recorder.id))
        .where(where)
        .orderBy(desc(payments.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(payments)
        .innerJoin(loans, eq(payments.loanId, loans.id))
        .where(where),
    ]);
    return new Paged(rows, count, page, pageSize);
  }

  async receipt(user: AuthUser, id: string) {
    const [row] = await this.db
      .select({ payment: payments, loan: loans, customer: customers, recordedByName: users.fullName, tenant: tenants })
      .from(payments)
      .innerJoin(loans, eq(payments.loanId, loans.id))
      .innerJoin(customers, eq(loans.customerId, customers.id))
      .innerJoin(tenants, eq(payments.tenantId, tenants.id))
      .leftJoin(users, eq(payments.recordedBy, users.id))
      .where(and(eq(payments.id, id), scope(user, loans.tenantId, loans.branchId)));
    if (!row) throw new NotFoundException("Payment not found");
    // Figures for the printed receipt, as at this payment: what was owed, paid before, paid now and left.
    const [schedule, [{ before }]] = await Promise.all([
      scheduleRows(this.db, row.payment.tenantId, row.payment.loanId),
      this.db
        .select({ before: sql<string>`coalesce(sum(${payments.amount}), 0)::text` })
        .from(payments)
        .where(
          and(
            eq(payments.loanId, row.payment.loanId),
            eq(payments.status, "posted"),
            sql`(${payments.receivedOn}, ${payments.createdAt}) < (${row.payment.receivedOn}::date, ${new Date(row.payment.createdAt).toISOString()}::timestamptz)`,
          ),
        ),
    ]);
    const totalPayable = sum(schedule.flatMap((s) => [s.principalDue, s.interestDue, s.feeDue, s.penaltyDue]));
    const balance = totalPayable.minus(dec(before)).minus(dec(row.payment.amount));
    const allocations = await this.db
      .select({ component: paymentAllocations.component, amount: paymentAllocations.amount, installmentNo: loanScheduleItems.installmentNo })
      .from(paymentAllocations)
      .innerJoin(loanScheduleItems, eq(paymentAllocations.scheduleItemId, loanScheduleItems.id))
      .where(eq(paymentAllocations.paymentId, id));
    const reversals = await this.db.select().from(paymentReversals).where(eq(paymentReversals.paymentId, id)).orderBy(desc(paymentReversals.requestedAt));
    return {
      ...row.payment,
      loanNumber: row.loan.loanNumber,
      customerName: `${row.customer.firstName} ${row.customer.lastName}`,
      customerNumber: row.customer.customerNumber,
      customerNrc: row.customer.nrc,
      customerPhone: row.customer.phone,
      recordedByName: row.recordedByName,
      company: { name: row.tenant.name, ...row.tenant.profile },
      figures: {
        originalAmount: row.loan.principal,
        totalPayable: m(totalPayable),
        previousPayments: m(dec(before)),
        paidToday: row.payment.amount,
        balance: m(balance.lt(0) ? dec(0) : balance),
      },
      allocations,
      reversals,
    };
  }

  /**
   * Records a repayment exactly once per idempotency key: a retried request or
   * duplicate provider callback returns the original receipt instead of posting
   * twice. Allocation, schedule update, journal and audit commit atomically.
   */
  async record(user: AuthUser | null, input: PaymentCreateInput, opts: RecordPaymentOptions = {}) {
    const tenantId = user ? tenantOf(user) : opts.systemTenantId!;
    const timezone = user?.timezone ?? "Africa/Lusaka";
    const today = todayIn(timezone);
    const receivedOn = input.receivedAt ?? today;
    if (receivedOn > today) throw new BusinessRuleError("FUTURE_DATE", "A payment cannot be dated in the future");

    const existing = await this.findByIdempotencyKey(this.db, tenantId, input.idempotencyKey);
    if (existing) return { ...existing, duplicate: true };

    try {
      return await this.db.transaction(async (tx) => {
        const loanScope = user ? scope(user, loans.tenantId, loans.branchId) : eq(loans.tenantId, tenantId);
        const [loan] = await tx
          .select()
          .from(loans)
          .where(and(eq(loans.id, input.loanId), loanScope))
          .for("update");
        if (!loan) throw new NotFoundException("Loan not found");
        if (loan.status !== "active")
          throw new BusinessRuleError("LOAN_NOT_ACTIVE", `Payments can only be received on active loans (this one is ${loan.status.replace("_", " ")})`);

        let rows = await scheduleRows(tx, tenantId, loan.id);
        let interestWaived = "0.00";
        let waivers: { itemId: string; interest: string }[] | null = null;
        if (opts.settlement) {
          const quote = settlementQuote(rows.map(toServicingItem), receivedOn);
          if (dec(input.amount).lt(dec(quote.total))) {
            throw new BusinessRuleError("SETTLEMENT_SHORT", `Settling this loan today takes K${quote.total}`);
          }
          waivers = settlementWaivers(rows.map(toServicingItem), receivedOn).map((w) => ({ itemId: w.itemId, interest: w.interest }));
          for (const w of waivers) {
            await tx
              .update(loanScheduleItems)
              .set({ interestDue: sql`${loanScheduleItems.interestDue} - ${w.interest}` })
              .where(eq(loanScheduleItems.id, w.itemId));
          }
          interestWaived = quote.interestWaived;
          rows = await scheduleRows(tx, tenantId, loan.id);
        }
        const result = allocatePayment(input.amount, rows.map(toServicingItem));

        const [payment] = await tx
          .insert(payments)
          .values({
            tenantId,
            loanId: loan.id,
            receiptNumber: await this.numbering.next(tx, tenantId, "receipt"),
            amount: m(input.amount),
            unallocated: result.unallocated,
            channel: input.channel,
            externalRef: input.externalRef ?? null,
            idempotencyKey: input.idempotencyKey,
            receivedOn,
            recordedBy: user?.id ?? null,
            interestWaivers: waivers,
          })
          .returning();

        if (result.allocations.length) {
          await tx
            .insert(paymentAllocations)
            .values(result.allocations.map((a) => ({ tenantId, paymentId: payment.id, scheduleItemId: a.itemId, component: a.component, amount: a.amount })));
          await this.applyToSchedule(tx, result.allocations, 1);
        }

        const journalId = await this.ledger.post(tx, {
          tenantId,
          date: receivedOn,
          description: `Repayment ${payment.receiptNumber} on ${loan.loanNumber}`,
          sourceType: "payment",
          sourceId: payment.id,
          postedBy: user?.id ?? null,
          lines: [
            { account: channelAccount(input.channel), debit: payment.amount },
            ...(["principal", "interest", "fee", "penalty"] as Component[]).map((c) => ({ account: INCOME_ACCOUNT[c], credit: result.byComponent[c] })),
            { account: ACCOUNTS.customerCredits, credit: result.unallocated },
          ],
        });
        await tx.update(payments).set({ journalEntryId: journalId }).where(eq(payments.id, payment.id));

        const after = positionOf(await scheduleRows(tx, tenantId, loan.id), today);
        if (after.paidOff) await tx.update(loans).set({ status: "closed", closedAt: new Date() }).where(eq(loans.id, loan.id));

        await this.audit.record(tx, {
          tenantId,
          userId: user?.id ?? null,
          action: "payment.recorded",
          entityType: "payment",
          entityId: payment.id,
          data: {
            loanId: loan.id,
            amount: payment.amount,
            channel: input.channel,
            allocated: result.byComponent,
            unallocated: result.unallocated,
            journalId,
            ...(opts.settlement ? { settlement: true, interestWaived } : {}),
          },
          ip: opts.ip,
        });

        const [customer] = await tx.select({ phone: customers.phone, firstName: customers.firstName }).from(customers).where(eq(customers.id, loan.customerId));
        await this.notifications.send(tx, {
          tenantId,
          channel: "sms",
          recipient: customer.phone,
          template: "receipt",
          message: `Dear ${customer.firstName}, we received K${payment.amount} for loan ${loan.loanNumber} (receipt ${payment.receiptNumber}). ${after.paidOff ? "Your loan is now fully repaid. Thank you!" : `Balance K${after.totalOutstanding}.`}`,
          relatedType: "payment",
          relatedId: payment.id,
          dedupeKey: `receipt:${payment.id}`,
        });

        return { ...payment, journalEntryId: journalId, allocations: result.allocations, loanClosed: after.paidOff, duplicate: false };
      });
    } catch (err) {
      // A concurrent request with the same key won the race: return its receipt.
      const raced = await this.findByIdempotencyKey(this.db, tenantId, input.idempotencyKey);
      if (raced) return { ...raced, duplicate: true };
      throw err;
    }
  }

  private async findByIdempotencyKey(ex: DB | Tx, tenantId: string, key: string) {
    const [p] = await ex
      .select()
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.idempotencyKey, key)));
    return p;
  }

  /** Adds (sign 1) or removes (sign -1) allocated amounts on schedule items. */
  private async applyToSchedule(tx: Tx, allocations: { itemId?: string; scheduleItemId?: string; component: Component; amount: string }[], sign: 1 | -1) {
    for (const a of allocations) {
      const col = loanScheduleItems[PAID_COLUMN[a.component]];
      await tx
        .update(loanScheduleItems)
        .set({ [PAID_COLUMN[a.component]]: sql`${col} + ${sign === 1 ? a.amount : `-${a.amount}`}::numeric` })
        .where(eq(loanScheduleItems.id, (a.itemId ?? a.scheduleItemId)!));
    }
  }

  async requestReversal(user: AuthUser, paymentId: string, reason: string) {
    const tenantId = tenantOf(user);
    return this.db.transaction(async (tx) => {
      const [p] = await tx
        .select({ payment: payments })
        .from(payments)
        .innerJoin(loans, eq(payments.loanId, loans.id))
        .where(and(eq(payments.id, paymentId), scope(user, loans.tenantId, loans.branchId)))
        .for("update", { of: payments });
      if (!p) throw new NotFoundException("Payment not found");
      if (p.payment.status === "reversed") throw new BusinessRuleError("ALREADY_REVERSED", "This payment has already been reversed");
      const [pending] = await tx
        .select({ id: paymentReversals.id })
        .from(paymentReversals)
        .where(and(eq(paymentReversals.paymentId, paymentId), eq(paymentReversals.status, "pending")));
      if (pending) throw new BusinessRuleError("REVERSAL_PENDING", "A reversal request is already awaiting approval");
      const [r] = await tx.insert(paymentReversals).values({ tenantId, paymentId, reason, requestedBy: user.id }).returning();
      await this.audit.record(tx, {
        tenantId,
        userId: user.id,
        action: "payment.reversal_requested",
        entityType: "payment",
        entityId: paymentId,
        data: { reason },
      });
      return r;
    });
  }

  async listReversals(user: AuthUser, status = "pending") {
    const requester = aliasedTable(users, "requester");
    return this.db
      .select({
        id: paymentReversals.id,
        reason: paymentReversals.reason,
        status: paymentReversals.status,
        requestedAt: paymentReversals.requestedAt,
        requestedBy: requester.fullName,
        requestedById: paymentReversals.requestedBy,
        paymentId: payments.id,
        receiptNumber: payments.receiptNumber,
        amount: payments.amount,
        loanNumber: loans.loanNumber,
        customerName: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
      })
      .from(paymentReversals)
      .innerJoin(payments, eq(paymentReversals.paymentId, payments.id))
      .innerJoin(loans, eq(payments.loanId, loans.id))
      .innerJoin(customers, eq(loans.customerId, customers.id))
      .innerJoin(requester, eq(paymentReversals.requestedBy, requester.id))
      .where(and(scope(user, loans.tenantId, loans.branchId), eq(paymentReversals.status, status as "pending")))
      .orderBy(desc(paymentReversals.requestedAt));
  }

  /** Approving a reversal posts a mirror journal and unwinds the original allocations; nothing is deleted. */
  async decideReversal(user: AuthUser, reversalId: string, decision: "approve" | "reject", note?: string) {
    const tenantId = tenantOf(user);
    return this.db.transaction(async (tx) => {
      const [r] = await tx
        .select()
        .from(paymentReversals)
        .where(and(eq(paymentReversals.id, reversalId), eq(paymentReversals.tenantId, tenantId)))
        .for("update");
      if (!r) throw new NotFoundException("Reversal request not found");
      if (r.status !== "pending") throw new BusinessRuleError("ALREADY_DECIDED", `This request was already ${r.status}`);
      if (r.requestedBy === user.id) throw new ForbiddenException({ code: "MAKER_CHECKER", message: "You cannot approve a reversal you requested" });

      if (decision === "reject") {
        await tx.update(paymentReversals).set({ status: "rejected", decidedBy: user.id, decidedAt: new Date(), note }).where(eq(paymentReversals.id, r.id));
        await this.audit.record(tx, {
          tenantId,
          userId: user.id,
          action: "payment.reversal_rejected",
          entityType: "payment",
          entityId: r.paymentId,
          data: { note },
        });
        return { status: "rejected" };
      }

      const [payment] = await tx.select().from(payments).where(eq(payments.id, r.paymentId)).for("update");
      if (payment.status === "reversed") throw new BusinessRuleError("ALREADY_REVERSED", "This payment has already been reversed");
      const allocations = await tx.select().from(paymentAllocations).where(eq(paymentAllocations.paymentId, payment.id));
      await this.applyToSchedule(tx, allocations, -1);
      // An early settlement waived future interest; reversing it puts that interest back.
      for (const w of payment.interestWaivers ?? []) {
        await tx
          .update(loanScheduleItems)
          .set({ interestDue: sql`${loanScheduleItems.interestDue} + ${w.interest}` })
          .where(eq(loanScheduleItems.id, w.itemId));
      }

      const date = todayIn(user.timezone);
      const journalId = await this.ledger.reverse(tx, tenantId, payment.journalEntryId!, date, `Reversal of ${payment.receiptNumber}: ${r.reason}`, user.id);
      await tx.update(payments).set({ status: "reversed" }).where(eq(payments.id, payment.id));
      await tx
        .update(paymentReversals)
        .set({ status: "approved", decidedBy: user.id, decidedAt: new Date(), note, journalEntryId: journalId })
        .where(eq(paymentReversals.id, r.id));
      const [loan] = await tx.select().from(loans).where(eq(loans.id, payment.loanId));
      if (loan.status === "closed") await tx.update(loans).set({ status: "active", closedAt: null }).where(eq(loans.id, loan.id));
      await this.audit.record(tx, {
        tenantId,
        userId: user.id,
        action: "payment.reversed",
        entityType: "payment",
        entityId: payment.id,
        data: { amount: payment.amount, reversed: m(sum(allocations.map((a) => a.amount)).plus(dec(payment.unallocated))), journalId },
      });
      return { status: "approved", journalEntryId: journalId };
    });
  }
}
