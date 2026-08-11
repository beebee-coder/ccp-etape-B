"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import { ProcedureGuide } from "@/components/procedures/execution/ProcedureGuide";
import { AlertTriangle, FileText } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";

interface ProcedureGuidePageClientProps {
  id: string;
}

export function ProcedureGuidePageClient({ id }: ProcedureGuidePageClientProps) {
  const [procedure, setProcedure] = useState<TProcedure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProcedure = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<TProcedure>(`/api/procedures/guide/${encodeURIComponent(id)}`);
      setProcedure(data);
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          module: "ProcedureGuidePageClient",
          message: "Procedure loaded from API",
          data: { code: data.metadata.code, title: data.metadata.title, stepCount: data.steps.length },
        })
      );
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Erreur inconnue.";
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          module: "ProcedureGuidePageClient",
          message: "Failed to load procedure",
          data: { code: id, error: errorMsg },
        })
      );
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProcedure();
  }, [loadProcedure]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !procedure) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium text-foreground">{error || "Procédure introuvable"}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Vérifiez l&apos;identifiant de la procédure ou importez un nouveau fichier JSON.
        </p>
        <Button
          variant="outline"
          className="mt-4 gap-2"
          onClick={() => (window.location.href = "/guide-procedure")}
        >
          <FileText className="h-4 w-4" />
          Retour aux guides
        </Button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ProcedureGuide procedure={procedure} onClose={() => (window.location.href = "/guide-procedure")} />
    </ErrorBoundary>
  );
}
