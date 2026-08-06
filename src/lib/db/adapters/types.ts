export interface DbResult {
  rows: unknown[];
  rowCount: number;
}

export interface DbClient {
  query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
  release(): void;
}

export interface DbPool {
  connect(): Promise<DbClient>;
  end(): Promise<void>;
}

export interface DbAdapter {
  query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
  getPool(): DbPool;
  getClient(): Promise<DbClient>;
  closePool(): Promise<void>;
  checkConnection(): Promise<boolean>;
}
