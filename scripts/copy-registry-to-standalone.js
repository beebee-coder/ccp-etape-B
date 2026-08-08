const fs = require("fs");
const path = require("path");

const source = path.join(process.cwd(), ".registry");
const target = path.join(process.cwd(), ".next", "standalone", ".registry");

if (!fs.existsSync(source)) {
  console.log("No .registry directory found, skipping copy.");
  process.exit(0);
}

fs.cpSync(source, target, { recursive: true, force: true });
console.log("Copied .registry to .next/standalone/.registry");
