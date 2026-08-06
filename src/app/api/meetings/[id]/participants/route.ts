import { NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";
import {
  updateParticipantState,
  UpdateParticipantSchema,
} from "@/lib/meetings/server-store";
import type { UpdateParticipantInput } from "@/lib/types/video";

const log = createLogger({ handler: "meetings-participants" });

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "meeting-participants",
    schema: UpdateParticipantSchema,
  });
  if (!result.ok) return result.response;

  const { id } = params;
  const body = result.ctx.body as UpdateParticipantInput;
  const userId = result.ctx.user.sub;
  log.debug(
    "PATCH /api/meetings/[id]/participants: updating participant state",
    {
      meetingId: id,
      userId,
      updates: body,
    },
  );

  try {
    const meeting = await updateParticipantState(id, userId, body);
    if (!meeting) {
      log.warn(
        "PATCH /api/meetings/[id]/participants: meeting or participant not found",
        { meetingId: id, userId },
      );
      return NextResponse.json(
        { error: "Meeting or participant not found" },
        { status: 404 },
      );
    }

    const data = {
      ...meeting,
      startedAt: meeting.startedAt.toISOString(),
      endedAt: meeting.endedAt?.toISOString() ?? null,
    };
    return NextResponse.json({ data });
  } catch (error) {
    log.error(
      "PATCH /api/meetings/[id]/participants: failed to update participant state",
      {
        meetingId: id,
        userId,
        error,
      },
    );
    return NextResponse.json(
      { error: "Failed to update participant state" },
      { status: 500 },
    );
  }
}
