"use client";

import { useQueryClient } from "@tanstack/react-query";
import { DatabaseBackup, Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Card, CardHeader, EmptyState, Notice, PageHeader, Skeleton, Table, Td, Th } from "@/components/ui";
import { useApi } from "@/lib/api";
import { download } from "@/lib/download";
import { dateTime } from "@/lib/format";

interface BackupLog {
  at: string;
  by: string | null;
  data: { counts?: Record<string, number> };
}

export default function BackupsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useApi<BackupLog[]>("/settings/backups");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const name = await download("/settings/backup");
      toast({ tone: "success", title: "Backup downloaded", body: `${name}. Keep it somewhere safe and off this computer.` });
      await qc.invalidateQueries({ queryKey: ["/settings/backups"] });
    } catch (err) {
      toast({ tone: "error", title: "Backup failed", body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const rows = (counts?: Record<string, number>) => Object.values(counts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Backups"
        description="Download a complete copy of your records: borrowers, loans, schedules, repayments, the ledger and the audit log."
      />
      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <DatabaseBackup className="size-6" />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold text-slate-900">Download a backup now</h2>
          <p className="mt-1 text-sm text-slate-600">One file with everything in your institution. Passwords and security keys are never included.</p>
          <Button className="mt-5 w-full" size="lg" loading={busy} onClick={run}>
            <Download className="size-4" /> Download backup
          </Button>
          <div className="mt-5">
            <Notice tone="info">
              The hosted database is also backed up automatically by the server. Download your own copy at least weekly and store it on an encrypted drive.
            </Notice>
          </div>
        </Card>

        <Card>
          <CardHeader icon={ShieldCheck} title="Backup history" description="Every download is recorded in the audit log with who took it." />
          {!data && <Skeleton className="m-5 h-32" />}
          {data && !data.length && <EmptyState icon={DatabaseBackup} title="No backups downloaded yet" />}
          {!!data?.length && (
            <Table>
              <thead>
                <tr className="border-b border-slate-100">
                  <Th>When</Th>
                  <Th>Downloaded by</Th>
                  <Th className="text-right">Records</Th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-slate-100">
                {data.map((b) => (
                  <tr key={b.at}>
                    <Td>{dateTime(b.at)}</Td>
                    <Td>{b.by ?? "—"}</Td>
                    <Td className="text-right">{rows(b.data.counts).toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
