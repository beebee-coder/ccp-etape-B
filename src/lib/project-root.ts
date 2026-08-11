import fs from "fs";
import path from "path";

export function getProjectRoot(): string {
  const envRoot = process.env.PROJECT_ROOT;
  if (envRoot && fs.existsSync(envRoot)) {
    return path.resolve(envRoot);
  }

  const cwd = process.cwd();

  if (fs.existsSync(path.join(cwd, "package.json"))) {
    return cwd;
  }

  const standaloneCandidate = path.join(cwd, ".next", "standalone");
  if (fs.existsSync(standaloneCandidate)) {
    return cwd;
  }

  let dir = cwd;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return cwd;
}
