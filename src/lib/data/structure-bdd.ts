import type {
  DatabaseStructure,
  DatabaseTreeNode,
} from "@/lib/types/structure-bdd";

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
    stats: vectors > 0 && indexed
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
  };
}

function dir(
  name: string,
  path: string,
  children: DatabaseTreeNode[],
  opts: { indexed?: boolean; vectorized?: boolean; syncState?: DatabaseTreeNode["syncState"] } = {},
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
  };
}

function buildRegistryStructure(): DatabaseTreeNode[] {
  return [
    dir("bank", ".local-db/registry/bank", [
      dir("test", ".local-db/registry/bank/test", [
        dir("metadata.json", ".local-db/registry/bank/test/metadata.json", [
          doc("1_metadata.json", ".local-db/registry/bank/test/metadata.json/1_metadata.json", { vectors: 1, indexed: true }),
          doc("2_metadata.json", ".local-db/registry/bank/test/metadata.json/2_metadata.json", { vectors: 1, indexed: true }),
          doc("3_metadata.json", ".local-db/registry/bank/test/metadata.json/3_metadata.json", { vectors: 1, indexed: true }),
        ], { indexed: true, vectorized: true }),
      ], { indexed: true, vectorized: true }),
      dir("test1", ".local-db/registry/bank/test1", [
        dir("metadata.json", ".local-db/registry/bank/test1/metadata.json", [
          doc("1_metadata.json", ".local-db/registry/bank/test1/metadata.json/1_metadata.json", { vectors: 1, indexed: true }),
          doc("2_metadata.json", ".local-db/registry/bank/test1/metadata.json/2_metadata.json", { vectors: 1, indexed: true }),
        ], { indexed: true, vectorized: true }),
      ], { indexed: true, vectorized: true }),
      dir("test_11", ".local-db/registry/bank/test_11", [
        dir("metadata.json", ".local-db/registry/bank/test_11/metadata.json", [
          doc("1_metadata.json", ".local-db/registry/bank/test_11/metadata.json/1_metadata.json", { vectors: 1, indexed: true }),
          doc("2_metadata.json", ".local-db/registry/bank/test_11/metadata.json/2_metadata.json", { vectors: 1, indexed: true }),
        ], { indexed: true, vectorized: true }),
      ], { indexed: true, vectorized: true }),
    ]),
    dir("items", ".local-db/registry/items", [
      dir(
        "alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
        ".local-db/registry/items/alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
        [
          doc(
            "1_alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
            ".local-db/registry/items/alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json/1_alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
            { vectors: 1, indexed: true }
          ),
          doc(
            "2_alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
            ".local-db/registry/items/alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json/2_alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
            { vectors: 1, indexed: true }
          ),
        ],
        { indexed: true, vectorized: true }
      ),
      dir("niveau-condenseur.json", ".local-db/registry/items/niveau-condenseur.json", [
        doc("1_niveau-condenseur.json", ".local-db/registry/items/niveau-condenseur.json/1_niveau-condenseur.json", { vectors: 1, indexed: true }),
        doc("2_niveau-condenseur.json", ".local-db/registry/items/niveau-condenseur.json/2_niveau-condenseur.json", { vectors: 1, indexed: true }),
      ], { indexed: true, vectorized: true }),
      dir("rag_qr_2026-07-15T14-56-03-057Z.json", ".local-db/registry/items/rag_qr_2026-07-15T14-56-03-057Z.json", [
        doc(
          "1_rag_qr_2026-07-15T14-56-03-057Z.json",
          ".local-db/registry/items/rag_qr_2026-07-15T14-56-03-057Z.json/1_rag_qr_2026-07-15T14-56-03-057Z.json",
          { vectors: 1, indexed: true }
        ),
        doc(
          "2_rag_qr_2026-07-15T14-56-03-057Z.json",
          ".local-db/registry/items/rag_qr_2026-07-15T14-56-03-057Z.json/2_rag_qr_2026-07-15T14-56-03-057Z.json",
          { vectors: 1, indexed: true }
        ),
      ], { indexed: true, vectorized: true }),
    ]),
    dir("procedures", ".local-db/registry/procedures", [
      dir("crf-start-001", ".local-db/registry/procedures/crf-start-001", [
        dir("procedure.json", ".local-db/registry/procedures/crf-start-001/procedure.json", [
          doc("1_procedure.json", ".local-db/registry/procedures/crf-start-001/procedure.json/1_procedure.json", { vectors: 1, indexed: true }),
          doc("2_procedure.json", ".local-db/registry/procedures/crf-start-001/procedure.json/2_procedure.json", { vectors: 1, indexed: true }),
        ], { indexed: true, vectorized: true }),
      ], { indexed: true, vectorized: true }),
    ]),
  ];
}

function buildRawLocalDb(): DatabaseTreeNode[] {
  return [
    dir("Alarmes", ".local-db/Alarmes", [], { indexed: false, vectorized: false }),
    dir("bank", ".local-db/bank", [], { indexed: false, vectorized: false }),
    dir("Centrale", ".local-db/Centrale", [], { indexed: false, vectorized: false }),
    dir("Groupes", ".local-db/Groupes", [], { indexed: false, vectorized: false }),
    dir("registry", ".local-db/registry", buildRegistryStructure(), { indexed: true, vectorized: true }),
    dir("ressources humaines", ".local-db/ressources humaines", [
      dir("equipes", ".local-db/ressources humaines/equipes", [
        dir("equipe A", ".local-db/ressources humaines/equipes/equipe A", [], { indexed: false, vectorized: false }),
        dir("equipe B", ".local-db/ressources humaines/equipes/equipe B", [], { indexed: false, vectorized: false }),
        dir("equipe C", ".local-db/ressources humaines/equipes/equipe C", [], { indexed: false, vectorized: false }),
        dir("equipe D", ".local-db/ressources humaines/equipes/equipe D", [], { indexed: false, vectorized: false }),
      ], { indexed: false, vectorized: false }),
    ], { indexed: false, vectorized: false }),
    dir("web-sync", ".local-db/web-sync", [], { indexed: false, vectorized: false }),
    doc(".local-db-manifest.json", ".local-db/.local-db-manifest.json", { indexed: false }),
    doc("chroma-index.json", ".local-db/chroma-index.json", { indexed: false }),
    doc("local-db-manifest.json", ".local-db/local-db-manifest.json", { indexed: false }),
  ];
}

function buildIndexedLocalDb(): DatabaseTreeNode[] {
  return buildRawLocalDb().map((node) => {
    if (node.path === ".local-db/registry") {
      return node;
    }
    return {
      ...node,
      indexed: false,
      vectorized: false,
      stats: undefined,
      children: node.children?.map((c) => ({
        ...c,
        indexed: c.path.startsWith(".local-db/registry"),
        vectorized: c.path.startsWith(".local-db/registry"),
        stats: c.path.startsWith(".local-db/registry") ? c.stats : undefined,
      })),
    };
  });
}

export function buildDatabaseSchemaStructure(): DatabaseStructure {
  return {
    id: ".local-db",
    name: ".local-db",
    kind: "database",
    path: ".local-db",
    indexed: false,
    vectorized: false,
    children: buildRawLocalDb(),
  };
}

export function buildIndexedDatabaseStructure(): DatabaseStructure {
  const children = buildIndexedLocalDb();
  const vectors = children.reduce((acc, c) => acc + (c.stats?.vectors ?? 0), 0);
  return {
    id: ".local-db-indexed",
    name: ".local-db",
    kind: "database",
    path: ".local-db-indexed",
    indexed: true,
    vectorized: vectors > 0,
    children,
  };
}
