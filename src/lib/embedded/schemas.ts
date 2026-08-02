import { z } from "zod";

export const ActuatorToggleSchema = z.object({
  id: z.string().min(1),
  state: z.enum(["idle", "active", "error"]),
  enabled: z.boolean().default(false),
});

export type ActuatorToggle = z.infer<typeof ActuatorToggleSchema>;
