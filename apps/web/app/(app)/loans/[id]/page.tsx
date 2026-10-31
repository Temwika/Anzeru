"use client";

import { CHANNELS, COLLECTION_ACTIVITY_TYPES, LABELS, type Channel, rateText } from "@anzelu/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Banknote, MessageSquarePlus, Printer, Send, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { JourneyCard, NextStep } from "@/components/journey";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Detail,
  ErrorState,
  Field,
  inputClass,
  Modal,
  Notice,
  PageHeader,
  Skeleton,
  StatusBadge,
  Table,
  Tabs,
  Td,
  Th,
} from "@/components/ui";
import { api, newIdempotencyKey, useApi, useSession } from "@/lib/api";
import { dateTime, kwacha, label, pct, shortDate } from "@/lib/format";

interface ScheduleItem {
  id: string;
  installmentNo: number;
  dueDate: string;
  principalDue: string;
  interestDue: string;
  feeDue: string;
  penaltyDue: string;
  principalPaid: string;
  interestPaid: string;
  feePaid: string;
  penaltyPaid: string;
  status: string;
}

interface Loan {
  id: string;
  loanNumber: string;
  principal: string;
  processingFee: string;
  annualRatePct: string;
  term: number;
  interestMethod: keyof typeof LABELS.interestMethod;
  frequency: keyof typeof LABELS.frequency;
  status: string;
  disbursedOn: string | null;
  maturityDate: string | null;
  customer: { id: string; firstName: string; lastName: string; customerNumber: string; phone: string };
  product: { name: string };
  branchName: string;
  officerName: string;
  position: {
    principalOutstanding: string;
    interestOutstanding: string;
    feesOutstanding: string;
    penaltiesOutstanding: string;
    totalOutstanding: string;
    overdueAmount: string;
    overdueInstallments: number;
    daysPastDue: number;
    bucket: string;
    nextDueDate: string | null;
    nextDueAmount: string;
  };
  schedule: ScheduleItem[];
  disbursements: {
    id: string;
    amount: string;
    fee: string;
    netAmount: string;
    channel: Channel;
    destination: string;
    valueDate: string;
    status: string;
    requestedAt: string;
    requestedByName: string;
    providerRef: string | null;
  }[];
  payments: { id: string; receiptNumber: string; amount: string; channel: Channel; externalRef: string | null; receivedOn: string; status: string }[];
  activities: {
    id: string;
    type: string;
    note: string;
    promisedAmount: string | null;
    promisedDate: string | null;
    createdAt: string;
    createdByName: string;
  }[];
  settlement: { asOf: string; principal: string; interest: string; fees: string; penalties: string; total: string } | null;
  disclosure: { aprPct: string; effectiveAnnualRatePct: string } | null;
  permissions: { canRequestDisbursement: boolean; canAuthoriseDisbursement: boolean; canRecordPayment: boolean };
}

type Dialog = "disburse" | "authorise" | "payment" | "activity" | { reverse: string } | null;

const add = (...v: string[]) => v.reduce((a, b) => a + Number(b), 0);

export default function LoanPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: loan, error, isLoading } = useApi<Loan>(`/loans/${id}`);
  const [tab, setTab] = useState<"schedule" | "payments" | "collections" | "disbursement">("schedule");
  const [dialog, setDialog] = useState<Dialog>(null);

  if (error) return <ErrorState error={error} />;
  if (isLoading || !loan) return <Skeleton className="h-96" />;
  const p = loan.position;
  const pending = loan.disbursements.find((d) => d.status === "requested");

  const done = async (message: string) => {
    setDialog(null);
    toast({ tone: "success", title: message });
    await qc.invalidateQueries();
  };

  return (
    <>
      <PageHeader
        back={{ href: "/loans", label: "Loans" }}
        eyebrow={loan.loanNumber}
        title={`${loan.customer.firstName} ${loan.customer.lastName} · ${kwacha(loan.principal)}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {loan.product.name} · {loan.branchName} · officer {loan.officerName} <StatusBadge status={loan.status} />
            {p.daysPastDue > 0 && (
              <Badge tone="red" dot>
                {p.daysPastDue} days late
              </Badge>
            )}
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/customers/${loan.customer.id}`} variant="secondary">
              Customer profile
            </ButtonLink>
            {loan.status === "active" && user?.permissions.includes("collections:write") && (
              <Button variant="secondary" onClick={() => setDialog("activity")}>
                <MessageSquarePlus className="size-4" /> Log activity
              </Button>
            )}
            {loan.permissions.canRecordPayment && (
              <Button onClick={() => setDialog("payment")}>
                <Banknote className="size-4" /> Record payment
              </Button>
            )}
          </>
        }
      />

      <JourneyCard state={{ loanStatus: loan.status, payoutRequested: !!pending }}>
        <LoanNextStep loan={loan} pending={pending} canCollect={!!user?.permissions.includes("collections:write")} open={setDialog} />
      </JourneyCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Outstanding balance" value={kwacha(p.totalOutstanding)} sub={`Principal ${kwacha(p.principalOutstanding)}`} />
        <Stat
          label="Next instalment"
          value={p.nextDueDate ? kwacha(p.nextDueAmount) : "—"}
          sub={p.nextDueDate ? `Due ${shortDate(p.nextDueDate)}` : "Nothing scheduled"}
        />
        <Stat
          label="Arrears"
          value={kwacha(p.overdueAmount)}
          sub={p.daysPastDue ? `${p.daysPastDue} days past due` : "Up to date"}
          tone={p.daysPastDue ? "bad" : undefined}
        />
        <Stat
          label="Settle today"
          value={loan.settlement ? kwacha(loan.settlement.total) : "—"}
          sub={loan.settlement ? "Future interest waived" : "Not active"}
        />
      </div>

      <Card className="mt-6">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 p-5 sm:grid-cols-3 lg:grid-cols-6">
          <Detail label="Principal">{kwacha(loan.principal)}</Detail>
          <Detail label="Processing fee">{kwacha(loan.processingFee)}</Detail>
          <Detail label="Pricing">
            {rateText(loan.interestMethod, loan.annualRatePct)} · {LABELS.interestMethod[loan.interestMethod]}
          </Detail>
          <Detail label="Term">
            {loan.term} × {LABELS.frequency[loan.frequency].toLowerCase()}
          </Detail>
          <Detail label="Disbursed / matures">
            {shortDate(loan.disbursedOn)} → {shortDate(loan.maturityDate)}
          </Detail>
          <Detail label="APR incl. fees">{loan.disclosure ? pct(loan.disclosure.aprPct) : "—"}</Detail>
        </dl>
      </Card>

      <div className="mt-6 mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "schedule", label: "Schedule", count: loan.schedule.length },
            { value: "payments", label: "Payments", count: loan.payments.length },
            { value: "collections", label: "Collections", count: loan.activities.length },
            { value: "disbursement", label: "Disbursement", count: loan.disbursements.length },
          ]}
        />
      </div>

      {tab === "schedule" && (
        <Card>
          {loan.schedule.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">The repayment schedule is generated when the loan is disbursed.</p>
          ) : (
            <Table>
              <thead>
                <tr className="border-b border-slate-100">
                  <Th>#</Th>
                  <Th>Due date</Th>
                  <Th className="text-right">Principal</Th>
                  <Th className="text-right">Interest</Th>
                  <Th className="text-right">Penalty</Th>
                  <Th className="text-right">Total due</Th>
                  <Th className="text-right">Paid</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-slate-100">
                {loan.schedule.map((s) => (
                  <tr key={s.id}>
                    <Td>{s.installmentNo}</Td>
                    <Td>{shortDate(s.dueDate)}</Td>
                    <Td className="text-right">{kwacha(s.principalDue)}</Td>
                    <Td className="text-right">{kwacha(s.interestDue)}</Td>
                    <Td className="text-right">{Number(s.penaltyDue) ? kwacha(s.penaltyDue) : "—"}</Td>
                    <Td className="text-right font-medium text-slate-900">{kwacha(add(s.principalDue, s.interestDue, s.feeDue, s.penaltyDue))}</Td>
                    <Td className="text-right">{kwacha(add(s.principalPaid, s.interestPaid, s.feePaid, s.penaltyPaid))}</Td>
                    <Td>
                      <StatusBadge status={s.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "payments" && (
        <Card>
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Receipt</Th>
                <Th>Received</Th>
                <Th>Channel</Th>
                <Th>Reference</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-slate-100">
              {loan.payments.map((pay) => (
                <tr key={pay.id}>
                  <Td className="font-medium text-slate-900">{pay.receiptNumber}</Td>
                  <Td>{shortDate(pay.receivedOn)}</Td>
                  <Td>{LABELS.channel[pay.channel]}</Td>
                  <Td>{pay.externalRef ?? "—"}</Td>
                  <Td className="text-right font-medium">{kwacha(pay.amount)}</Td>
                  <Td>
                    <StatusBadge status={pay.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <ButtonLink href={`/receipts/${pay.id}`} size="sm" variant="ghost" aria-label={`Print receipt ${pay.receiptNumber}`}>
                      <Printer className="size-4" />
                    </ButtonLink>
                    {pay.status === "posted" && user?.permissions.includes("payments:reverse:request") && (
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ reverse: pay.id })}>
                        Request reversal
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
              {loan.payments.length === 0 && (
                <tr>
                  <Td colSpan={7} className="text-slate-500">
                    No payments received yet.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === "collections" && (
        <Card>
          <ul className="divide-y divide-slate-100">
            {loan.activities.map((a) => (
              <li key={a.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.type === "promise_to_pay" ? "violet" : "neutral"}>{label(a.type)}</Badge>
                  <span className="text-xs text-slate-500">
                    {a.createdByName} · {dateTime(a.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{a.note}</p>
                {a.promisedAmount && (
                  <p className="tabular mt-1 text-xs font-medium text-violet-700">
                    Promised {kwacha(a.promisedAmount)} by {shortDate(a.promisedDate)}
                  </p>
                )}
              </li>
            ))}
            {loan.activities.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">No collection activity recorded.</li>}
          </ul>
        </Card>
      )}

      {tab === "disbursement" && (
        <Card>
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Requested</Th>
                <Th>Channel</Th>
                <Th>Destination</Th>
                <Th className="text-right">Gross</Th>
                <Th className="text-right">Fee</Th>
                <Th className="text-right">Net paid out</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-slate-100">
              {loan.disbursements.map((d) => (
                <tr key={d.id}>
                  <Td>
                    {dateTime(d.requestedAt)}
                    <span className="block text-xs text-slate-500">by {d.requestedByName}</span>
                  </Td>
                  <Td>{LABELS.channel[d.channel]}</Td>
                  <Td>{d.destination}</Td>
                  <Td className="text-right">{kwacha(d.amount)}</Td>
                  <Td className="text-right">{kwacha(d.fee)}</Td>
                  <Td className="text-right font-medium">{kwacha(d.netAmount)}</Td>
                  <Td>
                    <StatusBadge status={d.status} />
                  </Td>
                </tr>
              ))}
              {loan.disbursements.length === 0 && (
                <tr>
                  <Td colSpan={7} className="text-slate-500">
                    No disbursement requested yet.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {dialog === "disburse" && <DisburseDialog loan={loan} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "authorise" && pending && <AuthoriseDialog loanId={loan.id} pending={pending} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "payment" && <PaymentDialog loan={loan} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "activity" && <ActivityDialog loanId={loan.id} onClose={() => setDialog(null)} onDone={done} />}
      {dialog && typeof dialog === "object" && <ReversalDialog paymentId={dialog.reverse} onClose={() => setDialog(null)} onDone={done} />}
    </>
  );
}

function LoanNextStep({
  loan,
  pending,
  canCollect,
  open,
}: {
  loan: Loan;
  pending?: Loan["disbursements"][number];
  canCollect: boolean;
  open: (d: Dialog) => void;
}) {
  const p = loan.position;
  const perms = loan.permissions;
  if (loan.status === "pending_disbursement") {
    if (!pending)
      return perms.canRequestDisbursement ? (
        <NextStep
          tone="you"
          title="Request the payout"
          body={`Choose MTN, Airtel or bank. ${kwacha(Number(loan.principal) - Number(loan.processingFee))} reaches the customer after the ${kwacha(loan.processingFee)} fee.`}
          action={
            <Button onClick={() => open("disburse")}>
              <Send className="size-4" /> Request payout
            </Button>
          }
        />
      ) : (
        <NextStep title="Waiting for a payout request" body="The credit officer requests the payout; a separate authoriser then releases the money." />
      );
    return perms.canAuthoriseDisbursement ? (
      <NextStep
        tone="you"
        title={`Authorise ${kwacha(pending.netAmount)} to ${LABELS.channel[pending.channel]}`}
        body={`Requested by ${pending.requestedByName} for ${pending.destination}. Authorising sends the money and starts the repayment schedule.`}
        action={
          <Button onClick={() => open("authorise")}>
            <ShieldCheck className="size-4" /> Review & authorise
          </Button>
        }
      />
    ) : (
      <NextStep
        title={`Payout of ${kwacha(pending.netAmount)} awaiting authorisation`}
        body="Someone other than the requester and the credit approver must authorise it (separation of duties)."
      />
    );
  }
  if (loan.status === "active" && p.daysPastDue > 0)
    return (
      <NextStep
        tone={perms.canRecordPayment || canCollect ? "you" : "waiting"}
        title={`Collect ${kwacha(p.overdueAmount)} in arrears`}
        body={`${p.overdueInstallments} instalment${p.overdueInstallments > 1 ? "s" : ""} unpaid, ${p.daysPastDue} days past due. Call ${loan.customer.firstName} on ${loan.customer.phone} and log the outcome.`}
        action={
          <>
            {canCollect && (
              <Button variant="secondary" onClick={() => open("activity")}>
                Log follow-up
              </Button>
            )}
            {perms.canRecordPayment && <Button onClick={() => open("payment")}>Record payment</Button>}
          </>
        }
      />
    );
  if (loan.status === "active")
    return (
      <NextStep
        tone="done"
        title="Up to date"
        body={
          p.nextDueDate
            ? `Next instalment of ${kwacha(p.nextDueAmount)} is due on ${shortDate(p.nextDueDate)}. A reminder SMS goes out 3 days before.`
            : "All instalments are paid."
        }
      />
    );
  if (loan.status === "closed")
    return <NextStep tone="done" title="Loan fully repaid and closed" body="Thank the customer and consider them for a repeat loan." />;
  return null;
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "bad" }) {
  return (
    <Card className="stat-card p-4 sm:p-5">
      <p className="text-xs text-slate-500 sm:text-sm">{label}</p>
      <p className={`tabular mt-1 text-[clamp(1.125rem,5.2vw,1.5rem)] font-semibold sm:text-2xl ${tone === "bad" ? "text-rose-700" : "text-slate-900"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </Card>
  );
}

interface DialogProps {
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}

function useAction(onDone: DialogProps["onDone"]) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      await onDone(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function Footer({
  busy,
  error,
  onClose,
  submit,
  label,
  disabled,
  danger,
}: {
  busy: boolean;
  error: string | null;
  onClose: () => void;
  submit: () => void;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <>
      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} loading={busy} disabled={disabled} onClick={submit}>
          {label}
        </Button>
      </div>
    </>
  );
}

function DisburseDialog({ loan, onClose, onDone }: DialogProps & { loan: Loan }) {
  const [channel, setChannel] = useState<Channel>("mtn_momo");
  const [destination, setDestination] = useState(loan.customer.phone);
  const { busy, error, run } = useAction(onDone);
  const net = Number(loan.principal) - Number(loan.processingFee);
  return (
    <Modal
      open
      onClose={onClose}
      title="Request disbursement"
      description={`${kwacha(loan.principal)} less ${kwacha(loan.processingFee)} fee = ${kwacha(net)} paid to the customer.`}
    >
      <div className="space-y-4">
        <Field label="Payout channel">
          <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {CHANNELS.filter((c) => c !== "cash").map((c) => (
              <option key={c} value={c}>
                {LABELS.channel[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={channel === "bank" ? "Bank account number" : "Mobile money number"}>
          <input className={inputClass} value={destination} onChange={(e) => setDestination(e.target.value)} />
        </Field>
        <Notice tone="info">A different colleague must authorise the payout before money moves.</Notice>
      </div>
      <Footer
        busy={busy}
        error={error}
        onClose={onClose}
        label="Send for authorisation"
        disabled={destination.trim().length < 3}
        submit={() =>
          run(async () => (await api.post(`/loans/${loan.id}/disbursements`, { channel, destination }), "Disbursement requested and sent for authorisation."))
        }
      />
    </Modal>
  );
}

function AuthoriseDialog({ loanId, pending, onClose, onDone }: DialogProps & { loanId: string; pending: Loan["disbursements"][number] }) {
  const [note, setNote] = useState("");
  const { busy, error, run } = useAction(onDone);
  const decide = (decision: "authorise" | "reject") =>
    run(async () => {
      const r = await api.post<{ status: string; providerRef?: string }>(`/loans/${loanId}/disbursements/decision`, { decision, note: note || undefined });
      return r.status === "completed" ? `Paid out. Provider reference ${r.providerRef}. Schedule generated and journal posted.` : "Disbursement rejected.";
    });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Authorise payout of ${kwacha(pending.netAmount)}`}
      description={`To ${LABELS.channel[pending.channel]} ${pending.destination}, requested by ${pending.requestedByName}.`}
    >
      <Field label="Note (optional)">
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => decide("reject")} disabled={busy}>
          Reject
        </Button>
        <Button loading={busy} onClick={() => decide("authorise")}>
          Authorise and pay out
        </Button>
      </div>
    </Modal>
  );
}

function PaymentDialog({ loan, onClose, onDone }: DialogProps & { loan: Loan }) {
  const [amount, setAmount] = useState(loan.position.overdueAmount !== "0.00" ? loan.position.overdueAmount : loan.position.nextDueAmount);
  const [channel, setChannel] = useState<Channel>("cash");
  const [externalRef, setExternalRef] = useState("");
  // One key per dialog: a double click or network retry cannot post twice.
  const [key] = useState(newIdempotencyKey);
  const { busy, error, run } = useAction(onDone);
  return (
    <Modal open onClose={onClose} title="Record repayment" description="Allocated to penalties, fees, interest, then principal, oldest instalment first.">
      <div className="space-y-4">
        <Field label="Amount (ZMW)" hint={`Settlement today: ${kwacha(loan.settlement?.total)}`}>
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Channel">
          <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {LABELS.channel[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reference" hint={channel === "cash" ? "Optional for cash" : "Transaction ID from the provider or bank"}>
          <input className={inputClass} value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
        </Field>
      </div>
      <Footer
        busy={busy}
        error={error}
        onClose={onClose}
        label="Post payment"
        disabled={!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0}
        submit={() =>
          run(async () => {
            const r = await api.post<{ receiptNumber: string; duplicate?: boolean }>(
              "/payments",
              { loanId: loan.id, amount, channel, externalRef: externalRef || undefined, idempotencyKey: key },
              { "Idempotency-Key": key },
            );
            return r.duplicate ? `Already recorded as ${r.receiptNumber}.` : `Payment posted. Receipt ${r.receiptNumber}.`;
          })
        }
      />
    </Modal>
  );
}

function ActivityDialog({ loanId, onClose, onDone }: DialogProps & { loanId: string }) {
  const [type, setType] = useState<(typeof COLLECTION_ACTIVITY_TYPES)[number]>("call");
  const [note, setNote] = useState("");
  const [promisedAmount, setPromisedAmount] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const { busy, error, run } = useAction(onDone);
  return (
    <Modal open onClose={onClose} title="Log collection activity">
      <div className="space-y-4">
        <Field label="Type">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {COLLECTION_ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note">
          <textarea className={inputClass} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {type === "promise_to_pay" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Promised amount">
              <input className={inputClass} inputMode="decimal" value={promisedAmount} onChange={(e) => setPromisedAmount(e.target.value)} />
            </Field>
            <Field label="Promised date">
              <input type="date" className={inputClass} value={promisedDate} onChange={(e) => setPromisedDate(e.target.value)} />
            </Field>
          </div>
        )}
      </div>
      <Footer
        busy={busy}
        error={error}
        onClose={onClose}
        label="Save"
        disabled={note.trim().length < 3}
        submit={() => run(async () => (await api.post(`/loans/${loanId}/activities`, { type, note, promisedAmount, promisedDate }), "Activity recorded."))}
      />
    </Modal>
  );
}

function ReversalDialog({ paymentId, onClose, onDone }: DialogProps & { paymentId: string }) {
  const [reason, setReason] = useState("");
  const { busy, error, run } = useAction(onDone);
  return (
    <Modal
      open
      onClose={onClose}
      title="Request payment reversal"
      description="Another user must approve it. The original entries stay on record and a mirror journal is posted."
    >
      <Field label="Reason">
        <textarea className={inputClass} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Footer
        busy={busy}
        error={error}
        onClose={onClose}
        label="Request reversal"
        danger
        disabled={reason.trim().length < 5}
        submit={() => run(async () => (await api.post(`/payments/${paymentId}/reversals`, { reason }), "Reversal requested; awaiting approval."))}
      />
    </Modal>
  );
}
