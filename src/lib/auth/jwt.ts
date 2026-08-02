import { SignJWT, jwtVerify } from "jose";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "jwt" });

const getSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    log.error("AUTH_SECRET environment variable is not set");
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
};

export interface JwtPayload {
  sub: string;
  role: string;
  firstName?: string;
  lastName?: string;
  type?: "access" | "refresh";
  [key: string]: unknown;
}

export async function signToken(
  payload: JwtPayload,
  expiresIn: string = "1h"
): Promise<string> {
  log.debug("Signing JWT token", { subject: payload.sub, role: payload.role, type: payload.type, expiresIn });
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
  log.debug("JWT token signed successfully", { subject: payload.sub, type: payload.type });
  return token;
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const result = payload as JwtPayload;
    log.debug("JWT token verified", { subject: result.sub, role: result.role, type: result.type });
    return result;
  } catch (error) {
    log.warn("JWT token verification failed", { error });
    return null;
  }
}

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return signToken({ ...payload, type: "access" }, "1h");
}

export async function signRefreshToken(payload: JwtPayload): Promise<string> {
  return signToken({ ...payload, type: "refresh" }, "7d");
}
