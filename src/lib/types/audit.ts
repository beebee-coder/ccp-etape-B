import { z } from "zod";
import { JsonSchema } from "./json";

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  action: z.string().min(1),
  resourceType: z.string().optional(),
  resourceId: z.string().uuid().optional(),
  metadata: JsonSchema.optional(),
  createdAt: z.date(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;
