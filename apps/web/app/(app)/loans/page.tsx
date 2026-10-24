"use client";

import { Landmark } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar, Card, EmptyState, ErrorState, PageHeader, Pager, SearchInput, Skeleton, StatusBadge, Table, Tabs, Td, Th } from "@/components/ui";
import { qs, usePage } from "@/lib/api";
import { kwacha, shortDate } from "@/lib/format";

interface Row {
  id: string;
  loanNumber: string;
  principal: string;
  status: string;
  disbursedOn: string | null;
  maturityDate: string | null;
  customerId: string;
  customerName: string;
  productName: string;
  branchName: string;
  principalOutstanding: string;
  totalOutstanding: string;
  daysPastDue: number;
  bucket: string | null;
  nextDueDate: string | null;
}

export default function LoansPage() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = usePage<Row>(`/loans${qs({ status, search, page, pageSize: 20 })}`);

  return (
    <>
      <PageHeader title="Loans" description="Booked loan accounts and their live balances" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={status}
          onChange={(v) => (setStatus(v), setPage(1))}
          tabs={[
            { value: "active", label: "Active" },
            { value: "pending_disbursement", label: "Awaiting disbursement" },
            { value: "closed", label: "Closed" },
            { value: "", label: "All" },
          ]}
        />
        <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder="Search loan number or name" />
      </div>
      {error && <ErrorState error={error} />}
      <Card>
        <Table>
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Loan</Th>
              <Th>Customer</Th>
              <Th className="hidden lg:table-cell">Product</Th>
              <Th className="text-right">Principal</Th>
              <Th className="text-right">Outstanding</Th>
              <Th>Next due</Th>
              <Th className="text-right">Days late</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-slate-100">
            {isLoading &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  <Td colSpan={8}>
                    <Skeleton className="h-6" />
                  </Td>
                </tr>
              ))}
            {data?.items.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`/loans/${l.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {l.loanNumber}
                  </Link>
                  <span className="block text-xs text-slate-500">{l.branchName}</span>
                </Td>
                <Td>
                  <Link href={`/customers/${l.customerId}`} className="flex items-center gap-2.5 hover:text-brand-700">
                    <Avatar name={l.customerName} size="sm" />
                    {l.customerName}
                  </Link>
                </Td>
                <Td className="hidden lg:table-cell">{l.productName}</Td>
                <Td className="text-right">{kwacha(l.principal)}</Td>
                <Td className="text-right font-medium text-slate-900">{l.status === "active" ? kwacha(l.totalOutstanding) : "—"}</Td>
                <Td>{l.status === "active" ? shortDate(l.nextDueDate) : "—"}</Td>
                <Td className={`text-right ${l.daysPastDue > 30 ? "font-semibold text-rose-700" : l.daysPastDue > 0 ? "text-amber-700" : ""}`}>{l.daysPastDue || "—"}</Td>
                <Td>
                  <StatusBadge status={l.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {data && data.items.length === 0 && <EmptyState icon={Landmark} title="No loans in this view" />}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
