import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route protection: sends visitors without a session cookie to the
 * login page. Real authorisation happens in the API on every request.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("anz_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/applications/:path*",
    "/loans/:path*",
    "/repayments/:path*",
    "/approvals/:path*",
    "/collections/:path*",
    "/accounting/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/borrower/:path*",
    "/receipts/:path*",
    "/groups/:path*",
    "/products/:path*",
    "/branches/:path*",
    "/staff/:path*",
    "/transfer/:path*",
    "/arrears-by-officer/:path*",
    "/company/:path*",
    "/backups/:path*",
    "/sms/:path*",
    "/security/:path*",
    "/audit/:path*",
  ],
};
