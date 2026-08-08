import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), ".locale-db");
const DOC_DIR = path.join(process.cwd(), "doc");

interface LeafNode {
  nom: string;
  libelle: string;
}

interface BranchNode {
  libelle: string;
  descendants: LeafNode[];
}

interface CentraleData {
  Centrale: Record<string, BranchNode>;
}

interface GroupesData {
  Groupes: Record<string, { descendants: LeafNode[] }>;
}

const DATA_SUBDIRS = ["procedures", "qr", "images", "alarms", "media"] as const;

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeMeta(dir: string, libelle: string): void {
  const metaPath = path.join(dir, ".meta.json");
  fs.writeFileSync(metaPath, JSON.stringify({ libelle }, null, 2), "utf-8");
}

function ensureDataDirs(leafDir: string): void {
  for (const sub of DATA_SUBDIRS) {
    ensureDir(path.join(leafDir, "data", sub));
  }
}

function buildCentrale(basePath: string, data: CentraleData): void {
  for (const [key, branch] of Object.entries(data.Centrale)) {
    const dir = path.join(basePath, key);
    ensureDir(dir);
    writeMeta(dir, branch.libelle);
    for (const leaf of branch.descendants) {
      const leafDir = path.join(dir, leaf.nom);
      ensureDir(leafDir);
      writeMeta(leafDir, leaf.libelle);
      ensureDataDirs(leafDir);
    }
  }
}

function buildGroupes(basePath: string, data: GroupesData): void {
  for (const [groupName, group] of Object.entries(data.Groupes)) {
    const groupDir = path.join(basePath, groupName);
    ensureDir(groupDir);
    writeMeta(groupDir, groupName);
    for (const leaf of group.descendants) {
      const leafDir = path.join(groupDir, leaf.nom);
      ensureDir(leafDir);
      writeMeta(leafDir, leaf.libelle);
      ensureDataDirs(leafDir);
    }
  }
}

function main(): void {
  ensureDir(ROOT);

  const centralePath = path.join(DOC_DIR, "centrale.json");
  const groupesPath = path.join(DOC_DIR, "Groupes.json");

  if (!fs.existsSync(centralePath)) {
    console.error(`File not found: ${centralePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(groupesPath)) {
    console.error(`File not found: ${groupesPath}`);
    process.exit(1);
  }

  const centraleData = JSON.parse(
    fs.readFileSync(centralePath, "utf-8"),
  ) as CentraleData;
  const groupesData = JSON.parse(
    fs.readFileSync(groupesPath, "utf-8"),
  ) as GroupesData;

  const centralesDir = path.join(ROOT, "Centrale");
  ensureDir(centralesDir);
  buildCentrale(centralesDir, centraleData);

  const groupesDir = path.join(ROOT, "Groupes");
  ensureDir(groupesDir);
  buildGroupes(groupesDir, groupesData);

  console.log("Done. Directory structure created in .locale-db/");
}

main();
