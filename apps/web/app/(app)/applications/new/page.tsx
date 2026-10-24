"use client";

import { applicationCreateSchema, LABELS, rateText } from "@anzelu/contracts";
import type { Schedule } from "@anzelu/finance";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Search, Send, ShieldAlert, ShieldCheck, Trash2, UserPlus, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";
import { useToast } from "@/components/toast";
import { Avatar, Button, Card, Field, inputClass, Notice, PageHeader, ProgressBar, Skeleton, StatusBadge, Stepper, type Step } from "@/components/ui";
import { api, qs, useApi, usePage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kwacha, pct } from "@/lib/format";

type Values = z.input<typeof applicationCreateSchema>;

interface Product {
  id: string;
  name: string;
  code: string;
  description: string | null;
  interestMethod: keyof typeof LABELS.interestMethod;
  annualRatePct: string;
  repaymentFrequency: keyof typeof LABELS.frequency;
  minAmount: string;
  maxAmount: string;
  minTerm: number;
  maxTerm: number;
  processingFeePct: string;
  maxDtiPct: string;
  requiresGuarantor: boolean;
}

interface CustomerHit {
  id: string;
  firstName: string;
  lastName: string;
  customerNumber: string;
  phone: string;
  kycStatus: string;
}

const PERIODS_PER_YEAR = { daily: 365, weekly: 52, fortnightly: 26, monthly: 12 } as const;
const PERIOD_NOUN = { daily: "day", weekly: "week", fortnightly: "fortnight", monthly: "month" } as const;

const STEPS: { label: string; description: string; fields: (keyof Values)[] }[] = [
  { label: "Borrower", description: "Who is borrowing", fields: ["customerId"] },
  { label: "Loan", description: "Product, amount, term", fields: ["productId", "amount", "term", "purpose"] },
  { label: "Affordability", description: "Monthly budget", fields: ["monthlyIncome", "monthlyExpenses", "existingDebtRepayments"] },
  { label: "Guarantors", description: "Review & submit", fields: ["guarantors"] },
];

export default function NewApplicationPage() {
  const router = useRouter();
  const toast = useToast();
  const presetCustomer = useSearchParams().get("customerId") ?? "";
  const [step, setStep] = useState(presetCustomer ? 1 : 0);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Schedule | null>(null);
  const { data: products } = useApi<Product[]>("/loan-products?active=true");

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(applicationCreateSchema),
    defaultValues: { customerId: presetCustomer, existingDebtRepayments: "0", guarantors: [] },
    mode: "onTouched",
  });
  const guarantors = useFieldArray({ control, name: "guarantors" });
  const [customerId, productId, amount, term, income, expenses, debt] = watch([
    "customerId",
    "productId",
    "amount",
    "term",
    "monthlyIncome",
    "monthlyExpenses",
    "existingDebtRepayments",
  ]);
  const product = products?.find((p) => p.id === productId);
  const { data: customer } = useApi<CustomerHit & { monthlyIncome: string; branchName: string }>(customerId ? `/customers/${customerId}` : null);

  // Pre-fill income from the customer profile the first time a borrower is chosen.
  useEffect(() => {
    if (customer && !getValues("monthlyIncome")) setValue("monthlyIncome", Number(customer.monthlyIncome).toFixed(2));
  }, [customer, getValues, setValue]);

  useEffect(() => {
    if (!product || !amount || !term) return setQuote(null);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount,
          term,
          annualRatePct: product.annualRatePct,
          interestMethod: product.interestMethod,
          frequency: product.repaymentFrequency,
          processingFeePct: product.processingFeePct,
        }),
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((j) => setQuote(j.data ?? null))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [product, amount, term]);

  const monthlyInstalment = quote && product ? (Number(quote.installmentAmount) * PERIODS_PER_YEAR[product.repaymentFrequency]) / 12 : 0;
  const dti = Number(income) > 0 && quote ? ((monthlyInstalment + Number(debt || 0)) / Number(income)) * 100 : null;
  const leftOver = Number(income || 0) - Number(expenses || 0) - Number(debt || 0) - monthlyInstalment;
  const dtiLimit = product ? Number(product.maxDtiPct) : 40;

  async function next() {
    if (step === 0 && !customerId) return;
    if (await trigger(STEPS[step].fields)) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const app = await api.post<{ id: string; applicationNumber: string }>("/applications", values);
      toast({ tone: "success", title: `Application ${app.applicationNumber ?? ""} submitted`, body: "It has been scored and sent to a credit approver." });
      router.push(`/applications/${app.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  });

  const f = (name: keyof Values) => ({ ...register(name), "aria-invalid": !!errors[name], className: inputClass });
  const steps: Step[] = STEPS.map((s, i) => ({
    label: s.label,
    description: s.description,
    state: i < step ? "complete" : i === step ? "current" : "upcoming",
  }));

  return (
    <>
      <PageHeader
        back={{ href: "/applications", label: "Applications" }}
        eyebrow="Origination"
        title="New loan application"
        description="Four quick steps. The server re-checks affordability and scores the application on submit."
      />

      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-5 sm:px-8">
            <Stepper steps={steps} />
          </div>

          <div key={step} className="animate-slide-up p-5 sm:p-8">
            {step === 0 && (
              <CustomerPicker
                selectedId={customerId}
                onSelect={(id) => {
                  setValue("customerId", id, { shouldValidate: true });
                  setValue("monthlyIncome", "");
                }}
              />
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <p className="mb-3 text-[13px] font-medium text-slate-700">
                    Loan product <span className="text-rose-500">*</span>
                  </p>
                  {!products ? (
                    <Skeleton className="h-28" />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {products.map((p) => {
                        const on = p.id === productId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setValue("productId", p.id, { shouldValidate: true })}
                            className={cn(
                              "relative rounded-2xl border p-4 text-left transition",
                              on
                                ? "border-brand-500 bg-brand-50/60 shadow-[0_0_0_3px_var(--color-brand-100)]"
                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                            )}
                          >
                            {on && (
                              <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                                <Check className="size-3" />
                              </span>
                            )}
                            <p className="pr-6 font-semibold text-slate-900">{p.name}</p>
                            <p className="tabular mt-1 text-sm text-slate-600">
                              {rateText(p.interestMethod, p.annualRatePct)} · {LABELS.frequency[p.repaymentFrequency]}
                            </p>
                            <p className="tabular mt-2 text-xs text-slate-500">
                              {kwacha(p.minAmount, { compact: true })}–{kwacha(p.maxAmount, { compact: true })} · {p.minTerm}–{p.maxTerm} instalments
                              {p.requiresGuarantor && " · guarantor"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {errors.productId && <p className="mt-2 text-xs font-medium text-rose-600">Choose a product</p>}
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Amount (ZMW)"
                    required
                    error={errors.amount?.message}
                    hint={product ? `Between ${kwacha(product.minAmount)} and ${kwacha(product.maxAmount)}` : undefined}
                  >
                    <input {...f("amount")} inputMode="decimal" placeholder="0.00" />
                  </Field>
                  <Field
                    label={product ? `Number of ${LABELS.frequency[product.repaymentFrequency].toLowerCase()} instalments` : "Number of instalments"}
                    required
                    error={errors.term?.message}
                    hint={product ? `${product.minTerm} to ${product.maxTerm}` : undefined}
                  >
                    <input {...f("term")} inputMode="numeric" />
                  </Field>
                  <Field
                    label="Purpose"
                    required
                    error={errors.purpose?.message}
                    className="sm:col-span-2"
                    hint="Be specific: it helps the approver and is kept on record"
                  >
                    <input {...f("purpose")} placeholder="e.g. Restock shop inventory before the festive season" />
                  </Field>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <Notice tone="info">Use verified monthly figures from the latest payslip or three months of bank or mobile-money statements.</Notice>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field
                    label="Net monthly income"
                    required
                    error={errors.monthlyIncome?.message}
                    hint={customer ? "Pre-filled from the customer profile" : undefined}
                  >
                    <input {...f("monthlyIncome")} inputMode="decimal" />
                  </Field>
                  <Field label="Living expenses" required error={errors.monthlyExpenses?.message}>
                    <input {...f("monthlyExpenses")} inputMode="decimal" placeholder="0.00" />
                  </Field>
                  <Field label="Other loan repayments" required error={errors.existingDebtRepayments?.message}>
                    <input {...f("existingDebtRepayments")} inputMode="decimal" />
                  </Field>
                </div>
                {dti !== null && (
                  <div className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        {dti <= dtiLimit ? <ShieldCheck className="size-4 text-emerald-600" /> : <ShieldAlert className="size-4 text-rose-600" />}
                        Debt-to-income {pct(dti)}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          dti <= dtiLimit ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                        )}
                      >
                        {dti <= dtiLimit ? "Within" : "Above"} {dtiLimit}% policy
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar
                        value={(dti / Math.max(dtiLimit * 1.5, 1)) * 100}
                        tone={dti <= dtiLimit * 0.85 ? "brand" : dti <= dtiLimit ? "amber" : "rose"}
                        label="Debt-to-income"
                      />
                    </div>
                    <p className="tabular mt-3 text-sm text-slate-600">
                      New instalment ≈ <strong>{kwacha(monthlyInstalment)}</strong> a month. After expenses and all repayments the customer keeps{" "}
                      <strong className={leftOver < 0 ? "text-rose-700" : ""}>{kwacha(leftOver)}</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Guarantors</p>
                    <p className="text-xs text-slate-500">
                      {product?.requiresGuarantor ? "This product requires at least one guarantor." : "Optional for this product, up to three."}
                    </p>
                  </div>
                  {guarantors.fields.length < 3 && (
                    <Button size="sm" variant="soft" onClick={() => guarantors.append({ fullName: "", nrc: "", phone: "", relationship: "" })}>
                      <UserPlus className="size-4" /> Add guarantor
                    </Button>
                  )}
                </div>
                {guarantors.fields.length === 0 && (
                  <div
                    className={cn(
                      "rounded-2xl border border-dashed p-6 text-center text-sm",
                      product?.requiresGuarantor ? "border-amber-300 bg-amber-50/50 text-amber-800" : "border-slate-200 text-slate-500",
                    )}
                  >
                    {product?.requiresGuarantor ? "Add a guarantor before submitting." : "No guarantors added."}
                  </div>
                )}
                {guarantors.fields.map((g, i) => (
                  <div key={g.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Guarantor {i + 1}</p>
                      <button
                        type="button"
                        onClick={() => guarantors.remove(i)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove guarantor"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Full name" error={errors.guarantors?.[i]?.fullName?.message}>
                        <input className={inputClass} {...register(`guarantors.${i}.fullName`)} />
                      </Field>
                      <Field label="NRC" error={errors.guarantors?.[i]?.nrc?.message}>
                        <input className={inputClass} placeholder="123456/78/1" {...register(`guarantors.${i}.nrc`)} />
                      </Field>
                      <Field label="Phone" error={errors.guarantors?.[i]?.phone?.message}>
                        <input className={inputClass} inputMode="tel" {...register(`guarantors.${i}.phone`)} />
                      </Field>
                      <Field label="Relationship" error={errors.guarantors?.[i]?.relationship?.message}>
                        <input className={inputClass} placeholder="e.g. Brother, employer" {...register(`guarantors.${i}.relationship`)} />
                      </Field>
                    </div>
                  </div>
                ))}
                {error && <Notice tone="error">{error}</Notice>}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-8">
            {step === 0 ? (
              <Button variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="size-4" /> Back
              </Button>
            )}
            <span className="hidden text-xs text-slate-500 sm:block">
              Step {step + 1} of {STEPS.length}
            </span>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={step === 0 && !customerId}>
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button type="submit" loading={isSubmitting}>
                <Send className="size-4" /> Submit for decision
              </Button>
            )}
          </div>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="bg-ink-950 p-5 text-white">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Indicative repayment</p>
              {quote && product ? (
                <>
                  <p className="tabular mt-2 font-display text-3xl font-bold">{kwacha(quote.installmentAmount)}</p>
                  <p className="text-sm text-slate-400">
                    per {PERIOD_NOUN[product.repaymentFrequency]} × {String(term)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Choose a product, amount and term to see the repayment.</p>
              )}
            </div>
            {quote && (
              <dl className="tabular divide-y divide-slate-100 text-sm">
                <Row label="Customer receives">{kwacha(quote.netDisbursed)}</Row>
                <Row label="Processing fee">{kwacha(quote.processingFee)}</Row>
                <Row label="Total interest">{kwacha(quote.totals.interest)}</Row>
                <Row label="Total repayable" strong>
                  {kwacha(quote.totals.repayable)}
                </Row>
                <Row label="APR incl. fees">{pct(quote.disclosure.aprPct)}</Row>
              </dl>
            )}
          </Card>
          {customer && (
            <Card className="flex items-center gap-3 p-4">
              <Avatar name={`${customer.firstName} ${customer.lastName}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {customer.firstName} {customer.lastName}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {customer.customerNumber} · {customer.branchName}
                </p>
              </div>
              <StatusBadge status={customer.kycStatus} />
            </Card>
          )}
          <p className="px-1 text-xs leading-relaxed text-slate-500">
            The final schedule is fixed on the disbursement date. Figures here use the same engine that books the loan.
          </p>
        </aside>
      </form>
    </>
  );
}

function CustomerPicker({ selectedId, onSelect }: { selectedId?: string; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const { data, isFetching } = usePage<CustomerHit>(`/customers${qs({ search, pageSize: 6 })}`);
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">Who is borrowing?</p>
      <p className="mt-0.5 text-sm text-slate-500">Search by name, NRC, phone or customer number. Only KYC-verified customers can be approved.</p>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input autoFocus className={cn(inputClass, "py-3 pl-10")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Start typing…" />
      </div>
      <ul className={cn("mt-3 space-y-2 transition", isFetching && "opacity-60")}>
        {data?.items.map((c) => {
          const on = selectedId === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                  on
                    ? "border-brand-500 bg-brand-50/60 shadow-[0_0_0_3px_var(--color-brand-100)]"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <Avatar name={`${c.firstName} ${c.lastName}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {c.customerNumber} · {c.phone}
                  </span>
                </span>
                <StatusBadge status={c.kycStatus} />
                {on && (
                  <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                    <Check className="size-3" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {data?.items.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            <UserRound className="mx-auto mb-2 size-5 text-slate-400" />
            No customer matches “{search}”.{" "}
            <Link href="/customers/new" className="font-medium text-brand-700 hover:underline">
              Register them first
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 px-5 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn("text-slate-900", strong ? "font-bold" : "font-medium")}>{children}</dd>
    </div>
  );
}
