"use client";

import { DOCUMENT_TYPES, LABELS, type DocumentType } from "@anzelu/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { NextStep } from "@/components/journey";
import { useToast } from "@/components/toast";
import { Avatar, Button, ButtonLink, Card, CardHeader, Detail, ErrorState, Field, inputClass, Notice, PageHeader, Skeleton, StatusBadge, Stepper, Table, Td, Th } from "@/components/ui";
import { api, useApi, useSession } from "@/lib/api";
import { kwacha, shortDate } from "@/lib/format";

interface Customer {
  id: string;
  customerNumber: string;
  firstName: string;
  lastName: string;
  nrc: string;
  phone: string;
  email: string | null;
  dateOfBirth: string;
  gender: string;
  address: string;
  employer: string | null;
  occupation: string | null;
  monthlyIncome: string;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  kycStatus: string;
  kycNote: string | null;
  consentAt: string;
  branchName: string;
  documents: { id: string; docType: DocumentType; fileName: string; sizeBytes: number; createdAt: string }[];
  loans: { id: string; loanNumber: string; principal: string; status: string; disbursedOn: string | null }[];
  possibleDuplicates: { id: string; customerNumber: string; firstName: string; lastName: string }[];
}

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const warning = useSearchParams().get("warning");
  const { data: user } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: c, error, isLoading } = useApi<Customer>(`/customers/${id}`);
  const [docType, setDocType] = useState<DocumentType>("nrc");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: [`/customers/${id}`] });

  async function upload(file: File) {
    setBusy("upload");
    setActionError(null);
    const form = new FormData();
    form.set("docType", docType);
    form.set("file", file);
    try {
      await api.post(`/customers/${id}/documents`, form);
      await refresh();
      toast({ tone: "success", title: "Document uploaded", body: `${LABELS.documentType[docType]} stored securely.` });
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function decideKyc(status: "verified" | "rejected") {
    setBusy(status);
    setActionError(null);
    try {
      await api.post(`/customers/${id}/kyc`, { status });
      await refresh();
      toast({ tone: status === "verified" ? "success" : "info", title: status === "verified" ? "KYC verified" : "KYC rejected", body: status === "verified" ? "The customer can now apply for a loan." : undefined });
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState error={error} />;
  if (isLoading || !c) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader
        back={{ href: "/customers", label: "Customers" }}
        title={`${c.firstName} ${c.lastName}`}
        description={
          <span className="flex items-center gap-2">
            {c.customerNumber} · {c.branchName} <StatusBadge status={c.kycStatus} />
          </span>
        }
        actions={
          user?.permissions.includes("applications:write") &&
          c.kycStatus !== "rejected" && (
            <ButtonLink href={`/applications/new?customerId=${c.id}`}>
              <Plus className="size-4" /> New application
            </ButtonLink>
          )
        }
      />
      <div className="space-y-4">
        {warning && <Notice tone="warn">Possible duplicate: {warning}</Notice>}
        {c.possibleDuplicates.length > 0 && (
          <Notice tone="warn">
            Possible duplicates (same phone, or same surname and date of birth):{" "}
            {c.possibleDuplicates.map((d, i) => (
              <span key={d.id}>
                {i > 0 && ", "}
                <Link className="font-medium underline" href={`/customers/${d.id}`}>
                  {d.firstName} {d.lastName} ({d.customerNumber})
                </Link>
              </span>
            ))}
          </Notice>
        )}
        {actionError && <Notice tone="error">{actionError}</Notice>}
      </div>

      <OnboardingCard customer={c} canVerify={!!user?.permissions.includes("customers:verify")} canApply={!!user?.permissions.includes("applications:write")} canUpload={!!user?.permissions.includes("customers:write")} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Profile" />
          <dl className="grid gap-5 p-5 sm:grid-cols-3">
            <Detail label="NRC">{c.nrc}</Detail>
            <Detail label="Date of birth">{shortDate(c.dateOfBirth)}</Detail>
            <Detail label="Gender">{c.gender}</Detail>
            <Detail label="Mobile">{c.phone}</Detail>
            <Detail label="Email">{c.email}</Detail>
            <Detail label="Address">{c.address}</Detail>
            <Detail label="Employer">{c.employer}</Detail>
            <Detail label="Occupation">{c.occupation}</Detail>
            <Detail label="Monthly income">{kwacha(c.monthlyIncome)}</Detail>
            <Detail label="Next of kin">{c.nextOfKinName ? `${c.nextOfKinName} · ${c.nextOfKinPhone ?? ""}` : null}</Detail>
            <Detail label="Consent recorded">{shortDate(c.consentAt)}</Detail>
          </dl>
        </Card>

        <Card>
          <CardHeader title="KYC documents" description="Stored privately; downloads are authorised and logged" />
          <ul className="divide-y divide-slate-100">
            {c.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                <FileText className="size-4 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{LABELS.documentType[d.docType] ?? d.docType}</p>
                  <p className="truncate text-xs text-slate-500">
                    {d.fileName} · {(d.sizeBytes / 1024).toFixed(0)} KB
                  </p>
                </div>
                <a href={`/api/v1/customers/${c.id}/documents/${d.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                  Download
                </a>
              </li>
            ))}
            {c.documents.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">No documents uploaded yet.</li>}
          </ul>
          {user?.permissions.includes("customers:write") && (
            <div className="space-y-3 border-t border-slate-100 p-5">
              <Field label="Document type">
                <select className={inputClass} value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {LABELS.documentType[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:border-brand-400 hover:bg-brand-50">
                <Upload className="size-4" />
                {busy === "upload" ? "Uploading…" : "Upload PDF, JPEG or PNG (max 5 MB)"}
                <input type="file" className="hidden" accept="application/pdf,image/jpeg,image/png" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            </div>
          )}
          {user?.permissions.includes("customers:verify") && c.kycStatus === "pending" && (
            <div className="flex gap-2 border-t border-slate-100 p-5">
              <Button className="flex-1" loading={busy === "verified"} onClick={() => decideKyc("verified")}>
                Verify KYC
              </Button>
              <Button variant="secondary" loading={busy === "rejected"} onClick={() => decideKyc("rejected")}>
                Reject
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Loans" />
        <Table>
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Loan</Th>
              <Th className="text-right">Principal</Th>
              <Th>Disbursed</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-slate-100">
            {c.loans.map((l) => (
              <tr key={l.id}>
                <Td>
                  <Link href={`/loans/${l.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                    {l.loanNumber}
                  </Link>
                </Td>
                <Td className="text-right">{kwacha(l.principal)}</Td>
                <Td>{shortDate(l.disbursedOn)}</Td>
                <Td>
                  <StatusBadge status={l.status} />
                </Td>
              </tr>
            ))}
            {c.loans.length === 0 && (
              <tr>
                <Td colSpan={4} className="text-slate-500">
                  No loans yet.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

function OnboardingCard({ customer: c, canVerify, canApply, canUpload }: { customer: Customer; canVerify: boolean; canApply: boolean; canUpload: boolean }) {
  const hasNrc = c.documents.some((d) => d.docType === "nrc");
  const verified = c.kycStatus === "verified";
  const rejected = c.kycStatus === "rejected";
  const hasLoan = c.loans.length > 0;
  const steps = [
    { label: "Registered", state: "complete" as const, description: shortDate(c.consentAt) },
    { label: "Documents", state: hasNrc ? ("complete" as const) : ("current" as const), description: `${c.documents.length} on file` },
    { label: "KYC", state: verified ? ("complete" as const) : rejected ? ("failed" as const) : hasNrc ? ("current" as const) : ("upcoming" as const), description: verified ? "Verified" : rejected ? "Rejected" : "Pending review" },
    { label: "First loan", state: hasLoan ? ("complete" as const) : verified ? ("current" as const) : ("upcoming" as const), description: hasLoan ? `${c.loans.length} on record` : undefined },
  ];
  let next: React.ReactNode;
  if (rejected) next = <NextStep tone="done" title="KYC was rejected" body={c.kycNote ?? "This customer cannot apply until new documents are reviewed."} />;
  else if (!hasNrc)
    next = <NextStep tone={canUpload ? "you" : "waiting"} title="Upload the customer’s NRC" body="A copy of the National Registration Card is required before KYC can be verified. Use the uploader on the right." />;
  else if (!verified)
    next = <NextStep tone={canVerify ? "you" : "waiting"} title={canVerify ? "Review the documents and verify KYC" : "Waiting for a manager to verify KYC"} body="Check the NRC matches the details captured at registration." />;
  else if (!hasLoan)
    next = (
      <NextStep
        tone={canApply ? "you" : "done"}
        title="Ready to borrow"
        body="KYC is verified. Start an application to get a live quote and affordability check."
        action={canApply && <ButtonLink href={`/applications/new?customerId=${c.id}`}>Start application</ButtonLink>}
      />
    );
  else next = <NextStep tone="done" title="Fully onboarded" body="Identity verified and borrowing history on record." />;
  return (
    <Card className="mt-4 overflow-hidden">
      <div className="flex flex-col gap-6 p-5 sm:px-8 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4 lg:w-64">
          <Avatar name={`${c.firstName} ${c.lastName}`} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">
              {c.firstName} {c.lastName}
            </p>
            <p className="text-xs text-slate-500">{c.customerNumber}</p>
            <p className="text-xs text-slate-500">{c.phone}</p>
          </div>
        </div>
        <div className="flex-1">
          <Stepper steps={steps} />
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50/60">{next}</div>
    </Card>
  );
}
