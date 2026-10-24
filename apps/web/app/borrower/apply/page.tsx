"use client";

import type { Frequency } from "@anzelu/contracts";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, Info, PartyPopper, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DocumentUploads } from "@/components/borrower-documents";
import { ApplicationTracker, perPeriod, periods, ProductCard, type BorrowerProduct } from "@/components/borrower-ui";
import { Button, ButtonLink, Card, ErrorState, Field, inputClass, Skeleton, Stepper, type Step } from "@/components/ui";
import { api, ApiError, fieldErrors, useApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kwacha, pct, shortDate } from "@/lib/format";
import { useQuote } from "@/lib/quote";

const PERIODS_PER_YEAR: Record<Frequency, number> = { daily: 365, weekly: 52, fortnightly: 26, monthly: 12 };
const PURPOSES = ["School fees", "Business stock", "Medical bills", "Home improvement", "Farming inputs", "Emergency"];

interface Me {
  firstName: string;
  monthlyIncome: string | null;
  institution: string;
}

interface Guarantor {
  fullName: string;
  nrc: string;
  phone: string;
  relationship: string;
}

/** Round to a step that suits the product's range, so the slider moves in sensible amounts. */
function amountStep(min: number, max: number) {
  const span = max - min;
  return span > 100_000 ? 1000 : span > 20_000 ? 500 : 100;
}

export default function ApplyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: products, error } = useApi<BorrowerProduct[]>("/borrower/products");
  const { data: me } = useApi<Me>("/borrower/me");

  // A top-up link arrives with the product chosen, so it starts at the amount.
  const [step, setStep] = useState(params.get("product") ? 2 : 1);
  const [productId, setProductId] = useState<string | null>(params.get("product"));
  const product = products?.find((p) => p.id === productId) ?? null;
  const [amount, setAmount] = useState(0);
  const [term, setTerm] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [otherPurpose, setOtherPurpose] = useState("");
  const [income, setIncome] = useState("");
  const [expenses, setExpenses] = useState("");
  const [debts, setDebts] = useState("0");
  const [guarantor, setGuarantor] = useState<Guarantor>({ fullName: "", nrc: "", phone: "", relationship: "" });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{ message: string; code?: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ applicationNumber: string; installmentAmount: string } | null>(null);

  // A sensible starting point for each product: the middle of its amount range and term.
  useEffect(() => {
    if (!product) return;
    const min = Number(product.minAmount);
    const max = Number(product.maxAmount);
    const s = amountStep(min, max);
    setAmount(Math.max(min, Math.min(max, Math.round((min + (max - min) * 0.25) / s) * s)));
    setTerm(Math.round((product.minTerm + product.maxTerm) / 2));
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (me?.monthlyIncome && !income) setIncome(String(Number(me.monthlyIncome)));
  }, [me?.monthlyIncome]); // eslint-disable-line react-hooks/exhaustive-deps

  const { quote, loading: quoting } = useQuote(
    product && amount && term
      ? {
          amount: String(amount),
          term,
          annualRatePct: product.annualRatePct,
          interestMethod: product.interestMethod,
          frequency: product.repaymentFrequency,
          processingFeePct: product.processingFeePct,
        }
      : null,
  );

  const finalPurpose = purpose === "Other" ? otherPurpose.trim() : purpose;
  const monthlyInstalment = quote && product ? (Number(quote.installmentAmount) * PERIODS_PER_YEAR[product.repaymentFrequency]) / 12 : 0;
  const share = Number(income) > 0 ? ((monthlyInstalment + Number(debts || 0)) / Number(income)) * 100 : null;

  const steps: Step[] = useMemo(
    () =>
      ["Choose a loan", "Amount & term", "About you"].map((label, i) => ({
        label,
        state: i + 1 < step ? "complete" : i + 1 === step ? "current" : "upcoming",
      })),
    [step],
  );

  function next() {
    if (step === 2 && finalPurpose.length < 3) {
      setErrors({ purpose: "Tell us what the loan is for" });
      return;
    }
    setErrors({});
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!product) return;
    setSubmitError(null);
    setErrors({});
    setSubmitting(true);
    try {
      const r = await api.post<{ applicationNumber: string; installmentAmount: string }>("/borrower/applications", {
        productId: product.id,
        amount: String(amount),
        term,
        purpose: finalPurpose,
        monthlyIncome: income.trim(),
        monthlyExpenses: expenses.trim() || "0",
        existingDebtRepayments: debts.trim() || "0",
        guarantors: product.requiresGuarantor ? [guarantor] : [],
      });
      setDone(r);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErrors(fieldErrors(e));
      setSubmitError({ message: (e as Error).message, code: e instanceof ApiError ? e.code : undefined });
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <ErrorState error={error} />;

  if (done && product) {
    return (
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="relative bg-ink-950 px-6 py-10 text-center text-white">
            <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative">
              <span className="mx-auto grid size-16 animate-pop-in place-items-center rounded-full bg-brand-500 text-ink-950">
                <PartyPopper className="size-8" />
              </span>
              <h1 className="mt-5 font-display text-2xl font-bold">Application sent</h1>
              <p className="mt-2 text-sm text-slate-300">
                {kwacha(amount)} over {periods(term, product.repaymentFrequency)} · about {kwacha(done.installmentAmount)}{" "}
                {perPeriod(product.repaymentFrequency)}
              </p>
              <p className="tabular mt-1 text-xs text-slate-400">Reference {done.applicationNumber}</p>
            </div>
          </div>
          <div className="px-5 py-6 sm:px-8">
            <ApplicationTracker application={{ status: "submitted", loanStatus: null }} />
          </div>
          <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 px-6 py-5 text-sm text-slate-600">
            <p className="flex gap-2">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-600" /> Our credit team reviews applications on working days.
            </p>
            <p className="flex gap-2">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-600" /> We’ll SMS you the decision, and you can follow it here at any time.
            </p>
            <p className="flex gap-2">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-600" /> If approved, the money is sent to you and your schedule appears on your home
              screen.
            </p>
          </div>
        </Card>
        <div className="grid gap-2 sm:grid-cols-2">
          <ButtonLink href="/borrower/applications" variant="secondary" size="lg">
            Track my application
          </ButtonLink>
          <ButtonLink href="/borrower" size="lg">
            Back to home
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/borrower" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Home
        </Link>
        <h1 className="mt-3 font-display text-[28px] font-bold leading-tight text-slate-900">Apply for a loan</h1>
        <p className="mt-1 text-sm text-slate-500">Three short steps. You’ll see the full cost before you send anything.</p>
      </div>

      <Card className="px-4 py-5 sm:px-8">
        <Stepper steps={steps} />
      </Card>

      {step === 1 && (
        <section className="space-y-3" aria-label="Choose a loan">
          {!products && <Skeleton className="h-40" />}
          <div className="grid gap-3 sm:grid-cols-2">
            {products?.map((p) => (
              <ProductCard key={p.id} product={p} selected={p.id === productId} onSelect={() => setProductId(p.id!)} />
            ))}
          </div>
          <StepNav onNext={next} nextDisabled={!product} />
        </section>
      )}

      {step > 1 && !product && <Skeleton className="h-64 rounded-2xl" />}

      {step === 2 && product && (
        <section className="space-y-4" aria-label="Amount and term">
          <Card className="space-y-7 p-6">
            <Slider
              label="How much do you need?"
              value={amount}
              min={Number(product.minAmount)}
              max={Number(product.maxAmount)}
              step={amountStep(Number(product.minAmount), Number(product.maxAmount))}
              format={(v) => kwacha(v)}
              onChange={setAmount}
            />
            <Slider
              label="Pay it back over"
              value={term}
              min={product.minTerm}
              max={product.maxTerm}
              step={1}
              format={(v) => periods(v, product.repaymentFrequency)}
              onChange={setTerm}
            />
            <div>
              <p className="mb-2 text-[13px] font-medium text-slate-700">What is it for?</p>
              <div className="flex flex-wrap gap-2">
                {[...PURPOSES, "Other"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPurpose(p)}
                    aria-pressed={purpose === p}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                      purpose === p ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {purpose === "Other" && (
                <input
                  className={cn(inputClass, "mt-3")}
                  placeholder="Describe what the loan is for"
                  value={otherPurpose}
                  onChange={(e) => setOtherPurpose(e.target.value)}
                  autoFocus
                />
              )}
              {errors.purpose && <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.purpose}</p>}
            </div>
          </Card>

          <QuoteCard product={product} amount={amount} term={term} quote={quote} quoting={quoting} />
          <StepNav onBack={() => setStep(1)} onNext={next} nextDisabled={!quote} />
        </section>
      )}

      {step === 3 && product && (
        <section className="space-y-4" aria-label="About you">
          <Card className="p-6">
            <h2 className="font-display font-semibold text-slate-900">Your monthly money</h2>
            <p className="mt-1 text-sm text-slate-500">This helps us lend you an amount you can comfortably repay.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label="Take-home income (K)" required error={errors.monthlyIncome}>
                <input className={inputClass} inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. 12000" />
              </Field>
              <Field label="Living expenses (K)" error={errors.monthlyExpenses} hint="Rent, food, transport">
                <input className={inputClass} inputMode="decimal" value={expenses} onChange={(e) => setExpenses(e.target.value)} placeholder="e.g. 5000" />
              </Field>
              <Field label="Other loan repayments (K)" error={errors.existingDebtRepayments} hint="Per month, if any">
                <input className={inputClass} inputMode="decimal" value={debts} onChange={(e) => setDebts(e.target.value)} />
              </Field>
            </div>
            {share !== null && <Affordability share={share} />}
          </Card>

          {product.requiresGuarantor && (
            <Card className="p-6">
              <h2 className="font-display font-semibold text-slate-900">Your guarantor</h2>
              <p className="mt-1 text-sm text-slate-500">{product.name} needs someone who agrees to repay if you can’t. We’ll contact them to confirm.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required error={errors["guarantors.0.fullName"]}>
                  <input className={inputClass} value={guarantor.fullName} onChange={(e) => setGuarantor({ ...guarantor, fullName: e.target.value })} />
                </Field>
                <Field label="NRC number" required error={errors["guarantors.0.nrc"]}>
                  <input
                    className={inputClass}
                    placeholder="123456/78/1"
                    value={guarantor.nrc}
                    onChange={(e) => setGuarantor({ ...guarantor, nrc: e.target.value })}
                  />
                </Field>
                <Field label="Phone" required error={errors["guarantors.0.phone"]}>
                  <input
                    className={inputClass}
                    inputMode="tel"
                    placeholder="0971234567"
                    value={guarantor.phone}
                    onChange={(e) => setGuarantor({ ...guarantor, phone: e.target.value })}
                  />
                </Field>
                <Field label="Relationship to you" required error={errors["guarantors.0.relationship"]}>
                  <input
                    className={inputClass}
                    placeholder="e.g. Brother"
                    value={guarantor.relationship}
                    onChange={(e) => setGuarantor({ ...guarantor, relationship: e.target.value })}
                  />
                </Field>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="font-display font-semibold text-slate-900">Documents</h2>
            <p className="mt-1 text-sm text-slate-500">Upload a photo or PDF. Documents you’ve already given us are ticked.</p>
            <div className="mt-4">
              <DocumentUploads types={["nrc", "payslip", ...(product.code === "SME" ? (["business_licence", "bank_statement"] as const) : [])]} />
            </div>
          </Card>

          <QuoteCard product={product} amount={amount} term={term} quote={quote} quoting={quoting} compact />

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              The information I’ve given is true. I agree that {me?.institution ?? "the lender"} may check my credit record with a licensed credit reference
              bureau and use my details to assess this application, in line with the Data Protection Act, 2021.
            </span>
          </label>

          {submitError && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                {submitError.message}
                {submitError.code === "APPLICATION_IN_REVIEW" && (
                  <>
                    {" "}
                    <Link href="/borrower/applications" className="font-semibold underline">
                      Track it here
                    </Link>
                  </>
                )}
              </span>
            </div>
          )}

          <StepNav
            onBack={() => setStep(2)}
            onNext={submit}
            nextLabel="Send application"
            nextDisabled={!consent || !income || !quote}
            loading={submitting}
            footnote={
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-brand-600" /> Applying is free and doesn’t commit you to borrow.
              </span>
            }
          />
          <button type="button" onClick={() => router.push("/borrower")} className="mx-auto block text-sm text-slate-500 hover:text-slate-800">
            Cancel
          </button>
        </section>
      )}
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  loading,
  footnote,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  footnote?: React.ReactNode;
}) {
  return (
    <div className="pt-2">
      <div className="flex gap-2">
        {onBack && (
          <Button variant="secondary" size="lg" onClick={onBack} aria-label="Back">
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <Button size="lg" className="flex-1" onClick={onNext} disabled={nextDisabled} loading={loading}>
          {nextLabel} {!loading && <ArrowRight className="size-4" />}
        </Button>
      </div>
      {footnote && <p className="mt-3 text-center text-xs text-slate-500">{footnote}</p>}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-700">{label}</p>
        <p className="tabular font-display text-2xl font-bold text-slate-900">{format(value)}</p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full accent-brand-600"
        style={{ background: `linear-gradient(to right, var(--color-brand-500) ${fill}%, var(--color-slate-200) ${fill}%)` }}
      />
      <div className="tabular mt-1.5 flex justify-between text-xs text-slate-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

/** The price, shown before anything is sent: instalment, total cost and APR from the same engine that books the loan. */
function QuoteCard({
  product,
  amount,
  term,
  quote,
  quoting,
  compact,
}: {
  product: BorrowerProduct;
  amount: number;
  term: number;
  quote: ReturnType<typeof useQuote>["quote"];
  quoting: boolean;
  compact?: boolean;
}) {
  if (!quote) return <Skeleton className="h-44 rounded-2xl" />;
  const costOfCredit = Number(quote.totals.interest) + Number(quote.processingFee);
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-ink-950 text-white transition-opacity", quoting && "opacity-80")}>
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="relative p-6">
        <p className="text-xs uppercase tracking-wide text-slate-400">You’ll repay</p>
        <p className="tabular mt-1 font-display text-[32px] font-bold leading-none">
          {kwacha(quote.installmentAmount)} <span className="text-base font-semibold text-slate-400">{perPeriod(product.repaymentFrequency)}</span>
        </p>
        <p className="mt-2 text-sm text-slate-400">
          for {periods(term, product.repaymentFrequency)}, first payment {shortDate(quote.installments[0]?.dueDate)}
        </p>
        {!compact && (
          <dl className="tabular mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-5 text-sm sm:grid-cols-4">
            <QuoteLine label="You receive" value={kwacha(quote.netDisbursed)} />
            <QuoteLine label="Total to repay" value={kwacha(quote.totals.repayable)} />
            <QuoteLine label="Cost of credit" value={kwacha(costOfCredit)} hint={`incl. ${kwacha(quote.processingFee)} fee`} />
            <QuoteLine label="APR" value={pct(quote.disclosure.aprPct)} hint="all costs, yearly" />
          </dl>
        )}
      </div>
      {!compact && (
        <p className="relative flex items-start gap-2 border-t border-white/10 bg-white/[0.03] px-6 py-3 text-xs text-slate-400">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Representative example: {kwacha(amount)} over {periods(term, product.repaymentFrequency)} at {Number(product.annualRatePct)}% a year (
          {product.interestMethod.replace("_", " ")}), {Number(product.processingFeePct)}% processing fee. No penalty for paying early.
        </p>
      )}
    </div>
  );
}

function QuoteLine({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-semibold text-white">{value}</dd>
      {hint && <dd className="text-[11px] text-slate-500">{hint}</dd>}
    </div>
  );
}

function Affordability({ share }: { share: number }) {
  const tone = share <= 30 ? "green" : share <= 45 ? "amber" : "red";
  const text =
    tone === "green"
      ? "Comfortable: plenty of room left for everyday costs."
      : tone === "amber"
        ? "Manageable, but check you can cover your other costs."
        : "This is a lot of your income. A smaller amount or longer term will be easier to repay.";
  return (
    <div className="mt-5 rounded-xl bg-slate-50 p-4">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-slate-600">Loan repayments would take</span>
        <span
          className={cn(
            "tabular font-display text-lg font-bold",
            tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-rose-700",
          )}
        >
          {Math.round(share)}% of income
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn("h-full rounded-full transition-all", tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-rose-500")}
          style={{ width: `${Math.min(share, 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">{text}</p>
    </div>
  );
}
