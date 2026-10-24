"use client";

import { FREQUENCIES, INTEREST_METHODS, LABELS, type Frequency, type InterestMethod } from "@anzelu/contracts";
import type { Schedule } from "@anzelu/finance";
import { Calculator, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { kwacha, pct, shortDate } from "@/lib/format";

interface Form {
  amount: string;
  term: string;
  annualRatePct: string;
  interestMethod: InterestMethod;
  frequency: Frequency;
  processingFeePct: string;
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function LoanCalculator() {
  const [form, setForm] = useState<Form>({
    amount: "15000",
    term: "12",
    annualRatePct: "36",
    interestMethod: "reducing_balance",
    frequency: "monthly",
    processingFeePct: "3",
  });
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) {
          const issue = json.error?.details?.[0];
          setError(issue?.message ?? json.error?.message ?? "Unable to calculate");
          setSchedule(null);
        } else {
          setError(null);
          setSchedule(json.data);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Network error — try again");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [form]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const rows = schedule ? (showAll ? schedule.installments : schedule.installments.slice(0, 6)) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <Calculator className="size-4" />
          </span>
          <h3 className="font-semibold text-slate-900">Repayment calculator</h3>
        </div>
        <div className="space-y-4">
          <Field label="Loan amount (ZMW)">
            <input className={inputCls} inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Instalments">
              <input className={inputCls} inputMode="numeric" value={form.term} onChange={(e) => set("term", e.target.value)} />
            </Field>
            <Field label="Frequency">
              <select className={inputCls} value={form.frequency} onChange={(e) => set("frequency", e.target.value as Frequency)}>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {LABELS.frequency[f]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Interest method">
            <select
              className={inputCls}
              value={form.interestMethod}
              onChange={(e) => set("interestMethod", e.target.value as InterestMethod)}
            >
              {INTEREST_METHODS.map((m) => (
                <option key={m} value={m}>
                  {LABELS.interestMethod[m]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Annual rate (%)">
              <input className={inputCls} inputMode="decimal" value={form.annualRatePct} onChange={(e) => set("annualRatePct", e.target.value)} />
            </Field>
            <Field label="Processing fee (%)">
              <input
                className={inputCls}
                inputMode="decimal"
                value={form.processingFeePct}
                onChange={(e) => set("processingFeePct", e.target.value)}
              />
            </Field>
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{schedule?.installments.length ?? "—"} instalments of</p>
            <p className="tabular mt-1 text-4xl font-semibold tracking-tight text-slate-900">
              {schedule ? kwacha(schedule.installmentAmount) : "—"}
            </p>
          </div>
          {loading && <Loader2 className="size-5 animate-spin text-slate-400" />}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total interest" value={schedule ? kwacha(schedule.totals.interest) : "—"} />
          <Stat label="Total repayable" value={schedule ? kwacha(schedule.totals.repayable) : "—"} />
          <Stat label="Net disbursed" value={schedule ? kwacha(schedule.netDisbursed) : "—"} hint={schedule ? `after ${kwacha(schedule.processingFee)} fee` : undefined} />
          <Stat
            label="Cost of credit (APR)"
            value={schedule ? pct(schedule.disclosure.aprPct) : "—"}
            hint={schedule ? `EAR ${pct(schedule.disclosure.effectiveAnnualRatePct)}` : undefined}
          />
        </dl>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Due date</th>
                <th className="py-2 pr-3 text-right">Principal</th>
                <th className="py-2 pr-3 text-right">Interest</th>
                <th className="py-2 pr-3 text-right">Instalment</th>
                <th className="py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((i) => (
                <tr key={i.number} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 text-slate-500">{i.number}</td>
                  <td className="py-2 pr-3 text-slate-700">{shortDate(i.dueDate)}</td>
                  <td className="py-2 pr-3 text-right">{kwacha(i.principal)}</td>
                  <td className="py-2 pr-3 text-right">{kwacha(i.interest)}</td>
                  <td className="py-2 pr-3 text-right font-medium text-slate-900">{kwacha(i.total)}</td>
                  <td className="py-2 text-right text-slate-500">{kwacha(i.closingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {schedule && schedule.installments.length > 6 && (
            <button onClick={() => setShowAll((s) => !s)} className="mt-3 text-sm font-medium text-brand-700 hover:text-brand-800">
              {showAll ? "Show fewer" : `Show all ${schedule.installments.length} instalments`}
            </button>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Illustrative quote. The APR includes the processing fee so flat-rate and reducing-balance offers can be compared fairly.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="tabular mt-1 font-semibold text-slate-900">{value}</dd>
      {hint && <dd className="text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}
