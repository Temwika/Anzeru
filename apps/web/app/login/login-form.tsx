"use client";

import { loginSchema, type SessionUser } from "@anzelu/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button, Field, inputClass } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";

type LoginValues = z.input<typeof loginSchema>;

/** Seeded development accounts (see README). Hidden in production builds. */
const DEMO_ACCOUNTS = [
  { email: "officer@demo.zm", role: "Credit officer", hint: "Onboard & apply" },
  { email: "manager@demo.zm", role: "Credit manager", hint: "Approve credit" },
  { email: "accountant@demo.zm", role: "Accountant", hint: "Authorise payouts" },
  { email: "cashier@demo.zm", role: "Cashier", hint: "Take repayments" },
  { email: "admin@demo.zm", role: "Administrator", hint: "Products & users" },
  { email: "auditor@demo.zm", role: "Auditor", hint: "Read-only review" },
  { email: "platform@anzelu.io", role: "Platform", hint: "Institutions" },
  { email: "borrower@demo.zm", role: "Borrower", hint: "Self-service" },
];
const DEMO_PASSWORD = "Demo2026!pass";

export function LoginForm({ showDemo }: { showDemo: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [mfa, setMfa] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const { user } = await api.post<{ user: SessionUser }>("/auth/login", values);
      const next = params.get("next");
      const home = user.role === "borrower" ? "/borrower" : user.role === "platform_admin" ? "/admin/tenants" : "/dashboard";
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : home);
    } catch (e) {
      if (e instanceof ApiError && e.code === "MFA_REQUIRED") {
        setMfa(true);
        return;
      }
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  });

  return (
    <div className="w-full max-w-[400px] animate-slide-up">
      <h1 className="font-display text-[28px] font-bold text-slate-900">{mfa ? "Confirm it's you" : "Welcome back"}</h1>
      <p className="mt-1.5 text-sm text-slate-500">{mfa ? "Enter the 6-digit code from your authenticator app." : "Sign in with your institution account to continue."}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        <div className={cn("space-y-5", mfa && "hidden")}>
          <Field label="Work email" error={errors.email?.message}>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input className={cn(inputClass, "py-3 pl-10")} type="email" autoComplete="username" placeholder="you@institution.zm" aria-invalid={!!errors.email} {...register("email")} />
            </div>
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className={cn(inputClass, "py-3 pl-10 pr-11")}
                type={reveal ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-700"
                aria-label={reveal ? "Hide password" : "Show password"}
              >
                {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
        </div>
        {mfa && (
          <Field label="Authenticator code" error={errors.mfaCode?.message}>
            <div className="relative">
              <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className={cn(inputClass, "py-3 pl-10 font-mono text-lg tracking-[0.5em]")}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                placeholder="••••••"
                {...register("mfaCode")}
              />
            </div>
          </Field>
        )}
        {error && (
          <p className="animate-fade-in rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {mfa ? "Verify and continue" : "Sign in"} {!isSubmitting && <ArrowRight className="size-4" />}
        </Button>
        {mfa && (
          <button type="button" onClick={() => setMfa(false)} className="w-full text-center text-sm text-slate-500 hover:text-slate-900">
            Use a different account
          </button>
        )}
      </form>

      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
        <ShieldCheck className="size-4 text-brand-600" /> Encrypted session · signs out after 8 hours
      </p>

      {showDemo && !mfa && (
        <div className="mt-10">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Try a demo role</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setValue("email", a.email);
                  setValue("password", DEMO_PASSWORD);
                  setPicked(a.email);
                }}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition",
                  picked === a.email ? "border-brand-500 bg-brand-50 shadow-[0_0_0_3px_var(--color-brand-100)]" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <span className="block text-[13px] font-semibold text-slate-900">{a.role}</span>
                <span className="block truncate text-[11px] text-slate-500">{a.hint}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">Development only · pick a role, then Sign in</p>
        </div>
      )}
    </div>
  );
}
