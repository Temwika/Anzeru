"use client";

import type { SessionUser } from "@anzelu/contracts";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  CalendarDays,
  HandCoins,
  Landmark,
  PiggyBank,
  ReceiptText,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UserPlus,
  UserRoundPlus,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AgeingBar, GroupedBarChart } from "@/components/charts";
import { Avatar, Card, CardHeader, ErrorState, ProgressBar, Skeleton, StatCard, StatusBadge, Table, Td, Th } from "@/components/ui";
import { usePage, useApi, useSession } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kwacha, pct, shortDate } from "@/lib/format";

interface Dashboard {
  asOf: string;
  kpis: {
    activeLoans: number;
    outstandingPrincipal: string;
    totalOutstanding: string;
    overdueAmount: string;
    loansInArrears: number;
    disbursedThisMonth: string;
    collectedThisMonth: string;
    dueThisMonth: string;
    collectionEfficiencyPct: string | null;
    par30: string;
    par90: string;
  };
  buckets: { bucket: string; count: number; principal: string }[];
  trend: { month: string; collected: string; disbursed: string }[];
  statusCounts: Record<string, number>;
  recentApplications: { id: string; applicationNumber: string; amount: string; status: string; submittedAt: string; customerName: string; grade: string }[];
  branches: { id: string; name: string; activeLoans: number; outstandingPrincipal: string; par30: string }[];
  officers: { id: string; name: string; activeLoans: number; outstandingPrincipal: string; par30: string }[];
}

interface Tasks {
  applications: number;
  disbursements: number;
  reversals: number;
  kyc: number;
  total: number;
}

interface Action {
  href: string;
  icon: React.ElementType;
  title: string;
  body: string;
  urgent?: boolean;
}

const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** The few things this person should do next, most urgent first. */
function nextActions(user: SessionUser, tasks?: Tasks, d?: Dashboard): Action[] {
  const can = (p: string) => user.permissions.includes(p as never);
  const out: Action[] = [];
  if (tasks?.applications)
    out.push({
      href: "/applications?status=submitted",
      icon: BookOpenCheck,
      title: `Decide ${plural(tasks.applications, "application")}`,
      body: "Scored and waiting for a credit decision",
      urgent: true,
    });
  if (tasks?.disbursements)
    out.push({
      href: "/approvals",
      icon: HandCoins,
      title: `Authorise ${plural(tasks.disbursements, "payout")}`,
      body: "Approved loans ready to be paid out",
      urgent: true,
    });
  if (tasks?.reversals)
    out.push({
      href: "/approvals",
      icon: ReceiptText,
      title: `Review ${plural(tasks.reversals, "reversal request")}`,
      body: "A colleague asked to undo a receipt",
      urgent: true,
    });
  if (tasks?.kyc)
    out.push({
      href: "/customers?kyc=pending",
      icon: ShieldCheck,
      title: `Verify ${plural(tasks.kyc, "customer")}`,
      body: "KYC documents waiting for review",
      urgent: true,
    });
  if (can("collections:write") && d?.kpis.loansInArrears)
    out.push({
      href: "/loans/arrears",
      icon: Siren,
      title: `Follow up ${plural(d.kpis.loansInArrears, "loan")} in arrears`,
      body: `${kwacha(d.kpis.overdueAmount, { compact: true })} overdue across the book`,
    });
  if (can("applications:write")) {
    out.push({ href: "/customers/new", icon: UserPlus, title: "Onboard a customer", body: "Identity, contact, income and consent in three steps" });
    out.push({ href: "/applications/new", icon: BookOpenCheck, title: "Start a loan application", body: "Live repayment quote and affordability check" });
  }
  if (can("payments:record")) out.push({ href: "/loans", icon: Wallet, title: "Record a repayment", body: "Open the loan, then Record payment" });
  if (can("accounting:read"))
    out.push({ href: "/accounting", icon: Landmark, title: "Review the trial balance", body: "Confirm the ledger balances before close" });
  if (can("settings:manage"))
    out.push({ href: "/settings", icon: Settings2, title: "Manage products and users", body: "Pricing, branches, roles and approval limits" });
  return out.slice(0, 4);
}

export default function DashboardPage() {
  const { data: user } = useSession();
  const { data, isLoading, error, refetch } = useApi<Dashboard>("/reports/dashboard");
  // Clock- and session-dependent text renders after mount so server and client markup match.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const { data: tasks } = useApi<Tasks>("/reports/tasks");
  const firstName = now ? user?.fullName.split(" ")[0] : undefined;
  const efficiency = data?.kpis.collectionEfficiencyPct ? Number(data.kpis.collectionEfficiencyPct) : null;
  const par30 = data ? Number(data.kpis.par30) : 0;
  const actions = user ? nextActions(user, tasks, data) : [];
  const urgent = actions.filter((a) => a.urgent).length;

  return (
    <>
      {/* Welcome band: who you are, what needs you, what to do next. */}
      <section className="relative mb-6 animate-slide-up overflow-hidden rounded-3xl bg-ink-950 p-6 text-white sm:p-8">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -right-24 -top-32 size-96 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/3 size-80 rounded-full bg-copper-500/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <CalendarDays className="size-4" />
              {now ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : " "}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-[34px]">
              {now ? greeting(now) : "Welcome"}
              {firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-slate-300">
              {!now ? (
                <>Loading your workspace…</>
              ) : urgent > 0 ? (
                <>
                  You have <span className="font-semibold text-copper-400">{plural(tasks?.total ?? 0, "item")}</span> waiting for your sign-off. Everything else
                  is moving.
                </>
              ) : (
                <>Nothing is waiting on you right now. Here&apos;s where the book stands and what you can do next.</>
              )}
            </p>
            {data && (
              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <div>
                  <p className="text-slate-400">Active loans</p>
                  <p className="tabular font-display text-xl font-bold">{data.kpis.activeLoans}</p>
                </div>
                <div>
                  <p className="text-slate-400">Portfolio</p>
                  <p className="tabular font-display text-xl font-bold">{kwacha(data.kpis.outstandingPrincipal, { compact: true })}</p>
                </div>
                <div>
                  <p className="text-slate-400">PAR 30</p>
                  <p className={cn("tabular font-display text-xl font-bold", par30 > 10 ? "text-copper-400" : "text-brand-300")}>{pct(data.kpis.par30)}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Your next steps</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {!user || !now
                ? Array.from({ length: 4 }, (_, i) => <li key={i} className="h-[76px] animate-pulse rounded-2xl bg-white/5" />)
                : actions.map((a) => (
                    <li key={a.title}>
                      <Link
                        href={a.href}
                        className={cn(
                          "group flex h-full items-start gap-3 rounded-2xl border p-3.5 transition",
                          a.urgent ? "border-copper-400/30 bg-copper-500/10 hover:bg-copper-500/20" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-xl",
                            a.urgent ? "bg-copper-500 text-white" : "bg-white/10 text-brand-300",
                          )}
                        >
                          <a.icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1 text-sm font-semibold text-white">
                            {a.title}
                            <ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-100" />
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{a.body}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
            </ul>
          </div>
        </div>
      </section>

      {user?.permissions.includes("applications:read") && <NewApplicants />}

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          loading={isLoading}
          icon={PiggyBank}
          label="Outstanding portfolio"
          value={data && kwacha(data.kpis.outstandingPrincipal, { compact: true })}
          sub={data && `${data.kpis.activeLoans} active loans · ${kwacha(data.kpis.totalOutstanding, { compact: true })} incl. interest`}
          href="/loans"
        />
        <StatCard
          loading={isLoading}
          icon={Wallet}
          tone="sky"
          label="Collected this month"
          value={data && kwacha(data.kpis.collectedThisMonth, { compact: true })}
          sub={
            data &&
            (efficiency === null
              ? "Nothing has fallen due yet this month"
              : efficiency > 100
                ? `Ahead of the ${kwacha(data.kpis.dueThisMonth, { compact: true })} due so far, helped by early settlements`
                : `${efficiency.toFixed(0)}% of the ${kwacha(data.kpis.dueThisMonth, { compact: true })} due so far`)
          }
          href="/repayments"
        >
          {efficiency !== null && (
            <div className="mt-3">
              <ProgressBar value={efficiency} tone={efficiency >= 90 ? "brand" : efficiency >= 70 ? "amber" : "rose"} label="Collection efficiency" />
            </div>
          )}
        </StatCard>
        <StatCard
          loading={isLoading}
          icon={HandCoins}
          tone="violet"
          label="Disbursed this month"
          value={data && kwacha(data.kpis.disbursedThisMonth, { compact: true })}
          sub={data && `${plural(data.statusCounts.pending_disbursement ?? 0, "approved loan")} awaiting payout`}
          href="/loans?status=pending_disbursement"
        />
        <StatCard
          loading={isLoading}
          icon={ShieldAlert}
          tone={par30 > 10 ? "rose" : "brand"}
          label="Portfolio at risk · 30 days"
          value={data && pct(data.kpis.par30)}
          sub={data && `PAR 90 ${pct(data.kpis.par90)} · ${plural(data.kpis.loansInArrears, "loan")} in arrears`}
          href="/loans/arrears"
        >
          {data && (
            <p
              className={cn(
                "mt-3 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                par30 > 10 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700",
              )}
            >
              {par30 > 10 ? "Above 10% risk appetite" : "Within 10% risk appetite"}
            </p>
          )}
        </StatCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Disbursements and collections" description="Last six months, by value date" />
          <div className="p-5">
            {data ? (
              <GroupedBarChart
                series={["Disbursed", "Collected"]}
                data={data.trend.map((t) => ({ label: monthLabel(t.month), values: [Number(t.disbursed), Number(t.collected)] }))}
              />
            ) : (
              <Skeleton className="h-64" />
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Portfolio quality"
            description="Outstanding principal by days past due"
            action={
              <Link href="/loans/arrears" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
                Arrears <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="p-5">{data ? <AgeingBar buckets={data.buckets} /> : <Skeleton className="h-56" />}</div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Recent applications"
            description="The latest requests through the credit pipeline"
            action={
              <Link href="/applications" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th className="text-right">Amount</Th>
                <Th className="hidden xl:table-cell">Grade</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-slate-100">
              {data?.recentApplications.map((a) => (
                <tr key={a.id} className="transition hover:bg-slate-50/80">
                  <Td>
                    <Link href={`/applications/${a.id}`} className="flex items-center gap-3">
                      <Avatar name={a.customerName} size="sm" />
                      <span>
                        <span className="block font-medium text-slate-900">{a.customerName}</span>
                        <span className="block text-xs text-slate-500">
                          {a.applicationNumber} · {shortDate(a.submittedAt)}
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="text-right font-semibold text-slate-900">{kwacha(a.amount)}</Td>
                  <Td className="hidden xl:table-cell">
                    <span className="grid size-7 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">{a.grade}</span>
                  </Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                </tr>
              )) ??
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <Td colSpan={4}>
                      <Skeleton className="h-8" />
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </Card>
        <Performance title="Branch performance" rows={data?.branches} className="lg:col-span-2" />
      </div>

      <div className="mt-6">
        <Performance title="Loan officer performance" rows={data?.officers} withAvatar />
      </div>
    </>
  );
}

function Performance({
  title,
  rows,
  className,
  withAvatar,
}: {
  title: string;
  rows?: { id: string; name: string; activeLoans: number; outstandingPrincipal: string; par30: string }[];
  className?: string;
  withAvatar?: boolean;
}) {
  const max = Math.max(1, ...(rows ?? []).map((r) => Number(r.outstandingPrincipal)));
  return (
    <Card className={className}>
      <CardHeader title={title} description="Active book and share more than 30 days late" />
      <ul className="divide-y divide-slate-100">
        {rows?.map((r) => {
          const risky = Number(r.par30) > 10;
          return (
            <li key={r.id} className="flex items-center gap-4 px-5 py-3.5">
              {withAvatar && <Avatar name={r.name} size="sm" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-slate-900">{r.name}</p>
                  <p className="tabular text-sm font-semibold text-slate-900">{kwacha(r.outstandingPrincipal, { compact: true })}</p>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1">
                    <ProgressBar value={(Number(r.outstandingPrincipal) / max) * 100} label={`${r.name} share of book`} />
                  </div>
                  <span className="tabular w-16 text-right text-xs text-slate-500">{plural(r.activeLoans, "loan")}</span>
                  <span
                    className={cn(
                      "tabular w-20 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold",
                      risky ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700",
                    )}
                  >
                    PAR {pct(r.par30)}
                  </span>
                </div>
              </div>
            </li>
          );
        }) ?? (
          <li className="p-5">
            <Skeleton className="h-24" />
          </li>
        )}
      </ul>
    </Card>
  );
}

interface Applicant {
  id: string;
  applicationNumber: string;
  customerName: string;
  amount: string;
  productName: string;
  channel: "branch" | "self_service";
  submittedAt: string;
  grade: string;
}

/** The newest applicants, front and centre: new business should never wait unseen. */
function NewApplicants() {
  const { data } = usePage<Applicant>("/applications?status=submitted&pageSize=4");
  if (!data?.items.length) return null;
  return (
    <section className="mb-6 animate-slide-up rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative grid size-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
            <UserRoundPlus className="size-5" />
            <span className="absolute -right-1 -top-1 flex size-3.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-70" />
              <span className="relative inline-flex size-3.5 rounded-full border-2 border-white bg-brand-500" />
            </span>
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {data.total} new applicant{data.total === 1 ? "" : "s"} waiting
            </h2>
            <p className="text-sm text-slate-600">Review the documents and decide, so clients hear back today.</p>
          </div>
        </div>
        <Link
          href="/applications?status=submitted"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          See all applicants <ArrowRight className="size-4" />
        </Link>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.items.map((a) => (
          <li key={a.id}>
            <Link
              href={`/applications/${a.id}`}
              className="group flex h-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift"
            >
              <Avatar name={a.customerName} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{a.customerName}</span>
                <span className="tabular block text-sm font-bold text-brand-700">{kwacha(a.amount)}</span>
                <span className="block truncate text-xs text-slate-500">
                  {a.productName}
                  {a.channel === "self_service" ? " · online" : ""}
                </span>
              </span>
              <ArrowUpRight className="size-4 text-slate-300 transition group-hover:text-brand-600" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
