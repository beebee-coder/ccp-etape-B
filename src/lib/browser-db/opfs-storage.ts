/**
 * Service OpfsStorageManager
 *
 * Gère l'écriture, la décompression et l'exploration récursive de l'arborescence
 * physique complète de `.locale-db` dans le stockage OPFS (Origin Private File System)
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

  /** Répertoires canoniques conformes à la structure physique de .locale-db */
  private static readonly CANONICAL_DIRECTORIES = [
    "Centrale",
    "Groupes",
    "procedures",
    "registry",
    "bank",
    "ressources humaines",
    "test-meta-dir",
    "web-sync",
    ".vector-index",
  ];

  async getRoot(): Promise<FileSystemDirectoryHandle> {
    if (!this.isSupported()) {
      throw new Error("L'API OPFS (Origin Private File System) n'est pas supportée par ce navigateur.");
    }
    const root = await navigator.storage.getDirectory();
    const localDbDir = await root.getDirectoryHandle("local-db", { create: true });

    // Initialise l'arborescence physique canonique (conserve les répertoires même vides)
    for (const dirName of OpfsStorageManager.CANONICAL_DIRECTORIES) {
      await localDbDir.getDirectoryHandle(dirName, { create: true });
    }

    return localDbDir;
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

    console.info("[OpfsStorage] extractZipToOpfs start", {
      totalEntries: fileEntries.length,
      zipSize: zipBuffer.byteLength,
      entries: fileEntries,
    });

    for (const relativePath of fileEntries) {
      const entry = zip.files[relativePath];
      count++;
      if (onProgress) {
        onProgress(entry.name, count, fileEntries.length);
      }

      if (entry.dir) {
        try {
          await this.ensureDirectoryPath(rootHandle, relativePath);
        } catch (error) {
          console.warn("[OpfsStorage] ensureDirectoryPath error", { relativePath, error });
        }
      } else {
        const parts = relativePath.split("/").filter(Boolean);
        const fileName = parts.pop();
        if (!fileName) continue;

        try {
          const parentDirHandle = await this.ensureDirectoryPath(rootHandle, parts.join("/"));
          const fileHandle = await parentDirHandle.getFileHandle(fileName, { create: true });
          const content = await entry.async("uint8array");

          const writable = await fileHandle.createWritable();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await writable.write(content as any);
          await writable.close();
        } catch (error) {
          console.warn("[OpfsStorage] writeFile error", { relativePath, error });
        }
      }
    }

    console.info("[OpfsStorage] extractZipToOpfs done", {
      filesExtracted: count,
      entries: fileEntries,
    });

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
        tree: nodes.map((n) => ({
          name: n.name,
          kind: n.kind,
          path: n.path,
          children: n.children?.map((c) => ({ name: c.name, kind: c.kind, path: c.path, children: c.children?.length ?? 0 })) ?? [],
        })),
      });
    }

    return nodes;
  }

  async getVectorizedPaths(): Promise<Set<string>> {
    const paths = new Set<string>();
    try {
      const root = await this.getRoot();
      const vectorIndexDir = await root.getDirectoryHandle(".vector-index", { create: false });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const [name, handle] of (vectorIndexDir as any).entries()) {
        if (handle.kind === "file" && name.endsWith(".json")) {
          try {
            const file = await (handle as FileSystemFileHandle).getFile();
            const content = await file.text();
            const data = JSON.parse(content);
            if (data.path) {
              paths.add(data.path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, ""));
            }
          } catch {
            // ignore invalid vector files
          }
        }
      }
    } catch {
      // .vector-index doesn't exist or is empty
    }
    console.info("[OpfsStorage] getVectorizedPaths", {
      count: paths.size,
      sample: Array.from(paths).slice(0, 20),
    });
    return paths;
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

  /**
   * Crée un fichier dans OPFS au chemin relatif donné.
   * @param relPath  Chemin relatif depuis la racine OPFS (ex: "Groupes/doc.json")
   * @param content  Contenu textuel optionnel (défaut : chaîne vide)
   */
  async createFile(relPath: string, content = ""): Promise<void> {
    const root = await this.getRoot();
    const parts = relPath.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) throw new Error("Chemin de fichier invalide");
    const parentDir = await this.ensureDirectoryPath(root, parts.join("/"));
    const fileHandle = await parentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new TextEncoder().encode(content));
    await writable.close();
  }

  /**
   * Crée un répertoire (et tous ses parents) dans OPFS.
   * @param relPath  Chemin relatif depuis la racine OPFS (ex: "Groupes/SousGroupe")
   */
  async createDirectory(relPath: string): Promise<void> {
    const root = await this.getRoot();
    await this.ensureDirectoryPath(root, relPath);
  }

  /**
   * Supprime un fichier ou un répertoire (récursivement) dans OPFS.
   * @param relPath  Chemin relatif depuis la racine OPFS
   */
  async deleteEntry(relPath: string): Promise<void> {
    const root = await this.getRoot();
    const parts = relPath.split("/").filter(Boolean);
    const entryName = parts.pop();
    if (!entryName) throw new Error("Chemin invalide");
    let parentDir = root;
    for (const part of parts) {
      parentDir = await parentDir.getDirectoryHandle(part);
    }
    await parentDir.removeEntry(entryName, { recursive: true });
  }

  /**
   * Renomme un fichier ou un répertoire dans OPFS en le copiant puis en supprimant l'original.
   * @param relPath  Chemin relatif de l'entrée existante
   * @param newName  Nouveau nom (sans chemin parent)
   */
  async renameEntry(relPath: string, newName: string): Promise<void> {
    const root = await this.getRoot();
    const parts = relPath.split("/").filter(Boolean);
    const oldName = parts.pop();
    if (!oldName || !newName.trim()) throw new Error("Nom invalide");

    let parentDir = root;
    for (const part of parts) {
      parentDir = await parentDir.getDirectoryHandle(part);
    }

    // Tente d'abord via move() (Chrome ≥ 123)
    try {
      const handle = await parentDir.getFileHandle(oldName).catch(() => null)
        ?? await parentDir.getDirectoryHandle(oldName);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (handle as any).move === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (handle as any).move(newName);
        return;
      }
    } catch {
      // move() non disponible — fallback copie + suppression
    }

    // Fallback : copier puis supprimer (fichiers uniquement)
    const oldFileHandle = await parentDir.getFileHandle(oldName);
    const file = await oldFileHandle.getFile();
    const newFileHandle = await parentDir.getFileHandle(newName, { create: true });
    const writable = await newFileHandle.createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();
    await parentDir.removeEntry(oldName, { recursive: true });
  }

  /**
   * Écrit le contenu textuel d'un fichier existant dans OPFS.
   * @param relPath  Chemin relatif depuis la racine OPFS
   * @param content  Nouveau contenu textuel
   */
  async writeFile(relPath: string, content: string): Promise<void> {
    const root = await this.getRoot();
    const parts = relPath.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) throw new Error("Chemin de fichier invalide");
    let parentDir = root;
    for (const part of parts) {
      parentDir = await parentDir.getDirectoryHandle(part);
    }
    const fileHandle = await parentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new TextEncoder().encode(content));
    await writable.close();
  }

  /**
   * Lit le contenu brut d'un fichier OPFS (texte ou image base64).
   */
  async readFileContent(relPath: string): Promise<{ content: string; isImage: boolean }> {
    const res = await this.readFile(relPath);
    return { content: res.content, isImage: Boolean(res.isImage) };
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
