"use client";

import { FileText, House, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/cn";
import { api, useApi } from "@/lib/api";

const NAV = [
  { href: "/borrower", label: "Home", icon: House, exact: true },
  { href: "/borrower/apply", label: "Apply", icon: Plus },
  { href: "/borrower/applications", label: "Applications", icon: FileText },
];

function useActive() {
  const pathname = usePathname();
  return (n: (typeof NAV)[number]) => (n.exact ? pathname === n.href || pathname.startsWith("/borrower/loans") : pathname.startsWith(n.href));
}

/** A full page load on sign-out drops every cached query along with the session. */
async function logout() {
  await api.post("/auth/logout").catch(() => undefined);
  window.location.href = "/login"; // eslint-disable-line @next/next/no-location-assign-relative-destination
}

export function BorrowerHeader() {
  const { data } = useApi<{ firstName: string; lastName: string; institution: string }>("/borrower/me");
  const active = useActive();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4">
        <Link href="/borrower" className="flex min-w-0 items-center gap-2.5">
          <LogoMark className="size-8" />
          <span className="truncate font-display text-sm font-bold text-slate-900">{data?.institution ?? "My loans"}</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                active(n) ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {data && <Avatar name={`${data.firstName} ${data.lastName}`} size="sm" />}
          <button
            onClick={logout}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/** Thumb-reach navigation on phones. */
export function BorrowerTabBar() {
  const active = useActive();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      aria-label="Main"
    >
      <div className="grid grid-cols-3">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active(n) ? "text-brand-700" : "text-slate-500")}
          >
            {n.label === "Apply" ? (
              <span className={cn("grid size-7 place-items-center rounded-full", active(n) ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700")}>
                <n.icon className="size-4" />
              </span>
            ) : (
              <n.icon className="size-6" />
            )}
            {n.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
