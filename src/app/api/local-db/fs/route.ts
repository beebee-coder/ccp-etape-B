import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProjectRoot } from "@/lib/project-root";
import { query } from "@/lib/db";

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

function ensurePath(
  root: ApiTreeNode,
  segments: string[],
): ApiTreeNode {
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
    name: ".local-db",
    path: ".local-db",
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

    console.info("[API /api/local-db/fs] reconstructed tree from DB", {
      childrenCount: root.children?.length ?? 0,
      childrenNames: root.children?.map((c) => c.name),
    });
  } catch (e) {
    console.error("[API /api/local-db/fs] reconstruction error", e);
  }

  return root;
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
      const reconstructed = await buildReconstructedTreeFromDb();
      const hasReconstructedData = (reconstructed.children?.length ?? 0) > 0;
      if (hasReconstructedData) {
        console.info("[API /api/local-db/fs] db-reconstructed", {
          childrenCount: reconstructed.children?.length ?? 0,
          childrenNames: reconstructed.children?.map((c) => c.name),
        });
        return NextResponse.json({
          children: reconstructed.children,
          vectorizedPaths: [] as string[],
          source: "db-reconstructed",
        });
      }
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
