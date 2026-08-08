import fs from "fs";
import path from "path";

export function getProjectRoot(): string {
  const envRoot = process.env.PROJECT_ROOT;
  if (envRoot && fs.existsSync(envRoot)) {
    return path.resolve(envRoot);
  }

  const root = process.cwd();

  if (fs.existsSync(path.join(root, ".local-db")) || fs.existsSync(path.join(root, "package.json"))) {
    return root;
  }

  let dir = root;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return root;
}
