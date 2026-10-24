"use client";

import type { QuoteInput } from "@anzelu/contracts";
import type { Schedule } from "@anzelu/finance";
import { useEffect, useState } from "react";

/**
 * Live repayment quote from the shared finance engine (via /api/quote), debounced
 * so sliders stay smooth. `null` input clears the quote.
 */
export function useQuote(input: QuoteInput | null, delayMs = 200) {
  const [quote, setQuote] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = input ? JSON.stringify(input) : null;

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body: key, signal: ctrl.signal });
        const json = await res.json();
        if (res.ok) {
          setQuote(json.data);
          setError(null);
        } else {
          setError(json.error?.details?.[0]?.message ?? json.error?.message ?? "Unable to calculate");
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Network error — try again");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, delayMs);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [key, delayMs]);

  return key ? { quote, error, loading } : { quote: null, error: null, loading: false };
}
