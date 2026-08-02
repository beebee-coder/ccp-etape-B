import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProcedureExecution } from "../useProcedureExecution";
import { TProcedure } from "../services/validator.service";

const procedure: TProcedure = {
  metadata: {
    title: "Test Procedure",
    code: "TEST-001",
    category: "production",
    priority: "haute",
    estimatedTimeMinutes: 30,
    requiredRoles: ["technicien"],
    globalSafetyInstructions: [],
  },
  steps: [
    {
      id: "step_1",
      title: "Step One",
      instructions: "Do step 1",
      type: "consigne_simple",
      order: 0,
      timerEnabled: true,
      timerSeconds: 10,
    },
    {
      id: "step_2",
      title: "Step Two",
      instructions: "Do step 2",
      type: "consigne_simple",
      order: 1,
      timerEnabled: false,
      timerSeconds: 0,
    },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useProcedureExecution", () => {
  it("returns the correct initial phase", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    expect(result.current.phase).toBe("briefing");
  });

  it("returns the correct totalSteps count", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    expect(result.current.totalSteps).toBe(2);
  });

  it("returns null currentStep when procedure has no steps", () => {
    const emptyProcedure: TProcedure = {
      metadata: procedure.metadata,
      steps: [],
    };
    const { result } = renderHook(() => useProcedureExecution({ procedure: emptyProcedure }));
    expect(result.current.currentStep).toBeNull();
  });

  it("exposes timer controls", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    expect(typeof result.current.timer.start).toBe("function");
    expect(typeof result.current.timer.pause).toBe("function");
    expect(typeof result.current.timer.resume).toBe("function");
    expect(typeof result.current.timer.stop).toBe("function");
    expect(typeof result.current.timer.reset).toBe("function");
  });

  it("exposes action controls", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    expect(typeof result.current.actions.goToStep).toBe("function");
    expect(typeof result.current.actions.nextStep).toBe("function");
    expect(typeof result.current.actions.previousStep).toBe("function");
    expect(typeof result.current.actions.completeStep).toBe("function");
    expect(typeof result.current.actions.setPhase).toBe("function");
    expect(typeof result.current.actions.abort).toBe("function");
    expect(typeof result.current.actions.reset).toBe("function");
  });

  it("initializes context with currentStepIndex 0", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    expect(result.current.currentStepIndex).toBe(0);
  });

  it("initializes completedSteps as an empty Set", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    expect(result.current.completedSteps).toBeInstanceOf(Set);
    expect(result.current.completedSteps.size).toBe(0);
  });

  it("sorts steps by order", () => {
    const unsortedProcedure: TProcedure = {
      metadata: procedure.metadata,
      steps: [
        { ...procedure.steps[1], order: 1 },
        { ...procedure.steps[0], order: 0 },
      ],
    };
    const { result } = renderHook(() => useProcedureExecution({ procedure: unsortedProcedure }));
    expect(result.current.totalSteps).toBe(2);
    expect(result.current.currentStep?.id).toBe("step_1");
  });

  it("calls onComplete when all steps are finished", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useProcedureExecution({ procedure, onComplete }));
    act(() => {
      result.current.actions.nextStep();
    });
  });

  it("calls onAbort when abort is triggered", () => {
    const onAbort = vi.fn();
    const { result } = renderHook(() => useProcedureExecution({ procedure, onAbort }));
    act(() => {
      result.current.actions.abort("test reason");
    });
    expect(result.current.phase).toBe("aborted");
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it("resets state when reset is called", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    act(() => {
      result.current.actions.setPhase("executing");
    });
    act(() => {
      result.current.actions.reset();
    });
    expect(result.current.phase).toBe("briefing");
  });

  it("starts the step timer when timer.start is called", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    act(() => {
      result.current.timer.start();
    });
    expect(result.current.timer.isRunning).toBe(true);
  });

  it("pauses the timer when timer.pause is called", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    act(() => {
      result.current.timer.start();
    });
    act(() => {
      result.current.timer.pause();
    });
    expect(result.current.timer.isPaused).toBe(true);
  });

  it("stops the timer and resets stepRemaining", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    act(() => {
      result.current.timer.start();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    act(() => {
      result.current.timer.stop();
    });
  });

  it("resets timer to zero values", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    act(() => {
      result.current.timer.start();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    act(() => {
      result.current.timer.reset();
    });
  });

  it("navigates to a specific step index", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    act(() => {
      result.current.actions.goToStep(1);
    });
    expect(result.current.currentStepIndex).toBe(1);
  });

  it("goes to next step and marks previous as completed", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    act(() => {
      result.current.actions.nextStep();
    });
  });

  it("goes to previous step", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    act(() => {
      result.current.actions.goToStep(1);
    });
    act(() => {
      result.current.actions.previousStep();
    });
  });

  it("toggles step completion", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    act(() => {
      result.current.actions.completeStep("step_1");
    });
    expect(result.current.completedSteps.has("step_1")).toBe(true);
    act(() => {
      result.current.actions.completeStep("step_1");
    });
    expect(result.current.completedSteps.has("step_1")).toBe(false);
  });

  it("sets phase to a custom value", () => {
    const { result } = renderHook(() => useProcedureExecution({ procedure }));
    act(() => {
      result.current.actions.setPhase("executing");
    });
    expect(result.current.phase).toBe("executing");
  });
});