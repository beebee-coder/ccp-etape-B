import {
  ProcedureSchema,
  TProcedure,
  TStep,
  validateProcedure,
} from "@/lib/procedures/services/validator.service";
import { createLogger } from "@/lib/logger";

const DRAFT_STORAGE_KEY = "nexaflow-procedure-draft";
const SYNC_DEBOUNCE_MS = 2000;
const syncTimers = new Map<string, number>();
const syncInProgress = new Map<string, Promise<boolean>>();
const draftCache = new Map<string, TProcedure>();
const log = createLogger({ module: "procedure-manager" });

export function createEmptyProcedure(): TProcedure {
  return {
    metadata: {
      title: "",
      code: "",
      description: "",
      category: "",
      priority: "moyenne",
      estimatedTimeMinutes: 1,
      requiredRoles: [],
      globalSafetyInstructions: [],
    },
    steps: [],
  };
}

export function addStep(procedure: TProcedure): TProcedure {
  const newStep: TStep = {
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    subtitle: "",
    instructions: "",
    type: "consigne_simple",
    isMandatory: false,
    dependencies: [],
    mediaRequirements: [],
    alarms: [],
    alarmCodes: [],
    attachments: [],
    order: procedure.steps.length,
    timerEnabled: false,
    timerSeconds: 0,
  };
  return {
    ...procedure,
    steps: [...procedure.steps, newStep],
  };
}

export function removeStep(procedure: TProcedure, stepId: string): TProcedure {
  return {
    ...procedure,
    steps: procedure.steps
      .filter((s) => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i })),
  };
}

export function duplicateStep(
  procedure: TProcedure,
  stepId: string,
): TProcedure {
  const idx = procedure.steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return procedure;
  const original = procedure.steps[idx];
  const clone: TStep = {
    ...original,
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: `${original.title} (copie)`,
    order: idx + 1,
  };
  const newSteps = [
    ...procedure.steps.slice(0, idx + 1),
    clone,
    ...procedure.steps.slice(idx + 1),
  ].map((s, i) => ({ ...s, order: i }));
  return { ...procedure, steps: newSteps };
}

export function reorderSteps(
  procedure: TProcedure,
  fromIndex: number,
  toIndex: number,
): TProcedure {
  const newSteps = [...procedure.steps];
  const [moved] = newSteps.splice(fromIndex, 1);
  newSteps.splice(toIndex, 0, moved);
  return {
    ...procedure,
    steps: newSteps.map((s, i) => ({ ...s, order: i })),
  };
}

export function updateStep(
  procedure: TProcedure,
  stepId: string,
  updates: Partial<TStep>,
): TProcedure {
  return {
    ...procedure,
    steps: procedure.steps.map((s) =>
      s.id === stepId ? { ...s, ...updates } : s,
    ),
  };
}

export function updateMetadata(
  procedure: TProcedure,
  metadata: Partial<TProcedure["metadata"]>,
): TProcedure {
  return {
    ...procedure,
    metadata: { ...procedure.metadata, ...metadata },
  };
}

export function exportToJson(procedure: TProcedure): string {
  return JSON.stringify(ProcedureSchema.parse(procedure), null, 2);
}

export function downloadJson(procedure: TProcedure, filename?: string): void {
  const json = exportToJson(procedure);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeCode = (procedure.metadata.code || "procedure")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 50);
  a.download = filename || `${safeCode}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function saveDraft(procedure: TProcedure): void {
  if (!isBrowser()) return;
  try {
    const draftKey =
      procedure.metadata.code.trim().length > 0
        ? `${DRAFT_STORAGE_KEY}:${procedure.metadata.code}`
        : DRAFT_STORAGE_KEY;

    const cached = draftCache.get(draftKey);
    if (cached && JSON.stringify(cached) === JSON.stringify(procedure)) {
      return;
    }

    const serialized = JSON.stringify(procedure);
    window.localStorage.setItem(draftKey, serialized);
    draftCache.set(draftKey, procedure);
    log.debug("saveDraft: draft saved to localStorage", {
      code: procedure.metadata.code || "<no-code>",
      stepCount: procedure.steps.length,
      key: draftKey,
    });
  } catch (error) {
    log.error("saveDraft: failed to save draft to localStorage", {
      code: procedure.metadata.code || "<no-code>",
      error,
    });
  }
}

export function loadDraft(): TProcedure | null {
  if (!isBrowser()) return null;
  try {
    const cachedDrafts = Array.from(draftCache.values());
    if (cachedDrafts.length > 0) {
      for (const draft of cachedDrafts) {
        try {
          validateProcedure(draft);
          log.info("loadDraft: draft loaded from memory cache", {
            code: draft.metadata.code,
            stepCount: draft.steps.length,
          });
          return draft;
        } catch {
          draftCache.delete(draft.metadata.code || DRAFT_STORAGE_KEY);
        }
      }
    }

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(`${DRAFT_STORAGE_KEY}:`)) continue;
      const candidateRaw = window.localStorage.getItem(key);
      if (!candidateRaw) continue;
      try {
        const parsed = JSON.parse(candidateRaw) as unknown;
        const draft = ProcedureSchema.parse(parsed);
        draftCache.set(key, draft);
        log.info("loadDraft: draft loaded from code-specific key", {
          code: draft.metadata.code,
          stepCount: draft.steps.length,
          key,
        });
        return draft;
      } catch {
        continue;
      }
    }

    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      const draft = ProcedureSchema.parse(parsed);
      draftCache.set(DRAFT_STORAGE_KEY, draft);
      log.info("loadDraft: draft loaded from generic localStorage key", {
        code: draft.metadata.code,
        stepCount: draft.steps.length,
      });
      return draft;
    }

    log.debug("loadDraft: no draft found in localStorage");
    return null;
  } catch (error) {
    log.warn("loadDraft: failed to parse localStorage draft", { error });
    return null;
  }
}

export function clearDraft(): void {
  if (!isBrowser()) return;
  try {
    draftCache.clear();
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(`${DRAFT_STORAGE_KEY}:`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    log.debug("clearDraft: draft cleared from localStorage", {
      clearedCount: keysToRemove.length + 1,
    });
  } catch (error) {
    log.error("clearDraft: failed to clear localStorage draft", { error });
  }
}

export async function syncWithServer(procedure: TProcedure): Promise<boolean> {
  const code = procedure.metadata.code;
  const stepCount = procedure.steps.length;
  log.info("syncWithServer: attempting to sync procedure to server", {
    code,
    stepCount,
  });

  const now = Date.now();
  const lastTime = syncTimers.get(code) || 0;
  if (now - lastTime < SYNC_DEBOUNCE_MS) {
    log.debug("syncWithServer: debounced, too soon since last sync", {
      code,
      elapsedMs: now - lastTime,
    });
    return false;
  }

  const existing = syncInProgress.get(code);
  if (existing) {
    log.debug("syncWithServer: sync already in progress, awaiting existing promise", { code });
    return existing;
  }

  const promise = (async (): Promise<boolean> => {
    try {
      const { apiClient } = await import("@/lib/api/client");
      await apiClient.post("/api/procedures", procedure);
      syncTimers.set(code, Date.now());
      log.info("syncWithServer: procedure synced to server successfully", {
        code,
        stepCount,
      });
      return true;
    } catch (error) {
      log.error("syncWithServer: failed to sync procedure to server", {
        code,
        stepCount,
        error,
      });
      return false;
    } finally {
      syncInProgress.delete(code);
    }
  })();

  syncInProgress.set(code, promise);
  return promise;
}

export async function loadFromServer(): Promise<TProcedure[]> {
  log.info("loadFromServer: fetching procedures from server");

  try {
    const { apiClient } = await import("@/lib/api/client");
    const procedures = await apiClient.get<TProcedure[]>("/api/procedures");
    log.info("loadFromServer: procedures fetched from server", {
      count: procedures.length,
    });
    return procedures;
  } catch (error) {
    log.error("loadFromServer: failed to fetch procedures from server", {
      error,
    });
    return [];
  }
}

export async function autoSync(procedure: TProcedure): Promise<boolean> {
  const code = procedure.metadata.code;
  const stepCount = procedure.steps.length;
  log.info("autoSync: starting auto-sync", { code, stepCount });

  saveDraft(procedure);
  log.debug("autoSync: draft saved to localStorage", { code, stepCount });

  const synced = await syncWithServer(procedure);
  if (synced) {
    log.info("autoSync: procedure synced to server", { code, stepCount });
  } else {
    log.warn("autoSync: server sync failed, procedure kept locally", {
      code,
      stepCount,
    });
  }
  return synced;
}
