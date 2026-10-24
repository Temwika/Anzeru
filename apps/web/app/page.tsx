import {
  BadgeCheck,
  BookOpenCheck,
  Building2,
  ChartNoAxesCombined,
  HandCoins,
  Landmark,
  ShieldCheck,
  Siren,
  UserRoundSearch,
} from "lucide-react";
import Link from "next/link";
import { LoanCalculator } from "@/components/loan-calculator";
import { Logo } from "@/components/logo";

const modules = [
  { icon: UserRoundSearch, title: "Customers & KYC", body: "NRC-based onboarding, consent, documents, duplicate detection and guarantors." },
  { icon: BookOpenCheck, title: "Origination & credit", body: "Affordability, transparent scorecards and maker-checker approvals with delegated limits." },
  { icon: HandCoins, title: "Disbursement & repayments", body: "Separately authorised payouts, idempotent receipts, deterministic allocation and controlled reversals." },
  { icon: Siren, title: "Arrears & recovery", body: "Ageing buckets, collection queues, promises to pay and late-penalty automation." },
  { icon: Landmark, title: "Double-entry ledger", body: "Every financial event posts balanced, immutable journals with a live trial balance." },
  { icon: ChartNoAxesCombined, title: "Portfolio intelligence", body: "PAR30/PAR90, collection efficiency, branch and loan-officer performance." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <Logo dark />
          </Link>
          <nav className="flex items-center gap-2">
            <a href="#calculator" className="hidden rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white sm:block">
              Calculator
            </a>
            <a href="#platform" className="hidden rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white sm:block">
              Platform
            </a>
            <Link href="/login" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-ink-950 hover:bg-slate-100">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -bottom-40 left-10 size-[420px] rounded-full bg-copper-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -top-40 right-0 size-[600px] rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-brand-200">
              <BadgeCheck className="size-3.5" /> Built for Zambian lenders
            </p>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.08] sm:text-[56px]">
              Lending operations you can <span className="text-brand-400">reconcile to the ngwee.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              Chilimbitso runs the full loan lifecycle for microfinance institutions, SACCOs, salary-based and SME lenders — from
              KYC and credit decisions to mobile-money disbursement, collections and a balanced general ledger.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-xl bg-brand-500 px-6 py-3.5 text-sm font-semibold text-ink-950 shadow-lg shadow-brand-500/20 transition hover:bg-brand-400">
                Open the staff portal
              </Link>
              <a href="#calculator" className="rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold transition hover:bg-white/5">
                Try the calculator
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 self-center">
            {[
              { k: "Interest methods", v: "Reducing, flat & bullet" },
              { k: "Repayment frequency", v: "Daily to monthly" },
              { k: "Payment channels", v: "MTN, Airtel, bank, cash" },
              { k: "Controls", v: "Maker-checker everywhere" },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">{s.k}</p>
                <p className="mt-2 font-medium">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="calculator" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl font-bold text-slate-900">See exactly what a loan costs</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          The same server-side engine that books loans produces this schedule — no spreadsheet drift between quote and contract.
        </p>
        <div className="mt-8">
          <LoanCalculator />
        </div>
      </section>

      <section id="platform" className="scroll-mt-20 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-bold text-slate-900">One platform, the whole lending cycle</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <div key={m.title} className="group rounded-2xl border border-slate-200 p-6 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                  <m.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{m.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{m.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-6 rounded-2xl bg-slate-50 p-6 text-sm text-slate-600">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-brand-600" /> Tenant-isolated data and branch-scoped access
            </span>
            <span className="flex items-center gap-2">
              <Building2 className="size-4 text-brand-600" /> Multi-institution SaaS with per-tenant chart of accounts
            </span>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500 sm:px-6">
          © 2026 Chilimbitso · Uplift Services Limited
        </div>
      </footer>
    </div>
  );
}
