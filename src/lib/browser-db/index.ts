/**
 * BrowserDb — Singleton SQLite-WASM + OPFS pour le navigateur.
 *
 * Stratégie de stockage :
 *  1. OPFS (Origin Private File System) — préféré, persistant, rapide
 *  2. In-memory — fallback si OPFS non disponible (Safari < 15.2)
 *
 * Initialisation asynchrone unique via `BrowserDb.init()`.
 * Toutes les méthodes doivent être appelées après `init()`.
 *
 * @module browser-db
 */

import { BROWSER_DB_SCHEMA } from "./schema";
import { importPayload } from "./importer";
import type { ImportPayload, ImportResult } from "./importer";

export type { ImportPayload, ImportResult };

/** Détecte si OPFS est disponible dans le browser courant. */
export function isOpfsAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    typeof (navigator.storage as unknown as { getDirectory?: unknown }).getDirectory === "function"
  );
}

/**
 * Détecte si SharedArrayBuffer est disponible.
 * Requis par SQLite-WASM pour son worker interne.
 * Nécessite COOP/COEP headers.
 */
export function isSharedArrayBufferAvailable(): boolean {
  return typeof SharedArrayBuffer !== "undefined";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqliteDb = any;

export class BrowserDb {
  private static instance: BrowserDb | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sqlite3: any = null;
  private db: SqliteDb = null;
  private initPromise: Promise<void> | null = null;
  private storageMode: "opfs" | "memory" = "memory";

  private constructor() {}

  static getInstance(): BrowserDb {
    if (!BrowserDb.instance) {
      BrowserDb.instance = new BrowserDb();
    }
    return BrowserDb.instance;
  }

  /**
   * Retourne `true` si la BDD est déjà initialisée.
   */
  isReady(): boolean {
    return this.db !== null;
  }

  /**
   * Retourne le mode de stockage actif après `init()`.
   */
  getStorageMode(): "opfs" | "memory" {
    return this.storageMode;
  }

  /**
   * Initialise SQLite-WASM et ouvre la base de données.
   * Idempotent — les appels suivants retournent la promesse existante.
   */
  async init(): Promise<void> {
    if (this.db !== null) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    // Import dynamique pour éviter l'exécution côté serveur Next.js
    const { default: sqlite3InitModule } = await import(
      "@sqlite.org/sqlite-wasm"
    );

    // sqlite3InitModule est typé sans argument selon la définition TS de @sqlite.org/sqlite-wasm
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initFn = sqlite3InitModule as any;
    this.sqlite3 = await initFn();

    const opfsAvailable = isOpfsAvailable() && isSharedArrayBufferAvailable();

    if (opfsAvailable && this.sqlite3.oo1.OpfsDb) {
      try {
        this.db = new this.sqlite3.oo1.OpfsDb(
          "/visionode-local.sqlite",
          "c", // create if not exists
        );
        this.storageMode = "opfs";
        console.info("[BrowserDb] Ouvert avec OPFS ✓");
      } catch (err) {
        console.warn("[BrowserDb] OPFS non disponible, fallback mémoire :", err);
        this.db = new this.sqlite3.oo1.DB(":memory:", "c");
        this.storageMode = "memory";
      }
    } else {
      this.db = new this.sqlite3.oo1.DB(":memory:", "c");
      this.storageMode = "memory";
      if (!opfsAvailable) {
        console.info(
          "[BrowserDb] OPFS non disponible — utilisation de la mémoire (données non persistantes entre sessions).",
        );
      }
    }

    this.applySchema();
  }

  /**
   * Applique le schéma SQL à la base ouverte.
   * Appel idempotent (utilise CREATE IF NOT EXISTS).
   */
  private applySchema(): void {
    if (!this.db) throw new Error("[BrowserDb] Non initialisé");

    // Exécute chaque statement SQL individuellement
    const statements = BROWSER_DB_SCHEMA.split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        this.db.exec(stmt);
      } catch (err) {
        // Ignore les erreurs non bloquantes (index déjà existant, etc.)
        console.warn("[BrowserDb] Schema stmt warning:", err, stmt.slice(0, 60));
      }
    }
  }

  /**
   * Importe un payload JSON dans la BDD locale.
   * Doit être appelé après `init()`.
   */
  import(payload: ImportPayload): ImportResult {
    if (!this.db) throw new Error("[BrowserDb] Non initialisé — appelez init() d'abord");
    return importPayload(this.db, payload);
  }

  /**
   * Exécute une requête SQL et retourne les résultats.
   */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
    if (!this.db) throw new Error("[BrowserDb] Non initialisé");
    const rows: T[] = [];
    this.db.exec({
      sql,
      bind: params ?? [],
      rowMode: "object",
      callback: (row: T) => {
        rows.push(row);
      },
    });
    return rows;
  }

  /**
   * Retourne le nombre de lignes d'une table.
   */
  count(table: string): number {
    if (!this.db) return 0;
    const rows = this.query<{ n: number }>(
      `SELECT COUNT(*) as n FROM ${table}`,
    );
    return rows[0]?.n ?? 0;
  }

  /**
   * Ferme la connexion à la base.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      BrowserDb.instance = null;
    }
  }
}

/** Helper — accès rapide au singleton. */
export const browserDb = BrowserDb.getInstance();
