import fs from "fs";
import path from "path";

export function safeJoin(base: string, targetPath: string): string {
  const resolved = path.resolve(base, targetPath);
  if (!resolved.startsWith(base)) throw new Error("Accès hors du répertoire autorisé");
  return resolved;
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function readMeta(fullPath: string): string | undefined {
  const metaPath = path.join(fullPath, ".meta.json");
  try {
    if (fs.existsSync(metaPath) && fs.statSync(metaPath).isFile()) {
      const parsed = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (parsed && typeof parsed.libelle === "string") return parsed.libelle;
    }
  } catch { /* skip */ }
  return undefined;
}

export interface ApiTreeNode {
  name: string;
  path: string;
  kind: "directory" | "document" | "database";
  children?: ApiTreeNode[];
  stats?: { sizeBytes: number };
  vectorized?: boolean;
  libelle?: string;
  collection?: string;
}

export function buildTree(
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