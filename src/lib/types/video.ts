import { z } from "zod";

export const MeetingSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  startedAt: z.date(),
  endedAt: z.date().optional(),
  participants: z.array(z.string().uuid()),
  recordingUrl: z.string().url().optional(),
});
export type Meeting = z.infer<typeof MeetingSchema>;

export const MeetingChatMessageSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  userId: z.string().uuid(),
  text: z.string().min(1),
  timestamp: z.date(),
});
export type MeetingChatMessage = z.infer<typeof MeetingChatMessageSchema>;
