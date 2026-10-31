"use client";

import type { Permission, SessionUser } from "@anzelu/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { setThemeMode } from "./theme";
import { Kbd, Modal } from "./ui";

interface Shortcut {
  keys: string[];
  label: string;
  href?: string;
  permission?: Permission;
}

/** Two-key sequences in the style of Gmail and GitHub: press G, then the destination. */
const GO: Shortcut[] = [
  { keys: ["g", "d"], label: "Dashboard", href: "/dashboard", permission: "loans:read" },
  { keys: ["g", "l"], label: "Loans", href: "/loans", permission: "loans:read" },
  { keys: ["g", "t"], label: "Due today", href: "/loans/due-today", permission: "loans:read" },
  { keys: ["g", "a"], label: "Arrears", href: "/loans/arrears", permission: "loans:read" },
  { keys: ["g", "p"], label: "New applicants", href: "/applications", permission: "applications:read" },
  { keys: ["g", "b"], label: "Borrowers", href: "/customers", permission: "customers:read" },
  { keys: ["g", "r"], label: "Repayments", href: "/repayments", permission: "payments:read" },
  { keys: ["g", "o"], label: "Reports", href: "/reports", permission: "reports:read" },
];
const CREATE: Shortcut[] = [
  { keys: ["n", "l"], label: "New loan application", href: "/applications/new", permission: "applications:write" },
  { keys: ["n", "b"], label: "New borrower", href: "/customers/new", permission: "customers:write" },
];
const GENERAL: Shortcut[] = [
  { keys: ["Ctrl", "K"], label: "Search everything" },
  { keys: ["/"], label: "Search everything" },
  { keys: ["Shift", "D"], label: "Switch light / dark" },
  { keys: ["?"], label: "Show these shortcuts" },
];

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement);

/** Keyboard navigation for the staff app. Ignored while typing, and while a dialog is open. */
export function useShortcuts(user: SessionUser | undefined, { onHelp }: { onHelp: () => void }) {
  const router = useRouter();
  const prefix = useRef<{ key: string; at: number } | null>(null);
  useEffect(() => {
    if (!user) return;
    const can = (s: Shortcut) => !s.permission || user.permissions.includes(s.permission);
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "?") {
        e.preventDefault();
        onHelp();
        return;
      }
      if (e.key === "D" && e.shiftKey) {
        e.preventDefault();
        setThemeMode(document.documentElement.classList.contains("dark") ? "light" : "dark", { x: innerWidth / 2, y: innerHeight / 2 });
        return;
      }
      const key = e.key.toLowerCase();
      const first = prefix.current && Date.now() - prefix.current.at < 1200 ? prefix.current.key : null;
      if (first) {
        prefix.current = null;
        const hit = [...GO, ...CREATE].find((s) => s.keys[0] === first && s.keys[1] === key);
        if (hit?.href && can(hit)) {
          e.preventDefault();
          router.push(hit.href);
        }
        return;
      }
      if (key === "g" || key === "n") prefix.current = { key, at: Date.now() };
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [user, router, onHelp]);
}

export function ShortcutsHelp({ open, onClose, user }: { open: boolean; onClose: () => void; user: SessionUser }) {
  const can = (s: Shortcut) => !s.permission || user.permissions.includes(s.permission);
  const groups = [
    { title: "Go to", items: GO.filter(can) },
    { title: "Create", items: CREATE.filter(can) },
    { title: "General", items: GENERAL },
  ].filter((g) => g.items.length);
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" description="Move around without reaching for the mouse." wide>
      <div className="grid gap-6 sm:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} className={g.title === "Go to" ? "sm:row-span-2" : undefined}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</h3>
            <ul className="divide-y divide-slate-100">
              {g.items.map((s) => (
                <li key={s.label + s.keys.join()} className="flex items-center justify-between gap-4 py-2 text-sm text-slate-700">
                  {s.label}
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
                    {s.keys.map((k, i) => (
                      <span key={k} className="flex items-center gap-1">
                        {i > 0 && (s.keys[0] === "g" || s.keys[0] === "n" ? "then" : "+")}
                        <Kbd>{k.length === 1 ? k.toUpperCase() : k}</Kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
