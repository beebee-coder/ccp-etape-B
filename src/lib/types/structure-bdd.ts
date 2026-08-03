import { z } from "zod";

export const NodeKindSchema = z.enum([
  "database",
  "directory",
  "collection",
  "document",
  "chunk",
]);
export type NodeKind = z.infer<typeof NodeKindSchema>;

export const SyncStateSchema = z.enum([
  "synced",
  "pending",
  "conflict",
  "local-only",
]);
export type SyncState = z.infer<typeof SyncStateSchema>;

export const NodeStatsSchema = z.object({
  chunks: z.number().int().nonnegative(),
  vectors: z.number().int().nonnegative(),
  dimension: z.number().int().positive().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});
export type NodeStats = z.infer<typeof NodeStatsSchema>;

export interface DatabaseTreeNode {
  id: string;
  name: string;
  kind: NodeKind;
  path: string;
  indexed: boolean;
  vectorized: boolean;
  children?: DatabaseTreeNode[];
  stats?: NodeStats;
  collection?: string;
  syncState?: SyncState;
  indexedAt?: string;
}

export const DatabaseTreeNodeSchema: z.ZodType<DatabaseTreeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    kind: NodeKindSchema,
    path: z.string(),
    indexed: z.boolean(),
    vectorized: z.boolean(),
    children: z.array(DatabaseTreeNodeSchema).optional(),
    stats: NodeStatsSchema.optional(),
    collection: z.string().optional(),
    syncState: SyncStateSchema.optional(),
    indexedAt: z.string().datetime().optional(),
  }),
);

export const DatabaseStructureSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.literal("database"),
  path: z.string(),
  indexed: z.boolean(),
  vectorized: z.boolean(),
  children: z.array(DatabaseTreeNodeSchema),
});
export type DatabaseStructure = z.infer<typeof DatabaseStructureSchema>;
