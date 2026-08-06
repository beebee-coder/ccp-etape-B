import { query } from "@/lib/db";
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

interface MeetingRow {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  created_by: string;
  participants: string;
  recording_url: string | null;
  created_at: string;
  updated_at: string;
}

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

function serializeParticipants(participants: MeetingParticipant[]): string {
  return JSON.stringify(participants);
}

function rowToMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    title: row.title,
    startedAt: new Date(row.started_at),
    endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
    participants: parseParticipants(row.participants),
    recordingUrl: row.recording_url || undefined,
  };
}

interface ChatMessageRow {
  id: string;
  meeting_id: string;
  user_id: string;
  user_name: string;
  user_initials: string;
  is_self: number | boolean;
  text: string;
  timestamp: string;
}

function rowToChatMessage(row: ChatMessageRow): MeetingChatMessage {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    userId: row.user_id,
    userName: row.user_name,
    userInitials: row.user_initials,
    isSelf: typeof row.is_self === "number" ? row.is_self === 1 : !!row.is_self,
    text: row.text,
    timestamp: new Date(row.timestamp),
  };
}

export async function getAllMeetings(): Promise<Meeting[]> {
  log.info("getAllMeetings: fetching all meetings");
  try {
    const result = await query<MeetingRow>(
      `SELECT id, title, started_at, ended_at, created_by, participants, recording_url, created_at, updated_at
       FROM meetings
       ORDER BY started_at DESC`,
    );

    const meetings = result.rows.map(rowToMeeting);
    log.info("getAllMeetings: fetched meetings", { count: meetings.length });
    return meetings;
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
    const result = await query<MeetingRow>(
      `SELECT id, title, started_at, ended_at, created_by, participants, recording_url, created_at, updated_at
       FROM meetings
       WHERE ended_at IS NULL AND created_by = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [createdBy],
    );

    if (result.rows.length === 0) {
      log.debug("getActiveMeeting: no active meeting found", { createdBy });
      return null;
    }

    const meeting = rowToMeeting(result.rows[0]);
    log.info("getActiveMeeting: active meeting found", {
      meetingId: meeting.id,
      createdBy,
    });
    return meeting;
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
    const result = await query<MeetingRow>(
      `SELECT id, title, started_at, ended_at, created_by, participants, recording_url, created_at, updated_at
       FROM meetings
       WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      log.warn("getMeetingById: meeting not found", { id });
      return null;
    }

    const meeting = rowToMeeting(result.rows[0]);
    log.info("getMeetingById: meeting found", { id, title: meeting.title });
    return meeting;
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

  const now = new Date().toISOString();
  const participants = validated.participants || [];

  try {
    const result = await query<MeetingRow>(
      `INSERT INTO meetings (title, started_at, ended_at, created_by, participants, recording_url, created_at, updated_at)
       VALUES ($1, $2, NULL, $3, $4, NULL, $5, $5)
       RETURNING id, title, started_at, ended_at, created_by, participants, recording_url, created_at, updated_at`,
      [
        validated.title,
        now,
        validated.createdBy,
        serializeParticipants(participants),
        now,
      ],
    );

    const meeting = rowToMeeting(result.rows[0]);
    log.info("createMeeting: meeting created successfully", {
      meetingId: meeting.id,
      title: meeting.title,
    });
    return meeting;
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

  const now = new Date().toISOString();
  const endedAt = validated.endedAt
    ? new Date(validated.endedAt).toISOString()
    : now;

  try {
    const result = await query<MeetingRow>(
      `UPDATE meetings
       SET ended_at = $1, recording_url = COALESCE($2, recording_url), updated_at = $3
       WHERE id = $4
       RETURNING id, title, started_at, ended_at, created_by, participants, recording_url, created_at, updated_at`,
      [endedAt, validated.recordingUrl || null, now, id],
    );

    if (result.rows.length === 0) {
      log.warn("endMeeting: meeting not found", { id });
      return null;
    }

    const meeting = rowToMeeting(result.rows[0]);
    log.info("endMeeting: meeting ended successfully", {
      meetingId: meeting.id,
      durationMs: meeting.endedAt
        ? meeting.endedAt.getTime() - meeting.startedAt.getTime()
        : undefined,
    });
    return meeting;
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
        participantId,
      });
      return null;
    }

    const updatedParticipants = meeting.participants.map((p) => {
      if (p.id === participantId) {
        return { ...p, ...validated };
      }
      return p;
    });

    const now = new Date().toISOString();
    const result = await query<MeetingRow>(
      `UPDATE meetings
       SET participants = $1, updated_at = $2
       WHERE id = $3
       RETURNING id, title, started_at, ended_at, created_by, participants, recording_url, created_at, updated_at`,
      [serializeParticipants(updatedParticipants), now, meetingId],
    );

    const updated = rowToMeeting(result.rows[0]);
    log.info("updateMeetingParticipants: participant state updated", {
      meetingId,
      participantId,
    });
    return updated;
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
    const result = await query<ChatMessageRow>(
      `SELECT id, meeting_id, user_id, user_name, user_initials, is_self, text, timestamp
       FROM meeting_chat_messages
       WHERE meeting_id = $1
       ORDER BY timestamp ASC`,
      [meetingId],
    );

    const messages = result.rows.map(rowToChatMessage);
    log.info("getChatMessages: fetched messages", {
      meetingId,
      count: messages.length,
    });
    return messages;
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

  const now = new Date().toISOString();

  try {
    const result = await query<ChatMessageRow>(
      `INSERT INTO meeting_chat_messages (meeting_id, user_id, user_name, user_initials, is_self, text, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, meeting_id, user_id, user_name, user_initials, is_self, text, timestamp`,
      [
        validated.meetingId,
        validated.userId,
        validated.userName,
        validated.userInitials,
        validated.isSelf ?? false,
        validated.text,
        now,
      ],
    );

    const message = rowToChatMessage(result.rows[0]);
    log.info("addChatMessage: message added successfully", {
      messageId: message.id,
      meetingId: validated.meetingId,
      userId: validated.userId,
    });
    return message;
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
