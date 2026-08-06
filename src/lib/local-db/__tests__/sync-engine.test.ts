import { describe, it, expect, beforeEach } from "vitest";
import { SyncEngine } from "@/lib/local-db/sync-engine";
import { LocalDataSource } from "@/lib/local-db/data-source";

describe("SyncEngine", () => {
  let syncEngine: SyncEngine;
  let dataSource: LocalDataSource;

  beforeEach(() => {
    syncEngine = SyncEngine.getInstance();
    dataSource = LocalDataSource.getInstance();
  });

  it("should enqueue sync items", async () => {
    await syncEngine.enqueue("create", "groupe", "TEST-SYNC-1", {
      id: "TEST-SYNC-1",
      libelle: "Sync Test",
    } as { id?: string });

    const pending = dataSource.getPendingSyncItems();
    const found = pending.find((item) => item.entityId === "TEST-SYNC-1");
    expect(found).toBeDefined();
    expect(found?.operation).toBe("create");
  });

  it("should process queue", async () => {
    await syncEngine.enqueue("update", "groupe", "TEST-SYNC-2", {
      id: "TEST-SYNC-2",
      libelle: "Sync Test 2",
    } as { id?: string });

    const result = await syncEngine.processQueue();
    expect(result.failed).toBeGreaterThanOrEqual(1);
  });

  it("should return queue status", async () => {
    const status = syncEngine.getQueueStatus();
    expect(status).toHaveProperty("pending");
    expect(status).toHaveProperty("synced");
    expect(status).toHaveProperty("failed");
  });
});
