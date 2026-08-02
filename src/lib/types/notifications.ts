import { z } from "zod";

export const NotificationTypeSchema = z.enum(["info", "warning", "error", "success"]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  type: NotificationTypeSchema,
  read: z.boolean(),
  createdAt: z.date(),
});
export type Notification = z.infer<typeof NotificationSchema>;
