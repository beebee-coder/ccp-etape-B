import { NextResponse } from "next/server";
import { getById, update, remove } from "@/lib/images/server-store";
import { MediaItemSchema, type MediaItem } from "@/lib/images/server-store";
import { validateApiRequest } from "@/lib/api/handlers";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const item = await getById(params.id);
  if (!item) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
  return NextResponse.json({ data: item });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    schema: MediaItemSchema,
    validateImageUpload: true,
  });
  if (!result.ok) return result.response;

  const validated = result.ctx.body as MediaItem;
  const mutable = { ...validated };
  delete (mutable as Partial<Record<string, unknown>>).id;
  delete (mutable as Partial<Record<string, unknown>>).createdAt;

  try {
    const item = await update(params.id, validated as Partial<Omit<MediaItem, "id" | "createdAt">>);
    if (!item) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    return NextResponse.json({ data: item });
  } catch {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const success = await remove(params.id);
  if (!success) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
  return NextResponse.json({ data: { success: true } });
}
