import type {
  DatabaseStructure,
  DatabaseTreeNode,
} from "@/lib/types/structure-bdd";

export function flattenNode(node: DatabaseTreeNode): DatabaseTreeNode[] {
  const out: DatabaseTreeNode[] = [node];
  const children = node.children ?? [];
  for (const c of children) out.push(...flattenNode(c));
  return out;
}

export function flattenStructure(
  structure: DatabaseStructure,
): DatabaseTreeNode[] {
  return flattenNode(structure);
}

export function findMatches(node: DatabaseTreeNode, term: string): string[] {
  const termLc = term.toLowerCase().trim();
  if (!termLc) return [];
  const matches: string[] = [];
  const walk = (n: DatabaseTreeNode) => {
    if (
      n.name.toLowerCase().includes(termLc) ||
      (n.collection ? n.collection.toLowerCase().includes(termLc) : false) ||
      (n.stats?.dimension ? String(n.stats.dimension).includes(termLc) : false)
    ) {
      matches.push(n.id);
    }
    const children = n.children ?? [];
    for (const c of children) walk(c);
  };
  walk(node);
  return matches;
}

export function ancestorIds(
  node: DatabaseTreeNode,
  targetId: string,
): string[] {
  const path: string[] = [];
  const walk = (n: DatabaseTreeNode): boolean => {
    if (n.id === targetId) return true;
    path.push(n.id);
    const children = n.children ?? [];
    for (const c of children) {
      if (walk(c)) return true;
    }
    path.pop();
    return false;
  };
  walk(node);
  return path;
}

export function matchingAncestors(
  structure: DatabaseStructure,
  term: string,
): string[] {
  const matches = findMatches(structure, term);
  if (matches.length === 0) return [];
  const ancestors = new Set<string>();
  for (const m of matches) {
    const chain = ancestorIds(structure, m);
    for (const a of chain) ancestors.add(a);
  }
  return Array.from(ancestors);
}

export function aggregateStats(node: DatabaseTreeNode): {
  documents: number;
  vectors: number;
  chunks: number;
  collections: number;
  dimension: number;
} {
  const all = flattenNode(node);
  const documents = all.filter((n) => n.kind === "document");
  const collections = new Set<string>();
  documents.forEach((d) => {
    if (d.collection) collections.add(d.collection);
  });
  return {
    documents: documents.length,
    vectors: documents.reduce((acc, d) => acc + (d.stats?.vectors ?? 0), 0),
    chunks: documents.reduce((acc, d) => acc + (d.stats?.chunks ?? 0), 0),
    collections: collections.size,
    dimension: documents.find((d) => d.stats?.dimension)?.stats?.dimension ?? 0,
  };
}
