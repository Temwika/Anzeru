"use client";

import { Branches } from "../settings/sections";
import { PageHeader } from "@/components/ui";

export default function BranchesPage() {
  return (
    <>
      <PageHeader title="Branches" description="Offices and the borrowers and loans they look after." />
      <Branches />
    </>
  );
}
