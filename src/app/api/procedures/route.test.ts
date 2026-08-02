import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import type { TProcedure } from "@/lib/procedures/services/validator.service";

vi.mock("@/lib/procedures/server-store", () => ({
  getAllProcedures: vi.fn(),
  saveProcedure: vi.fn(),
}));

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

import { getAllProcedures } from "@/lib/procedures/server-store";
import { saveProcedure } from "@/lib/procedures/server-store";
import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
  json: vi.fn(),
} as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/procedures", () => {
  it("returns procedures on success", async () => {
    const mockProcedures: TProcedure[] = [
      {
        metadata: {
          title: "Procedure 1",
          code: "PROC-001",
          description: "Procedure description",
          category: "production",
          priority: "haute",
          estimatedTimeMinutes: 30,
          requiredRoles: ["technicien"],
          globalSafetyInstructions: [],
        },
        steps: [
          {
            id: "step_1",
            title: "Step 1",
            instructions: "Do step 1",
            type: "consigne_simple",
            order: 0,
            isMandatory: false,
            dependencies: [],
            mediaRequirements: [],
            alarms: [],
            attachments: [],
            timerEnabled: false,
            timerSeconds: 0,
          },
        ],
      },
    ];
    vi.mocked(getAllProcedures).mockResolvedValue(mockProcedures);
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockProcedures);
  });

  it("returns 500 on server error", async () => {
    vi.mocked(getAllProcedures).mockRejectedValue(new Error("DB error"));
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const response = await GET(mockRequest);

    expect(response.status).toBe(500);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) });

    const response = await GET(mockRequest);

    expect(response.status).toBe(401);
  });
});

describe("POST /api/procedures", () => {
  it("saves a procedure and returns 201", async () => {
    const mockBody: TProcedure = {
      metadata: {
        title: "New Procedure",
        code: "NEW-PROC",
        description: "New procedure description",
        category: "production",
        priority: "haute",
        estimatedTimeMinutes: 30,
        requiredRoles: ["technicien"],
        globalSafetyInstructions: [],
      },
      steps: [
        {
          id: "step_1",
          title: "Step 1",
          instructions: "Do step 1",
          type: "consigne_simple",
          order: 0,
          isMandatory: false,
          dependencies: [],
          mediaRequirements: [],
          alarms: [],
          attachments: [],
          timerEnabled: false,
          timerSeconds: 0,
        },
      ],
    };
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: mockBody } });
    vi.mocked(saveProcedure).mockResolvedValue(undefined);

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data).toEqual({ success: true });
  });

  it("returns 400 on invalid data", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: {} } });
    vi.mocked(saveProcedure).mockRejectedValue(new Error("Validation error"));

    const response = await POST(mockRequest);

    expect(response.status).toBe(400);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) });

    const response = await POST(mockRequest);

    expect(response.status).toBe(401);
  });
});