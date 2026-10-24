import { Body, Controller, ForbiddenException, Headers, HttpCode, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { CHANNELS, Channel, MONEY_RE } from '@anzelu/contracts';
import { and, eq } from 'drizzle-orm';
import type { Request } from 'express';
import { Public } from '../common/auth';
import { BusinessRuleError } from '../common/http';
import { DB, InjectDb } from '../db/database';
import { loans, tenants, webhookEvents } from '../db/schema';
import { PaymentsService } from '../payments/payments.service';
import { adapterFor } from './providers';

/**
 * Inbound mobile-money repayment callbacks. The signature is verified before
 * anything is trusted, every call is logged, and the provider transaction ID
 * becomes the idempotency key so retried callbacks never double-post.
 */
@Controller('integrations')
export class WebhooksController {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly payments: PaymentsService,
  ) {}

  @Public()
  @Post(':provider/callback/:tenantCode')
  @HttpCode(200)
  async callback(
    @Param('provider') provider: string,
    @Param('tenantCode') tenantCode: string,
    @Headers('x-signature') signature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: unknown,
  ) {
    if (!(CHANNELS as readonly string[]).includes(provider) || !['mtn_momo', 'airtel_money'].includes(provider)) {
      throw new NotFoundException('Unknown provider');
    }
    const adapter = adapterFor(provider as Channel);
    const [tenant] = await this.db.select().from(tenants).where(eq(tenants.code, tenantCode.toUpperCase()));
    const valid = !!req.rawBody && adapter.verifySignature(req.rawBody, signature);
    const log = (outcome: string, externalRef: string | null, error?: string) =>
      this.db.insert(webhookEvents).values({
        tenantId: tenant?.id ?? null,
        provider,
        externalRef,
        payload: (body ?? {}) as object,
        signatureValid: valid,
        outcome,
        error,
      });

    if (!valid) {
      await log('rejected', null, 'Invalid signature');
      throw new ForbiddenException({ code: 'INVALID_SIGNATURE', message: 'Signature verification failed' });
    }
    if (!tenant || tenant.status !== 'active') {
      await log('rejected', null, 'Unknown or suspended institution');
      throw new NotFoundException('Unknown institution');
    }

    let inbound;
    try {
      inbound = adapter.parseCallback(body);
      if (!MONEY_RE.test(inbound.amount)) throw new Error('Invalid amount');
    } catch (e) {
      await log('rejected', null, (e as Error).message);
      throw new BusinessRuleError('INVALID_CALLBACK', (e as Error).message);
    }

    const [loan] = await this.db
      .select({ id: loans.id })
      .from(loans)
      .where(and(eq(loans.tenantId, tenant.id), eq(loans.loanNumber, inbound.accountRef.toUpperCase())));
    if (!loan) {
      await log('unmatched', inbound.externalRef, `No loan ${inbound.accountRef}`);
      return { status: 'unmatched', message: 'Logged for manual reconciliation' };
    }

    try {
      const payment = await this.payments.record(
        null,
        {
          loanId: loan.id,
          amount: inbound.amount,
          channel: provider as Channel,
          externalRef: inbound.externalRef,
          idempotencyKey: `${provider}:${inbound.externalRef}`,
          receivedAt: /^\d{4}-\d{2}-\d{2}$/.test(inbound.receivedOn) ? inbound.receivedOn : undefined,
        },
        { systemTenantId: tenant.id },
      );
      await log(payment.duplicate ? 'duplicate' : 'processed', inbound.externalRef);
      return { status: payment.duplicate ? 'duplicate' : 'processed', receiptNumber: payment.receiptNumber };
    } catch (e) {
      await log('failed', inbound.externalRef, (e as Error).message);
      throw e;
    }
  }
}
