"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Shield, Bell, Palette, Globe, Save, Mic } from "lucide-react";
import { useVoiceGuide } from "@/lib/voice-guide/orchestrator";

export default function ProfilePage() {
  const [name, setName] = useState("Admin User");
  const [email, setEmail] = useState("admin@nexaflow.com");
  const [role] = useState("Administrateur");
  const [saving, setSaving] = useState(false);
  const { activate: activateVoiceGuide, startGuidance: startVoiceGuidance } = useVoiceGuide();

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert("Profil mis à jour");
    }, 800);
  };

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Page Header ── */}
      <div className="mb-8 flex items-center gap-4 animate-slide-in-3d">
        <div className="icon-glow">
          <div className="icon-inner">
            <User className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">
            Mon profil
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Gérez vos informations personnelles et vos préférences.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="gap-2 btn-primary-gradient"
        >
          {saving ? (
            <>
              <Save className="h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Enregistrer
            </>
          )}
        </Button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* ── Profile card ── */}
        <Card className="dashboard-card p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg animate-glow-pulse" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-purple-500/10 border-2 border-primary/20 text-2xl font-bold text-primary">
                AD
              </div>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">{name}</h2>
            <p className="text-sm text-muted-foreground">{email}</p>
            <Badge
              variant="secondary"
              className="mt-2 bg-primary/10 text-primary border-primary/20"
            >
              {role}
            </Badge>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Membre depuis</span>
            </div>
            <p className="text-sm text-foreground">Janvier 2024</p>

            <div className="flex items-center gap-3 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Langue</span>
            </div>
            <p className="text-sm text-foreground">Français</p>

            <div className="flex items-center gap-3 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Authentification</span>
            </div>
            <p className="text-sm text-foreground">Mot de passe</p>
          </div>
        </Card>

        {/* ── Settings card ── */}
        <Card className="dashboard-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-2.5 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 border border-primary/20">
                <User className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Informations personnelles</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={async () => { await activateVoiceGuide(); setTimeout(() => startVoiceGuidance(), 300); }}
              className="h-8 w-8 rounded-lg border border-transparent hover:bg-primary/10 hover:border-primary/20 text-muted-foreground hover:text-primary transition-all"
              title="Guide vocal pour le profil"
            >
              <Mic className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Mettez à jour votre nom et adresse email.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-sm font-medium text-foreground/80"
              >
                Nom complet
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background/60 border-border/60 rounded-xl focus:border-primary/50 focus:shadow-primary-glow transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground/80"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/60 border-border/60 rounded-xl focus:border-primary/50 focus:shadow-primary-glow transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="role"
                className="text-sm font-medium text-foreground/80"
              >
                Rôle
              </label>
              <Input
                id="role"
                value={role}
                disabled
                className="bg-muted/30 border-border/60 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="phone"
                className="text-sm font-medium text-foreground/80"
              >
                Téléphone
              </label>
              <Input
                id="phone"
                placeholder="+33 6 12 34 56 78"
                className="bg-background/60 border-border/60 rounded-xl focus:border-primary/50 focus:shadow-primary-glow transition-all duration-200"
              />
            </div>
          </div>

          <Separator className="my-8" />

          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 border border-primary/20">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Préférences</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez vos notifications et l&apos;apparence de l&apos;interface.
          </p>

          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-4">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Notifications</p>
                  <p className="text-xs text-muted-foreground">Recevoir des alertes par email</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200"
              >
                Configurer
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-4">
              <div className="flex items-center gap-3">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Apparence</p>
                  <p className="text-xs text-muted-foreground">Thème clair / sombre</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200"
              >
                Changer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
