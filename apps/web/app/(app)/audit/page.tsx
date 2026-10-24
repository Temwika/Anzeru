"use client";

import { ShieldCheck, ShieldX } from "lucide-react";
import { useState } from "react";
import { Button, Card, ErrorState, Notice, PageHeader, Pager, SearchInput, Skeleton, Table, Td, Th } from "@/components/ui";
import { api, qs, usePage } from "@/lib/api";
import { dateTime, label } from "@/lib/format";

interface Row {
  seq: number;
  action: string;
  entityType: string;
  entityId: string | null;
  data: Record<string, unknown> | null;
  ip: string | null;
  hash: string;
  createdAt: string;
  userName: string | null;
  userRole: string | null;
}

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, isLoading } = usePage<Row>(`/audit${qs({ action, page, pageSize: 30 })}`);
  const [verify, setVerify] = useState<{ valid: boolean; checked: number; brokenAtSeq?: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function runVerify() {
    setBusy(true);
    try {
      setVerify(await api.get("/audit/verify"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Append-only, hash-chained log. Each entry includes the hash of the one before it, so any edit breaks the chain."
        actions={
          <Button variant="secondary" loading={busy} onClick={runVerify}>
            <ShieldCheck className="size-4" /> Verify integrity
          </Button>
        }
      />
      {verify && (
        <div className="mb-4">
          {verify.valid ? (
            <Notice tone="success">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4" /> Chain intact: {verify.checked} entries verified.
              </span>
            </Notice>
          ) : (
            <Notice tone="error">
              <span className="inline-flex items-center gap-2">
                <ShieldX className="size-4" /> Chain broken at entry #{verify.brokenAtSeq}. Investigate immediately.
              </span>
            </Notice>
          )}
        </div>
      )}
      <div className="mb-4 flex justify-end">
        <SearchInput value={action} onChange={(v) => (setAction(v), setPage(1))} placeholder="Filter by action, e.g. payment" />
      </div>
      {error && <ErrorState error={error} />}
      <Card>
        <Table>
          <thead>
            <tr className="border-b border-slate-100">
              <Th>#</Th>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Action</Th>
              <Th className="hidden lg:table-cell">Details</Th>
              <Th className="hidden xl:table-cell">Hash</Th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-slate-100">
            {isLoading &&
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i}>
                  <Td colSpan={6}>
                    <Skeleton className="h-6" />
                  </Td>
                </tr>
              ))}
            {data?.items.map((r) => (
              <tr key={r.seq}>
                <Td className="text-slate-500">{r.seq}</Td>
                <Td>{dateTime(r.createdAt)}</Td>
                <Td>
                  {r.userName ?? "System"}
                  {r.userRole && <span className="block text-xs text-slate-500">{label(r.userRole)}</span>}
                </Td>
                <Td>
                  <span className="font-mono text-xs font-medium text-slate-900">{r.action}</span>
                  <span className="block text-xs text-slate-500">{r.entityType}</span>
                </Td>
                <Td className="hidden max-w-md lg:table-cell">
                  <code className="block truncate text-xs text-slate-500" title={JSON.stringify(r.data)}>
                    {r.data ? JSON.stringify(r.data) : "—"}
                  </code>
                </Td>
                <Td className="hidden font-mono text-xs text-slate-400 xl:table-cell">{r.hash.slice(0, 12)}…</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
