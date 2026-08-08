import fs from "fs";
import path from "path";

const LOCK_TIMEOUT_MS = 5_000;

export async function withFileLock<T>(
  lockPath: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      try {
        return await fn();
      } finally {
        try {
          fs.closeSync(fd);
        } catch {
          // ignore
        }
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // ignore
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      if (Date.now() - start > LOCK_TIMEOUT_MS) {
        throw new Error(`Impossible d'acquérir le verrou ${path.basename(lockPath)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
