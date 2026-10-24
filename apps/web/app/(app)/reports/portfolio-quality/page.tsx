"use client";

import { Gauge, Package, Siren, Wallet } from "lucide-react";
import { AgeingBar } from "@/components/charts";
import { Badge, Card, CardHeader, ErrorState, PageHeader, Skeleton, StatCard, Table, Td, Th } from "@/components/ui";
import { useApi } from "@/lib/api";
import { kwacha, pct, shortDate } from "@/lib/format";

interface Quality {
  asOf: string;
  loans: number;
  principalOutstanding: string;
  totalOutstanding: string;
  par: { par1: string; par30: string; par60: string; par90: string };
  buckets: { bucket: string; loans: number; principalOutstanding: string; sharePct: string }[];
  byProduct: { productName: string; loans: number; principalOutstanding: string; par30: string }[];
}

const tone = (v: string) => (Number(v) > 10 ? "red" : Number(v) > 5 ? "amber" : "green");

export default function PortfolioQualityPage() {
  const { data: q, error } = useApi<Quality>("/reports/portfolio-quality");

  return (
    <>
      <PageHeader
        title="Portfolio Quality"
        description={q ? `How healthy the loan book is, as of ${shortDate(q.asOf)}. PAR is the share of principal on loans that are late.` : undefined}
      />
      {error && <ErrorState error={error} />}
      {!q && !error && <Skeleton className="h-96" />}
      {q && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Loan book"
              value={kwacha(q.principalOutstanding)}
              sub={`${q.loans} active loans · ${kwacha(q.totalOutstanding)} incl. interest`}
              icon={Wallet}
            />
            <StatCard label="PAR 1" value={pct(q.par.par1)} sub="Any payment late" icon={Gauge} tone="amber" />
            <StatCard label="PAR 30" value={pct(q.par.par30)} sub="More than 30 days late" icon={Siren} tone="rose" />
            <StatCard label="PAR 90" value={pct(q.par.par90)} sub={`PAR 60: ${pct(q.par.par60)}`} icon={Siren} tone="rose" />
          </div>
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader title="Ageing of principal" description="Days the oldest unpaid instalment is late" />
              <div className="p-5">
                <AgeingBar buckets={q.buckets.map((b) => ({ bucket: b.bucket, count: b.loans, principal: b.principalOutstanding }))} />
              </div>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader title="By loan product" icon={Package} />
              <Table>
                <thead>
                  <tr className="border-b border-slate-100">
                    <Th>Product</Th>
                    <Th className="text-right">Loans</Th>
                    <Th className="text-right">Outstanding principal</Th>
                    <Th className="text-right">PAR 30</Th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-slate-100">
                  {q.byProduct.map((p) => (
                    <tr key={p.productName}>
                      <Td className="font-medium text-slate-900">{p.productName}</Td>
                      <Td className="text-right">{p.loans}</Td>
                      <Td className="text-right">{kwacha(p.principalOutstanding)}</Td>
                      <Td className="text-right">
                        <Badge tone={tone(p.par30)}>{pct(p.par30)}</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
