"use client";

import { LABELS, type DocumentType } from "@anzelu/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { api, useApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/format";
import { useToast } from "./toast";

interface UploadedDocument {
  id: string;
  docType: DocumentType;
  fileName: string;
  createdAt: string;
}

const HINTS: Partial<Record<DocumentType, string>> = {
  nrc: "Both sides, clearly readable",
  payslip: "Your latest payslip",
  bank_statement: "Last 3 months",
  business_licence: "Current trading licence",
  proof_of_address: "Utility bill or letter",
};

/** One tile per document type: tap to upload a photo or PDF; ticked once we hold one. */
export function DocumentUploads({ types }: { types: readonly DocumentType[] }) {
  const { data: docs } = useApi<UploadedDocument[]>("/borrower/documents");
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {types.map((t) => (
        <DocumentTile key={t} type={t} latest={docs?.find((d) => d.docType === t)} />
      ))}
    </ul>
  );
}

function DocumentTile({ type, latest }: { type: DocumentType; latest?: UploadedDocument }) {
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast({ tone: "error", title: "File too large", body: "Upload a file under 5 MB." });
      return;
    }
    const form = new FormData();
    form.append("docType", type);
    form.append("file", file);
    setBusy(true);
    try {
      await api.post("/borrower/documents", form);
      await qc.invalidateQueries({ queryKey: ["/borrower/documents"] });
      toast({ tone: "success", title: `${LABELS.documentType[type]} uploaded` });
    } catch (e) {
      toast({ tone: "error", title: "Upload failed", body: (e as Error).message });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition",
          latest
            ? "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300"
            : "border-dashed border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/30",
        )}
      >
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", latest ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : latest ? <CircleCheck className="size-5" /> : <FileUp className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{LABELS.documentType[type]}</span>
          <span className="block truncate text-xs text-slate-500">
            {latest ? `Received ${shortDate(latest.createdAt)} · tap to replace` : (HINTS[type] ?? "PDF, JPEG or PNG")}
          </span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
    </li>
  );
}
