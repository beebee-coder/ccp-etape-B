import { NextResponse } from "next/server";
import { checkConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbConnected = await checkConnection();

  const status = {
    status: dbConnected ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbConnected ? "connected" : "disconnected",
  };

  return NextResponse.json(status, {
    status: dbConnected ? 200 : 503,
    headers: {
      "Cache-Control": "no-cache, no-store, max-age=0",
    },
  });
}
