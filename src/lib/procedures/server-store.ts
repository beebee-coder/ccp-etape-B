import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { createLogger } from "@/lib/logger";
import {
  validateProcedure,
  TProcedure,
  TProcedureExecution,
  MediaRequirementSchema,
  AlarmConfigSchema,
} from "./services/validator.service";
import { invalidateProceduresCache } from "@/app/api/registry/fs/route";

const log = createLogger({ module: "server-store" });

function safeParseArray<T>(data: unknown, schema: { parse: (input: unknown) => T }, fallback: T[]): T[] {
  try {
    if (!Array.isArray(data)) return fallback;
    return data.map((item) => schema.parse(item));
  } catch (error) {
    log.error("server-store: invalid JSON array field, using fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

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

interface ProcedureStepRow {
  id: string;
  procedureId: string;
  stepOrder: number;
  stepId: string;
  title: string;
  subtitle: string | null;
  instructions: string;
  stepType: string;
  isMandatory: boolean;
  dependencies: string[];
  mediaRequirements: unknown;
  alarms: unknown;
  alarmCodes: string[];
  attachments: string[];
  timerEnabled: boolean;
  timerSeconds: number;
}

interface ProcedureRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  estimatedTimeMin: number;
  requiredRoles: string[];
  globalSafetyInstructions: string[];
  locationType: string | null;
  locationPath: string | null;
  blocCode: string | null;
  equipementCode: string | null;
  criticality: string | null;
  status: string | null;
  subcategory: string | null;
  department: string | null;
  version: string | null;
  parameters: unknown;
  postExecution: unknown;
  mediaLibrary: unknown;
  prerequisites: unknown;
  lastExecutedAt: Date | null;
  executionCount: number;
  authorId: string | null;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date | null;
  steps: ProcedureStepRow[];
}

function mapRowToProcedure(row: ProcedureRow): TProcedure {
  const metadata: TProcedure["metadata"] = {
    title: row.title,
    code: row.code,
    description: row.description || undefined,
    category: row.category,
    priority: row.priority as TProcedure["metadata"]["priority"],
    estimatedTimeMinutes: row.estimatedTimeMin,
    requiredRoles: row.requiredRoles,
    globalSafetyInstructions: row.globalSafetyInstructions,
    locationType: row.locationType as TProcedure["metadata"]["locationType"],
    locationPath: row.locationPath || undefined,
    blocCode: row.blocCode || undefined,
    equipementCode: row.equipementCode || undefined,
    criticality: (row.criticality || "NORMAL") as TProcedure["metadata"]["criticality"],
    status: (row.status || "DRAFT") as TProcedure["metadata"]["status"],
    subcategory: row.subcategory || undefined,
    department: row.department || undefined,
    version: row.version || undefined,
    lastExecutedAt: row.lastExecutedAt?.getTime() ?? undefined,
    executionCount: row.executionCount,
    authorId: row.authorId || undefined,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt?.getTime() ?? undefined,
  };

  return {
    metadata,
    steps: row.steps.map((step) => {
      const safeMediaRequirements = safeParseArray(
        step.mediaRequirements,
        MediaRequirementSchema,
        []
      );
      const safeAlarms = safeParseArray(step.alarms, AlarmConfigSchema, []);

      return {
        id: step.stepId,
        procedureId: step.procedureId,
        stepOrder: step.stepOrder,
        stepId: step.stepId,
        title: step.title,
        subtitle: step.subtitle || undefined,
        instructions: step.instructions,
        type: step.stepType as TProcedure["steps"][number]["type"],
        isMandatory: step.isMandatory,
        dependencies: step.dependencies,
        mediaRequirements: safeMediaRequirements,
        alarms: safeAlarms,
        alarmCodes: step.alarmCodes,
        attachments: step.attachments,
        order: step.stepOrder,
        timerEnabled: step.timerEnabled,
        timerSeconds: step.timerSeconds,
      };
    }),
    parameters: row.parameters as TProcedure["parameters"],
    postExecution: row.postExecution as TProcedure["postExecution"],
    mediaLibrary: row.mediaLibrary as TProcedure["mediaLibrary"],
    prerequisites: row.prerequisites as TProcedure["prerequisites"],
  };
}

export async function getAllProcedures(): Promise<TProcedure[]> {
  log.debug("getAllProcedures: fetching all procedures");
  try {
    const procedures = await prisma.procedure.findMany({
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = procedures.map(mapRowToProcedure);

    log.info("getAllProcedures: procedures fetched", {
      count: result.length,
    });
    return result;
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
    const procedure = await prisma.procedure.findUnique({
      where: { code },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    if (!procedure) {
      log.warn("getProcedureById: procedure not found", { code });
      return null;
    }

    const mapped = mapRowToProcedure(procedure);

    try {
      validateProcedure(mapped);
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
      stepCount: mapped.steps.length,
    });
    return mapped;
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

  await prisma.$transaction(async (tx) => {
    const procedureData = {
      code: metadata.code,
      title: metadata.title,
      description: metadata.description || undefined,
      category: metadata.category,
      priority: metadata.priority,
      estimatedTimeMin: metadata.estimatedTimeMinutes,
      requiredRoles: metadata.requiredRoles,
      globalSafetyInstructions: metadata.globalSafetyInstructions,
      locationType: metadata.locationType || undefined,
      locationPath: metadata.locationPath || undefined,
      blocCode: metadata.blocCode || undefined,
      equipementCode: metadata.equipementCode || undefined,
      criticality: metadata.criticality || undefined,
      status: metadata.status || undefined,
      subcategory: metadata.subcategory || undefined,
      department: metadata.department || undefined,
      version: metadata.version || undefined,
      parameters: validated.parameters ?? undefined,
      postExecution: validated.postExecution ?? undefined,
      mediaLibrary: validated.mediaLibrary ?? undefined,
      prerequisites: validated.prerequisites ?? undefined,
      lastExecutedAt: metadata.lastExecutedAt ? new Date(metadata.lastExecutedAt) : undefined,
      executionCount: metadata.executionCount ?? 0,
      authorId: metadata.authorId || undefined,
      metadataJson: metadata,
    };

    const result = await tx.procedure.upsert({
      where: { code: metadata.code },
      update: procedureData,
      create: {
        id: metadata.code,
        ...procedureData,
      },
    });

    const procedureId = result.id;
    log.debug("saveProcedure: procedure upserted", {
      code: metadata.code,
      procedureId,
    });

    const existingSteps = await tx.procedureStep.findMany({
      where: { procedureId },
      select: { id: true, stepId: true },
    });

    const existingStepIds = new Set(existingSteps.map((s) => s.stepId));
    const incomingStepIds = new Set(validated.steps.map((s) => s.stepId || s.id));

    const stepsToDelete = existingSteps.filter((s) => !incomingStepIds.has(s.stepId));
    if (stepsToDelete.length > 0) {
      await tx.procedureStep.deleteMany({
        where: { id: { in: stepsToDelete.map((s) => s.id) } },
      });
      log.debug("saveProcedure: deleted obsolete steps", {
        code: metadata.code,
        deletedCount: stepsToDelete.length,
      });
    }

    const stepsToUpdate: { stepId: string; data: Prisma.ProcedureStepUpdateManyMutationInput }[] = [];
    const stepsToCreate: Prisma.ProcedureStepCreateManyInput[] = [];

    for (const step of validated.steps) {
      const stepId = step.stepId || step.id;
      if (existingStepIds.has(stepId)) {
        stepsToUpdate.push({
          stepId,
          data: {
            stepOrder: step.order,
            title: step.title,
            subtitle: step.subtitle || null,
            instructions: step.instructions,
            stepType: step.type,
            isMandatory: step.isMandatory,
            dependencies: step.dependencies,
            mediaRequirements: step.mediaRequirements as unknown as Prisma.InputJsonValue,
            alarms: step.alarms as unknown as Prisma.InputJsonValue,
            alarmCodes: step.alarmCodes,
            attachments: step.attachments,
            timerEnabled: step.timerEnabled,
            timerSeconds: step.timerSeconds,
          },
        });
      } else {
        stepsToCreate.push({
          id: crypto.randomUUID(),
          procedureId,
          stepOrder: step.order,
          stepId,
          title: step.title,
          subtitle: step.subtitle || null,
          instructions: step.instructions,
          stepType: step.type,
          isMandatory: step.isMandatory,
          dependencies: step.dependencies,
          mediaRequirements: step.mediaRequirements as unknown as Prisma.InputJsonValue,
          alarms: step.alarms as unknown as Prisma.InputJsonValue,
          alarmCodes: step.alarmCodes,
          attachments: step.attachments,
          timerEnabled: step.timerEnabled,
          timerSeconds: step.timerSeconds,
        });
      }
    }

    for (const update of stepsToUpdate) {
      await tx.procedureStep.updateMany({
        where: { procedureId, stepId: update.stepId },
        data: update.data,
      });
    }

    if (stepsToCreate.length > 0) {
      await tx.procedureStep.createMany({ data: stepsToCreate });
    }

    log.info("saveProcedure: procedure saved", {
      code: metadata.code,
      procedureId,
      stepCount: validated.steps.length,
      created: stepsToCreate.length,
      updated: stepsToUpdate.length,
    });
  });

  invalidateProceduresCache();
}

export async function deleteProcedure(code: string): Promise<void> {
  log.debug("deleteProcedure: deleting procedure", { code });
  try {
    const result = await prisma.procedure.deleteMany({
      where: { code },
    });

    if (result.count > 0) {
      log.info("deleteProcedure: procedure deleted", {
        code,
        deletedCount: result.count,
      });
    } else {
      log.warn("deleteProcedure: procedure not found for deletion", { code });
    }

    invalidateProceduresCache();
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

  const startTime = new Date(execution.context.startedAt);
  const endTime = execution.context.finishedAt
    ? new Date(execution.context.finishedAt)
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
    const procedure = await prisma.procedure.findUnique({
      where: { code: execution.procedureCode },
      select: { id: true },
    });

    if (!procedure) {
      log.warn("saveProcedureExecution: procedure not found by code", {
        procedureCode: execution.procedureCode,
      });
      throw new Error(`Procedure not found: ${execution.procedureCode}`);
    }

    const procedureId = procedure.id;

    const result = await prisma.procedureExecution.create({
      data: {
        id: crypto.randomUUID(),
        procedureId,
        procedureCode: execution.procedureCode,
        operatorId: operatorId ?? "unknown",
        startTime,
        endTime,
        status: execution.status,
        stepsStatus: execution.context.completedSteps as unknown as Prisma.InputJsonValue,
        totalDuration,
        currentStep: execution.context.currentStepIndex,
        alarms: execution.context.anomalies as unknown as Prisma.InputJsonValue,
        events: events as unknown as Prisma.InputJsonValue,
      },
    });

    log.info("saveProcedureExecution: execution saved", {
      procedureCode: execution.procedureCode,
      procedureId,
      executionId: result.id,
      status: execution.status,
      operatorId: operatorId ?? null,
      totalDurationSeconds: totalDuration,
      completedSteps: execution.context.completedSteps.length,
      anomaliesCount: execution.context.anomalies.length,
    });

    return result.id;
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
    const executions = await prisma.procedureExecution.findMany({
      where: { procedureCode },
      orderBy: { createdAt: "desc" },
    });

    log.info("getProcedureExecutions: executions fetched", {
      procedureCode,
      count: executions.length,
    });

    return executions.map((e) => ({
      id: e.id,
      procedureCode: e.procedureCode,
      operatorId: e.operatorId,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime?.toISOString() ?? null,
      status: e.status,
      stepsStatus: e.stepsStatus,
      totalDuration: e.totalDuration,
      currentStep: e.currentStep,
      alarms: e.alarms,
      events: e.events,
      createdAt: e.createdAt.toISOString(),
    }));
  } catch (error) {
    log.error("getProcedureExecutions: failed to fetch executions", {
      procedureCode,
      error,
    });
    throw error;
  }
}
