import { z } from "zod";
import { JsonSchema } from "./json";

export const WorkflowStatusSchema = z.enum(["draft", "published", "archived"]);
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const ExecutionStatusSchema = z.enum(["running", "completed", "failed", "cancelled"]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const WorkflowStepSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  actionType: z.string().min(1),
  config: JsonSchema.optional(),
  nextStepId: z.string().uuid().optional(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const ExecutionSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  userId: z.string().uuid(),
  currentStepId: z.string().uuid().optional(),
  status: ExecutionStatusSchema,
  startedAt: z.date(),
  finishedAt: z.date().optional(),
  error: z.string().optional(),
});
export type Execution = z.infer<typeof ExecutionSchema>;

export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  status: WorkflowStatusSchema,
  triggerType: z.string().optional(),
  config: JsonSchema.optional(),
  steps: z.array(WorkflowStepSchema),
  executions: z.array(ExecutionSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;
