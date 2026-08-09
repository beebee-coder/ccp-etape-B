"use client";

import { useEffect, useState } from "react";

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (wasOffline) {
        setWasOffline(false);
      }

      if ("__TAURI__" in window || "__TAURI_INTERNALS__" in window) {
        try {
          const { SyncEngine } = await import("@/lib/local-db/sync-engine");
          const engine = SyncEngine.getInstance();
          await engine.processQueue();
        } catch {
          // ignore sync errors on reconnect
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}
