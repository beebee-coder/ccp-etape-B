import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/ai/providers", () => ({
  generateAIResponse: vi.fn(),
}));

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

import { generateAIResponse } from "@/lib/ai/providers";
import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
  json: vi.fn(),
} as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/ai/chat", () => {
  it("returns AI response on success", async () => {
    vi.mocked(generateAIResponse).mockResolvedValue({ response: "Hello!", provider: "groq" });
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: { message: "Hello", editMode: false } } });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual({ response: "Hello!", provider: "groq", editMode: false, editResult: null });
  });

  it("returns 500 on provider error", async () => {
    vi.mocked(generateAIResponse).mockRejectedValue(new Error("Provider error"));
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: { message: "Hello", editMode: false } } });

    const response = await POST(mockRequest);

    expect(response.status).toBe(500);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) });

    const response = await POST(mockRequest);

    expect(response.status).toBe(401);
  });
});
