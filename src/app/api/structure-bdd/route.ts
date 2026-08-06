import { NextResponse } from "next/server";
import { getAllTableDefinitions } from "@/lib/data/structure-bdd";
import { createLogger } from "@/lib/logger";

const label = "[api/structure-bdd]";

const log = createLogger({ handler: "structure-bdd" });

export async function GET() {
  try {
    const tables = getAllTableDefinitions();

    log.debug(`${label} Schema introspection successful via API`, {
      tableCount: tables.length,
    });

    return NextResponse.json({
      success: true,
      databaseName: "nexaflow_prod",
      tables,
      totalTables: tables.length,
      totalColumns: tables.reduce((acc, t) => acc + t.columns.length, 0),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error(`${label} Schema introspection failed via API`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Erreur d'introspection du schéma",
      },
      { status: 500 },
    );
  }
}