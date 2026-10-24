"use client";

import { LABELS, type Channel } from "@anzelu/contracts";
import { ArrowLeft, Smartphone } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardHeader, ErrorState, Skeleton, StatusBadge } from "@/components/ui";
import { useApi } from "@/lib/api";
import { kwacha, shortDate } from "@/lib/format";

interface BorrowerLoan {
  loanNumber: string;
  productName: string;
  principal: string;
  annualRatePct: string;
  interestMethod: keyof typeof LABELS.interestMethod;
  frequency: keyof typeof LABELS.frequency;
  status: string;
  disbursedOn: string | null;
  maturityDate: string | null;
  position: { totalOutstanding: string; nextDueDate: string | null; nextDueAmount: string; daysPastDue: number; overdueAmount: string };
  settlement: { total: string } | null;
  schedule: { installmentNo: number; dueDate: string; principalDue: string; interestDue: string; penaltyDue: string; paid: string; status: string }[];
  payments: { receiptNumber: string; amount: string; channel: Channel; receivedOn: string; status: string }[];
  payInstructions: string;
}

export default function BorrowerLoanPage() {
  const { id } = useParams<{ id: string }>();
  const { data: l, error } = useApi<BorrowerLoan>(`/borrower/loans/${id}`);
  if (error) return <ErrorState error={error} />;
  if (!l) return <Skeleton className="h-96" />;
  return (
    <>
      <Link href="/borrower" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> My loans
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{l.productName}</h1>
        <StatusBadge status={l.status} />
      </div>
      <p className="text-sm text-slate-500">
        {l.loanNumber} · {kwacha(l.principal)} at {Number(l.annualRatePct)}% a year · disbursed {shortDate(l.disbursedOn)}
      </p>

      {l.status === "active" && (
        <div className="tabular mt-6 grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-slate-500">Balance</p>
            <p className="text-xl font-semibold">{kwacha(l.position.totalOutstanding)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">{l.position.daysPastDue ? "Overdue now" : "Next payment"}</p>
            <p className={`text-xl font-semibold ${l.position.daysPastDue ? "text-rose-700" : ""}`}>{kwacha(l.position.daysPastDue ? l.position.overdueAmount : l.position.nextDueAmount)}</p>
            {!l.position.daysPastDue && <p className="text-xs text-slate-500">due {shortDate(l.position.nextDueDate)}</p>}
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">Pay off today</p>
            <p className="text-xl font-semibold">{kwacha(l.settlement?.total)}</p>
            <p className="text-xs text-slate-500">future interest waived</p>
          </Card>
        </div>
      )}

      {l.status === "active" && (
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
          <Smartphone className="mt-0.5 size-4 shrink-0" />
          <p>{l.payInstructions}</p>
        </div>
      )}

      <Card className="mt-6">
        <CardHeader title="Repayment schedule" />
        <ul className="tabular divide-y divide-slate-100 text-sm">
          {l.schedule.map((s) => (
            <li key={s.installmentNo} className="flex items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="font-medium text-slate-900">{shortDate(s.dueDate)}</p>
                <p className="text-xs text-slate-500">Instalment {s.installmentNo}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{kwacha(Number(s.principalDue) + Number(s.interestDue) + Number(s.penaltyDue))}</p>
                {Number(s.paid) > 0 && <p className="text-xs text-slate-500">paid {kwacha(s.paid)}</p>}
              </div>
              <StatusBadge status={s.status} />
            </li>
          ))}
          {l.schedule.length === 0 && <li className="px-5 py-4 text-slate-500">Your schedule appears once the money is sent to you.</li>}
        </ul>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Receipts" />
        <ul className="tabular divide-y divide-slate-100 text-sm">
          {l.payments.map((p) => (
            <li key={p.receiptNumber} className="flex items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="font-medium text-slate-900">{p.receiptNumber}</p>
                <p className="text-xs text-slate-500">
                  {shortDate(p.receivedOn)} · {LABELS.channel[p.channel]}
                </p>
              </div>
              <span className="font-medium">{kwacha(p.amount)}</span>
              <StatusBadge status={p.status} />
            </li>
          ))}
          {l.payments.length === 0 && <li className="px-5 py-4 text-slate-500">No payments yet.</li>}
        </ul>
      </Card>
    </>
  );
}
