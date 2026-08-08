/**
 * Service OpfsStorageManager
 *
 * Gère l'écriture, la décompression et l'exploration récursive de l'arborescence
 * physique complète de `.local-db` dans le stockage OPFS (Origin Private File System)
 * du navigateur sur le device de l'utilisateur.
 */

import JSZip from "jszip";

export interface OpfsTreeNode {
  name: string;
  path: string;
  kind: "directory" | "document";
  children?: OpfsTreeNode[];
  stats?: { sizeBytes: number };
}

export class OpfsStorageManager {
  private static instance: OpfsStorageManager | null = null;

  private constructor() {}

  static getInstance(): OpfsStorageManager {
    if (!OpfsStorageManager.instance) {
      OpfsStorageManager.instance = new OpfsStorageManager();
    }
    return OpfsStorageManager.instance;
  }

  isSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      "storage" in navigator &&
      typeof (navigator.storage as unknown as { getDirectory?: unknown }).getDirectory === "function"
    );
  }

  async getRoot(): Promise<FileSystemDirectoryHandle> {
    if (!this.isSupported()) {
      throw new Error("L'API OPFS (Origin Private File System) n'est pas supportée par ce navigateur.");
    }
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle("local-db", { create: true });
  }

  /**
   * Reçoit le ArrayBuffer du bundle ZIP, le décompresse et écrit l'intégralité
   * de l'arborescence et des fichiers dans l'OPFS sur le device de l'utilisateur.
   */
  async extractZipToOpfs(
    zipBuffer: ArrayBuffer,
    onProgress?: (fileName: string, count: number, total: number) => void
  ): Promise<{ filesExtracted: number }> {
    const rootHandle = await this.getRoot();
    const zip = await JSZip.loadAsync(zipBuffer);
    const fileEntries = Object.keys(zip.files);
    let count = 0;

    for (const relativePath of fileEntries) {
      const entry = zip.files[relativePath];
      count++;
      if (onProgress) {
        onProgress(entry.name, count, fileEntries.length);
      }

      if (entry.dir) {
        await this.ensureDirectoryPath(rootHandle, relativePath);
      } else {
        const parts = relativePath.split("/").filter(Boolean);
        const fileName = parts.pop();
        if (!fileName) continue;

        const parentDirHandle = await this.ensureDirectoryPath(rootHandle, parts.join("/"));
        const fileHandle = await parentDirHandle.getFileHandle(fileName, { create: true });
        const content = await entry.async("uint8array");

        const writable = await fileHandle.createWritable();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await writable.write(content as any);
        await writable.close();
      }
    }

    return { filesExtracted: count };
  }

  private async ensureDirectoryPath(
    root: FileSystemDirectoryHandle,
    dirPath: string
  ): Promise<FileSystemDirectoryHandle> {
    if (!dirPath) return root;
    const parts = dirPath.split("/").filter(Boolean);
    let current = root;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
    return current;
  }

  /**
   * Lit l'arborescence complète depuis l'OPFS pour l'afficher dans l'explorateur BDD
   */
  async getTree(
    dirHandle?: FileSystemDirectoryHandle,
    relPath = ""
  ): Promise<OpfsTreeNode[]> {
    const root = dirHandle || (await this.getRoot());
    const nodes: OpfsTreeNode[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [name, handle] of (root as any).entries()) {
      const currentRelPath = relPath ? `${relPath}/${name}` : name;

      if (handle.kind === "directory") {
        const children = await this.getTree(handle as FileSystemDirectoryHandle, currentRelPath);
        nodes.push({
          name,
          path: currentRelPath,
          kind: "directory",
          children,
        });
      } else if (handle.kind === "file") {
        const fileObj = await (handle as FileSystemFileHandle).getFile();
        nodes.push({
          name,
          path: currentRelPath,
          kind: "document",
          stats: { sizeBytes: fileObj.size },
        });
      }
    }

    if (relPath === "") {
      console.info("[OpfsStorage] getTree root", {
        totalNodes: nodes.length,
        dirs: nodes.filter((n) => n.kind === "directory").length,
        files: nodes.filter((n) => n.kind === "document").length,
        sample: nodes.map((n) => ({ name: n.name, kind: n.kind, path: n.path, children: n.children?.length ?? 0 })),
      });
    }

    return nodes;
  }

  /**
   * Lit le contenu d'un fichier stocké dans l'OPFS
   */
  async readFile(relPath: string): Promise<{ content: string; isImage?: boolean }> {
    const root = await this.getRoot();
    const parts = relPath.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) throw new Error("Fichier invalide");

    let current = root;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part);
    }

    const fileHandle = await current.getFileHandle(fileName);
    const file = await fileHandle.getFile();

    const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

    if (imageExtensions.includes(ext)) {
      const buffer = await file.arrayBuffer();
      const base64 = this.arrayBufferToBase64(buffer);
      const mimeType = ext === ".svg" ? "image/svg+xml" : `image/${ext.slice(1)}`;
      return { content: `data:${mimeType};base64,${base64}`, isImage: true };
    }

    const text = await file.text();
    return { content: text, isImage: false };
  }

  /**
   * Exporte un fichier depuis OPFS sous forme de Blob pour téléchargement.
   */
  async exportSqliteFile(fileName: string): Promise<Blob> {
    const root = await this.getRoot();
    const fileHandle = await root.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunks = [];
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
    }
    return btoa(chunks.join(""));
  }
}

export const opfsStorage = OpfsStorageManager.getInstance();
