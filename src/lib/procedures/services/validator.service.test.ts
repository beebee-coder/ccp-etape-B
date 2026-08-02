import { describe, it, expect } from "vitest";
import {
  validateProcedure,
  validateStep,
  hasCircularDependencies,
  getCompleteness,
  PrioritySchema,
  StepTypeSchema,
  MediaTypeSchema,
  AlarmTypeSchema,
  MediaRequirementSchema,
  AlarmConfigSchema,
  StepSchema,
  MetadataSchema,
  ProcedureSchema,
  type TProcedure,
  type TStep,
} from "./validator.service";

function makeValidStep(overrides: Partial<TStep> = {}): TStep {
  return {
    id: "step_1",
    title: "Test step",
    subtitle: "Subtitle",
    instructions: "Do something",
    type: "consigne_simple",
    isMandatory: false,
    dependencies: [],
    mediaRequirements: [],
    alarms: [],
    attachments: [],
    order: 0,
    timerEnabled: false,
    timerSeconds: 0,
    ...overrides,
  };
}

function makeValidProcedure(overrides: Partial<TProcedure> = {}): TProcedure {
  return {
    metadata: {
      title: "Test procedure",
      code: "TEST-001",
      description: "A test procedure",
      category: "production",
      priority: "moyenne",
      estimatedTimeMinutes: 10,
      requiredRoles: ["technicien"],
      globalSafetyInstructions: ["Wear PPE"],
    },
    steps: [makeValidStep()],
    ...overrides,
  };
}

describe("validateStep", () => {
  it("validates a well-formed step", () => {
    const step = makeValidStep();
    const result = validateStep(step);
    expect(result.id).toBe("step_1");
    expect(result.title).toBe("Test step");
    expect(result.instructions).toBe("Do something");
    expect(result.type).toBe("consigne_simple");
    expect(result.isMandatory).toBe(false);
    expect(result.dependencies).toEqual([]);
    expect(result.order).toBe(0);
  });

  it("throws on missing title", () => {
    expect(() => validateStep(makeValidStep({ title: "" }))).toThrow(
      "Le titre de l'étape est requis"
    );
  });

  it("throws on missing instructions", () => {
    expect(() => validateStep(makeValidStep({ instructions: "" }))).toThrow(
      "Les instructions sont requises"
    );
  });

  it("throws on missing id", () => {
    expect(() => validateStep(makeValidStep({ id: "" }))).toThrow();
  });

  it("throws on negative order", () => {
    expect(() => validateStep(makeValidStep({ order: -1 }))).toThrow();
  });

  it("throws on invalid step type", () => {
    expect(() => validateStep(makeValidStep({ type: "invalid" as never }))).toThrow();
  });

  it("applies default values for optional fields", () => {
    const step = {
      id: "step_1",
      title: "Test",
      instructions: "Do something",
      type: "consigne_simple",
      order: 0,
    };
    const result = validateStep(step);
    expect(result.isMandatory).toBe(false);
    expect(result.dependencies).toEqual([]);
    expect(result.mediaRequirements).toEqual([]);
    expect(result.alarms).toEqual([]);
    expect(result.attachments).toEqual([]);
    expect(result.timerEnabled).toBe(false);
    expect(result.timerSeconds).toBe(0);
  });

  it("validates negative timerSeconds as invalid", () => {
    expect(() => validateStep(makeValidStep({ timerSeconds: -5 }))).toThrow();
  });
});

describe("validateProcedure", () => {
  it("validates a well-formed procedure", () => {
    const procedure = makeValidProcedure();
    const result = validateProcedure(procedure);
    expect(result.metadata.code).toBe("TEST-001");
    expect(result.steps.length).toBe(1);
  });

  it("throws on missing title in metadata", () => {
    const proc = makeValidProcedure();
    proc.metadata.title = "";
    expect(() => validateProcedure(proc)).toThrow("Le titre est requis");
  });

  it("throws on missing code in metadata", () => {
    const proc = makeValidProcedure();
    proc.metadata.code = "";
    expect(() => validateProcedure(proc)).toThrow("Le code/référence est requis");
  });

  it("throws on missing category in metadata", () => {
    const proc = makeValidProcedure();
    proc.metadata.category = "";
    expect(() => validateProcedure(proc)).toThrow("La catégorie est requise");
  });

  it("throws on invalid priority", () => {
    const proc = makeValidProcedure();
    proc.metadata.priority = "invalid" as never;
    expect(() => validateProcedure(proc)).toThrow();
  });

  it("throws when estimatedTimeMinutes is less than 1", () => {
    const proc = makeValidProcedure();
    proc.metadata.estimatedTimeMinutes = 0;
    expect(() => validateProcedure(proc)).toThrow();
  });

  it("throws when steps array is empty", () => {
    const proc = makeValidProcedure({ steps: [] });
    expect(() => validateProcedure(proc)).toThrow("Au moins une étape est requise");
  });

  it("throws when requiredRoles is missing", () => {
    const proc = makeValidProcedure();
    // @ts-expect-error intentionally omitting required field
    delete proc.metadata.requiredRoles;
    expect(() => validateProcedure(proc)).toThrow();
  });

  it("throws when globalSafetyInstructions is missing", () => {
    const proc = makeValidProcedure();
    // @ts-expect-error intentionally omitting field
    delete proc.metadata.globalSafetyInstructions;
    expect(() => validateProcedure(proc)).toThrow();
  });

  it("validates procedures from mock data", async () => {
    const { mockProcedures } = await import("../mock-data");
    for (const proc of mockProcedures) {
      expect(() => validateProcedure(proc)).not.toThrow();
    }
  });
});

describe("hasCircularDependencies", () => {
  it("returns false for linear dependencies", () => {
    const steps = [
      makeValidStep({ id: "a", dependencies: [] }),
      makeValidStep({ id: "b", dependencies: ["a"] }),
      makeValidStep({ id: "c", dependencies: ["b"] }),
    ];
    expect(hasCircularDependencies(steps)).toBe(false);
  });

  it("returns false for no dependencies", () => {
    const steps = [
      makeValidStep({ id: "a", dependencies: [] }),
      makeValidStep({ id: "b", dependencies: [] }),
    ];
    expect(hasCircularDependencies(steps)).toBe(false);
  });

  it("returns true for simple cycle a -> b -> a", () => {
    const steps = [
      makeValidStep({ id: "a", dependencies: ["b"] }),
      makeValidStep({ id: "b", dependencies: ["a"] }),
    ];
    expect(hasCircularDependencies(steps)).toBe(true);
  });

  it("returns true for self-referencing dependency", () => {
    const steps = [makeValidStep({ id: "a", dependencies: ["a"] })];
    expect(hasCircularDependencies(steps)).toBe(true);
  });

  it("returns true for longer cycle a -> b -> c -> a", () => {
    const steps = [
      makeValidStep({ id: "a", dependencies: ["c"] }),
      makeValidStep({ id: "b", dependencies: ["a"] }),
      makeValidStep({ id: "c", dependencies: ["b"] }),
    ];
    expect(hasCircularDependencies(steps)).toBe(true);
  });

  it("returns false for diamond (non-circular) dependencies", () => {
    const steps = [
      makeValidStep({ id: "a", dependencies: [] }),
      makeValidStep({ id: "b", dependencies: ["a"] }),
      makeValidStep({ id: "c", dependencies: ["a"] }),
      makeValidStep({ id: "d", dependencies: ["b", "c"] }),
    ];
    expect(hasCircularDependencies(steps)).toBe(false);
  });

  it("returns false for empty steps", () => {
    expect(hasCircularDependencies([])).toBe(false);
  });

  it("handles dependencies referencing unknown steps", () => {
    const steps = [
      makeValidStep({ id: "a", dependencies: ["nonexistent"] }),
    ];
    expect(hasCircularDependencies(steps)).toBe(false);
  });
});

describe("getCompleteness", () => {
  it("returns 100 for fully filled steps", () => {
    const steps = [
      makeValidStep({ id: "a" }),
      makeValidStep({ id: "b" }),
    ];
    expect(getCompleteness(steps)).toBe(100);
  });

  it("returns 0 for empty steps array", () => {
    expect(getCompleteness([])).toBe(0);
  });

  it("returns 0 for steps with empty title", () => {
    const steps = [makeValidStep({ id: "a", title: "" })];
    expect(getCompleteness(steps)).toBe(0);
  });

  it("returns 0 for steps with empty instructions", () => {
    const steps = [makeValidStep({ id: "a", instructions: "" })];
    expect(getCompleteness(steps)).toBe(0);
  });

  it("returns 0 for steps with empty type", () => {
    const steps = [
      makeValidStep({ id: "a", type: "" as never }),
    ];
    expect(getCompleteness(steps)).toBe(0);
  });

  it("calculates partial completeness correctly", () => {
    const steps = [
      makeValidStep({ id: "a" }),
      makeValidStep({ id: "b", title: "" }),
    ];
    expect(getCompleteness(steps)).toBe(50);
  });

  it("handles whitespace-only fields as incomplete", () => {
    const steps = [makeValidStep({ id: "a", title: "  ", instructions: "  " })];
    expect(getCompleteness(steps)).toBe(0);
  });

  it("rounds to nearest integer", () => {
    const steps = [
      makeValidStep({ id: "a" }),
      makeValidStep({ id: "b", title: "" }),
      makeValidStep({ id: "c", title: "" }),
    ];
    expect(getCompleteness(steps)).toBe(33);
  });
});

describe("zod schemas", () => {
  it("PrioritySchema accepts all valid values", () => {
    expect(PrioritySchema.parse("basse")).toBe("basse");
    expect(PrioritySchema.parse("moyenne")).toBe("moyenne");
    expect(PrioritySchema.parse("haute")).toBe("haute");
    expect(PrioritySchema.parse("critique")).toBe("critique");
  });

  it("StepTypeSchema accepts all valid values", () => {
    expect(StepTypeSchema.parse("consigne_simple")).toBe("consigne_simple");
    expect(StepTypeSchema.parse("saisie_donnees")).toBe("saisie_donnees");
    expect(StepTypeSchema.parse("inspection_visuelle")).toBe("inspection_visuelle");
    expect(StepTypeSchema.parse("validation_securite")).toBe("validation_securite");
    expect(StepTypeSchema.parse("mesure_numerique")).toBe("mesure_numerique");
  });

  it("MediaTypeSchema accepts all valid values", () => {
    expect(MediaTypeSchema.parse("photo")).toBe("photo");
    expect(MediaTypeSchema.parse("video")).toBe("video");
    expect(MediaTypeSchema.parse("audio")).toBe("audio");
    expect(MediaTypeSchema.parse("signature")).toBe("signature");
  });

  it("AlarmTypeSchema accepts all valid values", () => {
    expect(AlarmTypeSchema.parse("DANGER")).toBe("DANGER");
    expect(AlarmTypeSchema.parse("WARNING")).toBe("WARNING");
    expect(AlarmTypeSchema.parse("INFO")).toBe("INFO");
    expect(AlarmTypeSchema.parse("SECURITY_CHECK")).toBe("SECURITY_CHECK");
  });

  it("MediaRequirementSchema defaults mandatory and options", () => {
    const result = MediaRequirementSchema.parse({ type: "photo" });
    expect(result.mandatory).toBe(false);
    expect(result.options).toBeUndefined();
  });

  it("MediaRequirementSchema preserves provided options with defaults", () => {
    const result = MediaRequirementSchema.parse({
      type: "photo",
      mandatory: true,
      options: { geolocation: true },
    });
    expect(result.mandatory).toBe(true);
    expect(result.options?.geolocation).toBe(true);
    expect(result.options?.timestamp).toBe(false);
  });

  it("AlarmConfigSchema requires condition and message", () => {
    expect(() =>
      AlarmConfigSchema.parse({ type: "DANGER", message: "" })
    ).toThrow();
    expect(() =>
      AlarmConfigSchema.parse({ condition: "", type: "DANGER", message: "msg" })
    ).toThrow();
  });

  it("StepSchema requires id and order >= 0", () => {
    const base = { title: "T", instructions: "I", type: "consigne_simple", order: 0 };
    expect(() => StepSchema.parse({ ...base, id: "" })).toThrow();
    expect(() => StepSchema.parse({ ...base, id: "x", order: -1 })).toThrow();
  });

  it("MetadataSchema requires all fields", () => {
    const base = {
      title: "T",
      code: "C",
      category: "production",
      priority: "haute" as const,
      estimatedTimeMinutes: 5,
      requiredRoles: [],
      globalSafetyInstructions: [],
    };
    expect(() => MetadataSchema.parse(base)).not.toThrow();
    expect(() => MetadataSchema.parse({ ...base, title: "" })).toThrow();
  });

  it("ProcedureSchema requires at least one step", () => {
    expect(() => ProcedureSchema.parse({ metadata: makeValidProcedure().metadata, steps: [] })).toThrow();
  });
});
