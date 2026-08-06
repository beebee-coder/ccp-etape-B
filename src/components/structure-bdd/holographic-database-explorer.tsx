"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Search,
  Database,
  GitMerge,
  BarChart3,
  Layers,
  Plus,
  FileText,
  X,
  Wand2,
} from "lucide-react";
import type { ComponentType } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  DatabaseStructure,
  DatabaseTreeNode,
  SyncState,
} from "@/lib/types/structure-bdd";
import {
  findMatches,
  matchingAncestors,
  aggregateStats,
} from "@/lib/structure-bdd/tree-utils";
import { TreeNode } from "./tree-node";

const ACCENTS = {
  schema: {
    color: "hsl(210 90% 60%)",
    bg: "hsl(210 90% 64% / 0.12)",
  },
  indexed: {
    color: "hsl(150 80% 50%)",
    bg: "hsl(150 80% 64% / 0.12)",
  },
};

interface ApiTreeNode {
  name: string;
  path: string;
  kind: string;
  children?: ApiTreeNode[];
  stats?: { sizeBytes: number };
  vectorized?: boolean;
  libelle?: string;
}

async function buildStructure(
  children: ApiTreeNode[],
): Promise<DatabaseTreeNode[]> {
  const nodes: DatabaseTreeNode[] = [];
  for (const child of children) {
    const childPath = child.path;
    const node: DatabaseTreeNode = {
      id: childPath,
      name: child.name,
      kind: child.kind as DatabaseTreeNode["kind"],
      path: childPath,
      indexed: child.vectorized ?? false,
      vectorized: child.vectorized ?? false,
      children:
        child.kind === "directory"
          ? await buildStructure(child.children || [])
          : undefined,
      ...(child.libelle ? { libelle: child.libelle } : {}),
    };
    nodes.push(node);
  }
  return nodes;
}

type ModalMode = "create" | "rename" | null;

export function HolographicDatabaseExplorer() {
  const [schemaStructure, setSchemaStructure] =
    useState<DatabaseStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{
    path: string;
    content: string;
    name: string;
    isImage?: boolean;
  } | null>(null);
  const [modal, setModal] = useState<{
    mode: ModalMode;
    parentPath?: string;
    targetPath?: string;
    defaultName?: string;
  } | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalKind, setModalKind] = useState<"file" | "directory">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [vectorizedFiles, setVectorizedFiles] = useState<Set<string>>(
    () => new Set(),
  );

  const loadStructure = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/local-db/fs?t=${Date.now()}`);
      const data = (await res.json()) as {
        children?: ApiTreeNode[];
        vectorizedPaths?: string[];
      };
      const nodes = await buildStructure(data.children || []);
      setSchemaStructure({
        id: ".local-db",
        name: ".local-db",
        kind: "database",
        path: ".local-db",
        indexed: false,
        vectorized: false,
        children: nodes,
      });
      if (data.vectorizedPaths) {
        setVectorizedFiles(new Set(data.vectorizedPaths));
      }
    } catch {
      toast.error("Erreur lors du chargement de .local-db");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStructure();
  }, [loadStructure]);

  const indexedStructure = useMemo<DatabaseStructure>(() => {
    if (!schemaStructure) {
      return {
        id: ".local-db-indexed",
        name: ".local-db",
        kind: "database",
        path: ".local-db-indexed",
        indexed: false,
        vectorized: false,
        children: [],
      };
    }
    const clone = JSON.parse(
      JSON.stringify(schemaStructure),
    ) as DatabaseStructure;

    const filterVectorized = (node: DatabaseTreeNode): DatabaseTreeNode => {
      if (node.kind === "document") {
        if (vectorizedFiles.has(node.path)) {
          node.indexed = true;
          node.vectorized = true;
          node.stats = node.stats || {
            vectors: 1,
            chunks: 1,
            dimension: 384,
            sizeBytes: 1024,
          };
        } else {
          node.indexed = false;
          node.vectorized = false;
          node.stats = undefined;
        }
        return node;
      }

      if (node.children) {
        const filteredChildren = node.children.map(filterVectorized);
        const hasVectorized = filteredChildren.some(
          (c) => c.kind === "document" && c.vectorized,
        );
        return {
          ...node,
          indexed: hasVectorized,
          vectorized: hasVectorized,
          children: filteredChildren,
        };
      }

      return node;
    };

    const filteredRoot = filterVectorized(clone);
    return {
      ...filteredRoot,
      kind: "database",
      id: ".local-db-indexed",
      path: ".local-db-indexed",
    } as DatabaseStructure;
  }, [schemaStructure, vectorizedFiles]);

  const vectorizationState = useMemo<
    "complete" | "pending" | "in-progress"
  >(() => {
    if (!schemaStructure) return "pending";

    const allFiles: string[] = [];
    const walk = (node: DatabaseTreeNode) => {
      if (node.kind === "document") allFiles.push(node.path);
      node.children?.forEach(walk);
    };
    walk(schemaStructure);

    if (allFiles.length === 0) return "pending";
    if (vectorizedFiles.size === 0) return "pending";
    if (vectorizedFiles.size === allFiles.length) return "complete";
    return "in-progress";
  }, [schemaStructure, vectorizedFiles]);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([".local-db"]),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggleNode = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSelect = (node: DatabaseTreeNode) => {
    setSelectedId(node.id);
    if (node.children && node.children.length > 0) toggleNode(node.id);
  };

  const refreshNode = async (nodeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });
    await loadStructure();
  };

  const handleCreate = async () => {
    if (!modal || !modal.parentPath) return;
    try {
      if (modalKind === "file") {
        if (!selectedFile) {
          toast.error("Veuillez sélectionner un fichier à uploader");
          return;
        }
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("path", modal.parentPath);

        const res = await fetch(`/api/local-db/fs?t=${Date.now()}`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Erreur upload" }));
          throw new Error(err.error || "Erreur upload");
        }
        toast.success("Fichier uploadé");
      } else {
        if (!modalName.trim()) {
          toast.error("Veuillez saisir un nom de dossier");
          return;
        }
        const res = await fetch(`/api/local-db/fs?t=${Date.now()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: modal.parentPath,
            name: modalName.trim(),
            kind: modalKind,
          }),
        });
        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Erreur création" }));
          throw new Error(err.error || "Erreur création");
        }
        toast.success("Dossier créé");
      }
      setModal(null);
      setModalName("");
      setSelectedFile(null);
      await refreshNode(modal.parentPath);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Erreur lors de la création";
      toast.error(message);
    }
  };

  const handleDelete = async (nodePath: string) => {
    if (!confirm("Supprimer ce fichier/dossier ?")) return;
    try {
      const res = await fetch(
        `/api/local-db/fs?path=${encodeURIComponent(nodePath)}&t=${Date.now()}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Erreur suppression" }));
        throw new Error(err.error || "Erreur suppression");
      }
      toast.success("Élément supprimé");
      if (selectedId === nodePath) setSelectedId(null);
      await loadStructure();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Erreur lors de la suppression";
      toast.error(message);
    }
  };

  const handleRename = async () => {
    if (!modal || !modalName.trim() || !modal.targetPath) return;
    try {
      const res = await fetch(`/api/local-db/fs?t=${Date.now()}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: modal.targetPath,
          newName: modalName.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Erreur renommage" }));
        throw new Error(err.error || "Erreur renommage");
      }
      toast.success("Élément renommé");
      setModal(null);
      setModalName("");
      await loadStructure();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Erreur lors du renommage";
      toast.error(message);
    }
  };

  const handlePreview = async (node: DatabaseTreeNode) => {
    if (node.kind !== "document") return;
    try {
      const res = await fetch(
        `/api/local-db/fs?path=${encodeURIComponent(node.path)}&read=true&t=${Date.now()}`,
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPreview({ path: node.path, content: data.content, name: node.name, isImage: data.isImage });
    } catch {
      setPreview({
        path: node.path,
        content: "[Impossible de lire le fichier]",
        name: node.name,
      });
    }
  };

  const handleVectorize = async (nodePath: string) => {
    try {
      const res = await fetch(`/api/local-db/fs?t=${Date.now()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: nodePath,
          action: "vectorize",
        }),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Erreur vectorisation" }));
        throw new Error(err.error || "Erreur vectorisation");
      }
      setVectorizedFiles((prev) => {
        const next = new Set(prev);
        next.add(nodePath);
        return next;
      });
      toast.success("Fichier vectorisé avec succès");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Erreur lors de la vectorisation";
      toast.error(message);
    }
  };

  const handleVectorizeAll = async () => {
    if (!schemaStructure) return;
    try {
      const allFiles: string[] = [];
      const walk = (node: DatabaseTreeNode) => {
        if (node.kind === "document" && !vectorizedFiles.has(node.path)) {
          allFiles.push(node.path);
        }
        node.children?.forEach(walk);
      };
      walk(schemaStructure);

      if (allFiles.length === 0) {
        toast.info("Aucun fichier à vectoriser");
        return;
      }

      let successCount = 0;
      for (const filePath of allFiles) {
        try {
          const res = await fetch(`/api/local-db/fs?t=${Date.now()}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: filePath,
              action: "vectorize",
            }),
          });
          if (res.ok) {
            successCount++;
            setVectorizedFiles((prev) => {
              const next = new Set(prev);
              next.add(filePath);
              return next;
            });
          }
        } catch {
          // continue with next file
        }
      }

      toast.success(`${successCount} fichier(s) vectorisé(s)`);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Erreur lors de la vectorisation";
      toast.error(message);
    }
  };

  const matchIds = useMemo<string[]>(() => {
    if (!schemaStructure) return [];
    const set = new Set<string>();
    if (searchTerm) {
      findMatches(schemaStructure, searchTerm).forEach((id) => set.add(id));
      if (indexedStructure)
        findMatches(indexedStructure, searchTerm).forEach((id) => set.add(id));
    }
    return Array.from(set);
  }, [schemaStructure, indexedStructure, searchTerm]);

  const highlightAncestors = useMemo<string[]>(() => {
    if (!schemaStructure) return [];
    const set = new Set<string>();
    if (searchTerm) {
      matchingAncestors(schemaStructure, searchTerm).forEach((id) =>
        set.add(id),
      );
      if (indexedStructure)
        matchingAncestors(indexedStructure, searchTerm).forEach((id) =>
          set.add(id),
        );
    }
    return Array.from(set);
  }, [schemaStructure, indexedStructure, searchTerm]);

  const allNodes = useMemo(() => {
    if (!schemaStructure) return [];
    const nodes: DatabaseTreeNode[] = [];
    const walk = (node: DatabaseTreeNode) => {
      nodes.push(node);
      node.children?.forEach(walk);
    };
    walk(schemaStructure);
    if (indexedStructure) {
      const walk2 = (node: DatabaseTreeNode) => {
        const idx = nodes.find((n) => n.id === node.id);
        if (idx) {
          idx.indexed = node.indexed;
          idx.vectorized = node.vectorized;
        }
        node.children?.forEach(walk2);
      };
      walk2(indexedStructure);
    }
    return nodes;
  }, [schemaStructure, indexedStructure]);

  const selected = allNodes.find((n) => n.id === selectedId) ?? null;

  const schemaStats = useMemo(
    () =>
      schemaStructure
        ? aggregateStats(schemaStructure)
        : { documents: 0, vectors: 0, chunks: 0, collections: 0, dimension: 0 },
    [schemaStructure],
  );
  const indexedStats = useMemo(
    () =>
      indexedStructure
        ? aggregateStats(indexedStructure)
        : { documents: 0, vectors: 0, chunks: 0, collections: 0, dimension: 0 },
    [indexedStructure],
  );

  return (
    <section className="relative isolate">
      <div className="pointer-events-none absolute -inset-4">
        <div className="absolute inset-0 bg-gradient-mesh opacity-[0.11]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <div className="relative mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher une table ou colonne..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64 rounded-xl border-border/60 bg-background/60 focus:border-primary/50"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadStructure}
            className="h-8 rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary"
          >
            Réinitialiser
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleVectorizeAll}
            className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Vectoriser tout
          </Button>
        </div>
      </div>

      {loading && (
        <Card className="dashboard-card flex h-24 items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <span>Chargement de .local-db...</span>
          </div>
        </Card>
      )}

      {!loading && schemaStructure && (
        <>
          <DbStatsRibbon
            tablesCount={schemaStructure.children?.length ?? 0}
            columnsCount={schemaStats.documents}
            totalVectors={indexedStats.vectors}
            totalChunks={indexedStats.chunks}
          />

          {selected && <SelectedDetail node={selected} className="mt-4" />}

          {preview && (
            <Card className="dashboard-card mt-4 overflow-hidden">
              <div className="border-b border-border/50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {preview.name}
                  </h3>
                  <span className="text-xs text-muted-foreground font-mono">
                    {preview.path}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 rounded-lg p-0"
                  onClick={() => setPreview(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {preview?.isImage ? (
                <div className="flex items-center justify-center bg-muted/20 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview.content}
                    alt={preview.name}
                    className="max-h-80 max-w-full rounded-lg object-contain"
                  />
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto bg-muted/20 p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground/80">
                    {preview.content}
                  </pre>
                </div>
              )}
            </Card>
          )}

          <div className="relative isolate mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1fr_10rem_1fr]">
            <TreePanel
              label="Schéma BDD"
              subtitle="Structure physique .local-db"
              structure={schemaStructure}
              accent="schema"
              expanded={expanded}
              onToggle={toggleNode}
              onSelect={onSelect}
              selectedId={selectedId}
              hoveredId={null}
              onHover={() => {}}
              searchTerm={searchTerm}
              matchIds={matchIds}
              highlightAncestors={highlightAncestors}
              onPreview={handlePreview}
              onDelete={handleDelete}
              onRename={(path, currentName) => {
                setModal({
                  mode: "rename",
                  targetPath: path,
                  defaultName: currentName,
                });
                setModalName(currentName);
              }}
              onCreate={(parentPath) => {
                setModal({ mode: "create", parentPath });
                setModalName("");
                setModalKind("file");
                setSelectedFile(null);
              }}
              onVectorize={handleVectorize}
            />

            <SyncSpine
              syncSummary={{
                synced: indexedStats.vectors,
                pending: 0,
                conflict: 0,
                "local-only": schemaStats.documents - indexedStats.vectors,
              }}
              vectorizationState={vectorizationState}
            />

            <TreePanel
              label="Indexation & Vectorisation"
              subtitle="État après dernière action"
              structure={indexedStructure}
              accent="indexed"
              expanded={expanded}
              onToggle={toggleNode}
              onSelect={onSelect}
              selectedId={selectedId}
              hoveredId={null}
              onHover={() => {}}
              searchTerm={searchTerm}
              matchIds={matchIds}
              highlightAncestors={highlightAncestors}
              onPreview={handlePreview}
              onDelete={handleDelete}
              onRename={(path, currentName) => {
                setModal({
                  mode: "rename",
                  targetPath: path,
                  defaultName: currentName,
                });
                setModalName(currentName);
              }}
              onCreate={(parentPath) => {
                setModal({ mode: "create", parentPath });
                setModalName("");
                setModalKind("file");
                setSelectedFile(null);
              }}
            />
          </div>

          <div className="relative mt-8 text-center text-xs text-muted-foreground/60">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3 w-3" />
              Panneau gauche : schéma physique de .local-db. Panneau droit :
              même arborescence avec l’état d’indexation et de vectorisation.
            </span>
          </div>
        </>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">
              {modal.mode === "create" ? "Nouvel élément" : "Renommer"}
            </h3>
            {modal.mode === "create" && (
              <div className="flex gap-2">
                <Button
                  variant={modalKind === "file" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setModalKind("file");
                    setSelectedFile(null);
                  }}
                  className="flex-1 rounded-xl"
                >
                  <FileText className="h-4 w-4 mr-2" /> Fichier
                </Button>
                <Button
                  variant={modalKind === "directory" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setModalKind("directory")}
                  className="flex-1 rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-2" /> Dossier
                </Button>
              </div>
            )}
            {modalKind === "directory" ? (
              <Input
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                placeholder="Nom du dossier"
                className="rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            ) : (
              <div className="space-y-2">
                <Input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      setModalName(file.name);
                    }
                  }}
                  className="rounded-xl"
                />
                {selectedFile && (
                  <p className="text-xs text-muted-foreground">
                    Fichier sélectionné : {selectedFile.name} (
                    {(selectedFile.size / 1024).toFixed(1)} Ko)
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setModal(null);
                  setSelectedFile(null);
                }}
                className="rounded-xl"
              >
                Annuler
              </Button>
              <Button
                onClick={modal.mode === "rename" ? handleRename : handleCreate}
                className="rounded-xl"
              >
                {modal.mode === "create"
                  ? modalKind === "directory"
                    ? "Créer"
                    : "Uploader"
                  : "Renommer"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}

interface TreePanelProps {
  label: string;
  subtitle: string;
  structure: DatabaseStructure;
  accent: "schema" | "indexed";
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: DatabaseTreeNode) => void;
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  searchTerm: string;
  matchIds: string[];
  highlightAncestors: string[];
  onPreview: (node: DatabaseTreeNode) => void;
  onDelete: (path: string) => void;
  onRename: (path: string, currentName: string) => void;
  onCreate: (parentPath: string) => void;
  onVectorize?: (path: string) => void;
}

function TreePanel({
  label,
  subtitle,
  structure,
  accent,
  expanded,
  onToggle,
  onSelect,
  selectedId,
  hoveredId,
  onHover,
  searchTerm,
  matchIds,
  highlightAncestors,
  onPreview,
  onDelete,
  onRename,
  onCreate,
  onVectorize,
}: TreePanelProps) {
  const stats = aggregateStats(structure);
  const a = ACCENTS[accent];
  const rootNode = structure as unknown as DatabaseTreeNode;

  const tablesCount = rootNode.children?.length ?? 0;
  const columnsCount = stats.documents;

  return (
    <Card
      className={cn(
        "relative isolate h-full overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-sm",
        "before:absolute before:inset-0 before:rounded-2xl before:border before:border-transparent",
        accent === "schema"
          ? "before:from-cyan-500/6 before:via-transparent before:to-transparent"
          : "before:from-emerald-500/6 before:via-transparent before:to-transparent",
        "shadow-3d-sm transition-shadow duration-300",
        selectedId ? "shadow-3d-lg" : "",
      )}
    >
      <div className="relative border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: a.bg }}
            >
              <Database className="h-4 w-4" style={{ color: a.color }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{label}</h3>
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge
              variant="secondary"
              className="text-xs"
              style={{
                background: a.bg,
                color: a.color,
                borderColor: `${a.color}40`,
              }}
            >
              {tablesCount} éléments
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 rounded-lg p-0"
              onClick={() => onCreate(rootNode.path)}
              title="Ajouter"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{columnsCount}</span>{" "}
            fichiers
          </span>
          <span>
            <span className="font-medium text-foreground">{stats.vectors}</span>{" "}
            vecteurs
          </span>
          <span>
            <span className="font-medium text-foreground">{stats.chunks}</span>{" "}
            chunks
          </span>
        </div>
      </div>

      <div className="relative h-[360px] overflow-y-auto">
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px"
          style={{
            left: 4,
            background: `linear-gradient(to bottom, ${a.color}35, ${a.color}05, transparent)`,
          }}
        />
        <ul className="holo-tree">
          <TreeNode
            node={rootNode}
            depth={0}
            isLast={true}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onHover={onHover}
            searchTerm={searchTerm}
            matchIds={matchIds}
            highlightAncestors={highlightAncestors}
            showDiff={false}
            onPreview={onPreview}
            onDelete={onDelete}
            onRename={onRename}
            onCreate={onCreate}
            onVectorize={onVectorize}
          />
        </ul>
      </div>
    </Card>
  );
}

interface DbStatsRibbonProps {
  tablesCount: number;
  columnsCount: number;
  totalVectors: number;
  totalChunks: number;
}

function DbStatsRibbon({
  tablesCount,
  columnsCount,
  totalVectors,
  totalChunks,
}: DbStatsRibbonProps) {
  const counters: {
    label: string;
    value: number;
    Icon: ComponentType<{ className?: string }>;
    color: string;
  }[] = [
    {
      label: "Éléments",
      value: tablesCount,
      Icon: Database,
      color: "hsl(210 90% 65%)",
    },
    {
      label: "Fichiers",
      value: columnsCount,
      Icon: Layers,
      color: "hsl(250 80% 65%)",
    },
    {
      label: "Vecteurs",
      value: totalVectors,
      Icon: BarChart3,
      color: "hsl(150 80% 50%)",
    },
    {
      label: "Chunks",
      value: totalChunks,
      Icon: Layers,
      color: "hsl(270 80% 70%)",
    },
  ];

  return (
    <div className="relative mb-1 grid gap-3 sm:grid-cols-4">
      {counters.map((c) => {
        const Icon = c.Icon;
        return (
          <Card
            key={c.label}
            className="dashboard-card group/stat relative isolate overflow-hidden p-3"
          >
            <div className="absolute -inset-20 -z-10 rounded-full bg-primary/5 opacity-0 blur-2xl transition-opacity group-hover/stat:opacity-100" />
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-muted-foreground"
                style={{ color: c.color }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">
                  {c.value.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function SelectedDetail({
  node,
  className,
}: {
  node: DatabaseTreeNode;
  className?: string;
}) {
  const size = node.stats?.sizeBytes ?? 0;
  const sizeLabel =
    size >= 1024 ? `${(size / 1024).toFixed(1)} Ko` : `${size} o`;
  return (
    <Card className={cn("dashboard-card p-3 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-medium text-foreground">
          Sélection : {node.name}
        </span>
        {node.libelle && (
          <span className="text-muted-foreground/80">— {node.libelle}</span>
        )}
        {node.kind === "document" && node.stats && (
          <>
            <span className="text-muted-foreground">≈ {sizeLabel}</span>
          </>
        )}
        {node.indexed && node.vectorized && (
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            indexé &amp; vectorisé
          </span>
        )}
        {!node.indexed && node.kind === "document" && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
            non indexé
          </span>
        )}
      </div>
    </Card>
  );
}

function SyncSpine({
  syncSummary,
  vectorizationState,
}: {
  syncSummary: Record<SyncState, number>;
  vectorizationState: "complete" | "pending" | "in-progress";
}) {
  const synced = syncSummary.synced;

  const vectorizationConfig = {
    complete: {
      label: "Vectorisation complète",
      color: "bg-emerald-400",
      shadow: "shadow-[0_0_8px_rgba(74,222,128,.7)]",
      anim: "animate-pulse",
      gradient: "from-emerald-400/30 via-emerald-500/35 to-emerald-400/30",
    },
    pending: {
      label: "En attente",
      color: "bg-amber-400",
      shadow: "shadow-[0_0_8px_rgba(251,191,36,.7)]",
      anim: "animate-bounce",
      gradient: "from-amber-400/30 via-amber-500/35 to-amber-400/30",
    },
    "in-progress": {
      label: "En cours",
      color: "bg-cyan-300",
      shadow: "shadow-[0_0_8px_rgba(34,203,255,.7)]",
      anim: "animate-pulse",
      gradient: "from-cyan-400/30 via-primary/35 to-amber-400/30",
    },
  }[vectorizationState];

  return (
    <div className="relative col-span-1 col-start-2 flex flex-col items-center justify-between py-6">
      <div className="absolute inset-0 -z-10 flex justify-center">
        <div className="relative h-full w-px">
          <div
            className={`absolute inset-0 bg-gradient-to-b ${vectorizationConfig.gradient}`}
          />
          <span
            className={`absolute top-0 left-1/2 -translate-x-1/2 block h-2.5 w-2.5 rounded-full ${vectorizationConfig.color} ${vectorizationConfig.shadow}`}
            style={{ animation: "spine-travel 4.2s linear infinite" }}
          />
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2">
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card/70 shadow-3d-sm">
          <span
            className={cn(
              "block h-2.5 w-2.5 rounded-full",
              vectorizationConfig.color,
              vectorizationConfig.shadow,
              vectorizationConfig.anim,
            )}
          />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {vectorizationConfig.label}
        </span>
        <span className="text-[10px] text-muted-foreground/70">
          {synced} nœuds connectés
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-1.5">
        <GitMerge className="h-5 w-5 text-muted-foreground/50" />
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">
          Flux RAG
        </span>
      </div>
    </div>
  );
}
