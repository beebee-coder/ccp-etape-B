import { describe, it, expect, beforeEach } from "vitest";
import { LocalDataSource } from "@/lib/local-db/data-source";
import type { LocalMeta } from "@/lib/types/local-db";

describe("LocalDataSource", () => {
  let dataSource: LocalDataSource;

  beforeEach(() => {
    dataSource = LocalDataSource.getInstance();
  });

  it("should initialize schema", () => {
    const db = dataSource.getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("local_meta");
    expect(tableNames).toContain("sync_queue");
    expect(tableNames).toContain("sync_manifest");
  });

  it("should upsert and retrieve local meta", () => {
    const meta: LocalMeta = {
      path: ".local-db/Groupes/TURBINE VAPEUR",
      libelle: "TURBINE VAPEUR",
      code: "TURBINE VAPEUR",
      type: "groupe",
      syncState: "local-only",
    };

    dataSource.upsertLocalMeta(meta);
    const retrieved = dataSource.getLocalMetaByPath(".local-db/Groupes/TURBINE VAPEUR");

    expect(retrieved).not.toBeNull();
    expect(retrieved?.libelle).toBe("TURBINE VAPEUR");
    expect(retrieved?.code).toBe("TURBINE VAPEUR");
    expect(retrieved?.type).toBe("groupe");
  });

  it("should return null for missing path", () => {
    const retrieved = dataSource.getLocalMetaByPath(".local-db/does-not-exist");
    expect(retrieved).toBeNull();
  });

  it("should list all local meta", () => {
    dataSource.upsertLocalMeta({
      path: ".local-db/test-1",
      libelle: "Test 1",
      code: "TEST-1",
      type: "document",
      syncState: "local-only",
    });

    const all = dataSource.getAllLocalMeta();
    const found = all.find((m) => m.code === "TEST-1");
    expect(found).toBeDefined();
  });

  it("should delete local meta", () => {
    dataSource.upsertLocalMeta({
      path: ".local-db/test-delete",
      libelle: "Delete Me",
      code: "DELETE-ME",
      type: "document",
      syncState: "local-only",
    });

    const deleted = dataSource.deleteLocalMeta(".local-db/test-delete");
    expect(deleted).toBe(true);

    const retrieved = dataSource.getLocalMetaByPath(".local-db/test-delete");
    expect(retrieved).toBeNull();
  });

  it("should manage sync queue", () => {
    dataSource.enqueueSync({
      operation: "create",
      entity: "groupe",
      entityId: "TEST-1",
      data: { libelle: "Test" },
    });

    const pending = dataSource.getPendingSyncItems();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending[0].entity).toBe("groupe");
    expect(pending[0].entityId).toBe("TEST-1");
  });

  it("should manage sync manifest", () => {
    const manifest = dataSource.getSyncManifest();
    expect(manifest).not.toBeNull();
    expect(manifest?.version).toBe("1.0.0");

    dataSource.updateSyncManifest({ pendingCount: 5 });
    const updated = dataSource.getSyncManifest();
    expect(updated?.pendingCount).toBe(5);
  });

  it("should read and write meta files", () => {
    const dir = ".local-db/test-meta-dir";
    dataSource.ensureDirectory(dir);

    dataSource.writeMetaFile(dir, {
      libelle: "Test Meta",
      code: "TEST-META",
      type: "document",
      syncState: "local-only",
    });

    const meta = dataSource.readMetaFile(dir);
    expect(meta).not.toBeNull();
    expect(meta?.libelle).toBe("Test Meta");
    expect(meta?.code).toBe("TEST-META");
    expect(meta?.type).toBe("document");
  });
});
