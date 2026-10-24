"use client";

import { LABELS, type CollateralType } from "@anzelu/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Camera, CircleAlert, FileSignature, IdCard, Package, PenLine, UserCheck } from "lucide-react";
import { useState } from "react";
import { PhotoCapture } from "@/components/photo-capture";
import { SignaturePad } from "@/components/signature-pad";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, CardHeader, Modal, Notice } from "@/components/ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { dateTime, kwacha } from "@/lib/format";

export interface Checklist {
  clientNrc: boolean;
  borrowerSigned: boolean;
  guarantorsRequired: boolean;
  guarantorsComplete: boolean;
  collateralRequired: boolean;
  collateralRecorded: boolean;
}

export interface CaptureData {
  id: string;
  status: string;
  borrowerSignature: string | null;
  borrowerSignedAt: string | null;
  customer: { id: string; firstName: string; lastName: string; nrc: string };
  clientNrcDocument: { id: string; mimeType: string } | null;
  guarantors: {
    id: string;
    fullName: string;
    nrc: string;
    phone: string;
    relationship: string;
    address: string | null;
    signature: string | null;
    signedAt: string | null;
  }[];
  collateral: { id: string; type: CollateralType; description: string; identifier: string | null; estimatedValue: string; location: string | null }[];
  documents: { id: string; docType: string; guarantorId: string | null; collateralId: string | null; mimeType: string }[];
  checklist: Checklist;
  amount: string;
}

/** What still blocks approval, in plain words. Empty when everything is on file. */
export function missingItems(c: Checklist, guarantorCount: number) {
  const out: string[] = [];
  if (!c.clientNrc) out.push("client NRC photo");
  if (c.guarantorsRequired && !guarantorCount) out.push("a guarantor");
  else if (!c.guarantorsComplete) out.push("guarantor NRC photo or signature");
  if (c.collateralRequired && !c.collateralRecorded) out.push("collateral");
  return out;
}

export function CaptureChecklistCard({ a }: { a: CaptureData }) {
  const c = a.checklist;
  const items = [
    { ok: c.clientNrc, label: "Client NRC photo", required: true },
    { ok: c.borrowerSigned, label: "Client signature", required: false },
    {
      ok: c.guarantorsComplete && (!c.guarantorsRequired || a.guarantors.length > 0),
      label: "Guarantor NRC & signature",
      required: c.guarantorsRequired || a.guarantors.length > 0,
    },
    { ok: c.collateralRecorded, label: "Collateral recorded", required: c.collateralRequired },
  ];
  const done = items.filter((i) => i.ok).length;
  return (
    <Card>
      <CardHeader title="Documents on file" description={`${done} of ${items.length} captured`} icon={BadgeCheck} />
      <ul className="divide-y divide-slate-100">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-3 px-5 py-3 text-sm">
            {i.ok ? (
              <BadgeCheck className="size-5 text-emerald-600" />
            ) : (
              <CircleAlert className={cn("size-5", i.required ? "text-rose-500" : "text-slate-300")} />
            )}
            <span className={cn("flex-1", i.ok ? "text-slate-800" : "text-slate-600")}>{i.label}</span>
            {!i.ok && <Badge tone={i.required ? "red" : "neutral"}>{i.required ? "Needed" : "Optional"}</Badge>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const docUrl = (appId: string, docId: string) => `/api/v1/applications/${appId}/documents/${docId}`;

function Thumb({ src, label, mime }: { src: string; label: string; mime: string }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      {mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="aspect-[16/10] w-full object-cover transition group-hover:scale-[1.02]" />
      ) : (
        <span className="grid aspect-[16/10] place-items-center text-xs font-medium text-slate-600">PDF · open</span>
      )}
      <span className="block border-t border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500">{label}</span>
    </a>
  );
}

function Missing({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <span className="grid aspect-[16/10] place-items-center rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/40 px-3 text-center text-xs font-medium text-rose-700">
      <span className="flex flex-col items-center gap-1">
        <Icon className="size-4" /> {text}
      </span>
    </span>
  );
}

export function ClientCaptureCard({ a }: { a: CaptureData }) {
  return (
    <Card>
      <CardHeader title="Client" description={`${a.customer.firstName} ${a.customer.lastName} · ${a.customer.nrc}`} icon={IdCard} />
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        {a.clientNrcDocument ? (
          <Thumb src={`/api/v1/customers/${a.customer.id}/documents/${a.clientNrcDocument.id}?inline=1`} mime={a.clientNrcDocument.mimeType} label="NRC" />
        ) : (
          <Missing icon={Camera} text="No NRC photo. Add it on the client’s profile." />
        )}
        <SignatureBox src={a.borrowerSignature} at={a.borrowerSignedAt} label="Client signature" />
      </div>
    </Card>
  );
}

function SignatureBox({ src, at, label }: { src: string | null; at: string | null; label: string }) {
  return src ? (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="aspect-[16/10] w-full object-contain p-2" />
      <span className="block border-t border-slate-200 px-2 py-1 text-[11px] text-slate-500">
        {label}
        {at ? ` · ${dateTime(at)}` : ""}
      </span>
    </div>
  ) : (
    <Missing icon={PenLine} text={`${label} not captured`} />
  );
}

export function GuarantorsCard({ a, canEdit }: { a: CaptureData; canEdit: boolean }) {
  const [signing, setSigning] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const open = a.status === "submitted" && canEdit;
  return (
    <Card>
      <CardHeader
        title="Guarantors"
        description={a.checklist.guarantorsRequired ? "Required for this product" : "Optional for this product"}
        icon={UserCheck}
      />
      {!a.guarantors.length ? (
        <p className={cn("px-5 py-6 text-sm", a.checklist.guarantorsRequired ? "text-rose-700" : "text-slate-500")}>
          {a.checklist.guarantorsRequired ? "No guarantor recorded. This application can’t be approved." : "No guarantor recorded."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {a.guarantors.map((g) => {
            const front = a.documents.find((d) => d.guarantorId === g.id && d.docType === "guarantor_nrc_front");
            const back = a.documents.find((d) => d.guarantorId === g.id && d.docType === "guarantor_nrc_back");
            return (
              <li key={g.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{g.fullName}</p>
                    <p className="text-sm text-slate-500">
                      {g.relationship} · NRC {g.nrc} · {g.phone}
                    </p>
                    {g.address && <p className="text-xs text-slate-500">{g.address}</p>}
                  </div>
                  {front && g.signature ? (
                    <Badge tone="green" dot>
                      Complete
                    </Badge>
                  ) : (
                    <Badge tone="red" dot>
                      Incomplete
                    </Badge>
                  )}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {front ? <Thumb src={docUrl(a.id, front.id)} mime={front.mimeType} label="NRC front" /> : <Missing icon={Camera} text="NRC front missing" />}
                  {back ? (
                    <Thumb src={docUrl(a.id, back.id)} mime={back.mimeType} label="NRC back" />
                  ) : (
                    <span className="grid aspect-[16/10] place-items-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                      NRC back (optional)
                    </span>
                  )}
                  <SignatureBox src={g.signature} at={g.signedAt} label="Signature" />
                </div>
                {open && (!front || !g.signature) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!front && (
                      <Button size="sm" variant="secondary" onClick={() => setPhoto(g.id)}>
                        <Camera className="size-4" /> Add NRC photo
                      </Button>
                    )}
                    {!g.signature && (
                      <Button size="sm" variant="secondary" onClick={() => setSigning(g.id)}>
                        <FileSignature className="size-4" /> Capture signature
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {signing && <SignModal appId={a.id} guarantor={a.guarantors.find((g) => g.id === signing)!} onClose={() => setSigning(null)} />}
      {photo && <PhotoModal appId={a.id} guarantorId={photo} name={a.guarantors.find((g) => g.id === photo)!.fullName} onClose={() => setPhoto(null)} />}
    </Card>
  );
}

export function CollateralCard({ a }: { a: CaptureData }) {
  const total = a.collateral.reduce((s, c) => s + Number(c.estimatedValue), 0);
  const cover = Number(a.amount) ? (total / Number(a.amount)) * 100 : 0;
  return (
    <Card>
      <CardHeader
        title="Collateral"
        description={
          a.collateral.length
            ? `${kwacha(total)} pledged · ${cover.toFixed(0)}% of the loan`
            : a.checklist.collateralRequired
              ? "Required for this product"
              : "None pledged"
        }
        icon={Package}
      />
      {!a.collateral.length ? (
        <p className={cn("px-5 py-6 text-sm", a.checklist.collateralRequired ? "text-rose-700" : "text-slate-500")}>
          {a.checklist.collateralRequired ? "No collateral recorded. This application can’t be approved." : "The client has not pledged collateral."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {a.collateral.map((c) => {
            const photo = a.documents.find((d) => d.collateralId === c.id);
            return (
              <li key={c.id} className="flex gap-4 p-5">
                <div className="w-28 shrink-0">
                  {photo ? (
                    <Thumb src={docUrl(a.id, photo.id)} mime={photo.mimeType} label="Photo" />
                  ) : (
                    <span className="grid aspect-[16/10] place-items-center rounded-xl bg-slate-100 text-slate-400">
                      <Package className="size-5" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-slate-900">{c.description}</p>
                  <p className="text-slate-500">
                    {LABELS.collateralType[c.type] ?? c.type}
                    {c.identifier ? ` · ${c.identifier}` : ""}
                    {c.location ? ` · ${c.location}` : ""}
                  </p>
                </div>
                <p className="tabular font-semibold text-slate-900">{kwacha(c.estimatedValue)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function SignModal({ appId, guarantor, onClose }: { appId: string; guarantor: { id: string; fullName: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    try {
      await api.put(`/applications/${appId}/guarantors/${guarantor.id}/signature`, { signature: sig });
      await qc.invalidateQueries({ queryKey: [`/applications/${appId}`] });
      toast({ tone: "success", title: `${guarantor.fullName} has signed` });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`${guarantor.fullName} signs`}
      description="By signing, the guarantor agrees to repay the loan if the client does not."
      wide
    >
      <SignaturePad value={sig} onChange={setSig} label="Guarantor signs here" />
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} disabled={!sig} onClick={save}>
          Save signature
        </Button>
      </div>
    </Modal>
  );
}

function PhotoModal({ appId, guarantorId, name, onClose }: { appId: string; guarantorId: string; name: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("docType", "guarantor_nrc_front");
      form.set("guarantorId", guarantorId);
      form.set("file", file);
      await api.post(`/applications/${appId}/documents`, form);
      await qc.invalidateQueries({ queryKey: [`/applications/${appId}`] });
      toast({ tone: "success", title: `${name}’s NRC saved` });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`${name}’s NRC`} description="Photograph the front of the NRC so the number and photo are readable.">
      <PhotoCapture label="NRC front" required file={file} onChange={setFile} />
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} disabled={!file} onClick={save}>
          Save photo
        </Button>
      </div>
    </Modal>
  );
}
