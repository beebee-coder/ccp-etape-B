import { z } from "zod";

export const PipelineConfigSchema = z.object({
  branch: z.string().optional(),
  message: z.string().optional(),
});

export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;