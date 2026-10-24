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

export default function ReportsPage() {
  const { data: book, error, isLoading } = useApi<Row[]>("/reports/portfolio");
  const [view, setView] = useState<"product" | "book">("product");

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
        description="The loan book by product, and every active loan with its balance. Quality, branches and collections have their own reports in the menu."
        actions={
          <a
            href="/api/v1/reports/portfolio.csv"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download className="size-4" /> Portfolio CSV
          </a>
        }
      />
      <div className="mb-4">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { value: "product", label: "By product" },
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
