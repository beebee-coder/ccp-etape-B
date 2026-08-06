import { LocalDataSource } from "../data-source";
import type { SyncQueueItem } from "@/lib/types/local-db";

export interface ISyncQueueRepository {
  enqueue(item: {
    operation: "create" | "update" | "delete";
    entity: string;
    entityId: string;
    data: Record<string, unknown>;
  }): Promise<void>;
  getPending(): Promise<SyncQueueItem[]>;
  markSynced(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  clearSynced(): Promise<void>;
  getStatus(): Promise<{ pending: number; synced: number; failed: number }>;
}

export class SyncQueueRepository implements ISyncQueueRepository {
  private dataSource: LocalDataSource;

  constructor(dataSource: LocalDataSource) {
    this.dataSource = dataSource;
  }

  async enqueue(item: {
    operation: "create" | "update" | "delete";
    entity: string;
    entityId: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    this.dataSource.enqueueSync(item);
  }

  async getPending(): Promise<SyncQueueItem[]> {
    return this.dataSource.getPendingSyncItems();
  }

  async markSynced(id: string): Promise<void> {
    this.dataSource.updateSyncItemStatus(id, "synced");
  }

  async markFailed(id: string, error: string): Promise<void> {
    this.dataSource.updateSyncItemStatus(id, "failed", error);
  }

  async clearSynced(): Promise<void> {
    this.dataSource.clearSyncedItems();
  }

  async getStatus(): Promise<{ pending: number; synced: number; failed: number }> {
    const manifest = this.dataSource.getSyncManifest();
    if (!manifest) {
      return { pending: 0, synced: 0, failed: 0 };
    }
    return {
      pending: manifest.pendingCount,
      synced: manifest.syncedCount,
      failed: manifest.failedCount,
    };
  }
}
