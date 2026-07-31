import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { cn } from "@/lib/utils";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <div className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-xl",
            "bg-gradient-to-br from-primary/20 to-purple-500/10",
            "border border-primary/20 shadow-3d-sm"
          )}>
            <NexaFlowLogo className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight gradient-text">NexaFlow</span>
          <Badge variant="secondary" className="hidden text-xs font-medium md:inline-flex rounded-full px-2.5 py-0.5">
            v2.0
          </Badge>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(
              "hidden sm:inline-flex h-10 rounded-xl border border-border/60",
              "bg-card/60 px-4 py-2.5 text-sm font-medium text-foreground",
              "hover:bg-primary/8 hover:border-primary/30 hover:text-primary",
              "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
            )}
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className={cn(
              "inline-flex h-10 items-center rounded-xl px-4 py-2.5 text-sm font-medium",
              "bg-gradient-to-r from-primary to-purple-600 text-primary-foreground",
              "border border-primary/30 shadow-3d-sm",
              "hover:-translate-y-0.5 hover:shadow-primary-glow active:translate-y-0",
              "transition-all duration-200"
            )}
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
