import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Role = "ADMIN" | "DOCTOR" | "STAFF";

interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  exp: number;
  iat?: number;
}

const AUTH_COOKIE = "auth_token";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const roleLandingPage: Record<Role, string> = {
  ADMIN: "/dashboard",
  DOCTOR: "/appointments",
  STAFF: "/patients",
};

const allowedRoutePrefixes: Record<Exclude<Role, "ADMIN">, string[]> = {
  DOCTOR: ["/appointments", "/patients", "/api/appointments", "/api/patients"],
  STAFF: ["/appointments", "/patients", "/api/appointments", "/api/patients"],
};

function isRole(value: unknown): value is Role {
  return value === "ADMIN" || value === "DOCTOR" || value === "STAFF";
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.userId === "string" &&
    typeof payload.email === "string" &&
    typeof payload.exp === "number" &&
    isRole(payload.role)
  );
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(paddedBase64);

    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);

  return copy.buffer;
}

async function verifyJwt(token: string): Promise<JwtPayload | null> {
  const [encodedHeader, encodedPayload, encodedSignature, ...remainingParts] =
    token.split(".");

  if (
    !encodedHeader ||
    !encodedPayload ||
    !encodedSignature ||
    remainingParts.length > 0
  ) {
    return null;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return null;
  }

  const headerBytes = decodeBase64Url(encodedHeader);
  const payloadBytes = decodeBase64Url(encodedPayload);
  const signature = decodeBase64Url(encodedSignature);

  if (!headerBytes || !payloadBytes || !signature) {
    return null;
  }

  const header = parseJson(decoder.decode(headerBytes));
  const payload = parseJson(decoder.decode(payloadBytes));

  if (
    !header ||
    typeof header !== "object" ||
    (header as Record<string, unknown>).alg !== "HS256" ||
    !isJwtPayload(payload)
  ) {
    return null;
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const isValidSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      toArrayBuffer(signature),
      encoder.encode(`${encodedHeader}.${encodedPayload}`),
    );

    return isValidSignature ? payload : null;
  } catch {
    return null;
  }
}

function matchesRoute(pathname: string, routePrefix: string): boolean {
  return pathname === routePrefix || pathname.startsWith(`${routePrefix}/`);
}

function isAllowedPath(role: Role, pathname: string): boolean {
  if (role === "ADMIN") {
    return true;
  }

  return allowedRoutePrefixes[role].some((routePrefix) =>
    matchesRoute(pathname, routePrefix),
  );
}

function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

function redirectToLogin(request: NextRequest): NextResponse {
  const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", callbackUrl);

  return NextResponse.redirect(loginUrl);
}

function unauthorizedResponse(request: NextRequest, role: Role): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: "Forbidden: insufficient permissions" },
      { status: 403 },
    );
  }

  const destination = new URL(roleLandingPage[role], request.url);
  destination.searchParams.set("error", "unauthorized");

  return NextResponse.redirect(destination);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const session = token ? await verifyJwt(token) : null;
  const hasInvalidToken = Boolean(token) && !session;

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL(roleLandingPage[session.role], request.url));
    }

    const response = NextResponse.next();
    return hasInvalidToken ? clearAuthCookie(response) : response;
  }

  if (!session) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 },
        )
      : redirectToLogin(request);

    return hasInvalidToken ? clearAuthCookie(response) : response;
  }

  if (!isAllowedPath(session.role, pathname)) {
    return unauthorizedResponse(request, session.role);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|txt|xml|woff2?|ttf|eot)$).*)",
  ],
};
