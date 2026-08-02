import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/db", () => ({
  checkConnection: vi.fn(),
}));

import { checkConnection } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/health", () => {
  it("returns 200 when database is connected", async () => {
    vi.mocked(checkConnection).mockResolvedValue(true);

    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.database).toBe("connected");
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("uptime");
  });

  it("returns 503 when database is disconnected", async () => {
    vi.mocked(checkConnection).mockResolvedValue(false);

    const response = await GET();

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.status).toBe("degraded");
    expect(data.database).toBe("disconnected");
  });
});
