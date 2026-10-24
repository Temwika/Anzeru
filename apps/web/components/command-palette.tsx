"use client";

import type { Permission, SessionUser } from "@anzelu/contracts";
import { ArrowRight, BookOpenCheck, CornerDownLeft, HandCoins, Loader2, Plus, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, qs } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kwacha } from "@/lib/format";
import { Kbd, StatusBadge } from "./ui";

export interface PaletteLink {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: Permission;
  keywords?: string;
}

interface Item {
  key: string;
  group: string;
  label: string;
  sub?: string;
  href: string;
  icon: React.ElementType;
  status?: string;
}

const CREATE: PaletteLink[] = [
  { href: "/customers/new", label: "Register a new customer", icon: Plus, permission: "customers:write", keywords: "onboard kyc add" },
  { href: "/applications/new", label: "Start a loan application", icon: Plus, permission: "applications:write", keywords: "apply credit new loan" },
];

/** ⌘K / Ctrl+K: jump to any customer, loan or application, page, or common action. */
export function CommandPalette({ open, onClose, user, pages }: { open: boolean; onClose: () => void; user: SessionUser; pages: PaletteLink[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [records, setRecords] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const can = (p?: Permission) => !p || user.permissions.includes(p);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setRecords([]);
    setActive(0);
    setTimeout(() => input.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRecords([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const search = qs({ search: term, pageSize: 5 });
      const [customers, loans, apps] = await Promise.all([
        can("customers:read") ? api.page<{ id: string; firstName: string; lastName: string; customerNumber: string; phone: string; kycStatus: string }>(`/customers${search}`).catch(() => null) : null,
        can("loans:read") ? api.page<{ id: string; loanNumber: string; customerName: string; status: string; principal: string }>(`/loans${search}`).catch(() => null) : null,
        can("applications:read") ? api.page<{ id: string; applicationNumber: string; customerName: string; status: string; amount: string }>(`/applications${search}`).catch(() => null) : null,
      ]);
      if (cancelled) return;
      setRecords([
        ...(customers?.items ?? []).map((c) => ({
          key: `c${c.id}`,
          group: "Borrowers",
          label: `${c.firstName} ${c.lastName}`,
          sub: `${c.customerNumber} · ${c.phone}`,
          href: `/customers/${c.id}`,
          icon: UserRound,
          status: c.kycStatus,
        })),
        ...(loans?.items ?? []).map((l) => ({
          key: `l${l.id}`,
          group: "Loans",
          label: l.loanNumber,
          sub: `${l.customerName} · ${kwacha(l.principal)}`,
          href: `/loans/${l.id}`,
          icon: HandCoins,
          status: l.status,
        })),
        ...(apps?.items ?? []).map((a) => ({
          key: `a${a.id}`,
          group: "Applications",
          label: a.applicationNumber,
          sub: `${a.customerName} · ${kwacha(a.amount)}`,
          href: `/applications/${a.id}`,
          icon: BookOpenCheck,
          status: a.status,
        })),
      ]);
      setLoading(false);
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const items = useMemo((): Item[] => {
    const term = q.trim().toLowerCase();
    const match = (l: PaletteLink) => !term || `${l.label} ${l.keywords ?? ""}`.toLowerCase().includes(term);
    const actions = CREATE.filter((l) => can(l.permission) && match(l)).map((l) => ({ key: l.href, group: "Actions", label: l.label, href: l.href, icon: l.icon }));
    const nav = pages.filter((l) => can(l.permission) && match(l)).map((l) => ({ key: l.href, group: "Go to", label: l.label, href: l.href, icon: l.icon }));
    return [...records, ...actions, ...nav.slice(0, term ? 6 : 8)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, records, pages]);

  useEffect(() => setActive(0), [items.length]);

  if (!open) return null;

  const go = (i: Item | undefined) => {
    if (!i) return;
    onClose();
    router.push(i.href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Escape") onClose();
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-2xl bg-white shadow-pop ring-1 ring-slate-200">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          {loading ? <Loader2 className="size-5 animate-spin text-slate-400" /> : <Search className="size-5 text-slate-400" />}
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search customers, NRC, phone, loan or application number…"
            className="h-14 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
            aria-label="Search"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul className="scroll-quiet max-h-[52vh] overflow-y-auto p-2" role="listbox">
          {items.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-slate-500">{q.trim().length < 2 ? "Type at least two characters to search records." : loading ? "Searching…" : `No results for “${q}”.`}</li>
          )}
          {items.map((i, idx) => {
            const header = i.group !== lastGroup ? i.group : null;
            lastGroup = i.group;
            return (
              <li key={i.key}>
                {header && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{header}</p>}
                <button
                  role="option"
                  aria-selected={idx === active}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => go(i)}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition", idx === active ? "bg-brand-50" : "")}
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", idx === active ? "bg-white text-brand-700 shadow-card" : "bg-slate-100 text-slate-500")}>
                    <i.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{i.label}</span>
                    {i.sub && <span className="block truncate text-xs text-slate-500">{i.sub}</span>}
                  </span>
                  {i.status && <StatusBadge status={i.status} />}
                  {idx === active && <ArrowRight className="size-4 text-brand-600" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>
              <CornerDownLeft className="inline size-3" />
            </Kbd>{" "}
            open
          </span>
        </div>
      </div>
    </div>
  );
}
