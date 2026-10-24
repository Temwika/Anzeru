"use client";

import { Eraser, PenLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const W = 720;
const H = 240;

/**
 * Finger, stylus or mouse signature. Reports a PNG data URL once the person lifts
 * the pen, and null when cleared. Ink is navy on a transparent background so it
 * prints cleanly on the receipt and agreement.
 */
export function SignaturePad({
  value,
  onChange,
  label = "Sign here",
  invalid,
}: {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  invalid?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const strokes = useRef(0);
  const [empty, setEmpty] = useState(!value);

  // Shows a previously captured signature (e.g. when stepping back to this screen).
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !value || strokes.current) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, W, H);
    img.src = value;
  }, [value]);

  function point(e: React.PointerEvent) {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  function down(e: React.PointerEvent) {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const p = point(e);
    ctx.strokeStyle = "#1c2554";
    ctx.lineWidth = e.pressure && e.pointerType === "pen" ? 2 + e.pressure * 4 : 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    strokes.current += 1;
    onChange(canvas.current!.toDataURL("image/png"));
  }

  function clear() {
    canvas.current!.getContext("2d")!.clearRect(0, 0, W, H);
    strokes.current = 0;
    setEmpty(true);
    onChange(null);
  }

  return (
    <div>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed bg-white transition",
          invalid ? "border-rose-300 bg-rose-50/30" : empty ? "border-slate-300" : "border-brand-300",
        )}
      >
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="block aspect-[3/1] w-full cursor-crosshair touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          aria-label={label}
          role="img"
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-[22%] border-b border-slate-300" />
        {empty && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400">
            <span className="flex items-center gap-2">
              <PenLine className="size-4" /> {label}
            </span>
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={empty ? "text-slate-500" : "font-medium text-emerald-700"}>{empty ? "Use a finger, stylus or mouse" : "Signature captured"}</span>
        {!empty && (
          <button type="button" onClick={clear} className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-slate-600 hover:bg-slate-100">
            <Eraser className="size-3.5" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
