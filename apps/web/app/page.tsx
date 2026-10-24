import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Calculator,
  FileCheck2,
  Landmark,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { APPLY_HREF, PhoneMock, ProductCalculator, ProductCatalogue } from "@/components/landing";
import { Logo } from "@/components/logo";

/** Licence wording is set per deployment (e.g. "Licensed by the Bank of Zambia, licence no. …") and only shown when provided. */
const LICENCE = process.env.NEXT_PUBLIC_LICENCE_TEXT;

const TRUST = [
  { icon: ReceiptText, title: "Full price upfront", body: "Instalment, total cost and APR before you apply." },
  { icon: BadgeCheck, title: "No early-repayment penalty", body: "Pay off any time and future interest is waived." },
  { icon: Wallet, title: "MTN MoMo & Airtel Money", body: "Pay from your phone and get a receipt instantly." },
  { icon: LockKeyhole, title: "Your data protected", body: "Handled under the Data Protection Act, 2021." },
];

const STEPS = [
  { icon: Calculator, title: "Choose and see your price", body: "Pick a loan, slide to the amount and term you want, and see exactly what you’ll repay." },
  { icon: FileCheck2, title: "Tell us about you", body: "Add your income and snap a photo of your NRC and payslip. It takes a few minutes." },
  {
    icon: Smartphone,
    title: "Get a decision and your money",
    body: "A credit officer reviews it, we SMS you the decision, and approved loans are paid out to you.",
  },
];

const CONTROLS = [
  { icon: BookOpenCheck, title: "Two people sign off every loan", body: "No single person can approve credit or release money alone." },
  { icon: Landmark, title: "Every kwacha on the books", body: "Each payment posts a balanced, permanent accounting record." },
  { icon: ShieldCheck, title: "A tamper-evident trail", body: "Who did what, and when, recorded so it can’t be quietly changed." },
];

const FAQ = [
  {
    q: "Who can apply?",
    a: "Zambian residents aged 18 or over with a valid NRC and a regular income: a salary, a registered business, trading or farming. Some business loans also need a guarantor.",
  },
  {
    q: "What documents do I need?",
    a: "Your NRC and your latest payslip. For business loans we may also ask for your trading licence and recent bank statements.",
  },
  {
    q: "How long does a decision take?",
    a: "A credit officer reviews applications on working days. You can follow your application in the app at any time, and we’ll SMS you the outcome.",
  },
  {
    q: "Are there hidden fees?",
    a: "No. The processing fee, the interest and the APR are all shown before you apply, and the same figures go into your loan agreement.",
  },
  {
    q: "Can I repay early?",
    a: "Yes, with no penalty. Paying off early clears what’s due plus the current period’s interest; interest for later periods is waived.",
  },
  {
    q: "How do I make payments?",
    a: "Tap Pay now in the app and approve the prompt on your MTN MoMo or Airtel Money phone, or pay from your wallet menu using your loan number as the reference.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/">
            <Logo dark />
          </Link>
          <nav className="flex items-center gap-1">
            {[
              ["#loans", "Loans"],
              ["#how", "How it works"],
              ["#calculator", "Calculator"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="hidden rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white md:block">
                {label}
              </a>
            ))}
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-200 hover:text-white">
              Sign in
            </Link>
            <Link href={APPLY_HREF} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-400">
              Apply
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -bottom-40 left-10 size-[420px] rounded-full bg-copper-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -top-40 right-0 size-[600px] rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-brand-200">
              <BadgeCheck className="size-3.5" /> Chilimbitso Money Lending · Zambia
            </p>
            <h1 className="mt-6 font-display text-[40px] font-bold leading-[1.06] sm:text-[60px]">
              Loans that fit <span className="text-brand-400">your payday.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              Salary advances, business and farming loans with the full price shown before you apply, payments from your phone, and no penalty for paying early.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={APPLY_HREF}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-sm font-semibold text-ink-950 shadow-lg shadow-brand-500/20 transition hover:bg-brand-400"
              >
                Apply now <ArrowRight className="size-4" />
              </Link>
              <a href="#calculator" className="rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold transition hover:bg-white/5">
                See what it costs
              </a>
            </div>
            <p className="mt-6 text-sm text-slate-400">
              Already borrowing with us?{" "}
              <Link href="/login" className="font-semibold text-white underline-offset-4 hover:underline">
                Sign in to pay or check your balance
              </Link>
            </p>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-x-10 top-10 h-72 rounded-full bg-brand-500/20 blur-3xl" />
            <PhoneMock className="relative rotate-[-3deg]" />
            <p className="mt-4 text-center text-xs text-slate-500">Illustration of the borrower app</p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <ul className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {TRUST.map((t) => (
            <li key={t.title} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <t.icon className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">{t.title}</span>
                <span className="block text-sm text-slate-500">{t.body}</span>
              </span>
            </li>
          ))}
        </ul>
        {LICENCE && <p className="border-t border-slate-100 px-4 py-3 text-center text-xs text-slate-500">{LICENCE}</p>}
      </section>

      <section id="loans" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Our loans</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">A loan for what matters to you</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Every amount, term and rate below comes straight from our lending system, so what you see is what you’ll be offered.
        </p>
        <div className="mt-8">
          <ProductCatalogue />
        </div>
      </section>

      <section id="how" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">Three steps to your money</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-slate-200 p-6">
                <span className="absolute -top-4 left-6 grid size-8 place-items-center rounded-full bg-ink-950 font-display text-sm font-bold text-white">
                  {i + 1}
                </span>
                <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <s.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="calculator" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Calculator</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">See exactly what you’ll repay</h2>
        <p className="mt-2 max-w-2xl text-slate-600">The same engine that books your loan works out this price, so there are no surprises later.</p>
        <div className="mt-8">
          <ProductCalculator />
        </div>
      </section>

      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-300">Why you can trust us</p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold">Run with the controls of a bank</h2>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {CONTROLS.map((c) => (
              <li key={c.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <c.icon className="size-6 text-brand-300" />
                <h3 className="mt-4 font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6">
        <h2 className="text-center font-display text-3xl font-bold text-slate-900">Questions, answered</h2>
        <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-6 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                {f.q}
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 rounded-3xl bg-brand-600 p-8 text-center text-white">
          <h3 className="font-display text-2xl font-bold">Ready when you are</h3>
          <p className="mt-2 text-brand-50">See your price in a minute. Applying is free and doesn’t commit you to borrow.</p>
          <Link
            href={APPLY_HREF}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
          >
            Apply now <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© 2026 Chilimbitso Money Lending · Platform by Uplift Services Limited</span>
          <Link href="/login" className="hover:text-slate-900">
            Staff sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
