"use client";

import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { kwacha, pct, shortDate } from "@/lib/format";
import { useQuote } from "@/lib/quote";
import { cn } from "@/lib/cn";
import { perPeriod, periods, ProductCard, type BorrowerProduct } from "./borrower-ui";
import { LogoMark } from "./logo";

/** The institution whose products this site advertises. */
export const INSTITUTION_CODE = process.env.NEXT_PUBLIC_INSTITUTION_CODE ?? "DEMO";
export const APPLY_HREF = "/login?next=/borrower/apply";

interface Catalogue {
  name: string;
  products: BorrowerProduct[];
}

/** Products and prices straight from the lender's live settings, so the site can never advertise a different price from the one booked. */
function useCatalogue() {
  const [data, setData] = useState<Catalogue | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch(`/api/v1/public/institutions/${INSTITUTION_CODE}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => setData(j.data))
      .catch(() => setFailed(true));
  }, []);
  return { data, failed };
}

export function ProductCatalogue() {
  const { data, failed } = useCatalogue();
  if (failed)
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Our loan list is temporarily unavailable. Please try again shortly.
      </p>
    );
  if (!data)
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {data.products.map((p) => (
        <div
          key={p.code}
          className="flex flex-col rounded-2xl border border-slate-200 bg-white p-1 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
        >
          <div className="flex-1 [&>div]:border-0">
            <ProductCard product={p} />
          </div>
          <Link
            href={APPLY_HREF}
            className="m-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            Apply <ArrowRight className="size-4" />
          </Link>
        </div>
      ))}
    </div>
  );
}

/**
 * Product-based calculator with a representative example: the borrower picks a
 * real product and sees the instalment, total cost and APR the engine will book.
 */
export function ProductCalculator() {
  const { data } = useCatalogue();
  const [code, setCode] = useState<string | null>(null);
  const product = data?.products.find((p) => p.code === code) ?? data?.products[0] ?? null;
  // Each product starts at a typical loan until the visitor moves a slider.
  const [picked, setPicked] = useState<{ code: string; amount: number; term: number } | null>(null);
  const current =
    picked && picked.code === product?.code
      ? picked
      : product
        ? {
            amount: Math.max(
              Number(product.minAmount),
              Math.round((Number(product.minAmount) + (Number(product.maxAmount) - Number(product.minAmount)) * 0.1) / 500) * 500,
            ),
            term: Math.round((product.minTerm + product.maxTerm) / 2),
          }
        : { amount: 0, term: 0 };
  const { amount, term } = current;
  const setAmount = (v: number) => product && setPicked({ code: product.code, amount: v, term });
  const setTerm = (v: number) => product && setPicked({ code: product.code, amount, term: v });

  const { quote } = useQuote(
    product && amount && term
      ? {
          amount: String(amount),
          term,
          annualRatePct: product.annualRatePct,
          interestMethod: product.interestMethod,
          frequency: product.repaymentFrequency,
          processingFeePct: product.processingFeePct,
        }
      : null,
  );

  if (!product) return <div className="h-96 animate-pulse rounded-3xl bg-slate-100" />;
  const min = Number(product.minAmount);
  const max = Number(product.maxAmount);
  const fill = (v: number, lo: number, hi: number) => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 0);

  return (
    <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-7 p-6 sm:p-8">
        <div>
          <p className="mb-2 text-[13px] font-medium text-slate-700">Loan type</p>
          <div className="flex flex-wrap gap-2">
            {data?.products.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => setCode(p.code)}
                aria-pressed={p.code === product.code}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                  p.code === product.code ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-700 hover:border-slate-300",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="flex items-end justify-between">
            <span className="text-[13px] font-medium text-slate-700">Amount</span>
            <span className="tabular font-display text-2xl font-bold text-slate-900">{kwacha(amount)}</span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={max - min > 100_000 ? 1000 : 500}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full accent-brand-600"
            style={{
              background: `linear-gradient(to right, var(--color-brand-500) ${fill(amount, min, max)}%, var(--color-slate-200) ${fill(amount, min, max)}%)`,
            }}
          />
        </label>
        <label className="block">
          <span className="flex items-end justify-between">
            <span className="text-[13px] font-medium text-slate-700">Repay over</span>
            <span className="tabular font-display text-2xl font-bold text-slate-900">{periods(term, product.repaymentFrequency)}</span>
          </span>
          <input
            type="range"
            min={product.minTerm}
            max={product.maxTerm}
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full accent-brand-600"
            style={{
              background: `linear-gradient(to right, var(--color-brand-500) ${fill(term, product.minTerm, product.maxTerm)}%, var(--color-slate-200) ${fill(term, product.minTerm, product.maxTerm)}%)`,
            }}
          />
        </label>
      </div>

      <div className="relative flex flex-col justify-between overflow-hidden bg-ink-950 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-wide text-slate-400">You’d repay</p>
          <p className="tabular mt-1 font-display text-4xl font-bold">
            {quote ? kwacha(quote.installmentAmount) : "—"}{" "}
            <span className="text-base font-semibold text-slate-400">{perPeriod(product.repaymentFrequency)}</span>
          </p>
          {quote && (
            <dl className="tabular mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-5 text-sm">
              <div>
                <dt className="text-xs text-slate-400">You receive</dt>
                <dd className="font-semibold">{kwacha(quote.netDisbursed)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Total to repay</dt>
                <dd className="font-semibold">{kwacha(quote.totals.repayable)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">First payment</dt>
                <dd className="font-semibold">{shortDate(quote.installments[0]?.dueDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">APR (all costs)</dt>
                <dd className="font-semibold">{pct(quote.disclosure.aprPct)}</dd>
              </div>
            </dl>
          )}
        </div>
        <div className="relative mt-8">
          <Link
            href={APPLY_HREF}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-sm font-semibold text-ink-950 transition hover:bg-brand-400"
          >
            Apply for this loan <ArrowRight className="size-4" />
          </Link>
          {quote && (
            <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Representative example: {kwacha(amount)} over {periods(term, product.repaymentFrequency)} at {Number(product.annualRatePct)}% a year (
              {product.interestMethod.replace("_", " ")}) with a {Number(product.processingFeePct)}% processing fee: {kwacha(quote.totals.repayable)} repayable
              in total, APR {pct(quote.disclosure.aprPct)}. Subject to approval and affordability.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Illustrative phone showing the borrower app home screen. */
export function PhoneMock({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative mx-auto w-[260px] rounded-[2.6rem] border border-white/15 bg-ink-900 p-2.5 shadow-2xl shadow-black/40", className)}
      aria-hidden
    >
      <div className="overflow-hidden rounded-[2.1rem] bg-slate-50">
        <div className="flex items-center justify-between bg-white px-4 pb-2 pt-4">
          <LogoMark className="size-6" />
          <span className="size-6 rounded-full bg-brand-100" />
        </div>
        <div className="space-y-2.5 p-3">
          <p className="px-1 text-[10px] text-slate-500">Good morning</p>
          <p className="-mt-2 px-1 font-display text-base font-bold text-slate-900">Chanda</p>
          <div className="rounded-2xl bg-ink-950 p-3.5 text-white">
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span>Salary Advance</span>
              <span className="rounded-full bg-brand-500/20 px-1.5 py-0.5 text-brand-200">On track</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <p className="text-[8px] uppercase text-slate-400">Balance</p>
                <p className="font-display text-lg font-bold">K8,450.00</p>
              </div>
              <svg viewBox="0 0 100 100" className="size-12 -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" strokeWidth="10" className="stroke-white/10" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray="251"
                  strokeDashoffset="100"
                  className="stroke-brand-400"
                />
              </svg>
            </div>
            <p className="mt-2 rounded-lg bg-white/[0.06] px-2 py-1.5 text-[9px] text-slate-300">Next payment K1,410.00 due 08 Nov</p>
            <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-1.5">
              <span className="rounded-lg bg-brand-500 py-1.5 text-center text-[10px] font-semibold text-ink-950">Pay now</span>
              <span className="px-2 py-1.5 text-[10px] text-slate-300">Pay off</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-copper-100 bg-copper-50 p-2.5">
            <span className="size-6 rounded-lg bg-copper-500" />
            <span className="text-[9px] font-semibold text-slate-800">You’ve unlocked a top-up</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <span className="h-12 rounded-xl border border-slate-200 bg-white" />
            <span className="h-12 rounded-xl border border-slate-200 bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
