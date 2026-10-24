"use client";

import { LABELS, rateText, type Channel, type Frequency, type InterestMethod } from "@anzelu/contracts";
import { ArrowLeft, Check, PiggyBank, Receipt, Smartphone } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PayDialog, ProgressRing, type Position } from "@/components/borrower-ui";
import { Button, Card, CardHeader, ErrorState, Skeleton, StatusBadge } from "@/components/ui";
import { useApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kwacha, shortDate } from "@/lib/format";

interface BorrowerLoan {
  id: string;
  loanNumber: string;
  productName: string;
  principal: string;
  annualRatePct: string;
  interestMethod: InterestMethod;
  frequency: Frequency;
  status: string;
  disbursedOn: string | null;
  maturityDate: string | null;
  position: Position;
  progress: { paid: number; total: number };
  settlement: { total: string; principal: string; interest: string; fees: string; penalties: string; interestWaived: string } | null;
  schedule: { installmentNo: number; dueDate: string; principalDue: string; interestDue: string; penaltyDue: string; paid: string; status: string }[];
  payments: { receiptNumber: string; amount: string; channel: Channel; receivedOn: string; status: string }[];
}

export default function BorrowerLoanPage() {
  const { id } = useParams<{ id: string }>();
  const { data: l, error } = useApi<BorrowerLoan>(`/borrower/loans/${id}`);
  const { data: me } = useApi<{ phone: string }>("/borrower/me");
  const [pay, setPay] = useState<null | "due" | "payoff">(null);
  if (error) return <ErrorState error={error} />;
  if (!l) return <Skeleton className="h-96 rounded-3xl" />;
  const activeLoan = l.status === "active";
  const late = l.position.daysPastDue > 0;

  return (
    <div className="space-y-6">
      <Link href="/borrower" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Home
      </Link>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-slate-900">{l.productName}</h1>
              <StatusBadge status={l.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {l.loanNumber} · {kwacha(l.principal)} at {rateText(l.interestMethod, l.annualRatePct, true)} · {LABELS.frequency[l.frequency].toLowerCase()}{" "}
              repayments
            </p>
          </div>
          {l.progress.total > 0 && <ProgressRing paid={l.progress.paid} total={l.progress.total} size={88} />}
        </div>

        {activeLoan && (
          <>
            <dl className="tabular mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-100 sm:grid-cols-3">
              <Stat label="Balance" value={kwacha(l.position.totalOutstanding)} />
              <Stat
                label={late ? "Overdue now" : "Next payment"}
                value={kwacha(late ? l.position.overdueAmount : l.position.nextDueAmount)}
                sub={late ? `${l.position.daysPastDue} days late` : `due ${shortDate(l.position.nextDueDate)}`}
                tone={late ? "red" : undefined}
              />
              <Stat label="Final payment" value={shortDate(l.maturityDate)} className="col-span-2 sm:col-span-1" />
            </dl>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button size="lg" onClick={() => setPay("due")}>
                <Smartphone className="size-4" /> Pay now
              </Button>
              <Button size="lg" variant="secondary" onClick={() => setPay("payoff")}>
                Pay off early
              </Button>
            </div>
          </>
        )}
        {l.status === "closed" && (
          <p className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            <Check className="size-4" /> Fully repaid. Thank you for borrowing with us.
          </p>
        )}
        {l.status === "pending_disbursement" && (
          <p className="mt-6 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
            Approved. We’re sending the money to you; your schedule starts once it arrives.
          </p>
        )}
      </Card>

      {activeLoan && l.settlement && (
        <Card className="overflow-hidden">
          <div className="flex items-start gap-4 p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-copper-50 text-copper-600">
              <PiggyBank className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display font-semibold text-slate-900">Pay off today for {kwacha(l.settlement.total)}</h2>
              <p className="mt-1 text-sm text-slate-600">
                No early-repayment penalty. You save <strong className="text-slate-900">{kwacha(l.settlement.interestWaived)}</strong> of future interest.
              </p>
            </div>
          </div>
          <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 text-sm sm:grid-cols-4">
            <Line label="Principal" value={l.settlement.principal} />
            <Line label="Interest to date" value={l.settlement.interest} />
            <Line label="Fees" value={l.settlement.fees} />
            <Line label="Penalties" value={l.settlement.penalties} />
          </dl>
        </Card>
      )}

      <Card>
        <CardHeader title="Repayment schedule" description={l.progress.total ? `${l.progress.paid} of ${l.progress.total} instalments paid` : undefined} />
        <ol className="tabular divide-y divide-slate-100 text-sm">
          {l.schedule.map((s) => {
            const total = Number(s.principalDue) + Number(s.interestDue) + Number(s.penaltyDue);
            return (
              <li key={s.installmentNo} className="flex items-center gap-3 px-5 py-3.5">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    s.status === "paid"
                      ? "bg-emerald-100 text-emerald-700"
                      : s.status === "overdue"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-100 text-slate-500",
                  )}
                >
                  {s.status === "paid" ? <Check className="size-4" /> : s.installmentNo}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{shortDate(s.dueDate)}</p>
                  {Number(s.paid) > 0 && s.status !== "paid" && <p className="text-xs text-slate-500">paid {kwacha(s.paid)} so far</p>}
                </div>
                <span className="font-semibold text-slate-900">{kwacha(total)}</span>
                <StatusBadge status={s.status} />
              </li>
            );
          })}
          {l.schedule.length === 0 && <li className="px-5 py-4 text-slate-500">Your schedule appears once the money is sent to you.</li>}
        </ol>
      </Card>

      <Card>
        <CardHeader title="Receipts" icon={Receipt} />
        <ul className="tabular divide-y divide-slate-100 text-sm">
          {l.payments.map((p) => (
            <li key={p.receiptNumber} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div>
                <p className="font-medium text-slate-900">{p.receiptNumber}</p>
                <p className="text-xs text-slate-500">
                  {shortDate(p.receivedOn)} · {LABELS.channel[p.channel]}
                </p>
              </div>
              <span className="ml-auto font-semibold text-slate-900">{kwacha(p.amount)}</span>
              <StatusBadge status={p.status} />
            </li>
          ))}
          {l.payments.length === 0 && <li className="px-5 py-4 text-slate-500">No payments yet.</li>}
        </ul>
        {activeLoan && (
          <p className="border-t border-slate-100 px-5 py-3.5 text-xs text-slate-500">
            You can also pay from your wallet menu: choose “Pay bill” and use reference <strong className="text-slate-700">{l.loanNumber}</strong>.
          </p>
        )}
      </Card>

      {pay && (
        <PayDialog
          open
          onClose={() => setPay(null)}
          initialMode={pay}
          defaultMsisdn={me?.phone}
          loan={{ id: l.id, loanNumber: l.loanNumber, position: l.position, settlement: l.settlement }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone, className }: { label: string; value: string; sub?: string; tone?: "red"; className?: string }) {
  return (
    <div className={cn("bg-white p-4", className)}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={cn("mt-1 font-display text-lg font-bold", tone === "red" ? "text-rose-700" : "text-slate-900")}>{value}</dd>
      {sub && <dd className="text-xs text-slate-500">{sub}</dd>}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{kwacha(value)}</dd>
    </div>
  );
}
