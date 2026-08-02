import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/images/server-store", () => ({
  getAll: vi.fn(),
  create: vi.fn(),
  getCategories: vi.fn(),
  MediaItemInputSchema: {},
}));

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

import { getAll } from "@/lib/images/server-store";
import { create } from "@/lib/images/server-store";
import { getCategories } from "@/lib/images/server-store";
import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
  json: vi.fn(),
} as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/images", () => {
  it("returns items and categories on success", async () => {
    const mockItems = [
      {
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
      },
    ];
    const mockCategories = ["Tous", "production"];
    vi.mocked(getAll).mockResolvedValue(mockItems);
    vi.mocked(getCategories).mockResolvedValue(mockCategories);
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockItems);
    expect(data.meta.categories).toEqual(mockCategories);
  });

  it("returns 500 on server error", async () => {
    vi.mocked(getAll).mockRejectedValue(new Error("DB error"));
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const response = await GET(mockRequest);

    expect(response.status).toBe(500);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) });

    const response = await GET(mockRequest);

    expect(response.status).toBe(401);
  });
});

describe("POST /api/images", () => {
  it("creates an item and returns 201", async () => {
    const mockBody = {
      title: "New Image",
      category: "production",
      description: "New desc",
      tags: ["tag1"],
      kind: "image",
      mimeType: "image/png",
      size: 1024,
      dataUrl: "data:image/png;base64,abc",
    };
    const mockItem = {
      id: "img_1",
      ...mockBody,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: mockBody } });
    vi.mocked(create).mockResolvedValue(mockItem);

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data).toEqual(mockItem);
  });

  it("returns 400 on invalid data", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: {} } });
    vi.mocked(create).mockRejectedValue(new Error("Validation error"));

    const response = await POST(mockRequest);

    expect(response.status).toBe(400);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: false, response: new Response("Unauthorized", { status: 401 }) });

    const response = await POST(mockRequest);

    expect(response.status).toBe(401);
  });
});