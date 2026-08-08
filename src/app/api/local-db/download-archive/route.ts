/**
 * Route API GET /api/local-db/download-archive
 *
 * Reconstruit et envoie l'intégralité de l'arborescence `.local-db`
 * au format ZIP, en se basant sur :
 *  1. Le filesystem local si disponible (mode dev)
 *  2. La base de données web (Neon) pour reconstruire la structure
 *     en mode déploiement Vercel où `.local-db` n'existe pas sur le serveur.
 *
 * La structure reconstruite respecte scrupuleusement l'arborescence dev :
 *  - Centrale/ et Groupes/ avec leurs .meta.json
 *  - procedures/ avec sous-répertoires par code
 *  - registry/ (bank, items, procedures, ressources humaines)
 *  - ressources humaines/ avec équipes
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-local-db-download-archive" });
const LOCAL_DB_ROOT = path.join(process.cwd(), ".local-db");

function addDirToZip(zip: JSZip, dirPath: string, relZipPath: string) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryRelZipPath = relZipPath ? `${relZipPath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const subFolder = zip.folder(entryRelZipPath);
      if (subFolder) {
        addDirToZip(zip, fullPath, entryRelZipPath);
      }
    } else if (entry.isFile()) {
      const fileData = fs.readFileSync(fullPath);
      zip.file(entryRelZipPath, fileData);
    }
  }
}

function ensureDirectory(zip: JSZip, dirPath: string) {
  const parts = dirPath.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!zip.folder(current)) {
      zip.folder(current);
    }
  }
}

function buildLocationTree(nodes: Array<{ path: string; [key: string]: unknown }>): string[] {
  const dirs = new Set<string>();
  for (const node of nodes) {
    const cleanPath = node.path.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!cleanPath) continue;
    const parts = cleanPath.split("/");
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join("/"));
    }
  }
  return Array.from(dirs);
}

export async function GET() {
  try {
    log.info("GET /api/local-db/download-archive: Packaging .local-db...");
    const zip = new JSZip();

    const useFilesystem = fs.existsSync(LOCAL_DB_ROOT);

    if (useFilesystem) {
      addDirToZip(zip, LOCAL_DB_ROOT, "");
    } else {
      const defaultDirs = [
        "Centrale",
        "Groupes",
        "procedures",
        "bank",
        "registry",
        "ressources humaines",
        ".vector-index",
      ];

      for (const dir of defaultDirs) {
        zip.folder(dir);
      }
    }

    try {
      const [
        procedures,
        locationNodes,
        mediaItems,
        knowledgeItems,
        teams,
      ] = await Promise.all([
        query("SELECT code, title, category, description, priority FROM procedures").catch(() => ({ rows: [] as Array<{ code: string; title: string; category?: string; description?: string; priority?: string }>, rowCount: 0 })),
        query("SELECT path, libelle, location_type, bloc_code, equipement_code, groupe_code, level, metadata FROM location_nodes ORDER BY level ASC, path ASC").catch(() => ({ rows: [] as Array<{ path: string; libelle?: string; location_type?: string; bloc_code?: string; equipement_code?: string; groupe_code?: string; level?: number; metadata?: unknown }>, rowCount: 0 })),
        query("SELECT id, title, category, kind, mime_type, data_url, thumbnail_url, location_path FROM media_items WHERE data_url IS NOT NULL OR thumbnail_url IS NOT NULL").catch(() => ({ rows: [] as Array<{ id: string; title: string; category?: string; kind?: string; mime_type?: string; data_url?: string; thumbnail_url?: string; location_path?: string }>, rowCount: 0 })),
        query("SELECT id, title, type, category, location_path, content, answer FROM knowledge_items").catch(() => ({ rows: [] as Array<{ id: string; title?: string; type?: string; category?: string; location_path?: string; content?: string; answer?: string }>, rowCount: 0 })),
        query("SELECT id, name, groupe_path FROM teams").catch(() => ({ rows: [] as Array<{ id: string; name?: string; groupe_path?: string }>, rowCount: 0 })),
      ]);

      const proceduresRows = procedures.rows as Array<{ code: string; title: string; category?: string; description?: string; priority?: string }>;
      const locationNodesRows = locationNodes.rows as Array<{ path: string; libelle?: string; location_type?: string; bloc_code?: string; equipement_code?: string; groupe_code?: string; level?: number; metadata?: unknown }>;
      const mediaItemsRows = mediaItems.rows as Array<{ id: string; title: string; category?: string; kind?: string; mime_type?: string; data_url?: string; thumbnail_url?: string; location_path?: string }>;
      const knowledgeItemsRows = knowledgeItems.rows as Array<{ id: string; title?: string; type?: string; category?: string; location_path?: string; content?: string; answer?: string }>;
      const teamsRows = teams.rows as Array<{ id: string; name?: string; groupe_path?: string }>;

      if (!useFilesystem) {
        const allDirs = buildLocationTree(locationNodesRows);
        for (const dir of allDirs) {
          ensureDirectory(zip, dir);
        }

        for (const node of locationNodesRows) {
          const cleanPath = node.path.replace(/^\/+/, "").replace(/\/+$/, "");
          if (!cleanPath) continue;

          const metaPath = `${cleanPath}/.meta.json`;
          if (!zip.file(metaPath)) {
            zip.file(metaPath, JSON.stringify({
              libelle: node.libelle,
              code: cleanPath.split("/").pop(),
              type: node.location_type,
              bloc_code: node.bloc_code,
              equipement_code: node.equipement_code,
              groupe_code: node.groupe_code,
              level: node.level,
              metadata: node.metadata,
            }, null, 2));
          }
        }
      }

      for (const proc of proceduresRows) {
        const procDir = `procedures/${proc.code}`;
        ensureDirectory(zip, procDir);

        const procJsonPath = `${procDir}/procedure.json`;
        if (!zip.file(procJsonPath)) {
          zip.file(procJsonPath, JSON.stringify(proc, null, 2));
        }

        const registryProcDir = `registry/procedures/${proc.code}`;
        ensureDirectory(zip, registryProcDir);
        const registryProcPath = `${registryProcDir}/procedure.json`;
        if (!zip.file(registryProcPath)) {
          zip.file(registryProcPath, JSON.stringify(proc, null, 2));
        }
      }

      for (const media of mediaItemsRows) {
        if (media.data_url) {
          const ext = media.mime_type?.split("/").pop() || "bin";
          const fileName = `registry/media/${media.id}.${ext}`;
          ensureDirectory(zip, "registry/media");
          if (!zip.file(fileName)) {
            try {
              const base64 = media.data_url.split(",")[1];
              if (base64) {
                const buffer = Buffer.from(base64, "base64");
                zip.file(fileName, buffer);
              }
            } catch {
              // ignore invalid base64
            }
          }
        }
      }

      for (const item of knowledgeItemsRows) {
        if (item.location_path) {
          const cleanPath = item.location_path.replace(/^\/+/, "");
          const fileName = `${cleanPath}/${item.id}.json`;
          ensureDirectory(zip, cleanPath);
          if (!zip.file(fileName)) {
            zip.file(fileName, JSON.stringify({
              id: item.id,
              title: item.title,
              type: item.type,
              category: item.category,
              content: item.content,
              answer: item.answer,
            }, null, 2));
          }
        }

        const registryItemPath = `registry/items/${item.id}.json`;
        if (!zip.file(registryItemPath)) {
          zip.file(registryItemPath, JSON.stringify({
            id: item.id,
            title: item.title,
            type: item.type,
            category: item.category,
            content: item.content,
            answer: item.answer,
          }, null, 2));
        }
      }

      for (const team of teamsRows) {
        if (team.groupe_path) {
          const cleanPath = team.groupe_path.replace(/^\/+/, "");
          const teamDir = `ressources humaines/${cleanPath}`;
          ensureDirectory(zip, teamDir);

          const teamJsonPath = `${teamDir}/${team.name || team.id}.json`;
          if (!zip.file(teamJsonPath)) {
            zip.file(teamJsonPath, JSON.stringify({
              id: team.id,
              name: team.name,
              groupe_path: team.groupe_path,
            }, null, 2));
          }
        }
      }
    } catch (e) {
      log.warn("Non-fatal: Error fetching web DB tables for ZIP structure", { error: e });
    }

    const manifest = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      source: useFilesystem ? "Dev Filesystem" : "Vercel Cloud Deployment",
      structure: "full-dev-parity",
    };

    zip.file("local-db-manifest.json", JSON.stringify(manifest, null, 2));

    const archiveBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    log.info("GET /api/local-db/download-archive: Archive generated", {
      sizeBytes: archiveBuffer.length,
      useFilesystem,
    });

    return new NextResponse(new Uint8Array(archiveBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="local-db-bundle.zip"',
        "Content-Length": archiveBuffer.length.toString(),
      },
    });
  } catch (error) {
    log.error("GET /api/local-db/download-archive: Error packaging .local-db", { error });
    return NextResponse.json(
      { error: "Erreur lors de la génération de l'archive .local-db" },
      { status: 500 }
    );
  }
}
