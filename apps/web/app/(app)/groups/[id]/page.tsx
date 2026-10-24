"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarDays, MapPin, Pencil, Phone, Plus, Siren, UserMinus, UsersRound, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { GroupForm } from "@/components/group-form";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Modal,
  Notice,
  PageHeader,
  SearchInput,
  Skeleton,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { api, useApi, useSession } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kwacha, pct, shortDate } from "@/lib/format";

interface Member {
  id: string;
  customerNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  loans: { id: string; loanNumber: string; productName: string; nextDueDate: string | null; nextDueAmount: string }[];
  outstanding: string;
  overdue: string;
  daysPastDue: number;
}

interface GroupDetail {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  officerId: string | null;
  officerName: string | null;
  meetingPlace: string | null;
  meetingDay: string | null;
  isActive: boolean;
  members: Member[];
  totals: { members: number; activeLoans: number; outstanding: string; overdue: string; dueToday: string; par30: string };
}

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: user } = useSession();
  const { data: g, error } = useApi<GroupDetail>(`/loan-groups/${id}`);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const canManage = user?.permissions.includes("customers:write") || user?.permissions.includes("settings:manage");

  async function remove(m: Member) {
    try {
      await api.delete(`/loan-groups/${id}/members/${m.id}`);
      await Promise.all([qc.invalidateQueries({ queryKey: [`/loan-groups/${id}`] }), qc.invalidateQueries({ queryKey: ["/loan-groups"] })]);
      toast({ tone: "success", title: `${m.firstName} ${m.lastName} removed from the group` });
    } catch (err) {
      toast({ tone: "error", title: "Couldn’t remove", body: (err as Error).message });
    }
  }

  if (error) return <ErrorState error={error} />;
  if (!g) return <Skeleton className="h-96" />;
  return (
    <>
      <PageHeader
        back={{ href: "/groups", label: "Loan Groups" }}
        eyebrow={g.branchName}
        title={g.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {g.meetingPlace && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {g.meetingPlace}
              </span>
            )}
            {g.meetingDay && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" /> Meets {g.meetingDay === "Daily" ? "daily" : `every ${g.meetingDay}`}
              </span>
            )}
            {g.officerName && <span>Officer: {g.officerName}</span>}
          </span>
        }
        actions={
          canManage && (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit
              </Button>
              <Button onClick={() => setAdding(true)}>
                <Plus className="size-4" /> Add members
              </Button>
            </>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Members" value={g.totals.members} sub={`${g.totals.activeLoans} active loans`} icon={UsersRound} />
        <StatCard label="Due today" value={kwacha(g.totals.dueToday)} icon={CalendarCheck} tone="copper" />
        <StatCard label="Outstanding" value={kwacha(g.totals.outstanding)} icon={Wallet} tone="sky" />
        <StatCard label="Overdue" value={kwacha(g.totals.overdue)} sub={`PAR 30: ${pct(g.totals.par30)}`} icon={Siren} tone="rose" />
      </div>

      <Card>
        <CardHeader title="Members" description="Each member’s loans and where they stand today." />
        {!g.members.length ? (
          <EmptyState icon={UsersRound} title="No members yet" body="Add the borrowers who belong to this group." />
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Member</Th>
                <Th>Loans</Th>
                <Th>Next payment</Th>
                <Th className="text-right">Outstanding</Th>
                <Th className="text-right">Overdue</Th>
                <Th>Status</Th>
                {canManage && <Th />}
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-slate-100">
              {g.members.map((m) => {
                const next = m.loans.filter((l) => l.nextDueDate).sort((a, b) => a.nextDueDate!.localeCompare(b.nextDueDate!))[0];
                return (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <Td>
                      <Link href={`/customers/${m.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {m.firstName} {m.lastName}
                      </Link>
                      <a href={`tel:${m.phone}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700">
                        <Phone className="size-3" /> {m.phone}
                      </a>
                    </Td>
                    <Td>
                      {m.loans.length ? (
                        m.loans.map((l) => (
                          <Link key={l.id} href={`/loans/${l.id}`} className="block text-sm hover:text-brand-700">
                            {l.loanNumber} <span className="text-xs text-slate-500">· {l.productName}</span>
                          </Link>
                        ))
                      ) : (
                        <span className="text-slate-400">No active loan</span>
                      )}
                    </Td>
                    <Td>{next ? `${kwacha(next.nextDueAmount)} · ${shortDate(next.nextDueDate)}` : "—"}</Td>
                    <Td className="text-right font-medium text-slate-900">{kwacha(m.outstanding)}</Td>
                    <Td className={cn("text-right", Number(m.overdue) > 0 ? "font-medium text-rose-700" : "text-slate-400")}>
                      {Number(m.overdue) > 0 ? kwacha(m.overdue) : "—"}
                    </Td>
                    <Td>
                      {!m.loans.length ? (
                        <Badge>Idle</Badge>
                      ) : m.daysPastDue > 0 ? (
                        <Badge tone={m.daysPastDue > 30 ? "red" : "amber"} dot>
                          {m.daysPastDue} days late
                        </Badge>
                      ) : (
                        <Badge tone="green" dot>
                          On time
                        </Badge>
                      )}
                    </Td>
                    {canManage && (
                      <Td className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => remove(m)} aria-label={`Remove ${m.firstName} from the group`}>
                          <UserMinus className="size-4" />
                        </Button>
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {editing && <GroupForm group={g} onClose={() => setEditing(false)} />}
      {adding && <AddMembers groupId={id} existing={g.members.map((m) => m.id)} onClose={() => setAdding(false)} />}
    </>
  );
}

interface CustomerRow {
  id: string;
  customerNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  branchName: string;
  groupId: string | null;
}

function AddMembers({ groupId, existing, onClose }: { groupId: string; existing: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data } = useApi<CustomerRow[]>(`/customers?pageSize=50${q ? `&search=${encodeURIComponent(q)}` : ""}`);
  const rows = data?.filter((c) => !existing.includes(c.id)) ?? [];

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ added: number }>(`/loan-groups/${groupId}/members`, { customerIds: picked });
      await Promise.all([qc.invalidateQueries({ queryKey: [`/loan-groups/${groupId}`] }), qc.invalidateQueries({ queryKey: ["/loan-groups"] })]);
      toast({ tone: "success", title: `${r.added} member${r.added === 1 ? "" : "s"} added` });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add members" description="Borrowers already in another group will move to this one." wide>
      <div className="space-y-4">
        <SearchInput wide value={q} onChange={setQ} placeholder="Search by name, NRC or phone" />
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {!data && <Skeleton className="m-3 h-24" />}
          {data && !rows.length && <li className="p-4 text-center text-sm text-slate-500">No borrowers found</li>}
          {rows.map((c) => {
            const on = picked.includes(c.id);
            return (
              <li key={c.id}>
                <label className={cn("flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm", on ? "bg-brand-50" : "hover:bg-slate-50")}>
                  <input
                    type="checkbox"
                    className="size-4 rounded border-slate-300"
                    checked={on}
                    onChange={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                  />
                  <span className="flex-1">
                    <span className="font-medium text-slate-900">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {c.customerNumber} · {c.phone} · {c.branchName}
                    </span>
                  </span>
                  {c.groupId && <Badge>In a group</Badge>}
                </label>
              </li>
            );
          })}
        </ul>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-500">{picked.length} selected</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={busy} disabled={!picked.length} onClick={add}>
              Add {picked.length || ""} to group
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
