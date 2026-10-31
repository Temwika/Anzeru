"use client";

import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Feeds pointer position into a `.spotlight` element's --mx / --my so its glow follows the cursor. */
export function trackSpotlight(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

const NUMBER = /-?\d[\d,]*(?:\.\d+)?/;
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));

/**
 * Counts the number inside an already formatted value ("K1.24M", "4.8%", "1,284") up to its target,
 * keeping the prefix, suffix, decimals and thousands separators. Anything without a number renders as is.
 */
export function AnimatedValue({ value, duration = 900 }: { value: React.ReactNode; duration?: number }) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value : null;
  const match = text ? NUMBER.exec(text) : null;
  const target = match ? Number(match[0].replace(/,/g, "")) : null;
  const [shown, setShown] = useState<number | null>(null);
  const from = useRef(0);

  useEffect(() => {
    if (target === null) return;
    if (prefersReducedMotion()) {
      setShown(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      setShown(origin + (target - origin) * easeOutExpo(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
      from.current = target;
    };
  }, [target, duration]);

  if (!text || !match || target === null) return <>{value}</>;
  const decimals = match[0].split(".")[1]?.length ?? 0;
  const grouped = match[0].includes(",");
  const n = (shown ?? 0).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped });
  // Screen readers get the final figure once, not every frame of the count.
  return (
    <span>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {text.slice(0, match.index)}
        {n}
        {text.slice(match.index + match[0].length)}
      </span>
    </span>
  );
}
