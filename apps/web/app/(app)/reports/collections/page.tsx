"use client";

import { LABELS, type Channel } from "@anzelu/contracts";
import { Banknote, CalendarRange, Percent, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { monthToDate, PeriodPicker } from "@/components/period-picker";
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, Table, Td, Th } from "@/components/ui";
import { qs, useApi } from "@/lib/api";
import { kwacha, shortDate } from "@/lib/format";

interface Slice {
  amount: string;
  count: number;
}

interface Collections {
  from: string;
  to: string;
  collected: string;
  payments: number;
  expected: string;
  collectionRatePct: string | null;
  byDay: (Slice & { date: string })[];
  byChannel: (Slice & { channel: Channel })[];
  byBranch: (Slice & { name: string })[];
  byOfficer: (Slice & { name: string })[];
  recent: {
    id: string;
    receiptNumber: string;
    receivedOn: string;
    amount: string;
    channel: Channel;
    loanId: string;
    loanNumber: string;
    customerName: string;
  }[];
}

export default function CollectionReportPage() {
  const [period, setPeriod] = useState(monthToDate);
  const { data: c, error } = useApi<Collections>(`/reports/collections${qs(period)}`);

  return (
    <>
      <PageHeader title="Collection Report" description="Money received against money that fell due, by day, channel, branch and loan officer." />
      <PeriodPicker value={period} onChange={setPeriod} />
      {error && <ErrorState error={error} />}
      {!c && !error && <Skeleton className="h-96" />}
      {c && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Collected" value={kwacha(c.collected)} sub={`${c.payments} payments`} icon={Banknote} />
            <StatCard label="Fell due" value={kwacha(c.expected)} sub="Instalments due in the period" icon={CalendarRange} tone="sky" />
            <StatCard
              label="Collection rate"
              value={c.collectionRatePct ? `${c.collectionRatePct}%` : "—"}
              sub="Collected ÷ fell due"
              icon={Percent}
              tone="copper"
            />
            <StatCard
              label="Average payment"
              value={c.payments ? kwacha(Number(c.collected) / c.payments) : "—"}
              sub={`${shortDate(c.from)} – ${shortDate(c.to)}`}
              icon={ReceiptText}
              tone="violet"
            />
          </div>

          <Card className="mb-6">
            <CardHeader title="Collected per day" />
            <div className="p-5">{c.byDay.length ? <DailyBars days={c.byDay} /> : <EmptyState icon={Banknote} title="No payments in this period" />}</div>
          </Card>

          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            <Breakdown title="By channel" rows={c.byChannel.map((r) => ({ name: LABELS.channel[r.channel] ?? r.channel, ...r }))} />
            <Breakdown title="By branch" rows={c.byBranch} />
            <Breakdown title="By loan officer" rows={c.byOfficer} />
          </div>

          <Card>
            <CardHeader title="Payments received" description={c.recent.length === 100 ? "The latest 100. Use Exports for the full list." : undefined} />
            {!c.recent.length ? (
              <EmptyState icon={ReceiptText} title="No payments in this period" />
            ) : (
              <Table>
                <thead>
                  <tr className="border-b border-slate-100">
                    <Th>Receipt</Th>
                    <Th>Date</Th>
                    <Th>Borrower</Th>
                    <Th>Channel</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-slate-100">
                  {c.recent.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <Td>
                        <Link href={`/receipts/${p.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                          {p.receiptNumber}
                        </Link>
                      </Td>
                      <Td>{shortDate(p.receivedOn)}</Td>
                      <Td>
                        {p.customerName}
                        <Link href={`/loans/${p.loanId}`} className="block text-xs text-slate-500 hover:text-brand-700">
                          {p.loanNumber}
                        </Link>
                      </Td>
                      <Td>{LABELS.channel[p.channel] ?? p.channel}</Td>
                      <Td className="text-right font-medium text-slate-900">{kwacha(p.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function Breakdown({ title, rows }: { title: string; rows: (Slice & { name: string })[] }) {
  const total = rows.reduce((s, r) => s + Number(r.amount), 0) || 1;
  return (
    <Card>
      <CardHeader title={title} />
      <ul className="space-y-3 p-5">
        {!rows.length && <li className="text-sm text-slate-500">Nothing yet</li>}
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-slate-700">{r.name}</span>
              <span className="tabular font-medium text-slate-900">{kwacha(r.amount)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${(Number(r.amount) / total) * 100}%` }} />
              </div>
              <span className="tabular w-20 text-right text-xs text-slate-500">{r.count} payments</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** One bar per day with money received; hover shows the exact figure. */
function DailyBars({ days }: { days: (Slice & { date: string })[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...days.map((d) => Number(d.amount)));
  const shown = days.find((d) => d.date === hover);
  return (
    <div>
      <p className="tabular mb-3 h-5 text-sm text-slate-600">
        {shown ? (
          <>
            <span className="font-medium text-slate-900">{shortDate(shown.date)}</span> · {kwacha(shown.amount)} from {shown.count} payment
            {shown.count === 1 ? "" : "s"}
          </>
        ) : (
          <span className="text-slate-400">Hover a bar for the day’s total</span>
        )}
      </p>
      <div className="flex h-48 items-end gap-[2px] border-b border-slate-200">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            onMouseEnter={() => setHover(d.date)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(d.date)}
            aria-label={`${shortDate(d.date)}: ${kwacha(d.amount)}`}
            className="group flex h-full min-w-0 flex-1 items-end"
          >
            <span
              className={`w-full rounded-t-[4px] transition-colors ${hover === d.date ? "bg-brand-600" : "bg-brand-400 group-hover:bg-brand-500"}`}
              style={{ height: `${Math.max(2, (Number(d.amount) / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
        <span>{shortDate(days[0].date)}</span>
        <span>{shortDate(days[days.length - 1].date)}</span>
      </div>
    </div>
  );
}
