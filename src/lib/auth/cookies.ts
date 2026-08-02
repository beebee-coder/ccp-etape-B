import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createLogger } from "@/lib/logger";
import {
  AUTH_COOKIE_ACCESS,
  AUTH_COOKIE_REFRESH,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} from "./config";

const log = createLogger({ module: "cookies" });

export { AUTH_COOKIE_ACCESS, AUTH_COOKIE_REFRESH, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE };

export const CSRF_COOKIE_NAME = "csrf_token";

export const CSRF_HEADER_NAME = "x-csrf-token";

const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ACCESS_TOKEN_MAX_AGE,
};

const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function generateCsrfToken(): string {
  const token = randomBytes(32).toString("hex");
  log.debug("CSRF token generated");
  return token;
}

export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
  log.debug("CSRF cookie set on response");
}

export function getCsrfToken(request: Request): string | null {
  const cookies = getCookies(request);
  const token = cookies[CSRF_COOKIE_NAME] ?? null;
  if (!token) {
    log.debug("No CSRF token found in request cookies");
  }
  return token;
}

export function validateCsrfToken(request: Request, expected: string): boolean {
  const provided = request.headers.get(CSRF_HEADER_NAME);
  if (!provided) {
    log.warn("CSRF token missing from request header");
    return false;
  }
  const valid = provided === expected;
  if (!valid) {
    log.warn("CSRF token mismatch");
  }
  return valid;
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
) {
  response.cookies.set(AUTH_COOKIE_ACCESS, accessToken, {
    ...BASE_COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  response.cookies.set(AUTH_COOKIE_REFRESH, refreshToken, {
    ...BASE_COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
  log.debug("Auth cookies set on response");
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_ACCESS, "", {
    ...BASE_COOKIE_OPTIONS,
    maxAge: 0,
  });
  response.cookies.set(AUTH_COOKIE_REFRESH, "", {
    ...BASE_COOKIE_OPTIONS,
    maxAge: 0,
  });
  log.debug("Auth cookies cleared on response");
}

export function getCsrfTokenClient(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + CSRF_COOKIE_NAME + "=([^;]*)"));
  const token = match ? decodeURIComponent(match[1]) : null;
  if (token) return token;
  try {
    const fromStorage = localStorage.getItem("csrf_token");
    if (fromStorage) return fromStorage;
  } catch {
    // localStorage unavailable
  }
  log.debug("No CSRF token found in document.cookie or localStorage");
  return null;
}

export function getCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx > 0) {
      const name = part.slice(0, eqIdx).trim();
      const value = part.slice(eqIdx + 1).trim();
      cookies[name] = value;
    }
  }
  return cookies;
}
