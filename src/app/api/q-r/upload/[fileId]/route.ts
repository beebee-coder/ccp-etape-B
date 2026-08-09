import { NextResponse } from "next/server";
import { getUploadedFileById, deleteUploadedFile } from "@/lib/q-r/file-store";
import { requireRole } from "@/lib/api/auth";
import { createLogger } from "@/lib/logger";
import { readFile, unlink, readdir, rmdir } from "fs/promises";
import { dirname } from "path";

const log = createLogger({ module: "api-q-r-upload-file" });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  log.debug("GET /api/q-r/upload/[fileId]: fetching uploaded file");
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("GET /api/q-r/upload/[fileId]: auth failed", { status: authResult.response.status });
    return authResult.response;
  }

  const { fileId } = await params;

  try {
    const file = await getUploadedFileById(fileId);
    if (!file) {
      log.warn("GET /api/q-r/upload/[fileId]: file not found", { fileId });
      return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
    }

    let content: string;
    try {
      content = await readFile(file.filePath, "utf-8");
    } catch {
      log.error("GET /api/q-r/upload/[fileId]: file not found on disk", { fileId, filePath: file.filePath });
      return NextResponse.json({ error: "Fichier introuvable sur le disque" }, { status: 404 });
    }

    const pairs = parseQrFileContent(content) as Array<{ question: string; answer: string }>;

    log.debug("GET /api/q-r/upload/[fileId]: returning file data", {
      fileId,
      pairCount: pairs.length,
    });

    return NextResponse.json({
      data: {
        ...file,
        pairs,
      },
    });
  } catch (error) {
    log.error("GET /api/q-r/upload/[fileId]: error fetching file", { error, fileId });
    return NextResponse.json({ error: "Erreur lors de la récupération du fichier" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  log.debug("DELETE /api/q-r/upload/[fileId]: deleting uploaded file");
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("DELETE /api/q-r/upload/[fileId]: auth failed", { status: authResult.response.status });
    return authResult.response;
  }

  const { fileId } = await params;

  try {
    const file = await getUploadedFileById(fileId);
    if (!file) {
      log.warn("DELETE /api/q-r/upload/[fileId]: file not found", { fileId });
      return NextResponse.json({ error: "Fichier non trouvé" }, { status: 404 });
    }

    try {
      await unlink(file.filePath);
      log.debug("DELETE /api/q-r/upload/[fileId]: file deleted from disk", { fileId, filePath: file.filePath });
    } catch {
      log.warn("DELETE /api/q-r/upload/[fileId]: file already deleted from disk", { fileId, filePath: file.filePath });
    }

    try {
      const dir = dirname(file.filePath);
      const remainingFiles = await readdir(dir);
      if (remainingFiles.length === 0) {
        await rmdir(dir);
        log.debug("DELETE /api/q-r/upload/[fileId]: empty directory removed", { directory: dir });
      }
    } catch {
      log.warn("DELETE /api/q-r/upload/[fileId]: could not remove directory", { fileId });
    }

    await deleteUploadedFile(fileId);

    log.debug("DELETE /api/q-r/upload/[fileId]: file deleted from database", { fileId });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    log.error("DELETE /api/q-r/upload/[fileId]: error deleting file", { error, fileId });
    return NextResponse.json({ error: "Erreur lors de la suppression du fichier" }, { status: 500 });
  }
}

function parseQrFileContent(content: string): Array<{ question: string; answer: string }> {
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
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { pairs?: unknown }).pairs)) {
      return (parsed as { pairs: unknown[] }).pairs.filter(
        (item: unknown) =>
          item &&
          typeof item === "object" &&
          typeof (item as { question?: unknown }).question === "string" &&
          typeof (item as { answer?: unknown }).answer === "string"
      ) as Array<{ question: string; answer: string }>;
    }
    return [];
  } catch {
    return [];
  }
}