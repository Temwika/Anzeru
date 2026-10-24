import { Suspense } from "react";
import { BorrowerHeader } from "./header";
import { Providers } from "@/components/providers";
import { Skeleton } from "@/components/ui";

export const metadata = { title: "My loans" };

export default function BorrowerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-dvh bg-slate-50">
        <BorrowerHeader />
        <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
          <Suspense fallback={<Skeleton className="h-64" />}>{children}</Suspense>
        </main>
      </div>
    </Providers>
  );
}
