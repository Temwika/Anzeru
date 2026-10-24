"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { api, useApi } from "@/lib/api";

export function BorrowerHeader() {
  const { data } = useApi<{ firstName: string; lastName: string; institution: string }>("/borrower/me");
  async function logout() {
    await api.post("/auth/logout").catch(() => undefined);
    window.location.href = "/login";
  }
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <Link href="/borrower" className="flex items-center gap-2">
          <LogoMark className="size-8" />
          <span className="font-display text-sm font-bold text-slate-900">{data?.institution ?? "My loans"}</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {data && <span className="hidden text-slate-600 sm:inline">{data.firstName} {data.lastName}</span>}
          <button onClick={logout} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
