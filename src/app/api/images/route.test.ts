import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import type { MediaItem, ImageStats } from "@/lib/images/server-store";

vi.mock("@/lib/images/server-store", () => ({
  getAll: vi.fn(),
  getAllMeta: vi.fn(),
  getCategories: vi.fn(),
  getStats: vi.fn(),
  create: vi.fn(),
  MediaItemInputSchema: {},
}));

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

import { getAll } from "@/lib/images/server-store";
import { getAllMeta } from "@/lib/images/server-store";
import { getCategories } from "@/lib/images/server-store";
import { getStats } from "@/lib/images/server-store";
import { create } from "@/lib/images/server-store";
import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
  url: "http://localhost:3000/api/images",
  json: vi.fn(),
} as unknown as Request;

const mockStats: ImageStats = {
  total: 1,
  totalSize: 1024,
  totalImages: 1,
  totalVideos: 0,
  categories: ["Tous", "production"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/images", () => {
  it("returns items and meta with stats on success", async () => {
    const mockItems: MediaItem[] = [
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
    vi.mocked(getStats).mockResolvedValue(mockStats);
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: null },
    });

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockItems);
    expect(data.meta.categories).toEqual(mockCategories);
    expect(data.meta.total).toBe(1);
    expect(data.meta.page).toBe(1);
    expect(data.meta.limit).toBe(50);
    expect(data.meta.hasMore).toBe(false);
  });

  it("passes pagination params to getAll", async () => {
    const paginatedRequest = {
      ...mockRequest,
      url: "http://localhost:3000/api/images?page=2&limit=10",
    } as unknown as Request;

    vi.mocked(getAll).mockResolvedValue([]);
    vi.mocked(getCategories).mockResolvedValue(["Tous"]);
    vi.mocked(getStats).mockResolvedValue({
      ...mockStats,
      total: 100,
    });
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: null },
    });

    const response = await GET(paginatedRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(getAll).toHaveBeenCalledWith({ limit: 10, offset: 10 });
    expect(data.meta.page).toBe(2);
    expect(data.meta.limit).toBe(10);
    expect(data.meta.hasMore).toBe(true);
  });

  it("uses getAllMeta when meta_only=true", async () => {
    const metaOnlyRequest = {
      ...mockRequest,
      url: "http://localhost:3000/api/images?meta_only=true",
    } as unknown as Request;

    const mockMeta = [
      {
        id: "img_1",
        title: "Image 1",
        category: "production",
        description: "Desc 1",
        tags: ["tag1"],
        kind: "image" as const,
        mimeType: "image/png",
        size: 1024,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];
    vi.mocked(getAllMeta).mockResolvedValue(mockMeta);
    vi.mocked(getCategories).mockResolvedValue(["Tous"]);
    vi.mocked(getStats).mockResolvedValue(mockStats);
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: null },
    });

    const response = await GET(metaOnlyRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(getAllMeta).toHaveBeenCalledWith({ limit: 50, offset: 0 });
    expect(getAll).not.toHaveBeenCalled();
    expect(data.data).toEqual(mockMeta);
  });

  it("returns 500 on server error", async () => {
    vi.mocked(getAll).mockRejectedValue(new Error("DB error"));
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: null },
    });

    const response = await GET(mockRequest);

    expect(response.status).toBe(500);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    });

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
    const mockItem: MediaItem = {
      id: "img_1",
      title: "New Image",
      category: "production",
      description: "New desc",
      tags: ["tag1"],
      kind: "image",
      mimeType: "image/png",
      size: 1024,
      dataUrl: "data:image/png;base64,abc",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: mockBody },
    });
    vi.mocked(create).mockResolvedValue(mockItem);

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data).toEqual(mockItem);
  });

  it("returns 500 on server error", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: true,
      ctx: { user: { sub: "1", role: "admin" }, body: {} },
    });
    vi.mocked(create).mockRejectedValue(new Error("DB error"));

    const response = await POST(mockRequest);

    expect(response.status).toBe(500);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateApiRequest).mockResolvedValue({
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    });

    const response = await POST(mockRequest);

    expect(response.status).toBe(401);
  });
});
