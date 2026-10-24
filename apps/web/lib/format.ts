const nf = new Intl.NumberFormat("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en-ZM", { maximumFractionDigits: 0 });

/** Formats a decimal string as Kwacha, e.g. "12500.5" -> "K12,500.50". Display only. */
export function kwacha(value: string | number | null | undefined, opts: { compact?: boolean } = {}): string {
  const n = Number(value ?? 0);
  if (opts.compact) {
    if (Math.abs(n) >= 1_000_000) return `K${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 10_000) return `K${nf0.format(n / 1000)}K`;
  }
  return `${n < 0 ? "-" : ""}K${nf.format(Math.abs(n))}`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function pct(value: string | number | null | undefined): string {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const label = (s: string | null | undefined) => (s ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—");
