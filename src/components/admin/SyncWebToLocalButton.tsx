"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertTriangle, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { browserDb } from "@/lib/browser-db";

const PAGE_LIMIT = 500;

export function SyncWebToLocalButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    pulled: Record<string, number>;
    failed: number;
    errors: string[];
    pagesFetched: number;
  } | null>(null);

  async function handleSync() {
    setIsLoading(true);
    const toastId = toast.loading("Synchronisation des données web vers la BDD locale...", {
      id: "sync-web-to-local-btn",
    });

    try {
      await browserDb.init();

      const csrfToken = await import("@/lib/auth/cookies").then(m => m.getCsrfTokenClient());
      const allPulled: Record<string, number> = {};
      const allErrors: string[] = [];
      let totalFailed = 0;
      let page = 1;
      let hasMore = true;
      let pagesFetched = 0;

      while (hasMore) {
        const response = await fetch(`/api/local-db/sync-all?page=${page}&limit=${PAGE_LIMIT}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erreur synchronisation page ${page} (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        if (data.failed > 0 || (data.errors && data.errors.length > 0)) {
          console.warn(`[SyncWebToLocal] Page ${page} avec erreurs:`, data.errors);
        }

        const importResult = browserDb.import(data.payload);

        for (const [table, count] of Object.entries(importResult.pulled)) {
          allPulled[table] = (allPulled[table] ?? 0) + count;
        }
        totalFailed += importResult.failed;
        allErrors.push(...importResult.errors);

        pagesFetched++;
        hasMore = data.hasMore === true;
        page++;

        if (hasMore) {
          toast.loading(`Synchronisation page ${page - 1}/${Math.ceil(data.totalRows / PAGE_LIMIT)}...`, {
            id: toastId,
          });
        }
      }

      setLastResult({
        pulled: allPulled,
        failed: totalFailed,
        errors: allErrors,
        pagesFetched,
      });

      const totalImported = Object.values(allPulled).reduce((a, b) => a + b, 0);

      if (totalFailed > 0) {
        toast.warning("Synchronisation terminée avec des erreurs", {
          id: toastId,
          description: `${totalFailed} élément(s) échoué(s). ${totalImported} importé(s) en ${pagesFetched} page(s).`,
        });
      } else {
        toast.success("Synchronisation web → locale réussie", {
          id: toastId,
          description: `${totalImported} élément(s) importé(s) en ${pagesFetched} page(s)`,
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

  async function handleCleanup() {
    setIsLoading(true);
    const toastId = toast.loading("Nettoyage des médias les plus anciens...", {
      id: "cleanup-local-btn",
    });

    try {
      await browserDb.init();

      const beforeCount = browserDb.count("media_items");
      browserDb.cleanupOldMedia(100);

      const afterCount = browserDb.count("media_items");
      const removed = beforeCount - afterCount;

      if (removed > 0) {
        toast.success("Nettoyage effectué", {
          id: toastId,
          description: `${removed} média(s) ancien(s) supprimé(s). ${afterCount} restant(s).`,
        });
      } else {
        toast.info("Aucun média à supprimer", {
          id: toastId,
          description: `La base contient ${beforeCount} média(s).`,
        });
      }
    } catch (error) {
      toast.error("Échec du nettoyage", {
        id: toastId,
        description: error instanceof Error ? error.message : "Erreur inconnue",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExport() {
    setIsLoading(true);
    const toastId = toast.loading("Export de la BDD locale...", {
      id: "export-local-btn",
    });

    try {
      const opfsStorage = await import("@/lib/browser-db/opfs-storage").then(m => m.opfsStorage);
      const blob = await opfsStorage.exportSqliteFile("visionode-local.sqlite");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `visionode-local-${new Date().toISOString().slice(0, 10)}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("BDD locale exportée", {
        id: toastId,
        description: `Taille: ${(blob.size / 1024 / 1024).toFixed(2)} Mo`,
      });
    } catch (error) {
      toast.error("Échec de l'export", {
        id: toastId,
        description: error instanceof Error ? error.message : "Erreur inconnue",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
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

        <Button
          size="sm"
          variant="outline"
          onClick={handleCleanup}
          disabled={isLoading}
          className="gap-1.5 rounded-xl border-border/60 bg-card/60 backdrop-blur-sm hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
        >
          <Trash2 className="h-4 w-4" />
          Nettoyer médias
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleExport}
          disabled={isLoading}
          className="gap-1.5 rounded-xl border-border/60 bg-card/60 backdrop-blur-sm hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
        >
          <Database className="h-4 w-4" />
          Exporter BDD locale
        </Button>
      </div>

      {lastResult && (
        <div className="p-2 rounded-lg border border-border/60 bg-card/60 text-xs space-y-1">
          <div className="flex items-center justify-between font-medium">
            <span>Sync web → local ({lastResult.pagesFetched} pages)</span>
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
