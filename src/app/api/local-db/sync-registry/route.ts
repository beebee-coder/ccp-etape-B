import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LOCAL_DB_ROOT = path.join(process.cwd(), ".local-db");
const REGISTRY_ROOT = path.join(process.cwd(), ".registry");

function safeJoin(targetPath: string, root: string): string {
  const resolved = path.resolve(root, targetPath);
  if (!resolved.startsWith(root)) {
    throw new Error("Accès hors du répertoire autorisé");
  }
  return resolved;
}

interface SyncResult {
  added: string[];
  updated: string[];
  skipped: string[];
  failed: string[];
}

function walkRegistry(relPath: string, results: { path: string; kind: "file" | "directory" }[]): void {
  const fullPath = safeJoin(relPath, REGISTRY_ROOT);
  const stat = fs.statSync(fullPath);

  if (stat.isFile()) {
    results.push({ path: relPath, kind: "file" });
    return;
  }

  if (stat.isDirectory()) {
    results.push({ path: relPath, kind: "directory" });
    const entries = fs.readdirSync(fullPath);
    for (const entry of entries) {
      if (entry === ".meta.json") continue;
      const childRelPath = relPath ? `${relPath}/${entry}` : entry;
      walkRegistry(childRelPath, results);
    }
  }
}

export async function POST(): Promise<NextResponse> {
  const result: SyncResult = {
    added: [],
    updated: [],
    skipped: [],
    failed: [],
  };

  try {
    const registryEntries: { path: string; kind: "file" | "directory" }[] = [];
    walkRegistry("", registryEntries);

    const registryTarget = path.join(LOCAL_DB_ROOT, "registry");

    for (const entry of registryEntries) {
      const localFullPath = safeJoin(entry.path, registryTarget);
      const registryFullPath = safeJoin(entry.path, REGISTRY_ROOT);

      try {
        if (entry.kind === "directory") {
          if (!fs.existsSync(localFullPath)) {
            fs.mkdirSync(localFullPath, { recursive: true });
            result.added.push(entry.path);
          } else {
            result.skipped.push(entry.path);
          }
          continue;
        }

        const localStat = fs.existsSync(localFullPath) ? fs.statSync(localFullPath) : null;
        const registryStat = fs.statSync(registryFullPath);

        if (localStat && localStat.isFile() && localStat.size === registryStat.size) {
          result.skipped.push(entry.path);
          continue;
        }

        if (localStat && localStat.isFile()) {
          fs.copyFileSync(registryFullPath, localFullPath);
          result.updated.push(entry.path);
          continue;
        }

        const parentDir = path.dirname(localFullPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        fs.copyFileSync(registryFullPath, localFullPath);
        result.added.push(entry.path);
      } catch {
        result.failed.push(entry.path);
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message, ...result }, { status: 500 });
  }
}
