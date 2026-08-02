import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
  url: "http://localhost:3000/api/embedded/events?deviceId=test-device-01",
  signal: {
    aborted: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
} as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/embedded/events", () => {
  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) });

    const response = await GET(mockRequest);

    expect(response.status).toBe(401);
  });

  it("returns SSE stream on success", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const response = await GET(mockRequest);

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toContain("no-cache");
  });

  it("uses deviceId from query param", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const requestWithDeviceId = {
      headers: new Headers(),
      url: "http://localhost:3000/api/embedded/events?deviceId=my-device-42",
      signal: {
        aborted: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    } as unknown as Request;

    const response = await GET(requestWithDeviceId);

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
  });
});
