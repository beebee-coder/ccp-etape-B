import { describe, it, expect, vi } from "vitest";
import { GET } from "@/app/api/q-r/route";
import { POST } from "@/app/api/q-r/route";

vi.mock("@/lib/api/auth", () => ({
  requireRole: vi.fn(() => ({
    user: { sub: "test-user", role: "admin" },
    response: null,
  })),
  requireAuth: vi.fn(() => ({
    user: { sub: "test-user", role: "user" },
    response: null,
  })),
}));

function createMockRequest(body: unknown): Request {
  return new Request("http://localhost/api/q-r", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("GET /api/q-r", () => {
  it("returns 401 when not authenticated", async () => {
    const { requireAuth } = await import("@/lib/api/auth");
    vi.mocked(requireAuth).mockReturnValueOnce({
      user: null,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as unknown as ReturnType<typeof requireAuth>);
    const request = new Request("http://localhost/api/q-r");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });
});

describe("POST /api/q-r", () => {
  it("returns 401 when not authenticated", async () => {
    const { requireRole } = await import("@/lib/api/auth");
    vi.mocked(requireRole).mockReturnValueOnce({
      user: null,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as unknown as ReturnType<typeof requireRole>);
    const request = createMockRequest({ question: "Q?", answer: "A." });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    const request = createMockRequest({ question: "", answer: "A." });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
