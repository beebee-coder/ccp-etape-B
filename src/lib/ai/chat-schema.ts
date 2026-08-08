import { z } from "zod";

export const AIChatRequestSchema = z.object({
  message: z.string().min(1, "Le message est requis"),
  context: z.string().optional(),
  editMode: z.boolean().optional().default(false),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  qaLimit: z.number().int().positive().optional(),
  qaSearchQuery: z.string().optional(),
});

export type AIChatRequest = z.infer<typeof AIChatRequestSchema>;
