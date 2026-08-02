import { ProcedureSchema, TProcedure, TStep } from "@/lib/procedures/services/validator.service";

const DRAFT_STORAGE_KEY = "nexaflow-procedure-draft";

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

export function duplicateStep(procedure: TProcedure, stepId: string): TProcedure {
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

export function reorderSteps(procedure: TProcedure, fromIndex: number, toIndex: number): TProcedure {
  const newSteps = [...procedure.steps];
  const [moved] = newSteps.splice(fromIndex, 1);
  newSteps.splice(toIndex, 0, moved);
  return {
    ...procedure,
    steps: newSteps.map((s, i) => ({ ...s, order: i })),
  };
}

export function updateStep(procedure: TProcedure, stepId: string, updates: Partial<TStep>): TProcedure {
  return {
    ...procedure,
    steps: procedure.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)),
  };
}

export function updateMetadata(procedure: TProcedure, metadata: Partial<TProcedure["metadata"]>): TProcedure {
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
  a.download = filename || `${procedure.metadata.code}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function saveDraft(procedure: TProcedure): void {
  if (!isBrowser()) return;
  try {
    const serialized = JSON.stringify(procedure);
    window.localStorage.setItem(DRAFT_STORAGE_KEY, serialized);
  } catch {
    // localStorage unavailable or quota exceeded
  }
}

export function loadDraft(): TProcedure | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return ProcedureSchema.parse(parsed);
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function syncWithServer(procedure: TProcedure): Promise<boolean> {
  try {
    const { apiClient } = await import("@/lib/api/client");
    await apiClient.post("/api/procedures", procedure);
    return true;
  } catch {
    return false;
  }
}

export async function loadFromServer(): Promise<TProcedure[]> {
  try {
    const { apiClient } = await import("@/lib/api/client");
    return await apiClient.get<TProcedure[]>("/api/procedures");
  } catch {
    return [];
  }
}

export async function autoSync(procedure: TProcedure): Promise<boolean> {
  saveDraft(procedure);
  return syncWithServer(procedure);
}
