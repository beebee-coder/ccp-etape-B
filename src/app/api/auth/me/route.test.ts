import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
} as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/auth/me", () => {
  it("returns user info on success", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "user-1", role: "admin", firstName: "Admin", lastName: "User" }, body: null } });

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.id).toBe("user-1");
    expect(data.user.firstName).toBe("Admin");
    expect(data.user.lastName).toBe("User");
    expect(data.user.role).toBe("admin");
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) });

    const response = await GET(mockRequest);

    expect(response.status).toBe(401);
  });
});
