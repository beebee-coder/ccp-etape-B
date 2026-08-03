import { NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";

const log = createLogger({ handler: "auth-me" });

export async function GET(request: Request) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown";

  log.debug("Auth/me request received", { clientIp });

  const result = await validateApiRequest(request, {
    requireAuth: true,
    rateLimiter: "auth-me",
  });

  if (!result.ok) {
    const status = result.response.status;
    log.warn("Auth/me request unauthorized", { clientIp, status });
    return result.response;
  }

  const user = result.ctx.user;

  log.debug("Auth/me session resolved", { userId: user.sub, role: user.role });

  return NextResponse.json({
    user: {
      id: user.sub,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  });
}