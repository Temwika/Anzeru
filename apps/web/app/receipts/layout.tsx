import { Suspense } from "react";
import { Providers } from "@/components/providers";

export const metadata = { title: "Receipt" };

// Receipts print on their own page, without the staff app's sidebar. The page reads URL data, so it streams in behind Suspense.
// A receipt is paper: it stays light even when the app is in dark mode.
export default function ReceiptLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div data-force-light className="contents">
        <Suspense fallback={<div className="min-h-dvh bg-slate-100" />}>{children}</Suspense>
      </div>
    </Providers>
  );
}
