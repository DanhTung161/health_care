import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Role = "Admin" | "Doctor" | "Staff";

const adminRoutes = ["/dashboard", "/patients", "/appointments", "/doctors", "/billing", "/analytics", "/users", "/settings"];
const sharedRoutes = ["/patients", "/appointments", "/doctors"];

function getRole(request: NextRequest): Role | null {
  const role = request.cookies.get("healthnexus.role")?.value;
  return role === "Admin" || role === "Doctor" || role === "Staff" ? role : null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isAdminRoute = adminRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (!isAdminRoute && !isApiRoute) return NextResponse.next();

  const session = request.cookies.get("healthnexus.session")?.value || request.cookies.get("better-auth.session_token")?.value;
  const role = getRole(request);

  if (!session || !role) {
    if (isApiRoute) return NextResponse.json({ message: "Authentication required" }, { status: 401 });
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, request.url));
  }

  const isAllowed = role === "Admin" || sharedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (!isAllowed) {
    if (isApiRoute) return NextResponse.json({ message: "Forbidden: insufficient permissions" }, { status: 403 });
    return NextResponse.redirect(new URL("/patients?error=forbidden", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/patients/:path*", "/appointments/:path*", "/doctors/:path*", "/billing/:path*", "/analytics/:path*", "/users/:path*", "/settings/:path*", "/api/:path*"],
};
