import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import type { EtatDesLieuxReport } from "@/lib/etat-des-lieux/server-store";

vi.mock("@/lib/etat-des-lieux/server-store", () => ({
  getAll: vi.fn(),
  create: vi.fn(),
  EtatDesLieuxReportInputSchema: {},
}));

vi.mock("@/lib/api/handlers", () => ({
  validateApiRequest: vi.fn(),
}));

import { getAll } from "@/lib/etat-des-lieux/server-store";
import { create } from "@/lib/etat-des-lieux/server-store";
import { validateApiRequest } from "@/lib/api/handlers";

const mockRequest = {
  headers: new Headers(),
  json: vi.fn(),
} as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/etat-des-lieux", () => {
  it("returns reports on success", async () => {
    const mockReports: EtatDesLieuxReport[] = [
      {
        id: "report_1",
        title: "Report 1",
        description: "Description 1",
        location: "Location 1",
        attachments: [],
        status: "draft",
        authorName: "John",
        authorRole: "technician",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];
    vi.mocked(getAll).mockResolvedValue(mockReports);
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: null } });

    const response = await GET(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual(mockReports);
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

describe("POST /api/etat-des-lieux", () => {
  it("creates a report and returns 201", async () => {
    const mockReport: EtatDesLieuxReport = {
      id: "report_1",
      title: "New Report",
      description: "New Description",
      location: "New Location",
      attachments: [],
      status: "draft",
      authorName: "John",
      authorRole: "technician",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const mockBody = {
      title: "New Report",
      description: "New Description",
      location: "New Location",
      attachments: [],
      status: "draft",
      authorName: "John",
      authorRole: "technician",
    };
    vi.mocked(validateApiRequest).mockResolvedValue({ ok: true, ctx: { user: { sub: "1", role: "admin" }, body: mockBody } });
    vi.mocked(create).mockResolvedValue(mockReport);

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data).toEqual(mockReport);
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