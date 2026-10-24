"use client";

import { ROLE_LABELS, type Permission, type SessionUser } from "@anzelu/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BookOpenCheck,
  Building2,
  ChartNoAxesCombined,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  HandCoins,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Siren,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { api, useApi, useSession } from "@/lib/api";
import { CommandPalette, type PaletteLink } from "./command-palette";
import { Logo } from "./logo";
import { Avatar, Kbd, Skeleton } from "./ui";

interface Tasks {
  applications: number;
  disbursements: number;
  reversals: number;
  kyc: number;
  total: number;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: Permission;
  /** Shown when the user holds any of these permissions (overrides `permission`). */
  anyOf?: Permission[];
  badge?: (t: Tasks) => number;
}

const APPROVER: Permission[] = ["applications:decide", "disbursements:authorise", "payments:reverse:approve"];

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { href: "/dashboard", label: "Home", icon: LayoutDashboard, permission: "loans:read" },
      { href: "/approvals", label: "Approvals", icon: CheckCheck, anyOf: APPROVER, badge: (t) => t.applications + t.disbursements + t.reversals },
    ],
  },
  {
    section: "Lending",
    items: [
      { href: "/customers", label: "Customers", icon: Users, permission: "customers:read", badge: (t) => t.kyc },
      { href: "/applications", label: "Applications", icon: BookOpenCheck, permission: "applications:read" },
      { href: "/loans", label: "Loans", icon: HandCoins, permission: "loans:read" },
      { href: "/repayments", label: "Repayments", icon: ReceiptText, permission: "payments:read" },
      { href: "/collections", label: "Collections", icon: Siren, permission: "collections:read" },
    ],
  },
  {
    section: "Finance",
    items: [
      { href: "/accounting", label: "Accounting", icon: Landmark, permission: "accounting:read" },
      { href: "/reports", label: "Reports", icon: ChartNoAxesCombined, permission: "reports:read" },
    ],
  },
  {
    section: "Administration",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, anyOf: ["settings:manage", "jobs:run"] },
      { href: "/audit", label: "Audit trail", icon: ScrollText, permission: "audit:read" },
      { href: "/admin/tenants", label: "Institutions", icon: Building2, permission: "tenants:manage" },
    ],
  },
];

const PAGES: PaletteLink[] = NAV.flatMap((s) => s.items.map((i) => ({ href: i.href, label: i.label, icon: i.icon, permission: i.anyOf ? undefined : i.permission })));

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Home",
  admin: "Platform",
  tenants: "Institutions",
  new: "New",
  audit: "Audit trail",
};

const visible = (i: NavItem, user?: SessionUser) => {
  if (!user) return false;
  if (i.anyOf) return i.anyOf.some((p) => user.permissions.includes(p));
  return !i.permission || user.permissions.includes(i.permission);
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const { data: tasks } = useApi<Tasks>(user && user.role !== "platform_admin" ? "/reports/tasks" : null, { refetchInterval: 60_000 });

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (user?.role === "borrower") router.replace("/borrower");
  }, [user, router]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        setPalette(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const sections = NAV.map((s) => ({ ...s, items: s.items.filter((i) => visible(i, user)) })).filter((s) => s.items.length);

  async function logout() {
    await api.post("/auth/logout").catch(() => undefined);
    queryClient.clear();
    router.replace("/login");
  }

  const nav = (
    <nav className="scroll-quiet flex-1 space-y-7 overflow-y-auto px-3 py-5">
      {isLoading
        ? Array.from({ length: 7 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-white/5" />)
        : sections.map((s) => (
            <div key={s.section}>
              <p className="px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">{s.section}</p>
              <ul className="mt-2 space-y-0.5">
                {s.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const count = tasks && item.badge ? item.badge(tasks) : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition",
                          active ? "bg-white/[0.08] font-medium text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
                        )}
                      >
                        {active && <span className="absolute inset-y-1.5 -left-3 w-1 rounded-r-full bg-brand-400" />}
                        <item.icon className={cn("size-[18px]", active ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300")} />
                        <span className="flex-1">{item.label}</span>
                        {count > 0 && <span className="tabular rounded-full bg-copper-500 px-1.5 py-px text-[11px] font-semibold text-white">{count}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
    </nav>
  );

  const sidebar = (
    <>
      <div className="flex h-16 items-center px-5">
        <Link href={user?.role === "platform_admin" ? "/admin/tenants" : "/dashboard"}>
          <Logo dark subtitle={user ? (user.tenantName ?? "Platform console") : " "} />
        </Link>
      </div>
      {nav}
      <div className="m-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs text-slate-400">
        <p className="flex items-center gap-2 font-medium text-slate-200">
          <ShieldCheck className="size-4 text-brand-400" /> Secure session
        </p>
        <p className="mt-1 leading-relaxed">
          Press <span className="rounded bg-white/10 px-1 py-px text-slate-200">Ctrl K</span> to find any customer or loan.
        </p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink-950 lg:flex">{sidebar}</aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-ink-950/60" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 animate-slide-in-left flex-col bg-ink-950">
            <button onClick={() => setDrawer(false)} className="absolute right-3 top-4 rounded-md p-1.5 text-slate-400 hover:text-white" aria-label="Close menu">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button onClick={() => setDrawer(true)} className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <Breadcrumbs pathname={pathname} />
            <div className="flex-1" />
            <button
              onClick={() => setPalette(true)}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-white md:w-72"
              aria-label="Search"
            >
              <Search className="size-4" />
              <span className="hidden flex-1 text-left md:block">Search customers, loans…</span>
              <span className="hidden md:block">
                <Kbd>Ctrl K</Kbd>
              </span>
            </button>
            {user && <QuickCreate user={user} />}
            {user && user.role !== "platform_admin" && <Inbox tasks={tasks} user={user} />}
            {user ? <UserMenu user={user} onLogout={logout} /> : <Skeleton className="size-9 rounded-full" />}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      {user && <CommandPalette open={palette} onClose={() => setPalette(false)} user={user} pages={PAGES} />}
    </div>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((p, i) => ({
    href: `/${parts.slice(0, i + 1).join("/")}`,
    label: /^[0-9a-f-]{36}$/i.test(p) ? "Details" : (SEGMENT_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1)),
  }));
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-slate-300" />}
          {i === crumbs.length - 1 || c.href === "/admin" ? (
            <span className={cn("truncate", i === crumbs.length - 1 ? "font-medium text-slate-900" : "text-slate-500")}>{c.label}</span>
          ) : (
            <Link href={c.href} className="truncate text-slate-500 transition hover:text-slate-900">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Click-outside / Escape aware popover used by the top-bar menus. */
function Popover({ trigger, children, align = "right", label }: { trigger: (open: boolean) => React.ReactNode; children: (close: () => void) => React.ReactNode; align?: "right" | "left"; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={label} className="block">
        {trigger(open)}
      </button>
      {open && (
        <div role="menu" className={cn("absolute top-12 z-30 w-72 animate-pop-in overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-pop", align === "right" ? "right-0" : "left-0")}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon: Icon, title, body, onClick, count }: { href: string; icon: React.ElementType; title: string; body?: string; onClick: () => void; count?: number }) {
  return (
    <Link href={href} onClick={onClick} role="menuitem" className="flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        {body && <span className="block text-xs leading-relaxed text-slate-500">{body}</span>}
      </span>
      {count !== undefined && <span className="tabular mt-1 rounded-full bg-copper-500 px-2 py-px text-xs font-semibold text-white">{count}</span>}
    </Link>
  );
}

function QuickCreate({ user }: { user: SessionUser }) {
  const canCustomer = user.permissions.includes("customers:write");
  const canApp = user.permissions.includes("applications:write");
  if (!canCustomer && !canApp) return null;
  return (
    <Popover
      label="Create new"
      trigger={(open) => (
        <span className={cn("inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700", open && "bg-brand-700")}>
          <Plus className="size-4" />
          <span className="hidden sm:inline">New</span>
          <ChevronDown className="hidden size-3.5 opacity-70 sm:block" />
        </span>
      )}
    >
      {(close) => (
        <div className="py-2">
          {canCustomer && <MenuLink href="/customers/new" icon={UserPlus} title="New customer" body="Register identity, contact and income, with consent" onClick={close} />}
          {canApp && <MenuLink href="/applications/new" icon={BookOpenCheck} title="New loan application" body="Pick a customer and product; we check affordability" onClick={close} />}
        </div>
      )}
    </Popover>
  );
}

function Inbox({ tasks, user }: { tasks?: Tasks; user: SessionUser }) {
  const rows = [
    { key: "applications", href: "/approvals", icon: BookOpenCheck, title: "Credit applications", body: "Waiting for your decision", count: tasks?.applications ?? 0 },
    { key: "disbursements", href: "/approvals", icon: HandCoins, title: "Payouts", body: "Waiting for your authorisation", count: tasks?.disbursements ?? 0 },
    { key: "reversals", href: "/approvals", icon: ReceiptText, title: "Payment reversals", body: "Waiting for your approval", count: tasks?.reversals ?? 0 },
    { key: "kyc", href: "/customers?kyc=pending", icon: ShieldCheck, title: "KYC reviews", body: "Customers waiting for verification", count: tasks?.kyc ?? 0 },
  ].filter((r) => r.count > 0);
  return (
    <Popover
      label="Notifications"
      trigger={() => (
        <span className="relative grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
          <Bell className="size-5" />
          {!!tasks?.total && (
            <span className="tabular absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-copper-500 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">{tasks.total}</span>
          )}
        </span>
      )}
    >
      {(close) => (
        <>
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Waiting for you</p>
            <p className="text-xs text-slate-500">Items your role ({ROLE_LABELS[user.role].toLowerCase()}) can act on</p>
          </div>
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CheckCheck className="mx-auto size-6 text-brand-600" />
              <p className="mt-2 text-sm font-medium text-slate-900">You&apos;re all caught up</p>
              <p className="text-xs text-slate-500">New work appears here as colleagues submit it.</p>
            </div>
          ) : (
            <div className="py-1">
              {rows.map((r) => (
                <MenuLink key={r.key} href={r.href} icon={r.icon} title={r.title} body={r.body} count={r.count} onClick={close} />
              ))}
            </div>
          )}
        </>
      )}
    </Popover>
  );
}

function UserMenu({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  return (
    <Popover label="Account" trigger={() => <Avatar name={user.fullName} className="ring-2 ring-white transition hover:ring-brand-100" />}>
      {(close) => (
        <>
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
            <Avatar name={user.fullName} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{user.fullName}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
              <p className="mt-1 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
          <div className="py-1">
            <Link href="/settings" onClick={close} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <KeyRound className="size-4 text-slate-400" />
              Security &amp; two-factor
              {!user.mfaEnabled && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Off</span>}
            </Link>
            <button onClick={onLogout} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <LogOut className="size-4 text-slate-400" />
              Sign out
            </button>
          </div>
        </>
      )}
    </Popover>
  );
}
