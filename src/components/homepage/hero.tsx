"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Hero() {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = (e.currentTarget.querySelector("#email") as HTMLInputElement)?.value || "";
    router.push(`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`);
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--primary/0.12),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--accent/0.08),transparent_50%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-24 pb-24 sm:pt-32 sm:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex animate-slide-in-3d">
            <Badge
              variant="secondary"
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium",
                "bg-primary/10 text-primary border-primary/20"
              )}
            >
              🚀 Now in public beta
            </Badge>
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Automate workflows{" "}
            <span className="text-foreground">without the chaos</span>
          </h1>

          <p className="mt-8 text-lg leading-8 text-muted-foreground sm:text-xl sm:max-w-2xl mx-auto">
            NexaFlow connects your tools, orchestrates your pipelines, and gives your team superpowers — all in one elegant interface.
          </p>

          <form className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3" onSubmit={handleSubmit}>
            <Input
              id="email"
              type="email"
              placeholder="Enter your work email"
              className={cn(
                "w-full sm:w-80 h-12 rounded-xl",
                "bg-background/60 border-border/60 backdrop-blur-sm",
                "focus:border-primary/50 focus:shadow-primary-glow",
                "transition-all duration-200"
              )}
            />
            <Button
              size="lg"
              type="submit"
              className={cn(
                "w-full sm:w-auto h-12 rounded-xl px-8",
                "btn-primary-gradient shadow-primary-glow",
                "hover:-translate-y-0.5 active:translate-y-0",
                "transition-all duration-200"
              )}
            >
              Start for free
            </Button>
          </form>

          <p className="mt-5 text-sm text-muted-foreground">
            Free for up to 5 team members. No credit card required.
          </p>
        </div>

        <div className="mt-20 relative mx-auto max-w-5xl animate-slide-in-3d">
          <div className="rounded-2xl border border-border/60 bg-card/50 p-3 shadow-3d-lg backdrop-blur-sm">
            <div className="rounded-xl bg-muted/30 aspect-video flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-14 w-14"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span className="text-sm font-medium">Watch demo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
