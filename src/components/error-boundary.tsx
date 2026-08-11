"use client";

import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error("[ErrorBoundary] Procedure guide crashed", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-lg font-medium text-foreground">Une erreur est survenue dans le guide</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {this.state.error?.message || "Erreur inconnue"}
          </p>
          <Button
            variant="outline"
            className="mt-4 gap-2"
            onClick={() => {
              this.setState({ hasError: false, error: null });
            }}
          >
            Réessayer
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
