"use client";

import { transferSchema } from "@anzelu/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { Avatar, Button, Card, CardHeader, EmptyState, Field, inputClass, Notice, PageHeader, SearchInput, Skeleton, Table, Td, Th } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";

interface CustomerRow {
  id: string;
  customerNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  branchId: string;
  branchName: string;
  activeLoans: number;
}

interface Transfer {
  at: string;
  by: string | null;
  customerId: string;
  customerName: string | null;
  data: { loans: string[]; reason: string; toBranchId: string; officerId: string };
}

export default function TransferPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [branchId, setBranchId] = useState("");
  const [officerId, setOfficerId] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { data: results } = useApi<CustomerRow[]>(q.trim().length >= 2 ? `/customers?pageSize=8&search=${encodeURIComponent(q.trim())}` : null);
  const { data: branches } = useApi<{ id: string; name: string }[]>("/branches");
  const { data: staff } = useApi<{ id: string; fullName: string; role: string; isActive: boolean; branches: { id: string }[] }[]>("/users");
  const { data: history } = useApi<Transfer[]>("/transfers");
  const officers =
    staff?.filter((u) => u.isActive && u.role === "credit_officer" && (!branchId || !u.branches.length || u.branches.some((b) => b.id === branchId))) ?? [];
  const nameOf = (list: { id: string; name?: string; fullName?: string }[] | undefined, id: string) => {
    const x = list?.find((i) => i.id === id);
    return x?.name ?? x?.fullName ?? "—";
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    const parsed = transferSchema.safeParse({ branchId, officerId, reason });
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setBusy(true);
    setErrors({});
    try {
      const r = await api.post<{ branch: string; officer: string; loansMoved: number }>(`/customers/${customer.id}/transfer`, parsed.data);
      toast({
        tone: "success",
        title: `${customer.firstName} ${customer.lastName} moved to ${r.branch}`,
        body: `${r.officer} now looks after ${r.loansMoved ? `${r.loansMoved} open loan${r.loansMoved === 1 ? "" : "s"}` : "this borrower"}.`,
      });
      setCustomer(null);
      setQ("");
      setBranchId("");
      setOfficerId("");
      setReason("");
      await qc.invalidateQueries();
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Transfer Client" description="Move a borrower and their open loans to another branch or loan officer. Every transfer is logged." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="1. Find the borrower" />
          <div className="space-y-3 p-5">
            <SearchInput wide value={q} onChange={setQ} placeholder="Name, NRC, phone or customer number" />
            {q.trim().length >= 2 && !results && <Skeleton className="h-24" />}
            <ul className="space-y-1.5">
              {results?.map((c) => {
                const on = customer?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomer(c);
                        setBranchId("");
                        setOfficerId("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                        on ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:bg-slate-50",
                      )}
                    >
                      <Avatar name={`${c.firstName} ${c.lastName}`} size="sm" />
                      <span className="flex-1">
                        <span className="font-medium text-slate-900">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {c.customerNumber} · {c.branchName} · {c.activeLoans} active loan{c.activeLoans === 1 ? "" : "s"}
                        </span>
                      </span>
                      {on && <Check className="size-4 text-brand-600" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title="2. Move to" />
          {!customer ? (
            <EmptyState icon={ArrowLeftRight} title="Choose a borrower first" />
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4 p-5">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <span className="font-medium text-slate-900">{customer.branchName}</span>
                <ArrowRight className="size-4 text-slate-400" />
                <span className="font-medium text-brand-700">{branchId ? nameOf(branches, branchId) : "New branch"}</span>
              </div>
              <Field label="Branch" error={errors.branchId}>
                <select
                  className={inputClass}
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);
                    setOfficerId("");
                  }}
                >
                  <option value="">Choose…</option>
                  {branches?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.id === customer.branchId ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Loan officer" error={errors.officerId} hint="Officers who work in the chosen branch">
                <select className={inputClass} value={officerId} onChange={(e) => setOfficerId(e.target.value)} disabled={!branchId}>
                  <option value="">Choose…</option>
                  {officers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reason" error={errors.reason}>
                <input
                  className={inputClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Borrower moved their stall to Katete market"
                />
              </Field>
              {errors.form && <Notice tone="error">{errors.form}</Notice>}
              <Button type="submit" loading={busy} className="w-full">
                <ArrowLeftRight className="size-4" /> Transfer borrower
              </Button>
            </form>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent transfers" />
        {!history && <Skeleton className="m-5 h-20" />}
        {history && !history.length && <EmptyState icon={ArrowLeftRight} title="No transfers yet" />}
        {!!history?.length && (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>When</Th>
                <Th>Borrower</Th>
                <Th>To</Th>
                <Th>Loans moved</Th>
                <Th>Reason</Th>
                <Th>By</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((t) => (
                <tr key={t.at}>
                  <Td className="whitespace-nowrap">{dateTime(t.at)}</Td>
                  <Td className="font-medium text-slate-900">{t.customerName}</Td>
                  <Td>
                    {nameOf(branches, t.data.toBranchId)}
                    <span className="block text-xs text-slate-500">{nameOf(staff, t.data.officerId)}</span>
                  </Td>
                  <Td>{t.data.loans.join(", ") || "—"}</Td>
                  <Td className="max-w-xs whitespace-normal text-slate-600">{t.data.reason}</Td>
                  <Td>{t.by}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
