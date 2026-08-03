"use client";

import {
  Database,
  Folder,
  FolderOpen,
  Layers,
  FileJson,
  Hash,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { NodeKind } from "@/lib/types/structure-bdd";

export type { ComponentType };
type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>;

export const KindIcon: Record<NodeKind, LucideIcon> = {
  database: Database,
  directory: Folder,
  collection: Layers,
  document: FileJson,
  chunk: Hash,
};

export const OpenKindIcon: Partial<Record<NodeKind, LucideIcon>> = {
  directory: FolderOpen,
  database: Database,
};

export function iconFor(kind: NodeKind, open: boolean): LucideIcon {
  if (open && OpenKindIcon[kind]) return OpenKindIcon[kind]!;
  return KindIcon[kind] ?? Folder;
}
