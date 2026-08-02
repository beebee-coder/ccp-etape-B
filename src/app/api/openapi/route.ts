import { NextResponse } from "next/server";
import { generateOpenApiSpec } from "@/lib/schemas/openapi";

export async function GET() {
  return NextResponse.json(generateOpenApiSpec());
}