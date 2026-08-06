import { comparePassword, hashPassword, isBcryptHash } from "./password";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "auth-admin" });

let cachedPasswordHash: string | null = null;

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  role: "admin";
}

export function getAdminUser(): AdminUser {
  const firstName = process.env.AUTH_ADMIN_FIRST_NAME ?? "admin";
  const lastName = process.env.AUTH_ADMIN_LAST_NAME ?? "user";

  return {
    id: "admin",
    firstName,
    lastName,
    username: firstName,
    role: "admin",
  };
}

export async function getAdminPasswordHash(): Promise<string> {
  if (cachedPasswordHash) {
    log.debug("Using cached admin password hash");
    return cachedPasswordHash;
  }

  const password = process.env.AUTH_ADMIN_PASSWORD ?? "";
  if (!password) {
    log.error("AUTH_ADMIN_PASSWORD environment variable is not set");
    throw new Error("AUTH_ADMIN_PASSWORD environment variable is not set");
  }

  if (isBcryptHash(password)) {
    log.debug("Admin password is already a bcrypt hash");
    cachedPasswordHash = password;
  } else {
    log.debug("Hashing plaintext admin password");
    cachedPasswordHash = await hashPassword(password);
  }

  return cachedPasswordHash;
}

export async function verifyAdminCredentials(
   username: string,
   password: string
 ): Promise<AdminUser | null> {
   const admin = getAdminUser();
 
  const normalizedInput = username.trim().toLowerCase();
  const candidates = [
    admin.username.toLowerCase(),
    "admin",
    `${admin.firstName} ${admin.lastName}`.toLowerCase(),
    `${admin.firstName.toLowerCase()}${admin.lastName.toLowerCase()}`,
  ];
  
  log.debug("Admin credential verification attempt", { username });
 
    if (!candidates.includes(normalizedInput)) {
      log.warn("Admin credential verification failed: username not recognized", { username });
      return null;
    }
  
    const passwordHash = await getAdminPasswordHash();
    const valid = await comparePassword(password, passwordHash);
 
    if (!valid) {
      log.warn("Admin credential verification failed: password mismatch", { username });
      return null;
    }

  log.info("Admin credentials verified successfully", { userId: admin.id, username });
  return admin;
}
