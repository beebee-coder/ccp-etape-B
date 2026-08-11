/**
 * /api/locale-db/fs — API pour l'exploration et la manipulation
 * du répertoire local .locale-db de l'application.
 *
 * GET  ?path=...&read=true  → lire arborescence ou fichier
 * POST body { path, name, kind } | FormData → créer dossier ou uploader fichier
 * DELETE ?path=...                          → supprimer entrée
 * PUT  body { path, newName }               → renommer entrée
 * PATCH body { path, action, content }      → écrire contenu
 *
 * Note: les mutations (POST/PUT/DELETE/PATCH) nécessitent une authentification.
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { getProjectRoot } from "@/lib/project-root";
import { requireAuth } from "@/lib/api/auth";
import { safeJoin, buildTree } from "@/lib/api/fs-tree";

const PROJECT_ROOT = getProjectRoot();
const IS_VERCEL = process.env.VERCEL === "1";
const LOCALE_DB_ROOT = IS_VERCEL
  ? path.join(os.tmpdir(), ".locale-db")
  : path.join(PROJECT_ROOT, ".locale-db");
const MAX_IMAGE_BASE64_BYTES = 5 * 1024 * 1024;

console.info("[API /api/locale-db/fs] init", {
  PROJECT_ROOT,
  localeDbRoot: LOCALE_DB_ROOT,
  vercel: IS_VERCEL,
});

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("path") ?? "";
  const read = searchParams.get("read") === "true";

  try {
    if (!fs.existsSync(LOCALE_DB_ROOT)) {
      return NextResponse.json({ error: "Base de données locale non initialisée. Appelez /api/locale-db/init d'abord." }, { status: 503 });
    }

    if (read) {
      const fullPath = safeJoin(LOCALE_DB_ROOT, target);
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
      }
      const ext = path.extname(fullPath).toLowerCase();
      const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
      if (imageExts.includes(ext)) {
        const stat = fs.statSync(fullPath);
        if (stat.size > MAX_IMAGE_BASE64_BYTES) {
          return NextResponse.json({ error: "Image trop volumineuse" }, { status: 413 });
        }
        const base64 = fs.readFileSync(fullPath).toString("base64");
        const mime = ext === ".svg" ? "image/svg+xml" : `image/${ext.slice(1)}`;
        return NextResponse.json({ content: `data:${mime};base64,${base64}`, isImage: true });
      }
      const content = fs.readFileSync(fullPath, "utf-8");
      return NextResponse.json({ content, name: path.basename(fullPath) });
    }

    if (!fs.existsSync(LOCALE_DB_ROOT)) {
      return NextResponse.json({ children: [], source: "missing" });
    }

    const fullPath = target ? safeJoin(LOCALE_DB_ROOT, target) : LOCALE_DB_ROOT;
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      return NextResponse.json({ error: "Répertoire introuvable" }, { status: 404 });
    }

    const vecPaths = new Set<string>();
    const tree = buildTree(LOCALE_DB_ROOT, target, vecPaths);

    return NextResponse.json({
      children: tree.children,
      vectorizedPaths: Array.from(vecPaths),
      source: "disk",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[API /api/locale-db/fs] GET error", { target, msg });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult.response;

  const contentType = request.headers.get("content-type") ?? "";
  const body = await request.json().catch(() => ({})) as { path?: string; name?: string; kind?: string };

  if (!fs.existsSync(LOCALE_DB_ROOT)) {
    return NextResponse.json({ error: "Base de données locale non initialisée" }, { status: 503 });
  }

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const target = formData.get("path") as string | null;
      if (!file || !target) {
        return NextResponse.json({ error: "Fichier et chemin requis" }, { status: 400 });
      }
      const newPath = path.join(safeJoin(LOCALE_DB_ROOT, target), file.name);
      fs.writeFileSync(newPath, Buffer.from(await file.arrayBuffer()));
      return NextResponse.json({ success: true });
    }

    const { path: target, name, kind } = body;
    if (!target || !name) {
      return NextResponse.json({ error: "Chemin et nom requis" }, { status: 400 });
    }

    const newPath = path.join(safeJoin(LOCALE_DB_ROOT, target), name);
    if (kind === "directory") {
      fs.mkdirSync(newPath, { recursive: true });
    } else {
      fs.writeFileSync(newPath, "", "utf-8");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult.response;

  const { searchParams } = new URL(request.url);
  const target = searchParams.get("path");

  if (!fs.existsSync(LOCALE_DB_ROOT)) {
    return NextResponse.json({ error: "Base de données locale non initialisée" }, { status: 503 });
  }
  if (!target) return NextResponse.json({ error: "Chemin requis" }, { status: 400 });

  try {
    const fullPath = safeJoin(LOCALE_DB_ROOT, target);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ─── PUT ─────────────────────────────────────────────────────────────────────

export async function PUT(request: Request) {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult.response;

  const body = await request.json().catch(() => ({})) as { path?: string; newName?: string };

  if (!fs.existsSync(LOCALE_DB_ROOT)) {
    return NextResponse.json({ error: "Base de données locale non initialisée" }, { status: 503 });
  }
  if (!body.path || !body.newName) {
    return NextResponse.json({ error: "Chemin et nouveau nom requis" }, { status: 400 });
  }

  try {
    const fullOld = safeJoin(LOCALE_DB_ROOT, body.path);
    const fullNew = path.join(path.dirname(fullOld), body.newName);
    fs.renameSync(fullOld, fullNew);
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult.response;

  const body = await request.json().catch(() => ({})) as { path?: string; action?: string; content?: string };

  if (!fs.existsSync(LOCALE_DB_ROOT)) {
    return NextResponse.json({ error: "Base de données locale non initialisée" }, { status: 503 });
  }
  if (!body.path) return NextResponse.json({ error: "Chemin requis" }, { status: 400 });

  try {
    const fullPath = safeJoin(LOCALE_DB_ROOT, body.path);

    if (body.content !== undefined) {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, body.content!, "utf-8");
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action non supportée" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}