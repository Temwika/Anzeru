"use client";

import type { Permission } from "@anzelu/contracts";
import { BookOpenText, Download, HandCoins, ReceiptText, Users } from "lucide-react";
import { useState } from "react";
import { monthToDate, PeriodPicker } from "@/components/period-picker";
import { useToast } from "@/components/toast";
import { Button, Card, PageHeader } from "@/components/ui";
import { qs, useSession } from "@/lib/api";
import { download } from "@/lib/download";

export default function ExportsPage() {
  const toast = useToast();
  const { data: user } = useSession();
  const [period, setPeriod] = useState(monthToDate);
  const [busy, setBusy] = useState<string | null>(null);
  const can = (p: Permission) => !!user?.permissions.includes(p);

  const exports = [
    {
      key: "loans",
      icon: HandCoins,
      title: "Export Loans",
      body: "Every loan with borrower, product, branch, officer, balances and days late.",
      path: "/reports/export/loans.csv",
      show: true,
      dated: false,
    },
    {
      key: "repayments",
      icon: ReceiptText,
      title: "Export Repayments",
      body: "Payments received in the period, with receipt numbers, channel and who recorded them.",
      path: `/reports/export/repayments.csv${qs(period)}`,
      show: true,
      dated: true,
    },
    {
      key: "borrowers",
      icon: Users,
      title: "Export Borrowers",
      body: "Borrower register with NRC, contacts, branch, group and KYC status.",
      path: "/reports/export/borrowers.csv",
      show: can("customers:read"),
      dated: false,
    },
    {
      key: "quickbooks",
      icon: BookOpenText,
      title: "QuickBooks Export",
      body: "Journal entries in the period, in the QuickBooks journal import layout.",
      path: `/reports/export/quickbooks.csv${qs(period)}`,
      show: can("accounting:read"),
      dated: true,
    },
  ].filter((e) => e.show);

  async function run(key: string, path: string) {
    setBusy(key);
    try {
      const name = await download(path);
      toast({ tone: "success", title: "Download ready", body: name });
    } catch (err) {
      toast({ tone: "error", title: "Couldn’t export", body: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Exports" description="Download your data as CSV for Excel, QuickBooks or your auditor. Every download is recorded in the audit log." />
      <PeriodPicker value={period} onChange={setPeriod} />
      <div className="grid gap-4 md:grid-cols-2">
        {exports.map((e) => (
          <Card key={e.key} className="flex flex-col p-5">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <e.icon className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">{e.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{e.body}</p>
                <p className="mt-2 text-xs text-slate-400">{e.dated ? "Uses the period above" : "Everything up to today"}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="secondary" loading={busy === e.key} onClick={() => run(e.key, e.path)}>
                <Download className="size-4" /> Download CSV
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
