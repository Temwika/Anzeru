"use client";

import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { AnimatedValue, trackSpotlight } from "./motion";

/* ───────────────────────────── Buttons ───────────────────────────── */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft" | "dark";
const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "sheen bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_1px_0_rgb(255_255_255/0.22)_inset,0_1px_2px_rgb(164_63_12/0.45),0_4px_12px_-4px_rgb(242_107_29/0.5)] hover:brightness-[0.93] hover:shadow-[0_1px_0_rgb(255_255_255/0.22)_inset,0_1px_2px_rgb(164_63_12/0.45),0_10px_24px_-8px_rgb(242_107_29/0.65)] active:brightness-90",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-card hover:border-slate-300 hover:bg-slate-50 hover:shadow-lift active:bg-slate-100",
  ghost: "text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900",
  danger: "sheen bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_4px_12px_-4px_rgb(225_29_72/0.5)] hover:brightness-[0.93]",
  soft: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100 hover:bg-brand-100",
  dark: "sheen bg-ink-900 text-white shadow-[0_1px_0_rgb(255_255_255/0.1)_inset,0_4px_12px_-4px_rgb(28_16_11/0.5)] hover:bg-ink-800",
};
const buttonSizes = { sm: "h-8 px-3 text-xs rounded-lg", md: "h-10 px-4 text-sm rounded-xl", lg: "h-12 px-6 text-[15px] rounded-xl" };

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: keyof typeof buttonSizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,box-shadow,transform,color] duration-200 ease-[var(--ease-out-expo)] outline-none active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-brand-500/25 disabled:pointer-events-none disabled:opacity-55",
        buttonSizes[size],
        buttonStyles[variant],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: {
  href: string;
  "aria-label"?: string;
  variant?: ButtonVariant;
  size?: keyof typeof buttonSizes;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      {...rest}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,box-shadow,transform,color] duration-200 ease-[var(--ease-out-expo)] active:scale-[0.97]",
        buttonSizes[size],
        buttonStyles[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ───────────────────────────── Surfaces ───────────────────────────── */

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line bg-white shadow-card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  back,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 animate-slide-up">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-700">{eyebrow}</p>}
          <h1 className="font-display text-[26px] font-bold leading-tight text-slate-900 sm:text-[28px]">{title}</h1>
          {description && <div className="mt-1.5 text-sm text-slate-500">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ───────────────────────────── Status ───────────────────────────── */

export type Tone = "neutral" | "green" | "amber" | "orange" | "red" | "blue" | "violet";
const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200/80",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
  amber: "bg-amber-50 text-amber-800 ring-amber-200/80",
  orange: "bg-orange-50 text-orange-700 ring-orange-200/80",
  red: "bg-rose-50 text-rose-700 ring-rose-200/80",
  blue: "bg-sky-50 text-sky-700 ring-sky-200/80",
  violet: "bg-violet-50 text-violet-700 ring-violet-200/80",
};
const dots: Record<Tone, string> = {
  neutral: "bg-slate-400",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-rose-500",
  blue: "bg-sky-500",
  violet: "bg-violet-500",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  active: "green",
  closed: "neutral",
  pending_disbursement: "violet",
  written_off: "red",
  submitted: "blue",
  approved: "green",
  rejected: "red",
  cancelled: "neutral",
  verified: "green",
  pending: "amber",
  posted: "green",
  reversed: "red",
  requested: "amber",
  completed: "green",
  paid: "green",
  partial: "amber",
  overdue: "red",
  due: "orange",
  upcoming: "neutral",
  suspended: "red",
};

const STATUS_LABELS: Record<string, string> = {
  pending_disbursement: "Awaiting payout",
  submitted: "Awaiting decision",
  requested: "Awaiting authorisation",
};

export function StatusBadge({ status }: { status: string }) {
  const raw = STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} dot>
      {label}
    </Badge>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-lg bg-[linear-gradient(90deg,var(--color-line)_0%,var(--color-line-soft)_50%,var(--color-line)_100%)] bg-[length:800px_100%]",
        className,
      )}
    />
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="relative grid size-14 place-items-center">
        <span className="absolute inset-[-14px] rounded-full bg-brand-100/50 blur-xl" aria-hidden />
        <span className="relative grid size-14 animate-pop-in place-items-center rounded-2xl bg-gradient-to-b from-brand-50 to-white text-brand-700 shadow-card ring-1 ring-brand-100">
          <Icon className="size-6" />
        </span>
      </span>
      <p className="mt-4 font-display text-base font-semibold text-slate-900">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <span>{msg}</span>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ───────────────────────────── Forms ───────────────────────────── */

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.04)] sm:text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-slate-50 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:focus:ring-rose-500/15";

export function Field({
  label,
  error,
  hint,
  children,
  className,
  required,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs font-medium text-rose-600" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder, wide }: { value: string; onChange: (v: string) => void; placeholder: string; wide?: boolean }) {
  return (
    <div className={cn("relative w-full", !wide && "sm:max-w-xs")}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(inputClass, "pl-10")} />
    </div>
  );
}

/* ───────────────────────────── Data display ───────────────────────────── */

/**
 * On phones each row becomes a card (see .table-cards in globals.css): the first cell is the title
 * and every other cell is a "Label … value" line. Labels come from the header cells, copied onto
 * each body cell as data-label and kept current as rows change. Pass cards={false} to keep a
 * plain horizontally scrolling table.
 */
export function Table({ children, className, cards = true }: { children: React.ReactNode; className?: string; cards?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !cards) return;
    const label = () => {
      const heads = [...el.querySelectorAll("thead th")].map((th) => th.textContent?.trim() ?? "");
      el.querySelectorAll<HTMLTableRowElement>("tbody tr, tfoot tr").forEach((tr) => {
        let col = 0;
        for (const td of tr.cells) {
          const text = td.colSpan > 1 ? "" : (heads[col] ?? "");
          if (td.dataset.label !== text) td.dataset.label = text;
          col += td.colSpan;
        }
      });
    };
    label();
    // Watching child lists only: writing data-label is an attribute change, so this never loops.
    const mo = new MutationObserver(label);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [cards]);
  return (
    <div ref={ref} className={cn("scroll-quiet overflow-x-auto", cards && "table-cards", className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap bg-slate-50/70 px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("whitespace-nowrap px-5 py-3.5 text-slate-700", className)} {...rest}>
      {children}
    </td>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
      <span className="tabular">{total === 0 ? "No records" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="tabular px-2 font-medium text-slate-700">
          {page} / {pages}
        </span>
        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  const list = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  // The white pill glides between tabs instead of jumping.
  useLayoutEffect(() => {
    const measure = () => {
      const el = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (list.current) ro.observe(list.current);
    return () => ro.disconnect();
  }, [value, tabs.length]);
  return (
    <div ref={list} className="no-scrollbar relative inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-line/70 p-1" role="tablist">
      {pill && (
        <span
          aria-hidden
          className="absolute inset-y-1 rounded-lg bg-white shadow-[0_1px_2px_rgb(28_16_11/0.08),0_2px_8px_-2px_rgb(28_16_11/0.08)] transition-[left,width] duration-300 ease-[var(--ease-out-expo)]"
          style={{ left: pill.left, width: pill.width }}
        />
      )}
      {tabs.map((t) => {
        const on = value === t.value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-200",
              on ? "text-slate-900" : "text-slate-600 hover:text-slate-900",
              on && !pill && "bg-white shadow-card",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("tabular rounded-full px-1.5 text-[11px]", on ? "bg-brand-50 text-brand-700" : "bg-slate-200/80 text-slate-500")}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // On touch screens focusing would throw the keyboard over the sheet before it's been read.
    if (matchMedia("(pointer: fine)").matches) panel.current?.querySelector<HTMLElement>("input,select,textarea")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-ink-950/45 backdrop-blur-[6px]" onClick={onClose} />
      <div
        ref={panel}
        className={cn(
          "relative max-h-[92dvh] w-full animate-toast-in overflow-y-auto rounded-t-3xl bg-white shadow-pop ring-1 ring-black/5 sm:rounded-3xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 pb-4 pt-5 backdrop-blur sm:px-6 sm:pt-4">
          <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-200 sm:hidden" aria-hidden />
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pb-5">{children}</div>
      </div>
    </div>
  );
}

export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">{children ?? "—"}</dd>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "border-sky-200/80 bg-sky-50/80 text-sky-900",
    warn: "border-amber-200/80 bg-amber-50/80 text-amber-900",
    error: "border-rose-200/80 bg-rose-50/80 text-rose-800",
    success: "border-emerald-200/80 bg-emerald-50/80 text-emerald-900",
  }[tone];
  return <div className={cn("animate-fade-in rounded-xl border px-4 py-3 text-sm leading-relaxed", styles)}>{children}</div>;
}

/* ───────────────────────────── Journey & identity ───────────────────────────── */

const AVATAR_COLOURS = [
  "bg-brand-100 text-brand-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-copper-100 text-copper-600",
];

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const colour = AVATAR_COLOURS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLOURS.length];
  const dims = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-14 text-lg" }[size];
  return <span className={cn("grid shrink-0 place-items-center rounded-full font-semibold", dims, colour, className)}>{initials}</span>;
}

export interface Step {
  label: string;
  description?: string;
  state: "complete" | "current" | "upcoming" | "failed";
}

/** Horizontal progress tracker for multi-stage journeys (loan lifecycle, wizards). */
export function Stepper({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn("flex w-full items-start", className)}>
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex flex-1 flex-col items-center text-center">
          {i > 0 && (
            <span
              className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2", s.state === "upcoming" ? "bg-slate-200" : "bg-brand-500")}
              aria-hidden
            />
          )}
          <span
            className={cn(
              "relative z-10 grid size-8 place-items-center rounded-full border-2 text-xs font-semibold transition",
              s.state === "complete" && "border-brand-600 bg-brand-600 text-white",
              s.state === "current" && "border-brand-600 bg-white text-brand-700 shadow-[0_0_0_4px_var(--color-brand-100)]",
              s.state === "upcoming" && "border-slate-200 bg-white text-slate-400",
              s.state === "failed" && "border-rose-600 bg-rose-600 text-white",
            )}
          >
            {s.state === "complete" ? <Check className="size-4" /> : s.state === "failed" ? <X className="size-4" /> : i + 1}
          </span>
          <span
            className={cn(
              "mt-2 px-1 text-xs font-semibold",
              s.state === "upcoming" ? "text-slate-400" : s.state === "failed" ? "text-rose-700" : "text-slate-900",
            )}
          >
            {s.label}
          </span>
          {s.description && <span className="mt-0.5 hidden px-1 text-[11px] leading-snug text-slate-500 sm:block">{s.description}</span>}
        </li>
      ))}
    </ol>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "brand",
  loading,
  children,
  href,
}: {
  label: string;
  value?: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ElementType;
  tone?: "brand" | "sky" | "violet" | "rose" | "amber" | "copper";
  loading?: boolean;
  children?: React.ReactNode;
  href?: string;
}) {
  const iconTone = {
    brand: "bg-brand-50 text-brand-700",
    sky: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    copper: "bg-copper-50 text-copper-600",
  }[tone];
  const body = (
    <Card
      onPointerMove={trackSpotlight}
      className={cn(
        "stat-card spotlight group/stat h-full animate-rise overflow-hidden p-4 transition duration-300 ease-[var(--ease-out-expo)] sm:p-5",
        href && "hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium leading-snug text-slate-500 sm:text-[13px]">{label}</p>
        {Icon && (
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-xl sm:size-9 transition duration-300 ease-[var(--ease-spring)] group-hover/stat:-rotate-6 group-hover/stat:scale-110",
              iconTone,
            )}
          >
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>
      {loading || value === undefined ? (
        <Skeleton className="mt-2 h-8 w-32" />
      ) : (
        <div className="tabular mt-1 font-display text-[clamp(1.125rem,5.2vw,1.75rem)] font-bold leading-none tracking-tight text-slate-900 sm:text-[28px]">
          <AnimatedValue value={value} />
        </div>
      )}
      {sub && <div className="mt-2 text-xs leading-relaxed text-slate-500">{sub}</div>}
      {children}
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export function ProgressBar({ value, tone = "brand", label }: { value: number; tone?: "brand" | "amber" | "rose"; label?: string }) {
  const bar = {
    brand: "bg-gradient-to-r from-brand-400 to-brand-600",
    amber: "bg-gradient-to-r from-amber-400 to-amber-500",
    rose: "bg-gradient-to-r from-rose-400 to-rose-600",
  }[tone];
  // Starts empty and fills on mount, so the bar reads as progress rather than a static stripe.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const width = mounted ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-1000 ease-[var(--ease-out-expo)]", bar)} style={{ width: `${width}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-slate-500 shadow-[0_1px_0_rgb(15_23_42/0.06)]">
      {children}
    </kbd>
  );
}
