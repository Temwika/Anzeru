"use client";

import { ChevronRight, Landmark } from "lucide-react";
import Link from "next/link";
import { Card, EmptyState, ErrorState, Skeleton, StatusBadge } from "@/components/ui";
import { useApi } from "@/lib/api";
import { kwacha, shortDate } from "@/lib/format";

interface LoanSummary {
  id: string;
  loanNumber: string;
  productName: string;
  principal: string;
  status: string;
  disbursedOn: string | null;
  position: { totalOutstanding: string; nextDueDate: string | null; nextDueAmount: string; daysPastDue: number; overdueAmount: string };
}

export default function BorrowerHome() {
  const { data: me } = useApi<{ firstName: string }>("/borrower/me");
  const { data, error, isLoading } = useApi<LoanSummary[]>("/borrower/loans");
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">{me ? `Hello, ${me.firstName}` : "My loans"}</h1>
      <p className="mt-1 text-sm text-slate-500">Your balances, upcoming payments and receipts.</p>
      <div className="mt-6 space-y-4">
        {error && <ErrorState error={error} />}
        {isLoading && <Skeleton className="h-36" />}
        {data?.length === 0 && (
          <Card>
            <EmptyState icon={Landmark} title="No loans yet" body="When a loan is approved it will appear here." />
          </Card>
        )}
        {data?.map((l) => (
          <Link key={l.id} href={`/borrower/loans/${l.id}`} className="block">
            <Card className="p-5 transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">
                    {l.productName} · {l.loanNumber}
                  </p>
                  <p className="tabular mt-1 text-3xl font-semibold text-slate-900">{l.status === "active" ? kwacha(l.position.totalOutstanding) : kwacha(l.principal)}</p>
                  <p className="text-xs text-slate-500">{l.status === "active" ? "Balance to pay" : "Loan amount"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={l.status} />
                  <ChevronRight className="size-5 text-slate-400" />
                </div>
              </div>
              {l.status === "active" && (
                <div className={`tabular mt-4 rounded-xl px-4 py-3 text-sm ${l.position.daysPastDue ? "bg-rose-50 text-rose-800" : "bg-brand-50 text-brand-900"}`}>
                  {l.position.daysPastDue
                    ? `${kwacha(l.position.overdueAmount)} is overdue. Please pay as soon as possible to avoid further penalties.`
                    : l.position.nextDueDate
                      ? `Next payment ${kwacha(l.position.nextDueAmount)} due ${shortDate(l.position.nextDueDate)}`
                      : "All instalments paid"}
                </div>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
