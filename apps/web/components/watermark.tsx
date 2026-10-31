import { cn } from "@/lib/cn";

/**
 * The Chilimbitso emblem, faint and fixed behind the page, the way a bank's crest sits on its
 * statements. Pinned to the viewport so it stays centred while content scrolls over it; never printed.
 */
export function Watermark({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none fixed inset-0 -z-10 grid select-none place-items-center overflow-hidden print:hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative, one small static asset */}
      <img
        src="/chilimbitso-mark.png"
        alt=""
        width={256}
        height={256}
        className="w-[min(72vw,440px)] opacity-[0.045] saturate-[0.8] dark:opacity-[0.06] dark:saturate-50"
      />
    </div>
  );
}
