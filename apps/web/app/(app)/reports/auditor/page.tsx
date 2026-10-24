"use client";

import { CircleAlert, CircleCheck, Printer } from "lucide-react";
import { useState } from "react";
import { monthToDate, PeriodPicker } from "@/components/period-picker";
import { Button, Card, CardHeader, ErrorState, PageHeader, Skeleton, Table, Td, Th } from "@/components/ui";
import { qs, useApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kwacha, label, pct, shortDate } from "@/lib/format";

interface Auditor {
  from: string;
  to: string;
  disbursements: { count: number; amount: string };
  repayments: { count: number; amount: string };
  reversals: { count: number; amount: string };
  decisions: Record<string, number>;
  makerChecker: { selfApprovedLoans: number };
  ledger: { debit: string; credit: string; entries: number; balanced: boolean };
  auditChain: { valid: boolean; checked: number; brokenAtSeq?: number };
  activity: { name: string; role: string | null; actions: number }[];
  portfolio: { loans: number; principalOutstanding: string; par30: string };
}

export default function AuditorReportPage() {
  const [period, setPeriod] = useState(monthToDate);
  const { data: a, error } = useApi<Auditor>(`/reports/auditor${qs(period)}`);

  return (
    <>
      <PageHeader
        title="Auditor Report"
        description="Activity in the period and the controls an external auditor checks: ledger balance, the tamper-evident audit trail and maker-checker."
        actions={
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" /> Print
          </Button>
        }
      />
      <div className="print:hidden">
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      {error && <ErrorState error={error} />}
      {!a && !error && <Skeleton className="h-96" />}
      {a && (
        <>
          <p className="mb-4 text-sm text-slate-500">
            Period {shortDate(a.from)} – {shortDate(a.to)}
          </p>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Control
              ok={a.ledger.balanced}
              title="General ledger"
              good="Debits equal credits"
              bad="Debits and credits do not match"
              detail={`${a.ledger.entries} journal entries · Dr ${kwacha(a.ledger.debit)} · Cr ${kwacha(a.ledger.credit)}`}
            />
            <Control
              ok={a.auditChain.valid}
              title="Audit trail"
              good="No record has been altered"
              bad={`Chain broken at record ${a.auditChain.brokenAtSeq}`}
              detail={`${a.auditChain.checked.toLocaleString()} records verified`}
            />
            <Control
              ok={a.makerChecker.selfApprovedLoans === 0}
              title="Maker-checker"
              good="No officer approved their own loan"
              bad={`${a.makerChecker.selfApprovedLoans} loans approved by the officer who booked them`}
              detail="Approval is always by a second person"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Activity in the period" />
              <Table>
                <tbody className="tabular divide-y divide-slate-100">
                  <Row label="Loans disbursed" count={a.disbursements.count} amount={a.disbursements.amount} />
                  <Row label="Repayments received" count={a.repayments.count} amount={a.repayments.amount} />
                  <Row label="Payments reversed" count={a.reversals.count} amount={a.reversals.amount} />
                  <tr>
                    <Td className="text-slate-700">Credit decisions</Td>
                    <Td colSpan={2} className="text-right">
                      {Object.keys(a.decisions).length
                        ? Object.entries(a.decisions)
                            .map(([k, v]) => `${v} ${label(k).toLowerCase()}`)
                            .join(" · ")
                        : "None"}
                    </Td>
                  </tr>
                  <tr className="bg-slate-50/60">
                    <Td className="text-slate-700">Loan book at {shortDate(a.to)}</Td>
                    <Td className="text-right">{a.portfolio.loans} loans</Td>
                    <Td className="text-right font-medium text-slate-900">
                      {kwacha(a.portfolio.principalOutstanding)}{" "}
                      <span className="block text-xs font-normal text-slate-500">PAR 30 {pct(a.portfolio.par30)}</span>
                    </Td>
                  </tr>
                </tbody>
              </Table>
            </Card>
            <Card>
              <CardHeader title="Who did what" description="Recorded actions per person in the period" />
              <Table>
                <thead>
                  <tr className="border-b border-slate-100">
                    <Th>Person</Th>
                    <Th>Role</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-slate-100">
                  {a.activity.map((p) => (
                    <tr key={`${p.name}-${p.role}`}>
                      <Td className="font-medium text-slate-900">{p.name}</Td>
                      <Td>{label(p.role)}</Td>
                      <Td className="text-right">{p.actions}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function Control({ ok, title, good, bad, detail }: { ok: boolean; title: string; good: string; bad: string; detail: string }) {
  const Icon = ok ? CircleCheck : CircleAlert;
  return (
    <Card className={cn("p-5", !ok && "border-rose-200 bg-rose-50/40")}>
      <div className="flex items-center gap-2">
        <Icon className={cn("size-5", ok ? "text-emerald-600" : "text-rose-600")} />
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
      <p className={cn("mt-2 text-sm font-medium", ok ? "text-emerald-700" : "text-rose-700")}>{ok ? good : bad}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </Card>
  );
}

function Row({ label: name, count, amount }: { label: string; count: number; amount: string }) {
  return (
    <tr>
      <Td className="text-slate-700">{name}</Td>
      <Td className="text-right">{count}</Td>
      <Td className="text-right font-medium text-slate-900">{kwacha(amount)}</Td>
    </tr>
  );
}
