"use client";

import { useEffect } from "react";
import {
  isTauriEnvironment,
  tauriInitializeDatabase,
  triggerBackgroundChromaIndex,
} from "@/lib/tauri/commands";

export function TauriAutoInit() {
  useEffect(() => {
    if (!isTauriEnvironment()) return;

    async function autoInit() {
      try {
        await tauriInitializeDatabase();
        await triggerBackgroundChromaIndex();
      } catch (err) {
        console.warn("Auto-initialisation Tauri / Chroma DB error:", err);
      }
    }

    autoInit();
  }, []);

  return null;
}
