import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/ai/providers", () => ({
  generateAIResponse: vi.fn(),
}));

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

vi.mock("@/lib/q-r/server-store", () => ({
  getQAItemsForAI: vi.fn().mockResolvedValue(""),
}));

vi.mock("@/lib/ai/server-store", () => ({
  saveChatMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/procedures/types", () => ({
  GuidePhase: "",
}));

import { generateAIResponse } from "@/lib/ai/providers";
import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
  json: vi.fn(),
} as unknown as Request;

const mockBody = {
  step: {
    id: "step_1",
    title: "Safety Check",
    instructions: "Verify all safety measures",
    type: "validation_securite",
    order: 0,
    isMandatory: true,
    dependencies: [],
    mediaRequirements: [],
    alarms: [],
    attachments: [],
    timerEnabled: false,
    timerSeconds: 0,
  },
  stepIndex: 0,
  totalSteps: 1,
  phase: "executing",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/ai/advice", () => {
  it("returns AI advice on success", async () => {
    vi.mocked(generateAIResponse).mockResolvedValue({
      response: "Check safety protocols",
      provider: "groq",
    });
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: mockBody },
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.stepId).toBe("step_1");
    expect(data.data.message).toBe("Check safety protocols");
  });

  it("returns 500 on provider error", async () => {
    vi.mocked(generateAIResponse).mockRejectedValue(
      new Error("Provider error"),
    );
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: mockBody },
    });

    const response = await POST(mockRequest);

    expect(response.status).toBe(500);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    });

    const response = await POST(mockRequest);

    expect(response.status).toBe(401);
  });
});
