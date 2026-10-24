import { loanPosition, ServicingItem, todayIn } from '@anzelu/finance';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { Executor } from '../db/database';
import { loanScheduleItems } from '../db/schema';

type ScheduleRow = typeof loanScheduleItems.$inferSelect;

export function toServicingItem(r: ScheduleRow): ServicingItem {
  return {
    id: r.id,
    installmentNo: r.installmentNo,
    dueDate: r.dueDate,
    due: { penalty: r.penaltyDue, fee: r.feeDue, interest: r.interestDue, principal: r.principalDue },
    paid: { penalty: r.penaltyPaid, fee: r.feePaid, interest: r.interestPaid, principal: r.principalPaid },
  };
}

export async function scheduleRows(ex: Executor, tenantId: string, loanId: string): Promise<ScheduleRow[]> {
  return ex
    .select()
    .from(loanScheduleItems)
    .where(and(eq(loanScheduleItems.tenantId, tenantId), eq(loanScheduleItems.loanId, loanId)))
    .orderBy(asc(loanScheduleItems.installmentNo));
}

/** Schedule rows for many loans at once, grouped by loan id. */
export async function scheduleRowsByLoan(ex: Executor, tenantId: string, loanIds: string[]) {
  const map = new Map<string, ScheduleRow[]>();
  if (!loanIds.length) return map;
  for (let i = 0; i < loanIds.length; i += 500) {
    const rows = await ex
      .select()
      .from(loanScheduleItems)
      .where(and(eq(loanScheduleItems.tenantId, tenantId), inArray(loanScheduleItems.loanId, loanIds.slice(i, i + 500))));
    for (const r of rows) {
      const list = map.get(r.loanId) ?? [];
      list.push(r);
      map.set(r.loanId, list);
    }
  }
  return map;
}

export function positionOf(rows: ScheduleRow[], asOf: string) {
  return loanPosition(rows.map(toServicingItem), asOf);
}

export function itemStatus(r: ScheduleRow, asOf: string): 'paid' | 'partial' | 'overdue' | 'due' | 'upcoming' {
  const pos = loanPosition([toServicingItem(r)], '9999-12-31');
  const paidAny = Number(r.principalPaid) + Number(r.interestPaid) + Number(r.feePaid) + Number(r.penaltyPaid) > 0;
  if (pos.paidOff) return 'paid';
  if (r.dueDate < asOf) return 'overdue';
  if (paidAny) return 'partial';
  return r.dueDate === asOf ? 'due' : 'upcoming';
}

export const today = (tz: string) => todayIn(tz);
