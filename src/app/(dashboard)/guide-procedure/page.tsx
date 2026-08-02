"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import {
  FileText,
  Upload,
  Play,
  Clock,
  ListChecks,
  Tag,
  ShieldAlert,
  Trash2,
  Plus,
  BookOpen,
} from "lucide-react";

const priorityColors: Record<string, string> = {
  basse: "bg-green-500/10 text-green-700 border-green-500/20",
  moyenne: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  haute: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  critique: "bg-destructive/10 text-destructive border-destructive/20",
};

const categoryLabels: Record<string, string> = {
  production: "Production",
  maintenance: "Maintenance",
  securite: "Sécurité",
  qualite: "Qualité",
  logistique: "Logistique",
  environnement: "Environnement",
};

export default function GuideProcedurePage() {
  const router = useRouter();
  const [procedures, setProcedures] = useState<TProcedure[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiClient.get<TProcedure[]>("/api/procedures");
        setProcedures(data);
      } catch {
        toast.error("Erreur lors du chargement des procédures");
      }
    };
    load();
  }, []);

  const handleImport = useCallback(async () => {
    const input = fileInputRef.current;
    if (!input || !input.files?.length) return;
    const file = input.files[0];
    setIsImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await apiClient.post("/api/procedures", parsed);
      const data = await apiClient.get<TProcedure[]>("/api/procedures");
      setProcedures(data);
      toast.success("Procédure importée avec succès");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "JSON invalide");
    } finally {
      setIsImporting(false);
      if (input) input.value = "";
    }
  }, []);

  const handleStartGuide = useCallback((procedure: TProcedure) => {
    router.push(`/procedures/guide/${encodeURIComponent(procedure.metadata.code)}`);
  }, [router]);

  const handleDeleteProcedure = useCallback(
    async (code: string) => {
      try {
        await apiClient.delete(`/api/procedures/${encodeURIComponent(code)}`);
        const data = await apiClient.get<TProcedure[]>("/api/procedures");
        setProcedures(data);
        toast.success("Procédure supprimée");
      } catch {
        toast.error("Erreur lors de la suppression de la procédure");
      }
    },
    []
  );

  return (
    <section className="py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Page Header ── */}
        <div className="mb-8 flex items-center gap-4 animate-slide-in-3d">
          <div className="icon-glow">
            <div className="icon-inner">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight gradient-text sm:text-3xl">
              Guides de procédures
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Importez vos procédures JSON et lancez l&apos;accompagnement vocal étape par étape.
            </p>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="mb-8 flex items-center justify-end gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className={cn(
              "gap-1.5 rounded-xl border-border/60 bg-card/60 backdrop-blur-sm",
              "hover:bg-primary/8 hover:border-primary/30 hover:text-primary",
              "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm",
              "active:translate-y-0"
            )}
          >
            {isImporting ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Importer JSON
          </Button>
          <Button
            size="sm"
            onClick={() => (window.location.href = "/creer-procedure")}
            className="gap-1.5 btn-primary-gradient"
          >
            <Plus className="h-3.5 w-3.5" />
            Créer une procédure
          </Button>
        </div>

        {/* ── Procedures list ── */}
        {procedures.length === 0 ? (
          <Card className="dashboard-card p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/30 border border-border/40 shadow-3d-sm">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <p className="mt-4 text-lg font-medium text-foreground">Aucune procédure disponible</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                Importez un fichier JSON exporté depuis le constructeur de procédures pour
                commencer l&apos;accompagnement guidé.
              </p>
              <Button
                variant="outline"
                className="mt-4 gap-2 rounded-xl border-border/60 bg-card/60 backdrop-blur-sm hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                <Upload className="h-4 w-4" />
                Importer une procédure
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {procedures.map((procedure, idx) => {
              const stepCount = procedure.steps.length;
              const estimatedTime = procedure.metadata.estimatedTimeMinutes || 0;
              const category =
                categoryLabels[procedure.metadata.category] || procedure.metadata.category;
              const priority = priorityColors[procedure.metadata.priority] || "";

              return (
                <Card
                  key={procedure.metadata.code}
                  className="dashboard-card p-5 flex flex-col"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {procedure.metadata.title || "Procédure sans titre"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {procedure.metadata.code || "—"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                      onClick={() => handleDeleteProcedure(procedure.metadata.code)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 flex-1">
                    {procedure.metadata.description || "Aucune description."}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {category && (
                      <Badge
                        variant="outline"
                        className="text-xs gap-1 rounded-full border-border/60"
                      >
                        <Tag className="h-3 w-3" />
                        {category}
                      </Badge>
                    )}
                    {procedure.metadata.priority && (
                      <Badge
                        variant="secondary"
                        className={cn("text-xs rounded-full", priority)}
                      >
                        {procedure.metadata.priority}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ListChecks className="h-3.5 w-3.5" />
                        {stepCount} étape{stepCount !== 1 ? "s" : ""}
                      </span>
                      {estimatedTime > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {estimatedTime} min
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleStartGuide(procedure)}
                      className="gap-1.5 btn-primary-gradient"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Démarrer le guide
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Separator className="my-12" />

        {/* ── How it works card ── */}
        <Card className="dashboard-card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 border border-primary/20">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Comment ça marche ?</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Importez le JSON de votre procédure et l&apos;IA vous guide pas à pas avec
                accompagnement vocal.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => (window.location.href = "/guide-procedure")}
                className="gap-1.5 rounded-xl border-border/60 bg-card/60 backdrop-blur-sm hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Guide méthode
              </Button>
              <Button
                size="sm"
                onClick={() => (window.location.href = "/creer-procedure")}
                className="gap-1.5 btn-primary-gradient"
              >
                <Plus className="h-3.5 w-3.5" />
                Créer une procédure
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
