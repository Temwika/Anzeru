"use client";

import type { LoanView } from "@anzelu/contracts";
import { CalendarCheck, CalendarX2, Download, Hourglass, MessageSquareText, Phone, Siren } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, ButtonLink, Card, EmptyState, ErrorState, PageHeader, SearchInput, Skeleton, StatCard, Table, Td, Th } from "@/components/ui";
import { useApi, useSession } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kwacha, shortDate } from "@/lib/format";

interface Row {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  phone: string;
  branchName: string;
  officerName: string;
  productName: string;
  principal: string;
  disbursedOn: string | null;
  maturityDate: string | null;
  totalOutstanding: string;
  overdueAmount: string;
  daysPastDue: number;
  nextDueDate: string | null;
  nextDueAmount: string;
}

interface ViewData {
  asOf: string;
  items: Row[];
  totals: { count: number; outstanding: string; overdue: string; dueToday: string };
}

const VIEWS: Record<LoanView, { title: string; description: string; icon: React.ElementType; empty: string; sms?: string }> = {
  due_today: {
    title: "Due Today",
    description: "Loans with an instalment falling due today. Call or remind before close of business.",
    icon: CalendarCheck,
    empty: "Nothing falls due today.",
    sms: "due_today",
  },
  arrears: {
    title: "Arrears",
    description: "Loans with at least one missed instalment, most overdue first.",
    icon: Siren,
    empty: "No loans are in arrears. Well done.",
    sms: "arrears",
  },
  past_maturity: {
    title: "Past Maturity",
    description: "Loans whose final instalment date has passed but still carry a balance.",
    icon: CalendarX2,
    empty: "No loans have run past their maturity date.",
  },
  maturing_soon: {
    title: "Maturing Soon",
    description: "Loans whose final instalment falls in the next 14 days: good candidates for a repeat loan.",
    icon: Hourglass,
    empty: "No loans mature in the next 14 days.",
  },
};

/** Days between two calendar dates (YYYY-MM-DD). */
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function LoanListView({ view }: { view: LoanView }) {
  const v = VIEWS[view];
  const { data: user } = useSession();
  const { data, error, isLoading } = useApi<ViewData>(`/reports/loans?view=${view}`);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.items ?? []).filter((r) => !t || `${r.loanNumber} ${r.customerName} ${r.phone} ${r.officerName}`.toLowerCase().includes(t));
  }, [data, q]);
  const canSms = user?.permissions.includes("settings:manage") && v.sms;

  return (
    <>
      <PageHeader
        title={v.title}
        description={v.description}
        actions={
          <>
            {canSms && (
              <ButtonLink href={`/sms?audience=${v.sms}`} variant="secondary">
                <MessageSquareText className="size-4" /> SMS these borrowers
              </ButtonLink>
            )}
            {user?.permissions.includes("reports:read") && (
              <ButtonLink href="/reports/exports" variant="secondary">
                <Download className="size-4" /> Export
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Loans" value={data?.totals.count} icon={v.icon} loading={isLoading} />
        {view === "due_today" ? (
          <StatCard label="To collect today" value={data && kwacha(data.totals.dueToday)} icon={CalendarCheck} tone="copper" loading={isLoading} />
        ) : (
          <StatCard label="Overdue amount" value={data && kwacha(data.totals.overdue)} icon={Siren} tone="rose" loading={isLoading} />
        )}
        <StatCard label="Balance outstanding" value={data && kwacha(data.totals.outstanding)} tone="sky" loading={isLoading} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-80">
            <SearchInput value={q} onChange={setQ} placeholder="Search name, loan, phone or officer" />
          </div>
          {data && <p className="text-xs text-slate-500">As at {shortDate(data.asOf)}</p>}
        </div>
        {error && <ErrorState error={error} />}
        {isLoading && <Skeleton className="m-5 h-48" />}
        {data && !rows.length && <EmptyState icon={v.icon} title={q ? "No matches" : v.empty} />}
        {!!rows.length && (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Loan</Th>
                <Th>Borrower</Th>
                <Th>Officer</Th>
                {view === "due_today" && <Th className="text-right">Due today</Th>}
                {view === "maturing_soon" || view === "past_maturity" ? <Th>Maturity</Th> : null}
                <Th className="text-right">Overdue</Th>
                <Th className="text-right">Balance</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-slate-50/70">
                  <Td>
                    <Link href={`/loans/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {r.loanNumber}
                    </Link>
                    <span className="block text-xs text-slate-500">{r.productName}</span>
                  </Td>
                  <Td>
                    <Link href={`/customers/${r.customerId}`} className="font-medium text-slate-800 hover:text-brand-700">
                      {r.customerName}
                    </Link>
                    <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700">
                      <Phone className="size-3" /> {r.phone}
                    </a>
                  </Td>
                  <Td>
                    {r.officerName}
                    <span className="block text-xs text-slate-500">{r.branchName}</span>
                  </Td>
                  {view === "due_today" && <Td className="text-right font-semibold text-slate-900">{kwacha(r.nextDueAmount)}</Td>}
                  {view === "maturing_soon" || view === "past_maturity" ? (
                    <Td>
                      {shortDate(r.maturityDate)}
                      {data && r.maturityDate && (
                        <span className={cn("block text-xs", view === "past_maturity" ? "text-rose-600" : "text-slate-500")}>
                          {view === "past_maturity"
                            ? `${daysBetween(r.maturityDate, data.asOf)} days ago`
                            : daysBetween(data.asOf, r.maturityDate) === 0
                              ? "today"
                              : `in ${daysBetween(data.asOf, r.maturityDate)} days`}
                        </span>
                      )}
                    </Td>
                  ) : null}
                  <Td className={cn("text-right", Number(r.overdueAmount) > 0 ? "font-medium text-rose-700" : "text-slate-400")}>
                    {Number(r.overdueAmount) > 0 ? kwacha(r.overdueAmount) : "—"}
                  </Td>
                  <Td className="text-right font-medium text-slate-900">{kwacha(r.totalOutstanding)}</Td>
                  <Td>
                    {r.daysPastDue > 0 ? (
                      <Badge tone={r.daysPastDue > 30 ? "red" : "amber"} dot>
                        {r.daysPastDue} days late
                      </Badge>
                    ) : (
                      <Badge tone="green" dot>
                        On time
                      </Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
