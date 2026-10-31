"use client";

import { LayoutDashboard, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { StatusPage } from "./status-page";
import { Button, ButtonLink } from "./ui";

/** What an error boundary shows: reassurance, a retry, and a reference support can trace. */
export function ErrorView({ error, retry, inline }: { error: unknown; retry: () => void; inline?: boolean }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = typeof error === "object" && error && "digest" in error ? String(error.digest) : null;
  return (
    <StatusPage
      inline={inline}
      code="Oops"
      title="Something went wrong on our side"
      body="Your data is safe — nothing was lost or half-saved. Try again, and if it keeps happening, send the reference below to support."
      actions={
        <>
          <Button onClick={retry}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <ButtonLink href="/dashboard" variant="secondary">
            <LayoutDashboard className="size-4" />
            Go to dashboard
          </ButtonLink>
        </>
      }
      detail={
        digest && (
          <p className="mt-6 text-xs text-slate-400">
            Reference <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">{digest}</code>
          </p>
        )
      }
    />
  );
}
