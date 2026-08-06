import fs from "fs";
import path from "path";
import { LocalDataSource } from "../data-source";
import type { LocalMeta, LocalMetaType } from "@/lib/types/local-db";

export interface ILocalMetaRepository {
  upsert(meta: LocalMeta): Promise<void>;
  findByPath(path: string): Promise<LocalMeta | null>;
  findByType(type: LocalMetaType): Promise<LocalMeta[]>;
  findByParent(parentId: string): Promise<LocalMeta[]>;
  findBySyncState(syncState: LocalMeta["syncState"]): Promise<LocalMeta[]>;
  findAll(): Promise<LocalMeta[]>;
  delete(path: string): Promise<boolean>;
  indexDirectory(dirPath: string): Promise<void>;
}

export class LocalMetaRepository implements ILocalMetaRepository {
  private dataSource: LocalDataSource;

  constructor(dataSource: LocalDataSource) {
    this.dataSource = dataSource;
  }

  async upsert(meta: LocalMeta): Promise<void> {
    this.dataSource.upsertLocalMeta(meta);
  }

  async findByPath(path: string): Promise<LocalMeta | null> {
    return this.dataSource.getLocalMetaByPath(path);
  }

  async findByType(type: LocalMetaType): Promise<LocalMeta[]> {
    return this.dataSource.getLocalMetaByType(type);
  }

  async findByParent(parentId: string): Promise<LocalMeta[]> {
    return this.dataSource.getLocalMetaByParent(parentId);
  }

  async findBySyncState(syncState: LocalMeta["syncState"]): Promise<LocalMeta[]> {
    return this.dataSource.getLocalMetaBySyncState(syncState);
  }

  async findAll(): Promise<LocalMeta[]> {
    return this.dataSource.getAllLocalMeta();
  }

  async delete(path: string): Promise<boolean> {
    return this.dataSource.deleteLocalMeta(path);
  }

  async indexDirectory(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) return;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await this.indexDirectory(fullPath);
      }

      const meta = this.dataSource.readMetaFile(fullPath);
      if (meta && meta.code && meta.type) {
        this.dataSource.upsertLocalMeta({
          path: path.relative(process.cwd(), fullPath),
          libelle: meta.libelle,
          code: meta.code,
          type: meta.type as LocalMetaType,
          parentId: meta.parentId,
          syncState: (meta.syncState as LocalMeta["syncState"]) || "local-only",
        });
      }
    }
  }
}
