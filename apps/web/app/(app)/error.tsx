"use client";

import { ErrorView } from "@/components/error-view";

/** Keeps the sidebar and header in place, so one broken screen never strands staff. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} inline />;
}
