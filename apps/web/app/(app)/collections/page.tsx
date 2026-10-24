"use client";

import { PartyPopper, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AgeingBar } from "@/components/charts";
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, Table, Tabs, Td, Th } from "@/components/ui";
import { qs, useApi } from "@/lib/api";
import { kwacha, shortDate } from "@/lib/format";

interface Row {
  id: string;
  loanNumber: string;
  customerName: string;
  phone: string;
  branchName: string;
  officerName: string;
  principalOutstanding: string;
  totalOutstanding: string;
  overdueAmount: string;
  overdueInstallments: number;
  daysPastDue: number;
  bucket: string;
  nextDueDate: string | null;
}

interface Dashboard {
  buckets: { bucket: string; count: number; principal: string }[];
}

export default function CollectionsPage() {
  const [bucket, setBucket] = useState("");
  const { data, isLoading, error } = useApi<Row[]>(`/collections/overdue${qs({ bucket })}`);
  const { data: dash } = useApi<Dashboard>("/reports/dashboard");
  const total = data?.reduce((a, r) => a + Number(r.overdueAmount), 0) ?? 0;

  return (
    <>
      <PageHeader title="Collections" description="Loans in arrears, most overdue first. Open a loan to log calls, visits and promises to pay." />
      {dash && (
        <Card className="mb-6">
          <CardHeader title="Portfolio ageing" description="Outstanding principal by days past due" />
          <div className="p-5">
            <AgeingBar buckets={dash.buckets} />
          </div>
        </Card>
      )}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={bucket}
          onChange={setBucket}
          tabs={[
            { value: "", label: "All arrears" },
            { value: "1-30", label: "1–30 days" },
            { value: "31-60", label: "31–60" },
            { value: "61-90", label: "61–90" },
            { value: "90+", label: "90+" },
          ]}
        />
        {data && (
          <p className="tabular text-sm text-slate-600">
            {data.length} loans · <span className="font-semibold text-slate-900">{kwacha(total)}</span> overdue
          </p>
        )}
      </div>
      {error && <ErrorState error={error} />}
      <Card>
        <Table>
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Loan</Th>
              <Th>Contact</Th>
              <Th className="hidden lg:table-cell">Officer</Th>
              <Th className="text-right">Overdue</Th>
              <Th className="text-right">Outstanding</Th>
              <Th className="text-right">Days late</Th>
              <Th>Oldest unpaid</Th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-slate-100">
            {isLoading &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  <Td colSpan={7}>
                    <Skeleton className="h-6" />
                  </Td>
                </tr>
              ))}
            {data?.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`/loans/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {r.loanNumber}
                  </Link>
                  <span className="block text-xs text-slate-500">{r.customerName}</span>
                </Td>
                <Td>
                  <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                    <Phone className="size-3.5" /> {r.phone}
                  </a>
                  <span className="block text-xs text-slate-500">{r.branchName}</span>
                </Td>
                <Td className="hidden lg:table-cell">{r.officerName}</Td>
                <Td className="text-right font-medium text-rose-700">{kwacha(r.overdueAmount)}</Td>
                <Td className="text-right">{kwacha(r.totalOutstanding)}</Td>
                <Td className={`text-right font-semibold ${r.daysPastDue > 30 ? "text-rose-700" : "text-amber-700"}`}>{r.daysPastDue}</Td>
                <Td>
                  {r.overdueInstallments} instalment{r.overdueInstallments > 1 ? "s" : ""}
                  <span className="block text-xs text-slate-500">next {shortDate(r.nextDueDate)}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {data && data.length === 0 && <EmptyState icon={PartyPopper} title="No loans in arrears" body="Every borrower in this view is up to date." />}
      </Card>
    </>
  );
}
