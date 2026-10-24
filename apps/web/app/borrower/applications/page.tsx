"use client";

import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { ApplicationTracker, applicationHeadline, periods, type BorrowerApplication } from "@/components/borrower-ui";
import { ButtonLink, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { dateTime, kwacha } from "@/lib/format";

const HEADLINE_TONE = {
  blue: "bg-sky-50 text-sky-900",
  green: "bg-emerald-50 text-emerald-900",
  red: "bg-rose-50 text-rose-900",
  neutral: "bg-slate-100 text-slate-700",
};

export default function BorrowerApplicationsPage() {
  const { data, error, isLoading } = useApi<BorrowerApplication[]>("/borrower/applications");
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight text-slate-900">Applications</h1>
          <p className="mt-1 text-sm text-slate-500">Follow each application from submission to payout.</p>
        </div>
        <ButtonLink href="/borrower/apply" size="sm" className="shrink-0">
          New
        </ButtonLink>
      </div>

      {error && <ErrorState error={error} />}
      {isLoading && <Skeleton className="h-48 rounded-2xl" />}
      {data?.length === 0 && (
        <Card>
          <EmptyState
            icon={FileText}
            title="No applications yet"
            body="When you apply for a loan you can follow it here."
            action={<ButtonLink href="/borrower/apply">Apply for a loan</ButtonLink>}
          />
        </Card>
      )}

      {data?.map((a) => {
        const head = applicationHeadline(a);
        return (
          <Card key={a.id} className="overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="tabular text-xs font-medium uppercase tracking-wide text-slate-500">{a.applicationNumber}</p>
                  <p className="mt-1 font-display text-lg font-semibold text-slate-900">
                    {kwacha(a.amount)} · {a.productName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {periods(a.term, a.frequency)}
                    {a.installmentAmount ? ` · about ${kwacha(a.installmentAmount)} per instalment` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-right text-xs text-slate-400">{dateTime(a.submittedAt)}</p>
              </div>
              <div className="mt-5">
                <ApplicationTracker application={a} />
              </div>
            </div>
            <div className={cn("flex items-center justify-between gap-3 px-5 py-3 text-sm", HEADLINE_TONE[head.tone])}>
              <span>{head.text}</span>
              {a.loanId && (a.loanStatus === "active" || a.loanStatus === "closed") && (
                <Link href={`/borrower/loans/${a.loanId}`} className="inline-flex shrink-0 items-center gap-1 font-semibold">
                  View loan <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
