"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertTriangle, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { browserDb } from "@/lib/browser-db";

export function SyncRegistryButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    filesExtracted: number;
    failed: number;
    errors: string[];
    source: "upload" | "server";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const toastId = toast.loading("Import de registry/ vers BDD locale...", {
      id: "sync-registry-upload-btn",
    });

    try {
      if (browserDb.isSyncing()) {
        throw new Error("Une synchronisation est déjà en cours. Veuillez patienter.");
      }

      const buffer = await file.arrayBuffer();

      toast.loading("Extraction et écriture dans OPFS...", { id: toastId });
      const { opfsStorage } = await import("@/lib/browser-db/opfs-storage");

      if (!opfsStorage.isSupported()) {
        throw new Error("L'API OPFS n'est pas supportée par ce navigateur.");
      }

      const result = await opfsStorage.extractZipToOpfs(
        buffer,
        (fileName, count, total) => {
          toast.loading(`Import ${count}/${total}: ${fileName.slice(-25)}`, {
            id: toastId,
          });
        }
      );

      setLastResult({
        filesExtracted: result.filesExtracted,
        failed: 0,
        errors: [],
        source: "upload",
      });

      toast.success("BDD locale synchronisée", {
        id: toastId,
        description: `${result.filesExtracted} éléments importés depuis registry/`,
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("local-db-synced"));
      }
    } catch (error) {
      toast.error("Échec de la synchronisation", {
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

  async function handleServerSync() {
    setIsLoading(true);
    const toastId = toast.loading("Téléchargement de registry/ depuis le serveur...", {
      id: "sync-registry-server-btn",
    });

    try {
      const archiveRes = await fetch("/api/local-db/download-registry", {
        method: "GET",
      });

      if (!archiveRes.ok) {
        throw new Error(`Erreur téléchargement registry/ (${archiveRes.status})`);
      }

      const zipBuffer = await archiveRes.arrayBuffer();

      toast.loading("Extraction et écriture dans OPFS...", { id: toastId });
      const { opfsStorage } = await import("@/lib/browser-db/opfs-storage");

      if (!opfsStorage.isSupported()) {
        throw new Error("L'API OPFS n'est pas supportée par ce navigateur.");
      }

      const result = await opfsStorage.extractZipToOpfs(
        zipBuffer,
        (fileName, count, total) => {
          toast.loading(`Import ${count}/${total}: ${fileName.slice(-25)}`, {
            id: toastId,
          });
        }
      );

      setLastResult({
        filesExtracted: result.filesExtracted,
        failed: 0,
        errors: [],
        source: "server",
      });

      toast.success("BDD locale synchronisée", {
        id: toastId,
        description: `${result.filesExtracted} éléments importés depuis registry/`,
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("local-db-synced"));
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-2">
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
          {isLoading ? "Import..." : "Importer ZIP registry/"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleServerSync}
          disabled={isLoading}
          className="gap-1.5 rounded-xl border-border/60 bg-card/60 backdrop-blur-sm hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
        >
          <Download className="h-4 w-4" />
          Sync depuis serveur
        </Button>
      </div>

      {lastResult && (
        <div className="p-2 rounded-lg border border-border/60 bg-card/60 text-xs space-y-1">
          <div className="flex items-center justify-between font-medium">
            <span>Sync registry → local</span>
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
          <div className="text-[10px] text-muted-foreground">
            {lastResult.filesExtracted} fichiers implantés sur le device
            {lastResult.source === "upload" ? " (upload direct)" : " (serveur)"}
          </div>
        </div>
      )}
    </div>
  );
}
