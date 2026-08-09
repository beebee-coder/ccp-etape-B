"use client";

import {
  ChevronDown,
  ChevronRight,
  Plus,
  FileText,
  Trash2,
  Pencil,
  Wand2,
  Loader2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { DatabaseTreeNode } from "@/lib/types/structure-bdd";
import { cn } from "@/lib/utils";
import { iconFor } from "./node-icons";
import { VectorBadge } from "./vector-badge";
import { SyncDot } from "./sync-dot";

export interface TreeNodeProps {
  node: DatabaseTreeNode;
  depth: number;
  isLast: boolean;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: DatabaseTreeNode) => void;
  selectedId: string | null;
  searchTerm: string;
  matchIds: string[];
  highlightAncestors: string[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  showDiff: boolean;
  onPreview?: (node: DatabaseTreeNode) => void;
  onDelete?: (path: string) => void;
  onRename?: (path: string, currentName: string) => void;
  onCreate?: (parentPath: string) => void;
  onVectorize?: (path: string) => void;
  loadingNodes?: Set<string>;
}

export function TreeNode({
  node,
  depth,
  isLast,
  expanded,
  onToggle,
  onSelect,
  selectedId,
  searchTerm,
  matchIds,
  highlightAncestors,
  hoveredId,
  onHover,
  showDiff,
  onPreview,
  onDelete,
  onRename,
  onCreate,
  onVectorize,
  loadingNodes,
}: TreeNodeProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const isMatch = matchIds.includes(node.id);
  const isHighlighted = highlightAncestors.includes(node.id);
  const isHovered = hoveredId === node.id;
  const isDimmed =
    !!searchTerm &&
    !isMatch &&
    !isHighlighted &&
    !isDescendantMatch(node, matchIds, highlightAncestors);
  const isActiveBranch = isSelected || isMatch;

  const Icon = iconFor(node.kind, isExpanded);
  const vectors = node.stats?.vectors ?? 0;
  const chunks = node.stats?.chunks ?? 0;
  const isLoadingChildren = loadingNodes?.has(node.id) ?? false;

  return (
    <li className="holo-node relative">
      <div
        className={cn(
          "group/node relative isolate flex items-center gap-2 rounded-xl border border-transparent",
          "bg-card/55 hover:bg-card/95 backdrop-blur-sm",
          "transition-all duration-200",
          depth >= 1 ? "hover:shadow-3d-sm" : "hover:shadow-primary-glow",
          isSelected
            ? "border-primary/50 bg-gradient-to-b from-primary/8 to-transparent shadow-primary-glow"
            : "",
          isDimmed ? "opacity-25 grayscale" : "",
          !isDimmed && isActiveBranch ? "ring-1 ring-primary/20" : "",
          isHovered ? "ring-1 ring-cyan-400/30 shadow-primary-glow" : "",
        )}
        onClick={() => onSelect(node)}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-label={node.libelle ? `${node.name} — ${node.libelle}` : undefined}
        aria-selected={isSelected}
        tabIndex={-1}
        title={node.libelle ?? undefined}
      >
        <div className="flex items-center gap-1">
          {depth > 0 && (
            <span
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-px w-[1.5rem] border-t border-dashed border-primary/20 bg-gradient-to-r from-transparent via-primary/20 to-transparent"
              style={{ left: "-1.5rem" }}
              aria-hidden
            />
          )}
          {hasChildren || isLoadingChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.id);
              }}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/70",
                "hover:bg-primary/10 hover:text-primary transition-all duration-150",
                isSelected ? "text-primary" : "",
              )}
              aria-label={isExpanded ? "Réduire" : "Développer"}
            >
              {isLoadingChildren ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="h-5 w-3.5" />
          )}
          <span
            className="flex h-5 w-5 items-center justify-center"
            style={{
              color:
                node.kind === "database"
                  ? "hsl(250 80% 65%)"
                  : node.kind === "document"
                    ? "hsl(190 80% 65%)"
                    : node.kind === "directory"
                      ? "hsl(40 85% 60%)"
                      : "hsl(230 60% 70%)",
            }}
            aria-hidden
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>

        <span
          className={cn(
            "flex-1 cursor-default text-sm font-medium transition-colors",
            "text-foreground/85 group-hover/node:text-foreground",
            isMatch && !searchTerm ? "text-cyan-400" : "",
            isHighlighted && searchTerm ? "text-primary" : "",
          )}
        >
          {renderName(node, searchTerm, isMatch)}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity">
          {node.kind === "directory" && onCreate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreate(node.path);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10"
              title="Ajouter"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          {node.kind === "document" && onPreview && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(node);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10"
              title="Prévisualiser"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
          )}
          {node.kind === "document" && onVectorize && !node.vectorized && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVectorize(node.path);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
              title="Vectoriser"
            >
              <Wand2 className="h-3.5 w-3.5" />
            </button>
          )}
          {onRename && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRename(node.path, node.name);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
              title="Renommer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.path);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {chunks > 0 && (vectors > 0 || node.kind === "document") && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/8 px-1.5 py-0.5 text-xs text-primary",
              isActiveBranch ? "border-primary/40 bg-primary/15" : "",
            )}
            title={`${chunks} chunks indexés • ${vectors} vecteurs`}
          >
            <span className="hidden sm:inline">↗ {chunks}</span>
            <span>∞ {vectors}</span>
          </span>
        )}

        {vectors > 0 && node.vectorized && (
          <VectorBadge
            dimension={node.stats?.dimension ?? 384}
            vectors={vectors}
            active
            className="h-4 w-4"
          />
        )}

        {showDiff && node.syncState && <SyncDot state={node.syncState} />}
      </div>

      {hasChildren && isExpanded && (
        <ul
          className={cn(
            "holo-children relative border-l-2 border-dashed border-primary/20 mt-1.5",
            showDiff ? "border-cyan-500/30" : "",
          )}
          role="group"
        >
          {node.children!.map((child, i) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isLast={isLast && i === node.children!.length - 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
              searchTerm={searchTerm}
              matchIds={matchIds}
              highlightAncestors={highlightAncestors}
              hoveredId={hoveredId}
              onHover={onHover}
              showDiff={showDiff}
              onPreview={onPreview}
              onDelete={onDelete}
              onRename={onRename}
              onCreate={onCreate}
              onVectorize={onVectorize}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function isDescendantMatch(
  node: DatabaseTreeNode,
  matchIds: string[],
  highlightAncestors: string[],
): boolean {
  if (matchIds.includes(node.id) || highlightAncestors.includes(node.id))
    return true;
  return (node.children ?? []).some((c) =>
    isDescendantMatch(c, matchIds, highlightAncestors),
  );
}

function renderName(
  node: DatabaseTreeNode,
  searchTerm: string,
  isMatch: boolean,
): ReactNode {
  if (!searchTerm || !isMatch) return node.name;
  const lc = searchTerm.toLowerCase();
  const parts = node.name.split(new RegExp(`(${lc})`, "gi"));
  return (
    <>
      {parts
        .filter((p) => p !== "")
        .map((part, i) =>
          lc === part.toLowerCase() ? (
            <mark key={i} className="rounded bg-primary/25 px-0.5 text-primary">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
    </>
  );
}
