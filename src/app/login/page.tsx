"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.querySelector("#email") as HTMLInputElement)?.value || "";
    const lower = email.toLowerCase();
    const role = lower.includes("admin")
      ? "admin"
      : lower.includes("chef-de-quart")
        ? "chef-de-quart"
        : lower.includes("chef-de-bloc")
          ? "chef-de-bloc"
          : "rondier";
    const route = role === "admin" ? "/admin" : `/${role}`;
    router.push(route);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <section className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className={cn(
          "relative w-full max-w-md overflow-hidden p-8 sm:p-10",
          "dashboard-card",
          "animate-slide-in-3d"
        )}>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
          <div className="relative">
            <div className="text-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20 shadow-3d-sm mx-auto">
                <NexaFlowLogo className="h-8 w-8" iconClassName="h-4 w-4" />
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight gradient-text">
                Connexion
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Connectez-vous à votre compte NexaFlow
              </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  className={cn(
                    "h-11 rounded-xl bg-background/60 border-border/60",
                    "focus:border-primary/50 focus:shadow-primary-glow",
                    "transition-all duration-200"
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="password">
                  Mot de passe
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={cn(
                    "h-11 rounded-xl bg-background/60 border-border/60",
                    "focus:border-primary/50 focus:shadow-primary-glow",
                    "transition-all duration-200"
                  )}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2.5 text-muted-foreground cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" />
                  Se souvenir de moi
                </label>
                <Link href="#" className="text-primary hover:underline font-medium">
                  Mot de passe oublié ?
                </Link>
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
                Se connecter
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted-foreground font-medium">ou</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    "w-full text-sm h-11 rounded-xl",
                    "border-border/60 bg-card/60 backdrop-blur-sm",
                    "hover:bg-primary/8 hover:border-primary/30 hover:text-primary",
                    "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
                  )}
                  onClick={() => alert("Connexion Google non disponible")}
                >
                  Google
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    "w-full text-sm h-11 rounded-xl",
                    "border-border/60 bg-card/60 backdrop-blur-sm",
                    "hover:bg-primary/8 hover:border-primary/30 hover:text-primary",
                    "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
                  )}
                  onClick={() => alert("Connexion Microsoft non disponible")}
                >
                  Microsoft
                </Button>
              </div>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Pas encore de compte ?{" "}
              <Link href="#" className="text-primary hover:underline font-semibold">
                S&apos;inscrire
              </Link>
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
