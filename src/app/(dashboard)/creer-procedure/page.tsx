"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Mic } from "lucide-react";
import { CreateProcedureForm } from "@/components/creer-procedure-form";
import { useVoiceGuide } from "@/lib/voice-guide/orchestrator";

export default function CreerProcedurePage() {
  const { activate: activateVoiceGuide, startGuidance: startVoiceGuidance } = useVoiceGuide();
  return (
    <section className="py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Page Header ── */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 animate-slide-in-3d">
          <div className="flex items-center gap-4">
            <div className="icon-glow">
              <div className="icon-inner">
                <Plus className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <Badge
                variant="secondary"
                className="mb-2 bg-primary/10 text-primary border-primary/20"
              >
                Assistant Procédure
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight gradient-text sm:text-3xl">
                Créer une procédure
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Configurez les métadonnées, les étapes et les règles de sécurité de votre procédure opérationnelle.
              </p>
            </div>
          </div>
          <Button
            data-testid="voice-guide-procedure"
            type="button"
            variant="ghost"
            size="icon"
            onClick={async () => { await activateVoiceGuide(); setTimeout(() => startVoiceGuidance(), 300); }}
            className="h-9 w-9 rounded-xl border border-transparent hover:bg-primary/10 hover:border-primary/20 text-muted-foreground hover:text-primary transition-all"
            title="Guide vocal pour la création de procédure"
          >
            <Mic className="h-4 w-4" />
          </Button>
        </div>

        <Card className="dashboard-card overflow-hidden m-4">
          <CreateProcedureForm />
        </Card>
      </div>
    </section>
  );
}
