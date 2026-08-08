"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Search,
  Folder,
  RefreshCw,
  AlertTriangle,
  Plus,
  FileText,
  X,
  Edit3,
  Save,
  Copy,
  Scissors,
  ClipboardPaste,
  Undo,
  GripVertical,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useResize } from "@/hooks/use-resize";
import { toast } from "sonner";
import type { DatabaseStructure, DatabaseTreeNode } from "@/lib/types/structure-bdd";
import { TreeNode } from "./tree-node";

interface RegistryNode {
  name: string;
  path: string;
  kind: string;
  children?: RegistryNode[];
  stats?: { sizeBytes: number };
  libelle?: string;
}

function buildDatabaseTreeNode(node: RegistryNode): DatabaseTreeNode {
  const childNodes: DatabaseTreeNode[] =
    node.children?.map(buildDatabaseTreeNode) ?? [];
  return {
    id: node.path,
    name: node.name,
    kind: node.kind as DatabaseTreeNode["kind"],
    path: node.path,
    indexed: false,
    vectorized: false,
    children: childNodes.length > 0 ? childNodes : undefined,
    stats: node.stats
      ? {
          chunks: 0,
          vectors: 0,
          sizeBytes: node.stats.sizeBytes,
        }
      : undefined,
    libelle: node.libelle,
  };
}

type ModalMode = "create" | "rename" | null;

export function RegistryExplorer() {
  const [structure, setStructure] = useState<DatabaseStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["BDD web"]),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    path: string;
    content: string;
    name: string;
    isImage?: boolean;
  } | null>(null);
  const [editingPreview, setEditingPreview] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [modal, setModal] = useState<{
    mode: ModalMode;
    parentPath?: string;
    targetPath?: string;
    defaultName?: string;
  } | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalKind, setModalKind] = useState<"file" | "directory">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    panelWidth,
    isDragging,
    onDividerMouseDown,
    onDividerKeyDown,
  } = useResize({
    minWidth: 200,
    defaultWidth: 360,
    containerRef,
  });

  const loadStructure = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/registry/fs?t=${Date.now()}`);
      console.info("[RegistryExplorer] API response", {
        status: res.status,
        ok: res.ok,
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("[RegistryExplorer] API error body", errText);
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { children?: RegistryNode[]; source?: string };
      console.info("[RegistryExplorer] API data", {
        source: data.source,
        childrenCount: data.children?.length ?? 0,
        childrenNames: data.children?.map((c) => c.name),
      });
      const nodes = (data.children ?? []).map(buildDatabaseTreeNode);
      setStructure({
        id: "BDD web",
        name: "BDD web",
        kind: "database",
        path: "BDD web",
        indexed: false,
        vectorized: false,
        children: nodes,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      console.error("[RegistryExplorer] loadStructure error", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStructure();
  }, [loadStructure]);

  const matchIds = useMemo<string[]>(() => {
    if (!structure || !searchTerm) return [];
    const ids: string[] = [];
    const walk = (node: DatabaseTreeNode) => {
      if (node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        ids.push(node.id);
      }
      node.children?.forEach(walk);
    };
    walk(structure);
    return ids;
  }, [structure, searchTerm]);

  const highlightAncestors = useMemo<string[]>(() => {
    if (!structure || !searchTerm) return [];
    const ancestors = new Set<string>();
    const findAncestors = (node: DatabaseTreeNode, targetId: string): boolean => {
      if (node.id === targetId) return true;
      const found = node.children?.some((c) => findAncestors(c, targetId)) ?? false;
      if (found) ancestors.add(node.id);
      return found;
    };
    for (const id of matchIds) {
      findAncestors(structure, id);
    }
    return Array.from(ancestors);
  }, [structure, matchIds, searchTerm]);

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

  const handlePreview = async (node: DatabaseTreeNode) => {
    if (node.kind !== "document") return;
    try {
      const res = await fetch(
        `/api/registry/fs?path=${encodeURIComponent(node.path)}&read=true&t=${Date.now()}`,
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

  const handleEdit = () => {
    if (!preview) return;
    setEditContent(preview.content);
    setEditingPreview(true);
  };

  const handleSave = async () => {
    if (!preview) return;
    try {
      const res = await fetch(`/api/registry/fs?t=${Date.now()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: preview.path,
          content: editContent,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur sauvegarde" }));
        throw new Error(err.error || "Erreur sauvegarde");
      }
      setPreview({ ...preview, content: editContent });
      setEditingPreview(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur lors de la sauvegarde";
      setError(message);
    }
  };

  const handleCopy = async () => {
    if (typeof window !== "undefined" && window.navigator.clipboard) {
      await window.navigator.clipboard.writeText(editContent || preview?.content || "");
    }
  };

  const handleCut = async () => {
    const text = editContent || preview?.content || "";
    if (typeof window !== "undefined" && window.navigator.clipboard) {
      await window.navigator.clipboard.writeText(text);
    }
    setEditContent("");
  };

  const handlePaste = async () => {
    if (typeof window !== "undefined" && window.navigator.clipboard) {
      const text = await window.navigator.clipboard.readText();
      setEditContent((prev) => prev + text);
    }
  };

  const handleClearAllContent = useCallback(async () => {
    if (!structure) return;
    if (!confirm("Vider le contenu de tous les fichiers ? Cette action est irréversible.")) return;
    const allFiles: DatabaseTreeNode[] = [];
    const walk = (node: DatabaseTreeNode) => {
      if (node.kind === "document") allFiles.push(node);
      node.children?.forEach(walk);
    };
    walk(structure);
    if (allFiles.length === 0) {
      toast.info("Aucun fichier à vider");
      return;
    }
    try {
      let successCount = 0;
      for (const fileNode of allFiles) {
        const res = await fetch(`/api/registry/fs?t=${Date.now()}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: fileNode.path,
            content: "",
          }),
        });
        if (res.ok) successCount++;
      }
      toast.success(`${successCount} fichier(s) vidé(s)`);
      if (preview && preview.path) {
        const cleared = allFiles.find((f) => f.path === preview.path);
        if (cleared) setPreview({ ...preview, content: "" });
      }
    } catch {
      toast.error("Erreur lors du vidage du contenu");
    }
  }, [structure, preview]);

  const handleSync = useCallback(async () => {
    if (!structure) return;
    try {
      const res = await fetch(`/api/local-db/sync-registry?t=${Date.now()}`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur synchronisation" }));
        throw new Error(err.error || "Erreur synchronisation");
      }

      const data = await res.json();
      const parts: string[] = [];
      if (data.added?.length) parts.push(`${data.added.length} ajouté(s)`);
      if (data.updated?.length) parts.push(`${data.updated.length} mis à jour(s)`);
      if (data.skipped?.length) parts.push(`${data.skipped.length} déjà existant(s)`);
      if (data.failed?.length) parts.push(`${data.failed.length} échoué(s)`);
      toast.success(parts.length > 0 ? parts.join(", ") : "Aucun changement");
      await loadStructure();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur lors de la synchronisation";
      toast.error(message);
    }
  }, [structure, loadStructure]);

  const handleDelete = async (nodePath: string) => {
    if (!confirm("Supprimer ce fichier/dossier ?")) return;
    try {
      const res = await fetch(
        `/api/registry/fs?path=${encodeURIComponent(nodePath)}&t=${Date.now()}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur suppression" }));
        throw new Error(err.error || "Erreur suppression");
      }
      if (selectedId === nodePath) setSelectedId(null);
      await loadStructure();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur lors de la suppression";
      setError(message);
    }
  };

  const handleRename = async () => {
    if (!modal || !modalName.trim() || !modal.targetPath) return;
    try {
      const res = await fetch(`/api/registry/fs?t=${Date.now()}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: modal.targetPath,
          newName: modalName.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur renommage" }));
        throw new Error(err.error || "Erreur renommage");
      }
      setModal(null);
      setModalName("");
      await loadStructure();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur lors du renommage";
      setError(message);
    }
  };

  const handleCreate = async () => {
    if (!modal || !modal.parentPath) return;
    try {
      if (modalKind === "file") {
        if (!selectedFile) {
          setError("Veuillez sélectionner un fichier");
          return;
        }
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("path", modal.parentPath);
        const res = await fetch(`/api/registry/fs?t=${Date.now()}`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erreur upload" }));
          throw new Error(err.error || "Erreur upload");
        }
        setSelectedFile(null);
      } else {
        if (!modalName.trim()) {
          setError("Veuillez saisir un nom de dossier");
          return;
        }
        const res = await fetch(`/api/registry/fs?t=${Date.now()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: modal.parentPath,
            name: modalName.trim(),
            kind: "directory",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erreur création" }));
          throw new Error(err.error || "Erreur création");
        }
      }
      setModal(null);
      setModalName("");
      await loadStructure();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur lors de la création";
      setError(message);
    }
  };

  const closeModal = () => {
    setModal(null);
    setModalName("");
    setSelectedFile(null);
  };

  if (loading) {
    return (
      <Card className="dashboard-card flex h-48 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <span>Chargement de BDD web...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="dashboard-card border-destructive/50 bg-destructive/5 p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-destructive mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-destructive">
              Erreur de chargement du registre
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={loadStructure}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!structure) {
    return null;
  }

  const rootNode = structure as unknown as DatabaseTreeNode;
  const totalFiles = structure.children?.length ?? 0;

  const treePanelWidth = `calc(100% - ${panelWidth}px)`;
  const previewPanelWidth = `${panelWidth}px`;

  return (
    <section className="relative isolate">
      <div className="relative mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un fichier ou dossier..."
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
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleSync}
            className="h-8 rounded-xl bg-primary/80 hover:bg-primary text-primary-foreground"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Synchroniser
          </Button>
        </div>
      </div>

<DbStatsRibbon tablesCount={totalFiles} onClearContent={handleClearAllContent} />

      <div
        className="relative isolate mt-6 flex gap-0 rounded-2xl border bg-card/60 backdrop-blur-sm overflow-hidden"
        ref={containerRef}
      >
        <div
          className="relative overflow-hidden transition-all duration-200 will-change-[width]"
          style={{ width: treePanelWidth }}
        >
          <div className="relative border-b border-border/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Folder className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    BDD web
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Répertoire de registre web
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-xs">
                  {totalFiles} éléments
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 rounded-lg p-0"
                  onClick={() =>
                    setModal({
                      mode: "create",
                      parentPath: "BDD web",
                    })
                  }
                  title="Créer"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="relative h-[400px] overflow-y-auto">
            <div className="pointer-events-none absolute top-0 bottom-0 w-px left-4 bg-gradient-to-b from-primary/20 via-transparent to-transparent" />
            <ul className="holo-tree">
              <TreeNode
                node={rootNode}
                depth={0}
                isLast={true}
                expanded={expanded}
                onToggle={toggleNode}
                onSelect={onSelect}
                selectedId={selectedId}
                hoveredId={null}
                onHover={() => {}}
                searchTerm={searchTerm}
                matchIds={matchIds}
                highlightAncestors={highlightAncestors}
                showDiff={false}
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
            </ul>
          </div>
        </div>

        {/* Resizable divider */}
        <div
          className="relative w-1.5 cursor-col-resize flex-shrink-0 group/divider"
          onMouseDown={onDividerMouseDown}
          onKeyDown={onDividerKeyDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionner le panneau"
          aria-valuenow={panelWidth}
          aria-valuemin={200}
          aria-valuemax={800}
          tabIndex={0}
        >
          <div
            className={cn(
              "absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 rounded-full transition-all duration-200",
              isDragging
                ? "bg-primary shadow-[0_0_12px_rgba(99,102,241,0.6)] scale-y-100"
                : "bg-border/40 group-hover/divider:bg-primary/40 group-hover/divider:scale-y-75",
            )}
          />
          <div
            className={cn(
              "absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center justify-center transition-opacity duration-200",
              isDragging ? "opacity-100" : "opacity-0 group-hover/divider:opacity-100",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-1 items-center justify-center rounded-full border border-border/60 bg-card/80 backdrop-blur-sm shadow-3d-sm",
                isDragging ? "bg-primary/15 border-primary/30" : "",
              )}
            >
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
          {isDragging && (
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 bg-primary/10 blur-xl rounded-full" />
          )}
        </div>

        {/* Preview panel */}
        <div
          className="flex flex-col gap-4 overflow-hidden transition-all duration-200 will-change-[width]"
          style={{ width: previewPanelWidth }}
        >
          {preview && (
            <Card className="dashboard-card overflow-hidden flex flex-col">
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
                <div className="flex items-center gap-1">
                  {!editingPreview ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 rounded-lg p-0"
                        onClick={handleEdit}
                        title="Modifier"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 rounded-lg p-0"
                        onClick={() => setPreview(null)}
                        title="Fermer"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 rounded-lg p-0"
                        onClick={handleCopy}
                        title="Copier"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 rounded-lg p-0"
                        onClick={handleCut}
                        title="Couper"
                      >
                        <Scissors className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 rounded-lg p-0"
                        onClick={handlePaste}
                        title="Coller"
                      >
                        <ClipboardPaste className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 rounded-lg p-0"
                        onClick={() => {
                          setEditContent(preview.content);
                          setEditingPreview(false);
                        }}
                        title="Annuler"
                      >
                        <Undo className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 rounded-lg p-0"
                        onClick={handleSave}
                        title="Sauvegarder"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                {!editingPreview ? (
                  preview?.isImage ? (
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
                  )
                ) : (
                  <textarea
                    className="w-full h-full min-h-[200px] bg-transparent text-xs font-mono whitespace-pre-wrap break-words text-foreground/80 p-4 border-none outline-none resize-none"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    spellCheck={false}
                  />
                )}
              </div>
            </Card>
          )}

          {!preview && (
            <Card className="dashboard-card flex flex-col items-center justify-center p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">
                Aucun fichier sélectionné
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cliquez sur un fichier pour prévisualiser son contenu
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Create/Rename modal */}
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
                onClick={closeModal}
                className="rounded-xl"
              >
                Annuler
              </Button>
              <Button
                onClick={modal.mode === "create" ? handleCreate : handleRename}
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

interface DbStatsRibbonProps {
  tablesCount: number;
  onClearContent?: () => void;
}

function DbStatsRibbon({ tablesCount, onClearContent }: DbStatsRibbonProps) {
  return (
    <div className="relative mb-1 grid gap-3 sm:grid-cols-1">
      <Card className="dashboard-card group/stat relative isolate overflow-hidden p-3">
        <div className="absolute -inset-20 -z-10 rounded-full bg-primary/5 opacity-0 group-hover/stat:opacity-100 transition-opacity" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-muted-foreground">
            <Folder className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">
              {tablesCount.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">éléments dans BDD web</p>
          </div>
          {onClearContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearContent}
              className="ml-auto h-7 rounded-xl border-border/60 bg-card/60 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive text-xs"
            >
              Vider le contenu
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}