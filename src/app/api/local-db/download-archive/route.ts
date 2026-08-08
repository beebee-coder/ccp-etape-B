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

    if (!fs.existsSync(LOCAL_DB_ROOT)) {
      return NextResponse.json(
        { error: "Le répertoire .local-db n'existe pas sur le serveur" },
        { status: 404 }
      );
    }

    const zip = new JSZip();
    addDirToZip(zip, LOCAL_DB_ROOT, "");

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
