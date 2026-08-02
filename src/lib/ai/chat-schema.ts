import { z } from "zod";

export const AIChatRequestSchema = z.object({
  message: z.string().min(1, "Le message est requis"),
  context: z.string().optional(),
});

export type AIChatRequest = z.infer<typeof AIChatRequestSchema>;
