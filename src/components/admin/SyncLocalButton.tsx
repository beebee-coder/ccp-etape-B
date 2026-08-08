"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, CheckCircle2, AlertTriangle, Database } from "lucide-react";
import { toast } from "sonner";
import { isTauriEnvironment, tauriPullAndPurge, type TauriPullResult } from "@/lib/tauri/commands";
import { getCsrfTokenClient } from "@/lib/auth/cookies";
import { browserDb } from "@/lib/browser-db";
import type { ImportPayload } from "@/lib/browser-db";

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
        // Mode Navigateur Web (Vercel)
        const csrfToken = getCsrfTokenClient();
        const response = await fetch("/api/local-db/sync-all", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        const data = (await response.json()) as {
          ok: boolean;
          purged: boolean;
          totalRows: number;
          counts: Record<string, number>;
          payload: ImportPayload;
        };

        // Initialisation de SQLite-WASM + OPFS
        toast.loading("Initialisation et écriture SQLite-WASM...", { id: toastId });
        await browserDb.init();

        // Import du payload dans le SQLite local du navigateur
        const importResult = browserDb.import(data.payload);

        const storageMode = browserDb.getStorageMode();
        const modeLabel = storageMode === "opfs" ? "OPFS (persistant)" : "Mémoire";

        setLastResult({
          pulled: importResult.pulled || {},
          failed: importResult.failed || 0,
          errors: importResult.errors || [],
          purged: data.purged || false,
        });

        if (importResult.failed > 0) {
          toast.warning("Synchronisation local-browser terminée avec des erreurs", {
            id: toastId,
            description: `${importResult.failed} élément(s) non importé(s) (Stockage : ${modeLabel})`,
          });
        } else {
          toast.success("Synchronisation browser réussie !", {
            id: toastId,
            description: `BDD locale peuplée sur votre device [${modeLabel}]${data.purged ? " - Base web purgée" : ""}`,
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
              Statut Sync Local
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
