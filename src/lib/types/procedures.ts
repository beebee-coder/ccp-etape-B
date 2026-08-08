import { z } from "zod";

import { JsonSchema } from "./json";

export type {
  ProcedurePrerequisite,
  GuidePhase,
  AssistantAdvice,
  ProcedureExecutionContext,
} from "../procedures/types";

export const ProcedureCriticalitySchema = z.enum(["NORMAL", "HIGH", "CRITICAL"]);
export type ProcedureCriticality = z.infer<typeof ProcedureCriticalitySchema>;

export const ProcedureStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export type ProcedureStatus = z.infer<typeof ProcedureStatusSchema>;

export const ProcedureAlarmStatusSchema = z.enum(["ACTIVE", "RESOLVED"]);
export type ProcedureAlarmStatus = z.infer<typeof ProcedureAlarmStatusSchema>;

export const ProcedureExecutionStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "ABORTED"]);
export type ProcedureExecutionStatus = z.infer<typeof ProcedureExecutionStatusSchema>;

export const ProcedureStepTypeSchema = z.enum([
  "consigne_simple",
  "saisie_donnees",
  "inspection_visuelle",
  "validation_securite",
  "mesure_numerique",
]);
export type ProcedureStepType = z.infer<typeof ProcedureStepTypeSchema>;

export const ProcedureAlarmSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type ProcedureAlarmSeverity = z.infer<typeof ProcedureAlarmSeveritySchema>;

export const ProcedureAlarmTypeSchema = z.enum(["DANGER", "WARNING", "INFO", "SECURITY_CHECK"]);
export type ProcedureAlarmType = z.infer<typeof ProcedureAlarmTypeSchema>;

export const ProcedureMediaTypeSchema = z.enum(["photo", "video", "audio", "signature"]);
export type ProcedureMediaType = z.infer<typeof ProcedureMediaTypeSchema>;

export {
  PrioritySchema,
  StepTypeSchema,
  MediaTypeSchema,
  AlarmTypeSchema,
  MediaRequirementSchema,
  AlarmConfigSchema,
  StepSchema,
  MetadataSchema,
  ProcedureSchema,
  ExecutionContextSchema,
  ProcedureExecutionSchema,
  validateProcedure,
  validateStep,
  hasCircularDependencies,
  getCompleteness,
} from "../procedures/services/validator.service";

export type {
  TMetadata,
  TStep,
  TMediaRequirement,
  TAlarmConfig,
  TProcedure,
  TExecutionContext,
  TProcedureExecution,
} from "../procedures/services/validator.service";

export const ProcedureAlarmSchema = z.object({
  id: z.string().uuid(),
  procedureId: z.string().uuid(),
  code: z.string().min(1),
  type: ProcedureAlarmTypeSchema,
  severity: ProcedureAlarmSeveritySchema,
  description: z.string().min(1),
  remedy: JsonSchema,
  condition: z.string().min(1),
  triggeredAt: z.date().optional(),
  resolvedAt: z.date().optional(),
  status: ProcedureAlarmStatusSchema,
});
export type ProcedureAlarm = z.infer<typeof ProcedureAlarmSchema>;

export const ProcedureDocumentSchema = z.object({
  id: z.string().uuid(),
  procedureId: z.string().uuid(),
  title: z.string().min(1),
  type: z.string().min(1),
  url: z.string().url(),
  caption: z.string().optional(),
  uploadedBy: z.string().uuid(),
  uploadedAt: z.date(),
});
export type ProcedureDocument = z.infer<typeof ProcedureDocumentSchema>;

export const ProcedureMediaSchema = z.object({
  id: z.string().uuid(),
  procedureId: z.string().uuid(),
  kind: ProcedureMediaTypeSchema,
  source: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  mimeType: z.string().min(1),
  fileSize: z.number().int().nonnegative().optional(),
  duration: z.number().nonnegative().optional(),
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
  createdBy: z.string().uuid(),
  createdAt: z.date(),
});
export type ProcedureMedia = z.infer<typeof ProcedureMediaSchema>;

export const ProcedureVersionSchema = z.object({
  id: z.string().uuid(),
  procedureId: z.string().uuid(),
  version: z.string().min(1),
  changes: z.string().min(1),
  snapshot: JsonSchema,
  createdBy: z.string().uuid(),
  createdAt: z.date(),
});
export type ProcedureVersion = z.infer<typeof ProcedureVersionSchema>;

export const ProcedureFieldTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional(),
  options: JsonSchema.optional(),
  required: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ProcedureFieldTemplate = z.infer<typeof ProcedureFieldTemplateSchema>;
