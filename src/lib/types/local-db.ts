import { z } from "zod";
import { SyncStateSchema } from "./structure-bdd";

export const EntityTypeSchema = z.enum([
  "centrale",
  "sous_centrale",
  "equipement",
  "groupe",
  "alarme",
  "procedure",
  "document",
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type LocalMetaType = EntityType;

export const LocalMetaSchema = z.object({
  path: z.string().min(1, "Chemin requis"),
  libelle: z.string().min(1, "Libellé requis"),
  code: z.string().min(1, "Code requis"),
  type: EntityTypeSchema,
  parentId: z.string().optional(),
  syncState: SyncStateSchema.default("local-only"),
  lastSyncAt: z.coerce.date().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type LocalMeta = z.infer<typeof LocalMetaSchema>;

export const LocalMetaInputSchema = LocalMetaSchema.pick({
  libelle: true,
  code: true,
  type: true,
  parentId: true,
  description: true,
  tags: true,
  metadata: true,
});
export type LocalMetaInput = z.infer<typeof LocalMetaInputSchema>;

export const LocalMetaFileSchema = z.object({
  libelle: z.string().min(1),
  code: z.string().min(1),
  type: EntityTypeSchema,
  parentId: z.string().optional(),
  syncState: SyncStateSchema.default("local-only"),
});
export type LocalMetaFile = z.infer<typeof LocalMetaFileSchema>;

export const CentraleMetaSchema = LocalMetaSchema.extend({
  type: z.literal("centrale"),
});
export type CentraleMeta = z.infer<typeof CentraleMetaSchema>;

export const SousCentraleMetaSchema = LocalMetaSchema.extend({
  type: z.literal("sous_centrale"),
  parentId: z.string().min(1, "parentId requis pour sous-centrale"),
});
export type SousCentraleMeta = z.infer<typeof SousCentraleMetaSchema>;

export const EquipementMetaSchema = LocalMetaSchema.extend({
  type: z.literal("equipement"),
  parentId: z.string().min(1, "parentId requis pour équipement"),
});
export type EquipementMeta = z.infer<typeof EquipementMetaSchema>;

export const GroupeMetaSchema = LocalMetaSchema.extend({
  type: z.literal("groupe"),
});
export type GroupeMeta = z.infer<typeof GroupeMetaSchema>;

export const SyncQueueItemSchema = z.object({
  id: z.string(),
  operation: z.enum(["create", "update", "delete"]),
  entity: z.enum([
    "centrale",
    "groupe",
    "equipement",
    "procedure",
    "alarme",
    "qa",
  ]),
  entityId: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime(),
  status: z.enum(["pending", "synced", "failed"]).default("pending"),
  retryCount: z.number().int().nonnegative().default(0),
  lastError: z.string().optional(),
});
export type SyncQueueItem = z.infer<typeof SyncQueueItemSchema>;

export const SyncManifestSchema = z.object({
  version: z.string(),
  lastSync: z.coerce.date().optional(),
  pendingCount: z.number().int().nonnegative(),
  syncedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
});
export type SyncManifest = z.infer<typeof SyncManifestSchema>;
