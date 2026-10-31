"use client";

import { CloudOff, Download, Wifi } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

/* ───────────────────────────── Connection ───────────────────────────── */

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** True on the server and until the browser reports otherwise. */
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/**
 * Field officers lose signal often. Say so plainly while it lasts, so a save that fails is not a
 * mystery, and confirm briefly when the connection returns.
 */
export function ConnectionBanner() {
  const online = useOnline();
  // Remember the state the banner last showed, so the return to online is announced once.
  const [shown, setShown] = useState(online);
  const [back, setBack] = useState(false);
  if (online !== shown) {
    setShown(online);
    setBack(online);
  }
  useEffect(() => {
    if (!back) return;
    const t = setTimeout(() => setBack(false), 3000);
    return () => clearTimeout(t);
  }, [back]);

  if (online && !back) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[65] flex justify-center px-4" role="status" aria-live="polite">
      <div
        className={cn(
          "flex animate-toast-in items-center gap-2.5 rounded-full px-4 py-2 text-[13px] font-medium shadow-pop ring-1",
          online ? "bg-emerald-600 text-white ring-emerald-500/40" : "bg-ink-900 text-white ring-white/10",
        )}
      >
        {online ? <Wifi className="size-4" /> : <CloudOff className="size-4 text-copper-300" />}
        {online ? "Back online" : "You're offline — changes won't save until the connection returns"}
      </div>
    </div>
  );
}

/* ───────────────────────────── Install ───────────────────────────── */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// The browser fires this once, often before React mounts, so it is caught at module load.
let deferred: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const notifyInstall = () => installListeners.forEach((l) => l());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notifyInstall();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notifyInstall();
  });
}
const subscribeInstall = (cb: () => void) => {
  installListeners.add(cb);
  return () => installListeners.delete(cb);
};

/** The browser's install prompt, when this device can install the app and hasn't yet. */
export function useInstallPrompt() {
  const available = useSyncExternalStore(subscribeInstall, () => !!deferred, () => false);
  const install = async () => {
    if (!deferred) return;
    const e = deferred;
    await e.prompt();
    await e.userChoice;
    deferred = null;
    notifyInstall();
  };
  return { available, install };
}

/** A menu row offering to install; renders nothing where installing isn't possible. */
export function InstallAppItem({ onDone }: { onDone?: () => void }) {
  const { available, install } = useInstallPrompt();
  if (!available) return null;
  return (
    <button
      onClick={async () => {
        onDone?.();
        await install();
      }}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
    >
      <Download className="size-4 text-slate-400" />
      Install the app
    </button>
  );
}
