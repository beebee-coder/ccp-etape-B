import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/admin", () => ({
  verifyAdminCredentials: vi.fn(),
}));

vi.mock("@/lib/auth/jwt", () => ({
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
}));

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

vi.mock("@/lib/auth/cookies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/cookies")>();
  return {
    ...actual,
    setAuthCookies: vi.fn(),
    setCsrfCookie: vi.fn(),
    generateCsrfToken: vi.fn(),
  };
});

import { POST as LoginPOST } from "./route";
import { verifyAdminCredentials } from "@/lib/auth/admin";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { validateApiRequest } from "@/lib/api/handlers";
import { setAuthCookies, setCsrfCookie, generateCsrfToken } from "@/lib/auth/cookies";

const mockRequest = {
  headers: new Headers(),
  json: vi.fn(),
} as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/login", () => {
  it("sets auth cookies and returns token on success", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: { username: "admin", password: "pass" } }});
    vi.mocked(verifyAdminCredentials).mockResolvedValue({ id: "admin", firstName: "Admin", lastName: "User", username: "admin", role: "admin" });
    vi.mocked(signAccessToken).mockResolvedValue("access-token-123");
    vi.mocked(signRefreshToken).mockResolvedValue("refresh-token-123");
    vi.mocked(generateCsrfToken).mockReturnValue("csrf-token-123");

    const response = await LoginPOST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.token).toBe("access-token-123");
    expect(data.csrfToken).toBe("csrf-token-123");
    expect(data.user.role).toBe("admin");
    expect(setAuthCookies).toHaveBeenCalled();
    expect(setCsrfCookie).toHaveBeenCalledWith(response, "csrf-token-123");
  });

  it("returns 401 on invalid credentials", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: { username: "admin", password: "wrong" } }});
    vi.mocked(verifyAdminCredentials).mockResolvedValue(null);

    const response = await LoginPOST(mockRequest);

    expect(response.status).toBe(401);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) });

    const response = await LoginPOST(mockRequest);

    expect(response.status).toBe(401);
  });
});
