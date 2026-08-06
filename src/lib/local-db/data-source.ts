import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { getSqlitePath } from "@/lib/db/adapters/sqlite";
import { LOCAL_FIRST_SCHEMA } from "./schema";
import type {
  LocalMeta,
  SyncQueueItem,
  SyncManifest,
} from "@/lib/types/local-db";
import {
  LocalMetaSchema,
  SyncQueueItemSchema,
  SyncManifestSchema,
} from "@/lib/types/local-db";

export class LocalDataSource {
  private static instance: LocalDataSource | null = null;
  private db: Database.Database | null = null;

  private constructor() {}

  static getInstance(): LocalDataSource {
    if (!LocalDataSource.instance) {
      LocalDataSource.instance = new LocalDataSource();
    }
    return LocalDataSource.instance;
  }

  getDb(): Database.Database {
    if (!this.db) {
      const dbPath = getSqlitePath();
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(dbPath);
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("foreign_keys = ON");
      this.registerFunctions();
      this.initializeSchema();
    }
    return this.db;
  }

  private registerFunctions(): void {
    this.db!.function("uuid_generate_v4", () => {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      const bytes = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    });
  }

  private initializeSchema(): void {
    const statements = LOCAL_FIRST_SCHEMA.split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        this.db!.exec(stmt);
      } catch (error) {
        console.error(
          "Failed to execute local-first schema statement:",
          error,
          stmt,
        );
      }
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  readMetaFile(
    fullPath: string,
  ): {
    libelle: string;
    code: string;
    type: string;
    parentId?: string;
    syncState?: string;
  } | null {
    const metaPath = path.join(fullPath, ".meta.json");
    try {
      if (fs.existsSync(metaPath) && fs.statSync(metaPath).isFile()) {
        const content = fs.readFileSync(metaPath, "utf-8");
        return JSON.parse(content);
      }
    } catch {
      // ignore invalid meta files
    }
    return null;
  }

  writeMetaFile(
    fullPath: string,
    meta: {
      libelle: string;
      code: string;
      type: string;
      parentId?: string;
      syncState?: string;
    },
  ): void {
    const metaPath = path.join(fullPath, ".meta.json");
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
  }

  rowToLocalMeta(row: Record<string, unknown>): LocalMeta {
    return LocalMetaSchema.parse({
      path: row.path as string,
      libelle: row.libelle as string,
      code: row.code as string,
      type: row.type as LocalMeta["type"],
      parentId: row.parent_id ? (row.parent_id as string) : undefined,
      syncState: (row.sync_state as LocalMeta["syncState"]) || "local-only",
      lastSyncAt: row.last_sync_at
        ? new Date(row.last_sync_at as string)
        : undefined,
      description: row.description ? (row.description as string) : undefined,
      tags: row.tags ? JSON.parse(row.tags as string) : [],
      metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
    });
  }

  rowToSyncQueueItem(row: Record<string, unknown>): SyncQueueItem {
    return SyncQueueItemSchema.parse({
      id: row.id as string,
      operation: row.operation as SyncQueueItem["operation"],
      entity: row.entity as string,
      entityId: row.entity_id as string,
      data: row.data ? JSON.parse(row.data as string) : {},
      timestamp: row.timestamp as string,
      status: (row.status as SyncQueueItem["status"]) || "pending",
      retryCount: (row.retry_count as number) || 0,
      lastError: row.last_error ? (row.last_error as string) : undefined,
    });
  }

  rowToSyncManifest(row: Record<string, unknown>): SyncManifest {
    return SyncManifestSchema.parse({
      version: row.version as string,
      lastSync: row.last_sync ? new Date(row.last_sync as string) : undefined,
      pendingCount: (row.pending_count as number) || 0,
      syncedCount: (row.synced_count as number) || 0,
      failedCount: (row.failed_count as number) || 0,
    });
  }

  upsertLocalMeta(meta: LocalMeta): void {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO local_meta (path, libelle, code, type, parent_id, sync_state, last_sync_at, description, tags, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        libelle = excluded.libelle,
        code = excluded.code,
        type = excluded.type,
        parent_id = excluded.parent_id,
        sync_state = excluded.sync_state,
        last_sync_at = excluded.last_sync_at,
        description = excluded.description,
        tags = excluded.tags,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(
      meta.path || meta.code,
      meta.libelle,
      meta.code,
      meta.type,
      meta.parentId || null,
      meta.syncState,
      meta.lastSyncAt ? meta.lastSyncAt.toISOString() : null,
      meta.description || null,
      JSON.stringify(meta.tags || []),
      JSON.stringify(meta.metadata || {}),
    );
  }

  getLocalMetaByPath(path: string): LocalMeta | null {
    const db = this.getDb();
    const stmt = db.prepare("SELECT * FROM local_meta WHERE path = ?");
    const row = stmt.get(path) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToLocalMeta(row);
  }

  getLocalMetaByType(type: LocalMeta["type"]): LocalMeta[] {
    const db = this.getDb();
    const stmt = db.prepare(
      "SELECT * FROM local_meta WHERE type = ? ORDER BY created_at ASC",
    );
    return stmt
      .all(type)
      .map((row) => this.rowToLocalMeta(row as Record<string, unknown>));
  }

  getLocalMetaByParent(parentId: string): LocalMeta[] {
    const db = this.getDb();
    const stmt = db.prepare(
      "SELECT * FROM local_meta WHERE parent_id = ? ORDER BY created_at ASC",
    );
    return stmt
      .all(parentId)
      .map((row) => this.rowToLocalMeta(row as Record<string, unknown>));
  }

  getLocalMetaBySyncState(syncState: LocalMeta["syncState"]): LocalMeta[] {
    const db = this.getDb();
    const stmt = db.prepare(
      "SELECT * FROM local_meta WHERE sync_state = ? ORDER BY created_at ASC",
    );
    return stmt
      .all(syncState)
      .map((row) => this.rowToLocalMeta(row as Record<string, unknown>));
  }

  getAllLocalMeta(): LocalMeta[] {
    const db = this.getDb();
    const stmt = db.prepare("SELECT * FROM local_meta ORDER BY created_at ASC");
    return stmt
      .all()
      .map((row) => this.rowToLocalMeta(row as Record<string, unknown>));
  }

  deleteLocalMeta(path: string): boolean {
    const db = this.getDb();
    const stmt = db.prepare("DELETE FROM local_meta WHERE path = ?");
    const result = stmt.run(path);
    return result.changes > 0;
  }

  upsertKnowledgeItem(item: {
    id: string;
    user_id: string;
    type: string;
    title: string;
    question: string | null;
    answer: string | null;
    tags: string[];
    category: string | null;
    content: string | null;
    synced: number;
    vectorized: number;
  }): void {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO knowledge_items (id, user_id, type, title, question, answer, tags, category, content, created_at, updated_at, synced, vectorized)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        type = excluded.type,
        title = excluded.title,
        question = excluded.question,
        answer = excluded.answer,
        tags = excluded.tags,
        category = excluded.category,
        content = excluded.content,
        updated_at = datetime('now'),
        synced = excluded.synced,
        vectorized = excluded.vectorized
    `);
    stmt.run(
      item.id,
      item.user_id,
      item.type,
      item.title,
      item.question,
      item.answer,
      JSON.stringify(item.tags),
      item.category,
      item.content,
      item.synced,
      item.vectorized,
    );
  }

  getKnowledgeItemById(id: string): Record<string, unknown> | null {
    const db = this.getDb();
    const stmt = db.prepare("SELECT * FROM knowledge_items WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row || null;
  }

  getAllKnowledgeItems(): Record<string, unknown>[] {
    const db = this.getDb();
    const stmt = db.prepare(
      "SELECT * FROM knowledge_items ORDER BY created_at DESC",
    );
    return stmt.all() as Record<string, unknown>[];
  }

  deleteKnowledgeItem(id: string): boolean {
    const db = this.getDb();
    const stmt = db.prepare("DELETE FROM knowledge_items WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  enqueueSync(item: {
    operation: "create" | "update" | "delete";
    entity: string;
    entityId: string;
    data: Record<string, unknown>;
  }): void {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO sync_queue (operation, entity, entity_id, data, timestamp, status, retry_count, last_error)
      VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL)
    `);
    stmt.run(
      item.operation,
      item.entity,
      item.entityId,
      JSON.stringify(item.data),
      new Date().toISOString(),
    );
  }

  getPendingSyncItems(): SyncQueueItem[] {
    const db = this.getDb();
    const stmt = db.prepare(
      "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY timestamp ASC",
    );
    return stmt
      .all()
      .map((row) => this.rowToSyncQueueItem(row as Record<string, unknown>));
  }

  updateSyncItemStatus(
    id: string,
    status: "synced" | "failed",
    lastError?: string,
  ): void {
    const db = this.getDb();
    const stmt = db.prepare(`
      UPDATE sync_queue SET status = ?, retry_count = retry_count + 1, last_error = ?
      WHERE id = ?
    `);
    stmt.run(status, lastError || null, id);
  }

  clearSyncedItems(): void {
    const db = this.getDb();
    db.prepare("DELETE FROM sync_queue WHERE status = 'synced'").run();
  }

  getSyncManifest(): SyncManifest | null {
    const db = this.getDb();
    const stmt = db.prepare("SELECT * FROM sync_manifest WHERE id = 1");
    const row = stmt.get() as Record<string, unknown> | undefined;
    if (!row) {
      db.prepare(
        `
        INSERT INTO sync_manifest (id, version, last_sync, pending_count, synced_count, failed_count)
        VALUES (1, '1.0.0', NULL, 0, 0, 0)
      `,
      ).run();
      return {
        version: "1.0.0",
        lastSync: undefined,
        pendingCount: 0,
        syncedCount: 0,
        failedCount: 0,
      };
    }
    return this.rowToSyncManifest(row);
  }

  updateSyncManifest(manifest: Partial<SyncManifest>): void {
    const db = this.getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (manifest.version !== undefined) {
      updates.push("version = ?");
      values.push(manifest.version);
    }
    if (manifest.lastSync !== undefined) {
      updates.push("last_sync = ?");
      values.push(manifest.lastSync.toISOString());
    }
    if (manifest.pendingCount !== undefined) {
      updates.push("pending_count = ?");
      values.push(manifest.pendingCount);
    }
    if (manifest.syncedCount !== undefined) {
      updates.push("synced_count = ?");
      values.push(manifest.syncedCount);
    }
    if (manifest.failedCount !== undefined) {
      updates.push("failed_count = ?");
      values.push(manifest.failedCount);
    }

    if (updates.length > 0) {
      values.push(1);
      db.prepare(
        `UPDATE sync_manifest SET ${updates.join(", ")} WHERE id = ?`,
      ).run(...values);
    }
  }
}
