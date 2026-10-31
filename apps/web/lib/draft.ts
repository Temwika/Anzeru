"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DefaultValues, FieldValues, UseFormReturn } from "react-hook-form";
import { useHydrated } from "./api";

const PREFIX = "draft:";
/** A draft older than this is someone else's morning, not this officer's interrupted form. */
const MAX_AGE = 12 * 60 * 60 * 1000;

interface Stored<T> {
  at: number;
  values: T;
}

/** Signatures are never carried over: a borrower or guarantor signs the form they actually see. */
function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !/signature/i.test(k)).map(([k, v]) => [k, strip(v)]));
  }
  return value;
}

function read<T>(key: string): Stored<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored<T>;
    if (Date.now() - stored.at > MAX_AGE) {
      localStorage.removeItem(key);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

/** Drops every saved draft on this device; called on sign-out so the next person starts clean. */
export function clearDrafts() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch {
    // Storage blocked: there is nothing to clear.
  }
}

/**
 * Keeps a long form safe across a reload, a dead battery or a wrong tap on the back button: values
 * are saved as the officer types and put back when they return. Files and signatures are not kept.
 */
export function useFormDraft<T extends FieldValues>(name: string, form: UseFormReturn<T>, userId: string | undefined) {
  const key = userId ? `${PREFIX}${userId}:${name}` : null;
  const hydrated = useHydrated();
  // Read once per user, after hydration, so the server and the first client render agree.
  const saved = useMemo(() => (hydrated && key ? read<T>(key) : null), [hydrated, key]);
  const [dismissed, setDismissed] = useState(false);
  const restored = useRef(false);
  // Set once the form is submitted, so a late keystroke or state change cannot re-save it.
  const done = useRef(false);
  const { reset, getValues, subscribe } = form;

  useEffect(() => {
    if (!saved || restored.current) return;
    restored.current = true;
    reset({ ...getValues(), ...saved.values }, { keepDefaultValues: true });
  }, [saved, reset, getValues]);

  useEffect(() => {
    if (!key) return;
    let t: ReturnType<typeof setTimeout>;
    const unsubscribe = subscribe({
      formState: { values: true, isDirty: true },
      callback: ({ values, isDirty }) => {
        clearTimeout(t);
        t = setTimeout(() => {
          try {
            if (isDirty && !done.current) localStorage.setItem(key, JSON.stringify({ at: Date.now(), values: strip(values) }));
          } catch {
            // Full or blocked storage: the form still works, it just won't survive a reload.
          }
        }, 400);
      },
    });
    return () => {
      clearTimeout(t);
      unsubscribe();
    };
  }, [key, subscribe]);

  const remove = () => {
    try {
      if (key) localStorage.removeItem(key);
    } catch {
      // Nothing saved to remove.
    }
  };

  return {
    /** When the restored draft was last edited; null when the form started fresh or the notice was closed. */
    restoredAt: saved && !dismissed ? saved.at : null,
    /** Call after a successful submit. */
    clear: () => {
      done.current = true;
      remove();
    },
    /** Throw the draft away and start over. */
    discard: (defaults?: DefaultValues<T>) => {
      remove();
      setDismissed(true);
      // reset() leaves inputs it isn't given untouched, so name every field: its default, or empty.
      const blank = Object.fromEntries(Object.keys(getValues()).map((k) => [k, ""]));
      reset({ ...blank, ...defaults } as DefaultValues<T>);
    },
    dismiss: () => setDismissed(true),
  };
}
