"use client";

import { loanGroupSchema } from "@anzelu/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { Button, Field, inputClass, Modal, Notice } from "@/components/ui";
import { api, useApi, useSession } from "@/lib/api";

export const MEETING_DAYS = ["Daily", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** Create or edit a borrower group. */
export function GroupForm({
  onClose,
  group,
}: {
  onClose: () => void;
  group?: { id: string; name: string; branchId: string; meetingPlace: string | null; meetingDay: string | null; officerId: string | null };
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const { data: user } = useSession();
  const { data: branches } = useApi<{ id: string; name: string }[]>("/branches");
  const { data: staff } = useApi<{ id: string; fullName: string; role: string; isActive: boolean }[]>(
    user?.permissions.includes("settings:manage") ? "/users" : null,
  );
  const [v, setV] = useState({
    name: group?.name ?? "",
    branchId: group?.branchId ?? (user?.branchIds.length === 1 ? user.branchIds[0] : ""),
    meetingPlace: group?.meetingPlace ?? "",
    meetingDay: group?.meetingDay ?? "",
    officerId: group?.officerId ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loanGroupSchema.safeParse(v);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setBusy(true);
    setErrors({});
    try {
      if (group) {
        await api.patch(`/loan-groups/${group.id}`, parsed.data);
        await qc.invalidateQueries({ queryKey: [`/loan-groups/${group.id}`] });
      } else {
        const g = await api.post<{ id: string }>("/loan-groups", parsed.data);
        router.push(`/groups/${g.id}`);
      }
      await qc.invalidateQueries({ queryKey: ["/loan-groups"] });
      toast({ tone: "success", title: group ? "Group updated" : "Group created", body: group ? undefined : "Now add its members." });
      onClose();
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={group ? "Edit group" : "New loan group"}
      description="For example, the traders at one market who meet and repay together."
    >
      <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Group name" error={errors.name} className="sm:col-span-2">
          <input className={inputClass} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Sinda Market Traders" autoFocus />
        </Field>
        <Field label="Branch" error={errors.branchId}>
          <select className={inputClass} value={v.branchId} onChange={(e) => setV({ ...v, branchId: e.target.value })}>
            <option value="">Choose…</option>
            {branches
              ?.filter((b) => !user?.branchIds.length || user.permissions.includes("settings:manage") || user.branchIds.includes(b.id))
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Meeting day">
          <select className={inputClass} value={v.meetingDay} onChange={(e) => setV({ ...v, meetingDay: e.target.value })}>
            <option value="">Not fixed</option>
            {MEETING_DAYS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Meeting place" className={staff ? "" : "sm:col-span-2"}>
          <input className={inputClass} value={v.meetingPlace} onChange={(e) => setV({ ...v, meetingPlace: e.target.value })} placeholder="Sinda Main Market" />
        </Field>
        {staff && (
          <Field label="Loan officer">
            <select className={inputClass} value={v.officerId} onChange={(e) => setV({ ...v, officerId: e.target.value })}>
              <option value="">Not assigned</option>
              {staff
                .filter((u) => u.isActive && u.role === "credit_officer")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {errors.form && (
          <div className="sm:col-span-2">
            <Notice tone="error">{errors.form}</Notice>
          </div>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {group ? "Save" : "Create group"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
