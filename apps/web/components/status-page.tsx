import Link from "next/link";
import { Logo } from "./logo";
import { Watermark } from "./watermark";

/**
 * The shared frame for "not found" and "something went wrong": the brand, a large quiet numeral,
 * a plain-language explanation and a way back. `inline` drops the full-screen frame inside the app shell.
 */
export function StatusPage({
  code,
  title,
  body,
  actions,
  detail,
  inline,
}: {
  code: string;
  title: string;
  body: string;
  actions: React.ReactNode;
  detail?: React.ReactNode;
  inline?: boolean;
}) {
  const content = (
    <div className="relative mx-auto flex max-w-lg animate-rise flex-col items-center text-center">
      <span
        aria-hidden
        className="pointer-events-none select-none bg-gradient-to-b from-brand-500/25 to-transparent bg-clip-text font-display text-[7.5rem] font-extrabold leading-none tracking-tighter text-transparent sm:text-[10rem]"
      >
        {code}
      </span>
      <h1 className="-mt-6 font-display text-2xl font-bold tracking-tight text-slate-900 sm:-mt-9 sm:text-3xl">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-slate-500">{body}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      {detail}
    </div>
  );
  if (inline) return <div className="grid min-h-[60vh] place-items-center py-10">{content}</div>;
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <Watermark />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-20%] size-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(242_107_29/0.16),transparent)] animate-float"
      />
      <header className="relative px-6 py-5 sm:px-10">
        <Link href="/" aria-label="Chilimbitso home" className="inline-flex">
          <Logo />
        </Link>
      </header>
      <main className="relative grid flex-1 place-items-center px-6 pb-24">{content}</main>
    </div>
  );
}
