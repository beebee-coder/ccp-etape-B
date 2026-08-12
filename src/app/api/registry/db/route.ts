import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface DbRegistryNode {
  id: string;
  path: string;
  libelle?: string;
  level: number;
  parentPath?: string;
}

interface ApiTreeNode {
  name: string;
  path: string;
  kind: "directory" | "document";
  children?: ApiTreeNode[];
  stats?: { sizeBytes: number };
  libelle?: string;
}

export async function GET() {
  try {
    const nodes = (await prisma.locationNode.findMany({
      where: { locationType: "registry" },
      orderBy: [{ level: "asc" }, { path: "asc" }],
      select: { id: true, path: true, libelle: true, level: true, parentPath: true },
    })) as DbRegistryNode[];

    const byPath = new Map<string, ApiTreeNode>();
    const roots: ApiTreeNode[] = [];

    for (const node of nodes) {
      const segments = node.path.split("/").filter(Boolean);
      const name = segments[segments.length - 1] || node.path;
      const treeNode: ApiTreeNode = {
        name,
        path: node.path,
        kind: "directory",
        libelle: node.libelle,
        children: [],
      };
      byPath.set(node.path, treeNode);
    }

    for (const node of nodes) {
      const treeNode = byPath.get(node.path);
      if (!treeNode) continue;

      if (node.parentPath && byPath.has(node.parentPath)) {
        const parent = byPath.get(node.parentPath)!;
        parent.children = parent.children || [];
        parent.children.push(treeNode);
      } else {
        roots.push(treeNode);
      }
    }

    const tree: ApiTreeNode = {
      name: ".registry",
      path: ".registry",
      kind: "directory",
      children: roots,
    };

    return NextResponse.json({
      children: tree.children,
      source: "database",
      totalNodes: nodes.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("[API /api/registry/db] error", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}