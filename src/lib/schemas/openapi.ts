import { z } from "zod";

import {
  PipelineConfigSchema,
  AdviceRequestSchema,
  AIChatRequestSchema,
  MediaItemSchema,
  MediaItemInputSchema,
  EtatDesLieuxReportSchema,
  EtatDesLieuxReportInputSchema,
  MediaAttachmentSchema,
  ProcedureSchema,
  StepSchema,
  MetadataSchema,
  MediaRequirementSchema,
  AlarmConfigSchema,
  ActuatorToggleSchema,
} from "@/lib/schemas";

type ZodSchema = z.ZodTypeAny;

interface OpenApiSchema {
  type?: string;
  format?: string;
  enum?: unknown[];
  items?: OpenApiSchema;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  description?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  default?: unknown;
  oneOf?: OpenApiSchema[];
  allOf?: OpenApiSchema[];
  additionalProperties?: boolean | OpenApiSchema;
  $ref?: string;
  tuple?: OpenApiSchema[];
}

function isOptional(schema: ZodSchema): boolean {
  return schema.isOptional() || schema instanceof z.ZodDefault;
}

function zodTypeToOpenAPIType(schema: ZodSchema): OpenApiSchema {
  if (schema instanceof z.ZodEffects) {
    return zodTypeToOpenAPIType((schema as unknown as { _def: { innerType: ZodSchema } })._def.innerType);
  }

  if (schema instanceof z.ZodOptional) {
    const result = zodTypeToOpenAPIType(schema.unwrap());
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema instanceof z.ZodDefault) {
    const def = schema._def as { innerType: ZodSchema; defaultValue: unknown };
    const result = zodTypeToOpenAPIType(def.innerType);
    if (def.defaultValue !== undefined) {
      result.default = typeof def.defaultValue === "function" ? (def.defaultValue as () => unknown)() : def.defaultValue;
    }
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema instanceof z.ZodLiteral) {
    return { type: "string", enum: [schema.value] };
  }

  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: schema.options };
  }

  if (schema instanceof z.ZodArray) {
    const itemType = zodTypeToOpenAPIType(schema.element);
    const result: OpenApiSchema = {
      type: "array",
      items: itemType,
    };
    const def = schema._def as { minLength?: { value: number }; maxLength?: { value: number } };
    if (def.minLength) result.minItems = def.minLength.value;
    if (def.maxLength) result.maxItems = def.maxLength.value;
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, ZodSchema>;
    const properties: Record<string, OpenApiSchema> = {};
    const required: string[] = [];

    for (const [key, valueSchema] of Object.entries(shape)) {
      properties[key] = zodTypeToOpenAPIType(valueSchema);
      if (!isOptional(valueSchema)) {
        required.push(key);
      }
    }

    const result: OpenApiSchema = {
      type: "object",
      properties,
      required,
    };
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema instanceof z.ZodString) {
    const result: OpenApiSchema = { type: "string" };
    const def = schema._def as { checks?: Array<{ kind: string; value?: number; regex?: RegExp }> };
    if (def.checks) {
      for (const check of def.checks) {
        if (check.kind === "minLength" && check.value !== undefined) {
          result.minLength = check.value;
        }
        if (check.kind === "maxLength" && check.value !== undefined) {
          result.maxLength = check.value;
        }
        if (check.kind === "regex" && check.regex) {
          result.pattern = check.regex.source;
        }
        if (check.kind === "email") {
          result.format = "email";
        }
        if (check.kind === "uuid") {
          result.format = "uuid";
        }
        if (check.kind === "uri") {
          result.format = "uri";
        }
      }
    }
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema instanceof z.ZodNumber) {
    const result: OpenApiSchema = { type: "number" };
    const def = schema._def as { checks?: Array<{ kind: string; value: number }> };
    let isInt = false;
    if (def.checks) {
      for (const check of def.checks) {
        if (check.kind === "min") {
          result.minimum = check.value;
        }
        if (check.kind === "max") {
          result.maximum = check.value;
        }
        if (check.kind === "gt") {
          result.exclusiveMinimum = check.value;
        }
        if (check.kind === "lt") {
          result.exclusiveMaximum = check.value;
        }
        if (check.kind === "int") {
          isInt = true;
        }
      }
    }
    if (isInt) result.type = "integer";
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema instanceof z.ZodBoolean) {
    const result: OpenApiSchema = { type: "boolean" };
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema instanceof z.ZodNull) {
    return { type: "null" };
  }

  if (schema instanceof z.ZodUnion) {
    return { oneOf: schema.options.map((opt: ZodSchema) => zodTypeToOpenAPIType(opt)) };
  }

  if (schema instanceof z.ZodIntersection) {
    const def = schema._def as { left: ZodSchema; right: ZodSchema };
    return {
      allOf: [zodTypeToOpenAPIType(def.left), zodTypeToOpenAPIType(def.right)],
    };
  }

  if (schema instanceof z.ZodRecord) {
    return {
      type: "object",
      additionalProperties: true,
    };
  }

  if (schema instanceof z.ZodTuple) {
    const def = schema._def as { items: ZodSchema[] };
    const items = def.items.map((item: ZodSchema) => zodTypeToOpenAPIType(item));
    const result: OpenApiSchema = { type: "array", items: items[0] };
    if (items.length > 1) result.tuple = items;
    return result;
  }

  return { type: "string" };
}

function schemaToComponent(schema: ZodSchema): OpenApiSchema {
  return zodTypeToOpenAPIType(schema);
}

const SHARED_SCHEMAS: Record<string, ZodSchema> = {
  PipelineConfig: PipelineConfigSchema,
  AdviceRequest: AdviceRequestSchema,
  AIChatRequest: AIChatRequestSchema,
  MediaItem: MediaItemSchema,
  MediaItemInput: MediaItemInputSchema,
  EtatDesLieuxReport: EtatDesLieuxReportSchema,
  EtatDesLieuxReportInput: EtatDesLieuxReportInputSchema,
  MediaAttachment: MediaAttachmentSchema,
  Procedure: ProcedureSchema,
  Step: StepSchema,
  Metadata: MetadataSchema,
  MediaRequirement: MediaRequirementSchema,
  AlarmConfig: AlarmConfigSchema,
  ActuatorToggle: ActuatorToggleSchema,
};

export function generateOpenApiSpec() {
  const schemas: Record<string, unknown> = {};

  for (const [name, schema] of Object.entries(SHARED_SCHEMAS)) {
    schemas[name] = schemaToComponent(schema);
  }

  schemas["HealthStatus"] = {
    type: "object",
    properties: {
      status: { type: "string", enum: ["ok", "degraded"] },
      timestamp: { type: "string", format: "date-time" },
      uptime: { type: "number" },
      database: { type: "string", enum: ["connected", "disconnected"] },
    },
    required: ["status", "timestamp", "uptime", "database"],
  };

  return {
    openapi: "3.0.3",
    info: {
      title: "NexaFlow API",
      version: "1.0.0",
      description:
        "API for NexaFlow industrial procedure management platform. " +
        "Schemas are generated from shared Zod definitions. " +
        "All protected endpoints require a Bearer JWT token (access token) " +
        "in the Authorization header or auth_token cookie.",
    },
    servers: [{ url: "/api", description: "NexaFlow API" }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT access token from the Authorization header or auth_token cookie",
        },
      },
      schemas: schemas,
    },
    paths: {
      "/api/pipeline": {
        post: {
          summary: "Run deployment pipeline",
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PipelineConfig" },
              },
            },
          },
          responses: {
            "200": { description: "Pipeline SSE stream" },
            "401": { description: "Unauthorized" },
            "415": { description: "Unsupported Media Type" },
            "429": { description: "Rate limited" },
          },
        },
        get: {
          summary: "Check pipeline status",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Pipeline status" },
            "401": { description: "Unauthorized" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/ai/chat": {
        post: {
          summary: "Send AI chat message",
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AIChatRequest" },
              },
            },
          },
          responses: {
            "200": { description: "AI response" },
            "400": { description: "Invalid input" },
            "401": { description: "Unauthorized" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/ai/chat/stream": {
        post: {
          summary: "Stream AI chat response",
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AIChatRequest" },
              },
            },
          },
          responses: {
            "200": { description: "SSE stream" },
            "400": { description: "Invalid input" },
            "401": { description: "Unauthorized" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/ai/advice": {
        post: {
          summary: "Get AI advice for procedure step",
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdviceRequest" },
              },
            },
          },
          responses: {
            "200": { description: "AI advice" },
            "400": { description: "Invalid input" },
            "401": { description: "Unauthorized" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/images": {
        get: {
          summary: "List media items",
          description: "List all media items (images/videos)",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "List of media items" } },
        },
        post: {
          summary: "Upload media item",
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MediaItemInput" },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "400": { description: "Invalid input or file too large" },
            "401": { description: "Unauthorized" },
            "415": { description: "Unsupported Media Type" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/images/{id}": {
        get: {
          summary: "Get media item by ID",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Media item" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
        put: {
          summary: "Update media item",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MediaItem" },
              },
            },
          },
          responses: {
            "200": { description: "Updated media item" },
            "400": { description: "Invalid input" },
            "401": { description: "Unauthorized" },
            "415": { description: "Unsupported Media Type" },
            "404": { description: "Not found" },
          },
        },
        delete: {
          summary: "Delete media item",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Deleted" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/etat-des-lieux": {
        get: {
          summary: "List condition reports",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "List of reports" } },
        },
        post: {
          summary: "Create condition report",
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EtatDesLieuxReportInput" },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "400": { description: "Invalid input" },
            "401": { description: "Unauthorized" },
            "415": { description: "Unsupported Media Type" },
          },
        },
      },
      "/api/etat-des-lieux/{id}": {
        get: {
          summary: "Get condition report by ID",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Report" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
        put: {
          summary: "Update condition report",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/EtatDesLieuxReport" },
              },
            },
          },
          responses: {
            "200": { description: "Updated report" },
            "400": { description: "Invalid input" },
            "401": { description: "Unauthorized" },
            "415": { description: "Unsupported Media Type" },
            "404": { description: "Not found" },
          },
        },
        delete: {
          summary: "Delete condition report",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Deleted" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/procedures": {
        get: {
          summary: "List procedures",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "List of procedures" } },
        },
        post: {
          summary: "Create procedure",
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Procedure" },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "400": { description: "Invalid input" },
            "401": { description: "Unauthorized" },
            "415": { description: "Unsupported Media Type" },
            "429": { description: "Rate limited" },
          },
        },
      },
       "/api/procedures/{code}": {
        delete: {
          summary: "Delete procedure by code",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "code", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Deleted" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/embedded/{deviceId}/readings": {
        get: {
          summary: "Get device sensor readings",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "deviceId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Device snapshot" },
            "401": { description: "Unauthorized" },
            "429": { description: "Rate limited" },
          },
        },
        post: {
          summary: "Toggle actuator state",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "deviceId", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActuatorToggle" },
              },
            },
          },
          responses: {
            "200": { description: "Updated actuator state" },
            "400": { description: "Invalid input" },
            "401": { description: "Unauthorized" },
            "415": { description: "Unsupported Media Type" },
            "404": { description: "Actuator not found" },
            "429": { description: "Rate limited" },
          },
        },
      },
       "/api/embedded/events": {
        get: {
          summary: "Stream embedded device events (SSE)",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "deviceId", in: "query", required: false, schema: { type: "string" }, description: "Device identifier (defaults to embarque-01)" },
          ],
          responses: {
            "200": {
              description: "SSE event stream",
              content: { "text/event-stream": { schema: { type: "string" } } },
            },
            "401": { description: "Unauthorized" },
          },
        },
      },
      "/api/health": {
        get: {
          summary: "Health check endpoint",
          description: "Returns service health status including database connectivity",
          security: [],
          responses: {
            "200": { description: "Service is healthy", content: { "application/json": { schema: { $ref: "#/components/schemas/HealthStatus" } } } },
            "503": { description: "Service is degraded" },
          },
        },
      },
      "/api/auth/login": {
        post: {
          summary: "Login",
          security: [],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    password: { type: "string", format: "password" },
                    callbackUrl: { type: "string" },
                  },
                  required: ["username", "password"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Login success" },
            "400": { description: "Missing credentials" },
            "401": { description: "Invalid credentials" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/auth/refresh": {
        post: {
          summary: "Refresh access token",
          security: [],
          responses: {
            "200": { description: "New token" },
            "401": { description: "Invalid or missing refresh token" },
            "429": { description: "Rate limited" },
          },
        },
      },
      "/api/auth/me": {
        get: {
          summary: "Get current user",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "User info" } },
        },
      },
      "/api/auth/logout": {
        post: {
          summary: "Logout",
          security: [],
          responses: { "200": { description: "Logged out" } },
        },
      },
    },
  };
}

export function schemaToOpenAPIRef(schemaName: string) {
  return { $ref: `#/components/schemas/${schemaName}` };
}
