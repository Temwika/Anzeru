"use client";

import { AlertOctagon, AlertTriangle, CircleCheck, Clock } from "lucide-react";
import { useState } from "react";
import { kwacha } from "@/lib/format";

/** Categorical slots 1–2 of the validated reference palette (blue, orange). */
const SERIES = ["#2a78d6", "#eb6834"];

export interface TrendPoint {
  label: string;
  values: number[];
}

/** Grouped monthly bars on one shared axis, with a legend and hover tooltip. */
export function GroupedBarChart({ data, series, height = 220 }: { data: TrendPoint[]; series: string[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4">
        {series.map((s, i) => (
          <span key={s} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="size-2.5 rounded-sm" style={{ background: SERIES[i] }} />
            {s}
          </span>
        ))}
      </div>
      <div className="relative flex" style={{ height }}>
        <div className="relative w-12 shrink-0">
          {ticks.map((t) => (
            <span key={t} className="tabular absolute right-2 translate-y-1/2 text-[11px] text-slate-400" style={{ bottom: `${(t / top) * 100}%` }}>
              {kwacha(t, { compact: true }).replace(".00", "")}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end justify-around">
            {data.map((d, i) => (
              <div
                key={d.label}
                className="relative flex h-full flex-1 items-end justify-center gap-[2px] px-1"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {hover === i && <div className="absolute inset-x-1 inset-y-0 rounded-md bg-slate-100/70" />}
                {d.values.map((v, j) => (
                  <div
                    key={j}
                    className="relative w-full max-w-7 rounded-t-[4px] transition-opacity"
                    style={{ height: `${(v / top) * 100}%`, background: SERIES[j], opacity: hover === null || hover === i ? 1 : 0.45 }}
                  />
                ))}
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-48 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
                    <p className="mb-1.5 font-medium text-slate-900">{d.label}</p>
                    {series.map((s, j) => (
                      <p key={s} className="flex items-center justify-between gap-2 text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-sm" style={{ background: SERIES[j] }} />
                          {s}
                        </span>
                        <span className="tabular font-medium text-slate-900">{kwacha(d.values[j])}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-12 flex justify-around border-t border-slate-200 pt-2">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[11px] text-slate-500">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

/** Reserved status palette; each bucket also carries an icon and label, never colour alone. */
const BUCKET_STYLE: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  current: { color: "#0ca30c", label: "Current", icon: CircleCheck },
  "1-30": { color: "#fab219", label: "1–30 days", icon: Clock },
  "31-60": { color: "#ec835a", label: "31–60 days", icon: AlertTriangle },
  "61-90": { color: "#d03b3b", label: "61–90 days", icon: AlertTriangle },
  "90+": { color: "#8f1d1d", label: "90+ days", icon: AlertOctagon },
};

export function AgeingBar({ buckets }: { buckets: { bucket: string; count: number; principal: string }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = buckets.reduce((s, b) => s + Number(b.principal), 0) || 1;
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-slate-100">
        {buckets
          .filter((b) => Number(b.principal) > 0)
          .map((b) => (
            <div
              key={b.bucket}
              onMouseEnter={() => setHover(b.bucket)}
              onMouseLeave={() => setHover(null)}
              className="h-full transition-opacity"
              style={{ width: `${(Number(b.principal) / total) * 100}%`, background: BUCKET_STYLE[b.bucket].color, opacity: hover && hover !== b.bucket ? 0.4 : 1 }}
              title={`${BUCKET_STYLE[b.bucket].label}: ${kwacha(b.principal)}`}
            />
          ))}
      </div>
      <ul className="mt-4 space-y-1">
        {buckets.map((b) => {
          const s = BUCKET_STYLE[b.bucket];
          return (
            <li
              key={b.bucket}
              onMouseEnter={() => setHover(b.bucket)}
              onMouseLeave={() => setHover(null)}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
            >
              <s.icon className="size-4 shrink-0" style={{ color: s.color }} />
              <span className="flex-1 whitespace-nowrap text-slate-700">{s.label}</span>
              <span className="tabular w-16 text-right text-xs text-slate-500">{b.count} loans</span>
              <span className="tabular w-28 text-right font-medium text-slate-900">{kwacha(b.principal)}</span>
              <span className="tabular w-10 text-right text-xs text-slate-500">{((Number(b.principal) / total) * 100).toFixed(0)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
