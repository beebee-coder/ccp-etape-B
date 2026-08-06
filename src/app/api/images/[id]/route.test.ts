import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT, DELETE } from "./route";
import type { MediaItem } from "@/lib/images/server-store";

vi.mock("@/lib/images/server-store", () => ({
  getById: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  MediaItemUpdateSchema: {},
}));

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

import { getById } from "@/lib/images/server-store";
import { update } from "@/lib/images/server-store";
import { remove } from "@/lib/images/server-store";
import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
  url: "http://localhost:3000/api/images/img_1",
  json: vi.fn(),
} as unknown as Request;

const mockItem: MediaItem = {
  id: "img_1",
  title: "Image 1",
  category: "production",
  description: "Desc 1",
  tags: ["tag1"],
  kind: "image",
  mimeType: "image/png",
  size: 1024,
  dataUrl: "data:image/png;base64,abc",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/images/[id]", () => {
  it("returns item on success", async () => {
    vi.mocked(getById).mockResolvedValue(mockItem);
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: null },
    });

    const response = await GET(mockRequest, { params: { id: "img_1" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockItem);
    expect(getById).toHaveBeenCalledWith("img_1");
  });

  it("returns 404 when item not found", async () => {
    vi.mocked(getById).mockResolvedValue(undefined);
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: null },
    });

    const response = await GET(mockRequest, { params: { id: "img_1" } });

    expect(response.status).toBe(404);
  });

  it("returns 500 on server error", async () => {
    vi.mocked(getById).mockRejectedValue(new Error("DB error"));
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: null },
    });

    const response = await GET(mockRequest, { params: { id: "img_1" } });

    expect(response.status).toBe(500);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    });

    const response = await GET(mockRequest, { params: { id: "img_1" } });

    expect(response.status).toBe(401);
    expect(getById).not.toHaveBeenCalled();
  });
});

describe("PUT /api/images/[id]", () => {
  it("updates item and returns 200", async () => {
    const updatedItem = { ...mockItem, title: "Updated Title" };
    vi.mocked(update).mockResolvedValue(updatedItem);
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: { title: "Updated Title" } },
    });

    const response = await PUT(mockRequest, { params: { id: "img_1" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(updatedItem);
    expect(update).toHaveBeenCalledWith("img_1", { title: "Updated Title" });
  });

  it("returns 404 when item not found", async () => {
    vi.mocked(update).mockResolvedValue(undefined);
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: { title: "Updated Title" } },
    });

    const response = await PUT(mockRequest, { params: { id: "img_1" } });

    expect(response.status).toBe(404);
  });

  it("returns 500 on server error", async () => {
    vi.mocked(update).mockRejectedValue(new Error("DB error"));
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: { title: "Updated Title" } },
    });

    const response = await PUT(mockRequest, { params: { id: "img_1" } });

    expect(response.status).toBe(500);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    });

    const response = await PUT(mockRequest, { params: { id: "img_1" } });

    expect(response.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/images/[id]", () => {
  it("deletes item and returns 200", async () => {
    vi.mocked(remove).mockResolvedValue(true);
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: null },
    });

    const response = await DELETE(mockRequest, { params: { id: "img_1" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual({ success: true });
    expect(remove).toHaveBeenCalledWith("img_1");
  });

  it("returns 404 when item not found", async () => {
    vi.mocked(remove).mockResolvedValue(false);
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: null },
    });

    const response = await DELETE(mockRequest, { params: { id: "img_1" } });

    expect(response.status).toBe(404);
  });

  it("returns 500 on server error", async () => {
    vi.mocked(remove).mockRejectedValue(new Error("DB error"));
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: null },
    });

    const response = await DELETE(mockRequest, { params: { id: "img_1" } });

    expect(response.status).toBe(500);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    });

    const response = await DELETE(mockRequest, { params: { id: "img_1" } });

    expect(response.status).toBe(401);
    expect(remove).not.toHaveBeenCalled();
  });
});
