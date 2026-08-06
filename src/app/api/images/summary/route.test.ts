import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/images/server-store", () => ({
  getStats: vi.fn(),
}));

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

import { getStats } from "@/lib/images/server-store";
import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
  url: "http://localhost:3000/api/images/summary",
  json: vi.fn(),
} as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/images/summary", () => {
  it("returns aggregate stats on success", async () => {
    const mockStats = {
      total: 50,
      totalSize: 5_000_000,
      totalImages: 35,
      totalVideos: 15,
      categories: ["Tous", "production", "inspection"],
    };
    vi.mocked(getStats).mockResolvedValue(mockStats);
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: null },
    });

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockStats);
    expect(getStats).toHaveBeenCalledOnce();
  });

  it("returns 500 on server error", async () => {
    vi.mocked(getStats).mockRejectedValue(new Error("DB error"));
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: null },
    });

    const response = await GET(mockRequest);

    expect(response.status).toBe(500);
    expect(getStats).toHaveBeenCalledOnce();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    });

    const response = await GET(mockRequest);

    expect(response.status).toBe(401);
    expect(getStats).not.toHaveBeenCalled();
  });
});
