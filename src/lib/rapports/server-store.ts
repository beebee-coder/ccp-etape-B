import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { Report, ReportPoint } from "@/lib/types/reports";

const log = createLogger({ module: "rapports-server" });

function generateId(): string {
  return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAll(): Promise<Report[]> {
  log.info("getAll: fetching all reports from database");
  try {
    const result = await query<{
      id: string;
      date: string;
      points: unknown;
      created_at: string;
      updated_at: string | null;
    }>(
      `SELECT id, date, points, created_at, updated_at
       FROM reports
       ORDER BY created_at DESC`
    );

    log.debug("getAll: query succeeded", { rowCount: result.rowCount });

    return result.rows.map((row) => ({
      id: row.id,
      date: row.date,
      points: (row.points as ReportPoint[]) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
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
    const result = await query<{
      id: string;
      date: string;
      points: unknown;
      created_at: string;
      updated_at: string | null;
    }>(
      `SELECT id, date, points, created_at, updated_at
       FROM reports
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      log.warn("getById: report not found", { id });
      return undefined;
    }

    const row = result.rows[0];
    log.debug("getById: report found", { id });

    return {
      id: row.id,
      date: row.date,
      points: (row.points as ReportPoint[]) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
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
    const now = new Date().toISOString();

    const result = await query<{
      id: string;
      date: string;
      points: unknown;
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO reports (id, date, points, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, date, points, created_at, updated_at`,
      [id, report.date, JSON.stringify(report.points), now, now]
    );

    const row = result.rows[0];
    log.info("create: report inserted successfully", { id });

    return {
      id: row.id,
      date: row.date,
      points: (row.points as ReportPoint[]) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
    const now = new Date().toISOString();
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.date !== undefined) {
      setClauses.push(`date = $${paramIndex++}`);
      values.push(updates.date);
    }
    if (updates.points !== undefined) {
      setClauses.push(`points = $${paramIndex++}`);
      values.push(JSON.stringify(updates.points));
    }

    setClauses.push(`updated_at = $${paramIndex++}`);
    values.push(now);
    values.push(id);

    const result = await query<{
      id: string;
      date: string;
      points: unknown;
      created_at: string;
      updated_at: string;
    }>(
      `UPDATE reports SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING id, date, points, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      log.warn("update: report not found", { id });
      return undefined;
    }

    const row = result.rows[0];
    log.info("update: report updated successfully", { id });

    return {
      id: row.id,
      date: row.date,
      points: (row.points as ReportPoint[]) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
    const result = await query<{ id: string }>(
      `DELETE FROM reports WHERE id = $1 RETURNING id`,
      [id]
    );

    const deleted = result.rows.length > 0;
    if (deleted) {
      log.info("remove: report deleted successfully", { id });
    } else {
      log.warn("remove: report not found", { id });
    }

    return deleted;
  } catch (error) {
    log.error("remove: failed to delete report", {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}