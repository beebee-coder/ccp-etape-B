import { query } from "@/lib/db";
import { readdir } from "fs/promises";
import { mkdir, writeFile, access } from "fs/promises";
import { join } from "path";

const UPLOADS_DIR = join(process.cwd(), "uploads");

async function ensureUploadsDir(): Promise<void> {
  try {
    await access(UPLOADS_DIR);
  } catch {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\-_\s]/g, "").trim();
}

export async function getUploadedFiles(): Promise<
  Array<{
    id: string;
    fileName: string;
    setName: string;
    version: number;
    directory: string;
    filePath: string;
    qaCount: number;
    createdAt: string;
  }>
> {
  const result = await query<{
    id: string;
    file_name: string;
    set_name: string;
    version: number;
    directory: string;
    file_path: string;
    qa_count: number;
    created_at: string;
  }>(
    `SELECT id, file_name, set_name, version, directory, file_path, qa_count, created_at
     FROM q_r_uploads
     ORDER BY created_at DESC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    setName: row.set_name,
    version: row.version,
    directory: row.directory,
    filePath: row.file_path,
    qaCount: row.qa_count,
    createdAt: row.created_at,
  }));
}

export async function getUploadedFileById(
  id: string
): Promise<
  | {
      id: string;
      fileName: string;
      setName: string;
      version: number;
      directory: string;
      filePath: string;
      qaCount: number;
      createdAt: string;
    }
  | null
> {
  const result = await query<{
    id: string;
    file_name: string;
    set_name: string;
    version: number;
    directory: string;
    file_path: string;
    qa_count: number;
    created_at: string;
  }>(
    `SELECT id, file_name, set_name, version, directory, file_path, qa_count, created_at
     FROM q_r_uploads
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    fileName: row.file_name,
    setName: row.set_name,
    version: row.version,
    directory: row.directory,
    filePath: row.file_path,
    qaCount: row.qa_count,
    createdAt: row.created_at,
  };
}

export async function storeUploadedFile(
  fileName: string,
  setName: string,
  version: number,
  directory: string,
  filePath: string,
  qaCount: number,
  userId: string
): Promise<{ id: string }> {
  const id = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  await query(
    `INSERT INTO q_r_uploads (id, user_id, file_name, set_name, version, directory, file_path, qa_count, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, userId, fileName, setName, version, directory, filePath, qaCount, now, now]
  );

  return { id };
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}

export async function getQrSetDirectory(setName: string): Promise<string> {
  await ensureUploadsDir();
  const sanitized = sanitizeFileName(setName);
  return join(UPLOADS_DIR, sanitized);
}

export async function findNextVersion(setName: string): Promise<number> {
  const dir = await getQrSetDirectory(setName);
  try {
    const files = await readdir(dir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    return jsonFiles.length + 1;
  } catch {
    return 1;
  }
}

export async function saveUploadedFile(
  setName: string,
  version: number,
  content: string
): Promise<{ filePath: string; fileName: string }> {
  await ensureUploadsDir();
  const dir = await getQrSetDirectory(setName);
  try {
    await access(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }

  const sanitized = sanitizeFileName(setName);
  const fileName = `${sanitized} ${version}.json`;
  const filePath = join(dir, fileName);

  await writeFile(filePath, content, "utf-8");
  return { filePath, fileName };
}

export function parseQrFileContent(content: string): Array<{ question: string; answer: string }> {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item: unknown) =>
          item &&
          typeof item === "object" &&
          typeof (item as { question?: unknown }).question === "string" &&
          typeof (item as { answer?: unknown }).answer === "string"
      );
    }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.pairs)) {
      return parsed.pairs.filter(
        (item: unknown) =>
          item &&
          typeof item === "object" &&
          typeof (item as { question?: unknown }).question === "string" &&
          typeof (item as { answer?: unknown }).answer === "string"
      );
    }
    return [];
  } catch {
    return [];
  }
}

export async function deleteUploadedFile(id: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    `DELETE FROM q_r_uploads WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rows.length > 0;
}