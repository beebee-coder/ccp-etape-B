import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

import { requireAuth, requireRole } from "@/lib/api/auth";
import { validateContentType, validateRequestBody, validateImageUploads } from "@/lib/api/validation";
import { rateLimit, getRateLimitHeaders, getClientIp } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "handlers" });

export type AuthenticatedUser = {
  sub: string;
  role: string;
  firstName?: string;
  lastName?: string;
};

export interface ValidateOptions {
  requireAuth?: boolean;
  allowedRoles?: string[];
  allowedContentTypes?: string[];
  rateLimiter?: string;
  schema?: ZodSchema;
  validateImageUpload?: boolean;
}

export interface ValidatedRequest {
  user: AuthenticatedUser;
  body: unknown;
}

export async function validateApiRequest(
  request: Request,
  options: ValidateOptions = {}
): Promise<{ ok: true; ctx: ValidatedRequest } | { ok: false; response: Response }> {
  const needAuth = options.requireAuth ?? true;
  const clientIp = getClientIp(request);
  const method = request.method;
  const url = new URL(request.url).pathname;

  log.debug("validateApiRequest: processing request", { url, method, needAuth, clientIp });

  let user: AuthenticatedUser | null = null;

  if (needAuth) {
    const authResult =
      options.allowedRoles && options.allowedRoles.length > 0
        ? await requireRole(request, options.allowedRoles)
        : await requireAuth(request);

    if (authResult.response) {
      log.warn("validateApiRequest: authentication failed", { url, method, clientIp, status: authResult.response.status });
      return { ok: false, response: authResult.response };
    }
    user = authResult.user as AuthenticatedUser;
    log.debug("validateApiRequest: user authenticated", { url, method, userId: user.sub, role: user.role });
  }

  if (options.allowedContentTypes) {
    const ct = validateContentType(request, options.allowedContentTypes);
    if (!ct.valid) {
      log.warn("validateApiRequest: content type validation failed", { url, method, clientIp, reason: ct.error });
      return { ok: false, response: NextResponse.json({ error: ct.error }, { status: 415 }) };
    }
  }

  if (options.rateLimiter) {
    const ip = getClientIp(request);
    const rl = await rateLimit(`${options.rateLimiter}:${ip}`, options.rateLimiter);
    if (!rl.success) {
      log.warn("validateApiRequest: rate limit exceeded", { url, method, clientIp, routeKey: options.rateLimiter });
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Trop de requêtes. Réessayez plus tard." },
          { status: 429, headers: getRateLimitHeaders(rl) }
        ),
      };
    }
    log.debug("validateApiRequest: rate limit check passed", { url, method, clientIp, routeKey: options.rateLimiter, remaining: rl.remaining });
  }

  let body: unknown = null;

  if (options.schema) {
    try {
      body = await request.json();
    } catch {
      log.warn("validateApiRequest: invalid request body JSON", { url, method, clientIp });
      return { ok: false, response: NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 }) };
    }

    const validated = validateRequestBody(body, options.schema);
    if (!validated.success) {
      log.warn("validateApiRequest: request body schema validation failed", { url, method, clientIp, error: validated.error });
      return { ok: false, response: NextResponse.json({ error: validated.error, details: validated.details }, { status: 400 }) };
    }

    body = validated.data;

    if (options.validateImageUpload) {
      const result = validateImageUploads(validated.data);
      if (!result.valid) {
        log.warn("validateApiRequest: image upload validation failed", { url, method, clientIp, reason: result.error });
        return { ok: false, response: NextResponse.json({ error: result.error }, { status: 400 }) };
      }
    }
  }

  log.debug("validateApiRequest: request validated successfully", { url, method, clientIp });
  return { ok: true, ctx: { user: user as AuthenticatedUser, body } };
}
