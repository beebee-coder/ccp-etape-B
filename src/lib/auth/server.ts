import { verifyToken } from "./jwt";
import { getCookies, AUTH_COOKIE_ACCESS, AUTH_COOKIE_REFRESH } from "./cookies";
import { createLogger } from "@/lib/logger";
import type { JwtPayload } from "./jwt";

const log = createLogger({ module: "auth-server" });

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}

export async function getAuthenticatedUser(
  request: Request
): Promise<JwtPayload | null> {
  const cookies = getCookies(request);
  const token = cookies[AUTH_COOKIE_ACCESS] ?? getBearerToken(request);

  if (!token) {
    log.debug("getAuthenticatedUser: no access token found");
    return null;
  }

  const user = await verifyToken(token);
  if (!user) {
    log.debug("getAuthenticatedUser: access token verification returned null");
    return null;
  }

  log.debug("getAuthenticatedUser: user resolved", { userId: user.sub, role: user.role });
  return user;
}

export async function getSession(request: Request): Promise<JwtPayload | null> {
  const cookies = getCookies(request);
  const accessToken = cookies[AUTH_COOKIE_ACCESS] ?? getBearerToken(request);

  if (accessToken) {
    const payload = await verifyToken(accessToken);
    if (payload) {
      log.debug("getSession: resolved from access token", { userId: payload.sub });
      return payload;
    }
    log.debug("getSession: access token invalid, falling back to refresh token");
  }

  const refreshToken = cookies[AUTH_COOKIE_REFRESH];
  if (refreshToken) {
    const payload = await verifyToken(refreshToken);
    if (payload) {
      log.debug("getSession: resolved from refresh token", { userId: payload.sub });
      return payload;
    }
    log.debug("getSession: refresh token invalid");
  }

  log.debug("getSession: no valid session found");
  return null;
}
