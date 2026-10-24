import { redirect } from "next/navigation";

// Collections and Arrears were the same list; arrears follow-up now lives in one place.
export default function CollectionsPage() {
  redirect("/loans/arrears");
}
