import { NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";
import {
  getChatMessages,
  addChatMessage,
  CreateMeetingChatMessageSchema,
  getMeetingById,
} from "@/lib/meetings/server-store";
import type { CreateMeetingChatMessageInput } from "@/lib/types/video";

const log = createLogger({ handler: "meetings-messages" });

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const { id } = params;
  const userId = result.ctx.user.sub;
  log.debug("GET /api/meetings/[id]/messages: fetching chat messages", {
    meetingId: id,
    userId,
  });

  try {
    const meeting = await getMeetingById(id);
    if (!meeting) {
      log.warn("GET /api/meetings/[id]/messages: meeting not found", {
        meetingId: id,
        userId,
      });
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const messages = await getChatMessages(id);
    const data = messages.map((m) => ({
      ...m,
      timestamp: m.timestamp.toISOString(),
    }));
    return NextResponse.json({ data });
  } catch (error) {
    log.error("GET /api/meetings/[id]/messages: failed to fetch messages", {
      meetingId: id,
      userId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "meeting-messages",
    schema: CreateMeetingChatMessageSchema,
  });
  if (!result.ok) return result.response;

  const { id } = params;
  const body = result.ctx.body as CreateMeetingChatMessageInput;
  const userId = result.ctx.user.sub;
  log.debug("POST /api/meetings/[id]/messages: adding message", {
    meetingId: id,
    userId,
  });

  try {
    const meeting = await getMeetingById(id);
    if (!meeting) {
      log.warn("POST /api/meetings/[id]/messages: meeting not found", {
        meetingId: id,
        userId,
      });
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const messageInput: CreateMeetingChatMessageInput = {
      meetingId: id,
      userId: body.userId,
      userName: body.userName,
      userInitials: body.userInitials,
      isSelf: body.isSelf ?? false,
      text: body.text,
    };

    const message = await addChatMessage(messageInput);
    const data = {
      ...message,
      timestamp: message.timestamp.toISOString(),
    };
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    log.error("POST /api/meetings/[id]/messages: failed to add message", {
      meetingId: id,
      userId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to add message" },
      { status: 500 },
    );
  }
}
