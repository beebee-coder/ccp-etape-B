import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProjectRoot } from "@/lib/project-root";
import { prisma } from "@/lib/db";

const PROJECT_ROOT = getProjectRoot();
const REGISTRY_ROOT = path.join(PROJECT_ROOT, ".registry");

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  root: string;
}

export async function POST() {
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    root: REGISTRY_ROOT,
  };

  if (!fs.existsSync(REGISTRY_ROOT)) {
    return NextResponse.json(
      { success: false, error: ".registry not found", result },
      { status: 404 }
    );
  }

  try {
    const walk = async (dirPath: string, relativePath: string) => {
      const entries = fs.readdirSync(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const relPath = relativePath ? `${relativePath}/${entry}` : entry;
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const metaPath = path.join(fullPath, ".meta.json");
          let libelle: string | undefined;
          if (fs.existsSync(metaPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
              if (meta.libelle) libelle = meta.libelle;
            } catch { /* skip */ }
          }

          const parentPath = relativePath || undefined;
          const level = relativePath ? (relativePath.split("/").filter(Boolean).length) : 0;

          try {
            await prisma.locationNode.upsert({
              where: { path: relPath },
              update: { libelle, parentPath, level, locationType: "registry" },
              create: {
                id: `registry-${relPath.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100)}`,
                path: relPath,
                libelle,
                parentPath,
                level,
                locationType: "registry",
              },
            });
            result.imported++;
          } catch (e) {
            result.errors.push(`Failed to import ${relPath}: ${e instanceof Error ? e.message : "unknown"}`);
          }

          await walk(fullPath, relPath);
        }
      }
    };

    await walk(REGISTRY_ROOT, "");

    return NextResponse.json({
      success: true,
      message: `Importé ${result.imported} nœuds depuis .registry`,
      result,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[API /api/registry/import] error", msg);
    return NextResponse.json({ success: false, error: msg, result }, { status: 500 });
  }
}