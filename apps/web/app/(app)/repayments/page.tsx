"use client";

import { LABELS, type Channel } from "@anzelu/contracts";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Card, EmptyState, ErrorState, Modal, PageHeader, Pager, Skeleton, StatusBadge, Table, Tabs, Td, Th } from "@/components/ui";
import { qs, useApi, usePage } from "@/lib/api";
import { dateTime, kwacha, label, shortDate } from "@/lib/format";

interface Row {
  id: string;
  receiptNumber: string;
  amount: string;
  unallocated: string;
  channel: Channel;
  externalRef: string | null;
  status: string;
  receivedOn: string;
  loanId: string;
  loanNumber: string;
  customerName: string;
  recordedBy: string | null;
  pendingReversal: boolean;
}

interface ReceiptDetail {
  receiptNumber: string;
  amount: string;
  channel: Channel;
  externalRef: string | null;
  receivedOn: string;
  createdAt: string;
  loanNumber: string;
  customerName: string;
  customerNumber: string;
  status: string;
  allocations: { component: string; amount: string; installmentNo: number }[];
  reversals: { id: string; reason: string; status: string; requestedAt: string }[];
}

export default function RepaymentsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, error } = usePage<Row>(`/payments${qs({ status, page, pageSize: 25 })}`);

  return (
    <>
      <PageHeader title="Repayments" description="Every receipt, from cashier desks and mobile money callbacks. Record new payments from the loan page." />
      <div className="mb-4">
        <Tabs
          value={status}
          onChange={(v) => (setStatus(v), setPage(1))}
          tabs={[
            { value: "", label: "All" },
            { value: "posted", label: "Posted" },
            { value: "reversed", label: "Reversed" },
          ]}
        />
      </div>
      {error && <ErrorState error={error} />}
      <Card>
        <Table>
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Receipt</Th>
              <Th>Loan</Th>
              <Th>Received</Th>
              <Th>Channel</Th>
              <Th className="text-right">Amount</Th>
              <Th className="hidden lg:table-cell">Recorded by</Th>
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
            {data?.items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td>
                  <button onClick={() => setOpen(p.id)} className="font-medium text-slate-900 hover:text-brand-700">
                    {p.receiptNumber}
                  </button>
                  {p.externalRef && <span className="block text-xs text-slate-500">{p.externalRef}</span>}
                </Td>
                <Td>
                  <Link href={`/loans/${p.loanId}`} className="hover:text-brand-700">
                    {p.loanNumber}
                  </Link>
                  <span className="block text-xs text-slate-500">{p.customerName}</span>
                </Td>
                <Td>{shortDate(p.receivedOn)}</Td>
                <Td>{LABELS.channel[p.channel]}</Td>
                <Td className="text-right font-medium text-slate-900">{kwacha(p.amount)}</Td>
                <Td className="hidden lg:table-cell">{p.recordedBy ?? "Provider callback"}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    <StatusBadge status={p.status} />
                    {p.pendingReversal && <Badge tone="amber">reversal pending</Badge>}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {data && data.items.length === 0 && <EmptyState icon={Receipt} title="No payments yet" />}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Card>
      {open && <ReceiptModal id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ReceiptModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: r } = useApi<ReceiptDetail>(`/payments/${id}`);
  return (
    <Modal open onClose={onClose} title={r ? `Receipt ${r.receiptNumber}` : "Receipt"}>
      {!r ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="tabular space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-slate-500">Customer</dt>
              <dd className="font-medium">
                {r.customerName} ({r.customerNumber})
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Loan</dt>
              <dd className="font-medium">{r.loanNumber}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Amount</dt>
              <dd className="font-medium">{kwacha(r.amount)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Channel</dt>
              <dd className="font-medium">
                {LABELS.channel[r.channel]} {r.externalRef && `· ${r.externalRef}`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Received</dt>
              <dd className="font-medium">{shortDate(r.receivedOn)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd>
                <StatusBadge status={r.status} />
              </dd>
            </div>
          </dl>
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Allocation</h4>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {r.allocations.map((a, i) => (
                <li key={i} className="flex justify-between px-3 py-2">
                  <span>
                    Instalment {a.installmentNo} · {label(a.component)}
                  </span>
                  <span className="font-medium">{kwacha(a.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          {r.reversals.map((v) => (
            <p key={v.id} className="text-xs text-slate-500">
              Reversal {v.status} ({dateTime(v.requestedAt)}): {v.reason}
            </p>
          ))}
        </div>
      )}
    </Modal>
  );
}
