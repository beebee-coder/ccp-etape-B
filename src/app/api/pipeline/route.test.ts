import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

vi.mock("child_process", () => ({
  __esModule: true,
  default: { spawn: vi.fn() },
  spawn: vi.fn(),
}));

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
  json: vi.fn(),
} as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/pipeline", () => {
  it("returns pipeline status on success", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: { branch: "main", message: "test" } } });

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.status).toBe("ready");
    expect(data.data.hasToken).toBe(false);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) });

    const response = await GET(mockRequest);

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid branch name", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: { branch: "../etc", message: "test" } } });

    const response = await POST(mockRequest);

    expect(response.status).toBe(400);
  });
});

describe("POST /api/pipeline", () => {
  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) });

    const response = await POST(mockRequest);

    expect(response.status).toBe(401);
  });
});
