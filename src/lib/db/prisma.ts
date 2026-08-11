import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _prisma: PrismaClient | null = null;

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in environment variables");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!_prisma) {
      _prisma = createPrismaClient();
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = _prisma;
      }
    }
    const value = (_prisma as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(_prisma);
    }
    return value as unknown;
  },
});

export default prisma;
