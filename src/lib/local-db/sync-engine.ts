import { LocalDataSource } from "./data-source";
import type { SyncQueueItem } from "@/lib/types/local-db";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "sync-engine" });

export class SyncEngine {
  private static instance: SyncEngine | null = null;
  private dataSource: LocalDataSource;
  private isProcessing = false;
  private syncEndpoint: string;
  private recoveryAttempted = false;

  private constructor() {
    this.dataSource = LocalDataSource.getInstance();
    this.syncEndpoint = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/local-db/sync`
      : "/api/local-db/sync";
  }

  static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  async enqueue<T extends { id?: string }>(
    operation: "create" | "update" | "delete",
    entity: string,
    entityId: string,
    data: T,
  ): Promise<void> {
    this.dataSource.enqueueSync({
      operation,
      entity,
      entityId,
      data: data as Record<string, unknown>,
    });

    const manifest = this.dataSource.getSyncManifest();
    if (manifest) {
      this.dataSource.updateSyncManifest({
        pendingCount: manifest.pendingCount + 1,
      });
    }
  }

  async processQueue(): Promise<{ processed: number; failed: number }> {
    if (this.isProcessing) {
      return { processed: 0, failed: 0 };
    }

    await this.ensureRecovery();

    this.isProcessing = true;
    const startedAt = new Date().toISOString();
    this.dataSource.setSyncEngineState(true, startedAt);

    let processed = 0;
    let failed = 0;

    try {
      const pendingItems = this.dataSource.getPendingSyncItems();
      const failedItems = this.dataSource.getFailedSyncItems();

      const allItems = [...pendingItems, ...failedItems];

      for (const item of allItems) {
        try {
          await this.syncItem(item);
          this.dataSource.updateSyncItemStatus(item.id, "synced");
          processed++;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          this.dataSource.updateSyncItemStatus(item.id, "failed", message);
          failed++;
          log.warn("Sync item failed", {
            entity: item.entity,
            entityId: item.entityId,
            error: message,
          });
        }
      }

      this.dataSource.clearSyncedItems();

      const manifest = this.dataSource.getSyncManifest();
      if (manifest) {
        this.dataSource.updateSyncManifest({
          lastSync: new Date(),
          pendingCount: Math.max(0, manifest.pendingCount - processed),
          syncedCount: manifest.syncedCount + processed,
          failedCount: manifest.failedCount + failed,
        });
      }
    } finally {
      this.isProcessing = false;
      this.dataSource.setSyncEngineState(false);
      this.recoveryAttempted = false;
    }

    return { processed, failed };
  }

  private async ensureRecovery(): Promise<void> {
    if (this.recoveryAttempted) return;
    this.recoveryAttempted = true;

    const state = this.dataSource.getSyncEngineState();
    if (state?.isProcessing) {
      const failedAt = new Date(state.startedAt || Date.now());
      const staleThreshold = 5 * 60 * 1000;

      if (Date.now() - failedAt.getTime() > staleThreshold) {
        log.warn("SyncEngine: stale processing state detected, resetting", {
          startedAt: state.startedAt,
        });
        this.dataSource.setSyncEngineState(false);
      }
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    log.debug("Syncing item", {
      operation: item.operation,
      entity: item.entity,
      entityId: item.entityId,
    });

    try {
      const response = await fetch(this.syncEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Sync endpoint responded with ${response.status}: ${text}`);
      }
    } catch (error) {
      if (error instanceof TypeError && error.message === "fetch is not defined") {
        throw new Error("Sync endpoint unavailable in this environment");
      }
      throw error;
    }
  }

  getQueueStatus(): { pending: number; synced: number; failed: number } {
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
