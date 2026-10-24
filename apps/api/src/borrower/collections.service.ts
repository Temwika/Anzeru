import { Injectable, Logger, NotFoundException, OnApplicationShutdown } from '@nestjs/common';
import { BorrowerPayInput, Channel } from '@anzelu/contracts';
import { dec, m, settlementQuote, todayIn } from '@anzelu/finance';
import { and, eq, gt } from 'drizzle-orm';
import { AuthUser, tenantOf } from '../common/auth';
import { BusinessRuleError } from '../common/http';
import { AuditService } from '../core/audit.service';
import { DB, InjectDb } from '../db/database';
import { collectionRequests, loans, payments } from '../db/schema';
import { adapterFor, SandboxMobileMoneyAdapter } from '../integrations/providers';
import { positionOf, scheduleRows, toServicingItem } from '../loans/servicing';
import { PaymentsService } from '../payments/payments.service';

/** How long the simulated payer takes to approve the prompt on their phone. */
const SANDBOX_APPROVAL_MS = 4_000;
/** A pending prompt blocks another for the same loan, until the provider would have timed it out. */
const PROMPT_WINDOW_MS = 2 * 60_000;

/**
 * Borrower "Pay now": sends a mobile-money approval prompt to the borrower's
 * phone, then posts the repayment through the normal payment engine once the
 * provider confirms. The request id is the idempotency key, so a request can
 * never post twice however often the provider reports it.
 */
@Injectable()
export class CollectionsService implements OnApplicationShutdown {
  private readonly log = new Logger(CollectionsService.name);
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(
    @InjectDb() private readonly db: DB,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  async request(user: AuthUser, loanId: string, input: BorrowerPayInput) {
    const tenantId = tenantOf(user);
    if (!user.customerId) throw new NotFoundException('No customer profile is linked to this login');
    const [loan] = await this.db
      .select()
      .from(loans)
      .where(and(eq(loans.id, loanId), eq(loans.tenantId, tenantId), eq(loans.customerId, user.customerId)));
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== 'active') throw new BusinessRuleError('LOAN_NOT_ACTIVE', 'Payments can only be made on an active loan');

    const asOf = todayIn(user.timezone);
    const rows = await scheduleRows(this.db, tenantId, loan.id);
    const position = positionOf(rows, asOf);
    let amount: string;
    if (input.settlement) {
      amount = settlementQuote(rows.map(toServicingItem), asOf).total;
    } else {
      amount = m(input.amount!);
      if (dec(amount).lte(0)) throw new BusinessRuleError('AMOUNT_INVALID', 'Enter an amount greater than zero');
      if (dec(amount).gt(dec(position.totalOutstanding))) {
        throw new BusinessRuleError('AMOUNT_TOO_HIGH', `Your balance is K${position.totalOutstanding}; to clear the loan, use Pay off instead`);
      }
    }

    const [open] = await this.db
      .select({ id: collectionRequests.id })
      .from(collectionRequests)
      .where(
        and(
          eq(collectionRequests.loanId, loan.id),
          eq(collectionRequests.status, 'pending'),
          gt(collectionRequests.createdAt, new Date(Date.now() - PROMPT_WINDOW_MS)),
        ),
      );
    if (open) throw new BusinessRuleError('PROMPT_PENDING', 'A payment prompt is already waiting on your phone; approve or decline it first');

    const adapter = adapterFor(input.channel as Channel);
    const [req] = await this.db
      .insert(collectionRequests)
      .values({ tenantId, loanId: loan.id, requestedBy: user.id, channel: input.channel, msisdn: input.msisdn, amount, settlement: input.settlement })
      .returning();
    const prompt = await adapter.requestToPay({ amount, msisdn: input.msisdn, reference: loan.loanNumber, externalId: req.id });
    await this.db
      .update(collectionRequests)
      .set(prompt.status === 'failed' ? { status: 'failed', providerRef: prompt.providerRef, failureReason: prompt.message, completedAt: new Date() } : { providerRef: prompt.providerRef })
      .where(eq(collectionRequests.id, req.id));
    await this.audit.record(this.db, {
      tenantId,
      userId: user.id,
      action: 'collection.requested',
      entityType: 'loan',
      entityId: loan.id,
      data: { requestId: req.id, channel: input.channel, amount, settlement: input.settlement, providerRef: prompt.providerRef },
    });

    if (prompt.status === 'pending' && adapter instanceof SandboxMobileMoneyAdapter) {
      const outcome = adapter.sandboxOutcome(input.msisdn);
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        void this.complete(req.id, outcome.approved, outcome.reason);
      }, SANDBOX_APPROVAL_MS);
      this.timers.add(timer);
    }
    return this.get(user, req.id);
  }

  /** Provider outcome for a prompt: post the payment on approval, record the reason on decline. */
  async complete(requestId: string, approved: boolean, reason?: string) {
    const [req] = await this.db.select().from(collectionRequests).where(eq(collectionRequests.id, requestId));
    if (!req || req.status !== 'pending') return;
    if (!approved) {
      await this.db
        .update(collectionRequests)
        .set({ status: 'failed', failureReason: reason ?? 'The payment was not approved', completedAt: new Date() })
        .where(eq(collectionRequests.id, req.id));
      return;
    }
    try {
      const payment = await this.payments.record(
        null,
        { loanId: req.loanId, amount: req.amount, channel: req.channel, externalRef: req.providerRef ?? undefined, idempotencyKey: `rtp:${req.id}` },
        { systemTenantId: req.tenantId, settlement: req.settlement },
      );
      await this.db
        .update(collectionRequests)
        .set({ status: 'succeeded', paymentId: payment.id, completedAt: new Date() })
        .where(eq(collectionRequests.id, req.id));
    } catch (e) {
      this.log.error(`Collection ${req.id} approved but could not be posted: ${(e as Error).message}`);
      await this.db
        .update(collectionRequests)
        .set({ status: 'failed', failureReason: (e as Error).message, completedAt: new Date() })
        .where(eq(collectionRequests.id, req.id));
    }
  }

  async get(user: AuthUser, id: string) {
    const tenantId = tenantOf(user);
    const [row] = await this.db
      .select({ request: collectionRequests, loanNumber: loans.loanNumber, receiptNumber: payments.receiptNumber, loanStatus: loans.status })
      .from(collectionRequests)
      .innerJoin(loans, eq(collectionRequests.loanId, loans.id))
      .leftJoin(payments, eq(collectionRequests.paymentId, payments.id))
      .where(and(eq(collectionRequests.id, id), eq(collectionRequests.tenantId, tenantId), eq(collectionRequests.requestedBy, user.id)));
    if (!row) throw new NotFoundException('Payment request not found');
    const r = row.request;
    return {
      id: r.id,
      loanId: r.loanId,
      loanNumber: row.loanNumber,
      channel: r.channel,
      msisdn: r.msisdn,
      amount: r.amount,
      settlement: r.settlement,
      status: r.status,
      failureReason: r.failureReason,
      receiptNumber: row.receiptNumber,
      loanClosed: row.loanStatus === 'closed',
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    };
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearTimeout(t);
  }
}
