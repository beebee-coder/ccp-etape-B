/**
 * /api/locale-db/init — Initialise la base de données locale .locale-db
 * si elle n'existe pas ou est incomplète.
 *
 * GET /api/locale-db/init
 *
 * Réponse :
 * {
 *   success: boolean,
 *   initialized: boolean,
 *   mode: "dev" | "production",
 *   roots: string[],
 *   message: string
 * }
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { getProjectRoot } from "@/lib/project-root";

const PROJECT_ROOT = getProjectRoot();
const IS_VERCEL = process.env.VERCEL === "1";
const LOCALE_DB_ROOT = IS_VERCEL
  ? path.join(os.tmpdir(), ".locale-db")
  : path.join(PROJECT_ROOT, ".locale-db");
const REQUIRED_ROOTS = ["centrale", "groupes", "procedures", "vectors", "registry"];
const REQUIRED_FILES = ["config.json"];

function isLocaleDbReady(): boolean {
  if (!fs.existsSync(LOCALE_DB_ROOT)) return false;
  for (const root of REQUIRED_ROOTS) {
    if (!fs.existsSync(path.join(LOCALE_DB_ROOT, root))) return false;
  }
  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(LOCALE_DB_ROOT, file))) return false;
  }
  return true;
}

function ensureLocaleDb(): { initialized: boolean; roots: string[] } {
  let initialized = false;

  if (!fs.existsSync(LOCALE_DB_ROOT)) {
    fs.mkdirSync(LOCALE_DB_ROOT, { recursive: true });
    initialized = true;
  }

  for (const root of REQUIRED_ROOTS) {
    const rootPath = path.join(LOCALE_DB_ROOT, root);
    if (!fs.existsSync(rootPath)) {
      fs.mkdirSync(rootPath, { recursive: true });
      initialized = true;
    }
  }

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(LOCALE_DB_ROOT, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({
        version: "1.0.0",
        mode: process.env.NEXT_PUBLIC_APP_MODE ?? "dev",
        initializedAt: new Date().toISOString(),
        description: IS_VERCEL
          ? "Ephemeral local database for Vercel serverless runtime"
          : "Local database structure for NexaFlow application",
        roots: REQUIRED_ROOTS,
        vercel: IS_VERCEL || undefined,
      }, null, 2));
      initialized = true;
    }
  }

  return { initialized, roots: REQUIRED_ROOTS };
}

export async function GET() {
  try {
    const wasReady = isLocaleDbReady();
    const { initialized, roots } = ensureLocaleDb();
    const mode = process.env.NEXT_PUBLIC_APP_MODE ?? "dev";

    return NextResponse.json({
      success: true,
      initialized: !wasReady || initialized,
      mode,
      roots,
      root: LOCALE_DB_ROOT,
      vercel: IS_VERCEL,
      message: initialized
        ? "Base de données locale .locale-db initialisée avec succès"
        : "Base de données locale .locale-db déjà présente",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[API /api/locale-db/init] error", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}