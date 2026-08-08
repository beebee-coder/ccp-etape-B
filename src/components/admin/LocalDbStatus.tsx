"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HardDrive, CheckCircle2, XCircle, Info } from "lucide-react";
import { browserDb } from "@/lib/browser-db";
import { opfsStorage } from "@/lib/browser-db/opfs-storage";

type LocalDbStatus = {
  opfsSupported: boolean;
  sharedArrayBuffer: boolean;
  dbReady: boolean;
  storageMode: "opfs" | "memory" | "unknown";
  fileCount: number;
};

export function LocalDbStatus() {
  const [status, setStatus] = useState<LocalDbStatus>({
    opfsSupported: false,
    sharedArrayBuffer: false,
    dbReady: false,
    storageMode: "unknown",
    fileCount: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      const opfsSupported = opfsStorage.isSupported();
      const sharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
      const dbReady = browserDb.isReady();
      const storageMode = browserDb.getStorageMode();

      let fileCount = 0;
      if (opfsSupported) {
        try {
          const tree = await opfsStorage.getTree();
          fileCount = tree.length;
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
