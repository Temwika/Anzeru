"use client";

import { inputClass } from "@/components/ui";
import { cn } from "@/lib/cn";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function monthToDate() {
  const now = new Date();
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
}

function presets() {
  const now = new Date();
  const days = (n: number) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  return [
    { label: "Today", from: iso(now), to: iso(now) },
    { label: "Last 7 days", from: days(6), to: iso(now) },
    { label: "This month", ...monthToDate() },
    { label: "Last month", from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) },
    { label: "This year", from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) },
  ];
}

/** Date range for a report: quick presets plus from/to inputs, in one row above the content. */
export function PeriodPicker({ value, onChange }: { value: { from: string; to: string }; onChange: (v: { from: string; to: string }) => void }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <div className="no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-200/50 p-1">
        {presets().map((p) => {
          const on = p.from === value.from && p.to === value.to;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange({ from: p.from, to: p.to })}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition",
                on ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          aria-label="From"
          className={cn(inputClass, "w-auto py-2")}
          value={value.from}
          max={value.to}
          onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
        />
        <span className="text-sm text-slate-400">to</span>
        <input
          type="date"
          aria-label="To"
          className={cn(inputClass, "w-auto py-2")}
          value={value.to}
          min={value.from}
          onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
        />
      </div>
    </div>
  );
}
