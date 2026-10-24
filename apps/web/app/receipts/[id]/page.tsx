"use client";

import type { Channel } from "@anzelu/contracts";
import { ArrowLeft, MapPin, Phone, Printer } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { Button, ErrorState, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kwacha, shortDate } from "@/lib/format";
import { kwachaInWords } from "@/lib/words";

interface Receipt {
  receiptNumber: string;
  receivedOn: string;
  amount: string;
  channel: Channel;
  externalRef: string | null;
  status: string;
  loanNumber: string;
  customerName: string;
  customerNumber: string;
  customerNrc: string;
  customerPhone: string;
  recordedByName: string | null;
  company: {
    name: string;
    tradingName?: string;
    tagline?: string;
    address?: string;
    phones?: string;
    email?: string;
    licenceNumber?: string;
    receiptNote?: string;
  };
  figures: { originalAmount: string; totalPayable: string; previousPayments: string; paidToday: string; balance: string };
}

const METHODS = [
  { label: "Cash", channels: ["cash"] },
  { label: "Mobile Money", channels: ["mtn_momo", "airtel_money"] },
  { label: "Bank Transfer", channels: ["bank"] },
];

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: r, error } = useApi<Receipt>(`/payments/${id}`);

  return (
    <div className="min-h-dvh bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[820px] items-center justify-between gap-3 px-4 print:hidden">
        <Button variant="secondary" onClick={() => router.back()}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button onClick={() => window.print()} disabled={!r}>
          <Printer className="size-4" /> Print receipt
        </Button>
      </div>
      <div className="mx-auto max-w-[820px] px-4 print:max-w-none print:px-0">
        {error && <ErrorState error={error} />}
        {!r && !error && <Skeleton className="h-[900px]" />}
        {r && (
          <div className="space-y-6 print:space-y-0">
            <Copy r={r} copy="Customer copy" />
            <div className="relative hidden border-t-2 border-dashed border-slate-300 print:block" aria-hidden />
            <Copy r={r} copy="Office copy" />
          </div>
        )}
      </div>
    </div>
  );
}

function Copy({ r, copy }: { r: Receipt; copy: string }) {
  const name = r.company.tradingName || r.company.name;
  const reversed = r.status !== "posted";
  const rows = [
    ["Original loan amount", r.figures.originalAmount],
    ["Total amount payable", r.figures.totalPayable],
    ["Previous payments", r.figures.previousPayments],
    ["Payment received today", r.figures.paidToday],
    ["Outstanding balance", r.figures.balance],
  ] as const;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-card print:break-inside-avoid print:rounded-none print:border-0 print:p-6 print:shadow-none">
      {reversed && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-7xl font-black uppercase tracking-widest text-rose-500/15 -rotate-12">
          {r.status}
        </span>
      )}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand-500 pb-4">
        <div className="flex items-center gap-3">
          <LogoMark className="size-16" />
          <div>
            <p className="font-display text-xl font-extrabold uppercase leading-none tracking-tight text-[#2b130b]">{name}</p>
            {r.company.tagline && <p className="mt-1 text-sm italic text-brand-700">{r.company.tagline}</p>}
            <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Loan repayment receipt</p>
          </div>
        </div>
        <div className="space-y-1 text-right text-xs text-slate-600">
          <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-700 print:border print:border-brand-500">
            {copy}
          </span>
          {r.company.address && (
            <p className="flex items-center justify-end gap-1">
              <MapPin className="size-3" /> {r.company.address}
            </p>
          )}
          {r.company.phones && (
            <p className="flex items-center justify-end gap-1">
              <Phone className="size-3" /> {r.company.phones}
            </p>
          )}
          {r.company.licenceNumber && <p>Licence {r.company.licenceNumber}</p>}
        </div>
      </header>

      <div className="tabular mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <Meta label="Receipt no." value={r.receiptNumber} strong />
        <Meta label="Date" value={shortDate(r.receivedOn)} />
        <Meta label="Loan account no." value={r.loanNumber} />
        <Meta label="Customer no." value={r.customerNumber} />
      </div>

      <Section title="Customer details">
        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Line label="Name" value={r.customerName} />
          <Line label="NRC no." value={r.customerNrc} />
          <Line label="Phone" value={r.customerPhone} />
        </div>
      </Section>

      <Section title="Payment details">
        <table className="tabular w-full text-sm">
          <tbody>
            {rows.map(([label, value]) => {
              const today = label === "Payment received today";
              const balance = label === "Outstanding balance";
              return (
                <tr key={label} className={cn("border-b border-slate-200 last:border-0", today && "bg-brand-50/70")}>
                  <td className="px-3 py-2 text-slate-700">{label}</td>
                  <td className={cn("px-3 py-2 text-right", today || balance ? "font-bold text-slate-900" : "text-slate-800")}>{kwacha(value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <span className="text-slate-500">Amount in words: </span>
          <span className="font-semibold text-slate-900">{kwachaInWords(r.amount)}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-slate-500">Payment method:</span>
          {METHODS.map((m) => {
            const on = m.channels.includes(r.channel);
            return (
              <span key={m.label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-4 place-items-center rounded border text-[11px] font-bold",
                    on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-400",
                  )}
                >
                  {on ? "✓" : ""}
                </span>
                <span className={on ? "font-semibold text-slate-900" : "text-slate-600"}>{m.label}</span>
              </span>
            );
          })}
          {r.externalRef && <span className="text-xs text-slate-500">Ref: {r.externalRef}</span>}
        </div>
      </Section>

      <Section title="Authorisation">
        <div className="grid gap-6 text-sm sm:grid-cols-[1fr_1fr_8rem]">
          <Sign label="Received by" value={r.recordedByName ?? ""} />
          <Sign label="Customer signature" value="" />
          <div className="grid h-24 place-items-center rounded-lg border-2 border-dashed border-slate-300 text-center text-[11px] uppercase tracking-wider text-slate-400">
            Official stamp
          </div>
        </div>
      </Section>

      <p className="mt-5 text-center text-xs italic text-slate-500">
        {r.company.receiptNote || "Thank you for your payment. Please keep this receipt for your records."}
      </p>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h2 className="mb-2 rounded-md bg-[#2b130b] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white print:bg-[#2b130b] print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("text-slate-900", strong ? "font-bold text-brand-700" : "font-medium")}>{value}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="border-b border-dotted border-slate-300 pb-1">
      <span className="text-slate-500">{label}: </span>
      <span className="font-medium text-slate-900">{value}</span>
    </p>
  );
}

function Sign({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-end">
      <p className="h-8 font-medium text-slate-900">{value}</p>
      <p className="border-t border-slate-400 pt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
