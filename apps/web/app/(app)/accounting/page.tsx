"use client";

import { CHANNELS, LABELS, type Channel } from "@anzelu/contracts";
import { CircleCheck, CircleX } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, CardHeader, ErrorState, Field, inputClass, Notice, PageHeader, Pager, Skeleton, Table, Tabs, Td, Th } from "@/components/ui";
import { api, qs, useApi, usePage } from "@/lib/api";
import { kwacha, label, shortDate } from "@/lib/format";

interface TrialBalance {
  asOf: string;
  accounts: { id: string; code: string; name: string; type: string; balance: string; trialDebit: string; trialCredit: string }[];
  totals: { debit: string; credit: string; balanced: boolean };
  summary: { assets: string; liabilities: string; equity: string; income: string; expenses: string; netIncome: string };
}

interface Journal {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  sourceType: string;
  reversalOfId: string | null;
  postedBy: string | null;
  lines: { code: string; name: string; debit: string; credit: string }[];
}

interface Recon {
  summary: { statementTotal: string; ledgerTotal: string; matched: number; mismatched: number; missingInLedger: number; missingInStatement: number };
  mismatched: { statement: { reference: string; amount: string }; receipt: { receiptNumber: string; amount: string; loanNumber: string } }[];
  missingInLedger: { reference: string; amount: string; date?: string }[];
  missingInStatement: { receiptNumber: string; externalRef: string | null; amount: string; receivedOn: string; loanNumber: string }[];
}

export default function AccountingPage() {
  const [tab, setTab] = useState<"tb" | "journals" | "recon">("tb");
  return (
    <>
      <PageHeader title="Accounting" description="Double-entry general ledger. Every disbursement, repayment, penalty and reversal posts a balanced journal." />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "tb", label: "Trial balance" },
            { value: "journals", label: "Journals" },
            { value: "recon", label: "Reconciliation" },
          ]}
        />
      </div>
      {tab === "tb" && <TrialBalanceView />}
      {tab === "journals" && <JournalsView />}
      {tab === "recon" && <ReconciliationView />}
    </>
  );
}

function TrialBalanceView() {
  const [asOf, setAsOf] = useState("");
  const { data, error, isLoading } = useApi<TrialBalance>(`/accounting/trial-balance${qs({ asOf })}`);
  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <Skeleton className="h-96" />;
  const s = data.summary;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title={`Trial balance as of ${shortDate(data.asOf)}`}
          action={<input type="date" className={`${inputClass} w-auto`} value={asOf} onChange={(e) => setAsOf(e.target.value)} aria-label="As of date" />}
        />
        <Table>
          <thead>
            <tr className="border-b border-slate-100">
              <Th>Code</Th>
              <Th>Account</Th>
              <Th>Type</Th>
              <Th className="text-right">Debit</Th>
              <Th className="text-right">Credit</Th>
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-slate-100">
            {data.accounts.map((a) => (
              <tr key={a.id}>
                <Td className="font-mono text-xs">{a.code}</Td>
                <Td className="font-medium text-slate-900">{a.name}</Td>
                <Td className="capitalize text-slate-500">{a.type}</Td>
                <Td className="text-right">{Number(a.trialDebit) ? kwacha(a.trialDebit) : ""}</Td>
                <Td className="text-right">{Number(a.trialCredit) ? kwacha(a.trialCredit) : ""}</Td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
              <Td colSpan={3}>
                <span className="inline-flex items-center gap-2">
                  Totals
                  {data.totals.balanced ? (
                    <Badge tone="green">
                      <CircleCheck className="size-3" /> balanced
                    </Badge>
                  ) : (
                    <Badge tone="red">
                      <CircleX className="size-3" /> out of balance
                    </Badge>
                  )}
                </span>
              </Td>
              <Td className="text-right">{kwacha(data.totals.debit)}</Td>
              <Td className="text-right">{kwacha(data.totals.credit)}</Td>
            </tr>
          </tbody>
        </Table>
      </Card>
      <Card>
        <CardHeader title="Financial position" />
        <dl className="tabular divide-y divide-slate-100 text-sm">
          {(
            [
              ["Assets", s.assets],
              ["Liabilities", s.liabilities],
              ["Equity", s.equity],
              ["Income", s.income],
              ["Expenses", s.expenses],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between px-5 py-3">
              <dt className="text-slate-500">{k}</dt>
              <dd className="font-medium text-slate-900">{kwacha(v)}</dd>
            </div>
          ))}
          <div className="flex justify-between bg-slate-50 px-5 py-3 font-semibold">
            <dt>Net income</dt>
            <dd className={Number(s.netIncome) < 0 ? "text-rose-700" : "text-emerald-700"}>{kwacha(s.netIncome)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

function JournalsView() {
  const [sourceType, setSourceType] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = usePage<Journal>(`/accounting/journals${qs({ sourceType, page, pageSize: 15 })}`);
  return (
    <Card>
      <CardHeader
        title="Journal entries"
        action={
          <select className={`${inputClass} w-auto`} value={sourceType} onChange={(e) => (setSourceType(e.target.value), setPage(1))} aria-label="Source">
            <option value="">All sources</option>
            {["disbursement", "payment", "reversal", "penalty", "capital"].map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        }
      />
      {error && <ErrorState error={error} />}
      {!data && <Skeleton className="m-5 h-64" />}
      <ul className="divide-y divide-slate-100">
        {data?.items.map((j) => (
          <li key={j.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span className="font-mono text-xs text-slate-500">{j.entryNumber}</span> <span className="font-medium text-slate-900">{j.description}</span>
              </p>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <Badge tone={j.reversalOfId ? "red" : "neutral"}>{label(j.sourceType)}</Badge>
                {shortDate(j.entryDate)} · {j.postedBy ?? "System"}
              </span>
            </div>
            <table className="tabular mt-2 w-full text-xs">
              <tbody>
                {j.lines.map((l, i) => (
                  <tr key={i} className="text-slate-600">
                    <td className={`py-0.5 ${Number(l.credit) ? "pl-8" : ""}`}>
                      {l.code} {l.name}
                    </td>
                    <td className="w-32 py-0.5 text-right">{Number(l.debit) ? kwacha(l.debit) : ""}</td>
                    <td className="w-32 py-0.5 text-right">{Number(l.credit) ? kwacha(l.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
    </Card>
  );
}

/** Parses "reference,amount[,date]" lines pasted from a provider or bank statement. */
function parseStatement(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^ref/i.test(l))
    .map((l) => {
      const [reference, amount, date] = l.split(/[,;\t]/).map((s) => s.trim());
      return { reference, amount: amount?.replace(/[^\d.]/g, ""), ...(date ? { date } : {}) };
    });
}

function ReconciliationView() {
  const [channel, setChannel] = useState<Channel>("mtn_momo");
  const [text, setText] = useState("");
  const [result, setResult] = useState<Recon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.post<Recon>("/accounting/reconciliation", { channel, lines: parseStatement(text) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <CardHeader title="Statement" description="Paste one line per transaction: reference, amount, date (YYYY-MM-DD)" />
        <div className="space-y-4 p-5">
          <Field label="Channel">
            <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {LABELS.channel[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Statement lines">
            <textarea className={`${inputClass} font-mono text-xs`} rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={"MP240101.1234.A12345,1250.00,2026-10-01"} />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <Button className="w-full" loading={busy} disabled={!text.trim()} onClick={run}>
            Reconcile
          </Button>
          <p className="text-xs text-slate-500">Matching is by provider reference. Nothing is posted; differences are listed for investigation.</p>
        </div>
      </Card>
      <div className="space-y-6 lg:col-span-2">
        {!result && (
          <Card className="p-8 text-center text-sm text-slate-500">Results appear here: matched receipts, amount differences, and items missing on either side.</Card>
        )}
        {result && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <Mini label="Matched" value={result.summary.matched} tone="green" />
              <Mini label="Amount differs" value={result.summary.mismatched} tone="amber" />
              <Mini label="Not in ledger" value={result.summary.missingInLedger} tone="red" />
              <Mini label="Not in statement" value={result.summary.missingInStatement} tone="red" />
            </div>
            <Card className="p-5 text-sm">
              <p className="tabular">
                Statement total <strong>{kwacha(result.summary.statementTotal)}</strong> vs ledger total <strong>{kwacha(result.summary.ledgerTotal)}</strong> for the period.
              </p>
            </Card>
            {result.mismatched.length > 0 && (
              <ReconTable
                title="Amount differs"
                rows={result.mismatched.map((x) => [x.statement.reference, kwacha(x.statement.amount), `${x.receipt.receiptNumber} · ${kwacha(x.receipt.amount)}`])}
                headers={["Reference", "Statement", "Ledger receipt"]}
              />
            )}
            {result.missingInLedger.length > 0 && (
              <ReconTable title="On statement, not in ledger" rows={result.missingInLedger.map((x) => [x.reference, kwacha(x.amount), x.date ?? "—"])} headers={["Reference", "Amount", "Date"]} />
            )}
            {result.missingInStatement.length > 0 && (
              <ReconTable
                title="In ledger, not on statement"
                rows={result.missingInStatement.map((x) => [x.receiptNumber, x.externalRef ?? "—", kwacha(x.amount), shortDate(x.receivedOn)])}
                headers={["Receipt", "Reference", "Amount", "Received"]}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "red" }) {
  const color = value === 0 ? "text-slate-400" : tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-rose-700";
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`tabular text-2xl font-semibold ${color}`}>{value}</p>
    </Card>
  );
}

function ReconTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <Card>
      <CardHeader title={title} />
      <Table>
        <thead>
          <tr className="border-b border-slate-100">
            {headers.map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <Td key={j}>{c}</Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
