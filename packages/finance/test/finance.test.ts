import { describe, expect, it } from 'vitest';
import {
  addMonths,
  allocatePayment,
  assessAffordability,
  dec,
  generateSchedule,
  loanPosition,
  portfolioAtRisk,
  ServicingItem,
  settlementQuote,
  sum,
} from '../src';

/** Independent float reference for the annuity formula, used only to cross-check. */
function referenceAnnuity(p: number, annualPct: number, n: number, ppy: number) {
  const r = annualPct / 100 / ppy;
  return (p * r * (1 + r) ** n) / ((1 + r) ** n - 1);
}

const base = { startDate: '2026-01-15', frequency: 'monthly' as const };

describe('reducing-balance schedule', () => {
  const s = generateSchedule({ ...base, principal: '10000', annualRatePct: '24', term: 12, method: 'reducing_balance' });

  it('matches the annuity formula to the cent', () => {
    expect(s.installments[0].total).toBe(referenceAnnuity(10000, 24, 12, 12).toFixed(2));
    expect(s.installments[0].total).toBe('945.60');
    expect(s.installments[0].interest).toBe('200.00');
    expect(s.installments[0].principal).toBe('745.60');
  });

  it('repays exactly the principal and ends at zero', () => {
    expect(sum(s.installments.map((i) => i.principal)).toFixed(2)).toBe('10000.00');
    expect(s.installments.at(-1)!.closingBalance).toBe('0.00');
    expect(s.totals.repayable).toBe(sum(s.installments.map((i) => i.total)).toFixed(2));
  });

  it('total interest is within rounding of the closed-form value', () => {
    const expected = referenceAnnuity(10000, 24, 12, 12) * 12 - 10000;
    expect(Math.abs(Number(s.totals.interest) - expected)).toBeLessThan(0.1);
  });

  it('discloses an APR equal to the nominal rate when there are no fees', () => {
    expect(s.disclosure.aprPct).toBe('24.00');
    expect(s.disclosure.effectiveAnnualRatePct).toBe('26.82');
  });

  it('handles zero interest', () => {
    const z = generateSchedule({ ...base, principal: '1000', annualRatePct: '0', term: 3, method: 'reducing_balance' });
    expect(z.installments.map((i) => i.principal)).toEqual(['333.33', '333.33', '333.34']);
    expect(z.totals.interest).toBe('0.00');
  });
});

describe('flat-rate schedule', () => {
  const s = generateSchedule({
    ...base,
    principal: '10000',
    annualRatePct: '24',
    term: 12,
    method: 'flat',
    processingFeePct: '5',
  });

  it('charges interest on the original principal for the whole term', () => {
    expect(s.totals.interest).toBe('2400.00');
    expect(s.installments[0].total).toBe('1033.33');
    expect(s.installmentAmount).toBe('1033.33');
    expect(s.installments.at(-1)!.principal).toBe('833.37');
    expect(sum(s.installments.map((i) => i.principal)).toFixed(2)).toBe('10000.00');
  });

  it('deducts the processing fee and discloses the true cost of credit', () => {
    expect(s.processingFee).toBe('500.00');
    expect(s.netDisbursed).toBe('9500.00');
    // 24% flat with a 5% upfront fee costs roughly 52% p.a. on a reducing basis.
    expect(Number(s.disclosure.aprPct)).toBeGreaterThan(50);
    expect(Number(s.disclosure.aprPct)).toBeLessThan(54);
  });

  it('works for weekly loans', () => {
    const w = generateSchedule({ ...base, frequency: 'weekly', principal: '5200', annualRatePct: '52', term: 10, method: 'flat' });
    expect(w.totals.interest).toBe('520.00');
    expect(w.installments[0].dueDate).toBe('2026-01-22');
  });
});

describe('interest-only (bullet) schedule', () => {
  it('collects principal at maturity', () => {
    const s = generateSchedule({ ...base, principal: '10000', annualRatePct: '24', term: 6, method: 'interest_only' });
    expect(s.installments.slice(0, 5).every((i) => i.total === '200.00')).toBe(true);
    expect(s.installments[5].total).toBe('10200.00');
    expect(s.installmentAmount).toBe('200.00');
  });
});

describe('dates', () => {
  it('clamps month-end due dates', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
  });
});

function items(): ServicingItem[] {
  const zero = { penalty: '0', fee: '0', interest: '0', principal: '0' };
  return [
    { id: 'a', installmentNo: 1, dueDate: '2026-02-15', due: { penalty: '50', fee: '0', interest: '200', principal: '745.60' }, paid: zero },
    { id: 'b', installmentNo: 2, dueDate: '2026-03-15', due: { penalty: '0', fee: '0', interest: '185.09', principal: '760.51' }, paid: zero },
    { id: 'c', installmentNo: 3, dueDate: '2026-04-15', due: { penalty: '0', fee: '0', interest: '169.88', principal: '775.72' }, paid: zero },
  ];
}

describe('payment allocation', () => {
  it('pays penalty, fee, interest, then principal, oldest first', () => {
    const r = allocatePayment('300', items());
    expect(r.allocations).toEqual([
      { itemId: 'a', installmentNo: 1, component: 'penalty', amount: '50.00' },
      { itemId: 'a', installmentNo: 1, component: 'interest', amount: '200.00' },
      { itemId: 'a', installmentNo: 1, component: 'principal', amount: '50.00' },
    ]);
    expect(r.unallocated).toBe('0.00');
  });

  it('allocates exactly the amount received and returns any overpayment', () => {
    const r = allocatePayment('3000', items());
    const allocated = sum(r.allocations.map((a) => a.amount));
    expect(allocated.plus(dec(r.unallocated)).toFixed(2)).toBe('3000.00');
    expect(r.unallocated).toBe('113.20');
  });

  it('is deterministic for the same inputs', () => {
    expect(allocatePayment('1234.56', items())).toEqual(allocatePayment('1234.56', items()));
  });

  it('rejects non-positive amounts', () => {
    expect(() => allocatePayment('0', items())).toThrow();
  });
});

describe('arrears and portfolio quality', () => {
  it('computes days past due from the oldest unpaid instalment', () => {
    const pos = loanPosition(items(), '2026-03-20');
    expect(pos.daysPastDue).toBe(33);
    expect(pos.bucket).toBe('31-60');
    expect(pos.overdueInstallments).toBe(2);
    expect(pos.nextDueDate).toBe('2026-04-15');
    expect(pos.principalOutstanding).toBe('2281.83');
  });

  it('is current on the due date itself', () => {
    expect(loanPosition(items(), '2026-02-15').daysPastDue).toBe(0);
  });

  it('computes PAR30', () => {
    const par = portfolioAtRisk(
      [
        { principalOutstanding: '7000', daysPastDue: 0 },
        { principalOutstanding: '2000', daysPastDue: 45 },
        { principalOutstanding: '1000', daysPastDue: 10 },
      ],
      30,
    );
    expect(par).toBe('20.00');
  });
});

describe('early settlement', () => {
  it('waives interest beyond the current period', () => {
    const q = settlementQuote(items(), '2026-02-20');
    expect(q.principal).toBe('2281.83');
    expect(q.interest).toBe('385.09'); // instalment 1 (due) + instalment 2 (current period)
    expect(q.interestWaived).toBe('169.88');
    expect(q.total).toBe('2716.92');
  });
});

describe('affordability', () => {
  it('converts weekly instalments to a monthly equivalent', () => {
    const a = assessAffordability({
      monthlyIncome: '10000',
      monthlyExpenses: '4000',
      existingDebtRepayments: '1000',
      installment: '300',
      frequency: 'weekly',
      maxDtiPct: '40',
    });
    expect(a.monthlyInstallment).toBe('1300.00');
    expect(a.debtToIncomePct).toBe('23.00');
    expect(a.withinDtiPolicy).toBe(true);
    expect(a.disposableAfterInstallment).toBe('3700.00');
  });
});
