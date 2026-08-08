import { query, getPool } from "@/lib/db";
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

function mapRowToProcedure(row: Record<string, unknown>): TProcedure {
  const metadata: TProcedure["metadata"] = {
    title: (row.title as string) ?? "",
    code: (row.code as string) ?? "",
    description: row.description as string | undefined,
    category: (row.category as string) ?? "",
    priority: (row.priority as "basse" | "moyenne" | "haute" | "critique") ?? "moyenne",
    estimatedTimeMinutes: (row.estimated_time_min as number) ?? 30,
    requiredRoles: (row.required_roles as string[]) ?? [],
    globalSafetyInstructions: (row.global_safety_instructions as string[]) ?? [],
    locationType: row.location_type as TProcedure["metadata"]["locationType"],
    locationPath: row.location_path as TProcedure["metadata"]["locationPath"],
    blocCode: row.bloc_code as TProcedure["metadata"]["blocCode"],
    equipementCode: row.equipement_code as TProcedure["metadata"]["equipementCode"],
    criticality: row.criticality as TProcedure["metadata"]["criticality"],
    status: row.status as TProcedure["metadata"]["status"],
    subcategory: row.subcategory as TProcedure["metadata"]["subcategory"],
    department: row.department as TProcedure["metadata"]["department"],
    version: row.version as TProcedure["metadata"]["version"],
    lastExecutedAt: row.last_executed_at as TProcedure["metadata"]["lastExecutedAt"],
    executionCount: (row.execution_count as number) ?? 0,
    authorId: row.author_id as TProcedure["metadata"]["authorId"],
    createdAt: row.created_at as TProcedure["metadata"]["createdAt"],
    updatedAt: row.updated_at as TProcedure["metadata"]["updatedAt"],
  };

  return {
    metadata,
    steps: (row.steps as TProcedure["steps"]) ?? [],
    parameters: row.parameters as TProcedure["parameters"],
    postExecution: row.post_execution as TProcedure["postExecution"],
    mediaLibrary: row.media_library as TProcedure["mediaLibrary"],
    prerequisites: row.prerequisites as TProcedure["prerequisites"],
  };
}

export async function getAllProcedures(): Promise<TProcedure[]> {
  log.debug("getAllProcedures: fetching all procedures");
  try {
    const result = await query<Record<string, unknown>>(
      `SELECT p.id, p.code, p.title, p.description, p.category, p.priority, p.estimated_time_min,
              p.required_roles, p.global_safety_instructions, p.location_type, p.location_path,
              p.bloc_code, p.equipement_code, p.criticality, p.status, p.subcategory, p.department,
              p.version, p.parameters, p.post_execution, p.media_library, p.prerequisites,
              p.last_executed_at, p.execution_count, p.author_id, p.created_at, p.updated_at,
              COALESCE(JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id', ps.step_id,
                  'procedureId', ps.procedure_id,
                  'stepOrder', ps.step_order,
                  'stepId', ps.step_id,
                  'title', ps.title,
                  'subtitle', ps.subtitle,
                  'instructions', ps.instructions,
                  'type', ps.step_type,
                  'isMandatory', ps.is_mandatory,
                  'dependencies', ps.dependencies,
                  'mediaRequirements', ps.media_requirements,
                  'alarms', ps.alarms,
                  'alarmCodes', ps.alarm_codes,
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

    const procedures = result.rows.map(mapRowToProcedure);

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
    const result = await query<Record<string, unknown>>(
      `SELECT p.id, p.code, p.title, p.description, p.category, p.priority, p.estimated_time_min,
              p.required_roles, p.global_safety_instructions, p.location_type, p.location_path,
              p.bloc_code, p.equipement_code, p.criticality, p.status, p.subcategory, p.department,
              p.version, p.parameters, p.post_execution, p.media_library, p.prerequisites,
              p.last_executed_at, p.execution_count, p.author_id, p.created_at, p.updated_at,
              COALESCE(JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id', ps.step_id,
                  'procedureId', ps.procedure_id,
                  'stepOrder', ps.step_order,
                  'stepId', ps.step_id,
                  'title', ps.title,
                  'subtitle', ps.subtitle,
                  'instructions', ps.instructions,
                  'type', ps.step_type,
                  'isMandatory', ps.is_mandatory,
                  'dependencies', ps.dependencies,
                  'mediaRequirements', ps.media_requirements,
                  'alarms', ps.alarms,
                  'alarmCodes', ps.alarm_codes,
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

    const procedure = mapRowToProcedure(result.rows[0]);

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

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const result = await client.query<{ id: string }>(
      `INSERT INTO procedures (
         code, title, description, category, priority, estimated_time_min,
         required_roles, global_safety_instructions, location_type, location_path,
         bloc_code, equipement_code, criticality, status, subcategory, department,
         version, parameters, post_execution, media_library, prerequisites,
         last_executed_at, execution_count, author_id, metadata_json, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
         $17, $18, $19, $20, $21, $22, $23, $24, $25, COALESCE($26, NOW())
       )
       ON CONFLICT (code) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         priority = EXCLUDED.priority,
         estimated_time_min = EXCLUDED.estimated_time_min,
         required_roles = EXCLUDED.required_roles,
         global_safety_instructions = EXCLUDED.global_safety_instructions,
         location_type = EXCLUDED.location_type,
         location_path = EXCLUDED.location_path,
         bloc_code = EXCLUDED.bloc_code,
         equipement_code = EXCLUDED.equipement_code,
         criticality = EXCLUDED.criticality,
         status = EXCLUDED.status,
         subcategory = EXCLUDED.subcategory,
         department = EXCLUDED.department,
         version = EXCLUDED.version,
         parameters = EXCLUDED.parameters,
         post_execution = EXCLUDED.post_execution,
         media_library = EXCLUDED.media_library,
         prerequisites = EXCLUDED.prerequisites,
         last_executed_at = EXCLUDED.last_executed_at,
         execution_count = EXCLUDED.execution_count,
         author_id = EXCLUDED.author_id,
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
        metadata.locationType || null,
        metadata.locationPath || null,
        metadata.blocCode || null,
        metadata.equipementCode || null,
        metadata.criticality || null,
        metadata.status || null,
        metadata.subcategory || null,
        metadata.department || null,
        metadata.version || null,
        validated.parameters ?? null,
        validated.postExecution ?? null,
        validated.mediaLibrary ?? null,
        validated.prerequisites ?? null,
        metadata.lastExecutedAt ?? null,
        metadata.executionCount ?? 0,
        metadata.authorId || null,
        JSON.stringify(metadata),
      ],
    );

    const procedureId = result.rows[0].id;
    log.debug("saveProcedure: procedure upserted", {
      code: metadata.code,
      procedureId,
    });

    await client.query("DELETE FROM procedure_steps WHERE procedure_id = $1", [
      procedureId,
    ]);

    for (const step of validated.steps) {
      await client.query(
        `INSERT INTO procedure_steps (
           procedure_id, step_order, step_id, title, subtitle, instructions,
           step_type, is_mandatory, dependencies, media_requirements, alarms,
           alarm_codes, attachments, timer_enabled, timer_seconds
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
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
          JSON.stringify(step.alarmCodes ?? []),
          step.attachments,
          step.timerEnabled,
          step.timerSeconds,
        ],
      );
    }

    await client.query("COMMIT");
    log.info("saveProcedure: procedure saved", {
      code: metadata.code,
      procedureId,
      stepCount: validated.steps.length,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    log.error("saveProcedure: failed to save procedure", {
      code: metadata.code,
      error,
    });
    throw error;
  } finally {
    client.release();
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
