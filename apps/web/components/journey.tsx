"use client";

import { ArrowRight, CircleCheck, Clock3, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, Stepper, type Step } from "./ui";

export interface JourneyState {
  applicationStatus?: string;
  loanStatus?: string;
  payoutRequested?: boolean;
}

/** Where a loan sits in its life: application → decision → payout → repayment → closed. */
export function journeySteps({ applicationStatus, loanStatus, payoutRequested }: JourneyState): Step[] {
  const s = (label: string, state: Step["state"], description?: string): Step => ({ label, state, description });
  if (loanStatus === "closed")
    return [s("Applied", "complete"), s("Approved", "complete"), s("Paid out", "complete"), s("Repaid", "complete"), s("Closed", "complete", "Fully settled")];
  if (loanStatus === "active")
    return [s("Applied", "complete"), s("Approved", "complete"), s("Paid out", "complete"), s("Repaying", "current", "Instalments in progress"), s("Closed", "upcoming")];
  if (loanStatus === "pending_disbursement")
    return [
      s("Applied", "complete"),
      s("Approved", "complete"),
      s("Payout", "current", payoutRequested ? "Awaiting authorisation" : "Awaiting request"),
      s("Repaying", "upcoming"),
      s("Closed", "upcoming"),
    ];
  if (applicationStatus === "rejected")
    return [s("Applied", "complete"), s("Declined", "failed", "Credit decision recorded"), s("Payout", "upcoming"), s("Repaying", "upcoming"), s("Closed", "upcoming")];
  return [s("Applied", "complete"), s("Decision", "current", "With a credit approver"), s("Payout", "upcoming"), s("Repaying", "upcoming"), s("Closed", "upcoming")];
}

export function JourneyCard({ state, children }: { state: JourneyState; children?: React.ReactNode }) {
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="px-4 pb-4 pt-5 sm:px-8">
        <Stepper steps={journeySteps(state)} />
      </div>
      {children && <div className="border-t border-slate-100 bg-slate-50/60">{children}</div>}
    </Card>
  );
}

/**
 * Tells the user what happens next and who does it. When the viewer is that
 * person, `action` renders the button that moves the loan forward.
 */
export function NextStep({
  title,
  body,
  action,
  tone = "waiting",
}: {
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "you" | "waiting" | "done";
}) {
  const Icon = tone === "you" ? Sparkles : tone === "done" ? CircleCheck : Clock3;
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          tone === "you" ? "bg-copper-50 text-copper-600" : tone === "done" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {tone === "you" && <span className="rounded-full bg-copper-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-950">Your turn</span>}
          {title}
        </p>
        {body && <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{body}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function NextHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
      <ArrowRight className="size-3.5" /> {children}
    </p>
  );
}
