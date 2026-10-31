import { BadgeCheck, Landmark, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const PROOF = [
  { icon: BadgeCheck, title: "Maker-checker on every decision", body: "Approvals, payouts and reversals always need a second person." },
  { icon: Landmark, title: "Reconciled to the ngwee", body: "Every receipt posts a balanced, immutable journal." },
  { icon: ShieldCheck, title: "Tamper-evident audit trail", body: "A hash-chained record of who did what, and when." },
];

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -left-32 -top-32 size-[520px] animate-float rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 right-0 size-[460px] animate-float rounded-full bg-copper-500/15 blur-3xl [animation-delay:-3.5s]" />
        <div className="pointer-events-none absolute -right-24 top-1/3 size-[420px] animate-float rounded-full bg-[#2f6be0]/25 blur-3xl [animation-delay:-2s]" />
        <div className="grain pointer-events-none absolute inset-0 opacity-[0.06]" />

        <Link href="/" className="relative">
          <Logo dark subtitle="Loan management platform" />
        </Link>

        <div className="relative max-w-lg">
          <p className="font-display text-[40px] font-bold leading-[1.1]">
            Every kwacha accounted for, from application to <span className="text-brand-300">final instalment.</span>
          </p>

          {/* A glimpse of the product: what a loan officer sees each morning. */}
          <div className="mt-10 animate-rise rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)] backdrop-blur [animation-delay:150ms]">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Portfolio today</span>
              <span className="rounded-full bg-brand-500/15 px-2 py-0.5 font-medium text-brand-300">Example</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4">
              {[
                { k: "Active loans", v: "1,284" },
                { k: "Collected (MTD)", v: "K2.41M" },
                { k: "PAR 30", v: "4.8%" },
              ].map((s) => (
                <div key={s.k}>
                  <p className="tabular font-display text-xl font-bold">{s.v}</p>
                  <p className="text-[11px] text-slate-400">{s.k}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex h-12 items-end gap-1.5">
              {[38, 52, 45, 61, 58, 72, 66, 80, 76, 88, 84, 95].map((h, i) => (
                <span
                  key={i}
                  className="flex-1 origin-bottom animate-grow-up rounded-t bg-gradient-to-t from-brand-600/60 to-brand-400"
                  style={{ height: `${h}%`, animationDelay: `${300 + i * 50}ms` }}
                />
              ))}
            </div>
          </div>

          <ul className="stagger mt-8 space-y-4">
            {PROOF.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-brand-300">
                  <p.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{p.title}</span>
                  <span className="block text-sm text-slate-400">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">© 2026 Chilimbitso Money Lending · Sinda, Eastern Province</p>
      </div>

      <div className="relative flex flex-col items-center justify-center bg-white px-6 py-10 sm:px-10">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="mb-10 lg:hidden">
          <Logo subtitle="Loan management platform" />
        </div>
        <Suspense>
          {/* Demo roles show in development, or on a hosted demo that opts in at build time. */}
          <LoginForm showDemo={process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGINS === "true"} />
        </Suspense>
      </div>
    </div>
  );
}
