import { describe, it, expect, vi } from "vitest";
import { getAllQAItems, getQAItemById, createQAItem, updateQAItem, deleteQAItem } from "@/lib/q-r/server-store";

const { mockQuery } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery };
});

vi.mock("@/lib/db", () => ({
  query: mockQuery,
  provider: "pg",
}));

vi.mock("@/lib/local-db/sync-engine", () => ({
  SyncEngine: {
    getInstance: vi.fn(() => ({
      enqueue: vi.fn(),
    })),
  },
}));

const mockRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "test-id",
  user_id: "user-1",
  type: "qa",
  title: "Test Title",
  question: "Test question?",
  answer: "Test answer.",
  tags: [],
  category: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  content: null,
  location_type: null,
  location_path: null,
  bloc_code: null,
  equipement_code: null,
  ...overrides,
});

describe("getAllQAItems", () => {
  it("returns empty array when no items exist", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const result = await getAllQAItems();
    expect(result).toEqual([]);
  });

  it("returns mapped QA items", async () => {
    mockQuery.mockResolvedValue({
      rows: [mockRow(), mockRow({ id: "test-id-2", question: "Q2?" })],
    });
    const result = await getAllQAItems();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "test-id",
      question: "Test question?",
      answer: "Test answer.",
      title: "Test Title",
      category: undefined,
      tags: [],
      location: undefined,
    });
  });
});

describe("getQAItemById", () => {
  it("returns null when item not found", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const result = await getQAItemById("missing-id");
    expect(result).toBeNull();
  });

  it("returns item when found", async () => {
    mockQuery.mockResolvedValue({ rows: [mockRow()] });
    const result = await getQAItemById("test-id");
    expect(result?.id).toBe("test-id");
  });
});

describe("createQAItem", () => {
  it("inserts item and returns mapped result", async () => {
    mockQuery.mockResolvedValue({ rows: [mockRow()] });
    const result = await createQAItem(
      { question: "New Q?", answer: "New A." },
      "user-1",
    );
    expect(result.id).toBe("test-id");
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe("updateQAItem", () => {
  it("returns null when item not found", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const result = await updateQAItem("missing-id", {}, "user-1");
    expect(result).toBeNull();
  });

  it("updates item and returns updated result", async () => {
    mockQuery.mockResolvedValue({ rows: [mockRow({ question: "Updated?" })] });
    const result = await updateQAItem("test-id", { question: "Updated?" }, "user-1");
    expect(result?.question).toBe("Updated?");
  });
});

describe("deleteQAItem", () => {
  it("returns false when item not found", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const result = await deleteQAItem("missing-id", "user-1");
    expect(result).toBe(false);
  });

  it("returns true when item deleted", async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: "test-id" }] });
    const result = await deleteQAItem("test-id", "user-1");
    expect(result).toBe(true);
  });
});
