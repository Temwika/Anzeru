import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Executor } from '../db/database';
import { counters } from '../db/schema';

export type Sequence = 'customer' | 'application' | 'loan' | 'receipt' | 'journal';

const PREFIX: Record<Sequence, string> = {
  customer: 'CUS',
  application: 'APP',
  loan: 'LN',
  receipt: 'RCT',
  journal: 'JE',
};

/** Gap-free, per-tenant sequential document numbers allocated inside the caller's transaction. */
@Injectable()
export class NumberingService {
  async next(ex: Executor, tenantId: string, seq: Sequence): Promise<string> {
    const [row] = await ex
      .insert(counters)
      .values({ tenantId, key: seq, value: 1 })
      .onConflictDoUpdate({ target: [counters.tenantId, counters.key], set: { value: sql`${counters.value} + 1` } })
      .returning({ value: counters.value });
    return `${PREFIX[seq]}-${String(row.value).padStart(6, '0')}`;
  }
}
