import type {
  DatabaseStructure,
  DatabaseTreeNode,
} from "@/lib/types/structure-bdd";

import centraleData from "../../../doc/centrale.json";
import groupesData from "../../../doc/Groupes.json";
import { introspectSchema } from "@/lib/structure-bdd/schema-introspector";

interface JsonLeafNode {
  nom: string;
  libelle: string;
}

interface JsonBranchNode {
  libelle: string;
  descendants: JsonLeafNode[];
}

interface CentraleJsonData {
  Centrale: Record<string, JsonBranchNode>;
}

interface GroupesJsonData {
  Groupes: Record<string, { descendants: JsonLeafNode[] }>;
}

const VEC_DIM = 384;

function doc(
  name: string,
  path: string,
  opts: {
    vectors?: number;
    indexed?: boolean;
    vectorized?: boolean;
    collection?: string;
    syncState?: DatabaseTreeNode["syncState"];
    indexedAt?: string;
    libelle?: string;
  } = {},
): DatabaseTreeNode {
  const vectors = opts.vectors ?? 0;
  const indexed = opts.indexed ?? false;
  return {
    id: path,
    name,
    kind: "document",
    path,
    indexed,
    vectorized: opts.vectorized ?? (vectors > 0 && indexed),
    stats:
      vectors > 0 && indexed
        ? {
            chunks: Math.max(1, vectors),
            vectors,
            dimension: VEC_DIM,
            sizeBytes: vectors * 2048,
          }
        : undefined,
    collection: opts.collection,
    syncState: opts.syncState,
    indexedAt: opts.indexedAt,
    ...(opts.libelle ? { libelle: opts.libelle } : {}),
  };
}

function dir(
  name: string,
  path: string,
  children: DatabaseTreeNode[],
  opts: {
    indexed?: boolean;
    vectorized?: boolean;
    syncState?: DatabaseTreeNode["syncState"];
    libelle?: string;
  } = {},
): DatabaseTreeNode {
  const vectors = children.reduce((acc, c) => acc + (c.stats?.vectors ?? 0), 0);
  return {
    id: path,
    name,
    kind: "directory",
    path,
    indexed: opts.indexed ?? false,
    vectorized: opts.vectorized ?? (vectors > 0 && (opts.indexed ?? false)),
    children,
    stats: {
      chunks: children.reduce((acc, c) => acc + (c.stats?.chunks ?? 0), 0),
      vectors,
      dimension: VEC_DIM,
    },
    syncState: opts.syncState,
    ...(opts.libelle ? { libelle: opts.libelle } : {}),
  };
}

function buildRegistryStructure(): DatabaseTreeNode[] {
  return [
    dir("bank", ".registry/bank", [
      dir(
        "test",
        ".registry/bank/test",
        [
          dir(
            "metadata.json",
            ".registry/bank/test/metadata.json",
            [
              doc(
                "1_metadata.json",
                ".registry/bank/test/metadata.json/1_metadata.json",
                { vectors: 1, indexed: true },
              ),
              doc(
                "2_metadata.json",
                ".registry/bank/test/metadata.json/2_metadata.json",
                { vectors: 1, indexed: true },
              ),
              doc(
                "3_metadata.json",
                ".registry/bank/test/metadata.json/3_metadata.json",
                { vectors: 1, indexed: true },
              ),
            ],
            { indexed: true, vectorized: true },
          ),
        ],
        { indexed: true, vectorized: true },
      ),
      dir(
        "test1",
        ".registry/bank/test1",
        [
          dir(
            "metadata.json",
            ".registry/bank/test1/metadata.json",
            [
              doc(
                "1_metadata.json",
                ".registry/bank/test1/metadata.json/1_metadata.json",
                { vectors: 1, indexed: true },
              ),
              doc(
                "2_metadata.json",
                ".registry/bank/test1/metadata.json/2_metadata.json",
                { vectors: 1, indexed: true },
              ),
            ],
            { indexed: true, vectorized: true },
          ),
        ],
        { indexed: true, vectorized: true },
      ),
      dir(
        "test_11",
        ".registry/bank/test_11",
        [
          dir(
            "metadata.json",
            ".registry/bank/test_11/metadata.json",
            [
              doc(
                "1_metadata.json",
                ".registry/bank/test_11/metadata.json/1_metadata.json",
                { vectors: 1, indexed: true },
              ),
              doc(
                "2_metadata.json",
                ".registry/bank/test_11/metadata.json/2_metadata.json",
                { vectors: 1, indexed: true },
              ),
            ],
            { indexed: true, vectorized: true },
          ),
        ],
        { indexed: true, vectorized: true },
      ),
    ]),
    dir("items", ".registry/items", [
      dir(
        "alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
        ".registry/items/alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
        [
          doc(
            "1_alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
            ".registry/items/alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json/1_alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
            { vectors: 1, indexed: true },
          ),
          doc(
            "2_alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
            ".registry/items/alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json/2_alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
            { vectors: 1, indexed: true },
          ),
        ],
        { indexed: true, vectorized: true },
      ),
      dir(
        "niveau-condenseur.json",
        ".registry/items/niveau-condenseur.json",
        [
          doc(
            "1_niveau-condenseur.json",
            ".registry/items/niveau-condenseur.json/1_niveau-condenseur.json",
            { vectors: 1, indexed: true },
          ),
          doc(
            "2_niveau-condenseur.json",
            ".registry/items/niveau-condenseur.json/2_niveau-condenseur.json",
            { vectors: 1, indexed: true },
          ),
        ],
        { indexed: true, vectorized: true },
      ),
      dir(
        "rag_qr_2026-07-15T14-56-03-057Z.json",
        ".registry/items/rag_qr_2026-07-15T14-56-03-057Z.json",
        [
          doc(
            "1_rag_qr_2026-07-15T14-56-03-057Z.json",
            ".registry/items/rag_qr_2026-07-15T14-56-03-057Z.json/1_rag_qr_2026-07-15T14-56-03-057Z.json",
            { vectors: 1, indexed: true },
          ),
          doc(
            "2_rag_qr_2026-07-15T14-56-03-057Z.json",
            ".registry/items/rag_qr_2026-07-15T14-56-03-057Z.json/2_rag_qr_2026-07-15T14-56-03-057Z.json",
            { vectors: 1, indexed: true },
          ),
        ],
        { indexed: true, vectorized: true },
      ),
    ]),
    dir("procedures", ".registry/procedures", [
      dir(
        "crf-start-001",
        ".registry/procedures/crf-start-001",
        [
          dir(
            "procedure.json",
            ".registry/procedures/crf-start-001/procedure.json",
            [
              doc(
                "1_procedure.json",
                ".registry/procedures/crf-start-001/procedure.json/1_procedure.json",
                { vectors: 1, indexed: true },
              ),
              doc(
                "2_procedure.json",
                ".registry/procedures/crf-start-001/procedure.json/2_procedure.json",
                { vectors: 1, indexed: true },
              ),
            ],
            { indexed: true, vectorized: true },
          ),
        ],
        { indexed: true, vectorized: true },
      ),
    ]),
  ];
}

function buildCentraleChildren(): DatabaseTreeNode[] {
  const data = centraleData as unknown as CentraleJsonData;
  return Object.entries(data.Centrale).map(([key, branch]) =>
    dir(
      key,
      `Centrale/${key}`,
      branch.descendants.map((leaf) =>
        dir(leaf.nom, `Centrale/${key}/${leaf.nom}`, [], {
          indexed: false,
          vectorized: false,
          libelle: leaf.libelle,
        }),
      ),
      {
        indexed: false,
        vectorized: false,
        libelle: branch.libelle,
      },
    ),
  );
}

function buildGroupesChildren(): DatabaseTreeNode[] {
  const data = groupesData as unknown as GroupesJsonData;
  return Object.entries(data.Groupes).map(([groupName, group]) =>
    dir(
      groupName,
      `Groupes/${groupName}`,
      group.descendants.map((leaf) =>
        dir(leaf.nom, `Groupes/${groupName}/${leaf.nom}`, [], {
          indexed: false,
          vectorized: false,
          libelle: leaf.libelle,
        }),
      ),
      {
        indexed: false,
        vectorized: false,
        libelle: groupName,
      },
    ),
  );
}

export function getWebDatabaseStructure(): DatabaseStructure {
  return {
    id: "web",
    name: "web",
    kind: "database",
    path: "web",
    indexed: false,
    vectorized: false,
    children: [
      dir("registry", ".registry", buildRegistryStructure(), {
        indexed: true,
        vectorized: true,
      }),
      dir("Centrale", "Centrale", buildCentraleChildren(), {
        indexed: false,
        vectorized: false,
      }),
      dir("Groupes", "Groupes", buildGroupesChildren(), {
        indexed: false,
        vectorized: false,
      }),
    ],
  };
}

interface IntrospectedColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimary: boolean;
  isForeign: boolean;
  references: string | null;
}

interface IntrospectedTable {
  name: string;
  description: string;
  columns: IntrospectedColumn[];
  indexes: string[];
  relations: string[];
}

export function introspectDatabaseSchema(): IntrospectedTable[] {
  const label = "[structure-bdd-data]";
  console.log(`${label} 🔍 Starting database schema introspection`);

  try {
    const result = introspectSchema();
    console.log(
      `${label} ✅ Schema introspection successful: ${result.tables.length} tables found (source: ${result.source})`,
    );

    const tables: IntrospectedTable[] = result.tables.map((t) => ({
      name: t.name,
      description: t.description,
      columns: t.columns.map((c) => ({
        name: c.name,
        type: c.type,
        nullable: c.nullable,
        defaultValue: c.defaultValue,
        isPrimary: c.isPrimary,
        isForeign: c.isForeign,
        references: c.references,
      })),
      indexes: t.indexes,
      relations: t.relations,
    }));

    console.log(
      `${label} 📊 Mapped ${tables.length} tables to introspection format`,
      { tableNames: tables.map((t) => t.name) },
    );

    return tables;
  } catch (error) {
    console.error(
      `${label} ❌ Schema introspection failed`,
      { error: error instanceof Error ? error.message : String(error) },
    );
    throw error;
  }
}

export function getTableDefinition(tableName: string): IntrospectedTable | null {
  const label = "[structure-bdd-data]";
  console.log(`${label} 🔍 Looking up table definition: "${tableName}"`);

  const tables = introspectDatabaseSchema();
  const table = tables.find(
    (t) => t.name.toLowerCase() === tableName.toLowerCase(),
  );

  if (!table) {
    console.warn(
      `${label} ⚠ Table "${tableName}" not found in introspected schema`,
      { availableTables: tables.map((t) => t.name) },
    );
    return null;
  }

  console.log(
    `${label} ✅ Found table "${tableName}"`,
    {
      columnCount: table.columns.length,
      indexCount: table.indexes.length,
      relationCount: table.relations.length,
    },
  );

  return table;
}

export function getAllTableDefinitions(): IntrospectedTable[] {
  const label = "[structure-bdd-data]";
  console.log(`${label} 🔍 Fetching all table definitions`);

  const tables = introspectDatabaseSchema();

  console.log(
    `${label} ✅ Returning ${tables.length} table definitions`,
    { tableNames: tables.map((t) => t.name) },
  );

  return tables;
}
