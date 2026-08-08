/**
 * Route API GET /api/local-db/download-registry
 *
 * Zippe uniquement le dossier `registry/` depuis le filesystem local en mode dev.
 * Ce ZIP est utilisé par le bouton "Synchroniser registry/" pour transférer
 * la BDD web locale vers la BDD locale sur le device.
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { createLogger } from "@/lib/logger";
import { getProjectRoot } from "@/lib/project-root";

const log = createLogger({ module: "api-local-db-download-registry" });
const PROJECT_ROOT = getProjectRoot();
const LOCAL_DB_ROOT = path.join(PROJECT_ROOT, ".locale-db");
const REGISTRY_DIR = path.join(LOCAL_DB_ROOT, "registry");

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
    log.info("GET /api/local-db/download-registry: Packaging registry/...");

    if (!fs.existsSync(REGISTRY_DIR)) {
      const zip = new JSZip();
      zip.folder("registry");
      zip.file("registry/registry-manifest.json", JSON.stringify({
        version: "1.0.0",
        generatedAt: new Date().toISOString(),
        source: "Empty registry (mode déploiement)",
      }, null, 2));

      const archiveBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      return new NextResponse(new Uint8Array(archiveBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="registry-bundle.zip"',
          "Content-Length": archiveBuffer.length.toString(),
        },
      });
    }

    const zip = new JSZip();
    addDirToZip(zip, REGISTRY_DIR, "registry");

    zip.file("registry/registry-manifest.json", JSON.stringify({
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      source: "Dev Filesystem registry/",
    }, null, 2));

    const archiveBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const zipFiles = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    const zipDirs = Object.keys(zip.files).filter((name) => zip.files[name].dir);
    log.info("GET /api/local-db/download-registry: ZIP contents", {
      files: zipFiles.length,
      dirs: zipDirs.length,
      sampleFiles: zipFiles.slice(0, 20),
      sampleDirs: zipDirs.slice(0, 20),
    });

    return new NextResponse(new Uint8Array(archiveBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="registry-bundle.zip"',
        "Content-Length": archiveBuffer.length.toString(),
      },
    });
  } catch (error) {
    log.error("GET /api/local-db/download-registry: Error packaging registry/", { error });
    return NextResponse.json(
      { error: "Erreur lors de la génération de l'archive registry/" },
      { status: 500 }
    );
  }
}
