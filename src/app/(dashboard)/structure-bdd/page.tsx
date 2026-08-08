"use client";

import { Database, Layers } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HolographicDatabaseExplorer } from "@/components/structure-bdd/holographic-database-explorer";
import { RegistryExplorer } from "@/components/structure-bdd/registry-explorer";
import { SyncRegistryButton } from "@/components/admin/SyncRegistryButton";
import { LocalDbStatus } from "@/components/admin/LocalDbStatus";

export default function StructureBDDPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Page Header ── */}
      <div className="mb-8 flex items-center gap-4 animate-slide-in-3d">
        <div className="icon-glow">
          <div className="icon-inner">
            <Database className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">
            Structure BDD
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Arborescence du registre web .registry
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <LocalDbStatus />

      <Tabs defaultValue="schema" className="space-y-1">
        <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border/30 bg-background/80 pb-3 pt-1.5 backdrop-blur-sm">
          <TabsList className="inline-flex h-10 items-center gap-1 rounded-xl border border-border/60 bg-card/60 p-1 text-sm text-muted-foreground">
            <TabsTrigger
              value="schema"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-primary-glow"
            >
              <Database className="h-4 w-4" />
              Schéma BDD
            </TabsTrigger>
            <TabsTrigger
              value="tree"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-primary-glow"
            >
              <Layers className="h-4 w-4" />
              BDD locale
            </TabsTrigger>
          </TabsList>

          <SyncRegistryButton />
        </div>

        <TabsContent value="schema" className="mt-0">
          <RegistryExplorer />
        </TabsContent>

        <TabsContent value="tree" className="mt-0">
          <HolographicDatabaseExplorer />
        </TabsContent>
      </Tabs>
    </section>
  );
}
