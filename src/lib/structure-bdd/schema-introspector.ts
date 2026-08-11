import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";

const PRISMA_SCHEMA_PATH = path.join(
  process.cwd(),
  "prisma",
  "schema.prisma",
);

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
  source: "prisma";
  parsedAt: string;
}

function extractAttributes(attrBlock: string): {
  isId: boolean;
  isUnique: boolean;
  map: string | null;
  defaultValue: string | null;
  relation: string | null;
  dbType: string | null;
} {
  const isId = /\b@id\b/.test(attrBlock);
  const isUnique = /\b@unique\b/.test(attrBlock);
  const mapMatch = attrBlock.match(/@map\("([^"]+)"\)/);
  const defaultMatch = attrBlock.match(/@default\(([^)]+)\)/);
  const relationMatch = attrBlock.match(/@relation\(([^)]+)\)/);
  const dbMatch = attrBlock.match(/@db\.(\w+)/);

  return {
    isId,
    isUnique,
    map: mapMatch ? mapMatch[1] : null,
    defaultValue: defaultMatch ? defaultMatch[1] : null,
    relation: relationMatch ? relationMatch[1] : null,
    dbType: dbMatch ? dbMatch[1] : null,
  };
}

function parsePrismaSchema(filePath: string): IntrospectionResult | null {
  const label = "[schema-introspector]";
  logger.info(`${label} Reading Prisma schema file`, { filePath });

  if (!fs.existsSync(filePath)) {
    logger.warn(`${label} Prisma schema file not found`, { filePath });
    return null;
  }

  const schema = fs.readFileSync(filePath, "utf-8");
  logger.debug(`${label} Prisma schema loaded (${schema.length} bytes)`, {
    filePath,
  });

  const tables: TableInfo[] = [];

  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let modelMatch: RegExpExecArray | null;

  while ((modelMatch = modelRegex.exec(schema)) !== null) {
    const modelName = modelMatch[1];
    const body = modelMatch[2];

    logger.debug(`${label} Parsing model "${modelName}"`, { modelName });

    const columns: ColumnInfo[] = [];
    const indexes: string[] = [];
    const relations: string[] = [];

    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    for (const line of lines) {
      if (
        line.startsWith("@@") ||
        line.startsWith("//") ||
        line.startsWith("/*")
      ) {
        continue;
      }

      const fieldMatch = line.match(/^(\w+)\s+(\?)?\s*(\[\]?)?\s*(.*)$/);
      if (!fieldMatch) continue;

      const fieldName = fieldMatch[1];
      const optional = fieldMatch[2] === "?";
      const array = fieldMatch[3] === "[]";
      const attrBlock = fieldMatch[4];

      const attrs = extractAttributes(attrBlock);

      const columnName = attrs.map || fieldName;
      let type = attrs.dbType || "";

      if (!type) {
        const baseMatch = line.match(new RegExp(`^${fieldName}\\s+\\??\\s*(\\[\\])?\\s*(\\w+)`));
        if (baseMatch) {
          type = baseMatch[2];
          if (baseMatch[1] === "[]") {
            type = type + "[]";
          }
        }
      }

      if (array && !type.includes("[]")) {
        type = type + "[]";
      }

      const isRelation = /\[\w+\]/.test(attrBlock) || /\b@relation\b/.test(attrBlock);
      const isPrimary = attrs.isId;
      const isForeign = isRelation && /\bfields:\s*\[/.test(attrBlock);

      if (isRelation && attrs.relation) {
        relations.push(attrs.relation);
      }

      columns.push({
        name: columnName,
        type: type || "Unknown",
        nullable: optional,
        defaultValue: attrs.defaultValue,
        isPrimary,
        isForeign,
        references: attrs.relation,
      });
    }

    const indexRegex = /@@(?:index|unique)\(\[([^\]]+)\]\)/g;
    let indexMatch: RegExpExecArray | null;
    while ((indexMatch = indexRegex.exec(body)) !== null) {
      const fields = indexMatch[1]
        .split(",")
        .map((f) => f.trim())
        .join("_");
      const prefix = indexMatch[0].startsWith("@@unique") ? "UQ" : "IX";
      indexes.push(`${prefix}_${modelName}_${fields}`);
    }

    tables.push({
      name: modelName,
      description: `Table ${modelName}`,
      columns,
      indexes,
      relations,
    });
  }

  logger.info(`${label} Parsed ${tables.length} models from Prisma schema`, {
    modelCount: tables.length,
  });

  return {
    databaseName: "nexaflow_prod",
    tables,
    source: "prisma",
    parsedAt: new Date().toISOString(),
  };
}

export function introspectSchema(): IntrospectionResult {
  const label = "[schema-introspector]";
  logger.info(`${label} Starting schema introspection`);

  const prismaResult = parsePrismaSchema(PRISMA_SCHEMA_PATH);

  if (!prismaResult) {
    logger.error(`${label} Prisma schema parsing failed`, {
      prismaPath: PRISMA_SCHEMA_PATH,
    });
    throw new Error(
      "Unable to introspect schema: Prisma schema could not be parsed",
    );
  }

  logger.info(
    `${label} Prisma introspection: ${prismaResult.tables.length} tables found`,
  );

  logger.debug(`${label} Introspection complete`, {
    tableCount: prismaResult.tables.length,
    source: prismaResult.source,
    tableNames: prismaResult.tables.map((t) => t.name),
  });

  return prismaResult;
}

export function getTableSchema(tableName: string): TableInfo | null {
  const label = "[schema-introspector]";
  const schema = introspectSchema();
  const table = schema.tables.find(
    (t) => t.name.toLowerCase() === tableName.toLowerCase(),
  );

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
