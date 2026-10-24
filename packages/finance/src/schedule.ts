import { dueDate, Frequency, PERIODS_PER_YEAR } from './dates';
import { D, Dec, dec, m, MoneyLike, round2, sum, ZERO } from './money';

export type InterestMethod = 'reducing_balance' | 'flat' | 'interest_only';

export interface ScheduleInput {
  principal: MoneyLike;
  /** Nominal annual rate in percent, e.g. "36" for 36% p.a. */
  annualRatePct: MoneyLike;
  term: number;
  method: InterestMethod;
  frequency: Frequency;
  /** Value (disbursement) date, YYYY-MM-DD. First instalment falls one period later. */
  startDate: string;
  processingFeePct?: MoneyLike;
}

export interface Installment {
  number: number;
  dueDate: string;
  openingBalance: string;
  principal: string;
  interest: string;
  total: string;
  closingBalance: string;
}

export interface Schedule {
  installments: Installment[];
  periodicRatePct: string;
  totals: { principal: string; interest: string; repayable: string };
  processingFee: string;
  netDisbursed: string;
  /** Regular instalment amount; the final one may differ by rounding or, for bullet loans, the principal. */
  installmentAmount: string;
  disclosure: { aprPct: string; effectiveAnnualRatePct: string };
}

export function periodicRate(annualRatePct: MoneyLike, frequency: Frequency): Dec {
  return dec(annualRatePct).div(100).div(PERIODS_PER_YEAR[frequency]);
}

/** Standard annuity instalment A = P r (1+r)^n / ((1+r)^n - 1), rounded to cents. */
export function annuityInstallment(principal: MoneyLike, rate: Dec, n: number): Dec {
  const p = dec(principal);
  if (rate.isZero()) return round2(p.div(n));
  const growth = rate.plus(1).pow(n);
  return round2(p.times(rate).times(growth).div(growth.minus(1)));
}

export function generateSchedule(input: ScheduleInput): Schedule {
  const principal = round2(input.principal);
  const n = input.term;
  if (!Number.isInteger(n) || n < 1) throw new Error('Term must be a positive whole number of instalments');
  if (principal.lte(0)) throw new Error('Principal must be greater than zero');
  if (dec(input.annualRatePct).lt(0)) throw new Error('Interest rate cannot be negative');

  const r = periodicRate(input.annualRatePct, input.frequency);
  const rows: { principal: Dec; interest: Dec }[] = [];

  if (input.method === 'reducing_balance') {
    const a = annuityInstallment(principal, r, n);
    let balance = principal;
    for (let k = 1; k <= n; k++) {
      const interest = round2(balance.times(r));
      // The final instalment clears the residual balance so rounding never leaves cents behind.
      let princ = k === n ? balance : D.min(a.minus(interest), balance);
      if (princ.lt(0)) princ = ZERO;
      rows.push({ principal: princ, interest });
      balance = balance.minus(princ);
    }
  } else if (input.method === 'flat') {
    const years = new D(n).div(PERIODS_PER_YEAR[input.frequency]);
    const totalInterest = round2(principal.times(dec(input.annualRatePct).div(100)).times(years));
    const perInterest = round2(totalInterest.div(n));
    const perPrincipal = round2(principal.div(n));
    for (let k = 1; k <= n; k++) {
      const last = k === n;
      rows.push({
        principal: last ? principal.minus(perPrincipal.times(n - 1)) : perPrincipal,
        interest: last ? totalInterest.minus(perInterest.times(n - 1)) : perInterest,
      });
    }
  } else {
    const interest = round2(principal.times(r));
    for (let k = 1; k <= n; k++) {
      rows.push({ principal: k === n ? principal : ZERO, interest });
    }
  }

  let opening = principal;
  const installments: Installment[] = rows.map((row, i) => {
    const closing = opening.minus(row.principal);
    const inst: Installment = {
      number: i + 1,
      dueDate: dueDate(input.startDate, input.frequency, i + 1),
      openingBalance: m(opening),
      principal: m(row.principal),
      interest: m(row.interest),
      total: m(row.principal.plus(row.interest)),
      closingBalance: m(closing),
    };
    opening = closing;
    return inst;
  });

  const totalInterest = sum(installments.map((i) => i.interest));
  const processingFee = round2(principal.times(dec(input.processingFeePct ?? 0)).div(100));
  const netDisbursed = principal.minus(processingFee);

  return {
    installments,
    periodicRatePct: r.times(100).toDecimalPlaces(6).toString(),
    totals: {
      principal: m(principal),
      interest: m(totalInterest),
      repayable: m(principal.plus(totalInterest)),
    },
    processingFee: m(processingFee),
    netDisbursed: m(netDisbursed),
    installmentAmount: installments[0].total,
    disclosure: costOfCredit(netDisbursed, installments.map((i) => i.total), input.frequency),
  };
}

/**
 * Cost-of-credit disclosure: solves the periodic internal rate of return of
 * the borrower's cash flows (net amount received vs. scheduled instalments),
 * which makes flat-rate and fee-heavy products comparable with reducing-balance
 * ones. Used for disclosure only — never for posting.
 */
export function costOfCredit(
  netDisbursed: MoneyLike,
  payments: MoneyLike[],
  frequency: Frequency,
): { aprPct: string; effectiveAnnualRatePct: string } {
  const net = dec(netDisbursed);
  const flows = payments.map(dec);
  const pv = (i: Dec) => flows.reduce<Dec>((acc, cf, k) => acc.plus(cf.div(i.plus(1).pow(k + 1))), ZERO);
  if (net.lte(0) || sum(flows).lte(net)) return { aprPct: '0.00', effectiveAnnualRatePct: '0.00' };

  let lo = new D(0);
  let hi = new D(1);
  while (pv(hi).gt(net) && hi.lt(1000)) hi = hi.times(2);
  for (let iter = 0; iter < 200; iter++) {
    const mid = lo.plus(hi).div(2);
    if (pv(mid).gt(net)) lo = mid;
    else hi = mid;
    if (hi.minus(lo).lt('1e-12')) break;
  }
  const i = lo.plus(hi).div(2);
  const ppy = PERIODS_PER_YEAR[frequency];
  return {
    aprPct: i.times(ppy).times(100).toFixed(2),
    effectiveAnnualRatePct: i.plus(1).pow(ppy).minus(1).times(100).toFixed(2),
  };
}
