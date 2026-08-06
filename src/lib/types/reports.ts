import { z } from "zod";

export const ReportPointSchema = z.object({
  executorName: z.string().min(1),
  zone: z.string().min(1),
  service: z.string().min(1),
  hoursWorked: z.number().nonnegative(),
  text: z.string().min(1),
});
export type ReportPoint = z.infer<typeof ReportPointSchema>;

export const ReportSchema = z.object({
  id: z.string().uuid(),
  points: z.array(ReportPointSchema),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Report = z.infer<typeof ReportSchema>;

export const ReportInputSchema = ReportSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ReportInput = z.infer<typeof ReportInputSchema>;
