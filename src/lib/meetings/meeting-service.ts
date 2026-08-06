import { apiClient } from "@/lib/api/client";
import type {
  Meeting,
  MeetingParticipant,
  MeetingChatMessage,
  CreateMeetingInput,
  CreateMeetingChatMessageInput,
  UpdateParticipantInput,
} from "@/lib/types/video";

export type {
  Meeting,
  MeetingParticipant,
  MeetingChatMessage,
  CreateMeetingInput,
  CreateMeetingChatMessageInput,
  UpdateParticipantInput,
};

export interface AuthenticatedUser {
  id: string;
  firstName?: string;
  lastName?: string;
  role: string;
  email?: string;
}

interface ApiMeeting {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  createdBy: string;
  participants: unknown[];
  recordingUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiChatMessage {
  id: string;
  meetingId: string;
  userId: string;
  userName: string;
  userInitials: string;
  isSelf: boolean;
  text: string;
  timestamp: string;
}

function toClientMeeting(api: ApiMeeting): Meeting {
  return {
    id: api.id,
    title: api.title,
    startedAt: new Date(api.startedAt),
    endedAt: api.endedAt ? new Date(api.endedAt) : undefined,
    participants: (api.participants ?? []) as Meeting["participants"],
    recordingUrl: api.recordingUrl || undefined,
  };
}

function toClientMessage(api: ApiChatMessage): MeetingChatMessage {
  return {
    id: api.id,
    meetingId: api.meetingId,
    userId: api.userId,
    userName: api.userName,
    userInitials: api.userInitials,
    isSelf: api.isSelf,
    text: api.text,
    timestamp: new Date(api.timestamp),
  };
}

export const meetingService = {
  async getCurrentUser(): Promise<AuthenticatedUser | null> {
    try {
      const res = await apiClient.get<
        {
          id: string;
          firstName?: string;
          lastName?: string;
          role: string;
          email?: string;
        } & {
          user?: {
            id: string;
            firstName?: string;
            lastName?: string;
            role: string;
            email?: string;
          };
        }
      >("/api/auth/me");
      const user = res.user || res;
      if (!user || !user.id) return null;
      console.log("[meeting-service] getCurrentUser: user resolved", {
        userId: user.id,
        role: user.role,
      });
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        email: user.email,
      };
    } catch (error) {
      console.error(
        "[meeting-service] getCurrentUser: failed to fetch current user",
        { error },
      );
      return null;
    }
  },

  async getActiveMeetingForUser(userId: string): Promise<Meeting | null> {
    try {
      const res = await apiClient.get<{ data: ApiMeeting[] } & ApiMeeting[]>(
        "/api/meetings",
      );
      const meetings: ApiMeeting[] =
        (res as { data?: ApiMeeting[] }).data ??
        (Array.isArray(res) ? (res as ApiMeeting[]) : []);
      const active = meetings.find(
        (m) => m.endedAt === null && m.createdBy === userId,
      );
      if (active) {
        console.log(
          "[meeting-service] getActiveMeetingForUser: active meeting found",
          { meetingId: active.id, userId },
        );
        return toClientMeeting(active);
      }
      console.log(
        "[meeting-service] getActiveMeetingForUser: no active meeting",
        { userId },
      );
      return null;
    } catch (error) {
      console.error(
        "[meeting-service] getActiveMeetingForUser: failed to fetch meetings",
        { userId, error },
      );
      return null;
    }
  },

  async createMeeting(input: CreateMeetingInput): Promise<Meeting | null> {
    try {
      const res = await apiClient.post<{ data: ApiMeeting } & ApiMeeting>(
        "/api/meetings",
        input,
      );
      const apiMeeting: ApiMeeting | undefined =
        (res as { data?: ApiMeeting }).data ?? (res as ApiMeeting | undefined);
      if (!apiMeeting) {
        console.error(
          "[meeting-service] createMeeting: no meeting returned from API",
        );
        return null;
      }
      console.log("[meeting-service] createMeeting: meeting created", {
        meetingId: apiMeeting.id,
        title: apiMeeting.title,
      });
      return toClientMeeting(apiMeeting);
    } catch (error) {
      console.error(
        "[meeting-service] createMeeting: failed to create meeting",
        { error },
      );
      return null;
    }
  },

  async getMeeting(id: string): Promise<Meeting | null> {
    try {
      const res = await apiClient.get<{ data: ApiMeeting } & ApiMeeting>(
        `/api/meetings/${encodeURIComponent(id)}`,
      );
      const apiMeeting: ApiMeeting | undefined =
        (res as { data?: ApiMeeting }).data ?? (res as ApiMeeting | undefined);
      if (!apiMeeting) {
        console.error(
          "[meeting-service] getMeeting: no meeting returned from API",
          { id },
        );
        return null;
      }
      return toClientMeeting(apiMeeting);
    } catch (error) {
      console.error("[meeting-service] getMeeting: failed to fetch meeting", {
        id,
        error,
      });
      return null;
    }
  },

  async endMeeting(id: string): Promise<Meeting | null> {
    try {
      const res = await apiClient.put<{ data: ApiMeeting } & ApiMeeting>(
        `/api/meetings/${encodeURIComponent(id)}`,
        {},
      );
      const apiMeeting: ApiMeeting | undefined =
        (res as { data?: ApiMeeting }).data ?? (res as ApiMeeting | undefined);
      if (!apiMeeting) {
        console.error(
          "[meeting-service] endMeeting: no meeting returned from API",
          { id },
        );
        return null;
      }
      console.log("[meeting-service] endMeeting: meeting ended", {
        meetingId: id,
      });
      return toClientMeeting(apiMeeting);
    } catch (error) {
      console.error("[meeting-service] endMeeting: failed to end meeting", {
        id,
        error,
      });
      return null;
    }
  },

  async deleteMeeting(id: string): Promise<boolean> {
    try {
      await apiClient.delete(`/api/meetings/${encodeURIComponent(id)}`);
      console.log("[meeting-service] deleteMeeting: meeting deleted", { id });
      return true;
    } catch (error) {
      console.error(
        "[meeting-service] deleteMeeting: failed to delete meeting",
        { id, error },
      );
      return false;
    }
  },

  async getChatMessages(meetingId: string): Promise<MeetingChatMessage[]> {
    try {
      const res = await apiClient.get<
        { data: ApiChatMessage[] } & ApiChatMessage[]
      >(`/api/meetings/${encodeURIComponent(meetingId)}/messages`);
      const messages: ApiChatMessage[] =
        (res as { data?: ApiChatMessage[] }).data ??
        (Array.isArray(res) ? (res as ApiChatMessage[]) : []);
      console.log("[meeting-service] getChatMessages: messages fetched", {
        meetingId,
        count: messages.length,
      });
      return messages.map(toClientMessage);
    } catch (error) {
      console.error(
        "[meeting-service] getChatMessages: failed to fetch messages",
        { meetingId, error },
      );
      return [];
    }
  },

  async sendChatMessage(
    meetingId: string,
    message: Omit<CreateMeetingChatMessageInput, "meetingId">,
  ): Promise<MeetingChatMessage | null> {
    try {
      const res = await apiClient.post<
        { data: ApiChatMessage } & ApiChatMessage
      >(`/api/meetings/${encodeURIComponent(meetingId)}/messages`, {
        meetingId,
        ...message,
      });
      const apiMessage: ApiChatMessage | undefined =
        (res as { data?: ApiChatMessage }).data ??
        (res as ApiChatMessage | undefined);
      if (!apiMessage) {
        console.error(
          "[meeting-service] sendChatMessage: no message returned from API",
          { meetingId },
        );
        return null;
      }
      console.log("[meeting-service] sendChatMessage: message sent", {
        meetingId,
        messageId: apiMessage.id,
      });
      return toClientMessage(apiMessage);
    } catch (error) {
      console.error(
        "[meeting-service] sendChatMessage: failed to send message",
        { meetingId, error },
      );
      return null;
    }
  },

  async updateParticipantState(
    meetingId: string,
    updates: UpdateParticipantInput,
  ): Promise<Meeting | null> {
    try {
      const res = await apiClient.patch<{ data: ApiMeeting } & ApiMeeting>(
        `/api/meetings/${encodeURIComponent(meetingId)}/participants`,
        updates,
      );
      const apiMeeting: ApiMeeting | undefined =
        (res as { data?: ApiMeeting }).data ?? (res as ApiMeeting | undefined);
      if (!apiMeeting) {
        console.error(
          "[meeting-service] updateParticipantState: no meeting returned from API",
          { meetingId },
        );
        return null;
      }
      return toClientMeeting(apiMeeting);
    } catch (error) {
      console.error(
        "[meeting-service] updateParticipantState: failed to update participant state",
        { meetingId, error },
      );
      return null;
    }
  },
};
