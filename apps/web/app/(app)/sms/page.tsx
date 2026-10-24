"use client";

import { SMS_AUDIENCES, type SmsAudience } from "@anzelu/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, Send, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Notifications } from "../settings/sections";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, CardHeader, EmptyState, Field, inputClass, Modal, Notice, PageHeader, Skeleton, Table, Td, Th } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";

const AUDIENCE: Record<SmsAudience, { label: string; hint: string; template: string }> = {
  due_today: {
    label: "Payment due today",
    hint: "Borrowers with an instalment due today",
    template: "Dear {name}, your Chilimbitso payment of {amount} for loan {loan} is due today. Thank you for paying on time.",
  },
  arrears: {
    label: "In arrears",
    hint: "Borrowers with missed instalments",
    template: "Dear {name}, your loan {loan} has {amount} overdue. Please pay today or call us to agree a plan.",
  },
  active_loans: { label: "All active loans", hint: "Everyone currently repaying", template: "Dear {name}, " },
  group: { label: "A loan group", hint: "Members of one market group", template: "Dear {name}, " },
  branch: { label: "A branch", hint: "Borrowers registered at one branch", template: "Dear {name}, " },
  all_borrowers: { label: "All borrowers", hint: "Every registered borrower", template: "Dear {name}, " },
};

interface Preview {
  count: number;
  sample: { name: string; phone: string; amount: string; loan: string }[];
}

interface Campaign {
  at: string;
  by: string | null;
  data: { audience: SmsAudience; message: string; recipients: number; sent: number };
}

/** SMS are 160 characters; longer messages are sent as several parts. */
const parts = (n: number) => (n <= 160 ? 1 : Math.ceil(n / 153));

export default function SmsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <BulkSms />
    </Suspense>
  );
}

function BulkSms() {
  const qc = useQueryClient();
  const toast = useToast();
  const params = useSearchParams();
  const initial = (SMS_AUDIENCES as readonly string[]).includes(params.get("audience") ?? "") ? (params.get("audience") as SmsAudience) : "due_today";
  const [audience, setAudience] = useState<SmsAudience>(initial);
  const [groupId, setGroupId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [message, setMessage] = useState(AUDIENCE[initial].template);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: groups } = useApi<{ id: string; name: string }[]>("/loan-groups");
  const { data: branches } = useApi<{ id: string; name: string }[]>("/branches");
  const { data: campaigns } = useApi<Campaign[]>("/sms/campaigns");
  const ready = (audience !== "group" || groupId) && (audience !== "branch" || branchId);
  const qs = new URLSearchParams({ audience, ...(groupId && { groupId }), ...(branchId && { branchId }) }).toString();
  const { data: preview, isFetching } = useApi<Preview>(ready ? `/sms/preview?${qs}` : null);
  const sample = preview?.sample[0];
  const filled = sample
    ? message
        .replaceAll("{name}", sample.name)
        .replaceAll("{amount}", `K${Number(sample.amount).toLocaleString("en-ZM", { minimumFractionDigits: 2 })}`)
        .replaceAll("{loan}", sample.loan)
    : message;

  function pick(a: SmsAudience) {
    // Swap in the suggested wording only if the message hasn't been edited from a template.
    if (Object.values(AUDIENCE).some((x) => x.template === message)) setMessage(AUDIENCE[a].template);
    setAudience(a);
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ recipients: number; sent: number }>("/sms/bulk", { audience, groupId, branchId, message });
      setConfirm(false);
      toast({ tone: "success", title: `SMS sent to ${r.sent} borrowers`, body: "Each one is in the message log below." });
      await qc.invalidateQueries({ queryKey: ["/sms/campaigns"] });
      await qc.invalidateQueries({ queryKey: ["page"] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Bulk SMS" description="Send reminders and notices to a group of borrowers. Each message is personalised and logged." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="New message" />
          <div className="space-y-5 p-5">
            <div>
              <p className="mb-2 text-[13px] font-medium text-slate-700">Send to</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {SMS_AUDIENCES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => pick(a)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition",
                      audience === a ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <span className="block text-sm font-semibold text-slate-900">{AUDIENCE[a].label}</span>
                    <span className="block text-xs text-slate-500">{AUDIENCE[a].hint}</span>
                  </button>
                ))}
              </div>
            </div>
            {audience === "group" && (
              <Field label="Group">
                <select className={inputClass} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">Choose a group…</option>
                  {groups?.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {audience === "branch" && (
              <Field label="Branch">
                <select className={inputClass} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">Choose a branch…</option>
                  {branches?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Message" hint="{name}, {amount} and {loan} are filled in for each borrower.">
              <textarea className={inputClass} rows={4} maxLength={480} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="tabular text-xs text-slate-500">
                {message.length} / 480 characters · {parts(filled.length)} SMS per person
              </p>
              <Button disabled={!ready || !preview?.count || message.trim().length < 5} onClick={() => setConfirm(true)}>
                <Send className="size-4" /> Review and send
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card className="p-5">
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="size-4 text-brand-600" />
              {!ready ? (
                "Choose who to send to"
              ) : isFetching && !preview ? (
                "Counting…"
              ) : (
                <>
                  <strong className="tabular text-lg text-slate-900">{preview?.count ?? 0}</strong> borrowers will receive this
                </>
              )}
            </p>
            <div className="mt-4 rounded-2xl bg-slate-100 p-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">{sample ? `Preview for ${sample.name}` : "Preview"}</p>
              <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm">{filled}</div>
            </div>
          </Card>
          <Notice tone="info">Messages go through the SMS gateway configured on the server. In this demo they are logged but not delivered.</Notice>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader title="Sent campaigns" />
          {!campaigns && <Skeleton className="m-5 h-24" />}
          {campaigns && !campaigns.length && <EmptyState icon={MessageSquareText} title="No bulk messages sent yet" />}
          {!!campaigns?.length && (
            <Table>
              <thead>
                <tr className="border-b border-slate-100">
                  <Th>When</Th>
                  <Th>Audience</Th>
                  <Th>Message</Th>
                  <Th className="text-right">Sent</Th>
                  <Th>By</Th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-slate-100">
                {campaigns.map((c) => (
                  <tr key={c.at}>
                    <Td className="whitespace-nowrap">{dateTime(c.at)}</Td>
                    <Td>
                      <Badge>{AUDIENCE[c.data.audience]?.label ?? c.data.audience}</Badge>
                    </Td>
                    <Td className="max-w-md whitespace-normal text-slate-600">{c.data.message}</Td>
                    <Td className="text-right font-medium">{c.data.sent}</Td>
                    <Td>{c.by}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Notifications />
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Send to ${preview?.count ?? 0} borrowers?`}
        description="This can’t be undone. Each borrower gets their own personalised copy."
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-800">{filled}</div>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={send}>
              <Send className="size-4" /> Send now
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
