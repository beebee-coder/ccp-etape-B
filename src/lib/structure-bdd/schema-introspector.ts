import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";

const SQL_SCHEMA_PATH = path.join(process.cwd(), "src", "lib", "db", "schema.sql");
const SQLITE_SCHEMA_PATH = path.join(process.cwd(), "src", "lib", "db", "schema-sqlite.sql");

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimary: boolean;
  isForeign: boolean;
  references: string | null;
}

interface TableInfo {
  name: string;
  description: string;
  columns: ColumnInfo[];
  indexes: string[];
  relations: string[];
}

interface IntrospectionResult {
  databaseName: string;
  tables: TableInfo[];
  source: "sql" | "prisma" | "combined";
  parsedAt: string;
}

function parseSqlSchema(filePath: string): IntrospectionResult | null {
  const label = "[schema-introspector]";
  logger.info(`${label} Reading SQL schema file`, { filePath });

  if (!fs.existsSync(filePath)) {
    logger.warn(`${label} SQL schema file not found`, { filePath });
    return null;
  }

  const sql = fs.readFileSync(filePath, "utf-8");
  logger.debug(`${label} SQL schema loaded (${sql.length} bytes)`, { filePath });

  const tables: TableInfo[] = [];
  const tableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/gi;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];

    logger.debug(`${label} Parsing table "${tableName}"`, { tableName });

    const columns: ColumnInfo[] = [];
    const indexes: string[] = [];
    const relations: string[] = [];

    const lines = body.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

    for (const line of lines) {
      if (line.startsWith("CREATE") || line.startsWith("ALTER") || line.startsWith("--")) {
        continue;
      }

      const colMatch = line.match(
        /^(\w+)\s+(\w+(?:\([^)]*\))?)(?:\s+(.+))?$/i,
      );
      if (colMatch) {
        const colName = colMatch[1];
        const colType = colMatch[2];
        const rest = (colMatch[3] || "").toUpperCase();

        if (colName.startsWith("FK_") || colName.startsWith("IX_") || colName.startsWith("IDX_")) {
          indexes.push(colName);
          continue;
        }

        const isPrimary = rest.includes("PRIMARY");
        const isForeign = rest.includes("REFERENCES");
        const nullable = !rest.includes("NOT") || rest.includes("NULL");
        const defaultValue = rest.includes("DEFAULT")
          ? rest.match(/DEFAULT\s+([^\s,]+)/i)?.[1] ?? null
          : null;
        const references = isForeign
          ? rest.match(/REFERENCES\s+(\w+)\s*\((\w+)\)/i)?.[0] ?? null
          : null;

        if (references) {
          relations.push(references);
        }

        columns.push({
          name: colName,
          type: colType,
          nullable: nullable && !isPrimary,
          defaultValue,
          isPrimary,
          isForeign,
          references,
        });
      }
    }

    const createIdxRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+(\w+)/gi;
    let idxMatch: RegExpExecArray | null;
    while ((idxMatch = createIdxRegex.exec(sql)) !== null) {
      if (idxMatch[2].toLowerCase() === tableName.toLowerCase()) {
        indexes.push(idxMatch[1]);
      }
    }

    tables.push({
      name: tableName,
      description: `Table ${tableName}`,
      columns,
      indexes,
      relations,
    });
  }

  logger.info(`${label} Parsed ${tables.length} tables from SQL schema`, { tableCount: tables.length });

  return {
    databaseName: "nexaflow_prod",
    tables,
    source: "sql",
    parsedAt: new Date().toISOString(),
  };
}

export function introspectSchema(): IntrospectionResult {
  const label = "[schema-introspector]";
  logger.info(`${label} Starting schema introspection`);

  const sqlResult = parseSqlSchema(SQL_SCHEMA_PATH);
  const sqliteResult = parseSqlSchema(SQLITE_SCHEMA_PATH);

  if (!sqlResult && !sqliteResult) {
    logger.error(`${label} Both schema sources failed`, {
      sqlPath: SQL_SCHEMA_PATH,
      sqlitePath: SQLITE_SCHEMA_PATH,
    });
    throw new Error("Unable to introspect schema: neither SQL nor SQLite schema could be parsed");
  }

  let combined: IntrospectionResult;

  if (sqlResult && sqliteResult) {
    const sqliteTableNames = new Set(sqliteResult.tables.map((t) => t.name.toLowerCase()));
    const sqlTables = sqlResult.tables.filter((t) => !sqliteTableNames.has(t.name.toLowerCase()));
    combined = {
      databaseName: sqlResult.databaseName,
      tables: [...sqliteResult.tables, ...sqlTables],
      source: "combined",
      parsedAt: new Date().toISOString(),
    };
    logger.info(`${label} Combined introspection: ${combined.tables.length} tables (sqlite=${sqliteResult.tables.length}, pg-only=${sqlTables.length})`);
  } else if (sqliteResult) {
    combined = sqliteResult;
    logger.info(`${label} Using SQLite schema only (${combined.tables.length} tables)`);
  } else {
    combined = sqlResult!;
    logger.info(`${label} Using PostgreSQL schema only (${combined.tables.length} tables)`);
  }

  logger.debug(`${label} Introspection complete`, {
    tableCount: combined.tables.length,
    source: combined.source,
    tableNames: combined.tables.map((t) => t.name),
  });

  return combined;
}

export function getTableSchema(tableName: string): TableInfo | null {
  const label = "[schema-introspector]";
  const schema = introspectSchema();
  const table = schema.tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase());

  if (!table) {
    logger.warn(`${label} Table "${tableName}" not found in schema`, {
      availableTables: schema.tables.map((t) => t.name),
    });
    return null;
  }

  logger.debug(`${label} Found table "${tableName}"`, {
    columnCount: table.columns.length,
    indexCount: table.indexes.length,
    relationCount: table.relations.length,
  });

  return table;
}

export function getAllTableNames(): string[] {
  const schema = introspectSchema();
  return schema.tables.map((t) => t.name);
}