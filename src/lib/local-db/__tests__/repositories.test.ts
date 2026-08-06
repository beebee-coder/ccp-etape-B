import { describe, it, expect, beforeEach } from "vitest";
import { LocalDataSource } from "@/lib/local-db/data-source";
import { LocalMetaRepository } from "@/lib/local-db/repositories/local-meta.repository";
import type { LocalMeta } from "@/lib/types/local-db";

describe("LocalMetaRepository", () => {
  let dataSource: LocalDataSource;
  let repository: LocalMetaRepository;

  beforeEach(() => {
    dataSource = LocalDataSource.getInstance();
    repository = new LocalMetaRepository(dataSource);
  });

  it("should upsert and find by path", async () => {
    const meta: LocalMeta = {
      path: ".local-db/repo-test",
      libelle: "Repo Test",
      code: "REPO-TEST",
      type: "groupe",
      syncState: "local-only",
    };

    await repository.upsert(meta);
    const found = await repository.findByPath(".local-db/repo-test");

    expect(found).not.toBeNull();
    expect(found?.libelle).toBe("Repo Test");
  });

  it("should find by type", async () => {
    await repository.upsert({
      path: ".local-db/type-test-1",
      libelle: "Type Test 1",
      code: "TYPE-TEST-1",
      type: "groupe",
      syncState: "local-only",
    });

    await repository.upsert({
      path: ".local-db/type-test-2",
      libelle: "Type Test 2",
      code: "TYPE-TEST-2",
      type: "document",
      syncState: "local-only",
    });

    const groupes = await repository.findByType("groupe");
    const found = groupes.find((m) => m.code === "TYPE-TEST-1");
    expect(found).toBeDefined();
  });

  it("should find by sync state", async () => {
    await repository.upsert({
      path: ".local-db/sync-test",
      libelle: "Sync Test",
      code: "SYNC-TEST",
      type: "groupe",
      syncState: "synced",
    });

    const synced = await repository.findBySyncState("synced");
    const found = synced.find((m) => m.code === "SYNC-TEST");
    expect(found).toBeDefined();
  });

  it("should delete by path", async () => {
    await repository.upsert({
      path: ".local-db/delete-test",
      libelle: "Delete Test",
      code: "DELETE-TEST",
      type: "groupe",
      syncState: "local-only",
    });

    const deleted = await repository.delete(".local-db/delete-test");
    expect(deleted).toBe(true);

    const found = await repository.findByPath(".local-db/delete-test");
    expect(found).toBeNull();
  });
});
