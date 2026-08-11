import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger({ handler: "health" });

export const dynamic = "force-dynamic";

export async function GET() {
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch {
    dbConnected = false;
  }

  const redisConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );

  const groqConfigured = Boolean(process.env.GROQ_API_KEY);
  const geminiConfigured = Boolean(process.env.GOOGLE_GENAI_API_KEY);

  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  const status = {
    status: dbConnected ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbConnected ? "connected" : "disconnected",
    redis: redisConfigured ? "configured" : "unconfigured",
    ai: {
      groq: groqConfigured ? "configured" : "unconfigured",
      gemini: geminiConfigured ? "configured" : "unconfigured",
    },
    storage: {
      blob: blobConfigured ? "configured" : "unconfigured",
    },
  };

  const httpStatus = dbConnected ? 200 : 503;

  log.info("Health check", {
    database: status.database,
    redis: status.redis,
    ai: status.ai,
    storage: status.storage,
    httpStatus,
  });

  return NextResponse.json(status, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-cache, no-store, max-age=0",
    },
  });
}
