import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { createLogger } from "@/lib/logger";
import type { Report, ReportPoint } from "@/lib/types/reports";

const log = createLogger({ module: "rapports-server" });

function generateId(): string {
  return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAll(): Promise<Report[]> {
  log.info("getAll: fetching all reports from database");
  try {
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
    });

    log.debug("getAll: query succeeded", { rowCount: reports.length });

    return reports.map((row) => ({
      id: row.id,
      date: row.date,
      points: (row.points as unknown as ReportPoint[]) ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : row.createdAt.toISOString(),
    }));
  } catch (error) {
    log.error("getAll: failed to fetch reports", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function getById(id: string): Promise<Report | undefined> {
  log.info("getById: fetching report", { id });
  try {
    const report = await prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      log.warn("getById: report not found", { id });
      return undefined;
    }

    log.debug("getById: report found", { id });

    return {
      id: report.id,
      date: report.date,
      points: (report.points as unknown as ReportPoint[]) ?? [],
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt ? report.updatedAt.toISOString() : report.createdAt.toISOString(),
    };
  } catch (error) {
    log.error("getById: failed to fetch report", {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function create(
  report: Omit<Report, "id" | "createdAt" | "updatedAt">
): Promise<Report> {
  log.info("create: inserting new report", { date: report.date, pointCount: report.points.length });
  try {
    const id = generateId();

    const created = await prisma.report.create({
      data: {
        id,
        date: report.date,
        points: report.points as unknown as Prisma.InputJsonValue,
      },
    });

    log.info("create: report inserted successfully", { id });

    return {
      id: created.id,
      date: created.date,
      points: (created.points as unknown as ReportPoint[]) ?? [],
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt ? created.updatedAt.toISOString() : created.createdAt.toISOString(),
    };
  } catch (error) {
    log.error("create: failed to insert report", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function update(
  id: string,
  updates: Partial<Omit<Report, "id" | "createdAt" | "updatedAt">>
): Promise<Report | undefined> {
  log.info("update: updating report", { id, fields: Object.keys(updates) });
  try {
    const data: Record<string, unknown> = {};
    if (updates.date !== undefined) data.date = updates.date;
    if (updates.points !== undefined) data.points = updates.points as unknown as Prisma.InputJsonValue;

    const updated = await prisma.report.update({
      where: { id },
      data,
    });

    log.info("update: report updated successfully", { id });

    return {
      id: updated.id,
      date: updated.date,
      points: (updated.points as unknown as ReportPoint[]) ?? [],
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt ? updated.updatedAt.toISOString() : updated.createdAt.toISOString(),
    };
  } catch (error) {
    log.error("update: failed to update report", {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function remove(id: string): Promise<boolean> {
  log.info("remove: deleting report", { id });
  try {
    await prisma.report.delete({
      where: { id },
    });

    log.info("remove: report deleted successfully", { id });
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      log.warn("remove: report not found", { id });
      return false;
    }

    log.error("remove: failed to delete report", { id, error });
    throw error;
  }
}
