import { describe, it, expect } from "vitest";
import {
  validateProcedure,
  validateStep,
  hasCircularDependencies,
  getCompleteness,
  ProcedureSchema,
  StepSchema,
  PrioritySchema,
  StepTypeSchema,
  MediaTypeSchema,
  AlarmTypeSchema,
  type TProcedure,
  type TStep,
} from "../validator.service";

describe("validateProcedure", () => {
  it("parses a valid procedure", () => {
    const input = {
      metadata: {
        title: "Test Procedure",
        code: "TEST-001",
        description: "A test procedure",
        category: "production",
        priority: "haute",
        estimatedTimeMinutes: 30,
        requiredRoles: ["technicien"],
        globalSafetyInstructions: ["Wear PPE"],
      },
      steps: [
        {
          id: "step_1",
          title: "Step One",
          instructions: "Do something",
          type: "consigne_simple",
          order: 0,
        },
      ],
    };
    const result = validateProcedure(input);
    expect(result.metadata.title).toBe("Test Procedure");
    expect(result.steps).toHaveLength(1);
  });

  it("throws on missing metadata title", () => {
    expect(() =>
      validateProcedure({
        metadata: {
          title: "",
          code: "TEST-001",
          category: "production",
          priority: "basse",
          estimatedTimeMinutes: 10,
          requiredRoles: [],
          globalSafetyInstructions: [],
        },
        steps: [
          {
            id: "step_1",
            title: "Step One",
            instructions: "Do something",
            type: "consigne_simple",
            order: 0,
          },
        ],
      })
    ).toThrow();
  });

  it("throws when steps array is empty", () => {
    expect(() =>
      validateProcedure({
        metadata: {
          title: "Test",
          code: "TEST-002",
          category: "production",
          priority: "basse",
          estimatedTimeMinutes: 10,
          requiredRoles: [],
          globalSafetyInstructions: [],
        },
        steps: [],
      })
    ).toThrow();
  });
});

describe("validateStep", () => {
  it("parses a valid step", () => {
    const input = {
      id: "step_1",
      title: "Step One",
      instructions: "Do something",
      type: "consigne_simple",
      order: 0,
    };
    const result = validateStep(input);
    expect(result.title).toBe("Step One");
    expect(result.type).toBe("consigne_simple");
  });

  it("throws on missing title", () => {
    expect(() =>
      validateStep({
        id: "step_1",
        title: "",
        instructions: "Do something",
        type: "consigne_simple",
        order: 0,
      })
    ).toThrow();
  });

  it("throws on missing instructions", () => {
    expect(() =>
      validateStep({
        id: "step_1",
        title: "Step One",
        instructions: "",
        type: "consigne_simple",
        order: 0,
      })
    ).toThrow();
  });
});

describe("hasCircularDependencies", () => {
  it("returns false when there are no dependencies", () => {
    const steps: TStep[] = [
      { id: "a", title: "A", instructions: "Do A", type: "consigne_simple", order: 0 },
      { id: "b", title: "B", instructions: "Do B", type: "consigne_simple", order: 1 },
    ];
    expect(hasCircularDependencies(steps)).toBe(false);
  });

  it("returns false for a simple linear dependency chain", () => {
    const steps: TStep[] = [
      { id: "a", title: "A", instructions: "Do A", type: "consigne_simple", order: 0, dependencies: [] },
      { id: "b", title: "B", instructions: "Do B", type: "consigne_simple", order: 1, dependencies: ["a"] },
      { id: "c", title: "C", instructions: "Do C", type: "consigne_simple", order: 2, dependencies: ["b"] },
    ];
    expect(hasCircularDependencies(steps)).toBe(false);
  });

  it("returns true for a direct circular dependency", () => {
    const steps: TStep[] = [
      { id: "a", title: "A", instructions: "Do A", type: "consigne_simple", order: 0, dependencies: ["b"] },
      { id: "b", title: "B", instructions: "Do B", type: "consigne_simple", order: 1, dependencies: ["a"] },
    ];
    expect(hasCircularDependencies(steps)).toBe(true);
  });

  it("returns true for an indirect circular dependency", () => {
    const steps: TStep[] = [
      { id: "a", title: "A", instructions: "Do A", type: "consigne_simple", order: 0, dependencies: ["b"] },
      { id: "b", title: "B", instructions: "Do B", type: "consigne_simple", order: 1, dependencies: ["c"] },
      { id: "c", title: "C", instructions: "Do C", type: "consigne_simple", order: 2, dependencies: ["a"] },
    ];
    expect(hasCircularDependencies(steps)).toBe(true);
  });

  it("returns false when a step depends on a non-existent step (no cycle)", () => {
    const steps: TStep[] = [
      { id: "a", title: "A", instructions: "Do A", type: "consigne_simple", order: 0, dependencies: ["nonexistent"] },
    ];
    expect(hasCircularDependencies(steps)).toBe(false);
  });

  it("returns false for an empty steps array", () => {
    expect(hasCircularDependencies([])).toBe(false);
  });

  it("returns false for a self-dependency", () => {
    const steps: TStep[] = [
      { id: "a", title: "A", instructions: "Do A", type: "consigne_simple", order: 0, dependencies: ["a"] },
    ];
    expect(hasCircularDependencies(steps)).toBe(true);
  });
});

describe("getCompleteness", () => {
  it("returns 0 for an empty steps array", () => {
    expect(getCompleteness([])).toBe(0);
  });

  it("returns 100 when all steps are fully filled", () => {
    const steps: TStep[] = [
      { id: "a", title: "A", instructions: "Do A", type: "consigne_simple", order: 0 },
      { id: "b", title: "B", instructions: "Do B", type: "validation_securite", order: 1 },
    ];
    expect(getCompleteness(steps)).toBe(100);
  });

  it("returns 50 when half the steps are incomplete", () => {
    const steps: TStep[] = [
      { id: "a", title: "A", instructions: "Do A", type: "consigne_simple", order: 0 },
      { id: "b", title: "", instructions: "", type: "", order: 1 },
    ];
    expect(getCompleteness(steps)).toBe(50);
  });

  it("returns 0 when no steps have required fields", () => {
    const steps: TStep[] = [
      { id: "a", title: "", instructions: "", type: "", order: 0 },
      { id: "b", title: "", instructions: "", type: "", order: 1 },
    ];
    expect(getCompleteness(steps)).toBe(0);
  });
});

describe("Schema validations", () => {
  it("PrioritySchema accepts valid priorities", () => {
    expect(PrioritySchema.parse("basse")).toBe("basse");
    expect(PrioritySchema.parse("moyenne")).toBe("moyenne");
    expect(PrioritySchema.parse("haute")).toBe("haute");
    expect(PrioritySchema.parse("critique")).toBe("critique");
  });

  it("PrioritySchema rejects invalid priorities", () => {
    expect(() => PrioritySchema.parse("invalid")).toThrow();
  });

  it("StepTypeSchema accepts valid types", () => {
    expect(StepTypeSchema.parse("consigne_simple")).toBe("consigne_simple");
    expect(StepTypeSchema.parse("saisie_donnees")).toBe("saisie_donnees");
    expect(StepTypeSchema.parse("inspection_visuelle")).toBe("inspection_visuelle");
    expect(StepTypeSchema.parse("validation_securite")).toBe("validation_securite");
    expect(StepTypeSchema.parse("mesure_numerique")).toBe("mesure_numerique");
  });

  it("MediaTypeSchema accepts valid media types", () => {
    expect(MediaTypeSchema.parse("photo")).toBe("photo");
    expect(MediaTypeSchema.parse("video")).toBe("video");
    expect(MediaTypeSchema.parse("audio")).toBe("audio");
    expect(MediaTypeSchema.parse("signature")).toBe("signature");
  });

  it("AlarmTypeSchema accepts valid alarm types", () => {
    expect(AlarmTypeSchema.parse("DANGER")).toBe("DANGER");
    expect(AlarmTypeSchema.parse("WARNING")).toBe("WARNING");
    expect(AlarmTypeSchema.parse("INFO")).toBe("INFO");
    expect(AlarmTypeSchema.parse("SECURITY_CHECK")).toBe("SECURITY_CHECK");
  });
});