"use client";

import { tenantCreateSchema } from "@anzelu/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Badge, Button, Card, ErrorState, Field, inputClass, Modal, Notice, PageHeader, Skeleton, StatusBadge, Table, Td, Th } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { kwacha, shortDate } from "@/lib/format";

interface Tenant {
  id: string;
  name: string;
  code: string;
  plan: string;
  status: string;
  createdAt: string;
  activeLoans: number;
  lifetimeDisbursed: string;
  staff: number;
  customers: number;
}

export default function TenantsPage() {
  const qc = useQueryClient();
  const { data, error, isLoading } = useApi<Tenant[]>("/admin/tenants");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(t: Tenant, status: "active" | "suspended") {
    setBusy(t.id);
    try {
      await api.patch(`/admin/tenants/${t.id}/status`, { status });
      await qc.invalidateQueries({ queryKey: ["/admin/tenants"] });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Institutions"
        description="Lenders on the platform. Each institution's data is isolated by tenant."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Onboard institution
          </Button>
        }
      />
      {error && <ErrorState error={error} />}
      {isLoading && <Skeleton className="h-64" />}
      {data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-slate-500">Institutions</p>
            <p className="tabular text-2xl font-semibold">{data.filter((t) => t.status === "active").length} active</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-slate-500">Active loans (all tenants)</p>
            <p className="tabular text-2xl font-semibold">{data.reduce((a, t) => a + t.activeLoans, 0)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-slate-500">Lifetime disbursed</p>
            <p className="tabular text-2xl font-semibold">{kwacha(data.reduce((a, t) => a + Number(t.lifetimeDisbursed), 0))}</p>
          </Card>
        </div>
      )}
      {data && (
        <Card>
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Institution</Th>
                <Th>Plan</Th>
                <Th className="text-right">Staff</Th>
                <Th className="text-right">Customers</Th>
                <Th className="text-right">Active loans</Th>
                <Th className="text-right">Disbursed</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-slate-100">
              {data.map((t) => (
                <tr key={t.id}>
                  <Td>
                    <span className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <Building2 className="size-4" />
                      </span>
                      <span>
                        <span className="block font-medium text-slate-900">{t.name}</span>
                        <span className="text-xs text-slate-500">
                          {t.code} · since {shortDate(t.createdAt)}
                        </span>
                      </span>
                    </span>
                  </Td>
                  <Td>
                    <Badge tone="blue">{t.plan}</Badge>
                  </Td>
                  <Td className="text-right">{t.staff}</Td>
                  <Td className="text-right">{t.customers}</Td>
                  <Td className="text-right">{t.activeLoans}</Td>
                  <Td className="text-right">{kwacha(t.lifetimeDisbursed, { compact: true })}</Td>
                  <Td>
                    <StatusBadge status={t.status === "suspended" ? "rejected" : "active"} />
                  </Td>
                  <Td className="text-right">
                    {t.status === "active" ? (
                      <Button size="sm" variant="ghost" loading={busy === t.id} onClick={() => setStatus(t, "suspended")}>
                        Suspend
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" loading={busy === t.id} onClick={() => setStatus(t, "active")}>
                        Reactivate
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      {creating && <CreateTenant onClose={() => setCreating(false)} />}
    </>
  );
}

type Values = z.input<typeof tenantCreateSchema>;

function CreateTenant({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(tenantCreateSchema), defaultValues: { plan: "starter" } });
  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      await api.post("/admin/tenants", v);
      await qc.invalidateQueries({ queryKey: ["/admin/tenants"] });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  });
  return (
    <Modal open onClose={onClose} title="Onboard institution" description="Creates the tenant, its chart of accounts, a Head Office branch and the first administrator." wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Institution name" error={errors.name?.message} className="sm:col-span-2">
          <input className={inputClass} {...register("name")} />
        </Field>
        <Field label="Code" error={errors.code?.message} hint="Used for webhooks and references">
          <input className={inputClass} {...register("code")} />
        </Field>
        <Field label="Plan">
          <select className={inputClass} {...register("plan")}>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </Field>
        <Field label="Administrator name" error={errors.adminName?.message}>
          <input className={inputClass} {...register("adminName")} />
        </Field>
        <Field label="Administrator email" error={errors.adminEmail?.message}>
          <input className={inputClass} type="email" {...register("adminEmail")} />
        </Field>
        <Field label="Initial password" error={errors.adminPassword?.message} hint="Share securely; ask them to enable MFA" className="sm:col-span-2">
          <input className={inputClass} type="password" autoComplete="new-password" {...register("adminPassword")} />
        </Field>
        {error && (
          <div className="sm:col-span-2">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Create institution
          </Button>
        </div>
      </form>
    </Modal>
  );
}
