"use client";

import { customerCreateSchema } from "@anzelu/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, BadgeCheck, FileText, IdCard, Lock, Phone, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { useToast } from "@/components/toast";
import { Button, Card, Field, inputClass, Notice, PageHeader, Stepper, type Step } from "@/components/ui";
import { api, useApi, useSession } from "@/lib/api";
import { kwacha, shortDate } from "@/lib/format";

type Values = z.input<typeof customerCreateSchema>;

const STEPS: { label: string; description: string; fields: (keyof Values)[] }[] = [
  { label: "Identity", description: "Who they are", fields: ["firstName", "lastName", "nrc", "dateOfBirth", "gender", "branchId"] },
  { label: "Contact & income", description: "How to reach them", fields: ["phone", "email", "address", "nextOfKinName", "nextOfKinPhone", "employer", "occupation", "monthlyIncome"] },
  { label: "Review & consent", description: "Confirm and save", fields: ["consent"] },
];

export default function NewCustomerPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: user } = useSession();
  const { data: branches } = useApi<{ id: string; name: string }[]>("/branches");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(customerCreateSchema), defaultValues: { gender: "female" }, mode: "onTouched" });

  const allowed = branches?.filter((b) => !user || ["institution_admin", "credit_manager"].includes(user.role) || user.branchIds.includes(b.id));
  const f = (name: keyof Values) => ({ ...register(name), "aria-invalid": !!errors[name], className: inputClass });

  async function next() {
    if (await trigger(STEPS[step].fields)) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const c = await api.post<{ id: string; warnings: string[] }>("/customers", values);
      toast({ tone: "success", title: `${values.firstName} ${values.lastName} registered`, body: "Next, upload their NRC so a manager can verify KYC." });
      router.push(`/customers/${c.id}${c.warnings.length ? `?warning=${encodeURIComponent(c.warnings[0])}` : ""}`);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "DUPLICATE_NRC") {
        setFieldError("nrc", { message: err.message });
        setStep(0);
      } else setError(err.message);
    }
  });

  const steps: Step[] = STEPS.map((s, i) => ({ label: s.label, description: s.description, state: i < step ? "complete" : i === step ? "current" : "upcoming" }));
  const v = getValues();
  const branchName = allowed?.find((b) => b.id === v.branchId)?.name;

  return (
    <>
      <PageHeader back={{ href: "/customers", label: "Customers" }} eyebrow="Onboarding" title="Register a customer" description="Three short steps. Consent is captured before any credit check." />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <form onSubmit={onSubmit} noValidate>
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-5 sm:px-10">
              <Stepper steps={steps} />
            </div>

            <div key={step} className="animate-slide-up p-5 sm:p-8">
              {step === 0 && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="First name" required error={errors.firstName?.message}>
                    <input {...f("firstName")} autoComplete="given-name" />
                  </Field>
                  <Field label="Last name" required error={errors.lastName?.message}>
                    <input {...f("lastName")} autoComplete="family-name" />
                  </Field>
                  <Field label="NRC number" required error={errors.nrc?.message} hint="As printed on the card, e.g. 123456/78/1">
                    <input {...f("nrc")} placeholder="123456/78/1" />
                  </Field>
                  <Field label="Date of birth" required error={errors.dateOfBirth?.message} hint="Must be 18 or older">
                    <input type="date" {...f("dateOfBirth")} />
                  </Field>
                  <Field label="Gender" error={errors.gender?.message}>
                    <select {...f("gender")}>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field label="Home branch" required error={errors.branchId?.message} hint="The branch that will service this customer">
                    <select {...f("branchId")} defaultValue="">
                      <option value="" disabled>
                        Select branch
                      </option>
                      {allowed?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-8">
                  <section>
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Phone className="size-4 text-brand-600" /> Contact
                    </h3>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Mobile number" required error={errors.phone?.message} hint="Receives SMS reminders and mobile-money payouts">
                        <input {...f("phone")} placeholder="0971234567" inputMode="tel" autoComplete="tel" />
                      </Field>
                      <Field label="Email" error={errors.email?.message}>
                        <input type="email" {...f("email")} autoComplete="email" />
                      </Field>
                      <Field label="Physical address" required error={errors.address?.message} className="sm:col-span-2">
                        <input {...f("address")} placeholder="Plot, street, area, town" />
                      </Field>
                      <Field label="Next of kin" error={errors.nextOfKinName?.message}>
                        <input {...f("nextOfKinName")} />
                      </Field>
                      <Field label="Next of kin phone" error={errors.nextOfKinPhone?.message}>
                        <input {...f("nextOfKinPhone")} inputMode="tel" />
                      </Field>
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Wallet className="size-4 text-brand-600" /> Income
                    </h3>
                    <div className="grid gap-5 sm:grid-cols-3">
                      <Field label="Employer or business" error={errors.employer?.message}>
                        <input {...f("employer")} />
                      </Field>
                      <Field label="Occupation" error={errors.occupation?.message}>
                        <input {...f("occupation")} />
                      </Field>
                      <Field label="Net monthly income (ZMW)" required error={errors.monthlyIncome?.message}>
                        <input {...f("monthlyIncome")} inputMode="decimal" placeholder="0.00" />
                      </Field>
                    </div>
                  </section>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <dl className="grid gap-x-6 gap-y-4 rounded-2xl bg-slate-50 p-5 text-sm sm:grid-cols-2">
                    <Summary label="Name" value={`${v.firstName ?? ""} ${v.lastName ?? ""}`} />
                    <Summary label="NRC" value={v.nrc} />
                    <Summary label="Date of birth" value={shortDate(v.dateOfBirth as string)} />
                    <Summary label="Branch" value={branchName} />
                    <Summary label="Mobile" value={v.phone} />
                    <Summary label="Address" value={v.address as string} />
                    <Summary label="Employer" value={(v.employer as string | undefined) || "—"} />
                    <Summary label="Monthly income" value={v.monthlyIncome ? kwacha(v.monthlyIncome as string) : "—"} />
                  </dl>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50/50">
                    <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" {...register("consent")} />
                    <span className="text-sm leading-relaxed text-slate-700">
                      <span className="font-semibold text-slate-900">The customer gives consent.</span> They agree to the processing of their personal data under the
                      Data Protection Act, 2021, and to credit checks for this and future applications.
                      {errors.consent && <span className="mt-1 block text-xs font-medium text-rose-600">{errors.consent.message}</span>}
                    </span>
                  </label>
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
                <Button onClick={next}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button type="submit" loading={isSubmitting}>
                  <BadgeCheck className="size-4" /> Register customer
                </Button>
              )}
            </div>
          </Card>
        </form>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">Have these ready</p>
            <ul className="mt-3 space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <IdCard className="mt-0.5 size-4 shrink-0 text-brand-600" /> Green NRC card (both sides) for upload after registering
              </li>
              <li className="flex gap-3">
                <FileText className="mt-0.5 size-4 shrink-0 text-brand-600" /> Latest payslip or 3 months of bank / mobile-money statements
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-brand-600" /> An active MTN or Airtel number in the customer&apos;s name
              </li>
            </ul>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">What happens next</p>
            <ol className="mt-3 space-y-3 text-sm text-slate-600">
              {["Upload the NRC and income proof", "A manager verifies KYC", "Start a loan application"].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </Card>
          <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-slate-500">
            <Lock className="mt-0.5 size-3.5 shrink-0" /> We check for duplicates by NRC, phone, and surname with date of birth before saving.
          </p>
        </aside>
      </div>
    </>
  );
}

function Summary({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value || "—"}</dd>
    </div>
  );
}
