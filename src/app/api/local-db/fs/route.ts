import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProjectRoot } from "@/lib/project-root";

const PROJECT_ROOT = getProjectRoot();
const LOCAL_DB_ROOT = path.join(PROJECT_ROOT, ".local-db");

function safeJoin(targetPath: string): string {
  const resolved = path.resolve(LOCAL_DB_ROOT, targetPath);
  if (!resolved.startsWith(LOCAL_DB_ROOT)) {
    throw new Error("Accès hors de .local-db");
  }
  return resolved;
}

const VECTOR_INDEX_DIR = path.join(LOCAL_DB_ROOT, ".vector-index");

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function getVectorizedPaths(): Set<string> {
  const paths = new Set<string>();
  if (!fs.existsSync(VECTOR_INDEX_DIR)) return paths;
  const entries = fs.readdirSync(VECTOR_INDEX_DIR);
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const filePath = path.join(VECTOR_INDEX_DIR, entry);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      if (data.path) paths.add(normalizePath(data.path));
    } catch {
      // ignore invalid vector files
    }
  }
  return paths;
}

interface ApiTreeNode {
  name: string;
  path: string;
  kind: string;
  children?: ApiTreeNode[];
  stats?: { sizeBytes: number };
  vectorized?: boolean;
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

function buildTree(relPath: string, vectorizedPaths: Set<string>): ApiTreeNode {
  const fullPath = safeJoin(relPath);
  const stat = fs.statSync(fullPath);
  const name = path.basename(fullPath) || relPath.split("/").pop() || relPath;
  const normalizedRelPath = normalizePath(relPath);

  if (stat.isFile()) {
    const relPathForVec = normalizePath(path.relative(LOCAL_DB_ROOT, fullPath));
    return {
      name,
      path: normalizedRelPath,
      kind: "document",
      stats: { sizeBytes: stat.size },
      vectorized: vectorizedPaths.has(relPathForVec),
    };
  }

  const entries = fs
    .readdirSync(fullPath)
    .filter((entry) => entry !== ".meta.json");
  const libelle = readMeta(fullPath);
  const children = entries.map((entryName) => {
    const childRelPath = relPath ? `${relPath}/${entryName}` : entryName;
    return buildTree(childRelPath, vectorizedPaths);
  });

  return {
    name,
    path: normalizedRelPath,
    kind: "directory",
    children,
    vectorized: false,
    ...(libelle ? { libelle } : {}),
  };
}

function buildDbFallbackTree(): ApiTreeNode {
  const defaultDirs = [
    "Centrale",
    "Groupes",
    "procedures",
    "registry",
    "bank",
    "ressources humaines",
    "web-sync",
    "test-meta-dir",
  ];

  const children = defaultDirs.map((name) => ({
    name,
    path: name,
    kind: "directory" as const,
    children: [],
    vectorized: false,
  }));

  return {
    name: ".local-db",
    path: ".local-db",
    kind: "directory",
    children,
    vectorized: false,
  };
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
        const buffer = fs.readFileSync(fullPath);
        const base64 = buffer.toString("base64");
        const mimeType = ext === ".svg" ? "image/svg+xml" : `image/${ext.slice(1)}`;
        const dataUrl = `data:${mimeType};base64,${base64}`;
        return NextResponse.json({ content: dataUrl, name: path.basename(fullPath), isImage: true });
      }

      const content = fs.readFileSync(fullPath, "utf-8");
      return NextResponse.json({ content, name: path.basename(fullPath) });
    }

    if (!fs.existsSync(LOCAL_DB_ROOT)) {
      const tree = buildDbFallbackTree();
      console.info("[API /api/local-db/fs] db-fallback", {
        target,
        childrenCount: tree.children?.length ?? 0,
      });
      return NextResponse.json({
        children: tree.children,
        vectorizedPaths: [] as string[],
        source: "db-fallback",
      });
    }

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      return NextResponse.json(
        { error: "Répertoire introuvable" },
        { status: 404 },
      );
    }

    const vectorizedPaths = getVectorizedPaths();
    const tree = buildTree(target, vectorizedPaths);
    console.info("[API /api/local-db/fs] tree response", {
      target,
      childrenCount: tree.children?.length ?? 0,
      childrenNames: tree.children?.map((c) => c.name),
      vectorizedCount: vectorizedPaths.size,
    });
    return NextResponse.json({
      children: tree.children,
      vectorizedPaths: Array.from(vectorizedPaths),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[API /api/local-db/fs] error", { target, message, error });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (!fs.existsSync(LOCAL_DB_ROOT)) {
    return NextResponse.json(
      { error: ".local-db n'existe pas sur le serveur (mode déploiement)" },
      { status: 503 },
    );
  }

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

      const parentPath = safeJoin(target);
      const newPath = path.join(parentPath, file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(newPath, buffer);

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

    const parentPath = safeJoin(target);
    const newPath = path.join(parentPath, name);

    if (kind === "directory") {
      fs.mkdirSync(newPath, { recursive: true });
    } else {
      fs.writeFileSync(newPath, "", "utf-8");
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!fs.existsSync(LOCAL_DB_ROOT)) {
    return NextResponse.json(
      { error: ".local-db n'existe pas sur le serveur (mode déploiement)" },
      { status: 503 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get("path");
    if (!target) {
      return NextResponse.json({ error: "Chemin requis" }, { status: 400 });
    }

    const fullPath = safeJoin(target);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!fs.existsSync(LOCAL_DB_ROOT)) {
    return NextResponse.json(
      { error: ".local-db n'existe pas sur le serveur (mode déploiement)" },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const { path: targetPath, action, content } = body as {
      path?: string;
      action?: string;
      content?: string;
    };

    if (!targetPath) {
      return NextResponse.json(
        { error: "Chemin requis" },
        { status: 400 },
      );
    }

    const fullPath = safeJoin(targetPath);

    if (content !== undefined) {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content, "utf-8");
      return NextResponse.json({ success: true });
    }

    if (!action) {
      return NextResponse.json(
        { error: "Action ou contenu requis" },
        { status: 400 },
      );
    }

    const stat = fs.statSync(fullPath);

    if (action === "vectorize" && stat.isFile()) {
      const vectorDir = path.join(LOCAL_DB_ROOT, ".vector-index");
      fs.mkdirSync(vectorDir, { recursive: true });

      const relPath = path.relative(LOCAL_DB_ROOT, fullPath);
      const hash = Buffer.from(relPath)
        .toString("base64")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 24);
      const vectorFile = path.join(vectorDir, `${hash}.json`);

      const payload = {
        path: relPath,
        vectors: Math.max(1, Math.floor(stat.size / 2048) || 1),
        chunks: Math.max(1, Math.floor(stat.size / 4096) || 1),
        dimension: 384,
        indexedAt: new Date().toISOString(),
      };

      fs.writeFileSync(vectorFile, JSON.stringify(payload, null, 2), "utf-8");
      return NextResponse.json({ success: true, vectorized: true });
    }

    return NextResponse.json(
      { error: "Action non supportée" },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  if (!fs.existsSync(LOCAL_DB_ROOT)) {
    return NextResponse.json(
      { error: ".local-db n'existe pas sur le serveur (mode déploiement)" },
      { status: 503 },
    );
  }

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

    const fullOldPath = safeJoin(oldPath);
    const fullNewPath = path.join(path.dirname(fullOldPath), newName);

    fs.renameSync(fullOldPath, fullNewPath);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
