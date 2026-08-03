import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { getCookies, AUTH_COOKIE_ACCESS, AUTH_COOKIE_REFRESH, getCsrfToken, validateCsrfToken } from "@/lib/auth/cookies";
import { createLogger } from "@/lib/logger";

const log = createLogger({ handler: "middleware" });

const PUBLIC_API_ROUTES = [
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/health",
  "/api/openapi",
  "/api/local-db/fs",
];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return true;
  }

  if (pathname.startsWith("/api/")) {
    return !isPublicApiPath(pathname);
  }

  const dashboardPaths = [
    "/actions-ia",
    "/chat-ia",
    "/chef-de-bloc",
    "/chef-de-quart",
    "/creer-procedure",
    "/equipes",
    "/etat-des-lieux",
    "/guide-procedure",
    "/images",
    "/profile",
    "/q-r",
    "/rapports",
    "/rondier",
    "/structure-bdd",
    "/video-conference",
  ];

  return dashboardPaths.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}

const MUTATION_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

function isMutationMethod(method: string): boolean {
  return MUTATION_METHODS.has(method.toUpperCase());
}

function csrfErrorResponse() {
  return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
}

function loginRedirect(pathname: string, request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown";

  const method = request.method;

  if (!isProtectedPath(pathname)) {
    log.debug("Path not protected, allowing through", { pathname, method, clientIp });
    return NextResponse.next();
  }

  log.debug("Protected path accessed", { pathname, method, clientIp });

  const cookies = getCookies(request);
  const accessToken = cookies[AUTH_COOKIE_ACCESS];

  if (isApiRoute(pathname)) {
    const token = accessToken ?? getBearerToken(request) ?? null;

    if (!token) {
      log.warn("API route access denied: no token provided", { pathname, clientIp });
      return unauthorizedResponse();
    }

    const payload = await verifyToken(token);

    if (!payload) {
      log.warn("API route access denied: invalid token", { pathname, clientIp });
      return unauthorizedResponse();
    }

    log.debug("API route access granted via token", { pathname, userId: payload.sub, role: payload.role, tokenType: payload.type, clientIp });

    if (isMutationMethod(request.method)) {
      const csrfToken = getCsrfToken(request);
      if (!csrfToken || !validateCsrfToken(request, csrfToken)) {
        log.warn("API route CSRF check failed", { pathname, clientIp });
        return csrfErrorResponse();
      }
      log.debug("CSRF validation passed", { pathname, clientIp });
    }

    return NextResponse.next();
  }

  const refreshToken = cookies[AUTH_COOKIE_REFRESH];
  const token = accessToken ?? refreshToken ?? null;

  if (!token) {
    log.debug("Page route: no tokens found, redirecting to login", { pathname, clientIp });
    return loginRedirect(pathname, request);
  }

  const payload = await verifyToken(token);

  if (!payload) {
    log.warn("Page route: token invalid, redirecting to login", { pathname, clientIp });
    return loginRedirect(pathname, request);
  }

  log.debug("Page route access granted", { pathname, userId: payload.sub, role: payload.role, tokenType: payload.type, clientIp });
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
