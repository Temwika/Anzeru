import { redirect } from "next/navigation";

/** Settings now live in the menu (Company Settings, Loan Products, Branches, Staff, Security). */
export default function SettingsPage() {
  redirect("/company");
}
