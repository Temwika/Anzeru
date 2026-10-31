"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

const ToastContext = createContext<(t: Omit<Toast, "id">) => void>(() => undefined);

/** Fire-and-forget feedback for completed actions: `toast({ tone: "success", title: "Payment posted" })`. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((all) => [...all.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === "error" ? 8000 : 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CircleCheck : t.tone === "error" ? CircleAlert : Info;
          const accent = t.tone === "success" ? "bg-emerald-500" : t.tone === "error" ? "bg-rose-500" : "bg-brand-500";
          return (
            <div
              key={t.id}
              className="pointer-events-auto relative flex w-full max-w-sm animate-toast-in items-start gap-3 overflow-hidden rounded-2xl border border-black/5 bg-white/90 p-4 shadow-pop backdrop-blur-xl"
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-xl",
                  t.tone === "success" ? "bg-emerald-50 text-emerald-600" : t.tone === "error" ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-600",
                )}
              >
                <Icon className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                {t.body && <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{t.body}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="rounded-md p-0.5 text-slate-400 hover:text-slate-700" aria-label="Dismiss">
                <X className="size-4" />
              </button>
              <span
                aria-hidden
                className={cn("animate-countdown absolute inset-x-0 bottom-0 h-0.5 opacity-60", accent)}
                style={{ animationDuration: `${t.tone === "error" ? 8000 : 5000}ms` }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
