"use client";

import { ArrowRight, BookOpenCheck, Clock3, Globe, Package, Plus, UserCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pager,
  SearchInput,
  Skeleton,
  StatusBadge,
  Table,
  Tabs,
  Td,
  Th,
} from "@/components/ui";
import { qs, usePage, useSession } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kwacha, shortDate } from "@/lib/format";

interface Row {
  id: string;
  applicationNumber: string;
  amount: string;
  term: number;
  status: string;
  channel: "branch" | "self_service";
  submittedAt: string;
  customerId: string;
  customerName: string;
  productName: string;
  frequency: string;
  officerName: string;
  grade: string;
  recommendation: string;
  collateralValue: string;
  guarantorCount: number;
}

const REC_TONE = { approve: "green", refer: "amber", decline: "red" } as const;
const GRADE_STYLE: Record<string, string> = {
  A: "bg-emerald-600 text-white",
  B: "bg-emerald-100 text-emerald-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-rose-100 text-rose-800",
};

/** "12 min ago", "3 h ago", "2 days ago": how long an applicant has been waiting. */
function waited(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  const days = Math.round(mins / 1440);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 24 * 3600 * 1000;

export default function ApplicationsPage() {
  const { data: user } = useSession();
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "submitted");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = usePage<Row>(`/applications${qs({ status, search, page, pageSize: 20 })}`);
  const waiting = status === "submitted";

  return (
    <>
      <PageHeader
        eyebrow="Credit pipeline"
        title="New Applicants"
        description={
          waiting && data
            ? `${data.total} applicant${data.total === 1 ? "" : "s"} waiting for a decision, oldest at the bottom. Open one to review documents and decide.`
            : "Every application from submission to decision."
        }
        actions={
          user?.permissions.includes("applications:write") && (
            <ButtonLink href="/applications/new">
              <Plus className="size-4" /> New loan
            </ButtonLink>
          )
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          tabs={[
            { value: "submitted", label: "Waiting for decision", count: waiting ? data?.total : undefined },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Declined" },
            { value: "", label: "All" },
          ]}
        />
        <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder="Search number, name or NRC" />
      </div>
      {error && <ErrorState error={error} />}

      {waiting ? (
        <>
          {isLoading && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-56" />
              ))}
            </div>
          )}
          {data && data.items.length === 0 && (
            <Card>
              <EmptyState
                icon={BookOpenCheck}
                title="No one is waiting"
                body="New applications from the branch and the borrower app appear here the moment they are submitted."
              />
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data?.items.map((a) => (
              <ApplicantCard key={a.id} a={a} />
            ))}
          </div>
          {data && data.total > data.pageSize && (
            <Card className="mt-4">
              <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
            </Card>
          )}
        </>
      ) : (
        <Card>
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Application</Th>
                <Th>Client</Th>
                <Th>Product</Th>
                <Th className="text-right">Amount</Th>
                <Th>Grade</Th>
                <Th>Officer</Th>
                <Th>Status</Th>
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
              {data?.items.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/applications/${a.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {a.applicationNumber}
                    </Link>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      {shortDate(a.submittedAt)}
                      {a.channel === "self_service" && <Badge tone="violet">Online</Badge>}
                    </span>
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
                  <Td>
                    <span className="font-semibold">{a.grade}</span>{" "}
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
      )}
    </>
  );
}

function ApplicantCard({ a }: { a: Row }) {
  const fresh = isNew(a.submittedAt);
  return (
    <Link
      href={`/applications/${a.id}`}
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift",
        fresh ? "border-brand-200 ring-1 ring-brand-100" : "border-slate-200",
      )}
    >
      {fresh && <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-brand-500 to-copper-400" />}
      <div className="flex items-start gap-3">
        <Avatar name={a.customerName} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{a.customerName}</p>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Clock3 className="size-3" /> {waited(a.submittedAt)} · {a.applicationNumber}
          </p>
        </div>
        {fresh ? (
          <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span>
        ) : (
          <span className={cn("grid size-8 place-items-center rounded-lg text-sm font-bold", GRADE_STYLE[a.grade] ?? "bg-slate-100 text-slate-700")}>
            {a.grade}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="tabular font-display text-2xl font-bold text-slate-900">{kwacha(a.amount)}</p>
        <p className="text-sm text-slate-600">
          {a.productName} · {a.term} {a.frequency === "daily" ? "days" : a.frequency === "monthly" ? "months" : `× ${a.frequency}`}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {a.channel === "self_service" && (
          <Badge tone="violet">
            <Globe className="size-3" /> Online
          </Badge>
        )}
        <Badge tone={REC_TONE[a.recommendation as keyof typeof REC_TONE] ?? "neutral"}>
          Grade {a.grade} · {a.recommendation}
        </Badge>
        {a.guarantorCount > 0 && (
          <Badge tone="blue">
            <UserCheck className="size-3" /> {a.guarantorCount} guarantor{a.guarantorCount === 1 ? "" : "s"}
          </Badge>
        )}
        {Number(a.collateralValue) > 0 && (
          <Badge tone="amber">
            <Package className="size-3" /> {kwacha(a.collateralValue, { compact: true })} collateral
          </Badge>
        )}
      </div>
      <div className="min-h-4 flex-1" />
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>{a.channel === "self_service" ? "Applied in the app" : `By ${a.officerName}`}</span>
        <span className="flex items-center gap-1 font-semibold text-brand-700">
          Review <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
