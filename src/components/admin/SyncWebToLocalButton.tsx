"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertTriangle, Database } from "lucide-react";
import { toast } from "sonner";
import { browserDb } from "@/lib/browser-db";

export function SyncWebToLocalButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    pulled: Record<string, number>;
    failed: number;
    errors: string[];
  } | null>(null);

  async function handleSync() {
    setIsLoading(true);
    const toastId = toast.loading("Synchronisation des données web vers la BDD locale...", {
      id: "sync-web-to-local-btn",
    });

    try {
      const csrfToken = await import("@/lib/auth/cookies").then(m => m.getCsrfTokenClient());
      const response = await fetch("/api/local-db/sync-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur synchronisation (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (data.failed > 0 || (data.errors && data.errors.length > 0)) {
        console.warn("[SyncWebToLocal] Sync avec erreurs:", data.errors);
      }

      await browserDb.init();
      const importResult = browserDb.import(data.payload);

      setLastResult({
        pulled: importResult.pulled,
        failed: importResult.failed,
        errors: importResult.errors,
      });

      const totalImported = Object.values(importResult.pulled).reduce((a, b) => a + b, 0);

      if (importResult.failed > 0) {
        toast.warning("Synchronisation terminée avec des erreurs", {
          id: toastId,
          description: `${importResult.failed} élément(s) échoué(s). ${totalImported} importé(s).`,
        });
      } else {
        toast.success("Synchronisation web → locale réussie", {
          id: toastId,
          description: `${totalImported} élément(s) importé(s) dans la BDD locale`,
        });
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
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        onClick={handleSync}
        disabled={isLoading}
        className="gap-1.5 rounded-xl border border-primary/30 bg-gradient-to-r from-primary to-purple-600 shadow-3d-sm text-white hover:-translate-y-0.5 hover:shadow-primary-glow active:translate-y-0 transition-all duration-200"
      >
        {isLoading ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Database className="h-4 w-4" />
        )}
        {isLoading ? "Synchronisation..." : "Synchroniser données web"}
      </Button>

      {lastResult && (
        <div className="p-2 rounded-lg border border-border/60 bg-card/60 text-xs space-y-1">
          <div className="flex items-center justify-between font-medium">
            <span>Sync web → local</span>
            {lastResult.failed > 0 ? (
              <span className="flex items-center gap-1 text-amber-500">
                <AlertTriangle className="h-3 w-3" /> {lastResult.failed} erreur(s)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-500">
                <CheckCircle2 className="h-3 w-3" /> Ok
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(lastResult.pulled).map(([table, count]) => (
              <span
                key={table}
                className="px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground text-[10px]"
              >
                {table}: {count}
              </span>
            ))}
          </div>
          {lastResult.errors.length > 0 && (
            <div className="text-[10px] text-red-400 truncate">
              {lastResult.errors[0]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
