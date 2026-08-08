/**
 * Route API GET /api/local-db/download-archive
 *
 * Zippe récursivement et envoie l'intégralité du dossier physique `.local-db`
 * avec tous ses sous-dossiers (Centrale, Groupes, procedures, etc.) et tous
 * ses fichiers (PDF, images, SQLite, JSON, etc.) au navigateur client.
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

export async function GET() {
  try {
    log.info("GET /api/local-db/download-archive: Packaging .local-db...");
    const zip = new JSZip();

    // 1. Inclure le système de fichiers .local-db s'il existe sur le serveur
    if (fs.existsSync(LOCAL_DB_ROOT)) {
      addDirToZip(zip, LOCAL_DB_ROOT, "");
    }

    // 2. Assurer la présence des dossiers et fichiers de référence s'ils ne sont pas sur le disque
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
      if (!zip.folder(dir)) {
        zip.folder(dir);
      }
    }

    // 3. Exporter les données de la BDD Web vers un manifeste complet d'arborescence
    try {
      const [procedures, locationNodes] = await Promise.all([
        query("SELECT code, title, category FROM procedures").catch(() => ({ rows: [] })),
        query("SELECT path, libelle FROM location_nodes").catch(() => ({ rows: [] })),
      ]);

      // Générer les sous-fichiers pour chaque procédure dans /procedures
      for (const proc of procedures.rows as { code: string; title: string; category?: string }[]) {
        const procPath = `procedures/${proc.code}.json`;
        if (!zip.file(procPath)) {
          zip.file(procPath, JSON.stringify(proc, null, 2));
        }
      }

      // Générer les nœuds de localisation dans /Centrale et /Groupes
      for (const node of locationNodes.rows as { path: string; libelle?: string }[]) {
        const cleanPath = node.path.replace(/^\/+/, "");
        const filePath = `${cleanPath}/meta.json`;
        if (!zip.file(filePath)) {
          zip.file(filePath, JSON.stringify(node, null, 2));
        }
      }
    } catch (e) {
      log.warn("Non-fatal: Error fetching web DB tables for ZIP structure", { error: e });
    }

    // Fichier manifeste maître
    if (!zip.file("local-db-manifest.json")) {
      zip.file(
        "local-db-manifest.json",
        JSON.stringify(
          {
            version: "1.0.0",
            generatedAt: new Date().toISOString(),
            source: "Vercel Cloud Deployment",
          },
          null,
          2
        )
      );
    }

    const archiveBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    log.info("GET /api/local-db/download-archive: Archive generated", {
      sizeBytes: archiveBuffer.length,
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
