/**
 * /api/structure/fs — API unifiée pour l'exploration et la manipulation
 * des deux répertoires physiques de l'application :
 *   - .locale-db/  (base de données locale)
 *   - .registry/   (registre des ressources)
 *
 * GET  ?root=locale-db|registry&path=...&read=true  → lire arborescence ou fichier
 * POST body { root, path, name, kind } | FormData   → créer dossier ou uploader fichier
 * DELETE ?root=...&path=...                          → supprimer entrée
 * PUT  body { root, path, newName }                  → renommer entrée
 * PATCH body { root, path, action, content }         → vectoriser ou écrire contenu
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProjectRoot } from "@/lib/project-root";
import { localDbTreeCache, registryTreeCache } from "@/lib/api/tree-cache";
import { withFileLock } from "@/lib/api/file-lock";
import { query } from "@/lib/db";

const PROJECT_ROOT = getProjectRoot();
const LOCALE_DB_ROOT = path.join(PROJECT_ROOT, ".locale-db");
const REGISTRY_ROOT  = path.join(PROJECT_ROOT, ".registry");
const LOCALE_DB_LOCK = path.join(LOCALE_DB_ROOT, ".locale-db.lock");
const REGISTRY_LOCK  = path.join(REGISTRY_ROOT,  ".registry.lock");
const VECTOR_INDEX_DIR = path.join(LOCALE_DB_ROOT, ".vector-index");
const TAURI_DB_ROOT = path.join(PROJECT_ROOT, ".tauri-local-db");
const TAURI_DB_LOCK = path.join(TAURI_DB_ROOT, ".tauri-local-db.lock");
const MAX_IMAGE_BASE64_BYTES = 5 * 1024 * 1024;

console.info("[API /api/structure/fs] init", {
  PROJECT_ROOT,
  localeDbExists: fs.existsSync(LOCALE_DB_ROOT),
  registryExists: fs.existsSync(REGISTRY_ROOT),
  tauriDbExists: fs.existsSync(TAURI_DB_ROOT),
});

// ─── helpers ────────────────────────────────────────────────────────────────

function getRootInfo(rootParam: string | null): { root: string; lock: string } {
  if (rootParam === "registry") return { root: REGISTRY_ROOT, lock: REGISTRY_LOCK };
  if (rootParam === "tauri-local-db") return { root: TAURI_DB_ROOT, lock: TAURI_DB_LOCK };
  return { root: LOCALE_DB_ROOT, lock: LOCALE_DB_LOCK };
}

function safeJoin(base: string, targetPath: string): string {
  const resolved = path.resolve(base, targetPath);
  if (!resolved.startsWith(base)) throw new Error("Accès hors du répertoire autorisé");
  return resolved;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function getVectorizedPaths(): Set<string> {
  const paths = new Set<string>();
  if (!fs.existsSync(VECTOR_INDEX_DIR)) return paths;
  try {
    for (const entry of fs.readdirSync(VECTOR_INDEX_DIR)) {
      if (!entry.endsWith(".json")) continue;
      try {
        const content = fs.readFileSync(path.join(VECTOR_INDEX_DIR, entry), "utf-8");
        const data = JSON.parse(content);
        if (data.path) paths.add(normalizePath(data.path));
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return paths;
}

interface ApiTreeNode {
  name: string;
  path: string;
  kind: "directory" | "document";
  children?: ApiTreeNode[];
  stats?: { sizeBytes: number };
  vectorized?: boolean;
  libelle?: string;
}

function readMeta(fullPath: string): string | undefined {
  const metaPath = path.join(fullPath, ".meta.json");
  try {
    if (fs.existsSync(metaPath) && fs.statSync(metaPath).isFile()) {
      const parsed = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (parsed && typeof parsed.libelle === "string") return parsed.libelle;
    }
  } catch { /* skip */ }
  return undefined;
}

function buildTree(
  base: string,
  relPath: string,
  vectorizedPaths: Set<string> = new Set(),
): ApiTreeNode {
  const fullPath = safeJoin(base, relPath);
  const stat = fs.statSync(fullPath);
  const name = path.basename(fullPath) || relPath.split("/").pop() || relPath;
  const normalizedRelPath = normalizePath(relPath);

  if (stat.isFile()) {
    const relPathForVec = normalizePath(path.relative(base, fullPath));
    return {
      name,
      path: normalizedRelPath,
      kind: "document",
      stats: { sizeBytes: stat.size },
      vectorized: vectorizedPaths.has(relPathForVec),
    };
  }

  const entries = fs.readdirSync(fullPath).filter((e) => e !== ".meta.json");
  const libelle = readMeta(fullPath);
  const children = entries.map((entryName) =>
    buildTree(base, relPath ? `${relPath}/${entryName}` : entryName, vectorizedPaths),
  );

  return {
    name,
    path: normalizedRelPath,
    kind: "directory",
    children,
    vectorized: false,
    ...(libelle ? { libelle } : {}),
  };
}

interface LocationNodeRow {
  path: string;
  libelle?: string;
  location_type?: string;
  bloc_code?: string;
  equipement_code?: string;
  groupe_code?: string;
  level?: number;
}

interface ProcedureRow {
  code: string;
  title: string;
  category?: string;
  description?: string;
  priority?: string;
}

interface KnowledgeItemRow {
  id: string;
  title?: string;
  type?: string;
  category?: string;
  location_path?: string;
}

interface TeamRow {
  id: string;
  name?: string;
  groupe_path?: string;
}

interface MediaItemRow {
  id: string;
  title?: string;
  category?: string;
  kind?: string;
  mime_type?: string;
  location_path?: string;
}

function ensurePath(root: ApiTreeNode, segments: string[]): ApiTreeNode {
  let current = root;
  for (const segment of segments) {
    let child = current.children?.find((c) => c.name === segment && c.kind === "directory");
    if (!child) {
      child = {
        name: segment,
        path: current.path ? `${current.path}/${segment}` : segment,
        kind: "directory",
        children: [],
        vectorized: false,
      };
      current.children = current.children || [];
      current.children.push(child);
    }
    current = child;
  }
  return current;
}

async function buildReconstructedTreeFromDb(): Promise<ApiTreeNode> {
  const root: ApiTreeNode = {
    name: ".locale-db",
    path: ".locale-db",
    kind: "directory",
    children: [],
    vectorized: false,
  };

  try {
    const [
      locationNodesResult,
      proceduresResult,
      knowledgeItemsResult,
      teamsResult,
      mediaItemsResult,
    ] = await Promise.all([
      query<LocationNodeRow>("SELECT path, libelle, location_type, bloc_code, equipement_code, groupe_code, level FROM location_nodes ORDER BY level ASC, path ASC").catch(() => ({ rows: [] as LocationNodeRow[], rowCount: 0 })),
      query<ProcedureRow>("SELECT code, title, category, description, priority FROM procedures").catch(() => ({ rows: [] as ProcedureRow[], rowCount: 0 })),
      query<KnowledgeItemRow>("SELECT id, title, type, category, location_path FROM knowledge_items").catch(() => ({ rows: [] as KnowledgeItemRow[], rowCount: 0 })),
      query<TeamRow>("SELECT id, name, groupe_path FROM teams").catch(() => ({ rows: [] as TeamRow[], rowCount: 0 })),
      query<MediaItemRow>("SELECT id, title, category, kind, mime_type, location_path FROM media_items WHERE location_path IS NOT NULL").catch(() => ({ rows: [] as MediaItemRow[], rowCount: 0 })),
    ]);

    const locationNodesRows = locationNodesResult.rows as LocationNodeRow[];
    const proceduresRows = proceduresResult.rows as ProcedureRow[];
    const knowledgeItemsRows = knowledgeItemsResult.rows as KnowledgeItemRow[];
    const teamsRows = teamsResult.rows as TeamRow[];
    const mediaItemsRows = mediaItemsResult.rows as MediaItemRow[];

    const processedPaths = new Set<string>();

    for (const node of locationNodesRows) {
      const cleanPath = normalizePath(node.path);
      if (!cleanPath || processedPaths.has(cleanPath)) continue;
      processedPaths.add(cleanPath);

      const segments = cleanPath.split("/").filter(Boolean);
      if (segments.length === 0) continue;

      const parent = ensurePath(root, segments.slice(0, -1));
      const name = segments[segments.length - 1];
      const fullPath = normalizePath(node.path);

      const existing = parent.children?.find((c) => c.name === name);
      if (!existing) {
        parent.children = parent.children || [];
        parent.children.push({
          name,
          path: fullPath,
          kind: "directory",
          children: [],
          vectorized: false,
          libelle: node.libelle,
        });
      }
    }

    for (const proc of proceduresRows) {
      const segments = ["procedures", proc.code];
      const parent = ensurePath(root, segments.slice(0, -1));
      const name = segments[segments.length - 1];
      const fullPath = segments.join("/");

      const existing = parent.children?.find((c) => c.name === name);
      if (!existing) {
        parent.children = parent.children || [];
        parent.children.push({
          name,
          path: fullPath,
          kind: "directory",
          children: [
            {
              name: "procedure.json",
              path: `${fullPath}/procedure.json`,
              kind: "document",
              stats: { sizeBytes: JSON.stringify(proc).length },
              vectorized: false,
            },
          ],
          vectorized: false,
          libelle: proc.title,
        });
      }
    }

    for (const item of knowledgeItemsRows) {
      if (item.location_path) {
        const cleanPath = normalizePath(item.location_path);
        const segments = cleanPath.split("/").filter(Boolean);
        if (segments.length === 0) continue;

        const parent = ensurePath(root, segments.slice(0, -1));
        const fullPath = `${cleanPath}/${item.id}.json`;

        parent.children = parent.children || [];
        const existing = parent.children.find((c) => c.name === `${item.id}.json`);
        if (!existing) {
          parent.children.push({
            name: `${item.id}.json`,
            path: fullPath,
            kind: "document",
            stats: { sizeBytes: JSON.stringify(item).length },
            vectorized: false,
          });
        }
      }

      const registryParent = ensurePath(root, ["registry", "items"]);
      registryParent.children = registryParent.children || [];
      const registryExisting = registryParent.children.find((c) => c.name === `${item.id}.json`);
      if (!registryExisting) {
        registryParent.children.push({
          name: `${item.id}.json`,
          path: `registry/items/${item.id}.json`,
          kind: "document",
          stats: { sizeBytes: JSON.stringify(item).length },
          vectorized: false,
        });
      }
    }

    for (const team of teamsRows) {
      if (team.groupe_path) {
        const cleanPath = normalizePath(team.groupe_path);
        const segments = ["ressources humaines", ...cleanPath.split("/").filter(Boolean)];
        const parent = ensurePath(root, segments);
        const name = team.name || team.id;
        const fullPath = `${segments.join("/")}/${name}.json`;

        parent.children = parent.children || [];
        const existing = parent.children.find((c) => c.name === `${name}.json`);
        if (!existing) {
          parent.children.push({
            name: `${name}.json`,
            path: fullPath,
            kind: "document",
            stats: { sizeBytes: JSON.stringify(team).length },
            vectorized: false,
          });
        }
      }
    }

    for (const media of mediaItemsRows) {
      if (media.location_path) {
        const cleanPath = normalizePath(media.location_path);
        const segments = cleanPath.split("/").filter(Boolean);
        if (segments.length > 0) {
          const parent = ensurePath(root, segments);
          const ext = media.mime_type?.split("/").pop() || "bin";
          const name = `${media.id}.${ext}`;
          parent.children = parent.children || [];
          const existing = parent.children.find((c) => c.name === name);
          if (!existing) {
            parent.children.push({
              name,
              path: `${cleanPath}/${name}`,
              kind: "document",
              stats: { sizeBytes: 1024 },
              vectorized: false,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("[API /api/structure/fs] reconstruction error", e);
  }

  return root;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rootParam = searchParams.get("root") ?? "locale-db";
  const target    = searchParams.get("path") ?? "";
  const read      = searchParams.get("read") === "true";
  const unified   = searchParams.get("unified") === "true";

  // ── Mode unifié : retourne les deux arbres en une réponse ──────────────────
  if (unified) {
    const localeDbExists = fs.existsSync(LOCALE_DB_ROOT);
    const registryExists = fs.existsSync(REGISTRY_ROOT);
    const vecPaths = getVectorizedPaths();

    let localeDbTree: ApiTreeNode;
    let registryTree: ApiTreeNode;
    let source: string;

    if (localeDbExists || registryExists) {
      localeDbTree = localeDbExists
        ? buildTree(LOCALE_DB_ROOT, "", vecPaths)
        : { name: ".locale-db", path: "", kind: "directory", children: [] };
      registryTree = registryExists
        ? buildTree(REGISTRY_ROOT, "", new Set())
        : { name: ".registry", path: "", kind: "directory", children: [] };
      source = "disk";
    } else {
      // Fallback Vercel hébergé : reconstruction de l'arborescence depuis la BDD (Neon / PostgreSQL)
      const reconstructed = await buildReconstructedTreeFromDb();
      localeDbTree = {
        name: ".locale-db",
        path: "",
        kind: "directory",
        children: reconstructed.children ?? [],
      };

      // Construction de l'arbre du registre depuis les éléments de la BDD
      const registryItems = (reconstructed.children ?? []).filter(
        (c) => c.name === "registry" || c.name === "procedures" || c.name === "bank"
      );
      registryTree = {
        name: ".registry",
        path: "",
        kind: "directory",
        children: registryItems.length > 0 ? registryItems : (reconstructed.children ?? []),
      };
      source = "db-reconstructed";
    }

    return NextResponse.json({
      localeDb: localeDbTree,
      registry: registryTree,
      vectorizedPaths: Array.from(vecPaths),
      source,
    });
  }

  // ── Lecture d'un seul répertoire ───────────────────────────────────────────
  const { root } = getRootInfo(rootParam);
  const cache = rootParam === "registry" ? registryTreeCache : localDbTreeCache;

  try {
    if (read) {
      const fullPath = safeJoin(root, target);
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

    if (!fs.existsSync(root)) {
      return NextResponse.json({ children: [], source: "missing" });
    }

    const cacheKey = `tree:${rootParam}:${target || "."}`;
    const cached = cache.get<ApiTreeNode>(cacheKey);
    if (cached) {
      return NextResponse.json({
        children: cached.children,
        vectorizedPaths: Array.from(getVectorizedPaths()),
        cached: true,
      });
    }

    const fullPath = target ? safeJoin(root, target) : root;
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      return NextResponse.json({ error: "Répertoire introuvable" }, { status: 404 });
    }

    const vecPaths = rootParam === "locale-db" ? getVectorizedPaths() : new Set<string>();
    const tree = buildTree(root, target, vecPaths);
    cache.set(cacheKey, tree);

    return NextResponse.json({
      children: tree.children,
      vectorizedPaths: Array.from(vecPaths),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[API /api/structure/fs] GET error", { rootParam, target, msg });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const { searchParams } = new URL(request.url);
  const rootParam = searchParams.get("root") ?? "locale-db";
  const { root } = getRootInfo(rootParam);
  const cache = rootParam === "registry" ? registryTreeCache : localDbTreeCache;

  if (!fs.existsSync(root)) {
    return NextResponse.json({ error: `${rootParam} n'existe pas sur ce serveur` }, { status: 503 });
  }

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const target = formData.get("path") as string | null;
      const rootOverride = (formData.get("root") as string | null) ?? rootParam;
      const { root: r, lock: l } = getRootInfo(rootOverride);
      if (!file || !target) {
        return NextResponse.json({ error: "Fichier et chemin requis" }, { status: 400 });
      }
      await withFileLock(l, async () => {
        const newPath = path.join(safeJoin(r, target), file.name);
        fs.writeFileSync(newPath, Buffer.from(await file.arrayBuffer()));
      });
      cache.invalidate("tree:");
      return NextResponse.json({ success: true });
    }

    const body = await request.json() as { root?: string; path?: string; name?: string; kind?: string };
    const rootOverride = body.root ?? rootParam;
    const { root: r, lock: l } = getRootInfo(rootOverride);
    const cacheToInvalidate = rootOverride === "registry" ? registryTreeCache : localDbTreeCache;
    const { path: target, name, kind } = body;

    if (!target || !name) {
      return NextResponse.json({ error: "Chemin et nom requis" }, { status: 400 });
    }

    await withFileLock(l, async () => {
      const newPath = path.join(safeJoin(r, target), name);
      if (kind === "directory") {
        fs.mkdirSync(newPath, { recursive: true });
      } else {
        fs.writeFileSync(newPath, "", "utf-8");
      }
    });

    cacheToInvalidate.invalidate("tree:");
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const rootParam = searchParams.get("root") ?? "locale-db";
  const target    = searchParams.get("path");
  const { root, lock } = getRootInfo(rootParam);
  const cache = rootParam === "registry" ? registryTreeCache : localDbTreeCache;

  if (!fs.existsSync(root)) {
    return NextResponse.json({ error: `${rootParam} n'existe pas sur ce serveur` }, { status: 503 });
  }
  if (!target) return NextResponse.json({ error: "Chemin requis" }, { status: 400 });

  try {
    await withFileLock(lock, async () => {
      const fullPath = safeJoin(root, target);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
    });
    cache.invalidate("tree:");
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ─── PUT ─────────────────────────────────────────────────────────────────────

export async function PUT(request: Request) {
  const body = await request.json() as { root?: string; path?: string; newName?: string };
  const rootParam = body.root ?? "locale-db";
  const { root, lock } = getRootInfo(rootParam);
  const cache = rootParam === "registry" ? registryTreeCache : localDbTreeCache;

  if (!fs.existsSync(root)) {
    return NextResponse.json({ error: `${rootParam} n'existe pas sur ce serveur` }, { status: 503 });
  }
  if (!body.path || !body.newName) {
    return NextResponse.json({ error: "Chemin et nouveau nom requis" }, { status: 400 });
  }

  try {
    await withFileLock(lock, async () => {
      const fullOld = safeJoin(root, body.path!);
      const fullNew = path.join(path.dirname(fullOld), body.newName!);
      fs.renameSync(fullOld, fullNew);
    });
    cache.invalidate("tree:");
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  const body = await request.json() as { root?: string; path?: string; action?: string; content?: string };
  const rootParam = body.root ?? "locale-db";
  const { root, lock } = getRootInfo(rootParam);
  const cache = rootParam === "registry" ? registryTreeCache : localDbTreeCache;

  if (!fs.existsSync(root)) {
    return NextResponse.json({ error: `${rootParam} n'existe pas sur ce serveur` }, { status: 503 });
  }
  if (!body.path) return NextResponse.json({ error: "Chemin requis" }, { status: 400 });

  try {
    const fullPath = safeJoin(root, body.path);

    // Écriture de contenu
    if (body.content !== undefined) {
      await withFileLock(lock, async () => {
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, body.content!, "utf-8");
      });
      cache.invalidate("tree:");
      return NextResponse.json({ success: true });
    }

    // Vectorisation
    if (body.action === "vectorize") {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) return NextResponse.json({ error: "Cible non valide" }, { status: 400 });
      const vectorDir = VECTOR_INDEX_DIR;
      fs.mkdirSync(vectorDir, { recursive: true });
      const relPath = path.relative(LOCALE_DB_ROOT, fullPath);
      const hash = Buffer.from(relPath).toString("base64")
        .replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
      const payload = {
        path: relPath,
        vectors: Math.max(1, Math.floor(stat.size / 2048)),
        chunks: Math.max(1, Math.floor(stat.size / 4096)),
        dimension: 384,
        indexedAt: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(vectorDir, `${hash}.json`), JSON.stringify(payload, null, 2), "utf-8");
      return NextResponse.json({ success: true, vectorized: true });
    }

    return NextResponse.json({ error: "Action non supportée" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
