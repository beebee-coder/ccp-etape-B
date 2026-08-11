import { z } from "zod";
import { LocationRefSchema } from "@/lib/location/types";

export const QAItemSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().min(1, "La question est requise").max(500),
  answer: z.string().min(1, "La réponse est requise").max(5000),
  title: z.string().min(1, "Le titre est requis").max(255).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  location: LocationRefSchema.optional(),
});

export const QAItemCreatePayloadSchema = QAItemSchema.omit({
  id: true,
}).extend({
  tags: z.array(z.string()).optional(),
  category: z.string().max(100).optional(),
  title: z.string().min(1, "Le titre est requis").max(255).optional(),
  location: LocationRefSchema.optional(),
});

export const QAItemUpdatePayloadSchema = QAItemSchema.omit({
  id: true,
}).partial();

export const QAItemUpdateWithIdSchema = QAItemUpdatePayloadSchema.extend({
  id: z.string().uuid(),
});

export type QAItem = z.infer<typeof QAItemSchema>;
export type QAItemCreatePayload = z.infer<typeof QAItemCreatePayloadSchema>;
export type QAItemUpdatePayload = z.infer<typeof QAItemUpdatePayloadSchema>;
export type QAItemUpdateWithId = z.infer<typeof QAItemUpdateWithIdSchema>;