"use client";

import { ArrowRight, BadgePercent, CalendarClock, ChevronRight, CircleAlert, FileUp, HandCoins, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApplicationTracker, applicationHeadline, PayDialog, ProgressRing, type BorrowerApplication, type Position } from "@/components/borrower-ui";
import { Button, ButtonLink, Card, ErrorState, Skeleton, StatusBadge } from "@/components/ui";
import { useApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kwacha, shortDate } from "@/lib/format";

interface LoanSummary {
  id: string;
  loanNumber: string;
  productId: string;
  productName: string;
  principal: string;
  status: string;
  disbursedOn: string | null;
  position: Position;
  progress: { paid: number; total: number };
  topUpEligible: boolean;
}

interface LoanDetail {
  settlement: { total: string; interestWaived: string } | null;
}

interface Me {
  firstName: string;
  phone: string;
}

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function BorrowerHome() {
  const { data: me } = useApi<Me>("/borrower/me");
  const { data: loans, error, isLoading } = useApi<LoanSummary[]>("/borrower/loans");
  const { data: applications } = useApi<BorrowerApplication[]>("/borrower/applications");
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const active = loans?.filter((l) => l.status === "active") ?? [];
  const others = loans?.filter((l) => l.status !== "active") ?? [];
  const inFlight = applications?.filter((a) => a.status === "submitted" || (a.status === "approved" && a.loanStatus === "pending_disbursement")) ?? [];
  const topUp = active.find((l) => l.topUpEligible);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{now ? greeting(now) : " "}</p>
        <h1 className="font-display text-[28px] font-bold leading-tight text-slate-900">{me ? me.firstName : "Welcome"}</h1>
      </div>

      {error && <ErrorState error={error} />}
      {isLoading && <Skeleton className="h-64 rounded-3xl" />}

      {active.map((l) => (
        <BalanceCard key={l.id} loan={l} msisdn={me?.phone} />
      ))}

      {topUp && !inFlight.length && (
        <Link
          href={`/borrower/apply?product=${topUp.productId}`}
          className="group flex items-center gap-4 rounded-2xl border border-copper-100 bg-gradient-to-r from-copper-50 to-white p-5 transition hover:shadow-lift"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-copper-500 text-white">
            <Sparkles className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-semibold text-slate-900">You’ve unlocked a top-up</span>
            <span className="block text-sm text-slate-600">
              You pay on time, so you can apply for more on {topUp.productName}. See your price before you apply.
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-copper-600 transition group-hover:translate-x-0.5" />
        </Link>
      )}

      {inFlight.map((a) => (
        <Card key={a.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Application {a.applicationNumber}</p>
              <p className="mt-1 font-display text-lg font-semibold text-slate-900">
                {kwacha(a.amount)} · {a.productName}
              </p>
            </div>
            <StatusBadge status={a.status} />
          </div>
          <div className="mt-5">
            <ApplicationTracker application={a} />
          </div>
          <p className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">{applicationHeadline(a).text}</p>
        </Card>
      ))}

      {loans && !active.length && !inFlight.length && (
        <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 text-white">
          <div className="bg-grid pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-brand-500/25 blur-3xl" />
          <div className="relative">
            <HandCoins className="size-8 text-brand-300" />
            <h2 className="mt-4 font-display text-2xl font-bold">Need money for something important?</h2>
            <p className="mt-2 max-w-md text-sm text-slate-300">Choose a loan, see exactly what you’ll repay, and apply in three short steps.</p>
            <ButtonLink href="/borrower/apply" size="lg" className="mt-6 bg-brand-500 text-ink-950 hover:bg-brand-400">
              Apply for a loan <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <QuickAction href="/borrower/apply" icon={BadgePercent} title="Apply for a loan" body="See your price first" />
        <QuickAction href="/borrower/documents" icon={FileUp} title="Upload documents" body="NRC and payslip" />
      </div>

      {others.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Other loans</h2>
          <Card className="divide-y divide-slate-100">
            {others.map((l) => (
              <Link key={l.id} href={`/borrower/loans/${l.id}`} className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{l.productName}</p>
                  <p className="text-xs text-slate-500">
                    {l.loanNumber} · {kwacha(l.principal)}
                  </p>
                </div>
                <StatusBadge status={l.status} />
                <ChevronRight className="size-4 text-slate-400" />
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function QuickAction({ href, icon: Icon, title, body }: { href: string; icon: React.ElementType; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-xs text-slate-500">{body}</p>
    </Link>
  );
}

/** The hero: balance, progress and the one thing to do next. */
function BalanceCard({ loan: l, msisdn }: { loan: LoanSummary; msisdn?: string }) {
  const [pay, setPay] = useState<null | "due" | "payoff">(null);
  // The settlement figure is only needed once the borrower opens the payment dialog.
  const { data: detail } = useApi<LoanDetail>(pay ? `/borrower/loans/${l.id}` : null);
  const late = l.position.daysPastDue > 0;
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-6 text-white shadow-lift sm:p-7">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3 text-sm">
            <Link href={`/borrower/loans/${l.id}`} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">
              {l.productName} · {l.loanNumber} <ChevronRight className="size-4" />
            </Link>
            {late ? (
              <span className="rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-200">Overdue</span>
            ) : (
              <span className="rounded-full bg-brand-500/15 px-2.5 py-1 text-xs font-semibold text-brand-200">On track</span>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-slate-400">Balance to pay</p>
              <p className="tabular mt-1 font-display text-[34px] font-bold leading-none sm:text-[40px]">{kwacha(l.position.totalOutstanding)}</p>
            </div>
            <ProgressRing paid={l.progress.paid} total={l.progress.total} dark size={96} />
          </div>

          <div
            className={cn(
              "mt-6 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm",
              late ? "bg-rose-500/15 text-rose-100" : "bg-white/[0.06] text-slate-200",
            )}
          >
            {late ? <CircleAlert className="size-5 shrink-0 text-rose-300" /> : <CalendarClock className="size-5 shrink-0 text-brand-300" />}
            <span className="tabular">
              {late ? (
                <>
                  <strong className="text-white">{kwacha(l.position.overdueAmount)}</strong> is {l.position.daysPastDue} days late. Paying now stops further
                  penalties.
                </>
              ) : l.position.nextDueDate ? (
                <>
                  Next payment <strong className="text-white">{kwacha(l.position.nextDueAmount)}</strong> due {shortDate(l.position.nextDueDate)}
                </>
              ) : (
                "All instalments paid"
              )}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
            <Button size="lg" className="bg-brand-500 text-ink-950 shadow-none hover:bg-brand-400" onClick={() => setPay("due")}>
              Pay now
            </Button>
            <Button size="lg" variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => setPay("payoff")}>
              Pay off early
            </Button>
          </div>
        </div>
      </div>

      {pay && detail && (
        <PayDialog
          open
          onClose={() => setPay(null)}
          initialMode={pay}
          defaultMsisdn={msisdn}
          loan={{
            id: l.id,
            loanNumber: l.loanNumber,
            position: l.position,
            settlement: detail.settlement,
          }}
        />
      )}
    </>
  );
}
