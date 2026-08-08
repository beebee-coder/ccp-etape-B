import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), ".local-db");
const DOC_DIR = path.join(process.cwd(), "doc");

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeMeta(dirPath: string, libelle: string, code: string, type: string) {
  const metaPath = path.join(dirPath, ".meta.json");
  const content = JSON.stringify({
    libelle,
    code,
    type,
    sync_state: "local-only",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, null, 2);
  fs.writeFileSync(metaPath, content, "utf-8");
}

function buildFromJson(filePath: string, targetRoot: string, type: string) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  ensureDir(targetRoot);

  for (const [groupName, groupData] of Object.entries(data) as Array<[string, unknown]>) {
    const groupPath = path.join(targetRoot, groupName);
    ensureDir(groupPath);
    writeMeta(groupPath, groupName, groupName, type);

    const group = groupData as { descendants?: Array<{ nom: string; libelle: string }> };
    if (group.descendants && Array.isArray(group.descendants)) {
      for (const descendant of group.descendants) {
        const descendantPath = path.join(groupPath, descendant.nom);
        ensureDir(descendantPath);
        writeMeta(descendantPath, descendant.libelle, descendant.nom, type);
      }
    }
  }
}

function main() {
  console.log("🔄 Restauration de la structure .local-db depuis doc/...");

  ensureDir(ROOT);

  const centraleJson = path.join(DOC_DIR, "centrale.json");
  const groupesJson = path.join(DOC_DIR, "Groupes.json");

  if (fs.existsSync(centraleJson)) {
    console.log("  📁 Reconstruction de Centrale/...");
    buildFromJson(centraleJson, path.join(ROOT, "Centrale"), "centrale");
  } else {
    console.warn("  ⚠️  doc/centrale.json introuvable");
  }

  if (fs.existsSync(groupesJson)) {
    console.log("  📁 Reconstruction de Groupes/...");
    buildFromJson(groupesJson, path.join(ROOT, "Groupes"), "groupe");
  } else {
    console.warn("  ⚠️  doc/Groupes.json introuvable");
  }

  // Recréer les dossiers vides standards
  const standardDirs = ["procedures", "registry", "ressources humaines", ".vector-index"];
  for (const dir of standardDirs) {
    ensureDir(path.join(ROOT, dir));
  }

  console.log("✅ Structure .local-db restaurée depuis doc/centrale.json et doc/Groupes.json");
}

main();
