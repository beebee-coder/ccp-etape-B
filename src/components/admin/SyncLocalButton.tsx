"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, CheckCircle2, AlertTriangle, Database } from "lucide-react";
import { toast } from "sonner";
import { isTauriEnvironment, tauriPullAndPurge, type TauriPullResult } from "@/lib/tauri/commands";

export function SyncLocalButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<TauriPullResult | null>(null);

  async function handleSync() {
    setIsLoading(true);
    const toastId = toast.loading("Synchronisation vers la base locale...", {
      id: "sync-local-btn",
    });

    try {
      if (isTauriEnvironment()) {
        const result = await tauriPullAndPurge();
        setLastResult(result);

        if (result.failed > 0) {
          toast.warning("Synchronisation Tauri terminée avec avertissements", {
            id: toastId,
            description: `${result.failed} échec(s).`,
          });
        } else {
          toast.success("Synchronisation Tauri réussie", {
            id: toastId,
            description: `Base locale mise à jour (${Object.values(result.pulled).reduce((a, b) => a + b, 0)} éléments)${result.purged ? " - Base web purgée" : ""}`,
          });
        }
      } else {
        const response = await fetch("/api/local-db/sync-all", {
          method: "POST",
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        const result = (await response.json()) as {
          ok: boolean;
          pulled: Record<string, number>;
          failed: number;
          purged: boolean;
          errors: string[];
        };

        setLastResult({
          pulled: result.pulled || {},
          failed: result.failed || 0,
          errors: result.errors || [],
          purged: result.purged || false,
        });

        if (result.failed > 0) {
          toast.warning("Synchronisation terminée avec des erreurs", {
            id: toastId,
            description: `${result.failed} élément(s) échoué(s)`,
          });
        } else {
          toast.success("Synchronisation réussie", {
            id: toastId,
            description: `Données transférées vers la base locale${result.purged ? " et base web purgée" : ""}`,
          });
        }
      }
    } catch (error) {
      toast.error("Échec de la synchronisation", {
        id: toastId,
        description: error instanceof Error ? error.message : "Erreur inconnue",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        size="sm"
        onClick={handleSync}
        disabled={isLoading}
        className="gap-1.5 rounded-xl border border-primary/30 bg-gradient-to-r from-primary to-purple-600 shadow-3d-sm text-white hover:-translate-y-0.5 hover:shadow-primary-glow active:translate-y-0 transition-all duration-200"
      >
        {isLoading ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {isLoading ? "Synchronisation..." : "Synchroniser vers local"}
      </Button>

      {lastResult && (
        <div className="p-3 rounded-xl border border-border/60 bg-card/60 text-xs space-y-2">
          <div className="flex items-center justify-between font-medium">
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-primary" />
              Statut Sync
            </span>
            {lastResult.failed > 0 ? (
              <span className="flex items-center gap-1 text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" /> Erreurs ({lastResult.failed})
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-500">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ok
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(lastResult.pulled).map(([table, count]) => (
              <span
                key={table}
                className="px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground text-[10px]"
              >
                {table}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
