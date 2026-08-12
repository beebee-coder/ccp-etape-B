"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Mail, Phone, MapPin, Mic } from "lucide-react";
import { useVoiceGuide } from "@/lib/voice-guide/orchestrator";

export default function ContactPage() {
  const { activate: activateVoiceGuide, startGuidance: startVoiceGuidance } = useVoiceGuide();
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* ── Page Header ── */}
        <div className="mb-12 flex items-center gap-4 animate-slide-in-3d">
          <div className="icon-glow">
            <div className="icon-inner">
              <Mail className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight gradient-text sm:text-4xl">
              Contactez-nous
            </h1>
            <p className="mt-1 text-lg text-muted-foreground">
              Remplissez le formulaire et notre équipe vous répondra sous 24h.
            </p>
          </div>
        </div>

        <Card className="dashboard-card p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Formulaire de contact</h2>
              <p className="text-sm text-muted-foreground">Notre équipe vous répondra sous 24h.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={async () => { await activateVoiceGuide(); setTimeout(() => startVoiceGuidance(), 300); }}
              className="h-8 w-8 rounded-lg border border-transparent hover:bg-primary/10 hover:border-primary/20 text-muted-foreground hover:text-primary transition-all"
              title="Guide vocal pour le contact"
            >
              <Mic className="h-4 w-4" />
            </Button>
          </div>
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium text-foreground/80">Prénom</label>
                <Input
                  id="firstName"
                  placeholder="Jean"
                  className={cn(
                    "bg-background/60 border-border/60 rounded-xl",
                    "focus:border-primary/50 focus:shadow-primary-glow",
                    "transition-all duration-200"
                  )}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium text-foreground/80">Nom</label>
                <Input
                  id="lastName"
                  placeholder="Dupont"
                  className={cn(
                    "bg-background/60 border-border/60 rounded-xl",
                    "focus:border-primary/50 focus:shadow-primary-glow",
                    "transition-all duration-200"
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground/80">Email professionnel</label>
              <Input
                id="email"
                type="email"
                placeholder="vous@entreprise.com"
                className={cn(
                  "bg-background/60 border-border/60 rounded-xl",
                  "focus:border-primary/50 focus:shadow-primary-glow",
                  "transition-all duration-200"
                )}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="company" className="text-sm font-medium text-foreground/80">Entreprise</label>
              <Input
                id="company"
                placeholder="Acme Corp"
                className={cn(
                  "bg-background/60 border-border/60 rounded-xl",
                  "focus:border-primary/50 focus:shadow-primary-glow",
                  "transition-all duration-200"
                )}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium text-foreground/80">Message</label>
              <textarea
                id="message"
                rows={5}
                placeholder="Décrivez votre besoin..."
                className={cn(
                  "w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm",
                  "placeholder:text-muted-foreground/50 text-foreground",
                  "focus:border-primary/50 focus:shadow-primary-glow",
                  "transition-all duration-200"
                )}
              />
            </div>

            <Button
              type="submit"
              className={cn(
                "w-full h-11 rounded-xl text-base font-medium",
                "btn-primary-gradient shadow-primary-glow",
                "hover:-translate-y-0.5 active:translate-y-0",
                "transition-all duration-200"
              )}
            >
              Envoyer
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              En soumettant ce formulaire, vous acceptez notre politique de confidentialité.
            </p>
          </form>
        </Card>

        <div className="mt-12 grid gap-6 sm:grid-cols-3 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
              <Mail className="h-5 w-5" />
            </div>
            <p className="font-medium text-foreground">Email</p>
            <p className="text-sm text-muted-foreground">sales@nexaflow.com</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
              <Phone className="h-5 w-5" />
            </div>
            <p className="font-medium text-foreground">Téléphone</p>
            <p className="text-sm text-muted-foreground">+33 1 23 45 67 89</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
              <MapPin className="h-5 w-5" />
            </div>
            <p className="font-medium text-foreground">Adresse</p>
            <p className="text-sm text-muted-foreground">Paris, France</p>
          </div>
        </div>
      </div>
    </section>
  );
}
