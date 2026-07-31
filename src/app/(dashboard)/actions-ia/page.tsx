"use client";

import { usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Bot } from "lucide-react";
import { EmbeddedSystemPanel } from "@/components/embedded-system/embedded-system-panel";

export default function ActionsIAPage() {
  const pathname = usePathname();
  const isActionsPage = pathname.startsWith("/actions-ia");

  return (
    <section className={`mx-auto px-4 py-6 sm:px-6 lg:px-8 ${isActionsPage ? "max-w-[1400px]" : "max-w-7xl"}`}>
      <div className="mb-6 flex items-center gap-4 animate-slide-in-3d">
        <div className="icon-glow">
          <div className="icon-inner">
            <Bot className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">
            Actions IA
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Système embarqué connecté — surveillance, contrôle et supervision par voix.
          </p>
        </div>
      </div>

      <Card className="dashboard-card overflow-hidden">
        <EmbeddedSystemPanel />
      </Card>
    </section>
  );
}
