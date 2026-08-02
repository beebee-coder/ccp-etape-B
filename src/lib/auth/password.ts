import bcryptjs from "bcryptjs";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "password" });

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  log.debug("Hashing password with bcrypt", { saltRounds: SALT_ROUNDS });
  const hash = await bcryptjs.hash(password, SALT_ROUNDS);
  log.debug("Password hashed successfully");
  return hash;
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  log.debug("Comparing password against hash");
  const result = await bcryptjs.compare(password, hash);
  log.debug("Password comparison completed", { match: result });
  return result;
}

export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$/.test(value);
}
