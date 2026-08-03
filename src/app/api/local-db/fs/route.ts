import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LOCAL_DB_ROOT = path.join(process.cwd(), ".local-db");

function safeJoin(targetPath: string): string {
  const resolved = path.resolve(LOCAL_DB_ROOT, targetPath);
  if (!resolved.startsWith(LOCAL_DB_ROOT)) {
    throw new Error("Accès hors de .local-db");
  }
  return resolved;
}

const VECTOR_INDEX_DIR = path.join(LOCAL_DB_ROOT, ".vector-index");

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
      if (data.path) paths.add(data.path);
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
}

function buildTree(relPath: string, vectorizedPaths: Set<string>): ApiTreeNode {
  const fullPath = safeJoin(relPath);
  const stat = fs.statSync(fullPath);
  const name = path.basename(fullPath) || relPath.split("/").pop() || relPath;

  if (stat.isFile()) {
    const relPathForVec = path.relative(LOCAL_DB_ROOT, fullPath);
    return {
      name,
      path: relPath,
      kind: "document",
      stats: { sizeBytes: stat.size },
      vectorized: vectorizedPaths.has(relPathForVec),
    };
  }

  const entries = fs.readdirSync(fullPath);
  const children = entries.map((entryName) => {
    const childRelPath = relPath ? `${relPath}/${entryName}` : entryName;
    return buildTree(childRelPath, vectorizedPaths);
  });

  return {
    name,
    path: relPath,
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
      const content = fs.readFileSync(fullPath, "utf-8");
      return NextResponse.json({ content });
    }

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      return NextResponse.json({ error: "Répertoire introuvable" }, { status: 404 });
    }

    const vectorizedPaths = getVectorizedPaths();
    const tree = buildTree(target, vectorizedPaths);
    return NextResponse.json({ 
      children: tree.children,
      vectorizedPaths: Array.from(vectorizedPaths),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
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
        return NextResponse.json({ error: "Fichier et chemin requis" }, { status: 400 });
      }

      const parentPath = safeJoin(target);
      const newPath = path.join(parentPath, file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(newPath, buffer);

      return NextResponse.json({ success: true });
    }

    const body = await request.json();
    const { path: target, name, kind } = body as { path?: string; name?: string; kind?: string };

    if (!target || !name) {
      return NextResponse.json({ error: "Chemin et nom requis" }, { status: 400 });
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
  try {
    const body = await request.json();
    const { path: targetPath, action } = body as { path?: string; action?: string };

    if (!targetPath || !action) {
      return NextResponse.json({ error: "Chemin et action requis" }, { status: 400 });
    }

    const fullPath = safeJoin(targetPath);
    const stat = fs.statSync(fullPath);

    if (action === "vectorize" && stat.isFile()) {
      const vectorDir = path.join(LOCAL_DB_ROOT, ".vector-index");
      fs.mkdirSync(vectorDir, { recursive: true });

      const relPath = path.relative(LOCAL_DB_ROOT, fullPath);
      const hash = Buffer.from(relPath).toString("base64").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
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

    return NextResponse.json({ error: "Action non supportée" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { path: oldPath, newName } = body as { path?: string; newName?: string };

    if (!oldPath || !newName) {
      return NextResponse.json({ error: "Chemin et nouveau nom requis" }, { status: 400 });
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
