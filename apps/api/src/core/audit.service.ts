import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { DB, Executor, InjectDb } from '../db/database';
import { auditLogs } from '../db/schema';

export interface AuditEvent {
  tenantId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  data?: Record<string, unknown>;
  ip?: string | null;
}

const GENESIS = '0'.repeat(64);

/** JSON with sorted keys so a hash computed on write can be recomputed from what jsonb returns. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

interface ChainContent {
  tenantId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

function digest(prevHash: string, c: ChainContent): string {
  return createHash('sha256').update(`${prevHash}|${canonical(c)}`).digest('hex');
}

/**
 * Append-only, hash-chained audit trail. Rows are also protected from UPDATE and
 * DELETE by a database trigger; the chain makes any out-of-band edit detectable.
 * Call inside the same transaction as the business change it describes.
 */
@Injectable()
export class AuditService {
  constructor(@InjectDb() private readonly db: DB) {}

  async record(ex: Executor, event: AuditEvent): Promise<void> {
    const tenantCond = event.tenantId ? eq(auditLogs.tenantId, event.tenantId) : isNull(auditLogs.tenantId);
    // Serialise appends per tenant so the chain never forks.
    await ex.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'audit:' + (event.tenantId ?? 'platform')}))`);
    const [prev] = await ex
      .select({ hash: auditLogs.hash })
      .from(auditLogs)
      .where(tenantCond)
      .orderBy(desc(auditLogs.seq))
      .limit(1);
    const prevHash = prev?.hash ?? GENESIS;
    const content: ChainContent = {
      tenantId: event.tenantId,
      userId: event.userId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      data: JSON.parse(JSON.stringify(event.data ?? {})),
      createdAt: new Date().toISOString(),
    };
    await ex.insert(auditLogs).values({
      ...content,
      createdAt: new Date(content.createdAt),
      ip: event.ip ?? null,
      prevHash,
      hash: digest(prevHash, content),
    });
  }

  /** Recomputes the whole chain for a tenant and reports the first broken link, if any. */
  async verify(tenantId: string | null): Promise<{ valid: boolean; checked: number; brokenAtSeq?: number }> {
    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(tenantId ? eq(auditLogs.tenantId, tenantId) : isNull(auditLogs.tenantId))
      .orderBy(asc(auditLogs.seq));
    let prevHash = GENESIS;
    for (const row of rows) {
      const expected = digest(prevHash, {
        tenantId: row.tenantId,
        userId: row.userId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        data: row.data as Record<string, unknown>,
        createdAt: row.createdAt.toISOString(),
      });
      if (row.prevHash !== prevHash || row.hash !== expected) {
        return { valid: false, checked: rows.length, brokenAtSeq: row.seq };
      }
      prevHash = row.hash;
    }
    return { valid: true, checked: rows.length };
  }
}
