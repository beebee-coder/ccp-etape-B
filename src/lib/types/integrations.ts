import { z } from "zod";
import { JsonSchema } from "./json";

export const ServiceProviderSchema = z.enum([
  "slack",
  "github",
  "notion",
  "linear",
  "gitlab",
  "jira",
  "asana",
  "trello",
  "discord",
  "microsoft-teams",
  "google-workspace",
  "other",
]);
export type ServiceProvider = z.infer<typeof ServiceProviderSchema>;

export const IntegrationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  service: ServiceProviderSchema,
  credentials: JsonSchema,
  isActive: z.boolean(),
  createdAt: z.date(),
});
export type Integration = z.infer<typeof IntegrationSchema>;
