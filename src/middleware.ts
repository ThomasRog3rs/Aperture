import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that don't require setup to be completed.
const PUBLIC_PATHS = ["/setup", "/api/setup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all public/api/static paths through without checking setup.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  // Check setup completion via a cookie set by the /api/setup/status API.
  // The wizard sets this cookie after completion so we can avoid a round-trip
  // on every page load once setup is done.
  const setupDone = request.cookies.get("aperture_setup_done")?.value === "1";
  if (setupDone) {
    return NextResponse.next();
  }

  // No cookie — redirect to setup. The setup page will call /api/setup/status
  // and redirect back to "/" if setup is already complete.
  const setupUrl = request.nextUrl.clone();
  setupUrl.pathname = "/setup";
  return NextResponse.redirect(setupUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
