import { NextResponse } from "next/server";
import { getAll, create, getCategories } from "@/lib/images/server-store";
import { MediaItemInputSchema } from "@/lib/images/server-store";
import { validateApiRequest } from "@/lib/api/handlers";

export async function GET(request: Request) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  try {
    const [items, categories] = await Promise.all([getAll(), getCategories()]);
    return NextResponse.json({ data: items, meta: { categories } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "procedures",
    schema: MediaItemInputSchema,
    validateImageUpload: true,
  });
  if (!result.ok) return result.response;

  try {
    const createdItem = await create(result.ctx.body as Parameters<typeof create>[0]);
    return NextResponse.json({ data: createdItem }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}
