import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { getCookies, AUTH_COOKIE_REFRESH, AUTH_COOKIE_ACCESS } from "@/lib/auth/cookies";
import { ACCESS_TOKEN_MAX_AGE } from "@/lib/auth/config";
import { signAccessToken } from "@/lib/auth/jwt";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";

const log = createLogger({ handler: "auth-refresh" });

export async function POST(request: Request) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown";

  log.info("Refresh token request received", { clientIp });

  const result = await validateApiRequest(request, {
    requireAuth: false,
    allowedContentTypes: ["application/json"],
    rateLimiter: "auth-refresh",
  });

  if (!result.ok) {
    const status = result.response.status;
    log.warn("Refresh request validation failed", { clientIp, status });
    return result.response;
  }

  const cookies = getCookies(request);
  const refreshToken = cookies[AUTH_COOKIE_REFRESH];

  if (!refreshToken) {
    log.warn("Refresh request missing refresh token cookie", { clientIp });
    return NextResponse.json(
      { error: "Refresh token requis" },
      { status: 401 }
    );
  }

  const payload = await verifyToken(refreshToken);

  if (!payload || payload.type !== "refresh") {
    log.warn("Refresh token invalid or not a refresh token", { clientIp });
    const response = NextResponse.json(
      { error: "Token invalide ou expiré" },
      { status: 401 }
    );
    response.cookies.set(AUTH_COOKIE_REFRESH, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  log.debug("Refresh token verified", { userId: payload.sub, clientIp });

  const newAccessToken = await signAccessToken({
    sub: payload.sub,
    role: payload.role,
    firstName: payload.firstName,
    lastName: payload.lastName,
  });

  const response = NextResponse.json({ token: newAccessToken });
  response.cookies.set(AUTH_COOKIE_ACCESS, newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  log.info("Access token refreshed successfully", { userId: payload.sub, clientIp });

  return response;
}