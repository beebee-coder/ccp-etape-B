import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { createLogger } from "@/lib/logger";

import {
  MeetingParticipantSchema,
  MeetingSchema,
  MeetingChatMessageSchema,
  CreateMeetingSchema,
  CreateMeetingChatMessageSchema,
  EndMeetingSchema,
  UpdateParticipantSchema,
  type Meeting,
  type MeetingParticipant,
  type MeetingChatMessage,
  type CreateMeetingInput,
  type CreateMeetingChatMessageInput,
  type EndMeetingInput,
  type UpdateParticipantInput,
} from "@/lib/types/video";

const log = createLogger({ module: "meetings-server-store" });

function parseParticipants(raw: unknown): MeetingParticipant[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    try {
      return raw.map((p) => MeetingParticipantSchema.parse(p));
    } catch (error) {
      log.warn("parseParticipants: failed to parse participant array", {
        error,
      });
      return [];
    }
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((p) => MeetingParticipantSchema.parse(p))
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToMeeting(row: {
  id: string;
  title: string;
  startedAt: Date;
  endedAt: Date | null;
  createdBy: string;
  participants: unknown;
  recordingUrl: string | null;
}): Meeting {
  return {
    id: row.id,
    title: row.title,
    startedAt: row.startedAt,
    endedAt: row.endedAt ?? undefined,
    participants: parseParticipants(row.participants),
    recordingUrl: row.recordingUrl || undefined,
  };
}

function rowToChatMessage(row: {
  id: string;
  meetingId: string;
  userId: string;
  userName: string;
  userInitials: string;
  isSelf: boolean;
  text: string;
  timestamp: Date;
}): MeetingChatMessage {
  return {
    id: row.id,
    meetingId: row.meetingId,
    userId: row.userId,
    userName: row.userName,
    userInitials: row.userInitials,
    isSelf: row.isSelf,
    text: row.text,
    timestamp: row.timestamp,
  };
}

export async function getAllMeetings(): Promise<Meeting[]> {
  log.info("getAllMeetings: fetching all meetings");
  try {
    const meetings = await prisma.meeting.findMany({
      orderBy: { startedAt: "desc" },
      include: {
        chatMessages: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    const result = meetings.map((m) =>
      rowToMeeting({
        id: m.id,
        title: m.title,
        startedAt: m.startedAt,
        endedAt: m.endedAt,
        createdBy: m.createdBy,
        participants: m.participants,
        recordingUrl: m.recordingUrl,
      }),
    );

    log.info("getAllMeetings: fetched meetings", { count: result.length });
    return result;
  } catch (error) {
    log.error("getAllMeetings: failed to fetch meetings", { error });
    throw error;
  }
}

export async function getActiveMeeting(
  createdBy: string,
): Promise<Meeting | null> {
  log.info("getActiveMeeting: fetching active meeting", { createdBy });
  try {
    const meeting = await prisma.meeting.findFirst({
      where: {
        endedAt: null,
        createdBy,
      },
      orderBy: { startedAt: "desc" },
    });

    if (!meeting) {
      log.debug("getActiveMeeting: no active meeting found", { createdBy });
      return null;
    }

    const result = rowToMeeting({
      id: meeting.id,
      title: meeting.title,
      startedAt: meeting.startedAt,
      endedAt: meeting.endedAt,
      createdBy: meeting.createdBy,
      participants: meeting.participants,
      recordingUrl: meeting.recordingUrl,
    });

    log.info("getActiveMeeting: active meeting found", {
      meetingId: result.id,
      createdBy,
    });
    return result;
  } catch (error) {
    log.error("getActiveMeeting: failed to fetch active meeting", {
      createdBy,
      error,
    });
    throw error;
  }
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  log.info("getMeetingById: fetching meeting", { id });
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
    });

    if (!meeting) {
      log.warn("getMeetingById: meeting not found", { id });
      return null;
    }

    const result = rowToMeeting({
      id: meeting.id,
      title: meeting.title,
      startedAt: meeting.startedAt,
      endedAt: meeting.endedAt,
      createdBy: meeting.createdBy,
      participants: meeting.participants,
      recordingUrl: meeting.recordingUrl,
    });

    log.info("getMeetingById: meeting found", { id, title: result.title });
    return result;
  } catch (error) {
    log.error("getMeetingById: failed to fetch meeting", { id, error });
    throw error;
  }
}

export async function createMeeting(
  input: CreateMeetingInput,
): Promise<Meeting> {
  const validated = CreateMeetingSchema.parse(input);
  log.info("createMeeting: creating new meeting", {
    title: validated.title,
    createdBy: validated.createdBy,
  });

  const participants = validated.participants || [];

  try {
    const meeting = await prisma.meeting.create({
      data: {
        id: crypto.randomUUID(),
        title: validated.title,
        createdBy: validated.createdBy,
        participants: participants as unknown as Prisma.InputJsonValue,
      },
    });

    const result = rowToMeeting({
      id: meeting.id,
      title: meeting.title,
      startedAt: meeting.startedAt,
      endedAt: meeting.endedAt,
      createdBy: meeting.createdBy,
      participants: meeting.participants,
      recordingUrl: meeting.recordingUrl,
    });

    log.info("createMeeting: meeting created successfully", {
      meetingId: result.id,
      title: result.title,
    });
    return result;
  } catch (error) {
    log.error("createMeeting: failed to create meeting", {
      title: validated.title,
      createdBy: validated.createdBy,
      error,
    });
    throw error;
  }
}

export async function endMeeting(
  id: string,
  input: EndMeetingInput,
): Promise<Meeting | null> {
  const validated = EndMeetingSchema.parse(input);
  log.info("endMeeting: ending meeting", {
    id,
    hasRecordingUrl: !!validated.recordingUrl,
  });

  const endedAt = validated.endedAt
    ? new Date(validated.endedAt)
    : new Date();

  try {
    const meeting = await prisma.meeting.update({
      where: { id },
      data: {
        endedAt,
        recordingUrl: validated.recordingUrl || undefined,
      },
    });

    const result = rowToMeeting({
      id: meeting.id,
      title: meeting.title,
      startedAt: meeting.startedAt,
      endedAt: meeting.endedAt,
      createdBy: meeting.createdBy,
      participants: meeting.participants,
      recordingUrl: meeting.recordingUrl,
    });

    log.info("endMeeting: meeting ended successfully", {
      meetingId: result.id,
      durationMs: result.endedAt
        ? result.endedAt.getTime() - result.startedAt.getTime()
        : undefined,
    });
    return result;
  } catch (error) {
    log.error("endMeeting: failed to end meeting", { id, error });
    throw error;
  }
}

export async function updateMeetingParticipants(
  meetingId: string,
  participantId: string,
  input: UpdateParticipantInput,
): Promise<Meeting | null> {
  const validated = UpdateParticipantSchema.parse(input);
  log.info("updateMeetingParticipants: updating participant state", {
    meetingId,
    participantId,
    input: validated,
  });

  try {
    const meeting = await getMeetingById(meetingId);
    if (!meeting) {
      log.warn("updateMeetingParticipants: meeting not found", {
        meetingId,
      });
      return null;
    }

    const updatedParticipants = meeting.participants.map((p) => {
      if (p.id === participantId) {
        return { ...p, ...validated };
      }
      return p;
    });

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        participants: updatedParticipants as unknown as Prisma.InputJsonValue,
      },
    });

    const result = rowToMeeting({
      id: updated.id,
      title: updated.title,
      startedAt: updated.startedAt,
      endedAt: updated.endedAt,
      createdBy: updated.createdBy,
      participants: updated.participants,
      recordingUrl: updated.recordingUrl,
    });

    log.info("updateMeetingParticipants: participant state updated", {
      meetingId,
      participantId,
    });
    return result;
  } catch (error) {
    log.error("updateMeetingParticipants: failed to update participant state", {
      meetingId,
      participantId,
      error,
    });
    throw error;
  }
}

export async function getChatMessages(
  meetingId: string,
): Promise<MeetingChatMessage[]> {
  log.info("getChatMessages: fetching chat messages", { meetingId });
  try {
    const messages = await prisma.meetingChatMessage.findMany({
      where: { meetingId },
      orderBy: { timestamp: "asc" },
    });

    log.info("getChatMessages: fetched messages", {
      meetingId,
      count: messages.length,
    });
    return messages.map(rowToChatMessage);
  } catch (error) {
    log.error("getChatMessages: failed to fetch chat messages", {
      meetingId,
      error,
    });
    throw error;
  }
}

export async function addChatMessage(
  input: CreateMeetingChatMessageInput,
): Promise<MeetingChatMessage> {
  const validated = CreateMeetingChatMessageSchema.parse(input);
  log.info("addChatMessage: adding chat message", {
    meetingId: validated.meetingId,
    userId: validated.userId,
    isSelf: validated.isSelf ?? false,
  });

  try {
    const message = await prisma.meetingChatMessage.create({
      data: {
        id: crypto.randomUUID(),
        meetingId: validated.meetingId,
        userId: validated.userId,
        userName: validated.userName,
        userInitials: validated.userInitials,
        isSelf: validated.isSelf ?? false,
        text: validated.text,
      },
    });

    const result = rowToChatMessage(message);
    log.info("addChatMessage: message added successfully", {
      messageId: result.id,
      meetingId: validated.meetingId,
      userId: validated.userId,
    });
    return result;
  } catch (error) {
    log.error("addChatMessage: failed to add chat message", {
      meetingId: validated.meetingId,
      userId: validated.userId,
      error,
    });
    throw error;
  }
}

export async function updateParticipantState(
  meetingId: string,
  participantId: string,
  updates: UpdateParticipantInput,
): Promise<Meeting | null> {
  log.debug("updateParticipantState: delegating to updateMeetingParticipants", {
    meetingId,
    participantId,
    updates,
  });
  return updateMeetingParticipants(meetingId, participantId, updates);
}

export {
  MeetingSchema,
  MeetingChatMessageSchema,
  CreateMeetingSchema,
  CreateMeetingChatMessageSchema,
  EndMeetingSchema,
  UpdateParticipantSchema,
};
export type {
  Meeting,
  MeetingParticipant,
  MeetingChatMessage,
  CreateMeetingInput,
  CreateMeetingChatMessageInput,
  EndMeetingInput,
  UpdateParticipantInput,
};
