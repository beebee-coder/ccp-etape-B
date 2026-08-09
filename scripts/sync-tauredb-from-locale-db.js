const fs = require("fs");
const path = require("path");

const source = path.join(process.cwd(), ".locale-db");
const target = path.join(process.cwd(), ".tauri-local-db");

if (!fs.existsSync(source)) {
  console.log("No .locale-db directory found, skipping sync.");
  process.exit(0);
}

fs.cpSync(source, target, { recursive: true, force: true });
console.log("Synced .tauri-local-db from .locale-db");
