import { prisma } from "@/lib/db";
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
  const files = await prisma.qRUpload.findMany({
    orderBy: { createdAt: "desc" },
  });

  return files.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    setName: row.setName,
    version: row.version,
    directory: row.directory,
    filePath: row.filePath,
    qaCount: row.qaCount,
    createdAt: row.createdAt.toISOString(),
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
      content: string | null;
      createdAt: string;
    }
  | null
> {
  const file = await prisma.qRUpload.findUnique({
    where: { id },
  });

  if (!file) return null;

  return {
    id: file.id,
    fileName: file.fileName,
    setName: file.setName,
    version: file.version,
    directory: file.directory,
    filePath: file.filePath,
    qaCount: file.qaCount,
    content: file.content,
    createdAt: file.createdAt.toISOString(),
  };
}

export async function storeUploadedFile(
  fileName: string,
  setName: string,
  version: number,
  directory: string,
  filePath: string,
  qaCount: number,
  userId: string,
  content: string
): Promise<{ id: string }> {
  const id = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  await prisma.qRUpload.create({
    data: {
      id,
      userId,
      fileName,
      setName,
      version,
      directory,
      filePath,
      qaCount,
      content,
    },
  });

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
  try {
    await prisma.qRUpload.delete({
      where: { id },
    });
    return true;
  } catch {
    return false;
  }
}
