import { z } from "zod";

export type { PipelineConfig } from "@/lib/pipeline/pipeline-schema";
export { PipelineConfigSchema } from "@/lib/pipeline/pipeline-schema";

export const PipelineRunStatusSchema = z.enum(["running", "success", "error"]);
export type PipelineRunStatus = z.infer<typeof PipelineRunStatusSchema>;

export const PipelineRunSchema = z.object({
  id: z.string().uuid(),
  branch: z.string().min(1),
  commitMessage: z.string().min(1),
  status: PipelineRunStatusSchema,
  startedAt: z.date(),
  finishedAt: z.date().optional(),
  logs: z.string(),
});
export type PipelineRun = z.infer<typeof PipelineRunSchema>;
