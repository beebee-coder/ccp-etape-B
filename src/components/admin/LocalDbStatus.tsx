"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HardDrive, CheckCircle2, XCircle } from "lucide-react";
import { browserDb } from "@/lib/browser-db";
import { opfsStorage } from "@/lib/browser-db/opfs-storage";

type LocalDbStatus = {
  opfsSupported: boolean;
  sharedArrayBuffer: boolean;
  dbReady: boolean;
  storageMode: "opfs" | "memory" | "unknown";
};

export function LocalDbStatus() {
  const [status, setStatus] = useState<LocalDbStatus>({
    opfsSupported: false,
    sharedArrayBuffer: false,
    dbReady: false,
    storageMode: "unknown",
  });

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      const opfsSupported = opfsStorage.isSupported();
      const sharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
      const dbReady = browserDb.isReady();
      const storageMode = browserDb.getStorageMode();

      if (!cancelled) {
        setStatus({
          opfsSupported,
          sharedArrayBuffer,
          dbReady,
          storageMode,
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
          <span>BDD locale</span>
        </div>

        <Badge variant={status.dbReady ? "default" : "secondary"} className="text-[10px]">
          SQLite-WASM: {status.dbReady ? "Initialisé" : "Non initialisé"}
        </Badge>

        {status.dbReady && (
          <Badge variant="outline" className="text-[10px]">
            Mode: {status.storageMode === "opfs" ? "OPFS (persistant)" : status.storageMode === "memory" ? "Mémoire (temporaire)" : status.storageMode}
          </Badge>
        )}

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
                {!status.dbReady
                  ? "Initialisation en cours..."
                  : "Navigateur incompatible"}
              </span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
