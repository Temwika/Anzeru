import { Affordability, dec } from '@anzelu/finance';

export interface ScoreFactor {
  factor: string;
  points: number;
}

export interface Check {
  name: string;
  passed: boolean;
  /** Hard checks block approval; soft checks inform the decision. */
  hard: boolean;
  detail: string;
}

export interface Assessment {
  installmentAmount: string;
  totalRepayable: string;
  totalInterest: string;
  processingFee: string;
  aprPct: string;
  affordability: Affordability;
  checks: Check[];
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  factors: ScoreFactor[];
  recommendation: 'approve' | 'refer' | 'decline';
}

export interface ScoreInput {
  affordability: Affordability;
  maxDtiPct: string;
  kycVerified: boolean;
  hasEmployer: boolean;
  priorClosedLoans: number;
  worstCurrentDpd: number;
  activeLoans: number;
  guarantorRequired: boolean;
  guarantorCount: number;
}

/**
 * Transparent rules-based scorecard. Every point awarded or deducted is listed
 * so credit staff can explain decisions to customers and auditors. Weightings
 * are policy and should be calibrated against the lender's own repayment data.
 */
export function score(input: ScoreInput): Pick<Assessment, 'checks' | 'score' | 'grade' | 'factors' | 'recommendation'> {
  const a = input.affordability;
  const dti = Number(a.debtToIncomePct);
  const factors: ScoreFactor[] = [{ factor: 'Base score', points: 50 }];
  const add = (factor: string, points: number) => points !== 0 && factors.push({ factor, points });

  add(`Debt-to-income ${dti.toFixed(1)}%`, dti < 25 ? 15 : dti < 35 ? 8 : dti <= 45 ? 0 : -20);
  const income = dec(a.disposableIncome).plus(dec(a.monthlyInstallment));
  const buffer = income.gt(0) ? dec(a.disposableAfterInstallment).div(income).toNumber() : -1;
  add('Disposable income buffer after instalment', buffer > 0.3 ? 10 : buffer > 0.1 ? 4 : buffer > 0 ? 0 : -15);
  add('Formal employment recorded', input.hasEmployer ? 5 : 0);
  add(`Repaid ${input.priorClosedLoans} previous loan(s)`, Math.min(input.priorClosedLoans * 6, 18));
  add('KYC verified', input.kycVerified ? 5 : -5);
  add(
    'Current arrears on other loans',
    input.worstCurrentDpd > 30 ? -30 : input.worstCurrentDpd > 0 ? -10 : 0,
  );
  add('Multiple active loans', input.activeLoans >= 2 ? -10 : 0);

  const total = Math.max(0, Math.min(100, factors.reduce((s, f) => s + f.points, 0)));
  const grade = total >= 75 ? 'A' : total >= 60 ? 'B' : total >= 45 ? 'C' : 'D';

  const checks: Check[] = [
    {
      name: 'Debt-to-income within policy',
      passed: a.withinDtiPolicy,
      hard: true,
      detail: `${a.debtToIncomePct}% against a ${Number(input.maxDtiPct)}% limit`,
    },
    {
      name: 'Income covers expenses and instalment',
      passed: a.positiveDisposable,
      hard: true,
      detail: `K${a.disposableAfterInstallment} left each month after the instalment`,
    },
    { name: 'KYC verified', passed: input.kycVerified, hard: true, detail: input.kycVerified ? 'Identity verified' : 'Identity not yet verified' },
    {
      name: 'No serious arrears on existing loans',
      passed: input.worstCurrentDpd <= 30,
      hard: true,
      detail: input.worstCurrentDpd ? `Worst current arrears ${input.worstCurrentDpd} days` : 'No arrears',
    },
    {
      name: 'Guarantor provided where required',
      passed: !input.guarantorRequired || input.guarantorCount > 0,
      hard: true,
      detail: input.guarantorRequired ? `${input.guarantorCount} guarantor(s) recorded` : 'Not required for this product',
    },
    { name: 'Risk grade C or better', passed: grade !== 'D', hard: false, detail: `Score ${total}/100, grade ${grade}` },
  ];

  const hardFails = checks.filter((c) => c.hard && !c.passed);
  const recommendation = hardFails.some((c) => c.name !== 'KYC verified') ? 'decline' : hardFails.length || grade === 'D' ? 'refer' : 'approve';
  return { checks, score: total, grade, factors, recommendation };
}
