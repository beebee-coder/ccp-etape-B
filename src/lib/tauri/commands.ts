export interface TauriPullResult {
  pulled: Record<string, number>;
  failed: number;
  errors: string[];
  purged: boolean;
}

export interface TauriDbInfo {
  exists: boolean;
  path: string;
  size_bytes: number;
}

export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);
}

export async function tauriGetLocalDbPath(): Promise<string | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("get_local_db_path");
  } catch (err) {
    console.warn("Tauri invoke get_local_db_path fallback error:", err);
    return null;
  }
}

export async function tauriGetLocalDbInfo(): Promise<TauriDbInfo | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<TauriDbInfo>("get_local_db_info");
  } catch (err) {
    console.warn("Tauri invoke get_local_db_info fallback error:", err);
    return null;
  }
}

export async function tauriInitializeDatabase(): Promise<string | null> {
  if (!isTauriEnvironment()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("initialize_database");
  } catch (err) {
    console.warn("Tauri invoke initialize_database fallback error:", err);
    return null;
  }
}

export async function triggerBackgroundChromaIndex(): Promise<boolean> {
  if (!isTauriEnvironment()) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<boolean>("trigger_background_chroma_index");
  } catch (err) {
    console.warn("Tauri invoke trigger_background_chroma_index fallback error:", err);
    return false;
  }
}

export async function tauriPullAndPurge(apiUrl?: string): Promise<TauriPullResult> {
  if (!isTauriEnvironment()) {
    throw new Error("tauriPullAndPurge ne peut être exécuté qu'en environnement Tauri.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const targetUrl = apiUrl || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  return await invoke<TauriPullResult>("pull_and_purge", { apiUrl: targetUrl });
}

