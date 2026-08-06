import { z } from "zod";

export const MeetingParticipantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  initials: z.string().length(2),
  isSelf: z.boolean().default(false),
  isMuted: z.boolean().default(false),
  isVideoOn: z.boolean().default(true),
});
export type MeetingParticipant = z.infer<typeof MeetingParticipantSchema>;

export const MeetingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  startedAt: z.date(),
  endedAt: z.date().optional(),
  participants: z.array(MeetingParticipantSchema),
  recordingUrl: z.string().url().optional(),
});
export type Meeting = z.infer<typeof MeetingSchema>;

export const CreateMeetingSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  participants: z.array(MeetingParticipantSchema).optional(),
  createdBy: z.string().min(1),
});
export type CreateMeetingInput = z.infer<typeof CreateMeetingSchema>;

export const EndMeetingSchema = z.object({
  endedAt: z.union([z.date(), z.string()]).optional(),
  recordingUrl: z.string().url().optional(),
});
export type EndMeetingInput = z.infer<typeof EndMeetingSchema>;

export const UpdateParticipantSchema = z.object({
  isMuted: z.boolean().optional(),
  isVideoOn: z.boolean().optional(),
});
export type UpdateParticipantInput = z.infer<typeof UpdateParticipantSchema>;

export const MeetingChatMessageSchema = z.object({
  id: z.string().min(1),
  meetingId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
  userInitials: z.string().length(2),
  isSelf: z.boolean().default(false),
  text: z.string().min(1),
  timestamp: z.date(),
});
export type MeetingChatMessage = z.infer<typeof MeetingChatMessageSchema>;

export const CreateMeetingChatMessageSchema = z.object({
  meetingId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
  userInitials: z.string().length(2),
  isSelf: z.boolean().optional(),
  text: z.string().min(1),
});
export type CreateMeetingChatMessageInput = z.infer<
  typeof CreateMeetingChatMessageSchema
>;
