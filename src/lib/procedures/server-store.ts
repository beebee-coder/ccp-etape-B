import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import {
  validateProcedure,
  TProcedure,
  TProcedureExecution,
} from "./services/validator.service";

const log = createLogger({ module: "server-store" });

export interface ExecutionRecord {
  procedureCode: string;
  operatorId: string | null;
  startTime: string;
  endTime: string | null;
  status: string;
  stepsStatus: string[];
  totalDuration: number;
  currentStep: number;
  alarms: string[];
  fallbacks: string[];
  events: unknown[];
}

export async function getAllProcedures(): Promise<TProcedure[]> {
  log.debug("getAllProcedures: fetching all procedures");
  try {
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
       ORDER BY p.created_at DESC`,
    );

    const procedures = result.rows.map((row) => {
      const procedure = {
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
      };
      log.debug("getAllProcedures: mapped procedure row", {
        code: row.code,
        stepCount: (row.steps as unknown[]).length,
      });
      return procedure;
    });

    log.info("getAllProcedures: procedures fetched", {
      count: procedures.length,
    });
    return procedures;
  } catch (error) {
    log.error("getAllProcedures: failed to fetch procedures", { error });
    throw error;
  }
}

export async function getProcedureById(
  code: string,
): Promise<TProcedure | null> {
  log.debug("getProcedureById: fetching procedure", { code });
  try {
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
      [code],
    );

    if (result.rows.length === 0) {
      log.warn("getProcedureById: procedure not found", { code });
      return null;
    }

    const row = result.rows[0];
    const procedure: TProcedure = {
      metadata: {
        title: row.title,
        description: row.description ?? undefined,
        category: row.category,
        priority: row.priority as "basse" | "moyenne" | "haute" | "critique",
        estimatedTimeMinutes: row.estimated_time_min,
        requiredRoles: row.required_roles || [],
        globalSafetyInstructions: row.global_safety_instructions || [],
        code: row.code,
      },
      steps: (row.steps as TProcedure["steps"]) || [],
    };

    try {
      validateProcedure(procedure);
    } catch (validationError) {
      log.error("getProcedureById: procedure data failed schema validation", {
        code,
        error:
          validationError instanceof Error
            ? validationError.message
            : String(validationError),
      });
      return null;
    }

    log.info("getProcedureById: procedure fetched", {
      code,
      stepCount: procedure.steps.length,
    });
    return procedure;
  } catch (error) {
    log.error("getProcedureById: failed to fetch procedure", { code, error });
    throw error;
  }
}

export async function saveProcedure(procedure: TProcedure): Promise<void> {
  const validated = validateProcedure(procedure);
  const metadata = validated.metadata;

  log.debug("saveProcedure: upserting procedure", {
    code: metadata.code,
    title: metadata.title,
  });

  try {
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
      ],
    );

    const procedureId = result.rows[0].id;
    log.debug("saveProcedure: procedure upserted", {
      code: metadata.code,
      procedureId,
    });

    await query("DELETE FROM procedure_steps WHERE procedure_id = $1", [
      procedureId,
    ]);

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
        ],
      );
    }

    log.info("saveProcedure: procedure saved", {
      code: metadata.code,
      procedureId,
      stepCount: validated.steps.length,
    });
  } catch (error) {
    log.error("saveProcedure: failed to save procedure", {
      code: metadata.code,
      error,
    });
    throw error;
  }
}

export async function deleteProcedure(code: string): Promise<void> {
  log.debug("deleteProcedure: deleting procedure", { code });
  try {
    const result = await query<{ id: string }>(
      "DELETE FROM procedures WHERE code = $1 RETURNING id",
      [code],
    );
    if (result.rows.length > 0) {
      const procedureId = result.rows[0].id;
      await query("DELETE FROM procedure_steps WHERE procedure_id = $1", [
        procedureId,
      ]);
      log.info("deleteProcedure: procedure deleted", { code, procedureId });
    } else {
      log.warn("deleteProcedure: procedure not found for deletion", { code });
    }
  } catch (error) {
    log.error("deleteProcedure: failed to delete procedure", { code, error });
    throw error;
  }
}

export async function saveProcedureExecution(
  execution: TProcedureExecution,
  operatorId?: string | null,
): Promise<string> {
  log.debug("saveProcedureExecution: saving execution", {
    procedureCode: execution.procedureCode,
    status: execution.status,
    operatorId: operatorId ?? null,
  });

  const startTime = new Date(execution.context.startedAt).toISOString();
  const endTime = execution.context.finishedAt
    ? new Date(execution.context.finishedAt).toISOString()
    : null;
  const totalDuration = execution.context.finishedAt
    ? Math.round(
        (execution.context.finishedAt - execution.context.startedAt) / 1000,
      )
    : 0;

  const events: unknown[] = [];
  if (execution.status === "ABORTED") {
    events.push({
      type: "aborted",
      timestamp: execution.context.finishedAt ?? Date.now(),
    });
  }

  try {
    const procResult = await query<{ id: string }>(
      "SELECT id FROM procedures WHERE code = $1",
      [execution.procedureCode]
    );

    if (procResult.rows.length === 0) {
      log.warn("saveProcedureExecution: procedure not found by code", {
        procedureCode: execution.procedureCode,
      });
      throw new Error(`Procedure not found: ${execution.procedureCode}`);
    }

    const procedureId = procResult.rows[0].id;

    const result = await query<{ id: string }>(
      `INSERT INTO procedure_executions
         (procedure_id, procedure_code, operator_id, start_time, end_time, status, steps_status, total_duration, current_step, alarms, fallbacks, events)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        procedureId,
        execution.procedureCode,
        operatorId ?? null,
        startTime,
        endTime,
        execution.status,
        JSON.stringify(execution.context.completedSteps),
        totalDuration,
        execution.context.currentStepIndex,
        JSON.stringify(execution.context.anomalies),
        JSON.stringify([]),
        JSON.stringify(events),
      ]
    );

    const executionId = result.rows[0].id;
    log.info("saveProcedureExecution: execution saved", {
      procedureCode: execution.procedureCode,
      procedureId,
      executionId,
      status: execution.status,
      operatorId: operatorId ?? null,
      totalDurationSeconds: totalDuration,
      completedSteps: execution.context.completedSteps.length,
      anomaliesCount: execution.context.anomalies.length,
    });

    return executionId;
  } catch (error) {
    log.error("saveProcedureExecution: failed to save execution", {
      procedureCode: execution.procedureCode,
      status: execution.status,
      error,
    });
    throw error;
  }
}

export async function getProcedureExecutions(
  procedureCode: string,
): Promise<unknown[]> {
  log.debug("getProcedureExecutions: fetching executions", { procedureCode });
  try {
    const result = await query<Record<string, unknown>>(
      `SELECT id, operator_id, start_time, end_time, status, steps_status, total_duration, current_step, alarms, events, created_at
       FROM procedure_executions
       WHERE procedure_code = $1
       ORDER BY created_at DESC`,
      [procedureCode],
    );

    log.info("getProcedureExecutions: executions fetched", {
      procedureCode,
      count: result.rowCount,
    });

    return result.rows;
  } catch (error) {
    log.error("getProcedureExecutions: failed to fetch executions", {
      procedureCode,
      error,
    });
    throw error;
  }
}
