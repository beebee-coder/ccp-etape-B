import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProjectRoot } from "@/lib/project-root";
import { registryTreeCache } from "@/lib/api/tree-cache";
import { withFileLock } from "@/lib/api/file-lock";
import { prisma } from "@/lib/db";

const PROJECT_ROOT = getProjectRoot();
const REGISTRY_ROOT = path.join(PROJECT_ROOT, ".registry");
const REGISTRY_LOCK = path.join(REGISTRY_ROOT, ".registry.lock");
const MAX_IMAGE_BASE64_BYTES = 5 * 1024 * 1024;
const PROCEDURES_CACHE_TTL_MS = 30_000;

type ProcedureRow = { code: string; title: string; category?: string; description?: string; priority?: string };

const proceduresCache = new Map<string, { value: ProcedureRow[]; expiresAt: number }>();

function getCachedProcedures(): ProcedureRow[] | null {
  const entry = proceduresCache.get("all");
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    proceduresCache.delete("all");
    return null;
  }
  return entry.value;
}

function setCachedProcedures(procedures: ProcedureRow[]): void {
  proceduresCache.set("all", {
    value: procedures,
    expiresAt: Date.now() + PROCEDURES_CACHE_TTL_MS,
  });
}

export function invalidateProceduresCache(): void {
  proceduresCache.delete("all");
  registryTreeCache.invalidate("tree:");
}

console.info("[API /api/registry/fs] init", {
  PROJECT_ROOT,
  REGISTRY_ROOT,
  exists: fs.existsSync(REGISTRY_ROOT),
});

function safeJoin(targetPath: string): string {
  const resolved = path.resolve(REGISTRY_ROOT, targetPath);
  if (!resolved.startsWith(REGISTRY_ROOT)) {
    throw new Error("Accès hors de .registry");
  }
  return resolved;
}

interface ApiTreeNode {
  name: string;
  path: string;
  kind: string;
  children?: ApiTreeNode[];
  stats?: { sizeBytes: number };
  libelle?: string;
}

function readMeta(fullPath: string): string | undefined {
  const metaPath = path.join(fullPath, ".meta.json");
  try {
    if (fs.existsSync(metaPath) && fs.statSync(metaPath).isFile()) {
      const content = fs.readFileSync(metaPath, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed.libelle === "string") {
        return parsed.libelle;
      }
    }
  } catch {
    // ignore invalid meta files
  }
  return undefined;
}

function buildTree(relPath: string): ApiTreeNode {
  const fullPath = safeJoin(relPath);
  const stat = fs.statSync(fullPath);
  const name = path.basename(fullPath) || relPath.split("/").pop() || relPath;

  if (stat.isFile()) {
    return {
      name,
      path: relPath,
      kind: "document",
      stats: { sizeBytes: stat.size },
    };
  }

  const entries = fs.readdirSync(fullPath).filter(
    (entry) => entry !== ".meta.json",
  );
  console.info("[API /api/registry/fs] buildTree", {
    relPath,
    fullPath,
    entries,
  });
  const libelle = readMeta(fullPath);
  const children = entries.map((entryName) => {
    const childRelPath = relPath ? `${relPath}/${entryName}` : entryName;
    return buildTree(childRelPath);
  });

  return {
    name,
    path: relPath,
    kind: "directory",
    children,
    ...(libelle ? { libelle } : {}),
  };
}

function buildRegistryFallbackTree(): ApiTreeNode {
  const defaultDirs = [
    "bank",
    "items",
    "procedures",
    "Centrale",
    "ressources humaines",
  ];

  const children = defaultDirs.map((name) => ({
    name,
    path: name,
    kind: "directory" as const,
    children: [],
  }));

  return {
    name: ".registry",
    path: ".registry",
    kind: "directory",
    children,
  };
}

async function mergeDbProceduresIntoTree(
  tree: ApiTreeNode,
): Promise<ApiTreeNode> {
  try {
    let procedures = getCachedProcedures();
    if (!procedures) {
      const raw = await prisma.procedure.findMany({
        select: { code: true, title: true, category: true, description: true, priority: true },
      });
      procedures = raw.map((p) => ({
        code: p.code,
        title: p.title,
        category: p.category ?? undefined,
        description: p.description ?? undefined,
        priority: p.priority ?? undefined,
      }));
      setCachedProcedures(procedures);
    }

    const treeCopy: ApiTreeNode = {
      ...tree,
      children: tree.children ? tree.children.map((c) => ({ ...c })) : undefined,
    };

    if (procedures.length === 0) {
      treeCopy.children = treeCopy.children?.filter((c) => c.name !== "procedures") || treeCopy.children;
      return treeCopy;
    }

    const dbCodes = new Set(procedures.map((p) => p.code));
    const proceduresDir = treeCopy.children?.find(
      (c) => c.name === "procedures" && c.kind === "directory",
    );

    if (!proceduresDir) {
      treeCopy.children = treeCopy.children || [];
      treeCopy.children.push({
        name: "procedures",
        path: "procedures",
        kind: "directory",
        children: procedures.map((proc) => ({
          name: proc.code,
          path: `procedures/${proc.code}`,
          kind: "directory",
          children: [
            {
              name: "procedure.json",
              path: `procedures/${proc.code}/procedure.json`,
              kind: "document",
              stats: { sizeBytes: JSON.stringify(proc).length },
              libelle: proc.title,
            },
          ],
          libelle: proc.title,
        })),
      });
      return treeCopy;
    }

    proceduresDir.children = proceduresDir.children ? [...proceduresDir.children] : [];
    const existingCodes = new Set(proceduresDir.children.map((c) => c.name));

    for (const proc of procedures) {
      if (existingCodes.has(proc.code)) {
        const existing = proceduresDir.children.find((c) => c.name === proc.code);
        if (existing) {
          existing.libelle = proc.title;
          const doc = existing.children?.find((c) => c.name === "procedure.json");
          if (doc) {
            doc.libelle = proc.title;
            doc.stats = { sizeBytes: JSON.stringify(proc).length };
          }
        }
        continue;
      }
      proceduresDir.children.push({
        name: proc.code,
        path: `procedures/${proc.code}`,
        kind: "directory",
        children: [
          {
            name: "procedure.json",
            path: `procedures/${proc.code}/procedure.json`,
            kind: "document",
            stats: { sizeBytes: JSON.stringify(proc).length },
            libelle: proc.title,
          },
        ],
        libelle: proc.title,
      });
    }

    proceduresDir.children = proceduresDir.children.filter((c) => dbCodes.has(c.name));

    if (proceduresDir.children.length === 0) {
      treeCopy.children = treeCopy.children?.filter((c) => c.name !== "procedures") || treeCopy.children;
    }

    return treeCopy;
  } catch (error) {
    console.error("[API /api/registry/fs] merge DB procedures error", error);
    return tree;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("path") || "";
  const read = searchParams.get("read") === "true";

  try {
    const fullPath = safeJoin(target);

    if (read) {
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        return NextResponse.json(
          { error: "Fichier introuvable" },
          { status: 404 },
        );
      }

      const ext = path.extname(fullPath).toLowerCase();
      const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

      if (imageExtensions.includes(ext)) {
        const stat = fs.statSync(fullPath);
        if (stat.size > MAX_IMAGE_BASE64_BYTES) {
          return NextResponse.json(
            { error: `Fichier image trop volumineux (max ${MAX_IMAGE_BASE64_BYTES / 1024 / 1024}MB)` },
            { status: 413 },
          );
        }
        const buffer = fs.readFileSync(fullPath);
        const base64 = buffer.toString("base64");
        const mimeType = ext === ".svg" ? "image/svg+xml" : `image/${ext.slice(1)}`;
        const dataUrl = `data:${mimeType};base64,${base64}`;
        return NextResponse.json({ content: dataUrl, name: path.basename(fullPath), isImage: true });
      }

      const content = fs.readFileSync(fullPath, "utf-8");
      return NextResponse.json({ content, name: path.basename(fullPath) });
    }

    console.info("[API /api/registry/fs] GET", {
      PROJECT_ROOT,
      REGISTRY_ROOT,
      target,
      fullPath,
      exists: fs.existsSync(fullPath),
      isDir: fs.existsSync(fullPath) ? fs.statSync(fullPath).isDirectory() : null,
      rootEntries: fs.existsSync(REGISTRY_ROOT) ? fs.readdirSync(REGISTRY_ROOT) : [],
    });

    if (!fs.existsSync(REGISTRY_ROOT)) {
      const tree = buildRegistryFallbackTree();
      const merged = await mergeDbProceduresIntoTree(tree);
      console.info("[API /api/registry/fs] registry-missing fallback", {
        target,
        childrenCount: merged.children?.length ?? 0,
        childrenNames: merged.children?.map((c) => c.name),
      });
      return NextResponse.json({
        children: merged.children,
        source: "registry-missing",
      });
    }

    const cacheKey = `tree:${target || "."}`;
    const cached = registryTreeCache.get<ApiTreeNode>(cacheKey);
    if (cached) {
      console.info("[API /api/registry/fs] cache hit", { target });
      const merged = await mergeDbProceduresIntoTree(cached);
      return NextResponse.json({
        children: merged.children,
        debug: {
          target,
          fullPath: safeJoin(target),
          childrenCount: merged.children?.length ?? 0,
          childrenNames: merged.children?.map((c) => c.name),
          cached: true,
        },
      });
    }

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      console.info("[API /api/registry/fs] not-found", {
        fullPath,
        exists: fs.existsSync(fullPath),
      });
      return NextResponse.json(
        { error: "Répertoire introuvable", fullPath },
        { status: 404 },
      );
    }

    const tree = buildTree(target);
    const merged = await mergeDbProceduresIntoTree(tree);
    registryTreeCache.set(cacheKey, merged);
    console.info("[API /api/registry/fs] tree response", {
      target,
      childrenCount: merged.children?.length ?? 0,
      childrenNames: merged.children?.map((c) => c.name),
      cached: false,
    });
    return NextResponse.json({
      children: merged.children,
      debug: {
        target,
        fullPath,
        childrenCount: merged.children?.length ?? 0,
        childrenNames: merged.children?.map((c) => c.name),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[API /api/registry/fs] error", { target, message, error });
    return NextResponse.json({ error: message, fullPath: safeJoin(target) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const target = formData.get("path") as string | null;

      if (!file || !target) {
        return NextResponse.json(
          { error: "Fichier et chemin requis" },
          { status: 400 },
        );
      }

      await withFileLock(REGISTRY_LOCK, async () => {
        const parentPath = safeJoin(target);
        const newPath = path.join(parentPath, file.name);
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(newPath, buffer);
      });

      registryTreeCache.invalidate("tree:");
      return NextResponse.json({ success: true });
    }

    const body = await request.json();
    const {
      path: target,
      name,
      kind,
    } = body as { path?: string; name?: string; kind?: string };

    if (!target || !name) {
      return NextResponse.json(
        { error: "Chemin et nom requis" },
        { status: 400 },
      );
    }

    await withFileLock(REGISTRY_LOCK, async () => {
      const parentPath = safeJoin(target);
      const newPath = path.join(parentPath, name);

      if (kind === "directory") {
        fs.mkdirSync(newPath, { recursive: true });
      } else {
        fs.writeFileSync(newPath, "", "utf-8");
      }
    });

    registryTreeCache.invalidate("tree:");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get("path");
    if (!target) {
      return NextResponse.json({ error: "Chemin requis" }, { status: 400 });
    }

    await withFileLock(REGISTRY_LOCK, async () => {
      const fullPath = safeJoin(target);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
    });

    registryTreeCache.invalidate("tree:");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { path: oldPath, newName } = body as {
      path?: string;
      newName?: string;
    };

    if (!oldPath || !newName) {
      return NextResponse.json(
        { error: "Chemin et nouveau nom requis" },
        { status: 400 },
      );
    }

    await withFileLock(REGISTRY_LOCK, async () => {
      const fullOldPath = safeJoin(oldPath);
      const fullNewPath = path.join(path.dirname(fullOldPath), newName);

      fs.renameSync(fullOldPath, fullNewPath);
    });

    registryTreeCache.invalidate("tree:");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { path: targetPath, content } = body as {
      path?: string;
      content?: string;
    };

    if (!targetPath || content === undefined) {
      return NextResponse.json(
        { error: "Chemin et contenu requis" },
        { status: 400 },
      );
    }

    await withFileLock(REGISTRY_LOCK, async () => {
      const fullPath = safeJoin(targetPath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content, "utf-8");
    });

    registryTreeCache.invalidate("tree:");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}