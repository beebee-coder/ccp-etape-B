"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, CheckCircle2, AlertTriangle, Database, Upload } from "lucide-react";
import { toast } from "sonner";
import { isTauriEnvironment, tauriPullAndPurge, type TauriPullResult } from "@/lib/tauri/commands";
import { getCsrfTokenClient } from "@/lib/auth/cookies";
import { browserDb } from "@/lib/browser-db";

export function SyncLocalButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<TauriPullResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSyncFromServer() {
    if (isLoading) return;

    setIsLoading(true);
    const toastId = toast.loading("Synchronisation depuis le serveur...", {
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
        if (browserDb.isSyncing()) {
          throw new Error("Une synchronisation est déjà en cours. Veuillez patienter.");
        }

        // Mode Navigateur Web (Vercel)
        toast.loading("Téléchargement du bundle complet .local-db...", { id: toastId });
        
        const archiveRes = await fetch("/api/local-db/download-archive", {
          method: "GET",
        });

        if (!archiveRes.ok) {
          throw new Error(`Erreur téléchargement archive (${archiveRes.status})`);
        }

        const zipBuffer = await archiveRes.arrayBuffer();

        toast.loading("Extraction et écriture de l'arborescence sur le device (OPFS)...", { id: toastId });
        const { opfsStorage } = await import("@/lib/browser-db/opfs-storage");

        if (!opfsStorage.isSupported()) {
          throw new Error("L'API OPFS n'est pas supportée par ce navigateur.");
        }

        const { filesExtracted } = await opfsStorage.extractZipToOpfs(
          zipBuffer,
          (fileName, count, total) => {
            toast.loading(`Implantation sur le device (${count}/${total}): ${fileName.slice(-25)}`, {
              id: toastId,
            });
          }
        );

        // Déclencher aussi l'export JSON pour SQLite WASM
        const csrfToken = getCsrfTokenClient();
        const response = await fetch("/api/local-db/sync-all", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
        });

        if (!response.ok) {
          throw new Error(`Erreur synchronisation SQL (${response.status})`);
        }

        const data = await response.json();

        // Vérification de cohérence entre le ZIP et le payload SQL
        if (data.payload?.exportedAt) {
          const zipTimestamp = data.payload.exportedAt;
          if (zipTimestamp) {
            const zipDate = new Date(zipTimestamp);
            const now = new Date();
            const driftMs = Math.abs(now.getTime() - zipDate.getTime());
            if (driftMs > 30000) {
              console.warn("[SyncLocal] Écart de temps entre ZIP et payload > 30s", { driftMs });
            }
          }
        }

        await browserDb.init();
        browserDb.import(data.payload);

        setLastResult({
          pulled: { files: filesExtracted },
          failed: 0,
          errors: [],
          purged: true,
        });

        toast.success("BDD locale implantée avec succès !", {
          id: toastId,
          description: `Arborescence physique (${filesExtracted} éléments) installée sur votre device [OPFS]`,
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("local-db-synced"));
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

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const toastId = toast.loading("Import du ZIP .local-db...", {
      id: "sync-local-upload-btn",
    });

    try {
      if (browserDb.isSyncing()) {
        throw new Error("Une synchronisation est déjà en cours. Veuillez patienter.");
      }

      const buffer = await file.arrayBuffer();

      toast.loading("Extraction et écriture de l'arborescence sur le device (OPFS)...", { id: toastId });
      const { opfsStorage } = await import("@/lib/browser-db/opfs-storage");

      if (!opfsStorage.isSupported()) {
        throw new Error("L'API OPFS n'est pas supportée par ce navigateur.");
      }

      const { filesExtracted } = await opfsStorage.extractZipToOpfs(
        buffer,
        (fileName, count, total) => {
          toast.loading(`Implantation sur le device (${count}/${total}): ${fileName.slice(-25)}`, {
            id: toastId,
          });
        }
      );

      setLastResult({
        pulled: { files: filesExtracted },
        failed: 0,
        errors: [],
        purged: false,
      });

      toast.success("BDD locale implantée avec succès !", {
        id: toastId,
        description: `Arborescence physique (${filesExtracted} éléments) installée sur votre device [OPFS]`,
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("local-db-synced"));
      }
    } catch (error) {
      toast.error("Échec de l'import", {
        id: toastId,
        description: error instanceof Error ? error.message : "Erreur inconnue",
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          onChange={handleFileUpload}
          className="hidden"
        />

        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="gap-1.5 rounded-xl border border-primary/30 bg-gradient-to-r from-primary to-purple-600 shadow-3d-sm text-white hover:-translate-y-0.5 hover:shadow-primary-glow active:translate-y-0 transition-all duration-200"
        >
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isLoading ? "Import..." : "Importer ZIP .local-db"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleSyncFromServer}
          disabled={isLoading}
          className="gap-1.5 rounded-xl border-border/60 bg-card/60 backdrop-blur-sm hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
        >
          <Download className="h-4 w-4" />
          Synchroniser depuis serveur
        </Button>
      </div>

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
