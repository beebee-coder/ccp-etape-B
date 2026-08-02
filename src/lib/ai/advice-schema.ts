import { z } from "zod";

export const MediaRequirementRequestSchema = z.object({
  type: z.enum(["photo", "video", "audio", "signature"]),
  mandatory: z.boolean().default(false),
  options: z
    .object({
      geolocation: z.boolean().default(false),
      timestamp: z.boolean().default(false),
    })
    .optional(),
});

export const AlarmConfigRequestSchema = z.object({
  condition: z.string().min(1),
  threshold: z.string().optional(),
  type: z.enum(["DANGER", "WARNING", "INFO", "SECURITY_CHECK"]),
  message: z.string().min(1),
});

export const AdviceRequestSchema = z.object({
  step: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    instructions: z.string().min(1),
    type: z.enum([
      "consigne_simple",
      "saisie_donnees",
      "inspection_visuelle",
      "validation_securite",
      "mesure_numerique",
    ]),
    isMandatory: z.boolean().default(false),
    dependencies: z.array(z.string()).default([]),
    mediaRequirements: z.array(MediaRequirementRequestSchema).default([]),
    alarms: z.array(AlarmConfigRequestSchema).default([]),
    attachments: z.array(z.string()).default([]),
    order: z.number().min(0),
    timerEnabled: z.boolean().default(false),
    timerSeconds: z.number().min(0).default(0),
  }),
  stepIndex: z.number().int().min(0),
  totalSteps: z.number().int().min(1),
  phase: z.enum(["briefing", "prerequisites", "executing", "completed", "aborted"]),
  userMessage: z.string().optional(),
  context: z.string().optional(),
});

export type AdviceRequest = z.infer<typeof AdviceRequestSchema>;
