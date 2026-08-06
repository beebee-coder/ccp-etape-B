import fs from "fs";
import path from "path";
import { LocalMetaSchema, CentraleMetaSchema, GroupeMetaSchema } from "../src/lib/types/local-db";

const ROOT = path.join(process.cwd(), ".local-db");
const REPORT: { path: string; action: string; error?: string }[] = [];

function inferEntityType(dirPath: string, code: string, parentCode?: string): "centrale" | "sous_centrale" | "equipement" | "groupe" | "document" {
  const relative = path.relative(ROOT, dirPath);
  const parts = relative.split(path.sep);

  if (parts[0] === "Groupes") return "groupe";
  if (parts[0] === "Centrale") {
    if (parts.length === 2) return "centrale";
    if (parts.length === 3) {
      if (parentCode && code.startsWith(parentCode)) return "equipement";
      return "sous_centrale";
    }
  }
  return "document";
}

function migrateMeta(metaPath: string) {
  const dir = path.dirname(metaPath);
  const relative = path.relative(ROOT, dir);
  const parts = relative.split(path.sep);
  const code = path.basename(dir);

  const parentCode = parts.length >= 3 ? parts[parts.length - 2] : undefined;

  const raw = fs.readFileSync(metaPath, "utf-8");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    REPORT.push({ path: metaPath, action: "skip", error: "invalid JSON" });
    return;
  }

  const libelle = typeof parsed.libelle === "string" ? parsed.libelle : code;
  const type = inferEntityType(dir, code, parentCode);

  const payload: Record<string, unknown> = {
    libelle,
    code,
    type,
    syncState: "local-only",
  };

  if (parentCode) payload.parentId = parentCode;
  if (typeof parsed.description === "string") payload.description = parsed.description;
  if (Array.isArray(parsed.tags)) payload.tags = parsed.tags;
  if (parsed.metadata && typeof parsed.metadata === "object" && !Array.isArray(parsed.metadata)) payload.metadata = parsed.metadata;

  const schema = type === "groupe" ? GroupeMetaSchema : type === "centrale" ? CentraleMetaSchema : LocalMetaSchema;
  const validated = schema.parse(payload);

  fs.writeFileSync(metaPath, JSON.stringify(validated, null, 2) + "\n");
  REPORT.push({ path: metaPath, action: "migrated" });
}

function walkDir(dir: string) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name === "web-sync" || entry.name === ".vector-index" || entry.name === "registry") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const metaPath = path.join(full, ".meta.json");
      if (fs.existsSync(metaPath)) {
        migrateMeta(metaPath);
      }
      walkDir(full);
    }
  }
}

walkDir(ROOT);

const migrated = REPORT.filter((r) => r.action === "migrated").length;
const skipped = REPORT.filter((r) => r.action === "skip").length;
console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped`);
if (skipped > 0) {
  console.log("Skipped files:");
  REPORT.filter((r) => r.action === "skip").forEach((r) => console.log(`  ${r.path}: ${r.error}`));
}
