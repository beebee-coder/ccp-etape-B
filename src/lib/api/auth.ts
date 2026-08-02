import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-auth" });

export async function requireAuth(request: Request): Promise<{ user: { sub: string; role: string; firstName?: string; lastName?: string } | null; response?: NextResponse }> {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    log.warn("requireAuth: authentication required, no valid user");
    return {
      user: null,
      response: NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 }
      ),
    };
  }

  log.debug("requireAuth: user authenticated", { userId: user.sub, role: user.role });
  return { user };
}

export async function requireRole(
  request: Request,
  allowedRoles: string[]
): Promise<{ user: { sub: string; role: string; firstName?: string; lastName?: string } | null; response?: NextResponse }> {
  const authResult = await requireAuth(request);

  if (authResult.response) {
    log.warn("requireRole: authentication failed before role check", { allowedRoles });
    return authResult;
  }

  const user = authResult.user;

  if (!user || !allowedRoles.includes(user.role)) {
    log.warn("requireRole: access denied — insufficient role", { userId: user?.sub, role: user?.role, allowedRoles });
    return {
      user: null,
      response: NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 }
      ),
    };
  }

  log.debug("requireRole: role authorized", { userId: user.sub, role: user.role, allowedRoles });
  return { user };
}