"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "./api";

/** Record pages whose data is a single `useApi(path)` call keyed by the path itself. */
const RECORD = /^\/(loans|customers|applications)\/[0-9a-f-]{36}$/i;

/**
 * Starts loading a record the moment the pointer settles on (or a finger lands on, or the keyboard
 * focuses) a link to it, so the page opens with its data already there instead of a skeleton.
 */
export function useIntentPrefetch() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pathOf = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return null;
      const url = new URL(a.href, location.href);
      return url.origin === location.origin && RECORD.test(url.pathname) ? url.pathname : null;
    };
    const load = (path: string) =>
      queryClient.prefetchQuery({ queryKey: [path], queryFn: () => api.get(path), staleTime: 15_000 }).catch(() => undefined);
    const onHover = (e: Event) => {
      const path = pathOf(e);
      clearTimeout(timer);
      // A short pause so sweeping the mouse down a long table doesn't fetch every row.
      if (path) timer = setTimeout(() => load(path), 70);
    };
    const onNow = (e: Event) => {
      const path = pathOf(e);
      if (path) load(path);
    };
    document.addEventListener("pointerover", onHover, { passive: true });
    document.addEventListener("touchstart", onNow, { passive: true });
    document.addEventListener("focusin", onNow);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", onHover);
      document.removeEventListener("touchstart", onNow);
      document.removeEventListener("focusin", onNow);
    };
  }, [queryClient]);
}
