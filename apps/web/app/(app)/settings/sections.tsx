"use client";

import { branchSchema, FREQUENCIES, INTEREST_METHODS, LABELS, loanProductSchema, ROLE_LABELS, ROLES, userCreateSchema, rateText } from "@anzelu/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Play, Plus } from "lucide-react";
import { useState } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import type { z } from "zod";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  inputClass,
  Modal,
  Notice,
  Pager,
  Skeleton,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { api, useApi, usePage, useSession } from "@/lib/api";
import { dateTime, kwacha, label } from "@/lib/format";

interface Product {
  id: string;
  name: string;
  code: string;
  interestMethod: keyof typeof LABELS.interestMethod;
  annualRatePct: string;
  repaymentFrequency: keyof typeof LABELS.frequency;
  minAmount: string;
  maxAmount: string;
  minTerm: number;
  maxTerm: number;
  processingFeePct: string;
  penaltyPct: string;
  graceDays: number;
  maxDtiPct: string;
  requiresGuarantor: boolean;
  isActive: boolean;
}

export function Products() {
  const qc = useQueryClient();
  const { data, error } = useApi<Product[]>("/loan-products");
  const [creating, setCreating] = useState(false);
  const toggle = async (p: Product) => {
    await api.patch(`/loan-products/${p.id}`, { isActive: !p.isActive });
    await qc.invalidateQueries({ queryKey: ["/loan-products"] });
  };
  if (error) return <ErrorState error={error} />;
  return (
    <Card>
      <CardHeader
        title="Loan products"
        description="Pricing and policy used for every new application. Existing loans keep the terms they were booked on."
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New product
          </Button>
        }
      />
      {!data && <Skeleton className="m-5 h-40" />}
      <Table>
        <thead>
          <tr className="border-b border-slate-100">
            <Th>Product</Th>
            <Th>Pricing</Th>
            <Th>Limits</Th>
            <Th>Policy</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="tabular divide-y divide-slate-100">
          {data?.map((p) => (
            <tr key={p.id}>
              <Td>
                <span className="font-medium text-slate-900">{p.name}</span>
                <span className="block text-xs text-slate-500">{p.code}</span>
              </Td>
              <Td>
                {rateText(p.interestMethod, p.annualRatePct)} · {LABELS.interestMethod[p.interestMethod]}
                <span className="block text-xs text-slate-500">
                  {LABELS.frequency[p.repaymentFrequency]} · fee {Number(p.processingFeePct)}%
                </span>
              </Td>
              <Td>
                {kwacha(p.minAmount, { compact: true })} – {kwacha(p.maxAmount, { compact: true })}
                <span className="block text-xs text-slate-500">
                  {p.minTerm}–{p.maxTerm} instalments
                </span>
              </Td>
              <Td>
                DTI ≤ {Number(p.maxDtiPct)}%
                <span className="block text-xs text-slate-500">
                  Penalty {Number(p.penaltyPct)}% after {p.graceDays} days{p.requiresGuarantor ? " · guarantor" : ""}
                </span>
              </Td>
              <Td>
                <StatusBadge status={p.isActive ? "active" : "closed"} />
              </Td>
              <Td className="text-right">
                <Button size="sm" variant="ghost" onClick={() => toggle(p)}>
                  {p.isActive ? "Retire" : "Reactivate"}
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {creating && <ProductForm onClose={() => setCreating(false)} />}
    </Card>
  );
}

/** Small RHF + zod form shell shared by the settings dialogs. */
function useZodForm<S extends z.ZodType<FieldValues, FieldValues>>(schema: S, defaults: Partial<z.input<S>>) {
  return useForm<z.input<S>>({ resolver: zodResolver(schema as never) as unknown as Resolver<z.input<S>>, defaultValues: defaults as never });
}

function FormFooter({ error, busy, onClose, label }: { error: string | null; busy: boolean; onClose: () => void; label: string }) {
  return (
    <>
      {error && (
        <div className="sm:col-span-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {label}
        </Button>
      </div>
    </>
  );
}

function ProductForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(loanProductSchema, {
    interestMethod: "reducing_balance",
    repaymentFrequency: "monthly",
    processingFeePct: "3",
    penaltyPct: "5",
    graceDays: 3,
    maxDtiPct: "40",
    requiresGuarantor: false,
    isActive: true,
  });
  const e = form.formState.errors as Record<string, { message?: string } | undefined>;
  const reg = (n: string) => ({ ...form.register(n as never), className: inputClass });
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api.post("/loan-products", v);
      await qc.invalidateQueries({ queryKey: ["/loan-products"] });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  });
  return (
    <Modal open onClose={onClose} title="New loan product" wide>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={e.name?.message}>
          <input {...reg("name")} />
        </Field>
        <Field label="Code" error={e.code?.message}>
          <input {...reg("code")} />
        </Field>
        <Field label="Interest method">
          <select {...reg("interestMethod")}>
            {INTEREST_METHODS.map((m) => (
              <option key={m} value={m}>
                {LABELS.interestMethod[m]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Repayment frequency">
          <select {...reg("repaymentFrequency")}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {LABELS.frequency[f]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={(form.watch("interestMethod" as never) as unknown) === "flat_term" ? "Interest % for the whole loan" : "Annual interest rate %"}
          hint={(form.watch("interestMethod" as never) as unknown) === "flat_term" ? "e.g. 40 means K500 borrowed, K700 repaid" : undefined}
          error={e.annualRatePct?.message}
        >
          <input {...reg("annualRatePct")} inputMode="decimal" />
        </Field>
        <Field label="Processing fee %" error={e.processingFeePct?.message}>
          <input {...reg("processingFeePct")} inputMode="decimal" />
        </Field>
        <Field label="Minimum amount" error={e.minAmount?.message}>
          <input {...reg("minAmount")} inputMode="decimal" />
        </Field>
        <Field label="Maximum amount" error={e.maxAmount?.message}>
          <input {...reg("maxAmount")} inputMode="decimal" />
        </Field>
        <Field label="Minimum instalments" error={e.minTerm?.message}>
          <input {...reg("minTerm")} inputMode="numeric" />
        </Field>
        <Field label="Maximum instalments" error={e.maxTerm?.message}>
          <input {...reg("maxTerm")} inputMode="numeric" />
        </Field>
        <Field label="Late penalty % of overdue instalment" error={e.penaltyPct?.message}>
          <input {...reg("penaltyPct")} inputMode="decimal" />
        </Field>
        <Field label="Grace days before penalty" error={e.graceDays?.message}>
          <input {...reg("graceDays")} inputMode="numeric" />
        </Field>
        <Field label="Maximum debt-to-income %" error={e.maxDtiPct?.message}>
          <input {...reg("maxDtiPct")} inputMode="decimal" />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4 rounded border-slate-300" {...form.register("requiresGuarantor" as never)} /> Requires a guarantor
        </label>
        <FormFooter error={error} busy={form.formState.isSubmitting} onClose={onClose} label="Create product" />
      </form>
    </Modal>
  );
}

export function Branches() {
  const { data, error } = useApi<{ id: string; name: string; code: string; address: string | null }[]>("/branches");
  const [creating, setCreating] = useState(false);
  if (error) return <ErrorState error={error} />;
  return (
    <Card>
      <CardHeader
        title="Branches"
        description="Credit officers and cashiers only see customers and loans in the branches assigned to them."
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New branch
          </Button>
        }
      />
      <Table>
        <thead>
          <tr className="border-b border-slate-100">
            <Th>Code</Th>
            <Th>Name</Th>
            <Th>Address</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data?.map((b) => (
            <tr key={b.id}>
              <Td className="font-mono text-xs">{b.code}</Td>
              <Td className="font-medium text-slate-900">{b.name}</Td>
              <Td>{b.address ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {creating && <BranchForm onClose={() => setCreating(false)} />}
    </Card>
  );
}

function BranchForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(branchSchema, {});
  const e = form.formState.errors as Record<string, { message?: string } | undefined>;
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api.post("/branches", v);
      await qc.invalidateQueries({ queryKey: ["/branches"] });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  });
  return (
    <Modal open onClose={onClose} title="New branch">
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={e.name?.message}>
          <input className={inputClass} {...form.register("name" as never)} />
        </Field>
        <Field label="Code" error={e.code?.message}>
          <input className={inputClass} {...form.register("code" as never)} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <input className={inputClass} {...form.register("address" as never)} />
        </Field>
        <FormFooter error={error} busy={form.formState.isSubmitting} onClose={onClose} label="Create branch" />
      </form>
    </Modal>
  );
}

interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  role: keyof typeof ROLE_LABELS;
  approvalLimit: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  branches: { id: string; name: string }[];
}

export function Users() {
  const qc = useQueryClient();
  const { data: me } = useSession();
  const { data, error } = useApi<StaffUser[]>("/users");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const toggle = async (u: StaffUser) => {
    setActionError(null);
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      await qc.invalidateQueries({ queryKey: ["/users"] });
    } catch (err) {
      setActionError((err as Error).message);
    }
  };
  if (error) return <ErrorState error={error} />;
  return (
    <Card>
      <CardHeader
        title="Users & roles"
        description="Access follows the role; approval limits cap what a credit manager can approve alone."
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Invite user
          </Button>
        }
      />
      {actionError && (
        <div className="px-5 pt-4">
          <Notice tone="error">{actionError}</Notice>
        </div>
      )}
      <Table>
        <thead>
          <tr className="border-b border-slate-100">
            <Th>User</Th>
            <Th>Role</Th>
            <Th>Branches</Th>
            <Th className="text-right">Approval limit</Th>
            <Th>Security</Th>
            <Th>Last sign-in</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="tabular divide-y divide-slate-100">
          {data
            ?.filter((u) => u.role !== "borrower")
            .map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                <Td>
                  <span className="font-medium text-slate-900">{u.fullName}</span>
                  <span className="block text-xs text-slate-500">{u.email}</span>
                </Td>
                <Td>{ROLE_LABELS[u.role]}</Td>
                <Td>{u.branches.map((b) => b.name).join(", ") || "All"}</Td>
                <Td className="text-right">{Number(u.approvalLimit) ? kwacha(u.approvalLimit) : "—"}</Td>
                <Td>{u.mfaEnabled ? <Badge tone="green">MFA on</Badge> : <Badge tone="amber">MFA off</Badge>}</Td>
                <Td>{dateTime(u.lastLoginAt)}</Td>
                <Td className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                    Edit
                  </Button>
                  {u.id !== me?.id && (
                    <Button size="sm" variant="ghost" onClick={() => toggle(u)}>
                      {u.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
        </tbody>
      </Table>
      {creating && <UserForm onClose={() => setCreating(false)} />}
      {editing && <UserEdit user={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function BranchPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { data } = useApi<{ id: string; name: string }[]>("/branches");
  return (
    <div className="flex flex-wrap gap-2">
      {data?.map((b) => {
        const on = value.includes(b.id);
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== b.id) : [...value, b.id])}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
          >
            {b.name}
          </button>
        );
      })}
    </div>
  );
}

function UserForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const form = useZodForm(userCreateSchema, { role: "credit_officer", approvalLimit: "0", branchIds: [] });
  const e = form.formState.errors as Record<string, { message?: string } | undefined>;
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await api.post("/users", { ...v, branchIds });
      await qc.invalidateQueries({ queryKey: ["/users"] });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  });
  return (
    <Modal open onClose={onClose} title="Invite user" wide>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={e.fullName?.message}>
          <input className={inputClass} {...form.register("fullName" as never)} />
        </Field>
        <Field label="Email" error={e.email?.message}>
          <input className={inputClass} type="email" {...form.register("email" as never)} />
        </Field>
        <Field label="Role">
          <select className={inputClass} {...form.register("role" as never)}>
            {ROLES.filter((r) => r !== "platform_admin" && r !== "borrower").map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Approval limit (ZMW)" error={e.approvalLimit?.message} hint="Only used for credit managers">
          <input className={inputClass} inputMode="decimal" {...form.register("approvalLimit" as never)} />
        </Field>
        <Field label="Temporary password" error={e.password?.message} hint="10+ characters with a letter and a digit" className="sm:col-span-2">
          <input className={inputClass} type="password" autoComplete="new-password" {...form.register("password" as never)} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-slate-700">Branch access</p>
          <BranchPicker value={branchIds} onChange={setBranchIds} />
        </div>
        <FormFooter error={error} busy={form.formState.isSubmitting} onClose={onClose} label="Create user" />
      </form>
    </Modal>
  );
}

function UserEdit({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const qc = useQueryClient();
  const [limit, setLimit] = useState(user.approvalLimit);
  const [branchIds, setBranchIds] = useState(user.branches.map((b) => b.id));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/users/${user.id}`, { approvalLimit: limit, branchIds });
      await qc.invalidateQueries({ queryKey: ["/users"] });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={user.fullName} description={ROLE_LABELS[user.role]}>
      <div className="space-y-4">
        <Field label="Approval limit (ZMW)">
          <input className={inputClass} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Branch access</p>
          <BranchPicker value={branchIds} onChange={setBranchIds} />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function Notifications() {
  const [page, setPage] = useState(1);
  const { data, error } = usePage<{ id: string; channel: string; recipient: string; template: string; message: string; status: string; createdAt: string }>(
    `/notifications?page=${page}&pageSize=20`,
  );
  if (error) return <ErrorState error={error} />;
  return (
    <Card>
      <CardHeader title="Notification log" description="SMS sent to borrowers. In this environment messages go to a sandbox gateway and are not delivered." />
      <Table>
        <thead>
          <tr className="border-b border-slate-100">
            <Th>When</Th>
            <Th>To</Th>
            <Th>Template</Th>
            <Th>Message</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="tabular divide-y divide-slate-100">
          {data?.items.map((n) => (
            <tr key={n.id}>
              <Td>{dateTime(n.createdAt)}</Td>
              <Td>{n.recipient}</Td>
              <Td>{label(n.template)}</Td>
              <Td className="max-w-md whitespace-normal text-slate-600">{n.message}</Td>
              <Td>
                <Badge tone={n.status === "sent" ? "green" : "neutral"}>{n.status}</Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
    </Card>
  );
}

export function Operations() {
  const qc = useQueryClient();
  const [result, setResult] = useState<{
    date: string;
    penaltiesApplied: number;
    penaltyTotal: string;
    remindersSent: number;
    overdueNoticesSent: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.post("/jobs/end-of-day"));
      await qc.invalidateQueries();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader
        title="End-of-day processing"
        description="Runs automatically every hour. It applies late penalties after the grace period and sends due-date reminders and overdue notices. Safe to re-run: each step happens at most once per day."
      />
      <div className="space-y-4 p-5">
        <Button loading={busy} onClick={run}>
          <Play className="size-4" /> Run end of day now
        </Button>
        {error && <Notice tone="error">{error}</Notice>}
        {result && (
          <Notice tone="success">
            {result.date}: {result.penaltiesApplied} penalties applied ({kwacha(result.penaltyTotal)}), {result.remindersSent} reminders and{" "}
            {result.overdueNoticesSent} overdue notices sent.
          </Notice>
        )}
      </div>
    </Card>
  );
}

export function Security({ mfaEnabled }: { mfaEnabled: boolean }) {
  const qc = useQueryClient();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function begin() {
    setError(null);
    setSetup(await api.post("/auth/mfa/setup"));
  }
  async function enable() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/mfa/enable", { code });
      setDone(true);
      setSetup(null);
      await qc.invalidateQueries({ queryKey: ["/auth/me"] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader
        title="Two-factor authentication"
        description="Protects your account with a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password)."
      />
      <div className="space-y-4 p-5">
        {mfaEnabled || done ? (
          <Notice tone="success">Two-factor authentication is on. You will be asked for a code at every sign-in.</Notice>
        ) : !setup ? (
          <>
            <Notice tone="warn">Two-factor authentication is off. Staff who can approve or move money should always enable it.</Notice>
            <Button onClick={begin}>
              <KeyRound className="size-4" /> Set up authenticator
            </Button>
          </>
        ) : (
          <>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>Open your authenticator app and add an account with a setup key.</li>
              <li>
                Enter this key:{" "}
                <code className="rounded bg-slate-100 px-2 py-1 font-mono text-sm tracking-wider text-slate-900">
                  {setup.secret.match(/.{1,4}/g)?.join(" ")}
                </code>
              </li>
              <li>Type the 6-digit code it shows to confirm.</li>
            </ol>
            <p className="break-all text-xs text-slate-500">
              Or open this link on the device with the app:{" "}
              <a className="text-brand-700 underline" href={setup.otpauthUrl}>
                {setup.otpauthUrl.slice(0, 60)}…
              </a>
            </p>
            <div className="flex gap-2">
              <input
                className={`${inputClass} w-40 font-mono tracking-widest`}
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
              <Button loading={busy} disabled={code.length !== 6} onClick={enable}>
                Confirm and enable
              </Button>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
          </>
        )}
      </div>
    </Card>
  );
}
