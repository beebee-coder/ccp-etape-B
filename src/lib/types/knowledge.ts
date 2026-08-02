import { z } from "zod";

export const KnowledgeItemTypeSchema = z.enum(["qa", "article", "howto", "troubleshooting"]);
export type KnowledgeItemType = z.infer<typeof KnowledgeItemTypeSchema>;

export const KnowledgeItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: KnowledgeItemTypeSchema,
  title: z.string().min(1),
  question: z.string().optional(),
  answer: z.string().optional(),
  tags: z.array(z.string()),
  category: z.string().optional(),
  content: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;

export const KnowledgeCreatePayloadSchema = KnowledgeItemSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type KnowledgeCreatePayload = z.infer<typeof KnowledgeCreatePayloadSchema>;
