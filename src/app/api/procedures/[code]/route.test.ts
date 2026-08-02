import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "./route";

vi.mock("@/lib/procedures/server-store", () => ({
  deleteProcedure: vi.fn(),
}));

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

import { deleteProcedure } from "@/lib/procedures/server-store";
import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
  json: vi.fn(),
} as unknown as Request;

const mockParams = { code: "PROC-001" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/procedures/[code]", () => {
  it("deletes procedure by code and returns 200", async () => {
    vi.mocked(deleteProcedure).mockResolvedValue(undefined as never);
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const response = await DELETE(mockRequest, { params: mockParams });
    const data = await response.json();

    expect(deleteProcedure).toHaveBeenCalledWith("PROC-001");
    expect(response.status).toBe(200);
    expect(data.data).toEqual({ success: true });
  });

  it("returns 500 on server error", async () => {
    vi.mocked(deleteProcedure).mockRejectedValue(new Error("DB error"));
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const response = await DELETE(mockRequest, { params: mockParams });

    expect(response.status).toBe(500);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) } as never);

    const response = await DELETE(mockRequest, { params: mockParams });

    expect(response.status).toBe(401);
  });

  it("passes the correct code param to deleteProcedure", async () => {
    vi.mocked(deleteProcedure).mockResolvedValue(undefined as never);
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const otherParams = { code: "PROC-999" };
    await DELETE(mockRequest, { params: otherParams });

    expect(deleteProcedure).toHaveBeenCalledWith("PROC-999");
  });
});
