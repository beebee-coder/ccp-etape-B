import { NextResponse } from "next/server";
import { verifyAdminCredentials } from "@/lib/auth/admin";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies, setCsrfCookie, generateCsrfToken } from "@/lib/auth/cookies";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const LoginSchema = z.object({
  username: z.string().min(1, "L'identifiant est requis"),
  password: z.string().min(1, "Le mot de passe est requis"),
  callbackUrl: z.string().optional(),
});

const log = createLogger({ handler: "auth-login" });

export async function POST(request: Request) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown";

   log.info("Login request received", { clientIp, contentType: request.headers.get("content-type") });
 
   const result = await validateApiRequest(request, {
     requireAuth: false,
     allowedContentTypes: ["application/json"],
     rateLimiter: "auth-login",
     schema: LoginSchema,
   });
 
   if (!result.ok) {
      const status = result.response.status;
      try {
        const errorBody = await result.response.clone().json();
        log.warn("Login request validation failed", { clientIp, status, errorBody });
      } catch {
        log.warn("Login request validation failed", { clientIp, status });
      }
      return result.response;
    }
  
    const { username, password, callbackUrl } = result.ctx.body as z.infer<typeof LoginSchema>;
  
    log.debug("Login credentials submitted", { username, callbackUrl, clientIp });

   const user = await verifyAdminCredentials(username, password);
 
    if (!user) {
      log.warn("Login failed: invalid credentials", { username, clientIp });
     return NextResponse.json(
       { error: "Identifiants incorrects" },
       { status: 401 }
     );
   }
 
    log.info("Login credentials verified", { userId: user.id, username, role: user.role, clientIp });
 
   const accessToken = await signAccessToken({
     sub: user.id,
     role: user.role,
     firstName: user.firstName,
     lastName: user.lastName,
   });
 
   const refreshToken = await signRefreshToken({
     sub: user.id,
     role: user.role,
     firstName: user.firstName,
     lastName: user.lastName,
   });
 
    const csrfToken = generateCsrfToken();
  
    const response = NextResponse.json({
     token: accessToken,
     csrfToken: csrfToken,
     user: {
       id: user.id,
       firstName: user.firstName,
       lastName: user.lastName,
       role: user.role,
     },
     callbackUrl: callbackUrl ?? null,
   });
 
    setAuthCookies(response, accessToken, refreshToken);
    setCsrfCookie(response, csrfToken);
  
    log.info("Login successful", { userId: user.id, username, clientIp });

  return response;
}