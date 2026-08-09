const fs = require("fs");
const path = require("path");

const source = path.join(process.cwd(), ".tauri-local-db");
const target = path.join(process.cwd(), ".next", "standalone", ".tauri-local-db");

if (!fs.existsSync(source)) {
  console.log("No .tauri-local-db directory found, skipping copy.");
  process.exit(0);
}

fs.cpSync(source, target, { recursive: true, force: true });
console.log("Copied .tauri-local-db to .next/standalone/.tauri-local-db");
