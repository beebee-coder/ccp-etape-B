import { NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";
import {
  getAllMeetings,
  createMeeting,
  getActiveMeeting,
  CreateMeetingSchema,
} from "@/lib/meetings/server-store";
import type { CreateMeetingInput } from "@/lib/types/video";

const log = createLogger({ handler: "meetings" });

export async function GET(request: Request) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const userId = result.ctx.user.sub;
  log.debug("GET /api/meetings: listing meetings", { userId });

  try {
    const allMeetings = await getAllMeetings();
    const data = allMeetings.map((m) => ({
      ...m,
      startedAt: m.startedAt.toISOString(),
      endedAt: m.endedAt?.toISOString() ?? null,
    }));
    return NextResponse.json({ data });
  } catch (error) {
    log.error("GET /api/meetings: failed to fetch meetings", { userId, error });
    return NextResponse.json(
      { error: "Failed to fetch meetings" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "meetings",
    schema: CreateMeetingSchema,
  });
  if (!result.ok) return result.response;

  const body = result.ctx.body as CreateMeetingInput;
  const userId = result.ctx.user.sub;
  const firstName = result.ctx.user.firstName || "Utilisateur";
  const lastName = result.ctx.user.lastName || "";

  log.info("POST /api/meetings: creating meeting", {
    title: body.title,
    createdBy: userId,
  });

  try {
    const existing = await getActiveMeeting(userId);
    if (existing) {
      log.debug("POST /api/meetings: active meeting already exists", {
        meetingId: existing.id,
      });
      const data = {
        ...existing,
        startedAt: existing.startedAt.toISOString(),
        endedAt: existing.endedAt?.toISOString() ?? null,
      };
      return NextResponse.json({ data, alreadyActive: true }, { status: 200 });
    }

    const initials =
      `${firstName.charAt(0)}${lastName ? lastName.charAt(0) : ""}`.toUpperCase();
    const participant = {
      id: userId,
      name: `${firstName}${lastName ? " " + lastName : ""}`,
      email: `${firstName.toLowerCase()}@nexaflow.local`,
      initials: initials || "UN",
      isSelf: true,
      isMuted: false,
      isVideoOn: true,
    };

    const meeting = await createMeeting({
      title: body.title,
      participants: [participant],
      createdBy: userId,
    });

    const data = {
      ...meeting,
      startedAt: meeting.startedAt.toISOString(),
      endedAt: meeting.endedAt?.toISOString() ?? null,
    };
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    log.error("POST /api/meetings: failed to create meeting", {
      title: body.title,
      createdBy: userId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 },
    );
  }
}
