"use client";

import { History, RotateCcw, X } from "lucide-react";

function ago(at: number) {
  const mins = Math.round((Date.now() - at) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/** "Picked up where you left off": shown above a form whose draft was restored. */
export function DraftNotice({ at, onDiscard, onDismiss, note }: { at: number; onDiscard: () => void; onDismiss: () => void; note?: string }) {
  return (
    <div className="mb-4 flex animate-rise items-center gap-3 rounded-2xl border border-brand-200/70 bg-brand-50/70 py-2.5 pl-3 pr-2 text-sm text-brand-900" role="status">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-card">
        <History className="size-4" />
      </span>
      <p className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold">Picked up where you left off</span>
        <span className="text-brand-800/80"> · saved {ago(at)}{note ? `. ${note}` : ""}</span>
      </p>
      <button
        type="button"
        onClick={onDiscard}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-brand-800 transition hover:bg-brand-100"
      >
        <RotateCcw className="size-3.5" />
        <span className="max-sm:sr-only">Start over</span>
      </button>
      <button type="button" onClick={onDismiss} aria-label="Hide" className="grid size-8 shrink-0 place-items-center rounded-lg text-brand-700/70 transition hover:bg-brand-100">
        <X className="size-4" />
      </button>
    </div>
  );
}
