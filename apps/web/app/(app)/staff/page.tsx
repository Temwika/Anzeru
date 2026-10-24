"use client";

import { Users } from "../settings/sections";
import { PageHeader } from "@/components/ui";

export default function StaffPage() {
  return (
    <>
      <PageHeader title="Staff" description="Who can sign in, what their role allows, and which branches they work in." />
      <Users />
    </>
  );
}
