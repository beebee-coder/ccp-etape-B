"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HardDrive, CheckCircle2, XCircle, Info, Download, Trash2 } from "lucide-react";
import { browserDb } from "@/lib/browser-db";
import { opfsStorage } from "@/lib/browser-db/opfs-storage";
import { toast } from "sonner";

type LocalDbStatus = {
  opfsSupported: boolean;
  sharedArrayBuffer: boolean;
  dbReady: boolean;
  storageMode: "opfs" | "memory" | "unknown";
  fileCount: number;
  approximateSizeBytes: number;
};

export function LocalDbStatus() {
  const [status, setStatus] = useState<LocalDbStatus>({
    opfsSupported: false,
    sharedArrayBuffer: false,
    dbReady: false,
    storageMode: "unknown",
    fileCount: 0,
    approximateSizeBytes: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      const opfsSupported = opfsStorage.isSupported();
      const sharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
      const dbReady = browserDb.isReady();
      const storageMode = browserDb.getStorageMode();

      let fileCount = 0;
      let approximateSizeBytes = 0;
      if (opfsSupported) {
        try {
          const tree = await opfsStorage.getTree();
          fileCount = tree.length;
        } catch {
          // ignore
        }
      }

      if (dbReady) {
        try {
          approximateSizeBytes = browserDb.getApproximateSize();
        } catch {
          // ignore
        }
      }

      if (!cancelled) {
        setStatus({
          opfsSupported,
          sharedArrayBuffer,
          dbReady,
          storageMode,
          fileCount,
          approximateSizeBytes,
        });
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isFullyOperational = status.opfsSupported && status.sharedArrayBuffer && status.dbReady;
  const sizeLabel =
    status.approximateSizeBytes >= 1024 * 1024
      ? `${(status.approximateSizeBytes / 1024 / 1024).toFixed(2)} Mo`
      : `${status.approximateSizeBytes} o`;

  async function handleCleanup() {
    try {
      await browserDb.init();
      const beforeCount = browserDb.count("media_items");
      browserDb.cleanupOldMedia(100);
      const afterCount = browserDb.count("media_items");
      const removed = beforeCount - afterCount;
      if (removed > 0) {
        toast.success(`Nettoyage effectué`, {
          description: `${removed} média(s) ancien(s) supprimé(s).`,
        });
      } else {
        toast.info("Aucun média à supprimer");
      }
    } catch (error) {
      toast.error("Échec du nettoyage", {
        description: error instanceof Error ? error.message : "Erreur inconnue",
      });
    }
  }

  async function handleExport() {
    try {
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
        description: `Taille: ${(blob.size / 1024 / 1024).toFixed(2)} Mo`,
      });
    } catch (error) {
      toast.error("Échec de l'export", {
        description: error instanceof Error ? error.message : "Erreur inconnue",
      });
    }
  }

  return (
    <Card className="mb-4 p-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 font-medium">
          <HardDrive className="h-3.5 w-3.5 text-primary" />
          <span>BDD locale (device)</span>
        </div>

        <Badge variant={status.opfsSupported ? "default" : "secondary"} className="text-[10px]">
          OPFS: {status.opfsSupported ? "Supporté" : "Non supporté"}
        </Badge>

        <Badge variant={status.sharedArrayBuffer ? "default" : "secondary"} className="text-[10px]">
          SharedArrayBuffer: {status.sharedArrayBuffer ? "OK" : "Absent"}
        </Badge>

        <Badge variant={status.dbReady ? "default" : "secondary"} className="text-[10px]">
          SQLite-WASM: {status.dbReady ? "Initialisé" : "Non initialisé"}
        </Badge>

        {status.dbReady && (
          <Badge variant="outline" className="text-[10px]">
            Mode: {status.storageMode === "opfs" ? "OPFS (persistant)" : status.storageMode === "memory" ? "Mémoire (temporaire)" : status.storageMode}
          </Badge>
        )}

        <Badge variant="outline" className="text-[10px]">
          Fichiers OPFS: {status.fileCount}
        </Badge>

        <Badge variant="outline" className="text-[10px]">
          Taille: {sizeLabel}
        </Badge>

        <div className="flex items-center gap-1 text-muted-foreground ml-auto">
          {isFullyOperational ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600">BDD locale opérationnelle</span>
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3 text-amber-500" />
              <span className="text-amber-600">
                {!status.opfsSupported && !status.sharedArrayBuffer
                  ? "Navigateur incompatible avec OPFS/SharedArrayBuffer"
                  : !status.dbReady
                  ? "Cliquez sur Synchroniser pour initialiser la BDD locale"
                  : "Initialisation en cours..."}
              </span>
            </>
          )}
        </div>
      </div>

      {isFullyOperational && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCleanup}
            className="h-7 gap-1 rounded-lg border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200 text-[11px]"
          >
            <Trash2 className="h-3 w-3" />
            Nettoyer médias anciens
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="h-7 gap-1 rounded-lg border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200 text-[11px]"
          >
            <Download className="h-3 w-3" />
            Exporter BDD locale
          </Button>
        </div>
      )}

      {!isFullyOperational && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-500/10 p-2 text-[11px] text-amber-700">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>
            La BDD locale nécessite un navigateur moderne avec OPFS et SharedArrayBuffer (headers COOP/COEP).
            Sur Safari ou en HTTP, le stockage sera temporaire (mémoire) et perdu à la fermeture.
          </span>
        </div>
      )}
    </Card>
  );
}
