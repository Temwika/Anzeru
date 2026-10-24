"use client";

import { LABELS } from "@anzelu/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Info } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { JourneyCard, NextStep } from "@/components/journey";
import { useToast } from "@/components/toast";
import { Badge, Button, ButtonLink, Card, CardHeader, Detail, ErrorState, Field, inputClass, Modal, Notice, PageHeader, Skeleton, StatusBadge } from "@/components/ui";
import { api, useApi, useSession } from "@/lib/api";
import { dateTime, kwacha, pct } from "@/lib/format";

interface Application {
  id: string;
  applicationNumber: string;
  channel: "branch" | "self_service";
  amount: string;
  term: number;
  purpose: string;
  status: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  existingDebtRepayments: string;
  submittedAt: string;
  submittedBy: string;
  officerName: string;
  canDecide: boolean;
  customer: { id: string; firstName: string; lastName: string; customerNumber: string; kycStatus: string; employer: string | null };
  product: { name: string; interestMethod: keyof typeof LABELS.interestMethod; annualRatePct: string; repaymentFrequency: keyof typeof LABELS.frequency; maxDtiPct: string };
  guarantors: { id: string; fullName: string; nrc: string; phone: string; relationship: string }[];
  decisions: { id: string; decision: string; reason: string; decidedAt: string; decidedBy: string }[];
  loan: { id: string; loanNumber: string; status: string } | null;
  assessment: {
    installmentAmount: string;
    totalRepayable: string;
    totalInterest: string;
    processingFee: string;
    aprPct: string;
    affordability: { monthlyInstallment: string; debtToIncomePct: string; disposableIncome: string; disposableAfterInstallment: string };
    checks: { name: string; passed: boolean; hard: boolean; detail: string }[];
    score: number;
    grade: string;
    factors: { factor: string; points: number }[];
    recommendation: "approve" | "refer" | "decline";
  };
}

export default function ApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: a, error, isLoading } = useApi<Application>(`/applications/${id}`);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) return <ErrorState error={error} />;
  if (isLoading || !a) return <Skeleton className="h-96" />;
  const s = a.assessment;

  async function decide() {
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/applications/${id}/decisions`, { decision, reason });
      setDecision(null);
      await qc.invalidateQueries();
      toast(
        decision === "approve"
          ? { tone: "success", title: "Loan approved", body: "A loan account was created and is ready for a payout request." }
          : { tone: "info", title: "Application declined", body: "Your reason has been recorded." },
      );
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const blocked =
    user?.permissions.includes("applications:decide") && a.status === "submitted" && !a.canDecide
      ? a.submittedBy === user.id
        ? "You submitted this application, so another approver must decide it."
        : `This amount exceeds your approval limit of ${kwacha(user.approvalLimit)}.`
      : null;

  return (
    <>
      <PageHeader
        back={{ href: "/applications", label: "Applications" }}
        eyebrow="Loan application"
        title={`${a.customer.firstName} ${a.customer.lastName} · ${kwacha(a.amount)}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {a.applicationNumber} · {a.product.name} · {a.channel === "self_service" ? "applied online by the borrower" : `submitted by ${a.officerName}`} on {dateTime(a.submittedAt)}{" "}
            <StatusBadge status={a.status} />
            {a.channel === "self_service" && <Badge tone="violet">Online</Badge>}
          </span>
        }
      />

      <JourneyCard state={{ applicationStatus: a.status, loanStatus: a.loan?.status }}>
        {a.status === "submitted" && a.canDecide && (
          <NextStep
            tone="you"
            title="Make the credit decision"
            body={`Scorecard recommends ${s.recommendation} (grade ${s.grade}, ${s.score}/100). ${s.checks.filter((c) => !c.passed && c.hard).length ? "Some hard policy checks fail; approval will be blocked." : "All hard policy checks pass."}`}
            action={
              <>
                <Button variant="secondary" onClick={() => setDecision("reject")}>
                  Decline
                </Button>
                <Button onClick={() => setDecision("approve")}>Approve loan</Button>
              </>
            }
          />
        )}
        {a.status === "submitted" && !a.canDecide && <NextStep title={blocked ?? "Waiting for a credit approver"} body={blocked ? undefined : "A credit manager reviews the scorecard and decides. You will see the outcome here."} />}
        {a.loan && (
          <NextStep
            tone="done"
            title={`Approved and booked as ${a.loan.loanNumber}`}
            body={a.loan.status === "pending_disbursement" ? "Next, a credit officer requests the payout and a separate authoriser releases the money." : "This loan has been paid out and is now being serviced."}
            action={<ButtonLink href={`/loans/${a.loan.id}`} variant="secondary">Open loan</ButtonLink>}
          />
        )}
        {a.status === "rejected" && <NextStep tone="done" title="Application declined" body={a.decisions[0]?.reason} />}
      </JourneyCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Request" />
          <dl className="grid gap-5 p-5 sm:grid-cols-3">
            <Detail label="Amount">{kwacha(a.amount)}</Detail>
            <Detail label="Term">
              {a.term} {LABELS.frequency[a.product.repaymentFrequency].toLowerCase()} instalments
            </Detail>
            <Detail label="Product">{a.product.name}</Detail>
            <Detail label="Pricing">
              {Number(a.product.annualRatePct)}% p.a. {LABELS.interestMethod[a.product.interestMethod].toLowerCase()}
            </Detail>
            <Detail label="Instalment">{kwacha(s.installmentAmount)}</Detail>
            <Detail label="Total repayable">{kwacha(s.totalRepayable)}</Detail>
            <Detail label="Processing fee">{kwacha(s.processingFee)}</Detail>
            <Detail label="APR incl. fees">{pct(s.aprPct)}</Detail>
            <Detail label="Purpose">{a.purpose}</Detail>
          </dl>
          <div className="border-t border-slate-100 px-5 py-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Affordability (monthly)</h4>
            <dl className="mt-3 grid gap-5 sm:grid-cols-4">
              <Detail label="Income">{kwacha(a.monthlyIncome)}</Detail>
              <Detail label="Expenses">{kwacha(a.monthlyExpenses)}</Detail>
              <Detail label="Existing debt">{kwacha(a.existingDebtRepayments)}</Detail>
              <Detail label="New instalment">{kwacha(s.affordability.monthlyInstallment)}</Detail>
              <Detail label="Debt-to-income">
                {pct(s.affordability.debtToIncomePct)} <span className="text-xs font-normal text-slate-500">(limit {Number(a.product.maxDtiPct)}%)</span>
              </Detail>
              <Detail label="Left after instalment">{kwacha(s.affordability.disposableAfterInstallment)}</Detail>
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Risk score" description="Rules-based scorecard; every point is explained" />
          <div className="flex items-center gap-4 p-5">
            <div className="grid size-20 place-items-center rounded-2xl bg-slate-900 text-white">
              <span className="text-3xl font-semibold">{s.grade}</span>
            </div>
            <div>
              <p className="tabular text-2xl font-semibold text-slate-900">{s.score}/100</p>
              <Badge tone={s.recommendation === "approve" ? "green" : s.recommendation === "refer" ? "amber" : "red"}>Recommend: {s.recommendation}</Badge>
            </div>
          </div>
          <ul className="tabular space-y-1 border-t border-slate-100 p-5 text-sm">
            {s.factors.map((f) => (
              <li key={f.factor} className="flex justify-between gap-3">
                <span className="text-slate-600">{f.factor}</span>
                <span className={`font-medium ${f.points > 0 ? "text-emerald-700" : f.points < 0 ? "text-rose-700" : "text-slate-500"}`}>
                  {f.points > 0 ? `+${f.points}` : f.points}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Policy checks" description="Hard checks must pass before approval" />
          <ul className="divide-y divide-slate-100">
            {s.checks.map((c) => (
              <li key={c.name} className="flex items-start gap-3 px-5 py-3">
                {c.passed ? <CircleCheck className="mt-0.5 size-4 text-emerald-600" /> : c.hard ? <CircleX className="mt-0.5 size-4 text-rose-600" /> : <Info className="mt-0.5 size-4 text-amber-600" />}
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {c.name} {c.hard && <span className="text-xs font-normal text-slate-400">· hard check</span>}
                  </p>
                  <p className="text-xs text-slate-500">{c.detail}</p>
                </div>
                <span className={`text-xs font-medium ${c.passed ? "text-emerald-700" : "text-rose-700"}`}>{c.passed ? "Pass" : "Fail"}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Guarantors" />
            <ul className="divide-y divide-slate-100 text-sm">
              {a.guarantors.map((g) => (
                <li key={g.id} className="px-5 py-3">
                  <p className="font-medium text-slate-800">{g.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {g.relationship} · {g.nrc} · {g.phone}
                  </p>
                </li>
              ))}
              {a.guarantors.length === 0 && <li className="px-5 py-3 text-slate-500">None recorded</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Decision history" />
            <ul className="divide-y divide-slate-100 text-sm">
              {a.decisions.map((d) => (
                <li key={d.id} className="px-5 py-3">
                  <p className="font-medium text-slate-800">
                    {d.decision === "approve" ? "Approved" : "Rejected"} by {d.decidedBy}
                  </p>
                  <p className="text-xs text-slate-500">{dateTime(d.decidedAt)}</p>
                  <p className="mt-1 text-slate-600">“{d.reason}”</p>
                </li>
              ))}
              {a.decisions.length === 0 && <li className="px-5 py-3 text-slate-500">No decision yet</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision === "approve" ? `Approve ${kwacha(a.amount)}` : "Reject application"}
        description={decision === "approve" ? "A loan account is created and sent for disbursement authorisation." : "The reason is recorded and can be shared with the customer."}
      >
        <Field label="Reason for the record">
          <textarea className={inputClass} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {actionError && (
          <div className="mt-3">
            <Notice tone="error">{actionError}</Notice>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDecision(null)}>
            Cancel
          </Button>
          <Button variant={decision === "reject" ? "danger" : "primary"} loading={busy} disabled={reason.trim().length < 3} onClick={decide}>
            {decision === "approve" ? "Approve" : "Reject"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
