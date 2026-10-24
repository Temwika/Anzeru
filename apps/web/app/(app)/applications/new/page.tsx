"use client";

import { applicationCreateSchema, COLLATERAL_TYPES, LABELS, rateText } from "@anzelu/contracts";
import type { Schedule } from "@anzelu/finance";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  FileSignature,
  IdCard,
  Package,
  Plus,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";
import { PhotoCapture } from "@/components/photo-capture";
import { SignaturePad } from "@/components/signature-pad";
import { useToast } from "@/components/toast";
import { Avatar, Badge, Button, Card, Field, inputClass, Notice, PageHeader, ProgressBar, Skeleton, StatusBadge, Stepper, type Step } from "@/components/ui";
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
  requiresCollateral: boolean;
}

interface CustomerHit {
  id: string;
  firstName: string;
  lastName: string;
  customerNumber: string;
  phone: string;
  kycStatus: string;
}

interface CustomerDetail extends CustomerHit {
  nrc: string;
  monthlyIncome: string;
  branchName: string;
  documents: { id: string; docType: string }[];
}

const PERIODS_PER_YEAR = { daily: 365, weekly: 52, fortnightly: 26, monthly: 12 } as const;
const PERIOD_NOUN = { daily: "day", weekly: "week", fortnightly: "fortnight", monthly: "month" } as const;

const STEPS: { label: string; description: string; fields: (keyof Values)[] }[] = [
  { label: "Client", description: "Borrower & NRC", fields: ["customerId"] },
  { label: "Loan", description: "Product & amount", fields: ["productId", "amount", "term", "purpose"] },
  { label: "Affordability", description: "Monthly budget", fields: ["monthlyIncome", "monthlyExpenses", "existingDebtRepayments"] },
  { label: "Guarantor", description: "NRC & signature", fields: ["guarantors"] },
  { label: "Collateral", description: "Security pledged", fields: ["collateral"] },
  { label: "Sign", description: "Review & submit", fields: ["borrowerSignature"] },
];

type GuarantorFiles = Record<string, { front: File | null; back: File | null }>;

export default function NewApplicationPage() {
  const router = useRouter();
  const toast = useToast();
  const presetCustomer = useSearchParams().get("customerId") ?? "";
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Schedule | null>(null);
  const [gFiles, setGFiles] = useState<GuarantorFiles>({});
  const [cPhotos, setCPhotos] = useState<Record<string, File | null>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { data: products } = useApi<Product[]>("/loan-products?active=true");

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(applicationCreateSchema),
    defaultValues: { customerId: presetCustomer, existingDebtRepayments: "0", guarantors: [], collateral: [] },
    mode: "onTouched",
  });
  const guarantors = useFieldArray({ control, name: "guarantors" });
  const collateral = useFieldArray({ control, name: "collateral" });
  const [customerId, productId, amount, term, income, expenses, debt, borrowerSignature] = watch([
    "customerId",
    "productId",
    "amount",
    "term",
    "monthlyIncome",
    "monthlyExpenses",
    "existingDebtRepayments",
    "borrowerSignature",
  ]);
  const gValues = watch("guarantors");
  const cValues = watch("collateral");
  const product = products?.find((p) => p.id === productId);
  const { data: customer, refetch: refetchCustomer } = useApi<CustomerDetail>(customerId ? `/customers/${customerId}` : null);
  const clientNrc = customer?.documents.find((d) => d.docType === "nrc");
  const fixedTerm = product && product.minTerm === product.maxTerm;

  // Pre-fill income from the customer profile the first time a borrower is chosen.
  useEffect(() => {
    if (customer && !getValues("monthlyIncome")) setValue("monthlyIncome", Number(customer.monthlyIncome).toFixed(2));
  }, [customer, getValues, setValue]);

  // Products with one fixed term (the 28-day Marketeers Loan) fill it in for the officer.
  useEffect(() => {
    if (product && product.minTerm === product.maxTerm) setValue("term", product.minTerm, { shouldValidate: true });
  }, [product, setValue]);

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
  const collateralValue = (cValues ?? []).reduce((s, c) => s + (Number(c?.estimatedValue) || 0), 0);
  const cover = Number(amount) > 0 ? (collateralValue / Number(amount)) * 100 : 0;

  /** Checks that react-hook-form can't express: photos and signatures held outside the form. */
  function customStepError(): string | null {
    if (step === 0) {
      if (!customerId) return "Choose the borrower first.";
      if (!clientNrc) return "Capture a photo of the client’s NRC to continue.";
    }
    if (step === 3) {
      if (product?.requiresGuarantor && !guarantors.fields.length) return `${product.name} needs at least one guarantor.`;
      for (const [i, g] of guarantors.fields.entries()) {
        if (!gFiles[g.id]?.front) return `Take a photo of guarantor ${i + 1}’s NRC (front).`;
        if (!gValues?.[i]?.signature) return `Guarantor ${i + 1} must sign.`;
      }
    }
    if (step === 4 && product?.requiresCollateral && !collateral.fields.length) return `${product.name} needs collateral. Add at least one item.`;
    if (step === 5) {
      if (!borrowerSignature) return "The borrower must sign the application.";
      if (!consent) return "Confirm the declaration with the borrower.";
    }
    return null;
  }

  async function next() {
    const custom = customStepError();
    const ok = await trigger(STEPS[step].fields);
    setStepError(custom);
    if (ok && !custom) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const custom = customStepError();
    setStepError(custom);
    if (custom) return;
    setError(null);
    setSubmitting(true);
    try {
      const app = await api.post<{ id: string; applicationNumber: string; guarantors: { id: string }[]; collateral: { id: string }[] }>(
        "/applications",
        values,
      );
      // Photos go up once the application exists, matched to guarantors and items in the order they were entered.
      const uploads: Promise<unknown>[] = [];
      const send = (docType: string, file: File, ref: { guarantorId?: string; collateralId?: string }) => {
        const form = new FormData();
        form.set("docType", docType);
        if (ref.guarantorId) form.set("guarantorId", ref.guarantorId);
        if (ref.collateralId) form.set("collateralId", ref.collateralId);
        form.set("file", file);
        uploads.push(api.post(`/applications/${app.id}/documents`, form));
      };
      guarantors.fields.forEach((g, i) => {
        const files = gFiles[g.id];
        const guarantorId = app.guarantors[i]?.id;
        if (!guarantorId || !files) return;
        if (files.front) send("guarantor_nrc_front", files.front, { guarantorId });
        if (files.back) send("guarantor_nrc_back", files.back, { guarantorId });
      });
      collateral.fields.forEach((c, i) => {
        const photo = cPhotos[c.id];
        if (photo && app.collateral[i]) send("collateral_photo", photo, { collateralId: app.collateral[i].id });
      });
      const results = await Promise.allSettled(uploads);
      const failed = results.filter((r) => r.status === "rejected").length;
      toast(
        failed
          ? {
              tone: "error",
              title: `Application ${app.applicationNumber} submitted`,
              body: `${failed} photo(s) didn’t upload. Add them from the application page.`,
            }
          : { tone: "success", title: `Application ${app.applicationNumber} submitted`, body: "Scored and sent to a credit approver with all documents." },
      );
      router.push(`/applications/${app.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
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
        back={{ href: "/applications", label: "New Applicants" }}
        eyebrow="New loan"
        title="Loan application"
        description="Capture the client, the loan, the guarantor and the collateral in one sitting. Nothing is lost between steps."
      />

      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto border-b border-slate-100 px-4 py-5 sm:px-8">
            <Stepper steps={steps} />
          </div>

          <div key={step} className="animate-slide-up p-5 sm:p-8">
            {step === 0 && (
              <div className="space-y-6">
                <CustomerPicker
                  selectedId={customerId}
                  onSelect={(id) => {
                    setValue("customerId", id, { shouldValidate: true });
                    setValue("monthlyIncome", "");
                    setStepError(null);
                  }}
                />
                {customer && <ClientNrc customer={customer} onUploaded={() => refetchCustomer().then(() => setStepError(null))} />}
              </div>
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
                            <p className="tabular mt-1 text-sm font-medium text-brand-700">
                              {rateText(p.interestMethod, p.annualRatePct)} · {LABELS.frequency[p.repaymentFrequency]}
                            </p>
                            <p className="tabular mt-2 text-xs text-slate-500">
                              {kwacha(p.minAmount, { compact: true })}–{kwacha(p.maxAmount, { compact: true })} ·{" "}
                              {p.minTerm === p.maxTerm ? `${p.minTerm} ${PERIOD_NOUN[p.repaymentFrequency]}s` : `${p.minTerm}–${p.maxTerm} instalments`}
                            </p>
                            {(p.requiresGuarantor || p.requiresCollateral) && (
                              <span className="mt-2 flex flex-wrap gap-1">
                                {p.requiresGuarantor && <Badge tone="violet">Guarantor</Badge>}
                                {p.requiresCollateral && <Badge tone="amber">Collateral</Badge>}
                              </span>
                            )}
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
                    label={product ? `Number of ${LABELS.frequency[product.repaymentFrequency].toLowerCase()} payments` : "Number of payments"}
                    required
                    error={errors.term?.message}
                    hint={product ? (fixedTerm ? `Fixed at ${product.minTerm} for ${product.name}` : `${product.minTerm} to ${product.maxTerm}`) : undefined}
                  >
                    <input {...f("term")} inputMode="numeric" readOnly={!!fixedTerm} className={cn(inputClass, fixedTerm && "bg-slate-50 font-semibold")} />
                  </Field>
                  {product?.repaymentFrequency === "daily" && quote && (
                    <div className="sm:col-span-2">
                      <Notice tone="info">
                        The client pays <strong>{kwacha(quote.installmentAmount)} every day</strong> for {String(term)} days,{" "}
                        <strong>{kwacha(quote.totals.repayable)}</strong> in total.
                      </Notice>
                    </div>
                  )}
                  <Field
                    label="Purpose"
                    required
                    error={errors.purpose?.message}
                    className="sm:col-span-2"
                    hint="Be specific: it helps the approver and is kept on record"
                  >
                    <input {...f("purpose")} placeholder="e.g. Restock vegetables and dried fish for the stall" />
                  </Field>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <Notice tone="info">Use verified monthly figures: a payslip, the market levy book, or three months of mobile-money statements.</Notice>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field
                    label="Net monthly income"
                    required
                    error={errors.monthlyIncome?.message}
                    hint={customer ? "Pre-filled from the client profile" : undefined}
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
                      New repayments ≈ <strong>{kwacha(monthlyInstalment)}</strong> a month. After expenses and all repayments the client keeps{" "}
                      <strong className={leftOver < 0 ? "text-rose-700" : ""}>{kwacha(leftOver)}</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <SectionIntro
                  icon={UserPlus}
                  title="Guarantor"
                  body={
                    product?.requiresGuarantor
                      ? `${product.name} needs at least one guarantor. Photograph their NRC and have them sign on screen.`
                      : "Optional for this product. If added, the NRC photo and signature are required."
                  }
                  action={
                    guarantors.fields.length < 3 && (
                      <Button size="sm" variant="soft" onClick={() => guarantors.append({ fullName: "", nrc: "", phone: "", relationship: "", address: "" })}>
                        <Plus className="size-4" /> Add guarantor
                      </Button>
                    )
                  }
                />
                {guarantors.fields.length === 0 && (
                  <EmptySlot
                    warn={!!product?.requiresGuarantor}
                    text={product?.requiresGuarantor ? "Add the guarantor before continuing." : "No guarantor added."}
                    onAdd={() => guarantors.append({ fullName: "", nrc: "", phone: "", relationship: "", address: "" })}
                    label="Add guarantor"
                  />
                )}
                {guarantors.fields.map((g, i) => {
                  const files = gFiles[g.id] ?? { front: null, back: null };
                  const setFile = (side: "front" | "back", file: File | null) => setGFiles((all) => ({ ...all, [g.id]: { ...files, [side]: file } }));
                  return (
                    <div key={g.id} className="rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <span className="grid size-6 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">{i + 1}</span>
                          {gValues?.[i]?.fullName || "Guarantor"}
                        </p>
                        <button
                          type="button"
                          onClick={() => guarantors.remove(i)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Remove guarantor"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <div className="space-y-5 p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Full name" required error={errors.guarantors?.[i]?.fullName?.message}>
                            <input className={inputClass} {...register(`guarantors.${i}.fullName`)} />
                          </Field>
                          <Field label="NRC number" required error={errors.guarantors?.[i]?.nrc?.message}>
                            <input className={inputClass} placeholder="123456/78/1" {...register(`guarantors.${i}.nrc`)} />
                          </Field>
                          <Field label="Phone" required error={errors.guarantors?.[i]?.phone?.message}>
                            <input className={inputClass} inputMode="tel" placeholder="0971234567" {...register(`guarantors.${i}.phone`)} />
                          </Field>
                          <Field label="Relationship to client" required error={errors.guarantors?.[i]?.relationship?.message}>
                            <input className={inputClass} placeholder="e.g. Fellow marketeer, brother" {...register(`guarantors.${i}.relationship`)} />
                          </Field>
                          <Field label="Physical address" className="sm:col-span-2" error={errors.guarantors?.[i]?.address?.message}>
                            <input className={inputClass} placeholder="Plot, area, town" {...register(`guarantors.${i}.address`)} />
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <PhotoCapture
                            label="NRC — front"
                            required
                            file={files.front}
                            onChange={(file) => setFile("front", file)}
                            invalid={!!stepError && !files.front}
                          />
                          <PhotoCapture label="NRC — back" hint="Optional" file={files.back} onChange={(file) => setFile("back", file)} />
                        </div>
                        <div>
                          <p className="mb-1.5 text-[13px] font-medium text-slate-700">
                            Guarantor’s signature <span className="text-rose-500">*</span>
                          </p>
                          <SignaturePad
                            label={`${gValues?.[i]?.fullName || "Guarantor"} signs here`}
                            value={gValues?.[i]?.signature}
                            onChange={(sig) => setValue(`guarantors.${i}.signature`, sig ?? undefined)}
                            invalid={!!stepError && !gValues?.[i]?.signature}
                          />
                          <p className="mt-1 text-xs text-slate-500">By signing, the guarantor agrees to repay the loan if the client does not.</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <SectionIntro
                  icon={Package}
                  title="Collateral"
                  body={
                    product?.requiresCollateral
                      ? `${product.name} must be secured. Record each item and photograph it.`
                      : "Optional. Record anything the client pledges as security."
                  }
                  action={
                    collateral.fields.length < 5 && (
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() => collateral.append({ type: "household_goods", description: "", estimatedValue: "", identifier: "", location: "" })}
                      >
                        <Plus className="size-4" /> Add item
                      </Button>
                    )
                  }
                />
                {collateral.fields.length === 0 && (
                  <EmptySlot
                    warn={!!product?.requiresCollateral}
                    text={product?.requiresCollateral ? "Record at least one item before continuing." : "No collateral recorded."}
                    onAdd={() => collateral.append({ type: "household_goods", description: "", estimatedValue: "", identifier: "", location: "" })}
                    label="Add item"
                  />
                )}
                {collateral.fields.map((c, i) => (
                  <div key={c.id} className="rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">Item {i + 1}</p>
                      <button
                        type="button"
                        onClick={() => collateral.remove(i)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove item"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="grid gap-4 p-4 sm:grid-cols-[1fr_220px]">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Type" required error={errors.collateral?.[i]?.type?.message}>
                          <select className={inputClass} {...register(`collateral.${i}.type`)}>
                            {COLLATERAL_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {LABELS.collateralType[t]}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Estimated value (ZMW)" required error={errors.collateral?.[i]?.estimatedValue?.message}>
                          <input className={inputClass} inputMode="decimal" placeholder="0.00" {...register(`collateral.${i}.estimatedValue`)} />
                        </Field>
                        <Field label="Description" required className="sm:col-span-2" error={errors.collateral?.[i]?.description?.message}>
                          <input className={inputClass} placeholder="e.g. 32-inch Hisense TV, black" {...register(`collateral.${i}.description`)} />
                        </Field>
                        <Field label="Serial / registration / title no." error={errors.collateral?.[i]?.identifier?.message}>
                          <input className={inputClass} {...register(`collateral.${i}.identifier`)} />
                        </Field>
                        <Field label="Where it is kept" error={errors.collateral?.[i]?.location?.message}>
                          <input className={inputClass} placeholder="e.g. Client's home, Sinda" {...register(`collateral.${i}.location`)} />
                        </Field>
                      </div>
                      <PhotoCapture
                        label="Photo"
                        hint="Recommended"
                        file={cPhotos[c.id] ?? null}
                        onChange={(file) => setCPhotos((all) => ({ ...all, [c.id]: file }))}
                      />
                    </div>
                  </div>
                ))}
                {collateral.fields.length > 0 && Number(amount) > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-5 py-4 text-sm">
                    <span className="text-slate-600">
                      Collateral value <strong className="tabular text-slate-900">{kwacha(collateralValue)}</strong> against a loan of{" "}
                      <strong className="tabular text-slate-900">{kwacha(amount as string)}</strong>
                    </span>
                    <Badge tone={cover >= 100 ? "green" : cover >= 50 ? "amber" : "red"}>{cover.toFixed(0)}% cover</Badge>
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <SectionIntro icon={FileSignature} title="Review and sign" body="Read the summary to the client, then have them sign on screen." />
                <dl className="grid gap-x-6 gap-y-4 rounded-2xl bg-slate-50 p-5 text-sm sm:grid-cols-2">
                  <Summary label="Client">{customer ? `${customer.firstName} ${customer.lastName} · ${customer.nrc}` : "—"}</Summary>
                  <Summary label="Product">{product?.name ?? "—"}</Summary>
                  <Summary label="Amount">{kwacha(amount as string)}</Summary>
                  <Summary label="Repayment">
                    {quote && product ? `${kwacha(quote.installmentAmount)} per ${PERIOD_NOUN[product.repaymentFrequency]} × ${String(term)}` : "—"}
                  </Summary>
                  <Summary label="Total to repay">{quote ? kwacha(quote.totals.repayable) : "—"}</Summary>
                  <Summary label="Purpose">{getValues("purpose") || "—"}</Summary>
                  <Summary label="Guarantors">{gValues?.length ? gValues.map((g) => g.fullName).join(", ") : "None"}</Summary>
                  <Summary label="Collateral">{cValues?.length ? `${cValues.length} item(s), ${kwacha(collateralValue)}` : "None"}</Summary>
                </dl>
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-slate-700">
                    Client’s signature <span className="text-rose-500">*</span>
                  </p>
                  <SignaturePad
                    label={customer ? `${customer.firstName} ${customer.lastName} signs here` : "Client signs here"}
                    value={borrowerSignature}
                    onChange={(sig) => setValue("borrowerSignature", sig ?? undefined)}
                    invalid={!!stepError && !borrowerSignature}
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50/50">
                  <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span className="text-sm leading-relaxed text-slate-700">
                    <span className="font-semibold text-slate-900">The client confirms the information is true</span> and understands the repayment amounts, the
                    total cost and that the collateral may be recovered if the loan is not repaid.
                  </span>
                </label>
                {error && <Notice tone="error">{error}</Notice>}
              </div>
            )}

            {stepError && (
              <div className="mt-5">
                <Notice tone="error">{stepError}</Notice>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-8">
            {step === 0 ? (
              <Button variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setStepError(null);
                  setStep((s) => s - 1);
                }}
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
            )}
            <span className="hidden text-xs text-slate-500 sm:block">
              Step {step + 1} of {STEPS.length}
            </span>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button type="submit" loading={submitting}>
                <Send className="size-4" /> Submit application
              </Button>
            )}
          </div>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="bg-ink-950 p-5 text-white">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Repayment</p>
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
                <Row label="Client receives">{kwacha(quote.netDisbursed)}</Row>
                <Row label="Processing fee">{kwacha(quote.processingFee)}</Row>
                <Row label="Total interest">{kwacha(quote.totals.interest)}</Row>
                <Row label="Total repayable" strong>
                  {kwacha(quote.totals.repayable)}
                </Row>
              </dl>
            )}
          </Card>
          {customer && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
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
              </div>
              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
                <Check2 ok={!!clientNrc}>Client NRC photo</Check2>
                <Check2 ok={!product?.requiresGuarantor || guarantors.fields.length > 0} optional={!product?.requiresGuarantor}>
                  Guarantor{guarantors.fields.length > 1 ? "s" : ""} {guarantors.fields.length ? `(${guarantors.fields.length})` : ""}
                </Check2>
                <Check2 ok={!product?.requiresCollateral || collateral.fields.length > 0} optional={!product?.requiresCollateral}>
                  Collateral {collateral.fields.length ? `(${kwacha(collateralValue, { compact: true })})` : ""}
                </Check2>
                <Check2 ok={!!borrowerSignature}>Client signature</Check2>
              </ul>
            </Card>
          )}
        </aside>
      </form>
    </>
  );
}

/** Shows the client's NRC photo on file, or lets the officer take it now. */
function ClientNrc({ customer, onUploaded }: { customer: CustomerDetail; onUploaded: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const doc = customer.documents.find((d) => d.docType === "nrc");

  async function upload(f: File | null) {
    setFile(f);
    if (!f) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("docType", "nrc");
      form.set("file", f);
      await api.post(`/customers/${customer.id}/documents`, form);
      toast({ tone: "success", title: "Client NRC saved" });
      onUploaded();
    } catch (e) {
      toast({ tone: "error", title: "Couldn’t save the NRC photo", body: (e as Error).message });
      setFile(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("rounded-2xl border p-4", doc ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40")}>
      <div className="grid gap-4 sm:grid-cols-[1fr_220px] sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <IdCard className={cn("size-4", doc ? "text-emerald-600" : "text-amber-600")} /> Client NRC · {customer.nrc}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {doc
              ? "A photo of the NRC is on file. Retake it if it is unclear."
              : "No NRC photo on file yet. Take one now; the loan can’t be approved without it."}
          </p>
          {busy && <p className="mt-2 text-xs font-medium text-brand-700">Saving…</p>}
        </div>
        <PhotoCapture
          label="NRC photo"
          required
          file={file}
          existingUrl={doc ? `/api/v1/customers/${customer.id}/documents/${doc.id}?inline=1` : null}
          onChange={upload}
        />
      </div>
    </div>
  );
}

function CustomerPicker({ selectedId, onSelect }: { selectedId?: string; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const { data, isFetching } = usePage<CustomerHit>(`/customers${qs({ search, pageSize: 6 })}`);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Who is borrowing?</p>
          <p className="mt-0.5 text-sm text-slate-500">Search by name, NRC, phone or client number.</p>
        </div>
        <Link href="/customers/new" className="text-sm font-medium text-brand-700 hover:underline">
          + Register a new client
        </Link>
      </div>
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
            No client matches “{search}”.{" "}
            <Link href="/customers/new" className="font-medium text-brand-700 hover:underline">
              Register them first
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}

function SectionIntro({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-500">{body}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function EmptySlot({ warn, text, onAdd, label }: { warn: boolean; text: string; onAdd: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-sm transition",
        warn
          ? "border-amber-300 bg-amber-50/50 text-amber-800 hover:bg-amber-50"
          : "border-slate-200 text-slate-500 hover:border-brand-300 hover:bg-brand-50/40",
      )}
    >
      <Plus className="size-5" />
      <span className="font-semibold">{label}</span>
      <span className="text-xs">{text}</span>
    </button>
  );
}

function Check2({ ok, optional, children }: { ok: boolean; optional?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <BadgeCheck className="size-4 text-emerald-600" /> : <span className="size-4 rounded-full border-2 border-slate-300" />}
      <span className={ok ? "text-slate-800" : "text-slate-500"}>{children}</span>
      {optional && <span className="ml-auto text-[11px] text-slate-400">optional</span>}
    </li>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="tabular mt-0.5 font-medium text-slate-900">{children}</dd>
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
