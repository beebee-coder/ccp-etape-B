import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { createLogger } from "@/lib/logger";

const log = createLogger({ handler: "auth-logout" });

export async function POST(request: Request) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown";

  log.info("Logout request received", { clientIp });
  const response = NextResponse.json({ message: "Déconnexion réussie" });
  clearAuthCookies(response);
  log.info("Logout successful, auth cookies cleared", { clientIp });
  return response;
}

export async function GET(request: Request) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown";

  log.info("Logout (GET) request received", { clientIp });
  const response = NextResponse.json({ message: "Déconnexion réussie" });
  clearAuthCookies(response);
  log.info("Logout (GET) successful, auth cookies cleared", { clientIp });
  return response;
}
