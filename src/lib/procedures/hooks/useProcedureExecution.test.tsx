/// <reference types="vitest/globals" />
import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { useProcedureExecution } from "./useProcedureExecution";
import { mockProcedures } from "../mock-data";
import { TProcedure } from "../services/validator.service";

const testProcedure: TProcedure = mockProcedures[0];

describe("useProcedureExecution", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("starts in briefing phase", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      expect(result.current.phase).toBe("briefing");
    });

    it("has currentStep as first step sorted by order", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      const sorted = [...testProcedure.steps].sort((a, b) => a.order - b.order);
      expect(result.current.currentStep).toEqual(sorted[0]);
      expect(result.current.currentStepIndex).toBe(0);
    });

    it("reports correct total steps", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      expect(result.current.totalSteps).toBe(testProcedure.steps.length);
    });

    it("starts with no completed steps", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      expect(result.current.completedSteps.size).toBe(0);
    });

    it("timer starts stopped", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      expect(result.current.timer.isRunning).toBe(false);
      expect(result.current.timer.isPaused).toBe(false);
      expect(result.current.timer.stepRemaining).toBe(0);
      expect(result.current.timer.globalElapsed).toBe(0);
    });

    it("initializes context with startedAt", () => {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      expect(result.current.context.startedAt).toBe(Date.now());
    });
  });

  describe("timer start/pause/resume/stop", () => {
    it("starts timer when start is called", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.timer.start());
      expect(result.current.timer.isRunning).toBe(true);
      expect(result.current.timer.isPaused).toBe(false);
    });

    it("pauses timer", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.timer.start());
      act(() => result.current.timer.pause());
      expect(result.current.timer.isRunning).toBe(true);
      expect(result.current.timer.isPaused).toBe(true);
    });

    it("resumes timer from paused state", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.timer.start());
      act(() => result.current.timer.pause());
      act(() => result.current.timer.resume());
      expect(result.current.timer.isRunning).toBe(true);
      expect(result.current.timer.isPaused).toBe(false);
    });

    it("stops timer and resets step remaining", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.timer.start());
      act(() => vi.advanceTimersByTime(5000));
      act(() => result.current.timer.stop());
      expect(result.current.timer.isRunning).toBe(false);
      expect(result.current.timer.isPaused).toBe(false);
      expect(result.current.timer.stepRemaining).toBe(0);
    });

    it("resets timer and global elapsed", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.timer.start());
      act(() => vi.advanceTimersByTime(10000));
      act(() => result.current.timer.reset());
      expect(result.current.timer.isRunning).toBe(false);
      expect(result.current.timer.isPaused).toBe(false);
      expect(result.current.timer.stepRemaining).toBe(0);
      expect(result.current.timer.globalElapsed).toBe(0);
    });
  });

  describe("step timer countdown", () => {
    it("counts down step timer", () => {
      const singleStepProcedure: TProcedure = {
        metadata: {
          ...testProcedure.metadata,
          code: "SINGLE-001",
        },
        steps: [
          { ...testProcedure.steps[0], timerEnabled: true, timerSeconds: 10 },
        ],
      };
      const { result } = renderHook(() =>
        useProcedureExecution({ procedure: singleStepProcedure })
      );
      act(() => result.current.timer.start());
      expect(result.current.timer.stepRemaining).toBe(10);
      act(() => vi.advanceTimersByTime(3000));
      expect(result.current.timer.stepRemaining).toBe(7);
      act(() => vi.advanceTimersByTime(5000));
      expect(result.current.timer.stepRemaining).toBe(2);
    });

    it("adds anomaly when step timer expires", () => {
      const singleStepProcedure: TProcedure = {
        metadata: {
          ...testProcedure.metadata,
          code: "SINGLE-001",
        },
        steps: [
          { ...testProcedure.steps[0], timerEnabled: true, timerSeconds: 3 },
        ],
      };
      const { result } = renderHook(() =>
        useProcedureExecution({ procedure: singleStepProcedure })
      );
      act(() => result.current.timer.start());
      act(() => vi.advanceTimersByTime(3000));
      expect(result.current.context.anomalies).toContain(
        `Temps écoulé pour l'étape: ${testProcedure.steps[0].title}`
      );
      expect(result.current.timer.stepRemaining).toBe(0);
      expect(result.current.timer.isRunning).toBe(false);
    });

    it("increments global elapsed over time", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.timer.start());
      act(() => vi.advanceTimersByTime(5000));
      expect(result.current.timer.globalElapsed).toBe(5);
    });

    it("does not count down when paused", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.timer.start());
      act(() => result.current.timer.pause());
      act(() => vi.advanceTimersByTime(5000));
      expect(result.current.timer.globalElapsed).toBe(0);
    });

    it("does not start step timer when step has no timer", () => {
      const noTimerProcedure: TProcedure = {
        metadata: {
          ...testProcedure.metadata,
          code: "NO-TIMER-001",
        },
        steps: [
          { ...testProcedure.steps[0], timerEnabled: false, timerSeconds: 0, id: "no_timer_step" },
        ],
      };
      const { result } = renderHook(() =>
        useProcedureExecution({ procedure: noTimerProcedure })
      );
      act(() => result.current.timer.start());
      expect(result.current.timer.stepRemaining).toBe(0);
      expect(result.current.timer.isRunning).toBe(true);
    });
  });

  describe("phase transitions", () => {
    it("goToStep sets phase to executing", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.actions.goToStep(2));
      expect(result.current.phase).toBe("executing");
      expect(result.current.currentStepIndex).toBe(2);
    });

    it("goToStep ignores out-of-bounds index", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.actions.goToStep(999));
      expect(result.current.phase).toBe("briefing");
      expect(result.current.currentStepIndex).toBe(0);
      act(() => result.current.actions.goToStep(-1));
      expect(result.current.phase).toBe("briefing");
      expect(result.current.currentStepIndex).toBe(0);
    });

    it("nextStep advances to next step and marks current as completed", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.actions.goToStep(0));
      act(() => result.current.actions.nextStep());
      expect(result.current.currentStepIndex).toBe(1);
      expect(result.current.completedSteps.has(testProcedure.steps[0].id)).toBe(true);
    });

    it("nextStep on last step sets phase to completed and calls onComplete", () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() =>
        useProcedureExecution({ procedure: testProcedure, onComplete })
      );
      const lastIndex = testProcedure.steps.length - 1;
      act(() => result.current.actions.goToStep(lastIndex));
      act(() => result.current.actions.nextStep());
      expect(result.current.phase).toBe("completed");
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(result.current.context);
    });

    it("previousStep decrements step index", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.actions.goToStep(2));
      act(() => result.current.actions.previousStep());
      expect(result.current.currentStepIndex).toBe(1);
    });

    it("previousStep does nothing at index 0", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.actions.previousStep());
      expect(result.current.currentStepIndex).toBe(0);
    });

    it("abort sets phase to aborted and calls onAbort with reason", () => {
      const onAbort = vi.fn();
      const { result } = renderHook(() =>
        useProcedureExecution({ procedure: testProcedure, onAbort })
      );
      act(() => result.current.actions.abort("User cancelled"));
      expect(result.current.phase).toBe("aborted");
      expect(onAbort).toHaveBeenCalledTimes(1);
      expect(onAbort).toHaveBeenCalledWith(
        expect.objectContaining({ anomalies: [] }),
        "User cancelled"
      );
    });

    it("abort adds reason to anomalies in context", () => {
      const { result } = renderHook(() =>
        useProcedureExecution({ procedure: testProcedure })
      );
      act(() => result.current.actions.abort("User cancelled"));
      expect(result.current.phase).toBe("aborted");
      expect(result.current.context.anomalies).toContain("User cancelled");
      expect(result.current.context.finishedAt).toBeDefined();
    });

    it("abort stops timer", () => {
      const { result } = renderHook(() =>
        useProcedureExecution({ procedure: testProcedure })
      );
      act(() => result.current.timer.start());
      act(() => result.current.actions.abort("Done"));
      expect(result.current.timer.isRunning).toBe(false);
    });

    it("reset returns to briefing phase", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.actions.goToStep(1));
      act(() => result.current.actions.reset());
      expect(result.current.phase).toBe("briefing");
      expect(result.current.currentStepIndex).toBe(0);
      expect(result.current.completedSteps.size).toBe(0);
      expect(result.current.timer.globalElapsed).toBe(0);
    });

    it("setPhase allows direct phase change", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      act(() => result.current.actions.setPhase("executing"));
      expect(result.current.phase).toBe("executing");
      act(() => result.current.actions.setPhase("prerequisites"));
      expect(result.current.phase).toBe("prerequisites");
    });
  });

  describe("completeStep", () => {
    it("adds step to completed set when not present", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      const stepId = testProcedure.steps[0].id;
      act(() => result.current.actions.completeStep(stepId));
      expect(result.current.completedSteps.has(stepId)).toBe(true);
    });

    it("removes step from completed set when already present", () => {
      const { result } = renderHook(() => useProcedureExecution({ procedure: testProcedure }));
      const stepId = testProcedure.steps[0].id;
      act(() => result.current.actions.completeStep(stepId));
      expect(result.current.completedSteps.has(stepId)).toBe(true);
      act(() => result.current.actions.completeStep(stepId));
      expect(result.current.completedSteps.has(stepId)).toBe(false);
    });
  });

  describe("sortedSteps update on procedure change", () => {
    it("re-sorts steps when procedure changes", () => {
      const { result, rerender } = renderHook(
        ({ procedure }) => useProcedureExecution({ procedure }),
        { initialProps: { procedure: testProcedure } }
      );
      expect(result.current.currentStep).toEqual(
        [...testProcedure.steps].sort((a, b) => a.order - b.order)[0]
      );

      const reordered = {
        ...testProcedure,
        metadata: { ...testProcedure.metadata, code: "REORDERED-001" },
        steps: [...testProcedure.steps].reverse(),
      };
      rerender({ procedure: reordered });
      const sorted = [...reordered.steps].sort((a, b) => a.order - b.order);
      expect(result.current.currentStep).toEqual(sorted[0]);
    });
  });
});
