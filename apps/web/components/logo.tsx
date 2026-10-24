import { cn } from "@/lib/cn";

/** Chilimbitso emblem (three people above a handshake in an orange ring), cut from the company logo. */
export function LogoMark({ className }: { className?: string }) {
  // A small static asset: next/image would add a loader for no benefit.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/chilimbitso-mark.png" alt="" aria-hidden width={256} height={256} className={cn("size-9 shrink-0 rounded-full", className)} />;
}

/**
 * The full lock-up: emblem with "CHILIMBITSO LOANS" and, optionally, the tagline.
 * `subtitle` replaces the tagline line (e.g. the institution in the staff app).
 */
export function Logo({
  className,
  subtitle,
  tagline,
  dark,
  size = "md",
}: {
  className?: string;
  subtitle?: string | null;
  tagline?: boolean;
  dark?: boolean;
  size?: "md" | "lg";
}) {
  const lg = size === "lg";
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <LogoMark className={lg ? "size-14" : "size-10"} />
      <span className="min-w-0">
        <span
          className={cn(
            "block font-display font-extrabold uppercase leading-none tracking-tight",
            lg ? "text-[22px]" : "text-[17px]",
            dark ? "text-white" : "text-[#2b130b]",
          )}
        >
          Chilimbitso
        </span>
        <span
          className={cn(
            "mt-0.5 block font-display font-bold uppercase leading-none tracking-[0.18em]",
            lg ? "text-[13px]" : "text-[11px]",
            dark ? "text-brand-300" : "text-brand-600",
          )}
        >
          Loans
        </span>
        {(subtitle || tagline) && (
          <span className={cn("mt-1 block truncate leading-none", lg ? "text-[13px]" : "text-[11px]", dark ? "text-slate-400" : "text-slate-500")}>
            {subtitle ?? "Together, We Grow"}
          </span>
        )}
      </span>
    </span>
  );
}
