"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Database, GitMerge, BarChart3, Layers } from "lucide-react";
import type { ComponentType } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  DatabaseStructure,
  DatabaseTreeNode,
  SyncState,
} from "@/lib/types/structure-bdd";
import {
  buildLocalStructure,
  buildWebStructure,
} from "@/lib/data/structure-bdd";
import {
  findMatches,
  matchingAncestors,
  aggregateStats,
} from "@/lib/structure-bdd/tree-utils";
import { TreeNode } from "./tree-node";
import { SyncDot } from "./sync-dot";

type ViewMode = "tree" | "diff";

const ACCENTS = {
  web: {
    color: "hsl(210 90% 60%)",
    bg: "hsl(210 90% 64% / 0.12)",
  },
  local: {
    color: "hsl(40 90% 60%)",
    bg: "hsl(40 90% 64% / 0.12)",
  },
};

export function HolographicDatabaseExplorer() {
  const webStructure = useMemo(() => buildWebStructure(), []);
  const localStructure = useMemo(() => buildLocalStructure(), []);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const init = new Set<string>();
    init.add("nexaflow_web");
    init.add("INDEX_CHROMA");
    return init;
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("tree");

  const matchIds = useMemo<string[]>(() => {
    const set = new Set<string>();
    findMatches(webStructure, searchTerm).forEach((id) => set.add(id));
    findMatches(localStructure, searchTerm).forEach((id) => set.add(id));
    return Array.from(set);
  }, [webStructure, localStructure, searchTerm]);

  const highlightAncestors = useMemo<string[]>(() => {
    const set = new Set<string>();
    matchingAncestors(webStructure, searchTerm).forEach((id) => set.add(id));
    matchingAncestors(localStructure, searchTerm).forEach((id) => set.add(id));
    return Array.from(set);
  }, [webStructure, localStructure, searchTerm]);

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

  useEffect(() => {
    if (searchTerm && matchIds.length > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        matchIds.forEach((id) => next.add(id));
        highlightAncestors.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [matchIds, highlightAncestors, searchTerm]);

  const showDiff = viewMode === "diff";
  const allNodes = useMemo(
    () =>
      Array.from(
        new Set([...flattenDeep(webStructure), ...flattenDeep(localStructure)]),
      ),
    [webStructure, localStructure],
  );

  const syncSummary = useMemo<Record<SyncState, number>>(() => {
    const counts: Record<SyncState, number> = {
      synced: 0,
      pending: 0,
      conflict: 0,
      "local-only": 0,
    };
    allNodes.forEach((n) => {
      if (n.syncState) counts[n.syncState] = (counts[n.syncState] ?? 0) + 1;
    });
    return counts;
  }, [allNodes]);

  const webStats = aggregateStats(webStructure);
  const localStats = aggregateStats(localStructure);
  const totalVectors = webStats.vectors + localStats.vectors;
  const totalChunks = webStats.chunks + localStats.chunks;
  const selected = allNodes.find((n) => n.id === selectedId) ?? null;

  return (
    <section className="relative isolate">
      <div className="pointer-events-none absolute -inset-4">
        <div className="absolute inset-0 bg-gradient-mesh opacity-[0.11]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <div className="relative mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 animate-slide-in-3d">
          <div className="icon-glow">
            <div className="icon-inner">
              <Database className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight gradient-text">
              Structure BDD
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Arborescence des bases Web &amp; locale — contenus indexés et
              vectorisés
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrer l'arborescence..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64 rounded-xl border-border/60 bg-background/60 focus:border-primary/50"
            />
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-card/60 p-1 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all",
                viewMode === "tree"
                  ? "bg-primary/15 text-primary shadow-primary-glow"
                  : "hover:bg-muted/50",
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              Arborescence
            </button>
            <button
              type="button"
              onClick={() => setViewMode("diff")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all",
                viewMode === "diff"
                  ? "bg-primary/15 text-primary shadow-primary-glow"
                  : "hover:bg-muted/50",
              )}
            >
              <GitMerge className="h-3.5 w-3.5" />
              Synchronisation
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const init = new Set<string>();
              init.add("nexaflow_web");
              init.add("INDEX_CHROMA");
              setExpanded(init);
              setSearchTerm("");
              setSelectedId(null);
            }}
            className="h-8 rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary"
          >
            Réinitialiser
          </Button>
        </div>
      </div>

      <StatsRibbon
        web={webStats}
        local={localStats}
        totalVectors={totalVectors}
        totalChunks={totalChunks}
      />

      {showDiff && <DiffSummary counts={syncSummary} className="mt-4" />}

      {selected && <SelectedDetail node={selected} className="mt-4" />}

      <div className="relative isolate mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1fr_10rem_1fr]">
        <TreePanel
          label="Web BDD"
          structure={webStructure}
          accent="web"
          expanded={expanded}
          onToggle={toggleNode}
          onSelect={onSelect}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          searchTerm={searchTerm}
          matchIds={matchIds}
          highlightAncestors={highlightAncestors}
          showDiff={showDiff}
        />

        <SyncSpine syncSummary={syncSummary} />

        <TreePanel
          label="Local BDD"
          structure={localStructure}
          accent="local"
          expanded={expanded}
          onToggle={toggleNode}
          onSelect={onSelect}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          searchTerm={searchTerm}
          matchIds={matchIds}
          highlightAncestors={highlightAncestors}
          showDiff={showDiff}
        />
      </div>

      <div className="relative mt-8 text-center text-xs text-muted-foreground/60">
        <span className="inline-flex items-center gap-1.5">
          <Layers className="h-3 w-3" />
          Survol ou expansion d’un nœud se synchronise entre les deux bases. La
          colonne centrale représente le flux de synchronisation RAG en temps
          réel.
        </span>
      </div>
    </section>
  );
}

function flattenDeep(node: DatabaseTreeNode): DatabaseTreeNode[] {
  const out: DatabaseTreeNode[] = [node];
  const children = node.children ?? [];
  for (const c of children) out.push(...flattenDeep(c));
  return out;
}

interface TreePanelProps {
  label: string;
  structure: DatabaseStructure;
  accent: "web" | "local";
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: DatabaseTreeNode) => void;
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  searchTerm: string;
  matchIds: string[];
  highlightAncestors: string[];
  showDiff: boolean;
}

function TreePanel({
  label,
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
  showDiff,
}: TreePanelProps) {
  const stats = aggregateStats(structure);
  const a = ACCENTS[accent];
  const rootNode = structure as unknown as DatabaseTreeNode;

  return (
    <Card
      className={cn(
        "relative isolate h-full overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-sm",
        "before:absolute before:inset-0 before:rounded-2xl before:border before:border-transparent",
        accent === "web"
          ? "before:from-cyan-500/6 before:via-transparent before:to-transparent"
          : "before:from-amber-500/6 before:via-transparent before:to-transparent",
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
            <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          </div>
          <Badge
            variant="secondary"
            className="text-xs"
            style={{
              background: a.bg,
              color: a.color,
              borderColor: `${a.color}40`,
            }}
          >
            {stats.collections} collections
          </Badge>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">
              {stats.documents}
            </span>{" "}
            documents
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
            showDiff={showDiff}
          />
        </ul>
      </div>
    </Card>
  );
}

interface StatsRibbonProps {
  web: ReturnType<typeof aggregateStats>;
  local: ReturnType<typeof aggregateStats>;
  totalVectors: number;
  totalChunks: number;
}

function StatsRibbon({
  web,
  local,
  totalVectors,
  totalChunks,
}: StatsRibbonProps) {
  const counters: {
    label: string;
    value: number;
    Icon: ComponentType<{ className?: string }>;
    color: string;
  }[] = [
    {
      label: "Documents indexés",
      value: web.documents + local.documents,
      Icon: BarChart3,
      color: "hsl(200 90% 65%)",
    },
    {
      label: "Vecteurs",
      value: totalVectors,
      Icon: Database,
      color: "hsl(250 80% 65%)",
    },
    {
      label: "Chunks",
      value: totalChunks,
      Icon: Layers,
      color: "hsl(270 80% 70%)",
    },
    {
      label: "Collections",
      value: web.collections + local.collections,
      Icon: GitMerge,
      color: "hsl(40 90% 60%)",
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

function DiffSummary({
  counts,
  className,
}: {
  counts: Record<SyncState, number>;
  className?: string;
}) {
  const items: {
    state: SyncState;
    label: string;
    color: string;
    count: number;
  }[] = [
    {
      state: "synced",
      label: "Synchronisés",
      color: "text-emerald-400",
      count: counts.synced,
    },
    {
      state: "pending",
      label: "En attente",
      color: "text-amber-400",
      count: counts.pending,
    },
    {
      state: "conflict",
      label: "Conflits",
      color: "text-rose-400",
      count: counts.conflict,
    },
    {
      state: "local-only",
      label: "Local uniquement",
      color: "text-blue-400",
      count: counts["local-only"],
    },
  ];

  return (
    <Card className={cn("dashboard-card p-3", className)}>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-medium text-muted-foreground">
          État de synchronisation :
        </span>
        {items.map((it) => (
          <span key={it.state} className="inline-flex items-center gap-1.5">
            <SyncDot state={it.state} />
            <span className={cn("font-medium", it.color)}>{it.count}</span>
            <span className="text-muted-foreground">{it.label}</span>
          </span>
        ))}
      </div>
    </Card>
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
        {node.kind === "document" && node.stats && (
          <>
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {node.stats.vectors}
              </span>{" "}
              vecteurs (dim {node.stats.dimension})
            </span>
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {node.stats.chunks}
              </span>{" "}
              chunks
            </span>
            <span className="text-muted-foreground">≈ {sizeLabel}</span>
          </>
        )}
        {node.syncState && (
          <span className="inline-flex items-center gap-1.5">
            <SyncDot state={node.syncState} />
            <span className="text-muted-foreground">{node.syncState}</span>
          </span>
        )}
        {node.indexed && node.vectorized && (
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            indexé &amp; vectorisé
          </span>
        )}
      </div>
    </Card>
  );
}

function SyncSpine({
  syncSummary,
}: {
  syncSummary: Record<SyncState, number>;
}) {
  const synced = syncSummary.synced;
  const conflicts = syncSummary.conflict;
  const healthy = conflicts === 0;

  return (
    <div className="relative col-span-1 col-start-2 flex flex-col items-center justify-between py-6">
      <div className="absolute inset-0 -z-10 flex justify-center">
        <div className="relative h-full w-px">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-400/30 via-primary/35 to-amber-400/30" />
          <span
            className="absolute top-0 left-1/2 -translate-x-1/2 block h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,203,255,.7)]"
            style={{ animation: "spine-travel 4.2s linear infinite" }}
          />
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2">
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card/70 shadow-3d-sm">
          <span
            className={cn(
              "block h-2.5 w-2.5 rounded-full",
              healthy
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,.7)]"
                : "bg-rose-400",
              healthy ? "animate-pulse" : "animate-bounce",
            )}
          />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {healthy
            ? "Synchronisé"
            : `${conflicts} conflit${conflicts > 1 ? "s" : ""}`}
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
