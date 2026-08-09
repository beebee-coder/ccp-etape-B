import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { getUploadedFiles, storeUploadedFile, saveUploadedFile, parseQrFileContent, findNextVersion, getQrSetDirectory } from "@/lib/q-r/file-store";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-q-r-upload" });

export async function POST(request: Request) {
  log.debug("POST /api/q-r/upload: uploading Q/R file");
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("POST /api/q-r/upload: auth failed", { status: authResult.response.status });
    return authResult.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      log.warn("POST /api/q-r/upload: no file provided");
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (!file.name.endsWith(".json")) {
      log.warn("POST /api/q-r/upload: invalid file type", { fileName: file.name });
      return NextResponse.json({ error: "Seuls les fichiers JSON sont acceptés" }, { status: 400 });
    }

    const content = await file.text();
    const qaPairs = parseQrFileContent(content);

    if (qaPairs.length === 0) {
      log.warn("POST /api/q-r/upload: no valid Q/R pairs found", { fileName: file.name });
      return NextResponse.json({ error: "Aucune paire Q/R valide trouvée dans le fichier" }, { status: 400 });
    }

    const setName = file.name.replace(/\.json$/i, "");
    const version = await findNextVersion(setName);
    const { filePath, fileName } = await saveUploadedFile(setName, version, content);
    const directory = await getQrSetDirectory(setName);

    await storeUploadedFile(
      fileName,
      setName,
      version,
      directory,
      filePath,
      qaPairs.length,
      authResult.user!.sub
    );

    log.debug("POST /api/q-r/upload: file uploaded successfully", {
      fileName,
      setName,
      version,
      qaCount: qaPairs.length,
    });

    return NextResponse.json({
      data: {
        fileName,
        setName,
        version,
        qaCount: qaPairs.length,
        filePath,
        message: `Fichier "${fileName}" uploadé avec succès (${qaPairs.length} paire(s) Q/R)`,
      },
    }, { status: 201 });
  } catch (error) {
    log.error("POST /api/q-r/upload: error uploading file", { error });
    return NextResponse.json({ error: "Erreur lors de l'upload du fichier" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  log.debug("GET /api/q-r/upload: listing uploaded files");
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("GET /api/q-r/upload: auth failed", { status: authResult.response.status });
    return authResult.response;
  }

  try {
    const files = await getUploadedFiles();
    log.debug("GET /api/q-r/upload: returning files", { count: files.length });
    return NextResponse.json({ data: files });
  } catch (error) {
    log.error("GET /api/q-r/upload: error fetching files", { error });
    return NextResponse.json({ error: "Erreur lors de la récupération des fichiers" }, { status: 500 });
  }
}