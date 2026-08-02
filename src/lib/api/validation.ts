import type { z } from "zod";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export function validateContentType(
  request: Request,
  allowedTypes: string[] = ["application/json"]
): { valid: boolean; error?: string } {
  const contentType = request.headers.get("content-type") ?? "";
  const mainType = contentType.split(";")[0].trim().toLowerCase();

  if (!allowedTypes.some((type) => mainType === type.toLowerCase() || mainType.endsWith(`/${type.toLowerCase()}`))) {
    return {
      valid: false,
      error: `Content-Type '${contentType}' not allowed. Expected one of: ${allowedTypes.join(", ")}`,
    };
  }

  return { valid: true };
}

export function validateImageSize(
  dataUrl: string,
  maxBytes: number = MAX_IMAGE_SIZE
): { valid: boolean; error?: string } {
  if (!dataUrl.startsWith("data:")) {
    return { valid: false, error: "Invalid data URL format" };
  }

  const base64Part = dataUrl.split(",")[1];
  if (!base64Part) {
    return { valid: false, error: "Invalid data URL: no data found" };
  }

  const byteLength = Math.round((base64Part.length * 3) / 4);

  if (byteLength > maxBytes) {
    const maxMB = (maxBytes / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Image exceeds maximum size of ${maxMB}MB`,
    };
  }

  return { valid: true };
}

export function validateRequestBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string; details?: Record<string, string[]> } {
  const result = schema.safeParse(body);

  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, errors] of Object.entries(result.error.flatten().fieldErrors)) {
      if (errors) {
        fieldErrors[key] = errors as string[];
      }
    }
    return {
      success: false,
      error: "Validation failed",
      details: fieldErrors,
    };
  }

  return { success: true, data: result.data };
}

export function validateImageUploads(
  data: unknown,
  maxBytes: number = MAX_IMAGE_SIZE
): { valid: boolean; error?: string } {
  const checked = new Set<unknown>();

  function check(value: unknown): void {
    if (value === null || typeof value !== "object") return;
    if (checked.has(value)) return;
    checked.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        check(item);
      }
      return;
    }

    for (const entry of Object.values(value as Record<string, unknown>)) {
      if (typeof entry === "string" && entry.startsWith("data:image/")) {
        const result = validateImageSize(entry, maxBytes);
        if (!result.valid) {
          throw { valid: false, error: result.error };
        }
      } else if (typeof entry === "object" && entry !== null) {
        check(entry);
      }
    }
  }

  try {
    check(data);
    return { valid: true };
  } catch (e) {
    if (e && typeof e === "object" && "error" in e) {
      return e as { valid: false; error: string };
    }
    return { valid: false, error: "Invalid data URL format" };
  }
}

export { MAX_IMAGE_SIZE };
