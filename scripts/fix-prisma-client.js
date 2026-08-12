const fs = require("fs");
const path = require("path");

const sourceDir = path.join(__dirname, "..", "node_modules", ".prisma", "client");
const targetDir = path.join(__dirname, "..", "node_modules", "@prisma", "client", ".prisma", "client");

if (!fs.existsSync(sourceDir)) {
  console.log("Prisma client source directory not found, skipping fix.");
  process.exit(0);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(sourceDir, targetDir);
console.log("Fixed Prisma v7 client type paths for @prisma/client.");
