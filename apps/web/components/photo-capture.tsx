"use client";

import { Camera, CheckCircle2, RefreshCw, X } from "lucide-react";
import { useEffect, useId, useMemo } from "react";
import { cn } from "@/lib/cn";

/** Shrinks a phone photo to at most 1600px on the long side as JPEG, keeping uploads quick on mobile data. */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 600_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/**
 * Takes a photo with the phone camera (or picks a file on a computer) and shows
 * it straight away, so staff can check the NRC is readable before moving on.
 */
export function PhotoCapture({
  label,
  hint,
  file,
  existingUrl,
  onChange,
  required,
  invalid,
  className,
}: {
  label: string;
  hint?: string;
  file: File | null;
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const id = useId();
  const preview = useMemo(() => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const shown = preview ?? (file ? null : existingUrl);
  const has = !!file || !!existingUrl;

  return (
    <div className={className}>
      <p className="mb-1.5 text-[13px] font-medium text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </p>
      <label
        htmlFor={id}
        className={cn(
          "group relative flex aspect-[16/10] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed text-center transition",
          has
            ? "border-emerald-300 bg-emerald-50/30"
            : invalid
              ? "border-rose-300 bg-rose-50/40"
              : "border-slate-300 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/40",
        )}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={label} className="absolute inset-0 size-full object-cover" />
        ) : file ? (
          <span className="px-4 text-sm font-medium text-slate-700">{file.name}</span>
        ) : (
          <>
            <span className="grid size-11 place-items-center rounded-full bg-white text-brand-600 shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105">
              <Camera className="size-5" />
            </span>
            <span className="text-sm font-semibold text-slate-800">Take photo</span>
            <span className="px-4 text-xs text-slate-500">{hint ?? "Or choose a JPEG, PNG or PDF up to 5 MB"}</span>
          </>
        )}
        {has && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
            <CheckCircle2 className="size-3" /> {file ? "Ready" : "On file"}
          </span>
        )}
        {has && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow">
            <RefreshCw className="size-3" /> Retake
          </span>
        )}
        <input
          id={id}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onChange(await shrink(f));
          }}
        />
      </label>
      {file && (
        <button type="button" onClick={() => onChange(null)} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600">
          <X className="size-3" /> Remove
        </button>
      )}
    </div>
  );
}
