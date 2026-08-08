const fs = require("fs");
const path = require("path");

const source = path.join(process.cwd(), ".locale-db");
const target = path.join(process.cwd(), ".next", "standalone", ".locale-db");

if (!fs.existsSync(source)) {
  console.log("No .locale-db directory found, skipping copy.");
  process.exit(0);
}

fs.cpSync(source, target, { recursive: true, force: true });
console.log("Copied .locale-db to .next/standalone/.locale-db");
