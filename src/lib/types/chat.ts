import { z } from "zod";
import { JsonSchema } from "./json";

export const ChatRoleSchema = z.enum(["user", "assistant", "system"]);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: ChatRoleSchema,
  content: z.string().min(1),
  provider: z.string().optional(),
  timestamp: z.date(),
  media: JsonSchema.optional(),
  procedureId: z.string().uuid().optional(),
  source: z.string().optional(),
  clientId: z.string().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatConversationSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  messages: z.array(ChatMessageSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ChatConversation = z.infer<typeof ChatConversationSchema>;
