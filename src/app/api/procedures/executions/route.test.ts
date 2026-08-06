import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/procedures/server-store", () => ({
  saveProcedureExecution: vi.fn(),
  getProcedureExecutions: vi.fn(),
}));

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { saveProcedureExecution, getProcedureExecutions } from "@/lib/procedures/server-store";
import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
  json: vi.fn(),
  url: "http://localhost:3000/api/procedures/executions",
} as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/procedures/executions", () => {
  it("returns executions on success", async () => {
    const mockExecutions = [
      { id: "exec_1", status: "COMPLETED", procedure_code: "PROC-001" },
      { id: "exec_2", status: "ABORTED", procedure_code: "PROC-001" },
    ];
    vi.mocked(getProcedureExecutions).mockResolvedValue(mockExecutions);
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const requestWithUrl = {
      ...mockRequest,
      url: "http://localhost:3000/api/procedures/executions?procedureCode=PROC-001",
    } as unknown as Request;

    const response = await GET(requestWithUrl);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockExecutions);
  });

  it("returns 400 when procedureCode is missing", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const response = await GET(mockRequest);

    expect(response.status).toBe(400);
    expect(getProcedureExecutions).not.toHaveBeenCalled();
  });

  it("returns 500 on server error", async () => {
    vi.mocked(getProcedureExecutions).mockRejectedValue(new Error("DB error"));
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const requestWithUrl = {
      ...mockRequest,
      url: "http://localhost:3000/api/procedures/executions?procedureCode=PROC-001",
    } as unknown as Request;

    const response = await GET(requestWithUrl);

    expect(response.status).toBe(500);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) });

    const response = await GET(mockRequest);

    expect(response.status).toBe(401);
  });
});

describe("POST /api/procedures/executions", () => {
  const mockExecution = {
    procedureCode: "PROC-001",
    status: "COMPLETED" as const,
    context: {
      currentStepIndex: 4,
      completedSteps: ["step_1", "step_2", "step_3", "step_4", "step_5"],
      startedAt: 1700000000000,
      finishedAt: 1700000300000,
      anomalies: [],
    },
  };

  it("saves execution and returns 201", async () => {
    vi.mocked(saveProcedureExecution).mockResolvedValue("exec_123");
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "user_1", role: "admin" }, body: mockExecution },
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(saveProcedureExecution).toHaveBeenCalledWith(mockExecution, "user_1");
    expect(response.status).toBe(201);
    expect(data.data).toEqual({ id: "exec_123", success: true });
  });

  it("returns 500 on server error", async () => {
    vi.mocked(saveProcedureExecution).mockRejectedValue(new Error("DB error"));
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "user_1", role: "admin" }, body: mockExecution },
    });

    const response = await POST(mockRequest);

    expect(response.status).toBe(500);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) });

    const response = await POST(mockRequest);

    expect(response.status).toBe(401);
    expect(saveProcedureExecution).not.toHaveBeenCalled();
  });

  it("passes null operatorId when user has no sub", async () => {
    vi.mocked(saveProcedureExecution).mockResolvedValue("exec_123");
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "", role: "admin" }, body: mockExecution },
    });

    const response = await POST(mockRequest);

    expect(saveProcedureExecution).toHaveBeenCalledWith(mockExecution, "");
    expect(response.status).toBe(201);
  });
});
