"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

export type ThemeMode = "light" | "dark" | "system";

/**
 * Runs in <head> before first paint so a dark-mode user never sees a white flash. It owns the
 * `dark` class on <html>: it follows the saved choice or the OS setting, keeps tabs in sync, drops
 * to light for printing, and announces every change with a `themechange` event.
 */
export const themeScript = `(function(){
var d=document.documentElement,m=matchMedia('(prefers-color-scheme: dark)');
function pref(){try{return localStorage.getItem('theme')||'system'}catch(e){return 'system'}}
function apply(){var p=pref();d.classList.toggle('dark',p==='dark'||(p!=='light'&&m.matches));dispatchEvent(new Event('themechange'))}
apply();
m.addEventListener('change',apply);
addEventListener('storage',function(e){if(e.key==='theme')apply()});
addEventListener('beforeprint',function(){d.classList.remove('dark')});
addEventListener('afterprint',apply);
window.__applyTheme=apply;
})()`;

declare global {
  interface Window {
    __applyTheme?: () => void;
  }
}

const subscribe = (cb: () => void) => {
  addEventListener("themechange", cb);
  return () => removeEventListener("themechange", cb);
};
const readMode = (): ThemeMode => {
  try {
    const v = localStorage.getItem("theme");
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
};
const readDark = () => document.documentElement.classList.contains("dark");

/** Saves the choice and repaints; with an origin, the new theme wipes in as a circle from that point. */
export function setThemeMode(mode: ThemeMode, origin?: { x: number; y: number }) {
  const commit = () => {
    try {
      if (mode === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", mode);
    } catch {
      // Private mode: the choice lasts for this page only.
      document.documentElement.classList.toggle("dark", mode === "dark");
    }
    window.__applyTheme?.();
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!origin || reduce || !document.startViewTransition) return commit();
  const t = document.startViewTransition(commit);
  t.ready.then(() => {
    const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
      { duration: 600, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  });
}

export function useTheme() {
  const mode = useSyncExternalStore(subscribe, readMode, () => "system" as ThemeMode);
  const dark = useSyncExternalStore(subscribe, readDark, () => false);
  return { mode, dark };
}

const centre = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** One-tap light/dark switch: the sun and moon swap with a turn. */
export function ThemeToggle({ className, onDark }: { className?: string; onDark?: boolean }) {
  const { dark } = useTheme();
  return (
    <button
      type="button"
      onClick={(e) => setThemeMode(dark ? "light" : "dark", centre(e.currentTarget))}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={cn(
        "relative grid size-10 place-items-center overflow-hidden rounded-xl transition active:scale-95",
        onDark ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
        className,
      )}
    >
      <Sun
        className={cn(
          "absolute size-5 transition duration-500 ease-[var(--ease-spring)]",
          dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0",
        )}
      />
      <Moon
        className={cn(
          "absolute size-5 transition duration-500 ease-[var(--ease-spring)]",
          dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100",
        )}
      />
    </button>
  );
}

const MODES: { value: ThemeMode; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

/** Light / Dark / Auto (follow the device), for the account menu. */
export function ThemeSegmented() {
  const { mode } = useTheme();
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-line/70 p-1" role="radiogroup" aria-label="Appearance">
      {MODES.map((m) => {
        const on = mode === m.value;
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={(e) => setThemeMode(m.value, centre(e.currentTarget))}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition",
              on ? "bg-white text-slate-900 shadow-card" : "text-slate-500 hover:text-slate-900",
            )}
          >
            <m.icon className="size-3.5" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
