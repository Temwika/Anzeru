"use client";

import { LABELS, type Frequency, type InterestMethod } from "@anzelu/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { api, ApiError } from "@/lib/api";
import { kwacha } from "@/lib/format";
import { useToast } from "./toast";
import { Button, Field, inputClass, Modal, Stepper, type Step } from "./ui";

/* ───────────────────────────── Shared types ───────────────────────────── */

export interface Position {
  totalOutstanding: string;
  nextDueDate: string | null;
  nextDueAmount: string;
  daysPastDue: number;
  overdueAmount: string;
}

export interface BorrowerProduct {
  id?: string;
  name: string;
  code: string;
  description: string | null;
  interestMethod: InterestMethod;
  annualRatePct: string;
  repaymentFrequency: Frequency;
  minAmount: string;
  maxAmount: string;
  minTerm: number;
  maxTerm: number;
  processingFeePct: string;
  requiresGuarantor: boolean;
}

export interface BorrowerApplication {
  id: string;
  applicationNumber: string;
  productName: string;
  amount: string;
  term: number;
  frequency: Frequency;
  status: "submitted" | "approved" | "rejected" | "cancelled";
  submittedAt: string;
  decidedAt: string | null;
  installmentAmount: string | null;
  loanId: string | null;
  loanStatus: string | null;
}

const PERIOD: Record<Frequency, [string, string]> = {
  daily: ["day", "days"],
  weekly: ["week", "weeks"],
  fortnightly: ["fortnight", "fortnights"],
  monthly: ["month", "months"],
};

/** "6 months", "1 week". */
export function periods(n: number, f: Frequency) {
  return `${n} ${PERIOD[f][n === 1 ? 0 : 1]}`;
}

/** "a month", used in "K1,200 a month". */
export function perPeriod(f: Frequency) {
  return `a ${PERIOD[f][0]}`;
}

/* ───────────────────────────── Progress ring ───────────────────────────── */

/** Circular progress for "instalments paid", sized for the balance card. */
export function ProgressRing({ paid, total, dark, size = 104 }: { paid: number; total: number; dark?: boolean; size?: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const frac = total ? Math.min(paid / total, 1) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${paid} of ${total} instalments paid`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className={dark ? "stroke-white/10" : "stroke-slate-100"} />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className="stroke-brand-400 transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className={cn("tabular font-display text-2xl font-bold leading-none", dark ? "text-white" : "text-slate-900")}>
          {paid}
          <span className={cn("text-sm font-semibold", dark ? "text-slate-400" : "text-slate-400")}>/{total}</span>
        </span>
        <span className={cn("mt-1 text-[10px] font-medium uppercase tracking-wide", dark ? "text-slate-400" : "text-slate-500")}>paid</span>
      </div>
    </div>
  );
}

/* ───────────────────────────── Application tracker ───────────────────────────── */

/** The borrower's view of an application: plain words, one current step. */
export function applicationSteps(a: Pick<BorrowerApplication, "status" | "loanStatus">): Step[] {
  const s = (label: string, state: Step["state"], description?: string): Step => ({ label, state, description });
  if (a.status === "rejected" || a.status === "cancelled")
    return [
      s("Submitted", "complete"),
      s(a.status === "rejected" ? "Not approved" : "Withdrawn", "failed"),
      s("Approved", "upcoming"),
      s("Money sent", "upcoming"),
    ];
  if (a.loanStatus === "active" || a.loanStatus === "closed")
    return [s("Submitted", "complete"), s("Reviewed", "complete"), s("Approved", "complete"), s("Money sent", "complete")];
  if (a.status === "approved")
    return [s("Submitted", "complete"), s("Reviewed", "complete"), s("Approved", "complete"), s("Money sent", "current", "On its way to you")];
  return [s("Submitted", "complete"), s("In review", "current", "With our credit team"), s("Approved", "upcoming"), s("Money sent", "upcoming")];
}

export function applicationHeadline(a: Pick<BorrowerApplication, "status" | "loanStatus">) {
  if (a.status === "rejected") return { tone: "red" as const, text: "We couldn’t approve this application this time." };
  if (a.status === "cancelled") return { tone: "neutral" as const, text: "This application was withdrawn." };
  if (a.loanStatus === "active" || a.loanStatus === "closed") return { tone: "green" as const, text: "Approved and paid out." };
  if (a.status === "approved") return { tone: "green" as const, text: "Approved! We’re sending the money to you now." };
  return { tone: "blue" as const, text: "Our credit team is reviewing your application. We’ll SMS you the outcome." };
}

export function ApplicationTracker({ application }: { application: Pick<BorrowerApplication, "status" | "loanStatus"> }) {
  return <Stepper steps={applicationSteps(application)} />;
}

/* ───────────────────────────── Pay dialog ───────────────────────────── */

export interface PayableLoan {
  id: string;
  loanNumber: string;
  position: Position;
  settlement: { total: string; interestWaived: string } | null;
}

interface PaymentRequest {
  id: string;
  status: "pending" | "succeeded" | "failed";
  amount: string;
  msisdn: string;
  channel: "mtn_momo" | "airtel_money";
  settlement: boolean;
  failureReason: string | null;
  receiptNumber: string | null;
  loanClosed: boolean;
}

type Mode = "due" | "other" | "payoff";
const WALLETS = [
  { value: "mtn_momo", name: "MTN MoMo", swatch: "bg-[#ffcc00] text-[#1d1d1b]", initials: "MTN" },
  { value: "airtel_money", name: "Airtel Money", swatch: "bg-[#e40000] text-white", initials: "A" },
] as const;

/** Zambian number prefixes: 096/076 are MTN, 097/077 Airtel. */
function walletFor(msisdn: string): "mtn_momo" | "airtel_money" | null {
  const local = msisdn.replace(/\s/g, "").replace(/^\+260/, "0");
  if (/^0[79]6/.test(local)) return "mtn_momo";
  if (/^0[79]7/.test(local)) return "airtel_money";
  return null;
}

/**
 * Pay from a mobile-money wallet: pick what to pay, confirm the wallet, then
 * approve the prompt on the phone. The dialog follows the request until the
 * provider confirms, and shows the receipt.
 */
export function PayDialog({
  open,
  onClose,
  loan,
  defaultMsisdn,
  initialMode = "due",
}: {
  open: boolean;
  onClose: () => void;
  loan: PayableLoan;
  defaultMsisdn?: string;
  initialMode?: Mode;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const p = loan.position;
  const dueAmount = p.daysPastDue ? p.overdueAmount : p.nextDueAmount;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [other, setOther] = useState("");
  const [msisdn, setMsisdn] = useState(defaultMsisdn ?? "");
  const [channel, setChannel] = useState<"mtn_momo" | "airtel_money">(walletFor(defaultMsisdn ?? "") ?? "mtn_momo");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: req } = useQuery({
    queryKey: ["payment-request", requestId],
    queryFn: () => api.get<PaymentRequest>(`/borrower/payment-requests/${requestId}`),
    enabled: !!requestId,
    refetchInterval: (q) => (q.state.data?.status === "pending" || !q.state.data ? 1500 : false),
  });

  useEffect(() => {
    if (req?.status === "succeeded") {
      void qc.invalidateQueries();
      toast({ tone: "success", title: `${kwacha(req.amount)} received`, body: `Receipt ${req.receiptNumber}` });
    }
  }, [req?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = mode === "due" ? dueAmount : mode === "payoff" ? (loan.settlement?.total ?? "0") : other;
  const phase = !requestId ? "form" : !req || req.status === "pending" ? "waiting" : req.status;

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const r = await api.post<PaymentRequest>(`/borrower/loans/${loan.id}/pay`, {
        channel,
        msisdn: msisdn.replace(/\s/g, ""),
        ...(mode === "payoff" ? { settlement: true } : { amount: String(amount).trim() }),
      });
      setRequestId(r.id);
    } catch (e) {
      const details = e instanceof ApiError && Array.isArray(e.details) ? (e.details as { message: string }[])[0]?.message : null;
      setError(details ?? (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const options: { value: Mode; label: string; amount: string | null; hint: string }[] = [
    {
      value: "due",
      label: p.daysPastDue ? "Overdue amount" : "Next instalment",
      amount: dueAmount,
      hint: p.daysPastDue ? `${p.daysPastDue} days late` : "Keeps you on track",
    },
    { value: "other", label: "Another amount", amount: null, hint: "Any amount up to your balance" },
    ...(loan.settlement
      ? [
          {
            value: "payoff" as const,
            label: "Pay off today",
            amount: loan.settlement.total,
            hint: `Saves ${kwacha(loan.settlement.interestWaived)} in interest`,
          },
        ]
      : []),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        phase === "form"
          ? "Make a payment"
          : phase === "waiting"
            ? "Approve on your phone"
            : phase === "succeeded"
              ? "Payment received"
              : "Payment not completed"
      }
      description={phase === "form" ? `Loan ${loan.loanNumber}` : undefined}
    >
      {phase === "form" && (
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-slate-700">What would you like to pay?</legend>
            <div className="space-y-2">
              {options.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition",
                    mode === o.value ? "border-brand-500 bg-brand-50/60 ring-4 ring-brand-500/10" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <input type="radio" name="pay-mode" className="size-4 accent-brand-600" checked={mode === o.value} onChange={() => setMode(o.value)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{o.label}</span>
                    <span className="block text-xs text-slate-500">{o.hint}</span>
                  </span>
                  {o.amount && <span className="tabular text-sm font-semibold text-slate-900">{kwacha(o.amount)}</span>}
                </label>
              ))}
            </div>
            {mode === "other" && (
              <div className="mt-3">
                <Field label="Amount (K)">
                  <input className={inputClass} inputMode="decimal" placeholder="e.g. 500" value={other} onChange={(e) => setOther(e.target.value)} autoFocus />
                </Field>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-slate-700">Pay from</legend>
            <div className="grid grid-cols-2 gap-2">
              {WALLETS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => setChannel(w.value)}
                  aria-pressed={channel === w.value}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-semibold transition",
                    channel === w.value ? "border-brand-500 bg-brand-50/60 ring-4 ring-brand-500/10" : "border-slate-200 hover:border-slate-300",
                  )}
                >
                  <span className={cn("grid size-8 place-items-center rounded-lg text-[10px] font-black", w.swatch)}>{w.initials}</span>
                  {w.name}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <Field label="Wallet number" hint="We’ll send an approval prompt to this phone">
                <input
                  className={inputClass}
                  inputMode="tel"
                  value={msisdn}
                  onChange={(e) => {
                    setMsisdn(e.target.value);
                    const w = walletFor(e.target.value);
                    if (w) setChannel(w);
                  }}
                  placeholder="0971234567"
                />
              </Field>
            </div>
          </fieldset>

          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800" role="alert">
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}

          <Button size="lg" className="w-full" loading={submitting} disabled={!amount || Number(amount) <= 0 || !msisdn} onClick={submit}>
            Pay {Number(amount) > 0 ? kwacha(amount) : ""}
          </Button>
          <p className="text-center text-xs text-slate-500">You approve the payment with your wallet PIN. We never see your PIN.</p>
        </div>
      )}

      {phase === "waiting" && (
        <div className="py-4 text-center">
          <div className="relative mx-auto grid size-24 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/25" />
            <span className="relative grid size-20 place-items-center rounded-full bg-brand-50 text-brand-700">
              <Smartphone className="size-9" />
            </span>
          </div>
          <p className="mt-6 font-display text-lg font-semibold text-slate-900">Check your phone</p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-600">
            Approve <strong className="tabular text-slate-900">{kwacha(req?.amount ?? amount)}</strong> on{" "}
            <strong className="tabular text-slate-900">{req?.msisdn ?? msisdn}</strong> by entering your {channel === "mtn_momo" ? "MoMo" : "Airtel Money"} PIN.
          </p>
          <p className="mt-5 text-xs text-slate-400">Waiting for confirmation…</p>
        </div>
      )}

      {phase === "succeeded" && req && (
        <div className="py-2 text-center">
          <span className="mx-auto grid size-16 animate-pop-in place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CircleCheck className="size-9" />
          </span>
          <p className="tabular mt-4 font-display text-3xl font-bold text-slate-900">{kwacha(req.amount)}</p>
          <p className="mt-1 text-sm text-slate-600">{req.loanClosed ? "Your loan is fully paid. Congratulations!" : "Applied to your loan. Thank you!"}</p>
          <dl className="mt-5 divide-y divide-slate-100 rounded-xl bg-slate-50 text-left text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Receipt</dt>
              <dd className="tabular font-semibold text-slate-900">{req.receiptNumber}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-slate-500">Paid from</dt>
              <dd className="font-medium text-slate-900">
                {LABELS.channel[req.channel]} · {req.msisdn}
              </dd>
            </div>
          </dl>
          <Button size="lg" className="mt-5 w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      )}

      {phase === "failed" && req && (
        <div className="py-2 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-rose-100 text-rose-700">
            <CircleAlert className="size-9" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold text-slate-900">Nothing was taken from your wallet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-slate-600">{req.failureReason}</p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Close
            </Button>
            <Button size="lg" onClick={() => setRequestId(null)}>
              Try again
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ───────────────────────────── Product card ───────────────────────────── */

export function ProductCard({ product, selected, onSelect, dark }: { product: BorrowerProduct; selected?: boolean; onSelect?: () => void; dark?: boolean }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className={cn("font-display text-base font-semibold", dark ? "text-white" : "text-slate-900")}>{product.name}</h3>
        {product.requiresGuarantor && (
          <span
            className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", dark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600")}
          >
            Guarantor
          </span>
        )}
      </div>
      <p className={cn("mt-1 text-sm leading-relaxed", dark ? "text-slate-400" : "text-slate-500")}>{product.description}</p>
      <p className={cn("tabular mt-4 font-display text-xl font-bold", dark ? "text-white" : "text-slate-900")}>
        {kwacha(product.minAmount, { compact: true })} – {kwacha(product.maxAmount, { compact: true })}
      </p>
      <p className={cn("mt-1 text-xs", dark ? "text-slate-400" : "text-slate-500")}>
        {periods(product.minTerm, product.repaymentFrequency)} to {periods(product.maxTerm, product.repaymentFrequency)} ·{" "}
        {LABELS.frequency[product.repaymentFrequency].toLowerCase()} repayments · {Number(product.annualRatePct)}% a year
      </p>
    </>
  );
  if (!onSelect) return <div className={cn("rounded-2xl border p-5", dark ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-white")}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col justify-start rounded-2xl border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lift",
        selected ? "border-brand-500 ring-4 ring-brand-500/15" : "border-slate-200 hover:border-brand-200",
      )}
    >
      {body}
    </button>
  );
}
