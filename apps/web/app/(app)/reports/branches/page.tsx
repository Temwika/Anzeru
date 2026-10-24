"use client";

import { Building } from "lucide-react";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, Table, Td, Th } from "@/components/ui";
import { useApi } from "@/lib/api";
import { kwacha, pct } from "@/lib/format";

interface Group {
  id: string;
  name: string;
  activeLoans: number;
  outstandingPrincipal: string;
  par30: string;
}

export default function BranchReportPage() {
  const { data, error } = useApi<{ branches: Group[] }>("/reports/dashboard");
  const branches = data?.branches ?? [];
  const total = branches.reduce((s, b) => s + Number(b.outstandingPrincipal), 0) || 1;

  return (
    <>
      <PageHeader title="By Branch" description="Each branch’s share of the loan book and how much of it is late." />
      {error && <ErrorState error={error} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && !branches.length && (
        <Card>
          <EmptyState icon={Building} title="No branch activity yet" />
        </Card>
      )}
      {!!branches.length && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            {branches.map((b) => (
              <Card key={b.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-base font-semibold text-slate-900">{b.name}</p>
                  <Badge tone={Number(b.par30) > 10 ? "red" : Number(b.par30) > 5 ? "amber" : "green"}>PAR 30 {pct(b.par30)}</Badge>
                </div>
                <p className="tabular mt-3 font-display text-[26px] font-bold leading-none text-slate-900">{kwacha(b.outstandingPrincipal)}</p>
                <p className="mt-1 text-xs text-slate-500">{b.activeLoans} active loans</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${(Number(b.outstandingPrincipal) / total) * 100}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{((Number(b.outstandingPrincipal) / total) * 100).toFixed(0)}% of the book</p>
              </Card>
            ))}
          </div>
          <Card>
            <Table>
              <thead>
                <tr className="border-b border-slate-100">
                  <Th>Branch</Th>
                  <Th className="text-right">Active loans</Th>
                  <Th className="text-right">Outstanding principal</Th>
                  <Th className="text-right">Share</Th>
                  <Th className="text-right">PAR 30</Th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-slate-100">
                {branches.map((b) => (
                  <tr key={b.id}>
                    <Td className="font-medium text-slate-900">{b.name}</Td>
                    <Td className="text-right">{b.activeLoans}</Td>
                    <Td className="text-right">{kwacha(b.outstandingPrincipal)}</Td>
                    <Td className="text-right">{pct((Number(b.outstandingPrincipal) / total) * 100)}</Td>
                    <Td className={`text-right ${Number(b.par30) > 10 ? "font-semibold text-rose-700" : ""}`}>{pct(b.par30)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
