import type {
  DatabaseStructure,
  DatabaseTreeNode,
} from "@/lib/types/structure-bdd";

const VEC_DIM = 384;

function doc(
  name: string,
  path: string,
  vectors: number,
  opts: {
    collection?: string;
    syncState?: DatabaseTreeNode["syncState"];
    indexed?: boolean;
  } = {},
): DatabaseTreeNode {
  return {
    id: path,
    name,
    kind: "document",
    path,
    indexed: opts.indexed ?? true,
    vectorized: vectors > 0,
    stats: {
      chunks: Math.max(1, vectors),
      vectors,
      dimension: VEC_DIM,
      sizeBytes: vectors * 2048,
    },
    collection: opts.collection,
    syncState: opts.syncState,
  };
}

function dir(
  name: string,
  path: string,
  children: DatabaseTreeNode[],
  opts: { syncState?: DatabaseTreeNode["syncState"] } = {},
): DatabaseTreeNode {
  const vectors = children.reduce((acc, c) => acc + (c.stats?.vectors ?? 0), 0);
  return {
    id: path,
    name,
    kind: "directory",
    path,
    indexed: true,
    vectorized: vectors > 0,
    children,
    stats: {
      chunks: children.reduce((acc, c) => acc + (c.stats?.chunks ?? 0), 0),
      vectors,
      dimension: VEC_DIM,
    },
    syncState: opts.syncState,
  };
}

function indexChromaChildren(): DatabaseTreeNode[] {
  return [
    dir("bank", "INDEX_CHROMA/bank", [
      dir("test", "INDEX_CHROMA/bank/test", [
        doc("metadata.json", "INDEX_CHROMA/bank/test/metadata.json", 3, {
          collection: "locdb-index-chroma-bank-test-metadata-json-ce2dab",
        }),
      ]),
      dir("test1", "INDEX_CHROMA/bank/test1", [
        doc("metadata.json", "INDEX_CHROMA/bank/test1/metadata.json", 2, {
          collection: "locdb-index-chroma-bank-test1-metadata-json-67140c",
        }),
      ]),
      dir("test_11", "INDEX_CHROMA/bank/test_11", [
        doc("metadata.json", "INDEX_CHROMA/bank/test_11/metadata.json", 2, {
          collection: "locdb-index-chroma-bank-test-11-metadata-json-d5c743",
        }),
      ]),
    ]),
    dir("items", "INDEX_CHROMA/items", [
      doc(
        "alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
        "INDEX_CHROMA/items/alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json",
        6,
        {
          collection: "locdb-index-chroma-items-alarmes-e3fe5c",
        },
      ),
      doc(
        "niveau-condenseur.json",
        "INDEX_CHROMA/items/niveau-condenseur.json",
        1,
        {
          collection: "locdb-index-chroma-items-niveau-condenseur-json-8346f8",
        },
      ),
      doc(
        "rag_qr_2026-07-15T14-56-03-057Z.json",
        "INDEX_CHROMA/items/rag_qr_2026-07-15T14-56-03-057Z.json",
        1,
        {
          collection:
            "locdb-index-chroma-items-rag-qr-2026-07-15t14-56-03-057z-json-f5629f",
        },
      ),
    ]),
    dir("procedures", "INDEX_CHROMA/procedures", [
      dir("crf-start-001", "INDEX_CHROMA/procedures/crf-start-001", [
        doc(
          "procedure.json",
          "INDEX_CHROMA/procedures/crf-start-001/procedure.json",
          24,
          {
            collection:
              "locdb-index-chroma-procedures-crf-start-001-procedure-json-4ee348",
          },
        ),
      ]),
    ]),
  ];
}

function chromaDirChildren(): DatabaseTreeNode[] {
  return indexChromaChildren().map((d) => {
    if (d.kind === "directory" && d.name === "bank") {
      return dir("bank", d.path, d.children ?? [], { syncState: "synced" });
    }
    if (d.kind === "directory" && d.name === "items") {
      return dir("items", d.path, d.children ?? [], { syncState: "synced" });
    }
    if (d.kind === "directory" && d.name === "procedures") {
      return dir("procedures", d.path, d.children ?? [], {
        syncState: "synced",
      });
    }
    return d;
  });
}

export function buildLocalStructure(): DatabaseStructure {
  const chroma = dir("INDEX_CHROMA", "INDEX_CHROMA", chromaDirChildren());
  return {
    id: "nexaflow_localdb",
    name: "NexaFlow Local DB",
    kind: "database",
    path: "nexaflow_localdb",
    indexed: true,
    vectorized: true,
    children: [chroma],
  };
}

const WEB_SYNC_STATES: Record<string, DatabaseTreeNode["syncState"]> = {
  "INDEX_CHROMA/bank/test/metadata.json": "synced",
  "INDEX_CHROMA/bank/test1/metadata.json": "synced",
  "INDEX_CHROMA/bank/test_11/metadata.json": "pending",
  "INDEX_CHROMA/items/alarmes-et-seuils-de-declenchement-de-la-turbine-a-gaz-TG.json":
    "synced",
  "INDEX_CHROMA/items/niveau-condenseur.json": "local-only",
  "INDEX_CHROMA/items/rag_qr_2026-07-15T14-56-03-057Z.json": "conflict",
  "INDEX_CHROMA/procedures/crf-start-001/procedure.json": "synced",
};

export function buildWebStructure(): DatabaseStructure {
  const chroma = dir("INDEX_CHROMA", "INDEX_CHROMA", indexChromaChildren());
  chroma.children = (chroma.children ?? []).map((d) => applyWebSync(d));
  return {
    id: "nexaflow_web",
    name: "NexaFlow Web DB",
    kind: "database",
    path: "nexaflow_web",
    indexed: true,
    vectorized: true,
    children: [chroma],
  };
}

function applyWebSync(node: DatabaseTreeNode): DatabaseTreeNode {
  const syncState = WEB_SYNC_STATES[node.path] ?? "synced";
  const indexed = syncState !== "local-only";
  if (node.children) {
    return {
      ...node,
      syncState,
      indexed,
      children: node.children.map(applyWebSync),
    };
  }
  return { ...node, syncState, indexed };
}
