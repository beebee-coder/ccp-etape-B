import fs from "fs";
import path from "path";

const LOCAL_DB_ROOT = path.join(process.cwd(), ".locale-db");
const REGISTRY_ROOT = path.join(process.cwd(), ".registry");

function getLocalTargetPath(relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/");
  if (normalized.startsWith("Centrale/") || normalized.startsWith("Groupes/")) {
    return path.join(LOCAL_DB_ROOT, normalized);
  }
  return path.join(LOCAL_DB_ROOT, "registry", relPath);
}

interface Entry {
  path: string;
  kind: "file" | "directory";
}

function walk(dir: string, base: string, entries: Entry[]): void {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const rel = path.relative(base, full);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      entries.push({ path: rel, kind: "directory" });
      walk(full, base, entries);
    } else {
      entries.push({ path: rel, kind: "file" });
    }
  }
}

const entries: Entry[] = [];
walk(REGISTRY_ROOT, REGISTRY_ROOT, entries);

const added: string[] = [];
const updated: string[] = [];
const skipped: string[] = [];
const failed: string[] = [];

for (const entry of entries) {
  const registryFull = path.join(REGISTRY_ROOT, entry.path);
  const localFull = getLocalTargetPath(entry.path);

  try {
    if (entry.kind === "directory") {
      if (!fs.existsSync(localFull)) {
        fs.mkdirSync(localFull, { recursive: true });
        added.push(entry.path);
      } else {
        skipped.push(entry.path);
      }
      continue;
    }

    const localStat = fs.existsSync(localFull) ? fs.statSync(localFull) : null;
    const registryStat = fs.statSync(registryFull);

    if (localStat && localStat.isFile() && localStat.size === registryStat.size) {
      skipped.push(entry.path);
      continue;
    }

    const parentDir = path.dirname(localFull);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.copyFileSync(registryFull, localFull);
    if (localStat && localStat.isFile()) {
      updated.push(entry.path);
    } else {
      added.push(entry.path);
    }
  } catch (err) {
    failed.push(entry.path);
  }
}

console.log("=== Synchronisation terminée ===");
console.log(`Ajoutés:      ${added.length}`);
if (added.length) console.log(added.join("\n"));
console.log(`Mis à jour:   ${updated.length}`);
if (updated.length) console.log(updated.join("\n"));
console.log(`Ignorés:      ${skipped.length}`);
if (skipped.length) console.log(skipped.join("\n"));
console.log(`Échoués:      ${failed.length}`);
if (failed.length) console.log(failed.join("\n"));
