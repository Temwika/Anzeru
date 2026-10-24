"use client";

import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar, ButtonLink, Card, EmptyState, ErrorState, PageHeader, Pager, SearchInput, Skeleton, StatusBadge, Table, Tabs, Td, Th } from "@/components/ui";
import { qs, usePage, useSession } from "@/lib/api";
import { shortDate } from "@/lib/format";

interface CustomerRow {
  id: string;
  customerNumber: string;
  firstName: string;
  lastName: string;
  nrc: string;
  phone: string;
  kycStatus: string;
  branchName: string;
  createdAt: string;
  activeLoans: number;
}

export default function CustomersPage() {
  const { data: user } = useSession();
  const [search, setSearch] = useState("");
  const params = useSearchParams();
  const [kyc, setKyc] = useState((params.get("kyc") ?? "") as "" | "pending" | "verified" | "rejected");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = usePage<CustomerRow>(`/customers${qs({ search, kyc, page, pageSize: 20 })}`);

  return (
    <>
      <PageHeader
        title="Borrowers"
        description="Everyone registered to borrow, their KYC status and active loans"
        actions={
          user?.permissions.includes("customers:write") && (
            <ButtonLink href="/customers/new">
              <Plus className="size-4" /> Add borrower
            </ButtonLink>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search name, NRC, phone or number"
        />
        <Tabs
          value={kyc}
          onChange={(v) => {
            setKyc(v);
            setPage(1);
          }}
          tabs={[
            { value: "", label: "All" },
            { value: "pending", label: "KYC pending" },
            { value: "verified", label: "Verified" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
      </div>
      {error && <ErrorState error={error} />}
      <Card>
        <Table>
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Customer</Th>
              <Th>NRC</Th>
              <Th>Phone</Th>
              <Th>Branch</Th>
              <Th className="text-right">Active loans</Th>
              <Th>KYC</Th>
              <Th>Registered</Th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-slate-100">
            {isLoading &&
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i}>
                  <Td colSpan={7}>
                    <Skeleton className="h-6" />
                  </Td>
                </tr>
              ))}
            {data?.items.map((c) => (
              <tr key={c.id} className="transition hover:bg-slate-50/80">
                <Td>
                  <Link href={`/customers/${c.id}`} className="group flex items-center gap-3">
                    <Avatar name={`${c.firstName} ${c.lastName}`} size="sm" />
                    <span>
                      <span className="block font-medium text-slate-900 group-hover:text-brand-700">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="block text-xs text-slate-500">{c.customerNumber}</span>
                    </span>
                  </Link>
                </Td>
                <Td>{c.nrc}</Td>
                <Td>{c.phone}</Td>
                <Td>{c.branchName}</Td>
                <Td className="text-right">{c.activeLoans}</Td>
                <Td>
                  <StatusBadge status={c.kycStatus} />
                </Td>
                <Td>{shortDate(c.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {data && data.items.length === 0 && <EmptyState icon={Users} title="No customers found" body="Try a different search or filter." />}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
