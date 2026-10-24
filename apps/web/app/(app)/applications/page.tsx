"use client";

import { BookOpenCheck, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge, ButtonLink, Card, EmptyState, ErrorState, PageHeader, Pager, SearchInput, Skeleton, StatusBadge, Table, Tabs, Td, Th } from "@/components/ui";
import { qs, usePage, useSession } from "@/lib/api";
import { kwacha, shortDate } from "@/lib/format";

interface Row {
  id: string;
  applicationNumber: string;
  amount: string;
  term: number;
  status: string;
  submittedAt: string;
  customerId: string;
  customerName: string;
  productName: string;
  frequency: string;
  officerName: string;
  grade: string;
  recommendation: string;
}

const REC_TONE = { approve: "green", refer: "amber", decline: "red" } as const;

export default function ApplicationsPage() {
  const { data: user } = useSession();
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "submitted");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = usePage<Row>(`/applications${qs({ status, search, page, pageSize: 20 })}`);

  return (
    <>
      <PageHeader
        title="Loan applications"
        description="Credit pipeline from submission to decision"
        actions={
          user?.permissions.includes("applications:write") && (
            <ButtonLink href="/applications/new">
              <Plus className="size-4" /> New application
            </ButtonLink>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          tabs={[
            { value: "submitted", label: "Awaiting decision" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "", label: "All" },
          ]}
        />
        <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder="Search number, name or NRC" />
      </div>
      {error && <ErrorState error={error} />}
      <Card>
        <Table>
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Application</Th>
              <Th>Customer</Th>
              <Th>Product</Th>
              <Th className="text-right">Amount</Th>
              <Th>Grade</Th>
              <Th>Scorecard</Th>
              <Th>Officer</Th>
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
            {data?.items.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`/applications/${a.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {a.applicationNumber}
                  </Link>
                  <span className="block text-xs text-slate-500">{shortDate(a.submittedAt)}</span>
                </Td>
                <Td>
                  <Link href={`/customers/${a.customerId}`} className="hover:text-brand-700">
                    {a.customerName}
                  </Link>
                </Td>
                <Td>
                  {a.productName}
                  <span className="block text-xs text-slate-500">
                    {a.term} × {a.frequency}
                  </span>
                </Td>
                <Td className="text-right font-medium text-slate-900">{kwacha(a.amount)}</Td>
                <Td className="font-semibold">{a.grade}</Td>
                <Td>
                  <Badge tone={REC_TONE[a.recommendation as keyof typeof REC_TONE] ?? "neutral"}>{a.recommendation}</Badge>
                </Td>
                <Td>{a.officerName}</Td>
                <Td>
                  <StatusBadge status={a.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {data && data.items.length === 0 && <EmptyState icon={BookOpenCheck} title="No applications here" />}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
