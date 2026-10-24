import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { Channel, reconciliationSchema } from '@anzelu/contracts';
import { dec, m, sum, todayIn } from '@anzelu/finance';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { AuthUser, CurrentUser, RequirePermissions, tenantOf } from '../common/auth';
import { Paged, paging, ZodPipe } from '../common/http';
import { DB, InjectDb } from '../db/database';
import { chartOfAccounts, journalEntries, journalLines, loans, payments, users } from '../db/schema';

const DEBIT_NORMAL = new Set(['asset', 'expense']);

@Controller('accounting')
@RequirePermissions('accounting:read')
export class AccountingController {
  constructor(@InjectDb() private readonly db: DB) {}

  /** Account balances (in each account's normal direction) and a debit/credit trial balance. */
  @Get('trial-balance')
  async trialBalance(@CurrentUser() user: AuthUser, @Query('asOf') asOfParam?: string) {
    const tenantId = tenantOf(user);
    const asOf = asOfParam && /^\d{4}-\d{2}-\d{2}$/.test(asOfParam) ? asOfParam : todayIn(user.timezone);
    const rows = await this.db
      .select({
        id: chartOfAccounts.id,
        code: chartOfAccounts.code,
        name: chartOfAccounts.name,
        type: chartOfAccounts.type,
        debit: sql<string>`COALESCE(sum(${journalLines.debit}) FILTER (WHERE ${journalEntries.entryDate} <= ${asOf}), 0)::text`,
        credit: sql<string>`COALESCE(sum(${journalLines.credit}) FILTER (WHERE ${journalEntries.entryDate} <= ${asOf}), 0)::text`,
      })
      .from(chartOfAccounts)
      .leftJoin(journalLines, eq(journalLines.accountId, chartOfAccounts.id))
      .leftJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(eq(chartOfAccounts.tenantId, tenantId))
      .groupBy(chartOfAccounts.id)
      .orderBy(asc(chartOfAccounts.code));

    const accounts = rows.map((r) => {
      const net = dec(r.debit).minus(dec(r.credit));
      const balance = DEBIT_NORMAL.has(r.type) ? net : net.neg();
      return {
        ...r,
        balance: m(balance),
        trialDebit: net.gt(0) ? m(net) : '0.00',
        trialCredit: net.lt(0) ? m(net.neg()) : '0.00',
      };
    });
    const totalDebit = sum(accounts.map((a) => a.trialDebit));
    const totalCredit = sum(accounts.map((a) => a.trialCredit));
    const byType = (t: string) => sum(accounts.filter((a) => a.type === t).map((a) => a.balance));
    return {
      asOf,
      accounts,
      totals: { debit: m(totalDebit), credit: m(totalCredit), balanced: totalDebit.eq(totalCredit) },
      summary: {
        assets: m(byType('asset')),
        liabilities: m(byType('liability')),
        equity: m(byType('equity')),
        income: m(byType('income')),
        expenses: m(byType('expense')),
        netIncome: m(byType('income').minus(byType('expense'))),
      },
    };
  }

  @Get('journals')
  async journals(@CurrentUser() user: AuthUser, @Query() q: Record<string, string>) {
    const tenantId = tenantOf(user);
    const { page, pageSize, offset } = paging(q);
    const conds = [eq(journalEntries.tenantId, tenantId)];
    if (q.sourceType) conds.push(eq(journalEntries.sourceType, q.sourceType));
    if (q.from) conds.push(gte(journalEntries.entryDate, q.from));
    if (q.to) conds.push(lte(journalEntries.entryDate, q.to));
    const where = and(...conds);
    const [entries, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: journalEntries.id,
          entryNumber: journalEntries.entryNumber,
          entryDate: journalEntries.entryDate,
          description: journalEntries.description,
          sourceType: journalEntries.sourceType,
          reversalOfId: journalEntries.reversalOfId,
          postedBy: users.fullName,
          createdAt: journalEntries.createdAt,
        })
        .from(journalEntries)
        .leftJoin(users, eq(journalEntries.postedBy, users.id))
        .where(where)
        .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(journalEntries).where(where),
    ]);
    const lines = entries.length
      ? await this.db
          .select({ entryId: journalLines.entryId, code: chartOfAccounts.code, name: chartOfAccounts.name, debit: journalLines.debit, credit: journalLines.credit })
          .from(journalLines)
          .innerJoin(chartOfAccounts, eq(journalLines.accountId, chartOfAccounts.id))
          .where(inArray(journalLines.entryId, entries.map((e) => e.id)))
      : [];
    return new Paged(
      entries.map((e) => ({ ...e, lines: lines.filter((l) => l.entryId === e.id) })),
      count,
      page,
      pageSize,
    );
  }

  /**
   * Matches a provider or bank statement against posted receipts by external
   * reference. Nothing is posted: unmatched items are listed for investigation.
   */
  @Post('reconciliation')
  @HttpCode(200)
  async reconcile(@CurrentUser() user: AuthUser, @Body(new ZodPipe(reconciliationSchema)) body: z.infer<typeof reconciliationSchema>) {
    const tenantId = tenantOf(user);
    const dates = body.lines.map((l) => l.date).filter((d): d is string => !!d).sort();
    const from = dates[0] ?? '0001-01-01';
    const to = dates.at(-1) ?? todayIn(user.timezone);
    const ledger = await this.db
      .select({
        id: payments.id,
        receiptNumber: payments.receiptNumber,
        externalRef: payments.externalRef,
        amount: payments.amount,
        receivedOn: payments.receivedOn,
        loanNumber: loans.loanNumber,
      })
      .from(payments)
      .innerJoin(loans, eq(payments.loanId, loans.id))
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.channel, body.channel as Channel),
          eq(payments.status, 'posted'),
          gte(payments.receivedOn, from),
          lte(payments.receivedOn, to),
        ),
      );
    const byRef = new Map(ledger.filter((p) => p.externalRef).map((p) => [p.externalRef!.toUpperCase(), p]));
    const seen = new Set<string>();
    const matched: unknown[] = [];
    const mismatched: unknown[] = [];
    const missingInLedger: unknown[] = [];
    for (const line of body.lines) {
      const p = byRef.get(line.reference.toUpperCase());
      if (!p) {
        missingInLedger.push(line);
        continue;
      }
      seen.add(p.id);
      (dec(p.amount).eq(dec(line.amount)) ? matched : mismatched).push({ statement: line, receipt: p });
    }
    const missingInStatement = ledger.filter((p) => !seen.has(p.id));
    return {
      channel: body.channel,
      period: { from: dates[0] ?? null, to },
      summary: {
        statementTotal: m(sum(body.lines.map((l) => l.amount))),
        ledgerTotal: m(sum(ledger.map((p) => p.amount))),
        matched: matched.length,
        mismatched: mismatched.length,
        missingInLedger: missingInLedger.length,
        missingInStatement: missingInStatement.length,
      },
      matched,
      mismatched,
      missingInLedger,
      missingInStatement,
    };
  }
}
