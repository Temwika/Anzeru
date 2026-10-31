import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { StatusPage } from "@/components/status-page";
import { ButtonLink } from "@/components/ui";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="This page has moved on"
      body="The link may be old, mistyped, or for a record you no longer have access to. Everything else is right where you left it."
      actions={
        <>
          <ButtonLink href="/dashboard">
            <LayoutDashboard className="size-4" />
            Go to dashboard
          </ButtonLink>
          <ButtonLink href="/" variant="secondary">
            <ArrowLeft className="size-4" />
            Home page
          </ButtonLink>
        </>
      }
    />
  );
}
