import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Channel } from '@anzelu/contracts';

export interface PayoutRequest {
  amount: string;
  destination: string;
  reference: string;
}

export interface PayoutResult {
  status: 'completed' | 'pending' | 'failed';
  providerRef: string;
  message?: string;
}

/** A request-to-pay: the provider prompts the payer's phone to approve a debit. */
export interface CollectionPrompt {
  amount: string;
  msisdn: string;
  /** Shown on the payer's phone, e.g. the loan number. */
  reference: string;
  /** Our request id; the provider echoes it back so the result can be matched. */
  externalId: string;
}

export interface CollectionPromptResult {
  status: 'pending' | 'failed';
  providerRef: string;
  message?: string;
}

export interface InboundPayment {
  externalRef: string;
  accountRef: string;
  amount: string;
  payer: string;
  receivedOn: string;
}

/**
 * Replaceable adapter per payment rail. Production adapters for MTN MoMo and
 * Airtel Money implement the same interface once sandbox and production access
 * have been granted by each provider.
 */
export interface PaymentProviderAdapter {
  readonly channel: Channel;
  payout(req: PayoutRequest): Promise<PayoutResult>;
  requestToPay(req: CollectionPrompt): Promise<CollectionPromptResult>;
  /** True when the adapter simulates the provider (no real money moves). */
  readonly sandbox: boolean;
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean;
  parseCallback(body: unknown): InboundPayment;
}

/** Sandbox adapter: payouts succeed immediately; callbacks are HMAC-SHA256 signed with MOMO_WEBHOOK_SECRET. */
export class SandboxMobileMoneyAdapter implements PaymentProviderAdapter {
  readonly sandbox = true;

  constructor(
    readonly channel: Channel,
    private readonly secret = process.env.MOMO_WEBHOOK_SECRET ?? 'dev-webhook-secret',
  ) {}

  async payout(req: PayoutRequest): Promise<PayoutResult> {
    return {
      status: 'completed',
      providerRef: `SBX-${randomBytes(5).toString('hex').toUpperCase()}`,
      message: `Sandbox payout of K${req.amount} to ${req.destination}`,
    };
  }

  async requestToPay(req: CollectionPrompt): Promise<CollectionPromptResult> {
    return {
      status: 'pending',
      providerRef: `SBX-RTP-${randomBytes(5).toString('hex').toUpperCase()}`,
      message: `Approve K${req.amount} for ${req.reference} on ${req.msisdn}`,
    };
  }

  /**
   * How the simulated payer responds to the prompt. Numbers ending in 0000 decline,
   * so the failure path can be demonstrated; everything else approves.
   */
  sandboxOutcome(msisdn: string): { approved: boolean; reason?: string } {
    return msisdn.endsWith('0000') ? { approved: false, reason: 'The payment was declined on the phone' } : { approved: true };
  }

  sign(rawBody: Buffer | string): string {
    return createHmac('sha256', this.secret).update(rawBody).digest('hex');
  }

  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
    return timingSafeEqual(Buffer.from(this.sign(rawBody), 'hex'), Buffer.from(signature, 'hex'));
  }

  parseCallback(body: unknown): InboundPayment {
    const b = (body ?? {}) as Record<string, unknown>;
    const str = (k: string) => {
      const v = b[k];
      if (typeof v !== 'string' && typeof v !== 'number') throw new Error(`Callback field "${k}" is missing`);
      return String(v);
    };
    return {
      externalRef: str('transactionId'),
      accountRef: str('accountReference'),
      amount: str('amount'),
      payer: str('msisdn'),
      receivedOn: typeof b.date === 'string' ? b.date : new Date().toISOString().slice(0, 10),
    };
  }
}

/** Bank and cash payouts are executed outside the system and recorded by reference. */
class ManualAdapter implements PaymentProviderAdapter {
  readonly sandbox = false;

  constructor(readonly channel: Channel) {}

  async payout(req: PayoutRequest): Promise<PayoutResult> {
    return { status: 'completed', providerRef: req.reference };
  }

  async requestToPay(): Promise<CollectionPromptResult> {
    throw new Error('Bank and cash payments cannot be requested from a phone');
  }

  verifySignature(): boolean {
    return false;
  }

  parseCallback(): InboundPayment {
    throw new Error('Manual channels do not send callbacks');
  }
}

const adapters: Record<Channel, PaymentProviderAdapter> = {
  mtn_momo: new SandboxMobileMoneyAdapter('mtn_momo'),
  airtel_money: new SandboxMobileMoneyAdapter('airtel_money'),
  bank: new ManualAdapter('bank'),
  cash: new ManualAdapter('cash'),
};

export function adapterFor(channel: Channel): PaymentProviderAdapter {
  return adapters[channel];
}
