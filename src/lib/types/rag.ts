import { z } from "zod";
import { JsonSchema } from "./json";

export const ChromaIndexSchema = z.object({
  id: z.string().uuid(),
  collection: z.string().min(1),
  documentId: z.string().min(1),
  content: z.string(),
  metadata: JsonSchema.optional(),
  embedding: z.array(z.number()).optional(),
  createdAt: z.date(),
});
export type ChromaIndex = z.infer<typeof ChromaIndexSchema>;
