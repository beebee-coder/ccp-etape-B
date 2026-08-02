import { query } from "@/lib/db";
import { validateProcedure, TProcedure } from "./services/validator.service";

export async function getAllProcedures(): Promise<TProcedure[]> {
  const result = await query<{
    id: string;
    code: string;
    title: string;
    description: string | null;
    category: string;
    priority: string;
    estimated_time_min: number;
    required_roles: string[];
    global_safety_instructions: string[];
    metadata_json: Record<string, unknown>;
    created_at: string;
    updated_at: string | null;
    steps: unknown[];
  }>(
    `SELECT p.id, p.code, p.title, p.description, p.category, p.priority, p.estimated_time_min,
            p.required_roles, p.global_safety_instructions, p.metadata_json, p.created_at, p.updated_at,
            COALESCE(JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', ps.step_id,
                'title', ps.title,
                'subtitle', ps.subtitle,
                'instructions', ps.instructions,
                'type', ps.step_type,
                'isMandatory', ps.is_mandatory,
                'dependencies', ps.dependencies,
                'mediaRequirements', ps.media_requirements,
                'alarms', ps.alarms,
                'attachments', ps.attachments,
                'order', ps.step_order,
                'timerEnabled', ps.timer_enabled,
                'timerSeconds', ps.timer_seconds
              )
            ORDER BY ps.step_order ASC), '[]'::json) as steps
     FROM procedures p
     LEFT JOIN procedure_steps ps ON p.id = ps.procedure_id
     GROUP BY p.id
     ORDER BY p.created_at DESC`
  );

  return result.rows.map((row) => ({
    metadata: {
      title: row.title,
      code: row.code,
      description: row.description ?? undefined,
      category: row.category,
      priority: row.priority as "basse" | "moyenne" | "haute" | "critique",
      estimatedTimeMinutes: row.estimated_time_min,
      requiredRoles: row.required_roles || [],
      globalSafetyInstructions: row.global_safety_instructions || [],
    },
    steps: row.steps as TProcedure["steps"],
  }));
}

export async function getProcedureById(code: string): Promise<TProcedure | null> {
  const result = await query<{
    id: string;
    code: string;
    title: string;
    description: string | null;
    category: string;
    priority: string;
    estimated_time_min: number;
    required_roles: string[];
    global_safety_instructions: string[];
    metadata_json: Record<string, unknown>;
    created_at: string;
    updated_at: string | null;
    steps: unknown[];
  }>(
    `SELECT p.id, p.code, p.title, p.description, p.category, p.priority, p.estimated_time_min,
            p.required_roles, p.global_safety_instructions, p.metadata_json, p.created_at, p.updated_at,
            COALESCE(JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', ps.step_id,
                'title', ps.title,
                'subtitle', ps.subtitle,
                'instructions', ps.instructions,
                'type', ps.step_type,
                'isMandatory', ps.is_mandatory,
                'dependencies', ps.dependencies,
                'mediaRequirements', ps.media_requirements,
                'alarms', ps.alarms,
                'attachments', ps.attachments,
                'order', ps.step_order,
                'timerEnabled', ps.timer_enabled,
                'timerSeconds', ps.timer_seconds
              )
            ORDER BY ps.step_order ASC), '[]'::json) as steps
     FROM procedures p
     LEFT JOIN procedure_steps ps ON p.id = ps.procedure_id
     WHERE p.code = $1
     GROUP BY p.id`,
    [code]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    metadata: {
      title: row.title,
      code: row.code,
      description: row.description ?? undefined,
      category: row.category,
      priority: row.priority as "basse" | "moyenne" | "haute" | "critique",
      estimatedTimeMinutes: row.estimated_time_min,
      requiredRoles: row.required_roles || [],
      globalSafetyInstructions: row.global_safety_instructions || [],
    },
    steps: (row.steps as TProcedure["steps"]) || [],
  };
}

export async function saveProcedure(procedure: TProcedure): Promise<void> {
  const validated = validateProcedure(procedure);
  const metadata = validated.metadata;

  const result = await query<{ id: string }>(
    `INSERT INTO procedures (code, title, description, category, priority, estimated_time_min, required_roles, global_safety_instructions, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (code) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       category = EXCLUDED.category,
       priority = EXCLUDED.priority,
       estimated_time_min = EXCLUDED.estimated_time_min,
       required_roles = EXCLUDED.required_roles,
       global_safety_instructions = EXCLUDED.global_safety_instructions,
       metadata_json = EXCLUDED.metadata_json,
       updated_at = NOW()
     RETURNING id`,
    [
      metadata.code,
      metadata.title,
      metadata.description || null,
      metadata.category,
      metadata.priority,
      metadata.estimatedTimeMinutes,
      metadata.requiredRoles,
      metadata.globalSafetyInstructions,
      JSON.stringify(metadata),
    ]
  );

  const procedureId = result.rows[0].id;

  await query("DELETE FROM procedure_steps WHERE procedure_id = $1", [procedureId]);

  for (const step of validated.steps) {
    await query(
      `INSERT INTO procedure_steps (procedure_id, step_order, step_id, title, subtitle, instructions, step_type, is_mandatory, dependencies, media_requirements, alarms, attachments, timer_enabled, timer_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        procedureId,
        step.order,
        step.id,
        step.title,
        step.subtitle || null,
        step.instructions,
        step.type,
        step.isMandatory,
        step.dependencies,
        JSON.stringify(step.mediaRequirements),
        JSON.stringify(step.alarms),
        step.attachments,
        step.timerEnabled,
        step.timerSeconds,
      ]
    );
  }
}

export async function deleteProcedure(code: string): Promise<void> {
  const result = await query<{ id: string }>("DELETE FROM procedures WHERE code = $1 RETURNING id", [code]);
  if (result.rows.length > 0) {
    await query("DELETE FROM procedure_steps WHERE procedure_id = $1", [result.rows[0].id]);
  }
}
