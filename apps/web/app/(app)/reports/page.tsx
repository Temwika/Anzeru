"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardHeader, ErrorState, PageHeader, Skeleton, Table, Tabs, Td, Th } from "@/components/ui";
import { useApi } from "@/lib/api";
import { kwacha, pct, shortDate } from "@/lib/format";

interface Row {
  id: string;
  loanNumber: string;
  customerName: string;
  branchName: string;
  officerName: string;
  productName: string;
  disbursedOn: string;
  principal: string;
  principalOutstanding: string;
  totalOutstanding: string;
  overdueAmount: string;
  daysPastDue: number;
  bucket: string;
}

interface Group {
  id: string;
  name: string;
  activeLoans: number;
  outstandingPrincipal: string;
  par30: string;
}

interface Dashboard {
  kpis: { outstandingPrincipal: string; par30: string; par90: string; collectionEfficiencyPct: string | null; activeLoans: number };
  branches: Group[];
  officers: Group[];
}

export default function ReportsPage() {
  const { data: book, error, isLoading } = useApi<Row[]>("/reports/portfolio");
  const { data: dash } = useApi<Dashboard>("/reports/dashboard");
  const [view, setView] = useState<"product" | "branches" | "officers" | "book">("product");

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; count: number; principal: number; outstanding: number; atRisk: number }>();
    for (const r of book ?? []) {
      const g = map.get(r.productName) ?? { name: r.productName, count: 0, principal: 0, outstanding: 0, atRisk: 0 };
      g.count += 1;
      g.principal += Number(r.principal);
      g.outstanding += Number(r.principalOutstanding);
      if (r.daysPastDue > 30) g.atRisk += Number(r.principalOutstanding);
      map.set(r.productName, g);
    }
    return [...map.values()].sort((a, b) => b.outstanding - a.outstanding);
  }, [book]);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Portfolio quality as of today, computed from the live repayment schedules"
        actions={
          <a href="/api/v1/reports/portfolio.csv" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <Download className="size-4" /> Portfolio CSV
          </a>
        }
      />
      {dash && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Gross loan portfolio" value={kwacha(dash.kpis.outstandingPrincipal)} sub={`${dash.kpis.activeLoans} active loans`} />
          <Kpi label="PAR 30" value={pct(dash.kpis.par30)} sub="Principal more than 30 days late" />
          <Kpi label="PAR 90" value={pct(dash.kpis.par90)} sub="Principal more than 90 days late" />
          <Kpi label="Collection efficiency" value={dash.kpis.collectionEfficiencyPct ? `${dash.kpis.collectionEfficiencyPct}%` : "—"} sub="Collected ÷ due this month" />
        </div>
      )}
      <div className="mb-4">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { value: "product", label: "By product" },
            { value: "branches", label: "By branch" },
            { value: "officers", label: "By officer" },
            { value: "book", label: "Loan book" },
          ]}
        />
      </div>
      {error && <ErrorState error={error} />}
      {isLoading && <Skeleton className="h-72" />}

      {view === "product" && book && (
        <Card>
          <CardHeader title="Portfolio by product" />
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Product</Th>
                <Th className="text-right">Loans</Th>
                <Th className="text-right">Disbursed</Th>
                <Th className="text-right">Outstanding principal</Th>
                <Th className="text-right">PAR 30</Th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-slate-100">
              {byProduct.map((g) => (
                <tr key={g.name}>
                  <Td className="font-medium text-slate-900">{g.name}</Td>
                  <Td className="text-right">{g.count}</Td>
                  <Td className="text-right">{kwacha(g.principal)}</Td>
                  <Td className="text-right">{kwacha(g.outstanding)}</Td>
                  <Td className="text-right">{pct(g.outstanding ? (g.atRisk / g.outstanding) * 100 : 0)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {(view === "branches" || view === "officers") && dash && (
        <Card>
          <CardHeader title={view === "branches" ? "Branch performance" : "Loan officer performance"} />
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>{view === "branches" ? "Branch" : "Officer"}</Th>
                <Th className="text-right">Active loans</Th>
                <Th className="text-right">Outstanding principal</Th>
                <Th className="text-right">PAR 30</Th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-slate-100">
              {dash[view].map((g) => (
                <tr key={g.id}>
                  <Td className="font-medium text-slate-900">{g.name}</Td>
                  <Td className="text-right">{g.activeLoans}</Td>
                  <Td className="text-right">{kwacha(g.outstandingPrincipal)}</Td>
                  <Td className={`text-right ${Number(g.par30) > 10 ? "font-semibold text-rose-700" : ""}`}>{pct(g.par30)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {view === "book" && book && (
        <Card>
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Loan</Th>
                <Th className="hidden lg:table-cell">Branch</Th>
                <Th>Disbursed</Th>
                <Th className="text-right">Principal</Th>
                <Th className="text-right">Outstanding</Th>
                <Th className="text-right">Overdue</Th>
                <Th className="text-right">DPD</Th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-slate-100">
              {book.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <Link href={`/loans/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {r.loanNumber}
                    </Link>
                    <span className="block text-xs text-slate-500">{r.customerName}</span>
                  </Td>
                  <Td className="hidden lg:table-cell">{r.branchName}</Td>
                  <Td>{shortDate(r.disbursedOn)}</Td>
                  <Td className="text-right">{kwacha(r.principal)}</Td>
                  <Td className="text-right">{kwacha(r.totalOutstanding)}</Td>
                  <Td className="text-right">{Number(r.overdueAmount) ? kwacha(r.overdueAmount) : "—"}</Td>
                  <Td className={`text-right ${r.daysPastDue > 30 ? "font-semibold text-rose-700" : ""}`}>{r.daysPastDue || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </Card>
  );
}
