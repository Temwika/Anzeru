import { Injectable } from '@nestjs/common';
import type { Channel } from '@anzelu/contracts';
import { dec, m, sum } from '@anzelu/finance';
import { and, eq, inArray } from 'drizzle-orm';
import { Executor } from '../db/database';
import { chartOfAccounts, journalEntries, journalLines } from '../db/schema';
import { NumberingService } from './numbering.service';

export const ACCOUNTS = {
  cash: '1000',
  bank: '1010',
  mtnMomo: '1020',
  airtelMoney: '1021',
  loansReceivable: '1200',
  customerCredits: '2100',
  capital: '3000',
  interestIncome: '4000',
  feeIncome: '4100',
  penaltyIncome: '4200',
  loanLossExpense: '5000',
} as const;

type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export const DEFAULT_CHART: { code: string; name: string; type: AccountType }[] = [
  { code: ACCOUNTS.cash, name: 'Cash on hand', type: 'asset' },
  { code: ACCOUNTS.bank, name: 'Bank operating account', type: 'asset' },
  { code: ACCOUNTS.mtnMomo, name: 'MTN Mobile Money wallet', type: 'asset' },
  { code: ACCOUNTS.airtelMoney, name: 'Airtel Money wallet', type: 'asset' },
  { code: ACCOUNTS.loansReceivable, name: 'Loans receivable (principal)', type: 'asset' },
  { code: ACCOUNTS.customerCredits, name: 'Customer credit balances', type: 'liability' },
  { code: ACCOUNTS.capital, name: 'Share capital and lending funds', type: 'equity' },
  { code: ACCOUNTS.interestIncome, name: 'Interest income', type: 'income' },
  { code: ACCOUNTS.feeIncome, name: 'Fee income', type: 'income' },
  { code: ACCOUNTS.penaltyIncome, name: 'Penalty income', type: 'income' },
  { code: ACCOUNTS.loanLossExpense, name: 'Loan loss expense', type: 'expense' },
];

export function channelAccount(channel: Channel): string {
  const map: Record<Channel, string> = {
    cash: ACCOUNTS.cash,
    bank: ACCOUNTS.bank,
    mtn_momo: ACCOUNTS.mtnMomo,
    airtel_money: ACCOUNTS.airtelMoney,
  };
  return map[channel];
}

export interface PostingLine {
  account: string;
  debit?: string;
  credit?: string;
}

export interface Posting {
  tenantId: string;
  date: string;
  description: string;
  sourceType: string;
  sourceId?: string;
  reversalOfId?: string;
  postedBy: string | null;
  lines: PostingLine[];
}

/**
 * Posts balanced double-entry journals. Balance is checked here and again by a
 * deferred database constraint; posted rows can never be updated or deleted.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly numbering: NumberingService) {}

  async seedChart(ex: Executor, tenantId: string) {
    await ex
      .insert(chartOfAccounts)
      .values(DEFAULT_CHART.map((a) => ({ ...a, tenantId })))
      .onConflictDoNothing();
  }

  async post(ex: Executor, p: Posting): Promise<string> {
    const lines = p.lines
      .map((l) => ({ account: l.account, debit: m(l.debit ?? 0), credit: m(l.credit ?? 0) }))
      .filter((l) => dec(l.debit).gt(0) || dec(l.credit).gt(0));
    const debits = sum(lines.map((l) => l.debit));
    const credits = sum(lines.map((l) => l.credit));
    if (!lines.length || !debits.eq(credits)) {
      throw new Error(`Unbalanced journal "${p.description}": debits ${m(debits)} vs credits ${m(credits)}`);
    }

    const codes = [...new Set(lines.map((l) => l.account))];
    const accounts = await ex
      .select({ id: chartOfAccounts.id, code: chartOfAccounts.code })
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.tenantId, p.tenantId), inArray(chartOfAccounts.code, codes)));
    const idByCode = new Map(accounts.map((a) => [a.code, a.id]));
    for (const code of codes) {
      if (!idByCode.has(code)) throw new Error(`Account ${code} is missing from the chart of accounts`);
    }

    const [entry] = await ex
      .insert(journalEntries)
      .values({
        tenantId: p.tenantId,
        entryNumber: await this.numbering.next(ex, p.tenantId, 'journal'),
        entryDate: p.date,
        description: p.description,
        sourceType: p.sourceType,
        sourceId: p.sourceId,
        reversalOfId: p.reversalOfId,
        postedBy: p.postedBy,
      })
      .returning({ id: journalEntries.id });

    await ex.insert(journalLines).values(
      lines.map((l) => ({
        tenantId: p.tenantId,
        entryId: entry.id,
        accountId: idByCode.get(l.account)!,
        debit: l.debit,
        credit: l.credit,
      })),
    );
    return entry.id;
  }

  /** Posts the mirror image of an existing entry (debits become credits). */
  async reverse(ex: Executor, tenantId: string, entryId: string, date: string, description: string, postedBy: string | null) {
    const lines = await ex
      .select({ code: chartOfAccounts.code, debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .innerJoin(chartOfAccounts, eq(journalLines.accountId, chartOfAccounts.id))
      .where(and(eq(journalLines.entryId, entryId), eq(journalLines.tenantId, tenantId)));
    return this.post(ex, {
      tenantId,
      date,
      description,
      sourceType: 'reversal',
      sourceId: entryId,
      reversalOfId: entryId,
      postedBy,
      lines: lines.map((l) => ({ account: l.code, debit: l.credit, credit: l.debit })),
    });
  }
}
