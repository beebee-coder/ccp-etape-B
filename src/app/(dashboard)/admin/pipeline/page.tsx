"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GitBranch, Play, Square, Download, Terminal, CheckCircle2 } from "lucide-react";
import { getCsrfTokenClient } from "@/lib/auth/cookies";

type PipelineStatus = "idle" | "running" | "success" | "error";

interface LogEntry {
  id: number;
  step: string;
  message: string;
  timestamp: Date;
}

interface ProgressData {
  step: string;
  stepIndex: number;
  totalSteps: number;
  progress: number;
  label: string;
}

const STEP_LABELS: Record<string, string> = {
  init: "Initialisation",
  remote: "Configuration du remote Git",
  status: "Analyse du statut",
  add: "Indexation des fichiers",
  commit: "Création du commit",
  push: "Publication sur GitHub",
};

export default function AdminPipelinePage() {
  const [status, setStatus] = useState<PipelineStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<ProgressData>({
    step: "idle",
    stepIndex: 0,
    totalSteps: 6,
    progress: 0,
    label: "Prêt à démarrer",
  });
  const [repoUrl] = useState("https://github.com/beebee-coder/ccp-etape-B.git");
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const logIdRef = useRef(0);

  const addLog = (step: string, message: string) => {
    const id = ++logIdRef.current;
    setLogs((prev) => [
      ...prev,
      { id, step, message, timestamp: new Date() },
    ]);
  };

  const scrollToBottom = () => {
    const container = logContainerRef.current;
    const endEl = logEndRef.current;
    if (endEl) {
      try {
        endEl.scrollIntoView({ behavior: "smooth", block: "end" });
      } catch {}
    } else if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setProgress({
      step: "idle",
      stepIndex: 0,
      totalSteps: 6,
      progress: 0,
      label: "Prêt à démarrer",
    });
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const parseSSELine = (line: string): { event: string; data: string } | null => {
    if (!line.trim()) return null;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) return null;
    const field = line.substring(0, colonIdx).trim();
    const value = line.substring(colonIdx + 1).trim();
    if (field === "event" || field === "data") {
      return { event: field, data: value };
    }
    return null;
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.csrfToken) {
        try {
          localStorage.setItem("csrf_token", data.csrfToken);
        } catch {}
      }
      return true;
    } catch {
      return false;
    }
  };

  const startPipeline = async () => {
    clearLogs();
    setStatus("running");
    addLog("system", `🚀 Démarrage du pipeline de déploiement vers GitHub`);
    addLog("system", `Repository cible : ${repoUrl}`);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const refreshed = await refreshSession();
      if (!refreshed) {
        console.log("[pipeline] DEBUG - refresh failed, redirecting to login");
        window.location.href = "/login?callbackUrl=/admin/pipeline";
        return;
      }
      console.log("[pipeline] DEBUG - session refreshed");

      const csrfToken = getCsrfTokenClient();
      console.log("[pipeline] DEBUG - CSRF token available:", !!csrfToken);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (csrfToken) {
        headers["x-csrf-token"] = csrfToken;
      }

        const response = await fetch("/api/pipeline", {
          method: "POST",
          headers,
          body: JSON.stringify({ branch: "main" }),
          signal: controller.signal,
        });
 
        console.log("[pipeline] DEBUG - response status:", response.status);
        console.log("[pipeline] DEBUG - response headers:", Object.fromEntries(response.headers.entries()));
 
        if (response.status === 401) {
          console.log("[pipeline] DEBUG - session expired, redirecting to login");
          window.location.href = "/login?callbackUrl=/admin/pipeline";
          return;
        }
 
        if (!response.ok) {
          const errorBody = await response.text();
          console.log("[pipeline] DEBUG - error response body:", errorBody);
          throw new Error(`HTTP ${response.status}: ${errorBody}`);
        }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Impossible de lire le flux de réponse");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith(":")) continue;
          if (line.trim() === "") {
            if (currentEvent && buffer) {
              handleSSEEvent(currentEvent, buffer);
              currentEvent = "";
              buffer = "";
            }
            continue;
          }

          const parsed = parseSSELine(line);
          if (parsed?.event === "event") {
            currentEvent = parsed.data;
          } else if (parsed?.event === "data") {
            if (currentEvent) {
              handleSSEEvent(currentEvent, parsed.data);
              currentEvent = "";
            } else {
              buffer = parsed.data;
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        addLog("system", "🛑 Flux interrompu");
      } else {
        setStatus("error");
        addLog("system", `⚡ Erreur : ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  function handleSSEEvent(event: string, data: string) {
    try {
      const parsed = JSON.parse(data);
      switch (event) {
        case "start":
          addLog("system", `✅ ${parsed.message}`);
          break;
        case "step":
          addLog(parsed.id, `▶️ Étape : ${STEP_LABELS[parsed.id] ?? parsed.id}`);
          break;
        case "log":
          addLog(parsed.step, parsed.message);
          break;
        case "progress":
          setProgress(parsed as ProgressData);
          addLog("progress", `📊 Avancement : ${parsed.progress}% — ${parsed.label}`);
          break;
        case "error":
          addLog("error", `❌ ${parsed.message}`);
          break;
        case "complete":
          setStatus("success");
          addLog("system", `✅ ${parsed.message}`);
          setProgress((p) => ({ ...p, progress: 100, step: "complete" }));
          break;
        case "fail":
          setStatus("error");
          addLog("system", `⚡ ${parsed.message}`);
          break;
        default:
          addLog("system", `[${event}] ${JSON.stringify(parsed)}`);
      }
    } catch {
      addLog("system", `[${event}] ${data}`);
    }
  }

  const stopPipeline = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus("idle");
    addLog("system", "🛑 Pipeline interrompu par l'utilisateur");
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const exportLogs = () => {
    const logText = logs
      .map((l) => `[${formatTime(l.timestamp)}] [${l.step}] ${l.message}`)
      .join("\n");
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColors = {
    idle: "bg-muted",
    running: "bg-blue-500",
    success: "bg-emerald-500",
    error: "bg-rose-500",
  };

  const currentStepLabel =
    STEP_LABELS[progress.step] ?? progress.label ?? "Prêt à démarrer";

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-4 animate-slide-in-3d">
        <div className="icon-glow">
          <div className="icon-inner">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">
            Pipeline de déploiement
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Automatisation de l&apos;upload de l&apos;application vers GitHub.
          </p>
        </div>
      </div>

      <Card className="dashboard-card mb-6 overflow-hidden">
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge
                variant={
                  status === "running"
                    ? "default"
                    : status === "success"
                      ? "default"
                      : status === "error"
                        ? "destructive"
                        : "secondary"
                }
                className="rounded-lg"
              >
                 <span className="flex items-center gap-1.5">
                   <span className={cn("h-2 w-2 rounded-full", statusColors[status])} />
                   {status === "idle" ? "Prêt" : status === "running" ? "En cours" : status === "success" ? "Terminé" : "Échec"}
                 </span>
              </Badge>
              <span className="text-sm text-muted-foreground">
                Repo : {repoUrl}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {logs.length > 0 && (
                <Button
                  data-testid="export-logs"
                  variant="outline"
                  size="sm"
                  onClick={exportLogs}
                  className="gap-1.5 rounded-xl border-border/60 bg-card/60 backdrop-blur-sm hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200"
                >
                  <Download className="h-4 w-4" />
                  Exporter les logs
                </Button>
              )}
              {status === "running" ? (
                <Button
                  data-testid="stop-pipeline"
                  variant="destructive"
                  size="sm"
                  onClick={stopPipeline}
                  className="gap-1.5 rounded-xl"
                >
                  <Square className="h-4 w-4" />
                  Arrêter
                </Button>
              ) : (
                <Button
                  data-testid="start-pipeline"
                  size="sm"
                  onClick={startPipeline}
                  className={cn(
                    "gap-1.5 rounded-xl text-base font-medium",
                    "btn-primary-gradient shadow-primary-glow",
                    "hover:-translate-y-0.5 active:translate-y-0",
                    "transition-all duration-200"
                  )}
                >
                  <Play className="h-4 w-4" />
                  Démarrer le pipeline
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="dashboard-card mb-6 overflow-hidden">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Avancement du pipeline
            </h2>
            <span className="text-sm font-medium text-muted-foreground">
              Étape : {currentStepLabel}
            </span>
          </div>
        </div>
        <div className="px-6 pb-6">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{progress.progress}%</span>
            <span>
              Étape {progress.stepIndex + 1} sur {progress.totalSteps}
            </span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/30">
            <div
              className={cn(
                "h-full w-full rounded-full transition-all duration-500 ease-out",
                status === "success"
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  : status === "error"
                    ? "bg-gradient-to-r from-rose-500 to-rose-400"
                    : "bg-gradient-to-r from-primary to-purple-600"
              )}
              style={{ width: `${progress.progress}%` }}
            />
            <div className="absolute inset-0 rounded-full bg-white/10" />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="dashboard-card lg:col-span-1 overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Journal d&apos;exécution
            </h2>
          </div>
          <div className="px-6 pb-6">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{logs.length} lignes</span>
              <span>
                {logs.length > 0
                  ? formatTime(logs[logs.length - 1].timestamp)
                  : "--:--:--"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(STEP_LABELS).map(([key, label], idx) => (
                <Badge
                  key={key}
                  variant="outline"
                  className={cn(
                    "rounded-lg text-xs",
                    progress.step === key
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/40 text-muted-foreground"
                  )}
                >
                  {idx + 1}. {label}
                </Badge>
              ))}
            </div>
          </div>
        </Card>

        <Card className="dashboard-card lg:col-span-2 overflow-hidden">
          <div className="p-6 pb-0">
            <div
              ref={logContainerRef}
              className="h-[420px] w-full overflow-y-auto rounded-xl border border-border/60 bg-background/60 font-mono text-xs"
            >
              <div className="p-3 space-y-0.5">
                {logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50">
                    Les journaux du pipeline apparaîtront ici...
                  </p>
                ) : (
                  logs.map((l) => (
                    <div key={l.id} className="whitespace-nowrap break-all">
                      <span className="text-muted-foreground/60">[{formatTime(l.timestamp)}]</span>{" "}
                      <span className="text-muted-foreground/60">[{l.step}]</span>{" "}
                      <span className="text-foreground">{l.message}</span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {status === "success" && (
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Déploiement publié avec succès sur GitHub.
          </span>
        </div>
      )}

      {status === "error" && (
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3">
          <Terminal className="h-5 w-5 text-rose-500" />
          <span className="text-sm font-medium text-rose-700 dark:text-rose-400">
            Une erreur est survenue. Consultez les journaux ci-dessus pour plus de détails.
          </span>
        </div>
      )}
    </section>
  );
}
