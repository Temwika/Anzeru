import { daysBetween, Frequency, PERIODS_PER_YEAR } from './dates';
import { D, Dec, dec, m, MoneyLike, round2, sum, ZERO } from './money';

export type Component = 'penalty' | 'fee' | 'interest' | 'principal';
export const COMPONENTS: Component[] = ['penalty', 'fee', 'interest', 'principal'];
/** Default waterfall: penalties, then fees, then interest, then principal — per instalment, oldest first. */
export const DEFAULT_ALLOCATION_ORDER: Component[] = ['penalty', 'fee', 'interest', 'principal'];

export type Amounts = Record<Component, string>;

export interface ServicingItem {
  id: string;
  installmentNo: number;
  dueDate: string;
  due: Amounts;
  paid: Amounts;
}

export interface Allocation {
  itemId: string;
  installmentNo: number;
  component: Component;
  amount: string;
}

export function outstandingOf(item: Pick<ServicingItem, 'due' | 'paid'>): Record<Component, Dec> {
  const out = {} as Record<Component, Dec>;
  for (const c of COMPONENTS) out[c] = D.max(dec(item.due[c]).minus(dec(item.paid[c])), ZERO);
  return out;
}

export function outstandingTotal(item: Pick<ServicingItem, 'due' | 'paid'>): Dec {
  const o = outstandingOf(item);
  return sum(COMPONENTS.map((c) => o[c]));
}

/**
 * Deterministic payment allocation. Walks instalments in due-date order and,
 * within each, pays components in `order`. Anything left after the whole loan
 * is cleared is returned as `unallocated` (an overpayment / credit balance).
 */
export function allocatePayment(
  amount: MoneyLike,
  items: ServicingItem[],
  order: Component[] = DEFAULT_ALLOCATION_ORDER,
): { allocations: Allocation[]; unallocated: string; byComponent: Amounts } {
  let remaining = round2(amount);
  if (remaining.lte(0)) throw new Error('Payment amount must be greater than zero');
  const sorted = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.installmentNo - b.installmentNo);
  const allocations: Allocation[] = [];
  const byComponent: Record<Component, Dec> = { penalty: ZERO, fee: ZERO, interest: ZERO, principal: ZERO };

  for (const item of sorted) {
    if (remaining.lte(0)) break;
    const out = outstandingOf(item);
    for (const component of order) {
      if (remaining.lte(0)) break;
      const take = D.min(out[component], remaining);
      if (take.gt(0)) {
        allocations.push({ itemId: item.id, installmentNo: item.installmentNo, component, amount: m(take) });
        byComponent[component] = byComponent[component].plus(take);
        remaining = remaining.minus(take);
      }
    }
  }

  return {
    allocations,
    unallocated: m(remaining),
    byComponent: {
      penalty: m(byComponent.penalty),
      fee: m(byComponent.fee),
      interest: m(byComponent.interest),
      principal: m(byComponent.principal),
    },
  };
}

export type AgeingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export function ageingBucket(daysPastDue: number): AgeingBucket {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return '1-30';
  if (daysPastDue <= 60) return '31-60';
  if (daysPastDue <= 90) return '61-90';
  return '90+';
}

export interface LoanPosition {
  principalOutstanding: string;
  interestOutstanding: string;
  feesOutstanding: string;
  penaltiesOutstanding: string;
  totalOutstanding: string;
  overdueAmount: string;
  overdueInstallments: number;
  daysPastDue: number;
  bucket: AgeingBucket;
  nextDueDate: string | null;
  nextDueAmount: string;
  paidOff: boolean;
}

/** Balances and arrears for a loan as at a calendar date. An instalment is overdue the day after its due date. */
export function loanPosition(items: ServicingItem[], asOf: string): LoanPosition {
  const totals: Record<Component, Dec> = { penalty: ZERO, fee: ZERO, interest: ZERO, principal: ZERO };
  let overdue = ZERO;
  let overdueCount = 0;
  let oldestOverdue: string | null = null;
  let next: ServicingItem | null = null;
  const sorted = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.installmentNo - b.installmentNo);

  for (const item of sorted) {
    const out = outstandingOf(item);
    for (const c of COMPONENTS) totals[c] = totals[c].plus(out[c]);
    const itemOut = sum(COMPONENTS.map((c) => out[c]));
    if (itemOut.lte(0)) continue;
    if (item.dueDate < asOf) {
      overdue = overdue.plus(itemOut);
      overdueCount++;
      oldestOverdue ??= item.dueDate;
    } else if (!next) {
      next = item;
    }
  }

  const dpd = oldestOverdue ? daysBetween(oldestOverdue, asOf) : 0;
  const total = sum(COMPONENTS.map((c) => totals[c]));
  return {
    principalOutstanding: m(totals.principal),
    interestOutstanding: m(totals.interest),
    feesOutstanding: m(totals.fee),
    penaltiesOutstanding: m(totals.penalty),
    totalOutstanding: m(total),
    overdueAmount: m(overdue),
    overdueInstallments: overdueCount,
    daysPastDue: dpd,
    bucket: ageingBucket(dpd),
    nextDueDate: next?.dueDate ?? null,
    nextDueAmount: next ? m(outstandingTotal(next)) : '0.00',
    paidOff: total.lte(0),
  };
}

/**
 * Portfolio at risk: outstanding principal of loans more than `days` past due
 * divided by total outstanding principal, as a percentage.
 */
export function portfolioAtRisk(loans: { principalOutstanding: MoneyLike; daysPastDue: number }[], days: number): string {
  const total = sum(loans.map((l) => l.principalOutstanding));
  if (total.lte(0)) return '0.00';
  const atRisk = sum(loans.filter((l) => l.daysPastDue > days).map((l) => l.principalOutstanding));
  return atRisk.div(total).times(100).toFixed(2);
}

export interface SettlementQuote {
  asOf: string;
  principal: string;
  interest: string;
  fees: string;
  penalties: string;
  total: string;
  interestWaived: string;
  rule: string;
}

/**
 * Early settlement: all outstanding principal, plus interest/fees/penalties on
 * instalments already due, plus the interest of the current (next) period.
 * Interest on later periods is waived.
 */
export function settlementQuote(items: ServicingItem[], asOf: string): SettlementQuote {
  const sorted = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.installmentNo - b.installmentNo);
  let principal = ZERO;
  let interest = ZERO;
  let fees = ZERO;
  let penalties = ZERO;
  let waived = ZERO;
  let currentPeriodCounted = false;

  for (const item of sorted) {
    const out = outstandingOf(item);
    principal = principal.plus(out.principal);
    penalties = penalties.plus(out.penalty);
    fees = fees.plus(out.fee);
    if (item.dueDate <= asOf) {
      interest = interest.plus(out.interest);
    } else if (!currentPeriodCounted) {
      interest = interest.plus(out.interest);
      currentPeriodCounted = true;
    } else {
      waived = waived.plus(out.interest);
    }
  }

  return {
    asOf,
    principal: m(principal),
    interest: m(interest),
    fees: m(fees),
    penalties: m(penalties),
    total: m(principal.plus(interest).plus(fees).plus(penalties)),
    interestWaived: m(waived),
    rule: 'Outstanding principal + charges due to date + current-period interest; later interest waived.',
  };
}

/**
 * The per-instalment interest that `settlementQuote` waives: outstanding
 * interest on every instalment after the current period. Applying these to the
 * schedule before allocating the settlement amount leaves the loan fully paid.
 */
export function settlementWaivers(items: ServicingItem[], asOf: string): { itemId: string; installmentNo: number; interest: string }[] {
  const sorted = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.installmentNo - b.installmentNo);
  const waivers: { itemId: string; installmentNo: number; interest: string }[] = [];
  let currentPeriodCounted = false;
  for (const item of sorted) {
    if (item.dueDate <= asOf) continue;
    if (!currentPeriodCounted) {
      currentPeriodCounted = true;
      continue;
    }
    const interest = outstandingOf(item).interest;
    if (interest.gt(0)) waivers.push({ itemId: item.id, installmentNo: item.installmentNo, interest: m(interest) });
  }
  return waivers;
}

/** One-off late penalty: a percentage of the overdue instalment balance. */
export function latePenalty(overdueAmount: MoneyLike, penaltyPct: MoneyLike): string {
  return m(dec(overdueAmount).times(dec(penaltyPct)).div(100));
}

export interface AffordabilityInput {
  monthlyIncome: MoneyLike;
  monthlyExpenses: MoneyLike;
  existingDebtRepayments: MoneyLike;
  installment: MoneyLike;
  frequency: Frequency;
  maxDtiPct: MoneyLike;
}

export interface Affordability {
  monthlyInstallment: string;
  debtToIncomePct: string;
  disposableIncome: string;
  disposableAfterInstallment: string;
  withinDtiPolicy: boolean;
  positiveDisposable: boolean;
}

export function assessAffordability(input: AffordabilityInput): Affordability {
  const income = dec(input.monthlyIncome);
  const monthlyInstallment = round2(dec(input.installment).times(PERIODS_PER_YEAR[input.frequency]).div(12));
  const debt = dec(input.existingDebtRepayments).plus(monthlyInstallment);
  const dti = income.gt(0) ? debt.div(income).times(100) : new D(999);
  const disposable = income.minus(dec(input.monthlyExpenses)).minus(dec(input.existingDebtRepayments));
  const after = disposable.minus(monthlyInstallment);
  return {
    monthlyInstallment: m(monthlyInstallment),
    debtToIncomePct: dti.toFixed(2),
    disposableIncome: m(disposable),
    disposableAfterInstallment: m(after),
    withinDtiPolicy: dti.lte(dec(input.maxDtiPct)),
    positiveDisposable: after.gt(0),
  };
}
