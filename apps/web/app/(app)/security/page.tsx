"use client";

import { Security } from "../settings/sections";
import { PageHeader, Skeleton } from "@/components/ui";
import { useSession } from "@/lib/api";

export default function SecurityPage() {
  const { data: user } = useSession();
  return (
    <>
      <PageHeader title="Security" description="Protect your account with a second sign-in step." />
      {user ? <Security mfaEnabled={user.mfaEnabled} /> : <Skeleton className="h-64" />}
    </>
  );
}
