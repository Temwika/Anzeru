"use client";

import { Products } from "../settings/sections";
import { PageHeader } from "@/components/ui";

export default function ProductsPage() {
  return (
    <>
      <PageHeader title="Loan Products" description="Pricing and rules for every new loan. Existing loans keep the terms they were booked on." />
      <Products />
    </>
  );
}
