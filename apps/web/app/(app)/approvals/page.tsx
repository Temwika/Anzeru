"use client";

import { LABELS, type Channel } from "@anzelu/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Notice, PageHeader, Skeleton, Table, Td, Th } from "@/components/ui";
import { api, qs, useApi, usePage, useSession } from "@/lib/api";
import { dateTime, kwacha } from "@/lib/format";

interface AppRow {
  id: string;
  applicationNumber: string;
  amount: string;
  customerName: string;
  productName: string;
  officerName: string;
  grade: string;
  recommendation: string;
  submittedAt: string;
}

interface DisbRow {
  id: string;
  loanId: string;
  loanNumber: string;
  approvedBy: string;
  customerName: string;
  netAmount: string;
  channel: Channel;
  destination: string;
  requestedAt: string;
  requestedBy: string;
  requestedByName: string;
}

interface RevRow {
  id: string;
  reason: string;
  requestedAt: string;
  requestedBy: string;
  requestedById: string;
  receiptNumber: string;
  amount: string;
  loanNumber: string;
  customerName: string;
}

export default function ApprovalsPage() {
  const { data: user } = useSession();
  const qc = useQueryClient();
  const perms = user?.permissions ?? [];
  const apps = usePage<AppRow>(perms.includes("applications:decide") ? `/applications${qs({ status: "submitted", pageSize: 50 })}` : null);
  const disb = useApi<DisbRow[]>(perms.includes("disbursements:authorise") ? "/loans/disbursements/queue" : null);
  const revs = useApi<RevRow[]>(perms.includes("payments:reverse:approve") ? "/reversals?status=pending" : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function act(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMessage(null);
    try {
      setMessage({ tone: "success", text: await fn() });
      await qc.invalidateQueries();
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!user) return <Skeleton className="h-96" />;
  const nothing = !apps.data?.items.length && !disb.data?.length && !revs.data?.length && !apps.isLoading && !disb.isLoading && !revs.isLoading;

  return (
    <>
      <PageHeader title="Approvals" description="Maker-checker queue: you can never approve your own work" />
      {message && (
        <div className="mb-4">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
      {nothing && (
        <Card>
          <EmptyState icon={CheckCheck} title="Nothing waiting for you" body="New items appear here as colleagues submit them." />
        </Card>
      )}
      <div className="space-y-6">
        {perms.includes("applications:decide") && !!apps.data?.items.length && (
          <Card>
            <CardHeader title="Credit applications" description="Open an application to review checks and score before deciding" />
            {apps.error && <ErrorState error={apps.error} />}
            <Table>
              <thead>
                <tr className="border-b border-slate-100">
                  <Th>Application</Th>
                  <Th>Customer</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Grade</Th>
                  <Th>Submitted by</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-slate-100">
                {apps.data.items.map((a) => {
                  const overLimit = Number(a.amount) > Number(user.approvalLimit);
                  return (
                    <tr key={a.id}>
                      <Td className="font-medium text-slate-900">{a.applicationNumber}</Td>
                      <Td>
                        {a.customerName}
                        <span className="block text-xs text-slate-500">{a.productName}</span>
                      </Td>
                      <Td className="text-right font-medium">{kwacha(a.amount)}</Td>
                      <Td>
                        <span className="font-semibold">{a.grade}</span> <Badge tone={a.recommendation === "approve" ? "green" : a.recommendation === "refer" ? "amber" : "red"}>{a.recommendation}</Badge>
                      </Td>
                      <Td>
                        {a.officerName}
                        <span className="block text-xs text-slate-500">{dateTime(a.submittedAt)}</span>
                      </Td>
                      <Td className="text-right">
                        {overLimit ? (
                          <span className="text-xs text-slate-500">Above your limit</span>
                        ) : (
                          <Link href={`/applications/${a.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                            Review
                          </Link>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}

        {!!disb.data?.length && (
          <Card>
            <CardHeader title="Disbursements" description="Authorising sends the money through the payout channel" />
            <Table>
              <thead>
                <tr className="border-b border-slate-100">
                  <Th>Loan</Th>
                  <Th>Pay to</Th>
                  <Th className="text-right">Net amount</Th>
                  <Th>Requested by</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-slate-100">
                {disb.data.map((d) => {
                  const conflict = d.requestedBy === user.id ? "You requested this" : d.approvedBy === user.id ? "You approved the credit" : null;
                  return (
                    <tr key={d.id}>
                      <Td>
                        <Link href={`/loans/${d.loanId}`} className="font-medium text-slate-900 hover:text-brand-700">
                          {d.loanNumber}
                        </Link>
                        <span className="block text-xs text-slate-500">{d.customerName}</span>
                      </Td>
                      <Td>
                        {LABELS.channel[d.channel]}
                        <span className="block text-xs text-slate-500">{d.destination}</span>
                      </Td>
                      <Td className="text-right font-medium">{kwacha(d.netAmount)}</Td>
                      <Td>
                        {d.requestedByName}
                        <span className="block text-xs text-slate-500">{dateTime(d.requestedAt)}</span>
                      </Td>
                      <Td className="text-right">
                        {conflict ? (
                          <span className="text-xs text-slate-500">{conflict}</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!!busy}
                              onClick={() => act(`d-${d.id}`, async () => (await api.post(`/loans/${d.loanId}/disbursements/decision`, { decision: "reject" }), `Disbursement for ${d.loanNumber} rejected.`))}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              loading={busy === `d-${d.id}`}
                              disabled={!!busy}
                              onClick={() =>
                                act(`d-${d.id}`, async () => {
                                  const r = await api.post<{ providerRef?: string }>(`/loans/${d.loanId}/disbursements/decision`, { decision: "authorise" });
                                  return `${kwacha(d.netAmount)} paid out for ${d.loanNumber} (ref ${r.providerRef}).`;
                                })
                              }
                            >
                              Authorise
                            </Button>
                          </div>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}

        {!!revs.data?.length && (
          <Card>
            <CardHeader title="Payment reversals" description="Approval posts a mirror journal; the original stays on record" />
            <Table>
              <thead>
                <tr className="border-b border-slate-100">
                  <Th>Receipt</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Reason</Th>
                  <Th>Requested by</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-slate-100">
                {revs.data.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <span className="font-medium text-slate-900">{r.receiptNumber}</span>
                      <span className="block text-xs text-slate-500">
                        {r.loanNumber} · {r.customerName}
                      </span>
                    </Td>
                    <Td className="text-right font-medium">{kwacha(r.amount)}</Td>
                    <Td className="max-w-xs whitespace-normal">{r.reason}</Td>
                    <Td>
                      {r.requestedBy}
                      <span className="block text-xs text-slate-500">{dateTime(r.requestedAt)}</span>
                    </Td>
                    <Td className="text-right">
                      {r.requestedById === user.id ? (
                        <span className="text-xs text-slate-500">You requested this</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => act(`r-${r.id}`, async () => (await api.post(`/reversals/${r.id}/decision`, { decision: "reject" }), "Reversal rejected."))}>
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={busy === `r-${r.id}`}
                            disabled={!!busy}
                            onClick={() => act(`r-${r.id}`, async () => (await api.post(`/reversals/${r.id}/decision`, { decision: "approve" }), `Receipt ${r.receiptNumber} reversed.`))}
                          >
                            Approve reversal
                          </Button>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
