import { useId } from "react";
import { cn } from "@/lib/cn";

/** Chilimbitso mark: three rising bars (growth, instalments paid down) with a copper keystone. */
export function LogoMark({ className }: { className?: string }) {
  // Unique per instance: a page may render several marks, some inside display:none.
  // useId may contain ":" or "«»", which break url(#…) references, so keep it to safe characters.
  const gradient = `anz-g${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d3a4" />
          <stop offset="1" stopColor="#04785f" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gradient})`} />
      <rect x="9" y="21" width="5.5" height="10" rx="2" fill="white" fillOpacity="0.7" />
      <rect x="17.25" y="15" width="5.5" height="16" rx="2" fill="white" fillOpacity="0.85" />
      <rect x="25.5" y="9" width="5.5" height="22" rx="2" fill="white" />
      <circle cx="28.25" cy="9" r="3.2" fill="#e0904f" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ className, subtitle, dark }: { className?: string; subtitle?: string | null; dark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="min-w-0">
        <span className={cn("block font-display text-lg font-bold leading-none tracking-tight", dark ? "text-white" : "text-slate-900")}>Chilimbitso</span>
        {subtitle && <span className={cn("mt-1 block truncate text-[11px] leading-none", dark ? "text-slate-400" : "text-slate-500")}>{subtitle}</span>}
      </span>
    </span>
  );
}
