"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function LocaleDbInitializer() {
  useEffect(() => {
    const initLocaleDb = async () => {
      try {
        const res = await fetch("/api/locale-db/init", { method: "GET" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Erreur initialisation" }));
          console.error("[LocaleDbInitializer] failed", err);
          toast.error(err.error || "Impossible d'initialiser la base locale");
          return;
        }
        const data = await res.json();
        if (data.initialized) {
          console.log("[LocaleDbInitializer] Base locale initialisée", data);
        }
      } catch (e) {
        console.error("[LocaleDbInitializer] error", e);
        toast.error("Erreur lors de l'initialisation de la base locale");
      }
    };

    initLocaleDb();
  }, []);

  return null;
}