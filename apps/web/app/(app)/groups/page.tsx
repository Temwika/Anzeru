"use client";

import { CalendarDays, ChevronRight, MapPin, Plus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GroupForm } from "@/components/group-form";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { useApi, useSession } from "@/lib/api";
import { kwacha } from "@/lib/format";

interface Group {
  id: string;
  name: string;
  branchName: string;
  officerName: string | null;
  meetingPlace: string | null;
  meetingDay: string | null;
  isActive: boolean;
  members: number;
  activeLoans: number;
  outstanding: string;
  overdue: string;
  par30: string;
}

export default function GroupsPage() {
  const { data: user } = useSession();
  const { data, error } = useApi<Group[]>("/loan-groups");
  const [creating, setCreating] = useState(false);
  const canManage = user?.permissions.includes("customers:write") || user?.permissions.includes("settings:manage");

  return (
    <>
      <PageHeader
        title="Loan Groups"
        description="Borrowers who meet and repay together, such as traders at one market. See each group’s book at a glance."
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New group
            </Button>
          )
        }
      />
      {error && <ErrorState error={error} />}
      {!data && !error && <Skeleton className="h-64" />}
      {data && !data.length && (
        <Card>
          <EmptyState icon={UsersRound} title="No groups yet" body="Create a group for each market or association, then add its members." />
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((g) => {
          const late = Number(g.overdue) > 0;
          return (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <UsersRound className="size-5" />
                </span>
                {!g.isActive ? (
                  <Badge>Paused</Badge>
                ) : late ? (
                  <Badge tone="amber" dot>
                    Arrears
                  </Badge>
                ) : (
                  <Badge tone="green" dot>
                    On track
                  </Badge>
                )}
              </div>
              <h2 className="mt-4 font-display text-lg font-semibold text-slate-900">{g.name}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {g.meetingPlace && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" /> {g.meetingPlace}
                  </span>
                )}
                {g.meetingDay && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3" /> {g.meetingDay}
                  </span>
                )}
              </p>
              <dl className="tabular mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                <div>
                  <dd className="font-display text-lg font-bold text-slate-900">{g.members}</dd>
                  <dt className="text-[11px] text-slate-500">Members</dt>
                </div>
                <div>
                  <dd className="font-display text-lg font-bold text-slate-900">{kwacha(g.outstanding, { compact: true })}</dd>
                  <dt className="text-[11px] text-slate-500">Outstanding</dt>
                </div>
                <div>
                  <dd className={`font-display text-lg font-bold ${late ? "text-rose-700" : "text-slate-900"}`}>{kwacha(g.overdue, { compact: true })}</dd>
                  <dt className="text-[11px] text-slate-500">Overdue</dt>
                </div>
              </dl>
              <p className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {g.branchName}
                  {g.officerName ? ` · ${g.officerName}` : ""}
                </span>
                <ChevronRight className="size-4 text-slate-400 transition group-hover:translate-x-0.5" />
              </p>
            </Link>
          );
        })}
      </div>
      {creating && <GroupForm onClose={() => setCreating(false)} />}
    </>
  );
}
