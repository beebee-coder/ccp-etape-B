import { describe, it, expect, vi } from "vitest";
import { getAllQAItems, getQAItemById, createQAItem, updateQAItem, deleteQAItem } from "@/lib/q-r/server-store";
import type { KnowledgeItem } from "@prisma/client";

const mockPrisma = vi.hoisted(() => {
  const knowledgeItem = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };
  return { knowledgeItem };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    knowledgeItem: mockPrisma.knowledgeItem,
  },
}));

const mockRow = (overrides: Partial<KnowledgeItem> = {}): KnowledgeItem => ({
  id: "test-id",
  userId: "user-1",
  type: "qa",
  title: "Test Title",
  question: "Test question?",
  answer: "Test answer.",
  tags: [],
  category: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  content: null,
  locationType: null,
  locationPath: null,
  blocCode: null,
  equipementCode: null,
  groupePath: null,
  alarmCode: null,
  vueCode: null,
  ...overrides,
});

describe("getAllQAItems", () => {
  it("returns empty array when no items exist", async () => {
    mockPrisma.knowledgeItem.findMany.mockResolvedValue([]);
    const result = await getAllQAItems();
    expect(result).toEqual([]);
  });

  it("returns mapped QA items", async () => {
    mockPrisma.knowledgeItem.findMany.mockResolvedValue([
      mockRow(),
      mockRow({ id: "test-id-2", question: "Q2?" }),
    ]);
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
    mockPrisma.knowledgeItem.findFirst.mockResolvedValue(null);
    const result = await getQAItemById("missing-id");
    expect(result).toBeNull();
  });

  it("returns item when found", async () => {
    mockPrisma.knowledgeItem.findFirst.mockResolvedValue(mockRow());
    const result = await getQAItemById("test-id");
    expect(result?.id).toBe("test-id");
  });
});

describe("createQAItem", () => {
  it("inserts item and returns mapped result", async () => {
    mockPrisma.knowledgeItem.create.mockResolvedValue(mockRow());
    const result = await createQAItem(
      { question: "New Q?", answer: "New A." },
      "user-1",
    );
    expect(result.id).toBe("test-id");
    expect(mockPrisma.knowledgeItem.create).toHaveBeenCalled();
  });
});

describe("updateQAItem", () => {
  it("returns null when item not found", async () => {
    mockPrisma.knowledgeItem.updateMany.mockResolvedValue({ count: 0 });
    const result = await updateQAItem("missing-id", {}, "user-1");
    expect(result).toBeNull();
  });

  it("updates item and returns updated result", async () => {
    mockPrisma.knowledgeItem.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.knowledgeItem.findFirst.mockResolvedValue(
        mockRow({ question: "Updated?" }),
      );
    const result = await updateQAItem("test-id", { question: "Updated?" }, "user-1");
    expect(result?.question).toBe("Updated?");
  });
});

describe("deleteQAItem", () => {
  it("returns false when item not found", async () => {
    mockPrisma.knowledgeItem.deleteMany.mockResolvedValue({ count: 0 });
    const result = await deleteQAItem("missing-id", "user-1");
    expect(result).toBe(false);
  });

  it("returns true when item deleted", async () => {
    mockPrisma.knowledgeItem.deleteMany.mockResolvedValue({ count: 1 });
    const result = await deleteQAItem("test-id", "user-1");
    expect(result).toBe(true);
  });
});
