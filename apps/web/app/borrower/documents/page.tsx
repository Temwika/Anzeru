"use client";

import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { DocumentUploads } from "@/components/borrower-documents";
import { Card } from "@/components/ui";

export default function BorrowerDocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/borrower" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Home
        </Link>
        <h1 className="mt-3 font-display text-[28px] font-bold leading-tight text-slate-900">My documents</h1>
        <p className="mt-1 text-sm text-slate-500">Keep these up to date and your next application is reviewed faster.</p>
      </div>
      <Card className="p-6">
        <DocumentUploads types={["nrc", "payslip", "bank_statement", "proof_of_address", "business_licence"]} />
      </Card>
      <p className="flex items-start gap-2 text-xs text-slate-500">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
        Documents are stored privately and only seen by staff handling your account. Every upload is fingerprinted and recorded in our audit trail.
      </p>
    </div>
  );
}
