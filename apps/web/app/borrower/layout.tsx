import { Suspense } from "react";
import { BorrowerHeader, BorrowerTabBar } from "./header";
import { Providers } from "@/components/providers";
import { ConnectionBanner } from "@/components/pwa";
import { Skeleton } from "@/components/ui";

export const metadata = { title: "My loans" };

export default function BorrowerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-dvh bg-slate-50">
        <Suspense fallback={<div className="h-16 border-b border-slate-200 bg-white" />}>
          <BorrowerHeader />
        </Suspense>
        <main className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:pb-16 sm:pt-10">
          <Suspense fallback={<Skeleton className="h-64" />}>{children}</Suspense>
        </main>
        <Suspense>
          <BorrowerTabBar />
        </Suspense>
        <ConnectionBanner />
      </div>
    </Providers>
  );
}
