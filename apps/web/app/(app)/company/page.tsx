"use client";

import { companySchema } from "@anzelu/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { Operations } from "../settings/sections";
import { Logo } from "@/components/logo";
import { useToast } from "@/components/toast";
import { Button, Card, CardHeader, ErrorState, Field, inputClass, PageHeader, Skeleton } from "@/components/ui";
import { api, fieldErrors, useApi, useSession } from "@/lib/api";

interface Company {
  name: string;
  code: string;
  tradingName?: string;
  tagline?: string;
  address?: string;
  phones?: string;
  email?: string;
  licenceNumber?: string;
  receiptNote?: string;
}

const FIELDS = ["name", "tradingName", "tagline", "address", "phones", "email", "licenceNumber", "receiptNote"] as const;
type Form = Record<(typeof FIELDS)[number], string>;

export default function CompanyPage() {
  const { data: user } = useSession();
  const { data, error } = useApi<Company>("/company");
  const admin = user?.permissions.includes("settings:manage");
  if (error) return <ErrorState error={error} />;
  return (
    <>
      <PageHeader title="Company Settings" description="Your registered details. They appear on receipts, statements and the borrower app." />
      <div className="space-y-6">
        {!data || !user ? <Skeleton className="h-96" /> : admin ? <CompanyForm company={data} /> : null}
        {user?.permissions.includes("jobs:run") && <Operations />}
      </div>
    </>
  );
}

function CompanyForm({ company }: { company: Company }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [v, setV] = useState<Form>(() => Object.fromEntries(FIELDS.map((k) => [k, company[k] ?? ""])) as Form);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = companySchema.safeParse(v);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setBusy(true);
    setErrors({});
    try {
      await api.put("/settings/company", parsed.data);
      await qc.invalidateQueries({ queryKey: ["/company"] });
      toast({ tone: "success", title: "Company details saved", body: "New receipts will show them." });
    } catch (err) {
      setErrors(fieldErrors(err));
      toast({ tone: "error", title: "Couldn’t save", body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader title="Company details" description="Changes are recorded in the audit log." />
        <form onSubmit={save} noValidate className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Registered name" error={errors.name} required>
            <input className={inputClass} value={v.name} onChange={set("name")} />
          </Field>
          <Field label="Trading name" hint="The name on your logo" error={errors.tradingName}>
            <input className={inputClass} value={v.tradingName} onChange={set("tradingName")} placeholder="Chilimbitso Money Lending" />
          </Field>
          <Field label="Tagline" error={errors.tagline}>
            <input className={inputClass} value={v.tagline} onChange={set("tagline")} placeholder="Together, We Grow" />
          </Field>
          <Field label="Phone numbers" error={errors.phones}>
            <input className={inputClass} value={v.phones} onChange={set("phones")} inputMode="tel" />
          </Field>
          <Field label="Address" error={errors.address} className="sm:col-span-2">
            <input className={inputClass} value={v.address} onChange={set("address")} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input className={inputClass} value={v.email} onChange={set("email")} type="email" />
          </Field>
          <Field label="Money-lender licence number" error={errors.licenceNumber}>
            <input className={inputClass} value={v.licenceNumber} onChange={set("licenceNumber")} />
          </Field>
          <Field label="Message at the foot of receipts" error={errors.receiptNote} className="sm:col-span-2">
            <input className={inputClass} value={v.receiptNote} onChange={set("receiptNote")} />
          </Field>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" loading={busy}>
              Save details
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3 xl:sticky xl:top-24 xl:self-start">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receipt header preview</p>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <Logo tagline />
            <div className="space-y-1 border-l-2 border-brand-500 pl-3 text-[11px] leading-snug text-slate-700">
              {v.address && (
                <p className="flex gap-1">
                  <MapPin className="mt-px size-3 shrink-0 text-brand-600" /> {v.address}
                </p>
              )}
              {v.phones && (
                <p className="flex gap-1">
                  <Phone className="mt-px size-3 shrink-0 text-brand-600" /> {v.phones}
                </p>
              )}
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-brand-600 py-1.5 text-center text-sm font-bold uppercase tracking-wide text-white">Customer copy</p>
          {v.receiptNote && <p className="mt-3 text-center text-xs italic text-slate-500">{v.receiptNote}</p>}
        </Card>
      </div>
    </div>
  );
}
