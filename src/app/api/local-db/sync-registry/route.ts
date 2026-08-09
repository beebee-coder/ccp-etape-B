import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProjectRoot } from "@/lib/project-root";

const PROJECT_ROOT = getProjectRoot();
const LOCAL_DB_ROOT = path.join(PROJECT_ROOT, ".locale-db");
const REGISTRY_ROOT = path.join(PROJECT_ROOT, ".registry");

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
  const result: SyncResult & { purgedRegistryCount: number } = {
    added: [],
    updated: [],
    skipped: [],
    failed: [],
    purgedRegistryCount: 0,
  };

  if (!fs.existsSync(LOCAL_DB_ROOT)) {
    result.failed.push("(racine .locale-db manquante en mode déploiement)");
    return NextResponse.json(
      { error: ".locale-db n'existe pas sur le serveur (mode déploiement)", ...result },
      { status: 503 },
    );
  }

  if (!fs.existsSync(REGISTRY_ROOT)) {
    return NextResponse.json({ success: true, message: ".registry est vide", ...result });
  }

  try {
    const registryEntries: { path: string; kind: "file" | "directory" }[] = [];
    walkRegistry("", registryEntries);

    // 1. Injection par effet d'accumulation dans .locale-db
    for (const entry of registryEntries) {
      if (!entry.path) continue; // passer la racine ""
      const registryFullPath = safeJoin(entry.path, REGISTRY_ROOT);
      if (!fs.existsSync(registryFullPath)) continue;

      try {
        if (entry.kind === "directory") {
          const localFullPath = getLocalTargetPath(entry.path);
          if (!fs.existsSync(localFullPath)) {
            fs.mkdirSync(localFullPath, { recursive: true });
            result.added.push(entry.path);
          } else {
            result.skipped.push(entry.path);
          }
          continue;
        }

        // Fichier : gestion accumulation (non-écrasement sauf si identique)
        let targetLocalPath = getLocalTargetPath(entry.path);
        const parentDir = path.dirname(targetLocalPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        if (fs.existsSync(targetLocalPath)) {
          const localStat = fs.statSync(targetLocalPath);
          const regStat = fs.statSync(registryFullPath);

          // Si même taille et même nom, on considère déjà copié
          if (localStat.size === regStat.size) {
            result.skipped.push(entry.path);
          } else {
            // Fichier existant avec contenu différent -> accumulation via nom horodaté
            const ext = path.extname(targetLocalPath);
            const baseName = path.basename(targetLocalPath, ext);
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            targetLocalPath = path.join(parentDir, `${baseName}_${timestamp}${ext}`);

            fs.copyFileSync(registryFullPath, targetLocalPath);
            result.added.push(`${entry.path} -> ${path.basename(targetLocalPath)}`);
          }
        } else {
          fs.copyFileSync(registryFullPath, targetLocalPath);
          result.added.push(entry.path);
        }
      } catch {
        result.failed.push(entry.path);
      }
    }

    // 2. Purge de .registry après injection réussie : supprime EXCLUSIVEMENT les fichiers et CONSERVE tous les répertoires et sous-répertoires
    let purgedCount = 0;
    const purgeOnlyFiles = (dirPath: string) => {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        if (item === ".meta.json") continue;
        const fullItemPath = path.join(dirPath, item);
        const stat = fs.statSync(fullItemPath);
        if (stat.isDirectory()) {
          purgeOnlyFiles(fullItemPath); // Explore récursivement sans supprimer le dossier
        } else if (stat.isFile()) {
          fs.unlinkSync(fullItemPath);
          purgedCount++;
        }
      }
    };

    purgeOnlyFiles(REGISTRY_ROOT);
    result.purgedRegistryCount = purgedCount;

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message, ...result }, { status: 500 });
  }
}

function getLocalTargetPath(relPath: string): string {
  if (relPath.startsWith("Centrale/") || relPath.startsWith("Centrale\\")) {
    const normalized = relPath.replace(/\\/g, "/");
    return path.join(LOCAL_DB_ROOT, normalized);
  }
  if (relPath.startsWith("Groupes/") || relPath.startsWith("Groupes\\")) {
    const normalized = relPath.replace(/\\/g, "/");
    return path.join(LOCAL_DB_ROOT, normalized);
  }
  return path.join(LOCAL_DB_ROOT, "registry", relPath);
}
