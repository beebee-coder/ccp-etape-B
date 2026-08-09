"use client";

/**
 * HolographicDatabaseExplorer
 *
 * Affiche fidèlement l'arborescence physique de .locale-db et .registry.
 *
 * Stratégie de chargement & CRUD selon le contexte :
 *  - Mode dev / Tauri  → API /api/structure/fs (lit les vrais répertoires disque)
 *  - Mode navigateur + OPFS → OPFS directement (pas de serveur), uniquement .locale-db
 *  - Mode Vercel sans OPFS  → API /api/structure/fs (retourne reconstitué depuis DB)
 *
 * CRUD :
 *  - opfsInUse = true  → opfsStorage.create/delete/rename/write (100% client)
 *  - opfsInUse = false → fetch /api/structure/fs (serveur)
 */

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
  RefreshCw,
  HardDrive,
  Globe,
  Server,
  FolderOpen,
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
import type { OpfsTreeNode } from "@/lib/browser-db/opfs-storage";

// ─── Constantes ──────────────────────────────────────────────────────────────

const ACCENTS = {
  schema: {
    color: "hsl(210 90% 60%)",
    bg: "hsl(210 90% 64% / 0.12)",
  },
  registry: {
    color: "hsl(270 80% 65%)",
    bg: "hsl(270 80% 65% / 0.12)",
  },
  indexed: {
    color: "hsl(150 80% 50%)",
    bg: "hsl(150 80% 64% / 0.12)",
  },
};

type DataSource = "disk" | "opfs" | "db-reconstructed" | "empty";

// ─── Types API ────────────────────────────────────────────────────────────────

interface ApiTreeNode {
  name: string;
  path: string;
  kind: string;
  children?: ApiTreeNode[];
  stats?: { sizeBytes: number };
  vectorized?: boolean;
  libelle?: string;
}

// ─── Helpers de conversion ────────────────────────────────────────────────────

function convertApiNodes(
  children: ApiTreeNode[],
  vectorizedPaths?: Set<string>,
): DatabaseTreeNode[] {
  return children.map((child) => {
    const isVec = child.kind !== "directory" && (child.vectorized ?? vectorizedPaths?.has(child.path) ?? false);
    return {
      id: child.path,
      name: child.name,
      kind: child.kind as DatabaseTreeNode["kind"],
      path: child.path,
      indexed: isVec,
      vectorized: isVec,
      children: child.children ? convertApiNodes(child.children, vectorizedPaths) : undefined,
      stats: child.stats ? { chunks: 1, vectors: isVec ? 1 : 0, sizeBytes: child.stats.sizeBytes } : undefined,
      ...(child.libelle ? { libelle: child.libelle } : {}),
    };
  });
}

function convertOpfsNodes(
  nodes: OpfsTreeNode[],
  vectorizedPaths: Set<string>,
): DatabaseTreeNode[] {
  return nodes.map((node) => {
    const isVec = node.kind !== "directory" && vectorizedPaths.has(node.path);
    const fullPath = `.locale-db/${node.path}`;
    return {
      id: fullPath,
      name: node.name,
      kind: node.kind as DatabaseTreeNode["kind"],
      path: fullPath,
      indexed: isVec,
      vectorized: isVec,
      children: node.children ? convertOpfsNodes(node.children, vectorizedPaths) : undefined,
      stats: node.stats ? { chunks: 1, vectors: isVec ? 1 : 0, sizeBytes: node.stats.sizeBytes } : undefined,
    };
  });
}

// ─── Composant principal ──────────────────────────────────────────────────────

type ModalMode = "create" | "rename" | null;
type ActiveRoot = "locale-db" | "registry";

export function HolographicDatabaseExplorer() {
  // Arborescences
  const [localeDbStructure, setLocaleDbStructure] = useState<DatabaseStructure | null>(null);
  const [registryStructure, setRegistryStructure]  = useState<DatabaseStructure | null>(null);

  const [loading, setLoading]         = useState(true);
  const [dataSource, setDataSource]   = useState<DataSource>("empty");
  const [opfsInUse, setOpfsInUse]     = useState(false);
  const [vectorizedFiles, setVectorizedFiles] = useState<Set<string>>(() => new Set());

  // UI state
  const [preview, setPreview] = useState<{
    path: string; content: string; name: string; isImage?: boolean; root: ActiveRoot;
  } | null>(null);
  const [modal, setModal] = useState<{
    mode: ModalMode;
    root: ActiveRoot;
    parentPath?: string;
    targetPath?: string;
    defaultName?: string;
  } | null>(null);
  const [modalName, setModalName]   = useState("");
  const [modalKind, setModalKind]   = useState<"file" | "directory">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expanded, setExpanded]     = useState<Set<string>>(() => new Set([".locale-db", ".registry"]));
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadedChildren, setLoadedChildren] = useState<Set<string>>(() => new Set());
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(() => new Set());

  // ─── Chargement ──────────────────────────────────────────────────────────

  const loadBothFromApi = useCallback(async () => {
    const res  = await fetch(`/api/structure/fs?unified=true&t=${Date.now()}`);
    const data = await res.json() as {
      localeDb?: ApiTreeNode;
      registry?: ApiTreeNode;
      vectorizedPaths?: string[];
      source?: string;
    };

    const vecPaths = new Set<string>(data.vectorizedPaths ?? []);
    const src: DataSource = (data.source as DataSource) ?? "disk";
    setDataSource(src);
    setVectorizedFiles(vecPaths);
    setOpfsInUse(false);

    if (data.localeDb) {
      setLocaleDbStructure({
        id: ".locale-db",
        name: src === "disk" ? ".locale-db" : ".locale-db (reconstitué)",
        kind: "database",
        path: ".locale-db",
        indexed: false,
        vectorized: false,
        children: convertApiNodes(data.localeDb.children ?? [], vecPaths),
      });
    }

    if (data.registry) {
      setRegistryStructure({
        id: ".registry",
        name: ".registry",
        kind: "database",
        path: ".registry",
        indexed: false,
        vectorized: false,
        children: convertApiNodes(data.registry.children ?? []),
      });
    }
  }, []);

  const loadRegistryFromApi = useCallback(async () => {
    try {
      const res  = await fetch(`/api/structure/fs?root=registry&t=${Date.now()}`);
      const data = await res.json() as { children?: ApiTreeNode[] };
      setRegistryStructure({
        id: ".registry",
        name: ".registry",
        kind: "database",
        path: ".registry",
        indexed: false,
        vectorized: false,
        children: convertApiNodes(data.children ?? []),
      });
    } catch (e) {
      console.warn("[HolographicDatabaseExplorer] loadRegistryFromApi error", e);
    }
  }, []);

  const loadStructure = useCallback(async () => {
    setLoading(true);
    try {
      const isBrowser = typeof window !== "undefined";
      const isTauri   = isBrowser && "__TAURI__" in window;

      // ── Straterie de chargement :
      //   1. Essayer d'abord l'API serveur (source de vérité après déploiement)
      //   2. Si l'API échoue ou ne retourne rien, fallback OPFS
      //   3. En dev / Tauri, l'API est toujours prioritaire
      // ────────────────────────────────────────────────────────────────────────
      let apiSucceeded = false;
      if (isBrowser) {
        try {
          const res = await fetch(`/api/structure/fs?unified=true&t=${Date.now()}`);
          if (res.ok) {
            const data = await res.json() as {
              localeDb?: ApiTreeNode;
              registry?: ApiTreeNode;
              vectorizedPaths?: string[];
              source?: string;
            };
            const vecPaths = new Set<string>(data.vectorizedPaths ?? []);
            const src: DataSource = (data.source as DataSource) ?? "disk";
            setDataSource(src);
            setVectorizedFiles(vecPaths);
            setOpfsInUse(false);

            if (data.localeDb && (data.localeDb.children?.length ?? 0) > 0) {
              setLocaleDbStructure({
                id: ".locale-db",
                name: src === "disk" ? ".locale-db" : ".locale-db (reconstitué)",
                kind: "database",
                path: ".locale-db",
                indexed: false,
                vectorized: false,
                children: convertApiNodes(data.localeDb.children ?? [], vecPaths),
              });
              apiSucceeded = true;
            }

            if (data.registry && (data.registry.children?.length ?? 0) > 0) {
              setRegistryStructure({
                id: ".registry",
                name: ".registry",
                kind: "database",
                path: ".registry",
                indexed: false,
                vectorized: false,
                children: convertApiNodes(data.registry.children ?? []),
              });
              apiSucceeded = true;
            }
          }
        } catch {
          // API indisponible, on tentera OPFS ci-dessous
        }
      } else {
        await loadBothFromApi();
        return;
      }

      // ── Fallback OPFS seulement si l'API n'a rien retourné ────────────────
      if (!apiSucceeded && isBrowser && !isTauri) {
        const { opfsStorage } = await import("@/lib/browser-db/opfs-storage");
        if (opfsStorage.isSupported()) {
          const [opfsNodes, vecPaths] = await Promise.all([
            opfsStorage.getTree(),
            opfsStorage.getVectorizedPaths(),
          ]);

          const hasData = opfsNodes.some((n) => n.name === "Centrale" || n.name === "Groupes" || n.kind === "document");

          if (hasData) {
            const children = convertOpfsNodes(opfsNodes, vecPaths);
            setLocaleDbStructure({
              id: ".locale-db",
              name: ".locale-db (OPFS — Navigateur)",
              kind: "database",
              path: ".locale-db",
              indexed: false,
              vectorized: false,
              children,
            });
            setVectorizedFiles(vecPaths);
            setOpfsInUse(true);
            setDataSource("opfs");
            setLoading(false);
            return;
          }
        }
      }

      // Si l'API a retourné des données partielles, on tente de charger registry via API
      if (apiSucceeded) {
        await loadRegistryFromApi();
        // Invalider le cache OPFS pour éviter qu'une structure obsolète
        // ne soit réutilisée lors des prochains chargements.
        try {
          const { opfsStorage } = await import("@/lib/browser-db/opfs-storage");
          if (opfsStorage.isSupported()) {
            await opfsStorage.clear();
          }
        } catch {
          // ignore OPFS clear errors
        }
      } else {
        await loadRegistryFromApi();
      }
    } catch (e) {
      console.error("[HolographicDatabaseExplorer] loadStructure error", e);
      toast.error("Erreur lors du chargement des répertoires");
    } finally {
      setLoading(false);
    }
  }, [loadBothFromApi, loadRegistryFromApi]);

  useEffect(() => { loadStructure(); }, [loadStructure]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => loadStructure();
    window.addEventListener("local-db-synced", handler);
    return () => window.removeEventListener("local-db-synced", handler);
  }, [loadStructure]);

  // ─── CRUD — Delete ────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (nodePath: string, root: ActiveRoot) => {
    if (!confirm("Supprimer ce fichier/dossier ?")) return;
    try {
      if (opfsInUse && root === "locale-db") {
        const { opfsStorage } = await import("@/lib/browser-db/opfs-storage");
        // nodePath est préfixé ".locale-db/" en mode OPFS — on l'enlève
        const relPath = nodePath.replace(/^\.locale-db\/?/, "");
        await opfsStorage.deleteEntry(relPath);
        toast.success("Élément supprimé (OPFS)");
      } else {
        const res = await fetch(
          `/api/structure/fs?root=${root}&path=${encodeURIComponent(nodePath)}&t=${Date.now()}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erreur suppression" }));
          throw new Error((err as { error: string }).error);
        }
        toast.success("Élément supprimé");
      }
      if (selectedId === nodePath) setSelectedId(null);
      await loadStructure();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la suppression");
    }
  }, [opfsInUse, selectedId, loadStructure]);

  // ─── CRUD — Create ────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!modal?.parentPath) return;
    try {
      const root = modal.root;

      if (opfsInUse && root === "locale-db") {
        const { opfsStorage } = await import("@/lib/browser-db/opfs-storage");
        const relParent = modal.parentPath.replace(/^\.locale-db\/?/, "");

        if (modalKind === "file") {
          if (!selectedFile) { toast.error("Veuillez sélectionner un fichier"); return; }
          const text = selectedFile.type.startsWith("image/")
            ? ""
            : await selectedFile.text();
          const relPath = relParent ? `${relParent}/${selectedFile.name}` : selectedFile.name;
          await opfsStorage.createFile(relPath, text);
          toast.success("Fichier créé (OPFS)");
        } else {
          if (!modalName.trim()) { toast.error("Veuillez saisir un nom de dossier"); return; }
          const relPath = relParent ? `${relParent}/${modalName.trim()}` : modalName.trim();
          await opfsStorage.createDirectory(relPath);
          toast.success("Dossier créé (OPFS)");
        }
      } else {
        if (modalKind === "file") {
          if (!selectedFile) { toast.error("Veuillez sélectionner un fichier"); return; }
          const formData = new FormData();
          formData.append("file", selectedFile);
          formData.append("path", modal.parentPath);
          formData.append("root", root);
          const res = await fetch(`/api/structure/fs?root=${root}&t=${Date.now()}`, {
            method: "POST", body: formData,
          });
          if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Erreur upload");
          toast.success("Fichier uploadé");
        } else {
          if (!modalName.trim()) { toast.error("Veuillez saisir un nom de dossier"); return; }
          const res = await fetch(`/api/structure/fs?root=${root}&t=${Date.now()}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ root, path: modal.parentPath, name: modalName.trim(), kind: "directory" }),
          });
          if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Erreur création");
          toast.success("Dossier créé");
        }
      }
      setModal(null);
      setModalName("");
      setSelectedFile(null);
      await loadStructure();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la création");
    }
  }, [modal, opfsInUse, modalKind, modalName, selectedFile, loadStructure]);

  // ─── CRUD — Rename ────────────────────────────────────────────────────────

  const handleRename = useCallback(async () => {
    if (!modal?.targetPath || !modalName.trim()) return;
    try {
      const root = modal.root;

      if (opfsInUse && root === "locale-db") {
        const { opfsStorage } = await import("@/lib/browser-db/opfs-storage");
        const relPath = modal.targetPath.replace(/^\.locale-db\/?/, "");
        await opfsStorage.renameEntry(relPath, modalName.trim());
        toast.success("Renommé (OPFS)");
      } else {
        const res = await fetch(`/api/structure/fs?t=${Date.now()}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ root, path: modal.targetPath, newName: modalName.trim() }),
        });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Erreur renommage");
        toast.success("Élément renommé");
      }
      setModal(null);
      setModalName("");
      await loadStructure();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors du renommage");
    }
  }, [modal, opfsInUse, modalName, loadStructure]);

  // ─── CRUD — Preview ───────────────────────────────────────────────────────

  const handlePreview = useCallback(async (node: DatabaseTreeNode, root: ActiveRoot) => {
    if (node.kind !== "document") return;
    try {
      if (opfsInUse && root === "locale-db") {
        const { opfsStorage } = await import("@/lib/browser-db/opfs-storage");
        const relPath = node.path.replace(/^\.locale-db\/?/, "");
        const { content, isImage } = await opfsStorage.readFile(relPath);
        setPreview({ path: node.path, content, name: node.name, isImage, root });
      } else {
        const res = await fetch(
          `/api/structure/fs?root=${root}&path=${encodeURIComponent(node.path)}&read=true&t=${Date.now()}`,
        );
        if (!res.ok) throw new Error();
        const data = await res.json() as { content: string; isImage?: boolean };
        setPreview({ path: node.path, content: data.content, name: node.name, isImage: data.isImage, root });
      }
    } catch {
      setPreview({ path: node.path, content: "[Impossible de lire le fichier]", name: node.name, root: root });
    }
  }, [opfsInUse]);

  // ─── Vectorisation ────────────────────────────────────────────────────────

  const handleVectorize = useCallback(async (nodePath: string) => {
    try {
      const res = await fetch(`/api/structure/fs?t=${Date.now()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: "locale-db", path: nodePath, action: "vectorize" }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Erreur vectorisation");
      setVectorizedFiles((prev) => { const n = new Set(prev); n.add(nodePath); return n; });
      toast.success("Fichier vectorisé avec succès");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la vectorisation");
    }
  }, []);

  const handleVectorizeAll = useCallback(async () => {
    if (!localeDbStructure) return;
    const allFiles: string[] = [];
    const walk = (node: DatabaseTreeNode) => {
      if (node.kind === "document" && !vectorizedFiles.has(node.path)) allFiles.push(node.path);
      node.children?.forEach(walk);
    };
    walk(localeDbStructure);
    if (allFiles.length === 0) { toast.info("Aucun fichier à vectoriser"); return; }
    let count = 0;
    for (const filePath of allFiles) {
      try {
        const res = await fetch(`/api/structure/fs?t=${Date.now()}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ root: "locale-db", path: filePath, action: "vectorize" }),
        });
        if (res.ok) {
          count++;
          setVectorizedFiles((prev) => { const n = new Set(prev); n.add(filePath); return n; });
        }
      } catch { /* continue */ }
    }
    toast.success(`${count} fichier(s) vectorisé(s)`);
  }, [localeDbStructure, vectorizedFiles]);

  const syncOpfsFromServer = useCallback(async () => {
    try {
      setLoading(true);
      const { opfsStorage } = await import("@/lib/browser-db/opfs-storage");
      if (!opfsStorage.isSupported()) {
        toast.error("OPFS non supporté par ce navigateur");
        return;
      }

      toast.info("Téléchargement de l'archive .locale-db...");
      const res = await fetch("/api/local-db/download-archive");
      if (!res.ok) throw new Error("Impossible de télécharger l'archive");
      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();

      toast.info("Extraction vers OPFS...");
      await opfsStorage.clear();
      const result = await opfsStorage.extractZipToOpfs(arrayBuffer);

      toast.success(`OPFS synchronisé : ${result.filesExtracted} fichiers extraits`);
      await loadStructure();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la synchronisation OPFS");
    } finally {
      setLoading(false);
    }
  }, [loadStructure]);

  // ─── Helpers UI ───────────────────────────────────────────────────────────

  const toggleNode = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const onSelect = (node: DatabaseTreeNode) => {
    setSelectedId(node.id);
    if (node.children && node.children.length > 0) toggleNode(node.id);
  };

  const findNodeById = (tree: DatabaseStructure | null, id: string): DatabaseTreeNode | null => {
    if (!tree) return null;
    const walk = (node: DatabaseTreeNode): DatabaseTreeNode | null => {
      if (node.id === id) return node;
      if (!node.children) return null;
      for (const child of node.children) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(tree);
  };

  const insertChildrenIntoTree = (
    tree: DatabaseStructure | null,
    parentId: string,
    newChildren: DatabaseTreeNode[],
  ): DatabaseStructure | null => {
    if (!tree) return tree;
    const updateNode = (node: DatabaseTreeNode): DatabaseTreeNode => {
      if (node.id === parentId) {
        return { ...node, children: newChildren };
      }
      if (!node.children) return node;
      return { ...node, children: node.children.map(updateNode) };
    };
    return updateNode(tree) as DatabaseStructure;
  };

  const loadChildrenForNode = useCallback(async (nodeId: string, root: ActiveRoot) => {
    if (loadedChildren.has(nodeId)) return;
    setLoadingNodes((prev) => { const n = new Set(prev); n.add(nodeId); return n; });
    try {
      const res = await fetch(`/api/structure/fs?root=${root}&path=${encodeURIComponent(nodeId)}&t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json() as { children?: ApiTreeNode[] };
      if (!data.children) return;
      const newChildren = convertApiNodes(data.children);
      setLoadedChildren((prev) => { const n = new Set(prev); n.add(nodeId); return n; });
      if (root === "locale-db") {
        setLocaleDbStructure((prev) => insertChildrenIntoTree(prev, nodeId, newChildren));
      } else {
        setRegistryStructure((prev) => insertChildrenIntoTree(prev, nodeId, newChildren));
      }
    } catch {
      // ignore
    } finally {
      setLoadingNodes((prev) => { const n = new Set(prev); n.delete(nodeId); return n; });
    }
  }, [loadedChildren]);

  useEffect(() => {
    const loadMissingChildren = async () => {
      for (const nodeId of Array.from(expanded)) {
        if (nodeId === ".locale-db" || nodeId === ".registry") continue;
        const structure = nodeId.startsWith(".registry") ? registryStructure : localeDbStructure;
        if (!structure) continue;
        const node = findNodeById(structure, nodeId);
        if (node && (!node.children || node.children.length === 0)) {
          const root = nodeId.startsWith(".registry") ? "registry" : "locale-db";
          await loadChildrenForNode(nodeId, root);
        }
      }
    };
    loadMissingChildren();
  }, [expanded, localeDbStructure, registryStructure, loadChildrenForNode]);

  // ─── Stats & indices vectorisation ───────────────────────────────────────

  const indexedLocaleDb = useMemo<DatabaseStructure>(() => {
    if (!localeDbStructure) return { id: ".locale-db-idx", name: ".locale-db", kind: "database", path: ".locale-db-idx", indexed: false, vectorized: false, children: [] };
    const clone = JSON.parse(JSON.stringify(localeDbStructure)) as DatabaseStructure;
    const filter = (node: DatabaseTreeNode): DatabaseTreeNode => {
      if (node.kind === "document") {
        const isVec = vectorizedFiles.has(node.path);
        return { ...node, indexed: isVec, vectorized: isVec, stats: isVec ? { vectors: 1, chunks: 1, dimension: 384, sizeBytes: 1024 } : undefined };
      }
      if (node.children) {
        const children = node.children.map(filter);
        const hasVec = children.some((c) => c.kind === "document" && c.vectorized);
        return { ...node, indexed: hasVec, vectorized: hasVec, children };
      }
      return node;
    };
    const filtered = filter(clone);
    return { ...filtered, kind: "database", id: ".locale-db-idx", path: ".locale-db-idx" } as DatabaseStructure;
  }, [localeDbStructure, vectorizedFiles]);

  const vectorizationState = useMemo<"complete" | "pending" | "in-progress">(() => {
    if (!localeDbStructure) return "pending";
    const all: string[] = [];
    const walk = (n: DatabaseTreeNode) => { if (n.kind === "document") all.push(n.path); n.children?.forEach(walk); };
    walk(localeDbStructure);
    if (all.length === 0 || vectorizedFiles.size === 0) return "pending";
    if (vectorizedFiles.size >= all.length) return "complete";
    return "in-progress";
  }, [localeDbStructure, vectorizedFiles]);

  const allNodes = useMemo(() => {
    const nodes: DatabaseTreeNode[] = [];
    const walk = (n: DatabaseTreeNode) => { nodes.push(n); n.children?.forEach(walk); };
    if (localeDbStructure) walk(localeDbStructure);
    if (registryStructure)  walk(registryStructure);
    return nodes;
  }, [localeDbStructure, registryStructure]);

  const matchIds = useMemo<string[]>(() => {
    if (!searchTerm) return [];
    const set = new Set<string>();
    if (localeDbStructure) findMatches(localeDbStructure, searchTerm).forEach((id) => set.add(id));
    if (registryStructure)  findMatches(registryStructure,  searchTerm).forEach((id) => set.add(id));
    return Array.from(set);
  }, [localeDbStructure, registryStructure, searchTerm]);

  const highlightAncestors = useMemo<string[]>(() => {
    if (!searchTerm) return [];
    const set = new Set<string>();
    if (localeDbStructure) matchingAncestors(localeDbStructure, searchTerm).forEach((id) => set.add(id));
    if (registryStructure)  matchingAncestors(registryStructure,  searchTerm).forEach((id) => set.add(id));
    return Array.from(set);
  }, [localeDbStructure, registryStructure, searchTerm]);

  const selected = allNodes.find((n) => n.id === selectedId) ?? null;
  const localeDbStats  = useMemo(() => localeDbStructure  ? aggregateStats(localeDbStructure)  : { documents: 0, vectors: 0, chunks: 0, collections: 0, dimension: 0 }, [localeDbStructure]);
  const registryStats  = useMemo(() => registryStructure  ? aggregateStats(registryStructure)  : { documents: 0, vectors: 0, chunks: 0, collections: 0, dimension: 0 }, [registryStructure]);
  const indexedStats   = useMemo(() => aggregateStats(indexedLocaleDb), [indexedLocaleDb]);

  // ─── Badge de source ──────────────────────────────────────────────────────

  const sourceBadge = useMemo(() => {
    switch (dataSource) {
      case "disk":           return { icon: HardDrive, label: "Disque (dev)", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" };
      case "opfs":           return { icon: Globe,     label: "OPFS (navigateur)", color: "text-violet-400 border-violet-500/30 bg-violet-500/10" };
      case "db-reconstructed": return { icon: Server,  label: "Reconstitué (Vercel)", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" };
      default:               return { icon: FolderOpen, label: "Vide", color: "text-muted-foreground border-border/30 bg-muted/10" };
    }
  }, [dataSource]);

  const SourceIcon = sourceBadge.icon;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="relative isolate">
      {/* Fond décoratif */}
      <div className="pointer-events-none absolute -inset-4">
        <div className="absolute inset-0 bg-gradient-mesh opacity-[0.11]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      {/* Barre d'outils */}
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
            variant="outline" size="sm"
            onClick={loadStructure}
            className="h-8 rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Rafraîchir
          </Button>

          {!opfsInUse && (
            <Button
              variant="outline" size="sm"
              onClick={loadBothFromApi}
              className="h-8 rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Recharger depuis le serveur
            </Button>
          )}

          <Button
            variant="outline" size="sm"
            onClick={syncOpfsFromServer}
            className="h-8 rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary"
          >
            <HardDrive className="h-4 w-4 mr-2" />
            Synchroniser OPFS
          </Button>

          <Button
            variant="default" size="sm"
            onClick={handleVectorizeAll}
            className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Vectoriser tout
          </Button>
        </div>

        {/* Badge source */}
        <Badge
          variant="outline"
          className={cn("flex items-center gap-1.5 px-3 py-1 text-xs font-medium", sourceBadge.color)}
        >
          <SourceIcon className="h-3.5 w-3.5" />
          {sourceBadge.label}
        </Badge>
      </div>

      {/* Alerte OPFS */}
      {opfsInUse && !loading && (
        <Card className="dashboard-card mb-4 border-violet-500/30 bg-violet-500/5 p-4">
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-violet-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Stockage OPFS — Navigateur local</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Les données sont stockées dans ce navigateur. Les modifications sont <strong>uniquement locales</strong>.
                Exportez régulièrement vos données pour éviter toute perte en cas de nettoyage du navigateur.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Chargement */}
      {loading && (
        <Card className="dashboard-card flex h-24 items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <span>Chargement des répertoires physiques…</span>
          </div>
        </Card>
      )}

      {!loading && (localeDbStructure ?? registryStructure) && (
        <>
          {/* Stats ribbon */}
          <DbStatsRibbon
            localeDbFiles={localeDbStats.documents}
            registryFiles={registryStats.documents}
            totalVectors={indexedStats.vectors}
            totalChunks={indexedStats.chunks}
          />

          {/* Détail sélection */}
          {selected && <SelectedDetail node={selected} className="mt-4" />}

          {/* Prévisualisation */}
          {preview && (
            <Card className="dashboard-card mt-4 overflow-hidden">
              <div className="border-b border-border/50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{preview.name}</h3>
                  <span className="text-xs text-muted-foreground font-mono">{preview.path}</span>
                  <Badge variant="outline" className="text-[10px]">{preview.root}</Badge>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 rounded-lg p-0" onClick={() => setPreview(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {preview.isImage ? (
                <div className="flex items-center justify-center bg-muted/20 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.content} alt={preview.name} className="max-h-80 max-w-full rounded-lg object-contain" />
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto bg-muted/20 p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground/80">{preview.content}</pre>
                </div>
              )}
            </Card>
          )}

          {/* Grille 3 panneaux */}
          <div className="relative isolate mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1fr_8rem_1fr]">
            {/* Panneau gauche — .locale-db */}
            {localeDbStructure && (
              <TreePanel
                label=".locale-db"
                subtitle={opfsInUse ? "Stockage OPFS navigateur" : "Répertoire physique disque"}
                structure={localeDbStructure}
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
                onPreview={(node) => handlePreview(node, "locale-db")}
                onDelete={(p) => handleDelete(p, "locale-db")}
                onRename={(p, name) => {
                  setModal({ mode: "rename", root: "locale-db", targetPath: p, defaultName: name });
                  setModalName(name);
                }}
                onCreate={(p) => {
                  setModal({ mode: "create", root: "locale-db", parentPath: p });
                  setModalName("");
                  setModalKind("file");
                  setSelectedFile(null);
                }}
                onVectorize={handleVectorize}
                loadingNodes={loadingNodes}
              />
            )}

            {/* Colonne centrale — Spine */}
            <SyncSpine
              syncSummary={{
                synced: indexedStats.vectors,
                pending: 0,
                conflict: 0,
                "local-only": localeDbStats.documents - indexedStats.vectors,
              }}
              vectorizationState={vectorizationState}
            />

            {/* Panneau droit — .registry */}
            {registryStructure && (
              <TreePanel
                label=".registry"
                subtitle="Registre des ressources"
                structure={registryStructure}
                accent="registry"
                expanded={expanded}
                onToggle={toggleNode}
                onSelect={onSelect}
                selectedId={selectedId}
                hoveredId={null}
                onHover={() => {}}
                searchTerm={searchTerm}
                matchIds={matchIds}
                highlightAncestors={highlightAncestors}
                onPreview={(node) => handlePreview(node, "registry")}
                onDelete={(p) => handleDelete(p, "registry")}
                onRename={(p, name) => {
                  setModal({ mode: "rename", root: "registry", targetPath: p, defaultName: name });
                  setModalName(name);
                }}
                onCreate={(p) => {
                  setModal({ mode: "create", root: "registry", parentPath: p });
                  setModalName("");
                  setModalKind("file");
                  setSelectedFile(null);
                }}
              />
            )}
          </div>

          <div className="relative mt-8 text-center text-xs text-muted-foreground/60">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3 w-3" />
              Panneau gauche : arborescence physique <code className="font-mono">.locale-db</code> —
              Panneau droit : arborescence physique <code className="font-mono">.registry</code>
            </span>
          </div>
        </>
      )}

      {/* Modal Créer / Renommer */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">
              {modal.mode === "create" ? "Nouvel élément" : "Renommer"}
              <span className="ml-2 text-xs font-normal text-muted-foreground">({modal.root})</span>
            </h3>
            {modal.mode === "create" && (
              <div className="flex gap-2">
                <Button
                  variant={modalKind === "file" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setModalKind("file"); setSelectedFile(null); }}
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
            {(modal.mode === "rename" || modalKind === "directory") ? (
              <Input
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                placeholder={modal.mode === "rename" ? "Nouveau nom" : "Nom du dossier"}
                className="rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (modal.mode === "rename") {
                      handleRename();
                    } else {
                      handleCreate();
                    }
                  }
                }}
              />
            ) : (
              <div className="space-y-2">
                <Input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setSelectedFile(f); setModalName(f.name); }
                  }}
                  className="rounded-xl"
                />
                {selectedFile && (
                  <p className="text-xs text-muted-foreground">
                    Fichier : {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} Ko)
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setModal(null); setSelectedFile(null); }} className="rounded-xl">
                Annuler
              </Button>
              <Button onClick={modal.mode === "rename" ? handleRename : handleCreate} className="rounded-xl">
                {modal.mode === "create"
                  ? modalKind === "directory" ? "Créer" : "Uploader"
                  : "Renommer"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}

// ─── TreePanel ────────────────────────────────────────────────────────────────

interface TreePanelProps {
  label: string;
  subtitle: string;
  structure: DatabaseStructure;
  accent: "schema" | "indexed" | "registry";
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
  loadingNodes?: Set<string>;
}

function TreePanel({
  label, subtitle, structure, accent, expanded, onToggle, onSelect, selectedId,
  hoveredId, onHover, searchTerm, matchIds, highlightAncestors,
  onPreview, onDelete, onRename, onCreate, onVectorize, loadingNodes,
}: TreePanelProps) {
  const stats   = aggregateStats(structure);
  const a       = ACCENTS[accent];
  const rootNode = structure as unknown as DatabaseTreeNode;

  return (
    <Card className={cn(
      "relative isolate h-full overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-sm",
      "shadow-3d-sm transition-shadow duration-300",
      selectedId ? "shadow-3d-lg" : "",
    )}>
      <div className="relative border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: a.bg }}>
              <Database className="h-4 w-4" style={{ color: a.color }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground font-mono">{label}</h3>
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs" style={{ background: a.bg, color: a.color, borderColor: `${a.color}40` }}>
              {rootNode.children?.length ?? 0} éléments
            </Badge>
            <Button
              variant="ghost" size="sm" className="h-7 w-7 rounded-lg p-0"
              onClick={() => onCreate(rootNode.path)} title="Ajouter"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span><span className="font-medium text-foreground">{stats.documents}</span> fichiers</span>
          {accent !== "registry" && (
            <span><span className="font-medium text-foreground">{stats.vectors}</span> vecteurs</span>
          )}
        </div>
      </div>

      <div className="relative h-[400px] overflow-y-auto">
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px"
          style={{ left: 4, background: `linear-gradient(to bottom, ${a.color}35, ${a.color}05, transparent)` }}
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
            loadingNodes={loadingNodes}
          />
        </ul>
      </div>
    </Card>
  );
}

// ─── DbStatsRibbon ────────────────────────────────────────────────────────────

function DbStatsRibbon({
  localeDbFiles, registryFiles, totalVectors, totalChunks,
}: {
  localeDbFiles: number; registryFiles: number; totalVectors: number; totalChunks: number;
}) {
  const counters: { label: string; value: number; Icon: ComponentType<{ className?: string }>; color: string }[] = [
    { label: ".locale-db fichiers", value: localeDbFiles,  Icon: Database, color: "hsl(210 90% 65%)" },
    { label: ".registry fichiers",  value: registryFiles,  Icon: FolderOpen, color: "hsl(270 80% 65%)" },
    { label: "Vecteurs",            value: totalVectors,   Icon: BarChart3, color: "hsl(150 80% 50%)" },
    { label: "Chunks",              value: totalChunks,    Icon: Layers,   color: "hsl(270 80% 70%)" },
  ];

  return (
    <div className="relative mb-1 grid gap-3 sm:grid-cols-4">
      {counters.map((c) => {
        const Icon = c.Icon;
        return (
          <Card key={c.label} className="dashboard-card group/stat relative isolate overflow-hidden p-3">
            <div className="absolute -inset-20 -z-10 rounded-full bg-primary/5 opacity-0 blur-2xl transition-opacity group-hover/stat:opacity-100" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10" style={{ color: c.color }}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{c.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── SelectedDetail ───────────────────────────────────────────────────────────

function SelectedDetail({ node, className }: { node: DatabaseTreeNode; className?: string }) {
  const size = node.stats?.sizeBytes ?? 0;
  const sizeLabel = size >= 1024 ? `${(size / 1024).toFixed(1)} Ko` : `${size} o`;
  return (
    <Card className={cn("dashboard-card p-3 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-medium text-foreground">Sélection : {node.name}</span>
        {node.libelle && <span className="text-muted-foreground/80">— {node.libelle}</span>}
        {node.kind === "document" && node.stats && <span className="text-muted-foreground">≈ {sizeLabel}</span>}
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

// ─── SyncSpine ────────────────────────────────────────────────────────────────

function SyncSpine({
  syncSummary, vectorizationState,
}: {
  syncSummary: Record<SyncState, number>;
  vectorizationState: "complete" | "pending" | "in-progress";
}) {
  const cfg = {
    complete:    { label: "Vectorisation complète", color: "bg-emerald-400", shadow: "shadow-[0_0_8px_rgba(74,222,128,.7)]", anim: "animate-pulse",  gradient: "from-emerald-400/30 via-emerald-500/35 to-emerald-400/30" },
    pending:     { label: "En attente",             color: "bg-amber-400",   shadow: "shadow-[0_0_8px_rgba(251,191,36,.7)]", anim: "animate-bounce", gradient: "from-amber-400/30 via-amber-500/35 to-amber-400/30" },
    "in-progress": { label: "En cours",             color: "bg-cyan-300",    shadow: "shadow-[0_0_8px_rgba(34,203,255,.7)]", anim: "animate-pulse",  gradient: "from-cyan-400/30 via-primary/35 to-amber-400/30" },
  }[vectorizationState];

  return (
    <div className="relative col-span-1 col-start-2 flex flex-col items-center justify-between py-6">
      <div className="absolute inset-0 -z-10 flex justify-center">
        <div className="relative h-full w-px">
          <div className={`absolute inset-0 bg-gradient-to-b ${cfg.gradient}`} />
          <span
            className={`absolute top-0 left-1/2 -translate-x-1/2 block h-2.5 w-2.5 rounded-full ${cfg.color} ${cfg.shadow}`}
            style={{ animation: "spine-travel 4.2s linear infinite" }}
          />
        </div>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-2">
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card/70 shadow-3d-sm">
          <span className={cn("block h-2.5 w-2.5 rounded-full", cfg.color, cfg.shadow, cfg.anim)} />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{cfg.label}</span>
        <span className="text-[10px] text-muted-foreground/70">{syncSummary.synced} vecteurs</span>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-1.5">
        <GitMerge className="h-5 w-5 text-muted-foreground/50" />
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">Flux RAG</span>
      </div>
    </div>
  );
}
