import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const REGISTRY_ROOT = path.join(process.cwd(), ".registry");

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

    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      return NextResponse.json(
        { error: "Répertoire introuvable" },
        { status: 404 },
      );
    }

    const tree = buildTree(target);
    return NextResponse.json({ children: tree.children });
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

    const fullOldPath = safeJoin(oldPath);
    const fullNewPath = path.join(path.dirname(fullOldPath), newName);

    fs.renameSync(fullOldPath, fullNewPath);

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

    const fullPath = safeJoin(targetPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, "utf-8");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}