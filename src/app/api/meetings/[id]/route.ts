import { NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";
import {
  getMeetingById,
  endMeeting,
  EndMeetingSchema,
} from "@/lib/meetings/server-store";
import type { EndMeetingInput } from "@/lib/types/video";

const log = createLogger({ handler: "meetings-id" });

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const { id } = params;
  const userId = result.ctx.user.sub;
  log.debug("GET /api/meetings/[id]: fetching meeting", { id, userId });

  try {
    const meeting = await getMeetingById(id);
    if (!meeting) {
      log.warn("GET /api/meetings/[id]: meeting not found", { id, userId });
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const data = {
      ...meeting,
      startedAt: meeting.startedAt.toISOString(),
      endedAt: meeting.endedAt?.toISOString() ?? null,
    };
    return NextResponse.json({ data });
  } catch (error) {
    log.error("GET /api/meetings/[id]: failed to fetch meeting", {
      id,
      userId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to fetch meeting" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "meetings",
    schema: EndMeetingSchema,
  });
  if (!result.ok) return result.response;

  const { id } = params;
  const body = result.ctx.body as EndMeetingInput;
  const userId = result.ctx.user.sub;
  log.info("PUT /api/meetings/[id]: ending meeting", {
    id,
    userId,
    hasRecordingUrl: !!body.recordingUrl,
  });

  try {
    const meeting = await endMeeting(id, {
      endedAt: body.endedAt ? new Date(body.endedAt as string) : undefined,
      recordingUrl: body.recordingUrl,
    });

    if (!meeting) {
      log.warn("PUT /api/meetings/[id]: meeting not found for end", {
        id,
        userId,
      });
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const data = {
      ...meeting,
      startedAt: meeting.startedAt.toISOString(),
      endedAt: meeting.endedAt?.toISOString() ?? null,
    };
    return NextResponse.json({ data });
  } catch (error) {
    log.error("PUT /api/meetings/[id]: failed to end meeting", {
      id,
      userId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to update meeting" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const { id } = params;
  const userId = result.ctx.user.sub;
  log.info("DELETE /api/meetings/[id]: deleting meeting", { id, userId });

  try {
    const meeting = await endMeeting(id, {});
    if (!meeting) {
      log.warn("DELETE /api/meetings/[id]: meeting not found for deletion", {
        id,
        userId,
      });
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const data = {
      ...meeting,
      startedAt: meeting.startedAt.toISOString(),
      endedAt: meeting.endedAt?.toISOString() ?? null,
    };
    return NextResponse.json({ data });
  } catch (error) {
    log.error("DELETE /api/meetings/[id]: failed to delete meeting", {
      id,
      userId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to delete meeting" },
      { status: 500 },
    );
  }
}
