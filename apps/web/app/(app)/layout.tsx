import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";
import { Skeleton } from "@/components/ui";

// The shell reads the pathname and every page reads URL data, so both stream in behind Suspense.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <Suspense fallback={<div className="min-h-dvh bg-slate-50" />}>
        <AppShell>
          <Suspense fallback={<Skeleton className="h-96" />}>{children}</Suspense>
        </AppShell>
      </Suspense>
    </Providers>
  );
}
