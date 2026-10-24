"use client";

import { ChevronDown, Phone, UserRoundSearch } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { Avatar, Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, Table, Td, Th } from "@/components/ui";
import { useApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { kwacha, pct } from "@/lib/format";

interface LateLoan {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  phone: string;
  overdueAmount: string;
  daysPastDue: number;
}

interface Officer {
  officerId: string;
  officerName: string;
  loans: number;
  outstanding: string;
  loansInArrears: number;
  arrearsAmount: string;
  par30: string;
  worstDaysPastDue: number;
  loansLate: LateLoan[];
}

export default function ArrearsByOfficerPage() {
  const { data, error } = useApi<{ asOf: string; officers: Officer[] }>("/reports/arrears-by-officer");
  const [open, setOpen] = useState<string | null>(null);
  const max = Math.max(1, ...(data?.officers.map((o) => Number(o.arrearsAmount)) ?? [0]));

  return (
    <>
      <PageHeader
        title="Arrears by Officer"
        description="Each loan officer’s book and the loans they need to follow up. Click an officer to see their late loans."
      />
      {error && <ErrorState error={error} />}
      {!data && !error && <Skeleton className="h-72" />}
      {data && !data.officers.length && (
        <Card>
          <EmptyState icon={UserRoundSearch} title="No active loans" />
        </Card>
      )}
      {!!data?.officers.length && (
        <Card>
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>Officer</Th>
                <Th className="text-right">Loans</Th>
                <Th className="text-right">Outstanding</Th>
                <Th className="text-right">In arrears</Th>
                <Th className="w-1/4">Arrears amount</Th>
                <Th className="text-right">PAR 30</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-slate-100">
              {data.officers.map((o) => {
                const expanded = open === o.officerId;
                const par = Number(o.par30);
                return (
                  <Fragment key={o.officerId}>
                    <tr className="cursor-pointer hover:bg-slate-50/70" onClick={() => setOpen(expanded ? null : o.officerId)} aria-expanded={expanded}>
                      <Td>
                        <span className="flex items-center gap-3">
                          <Avatar name={o.officerName} size="sm" />
                          <span className="font-medium text-slate-900">{o.officerName}</span>
                        </span>
                      </Td>
                      <Td className="text-right">{o.loans}</Td>
                      <Td className="text-right">{kwacha(o.outstanding)}</Td>
                      <Td className="text-right">
                        {o.loansInArrears} <span className="text-xs text-slate-400">/ {o.loans}</span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-rose-400" style={{ width: `${(Number(o.arrearsAmount) / max) * 100}%` }} />
                          </div>
                          <span className="w-24 text-right font-medium text-slate-900">{kwacha(o.arrearsAmount)}</span>
                        </div>
                      </Td>
                      <Td className="text-right">
                        <Badge tone={par > 10 ? "red" : par > 5 ? "amber" : "green"}>{pct(o.par30)}</Badge>
                      </Td>
                      <Td className="text-right">
                        <ChevronDown className={cn("ml-auto size-4 text-slate-400 transition", expanded && "rotate-180")} />
                      </Td>
                    </tr>
                    {expanded && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={7} className="px-5 py-3">
                          {!o.loansLate.length ? (
                            <p className="py-2 text-sm text-slate-500">No late loans. Every borrower is up to date.</p>
                          ) : (
                            <ul className="divide-y divide-slate-200/70">
                              {o.loansLate.map((l) => (
                                <li key={l.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-2 text-sm">
                                  <Link href={`/loans/${l.id}`} className="w-28 font-medium text-slate-900 hover:text-brand-700">
                                    {l.loanNumber}
                                  </Link>
                                  <Link href={`/customers/${l.customerId}`} className="min-w-40 flex-1 hover:text-brand-700">
                                    {l.customerName}
                                  </Link>
                                  <a href={`tel:${l.phone}`} className="flex items-center gap-1 text-slate-500 hover:text-brand-700">
                                    <Phone className="size-3.5" /> {l.phone}
                                  </a>
                                  <span className="w-28 text-right font-medium text-rose-700">{kwacha(l.overdueAmount)}</span>
                                  <Badge tone={l.daysPastDue > 30 ? "red" : "amber"}>{l.daysPastDue} days</Badge>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
