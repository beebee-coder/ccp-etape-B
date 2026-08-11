import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/q-r/route";
import { POST } from "@/app/api/q-r/route";
import { PUT } from "@/app/api/q-r/route";
import { DELETE } from "@/app/api/q-r/route";
import { getAllQAItems, getQAItemsForUser, createQAItem, updateQAItem, deleteQAItem } from "@/lib/q-r/server-store";
import { requireRole } from "@/lib/api/auth";

vi.mock("@/lib/q-r/server-store", () => ({
  getAllQAItems: vi.fn(),
  getQAItemsForUser: vi.fn(),
  createQAItem: vi.fn(),
  updateQAItem: vi.fn(),
  deleteQAItem: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireRole: vi.fn(),
  requireAuth: vi.fn(),
}));

const mockQAItem = {
  id: "00000000-0000-0000-0000-000000000001",
  question: "Test question?",
  answer: "Test answer.",
  title: "Test Title",
  category: undefined,
  tags: [],
  location: undefined,
};

beforeEach(() => {
  vi.resetAllMocks();
});

function createMockRequest(body: unknown, method = "POST"): Request {
  return new Request("http://localhost/api/q-r", {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("GET /api/q-r", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: null,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as unknown as ReturnType<typeof requireRole>);
    const request = new Request("http://localhost/api/q-r");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns all items for admin", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: { sub: "admin-1", role: "admin" },
      response: null,
    } as unknown as ReturnType<typeof requireRole>);
    vi.mocked(getAllQAItems).mockResolvedValue([mockQAItem]);

    const request = new Request("http://localhost/api/q-r");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("returns only user items for non-admin", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: { sub: "user-1", role: "user" },
      response: null,
    } as unknown as ReturnType<typeof requireRole>);
    vi.mocked(getQAItemsForUser).mockResolvedValue([mockQAItem]);

    const request = new Request("http://localhost/api/q-r");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(getQAItemsForUser).toHaveBeenCalledWith("user-1");
    expect(data.data).toHaveLength(1);
  });
});

describe("POST /api/q-r", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: null,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as unknown as ReturnType<typeof requireRole>);
    const request = createMockRequest({ question: "Q?", answer: "A." });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: { sub: "admin-1", role: "admin" },
      response: null,
    } as unknown as ReturnType<typeof requireRole>);
    const request = createMockRequest({ question: "", answer: "A." });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("creates item and returns 201", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: { sub: "admin-1", role: "admin" },
      response: null,
    } as unknown as ReturnType<typeof requireRole>);
    vi.mocked(createQAItem).mockResolvedValue(mockQAItem);

    const request = createMockRequest({ question: "Q?", answer: "A." });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(createQAItem).toHaveBeenCalledWith(
      { question: "Q?", answer: "A." },
      "admin-1"
    );
    expect(data.data.id).toBe("00000000-0000-0000-0000-000000000001");
  });
});

describe("PUT /api/q-r", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: null,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as unknown as ReturnType<typeof requireRole>);
    const request = createMockRequest({ id: "00000000-0000-0000-0000-000000000001", question: "Updated?" }, "PUT");
    const response = await PUT(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: { sub: "admin-1", role: "admin" },
      response: null,
    } as unknown as ReturnType<typeof requireRole>);
    const request = createMockRequest({ question: "Updated?" }, "PUT");
    const response = await PUT(request);
    expect(response.status).toBe(400);
  });

  it("updates item and returns 200", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: { sub: "admin-1", role: "admin" },
      response: null,
    } as unknown as ReturnType<typeof requireRole>);
    vi.mocked(updateQAItem).mockResolvedValue(mockQAItem);

    const request = createMockRequest({ id: "00000000-0000-0000-0000-000000000001", question: "Updated?" }, "PUT");
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(updateQAItem).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001",
      { question: "Updated?" },
      "admin-1",
      true
    );
    expect(data.data.id).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("returns 404 when item not found", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: { sub: "admin-1", role: "admin" },
      response: null,
    } as unknown as ReturnType<typeof requireRole>);
    vi.mocked(updateQAItem).mockResolvedValue(null);

    const request = createMockRequest({ id: "00000000-0000-0000-0000-000000000002", question: "Updated?" }, "PUT");
    const response = await PUT(request);
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/q-r", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: null,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    } as unknown as ReturnType<typeof requireRole>);
    const request = createMockRequest({ id: "00000000-0000-0000-0000-000000000001" }, "DELETE");
    const response = await DELETE(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: { sub: "admin-1", role: "admin" },
      response: null,
    } as unknown as ReturnType<typeof requireRole>);
    const request = createMockRequest({}, "DELETE");
    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it("deletes item and returns 200", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: { sub: "admin-1", role: "admin" },
      response: null,
    } as unknown as ReturnType<typeof requireRole>);
    vi.mocked(deleteQAItem).mockResolvedValue(true);

    const request = createMockRequest({ id: "00000000-0000-0000-0000-000000000001" }, "DELETE");
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(deleteQAItem).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001",
      "admin-1",
      true
    );
    expect(data.data.success).toBe(true);
  });

  it("returns 404 when item not found", async () => {
    vi.mocked(requireRole).mockReturnValueOnce({
      user: { sub: "admin-1", role: "admin" },
      response: null,
    } as unknown as ReturnType<typeof requireRole>);
    vi.mocked(deleteQAItem).mockResolvedValue(false);

    const request = createMockRequest({ id: "00000000-0000-0000-0000-000000000002" }, "DELETE");
    const response = await DELETE(request);
    expect(response.status).toBe(404);
  });
});
