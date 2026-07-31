import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { resolve } from "path";

const PROJECT_ROOT = resolve(process.cwd());
const GITHUB_REPO_URL = "https://github.com/beebee-coder/ccp-etape-B.git";
const REMOTE_NAME = "origin";
const BRANCH = "main";

interface PipelineConfig {
  branch?: string;
  message?: string;
  token?: string;
}

type SSEController = ReadableStreamDefaultController<Uint8Array>;
type GitConfig = Record<string, string>;

function sse(controller: SSEController, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
}

async function runGit(
  args: string[],
  controller: SSEController,
  logPrefix: string,
  gitConfig: GitConfig = {}
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const fullArgs = [
      ...Object.entries(gitConfig).flatMap(([k, v]) => ["-c", `${k}=${v}`]),
      ...args,
    ];
    const child = spawn("git", fullArgs, { cwd: PROJECT_ROOT, shell: false });
    let output = "";

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      output += text;
      const lines = text.trim().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          sse(controller, "log", { step: logPrefix, message: line.trim() });
        }
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      output += text;
      const lines = text.trim().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          sse(controller, "log", { step: logPrefix, message: `[stderr] ${line.trim()}` });
        }
      }
    });

    child.on("close", (code: number) => {
      resolve({ success: code === 0, output });
    });

    child.on("error", (err: Error) => {
      sse(controller, "error", { step: logPrefix, message: err.message });
      resolve({ success: false, output: err.message });
    });
  });
}

export async function POST(request: Request) {
  let config: PipelineConfig = {};
  try {
    config = await request.json();
  } catch {
    config = {};
  }

  const branch = config.branch || BRANCH;
  const commitMessage = config.message || "🚀 Pipeline automatique: déploiement GitHub";
  const token = config.token || process.env.GITHUB_TOKEN;
  const pushUrl = token
    ? GITHUB_REPO_URL.replace("https://", `https://x-access-token:${token}@`)
    : GITHUB_REPO_URL;

  const stream = new ReadableStream({
    async start(controller) {
      const steps = [
        { id: "init", label: "Initialisation du pipeline", weight: 15 },
        { id: "remote", label: "Configuration de la source Git", weight: 15 },
        { id: "status", label: "Analyse du statut Git", weight: 10 },
        { id: "add", label: "Indexation des fichiers", weight: 15 },
        { id: "commit", label: "Création du commit", weight: 20 },
        { id: "push", label: "Publication sur GitHub", weight: 25 },
      ];

      let completedWeight = 0;

      const updateProgress = (stepId: string, stepIndex: number) => {
        const stepWeight = steps[stepIndex]?.weight ?? 0;
        completedWeight += stepWeight;
        const progress = Math.min(completedWeight, 100);
        sse(controller, "progress", {
          step: stepId,
          stepIndex,
          totalSteps: steps.length,
          progress,
          label: steps[stepIndex]?.label ?? stepId,
        });
      };

      try {
        sse(controller, "start", { message: "Pipeline démarré", repoUrl: GITHUB_REPO_URL });

        const emitLog = (message: string) =>
          sse(controller, "log", { step: "init", message });

        emitLog(`Début du pipeline de déploiement vers GitHub`);
        emitLog(`Repository cible : ${GITHUB_REPO_URL}`);
        emitLog(`Branche : ${branch}`);
        emitLog(token ? "🔐 Authentification GitHub configurée" : "⚠️ Pas de token GitHub — push sans authentification");
        updateProgress("init", 0);

        // ── Step 1: Verify git repo ──
        sse(controller, "step", { id: "status", label: "Initialization", index: 2 });
        const statusResult = await runGit(["status", "--short"], controller, "status");
        if (!statusResult.success && !statusResult.output) {
          sse(controller, "log", { step: "status", message: "⚠️ Pas un dépôt git — initialisation..." });
          await runGit(["init"], controller, "init");
          await runGit(["branch", "-M", branch], controller, "branch");
        } else {
          sse(controller, "log", { step: "status", message: "✓ Dépôt Git détecté" });
          const branchResult = await runGit(["branch", "--show-current"], controller, "branch");
          if (branchResult.output.trim() !== branch) {
            sse(controller, "log", { step: "branch", message: `✓ Changement de branche vers ${branch}` });
            await runGit(["checkout", "-B", branch], controller, "branch");
          }
        }
        updateProgress("status", 2);

        // ── Step 2: Configure remote ──
        sse(controller, "step", { id: "remote", label: "Configure remote", index: 1 });
        const remoteResult = await runGit(["remote", "get-url", REMOTE_NAME], controller, "remote");
        if (remoteResult.success && remoteResult.output.trim()) {
          if (remoteResult.output.trim() !== GITHUB_REPO_URL) {
            sse(controller, "log", { step: "remote", message: `Mise à jour du remote ${REMOTE_NAME}` });
            await runGit(["remote", "set-url", REMOTE_NAME, GITHUB_REPO_URL], controller, "remote");
          } else {
            sse(controller, "log", { step: "remote", message: `✓ Remote ${REMOTE_NAME} déjà configuré : ${GITHUB_REPO_URL}` });
          }
        } else {
          sse(controller, "log", { step: "remote", message: `Ajout du remote ${REMOTE_NAME} → ${GITHUB_REPO_URL}` });
          await runGit(["remote", "add", REMOTE_NAME, GITHUB_REPO_URL], controller, "remote");
        }
        updateProgress("remote", 1);

        // ── Step 3: Stage files ──
        sse(controller, "step", { id: "add", label: "Stage files", index: 3 });
        sse(controller, "log", { step: "add", message: "Indexation de tous les fichiers..." });
        await runGit(["add", "-A"], controller, "add");
        updateProgress("add", 3);

        // ── Step 4: Commit ──
        sse(controller, "step", { id: "commit", label: "Create commit", index: 4 });
        sse(controller, "log", { step: "commit", message: `Création du commit : "${commitMessage}"` });
        const commitResult = await runGit(
          ["commit", "-m", commitMessage, "--allow-empty"],
          controller,
          "commit"
        );
        if (commitResult.success) {
          sse(controller, "log", { step: "commit", message: "✓ Commit créé avec succès" });
        } else {
          sse(controller, "log", { step: "commit", message: "⚠. Commit non créé (aucun changement ou erreur)" });
        }
        updateProgress("commit", 4);

        // ── Step 5: Push ──
        sse(controller, "step", { id: "push", label: "Push to GitHub", index: 5 });
        sse(controller, "log", { step: "push", message: `Publication sur ${GITHUB_REPO_URL} (branche: ${branch})` });
        const pushResult = await runGit(
          ["push", pushUrl, branch, "--force-with-lease"],
          controller,
          "push"
        );
        if (pushResult.success) {
          sse(controller, "log", { step: "push", message: "✅ Publication réussie !" });
        } else {
          throw new Error(`Échec du push : ${pushResult.output}`);
        }
        updateProgress("push", 5);

        sse(controller, "complete", { message: "Pipeline terminé avec succès", progress: 100 });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sse(controller, "error", { message });
        sse(controller, "fail", { message: "Pipeline échoué" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  return NextResponse.json({
    status: "ready",
    repoUrl: GITHUB_REPO_URL,
    hasToken: !!process.env.GITHUB_TOKEN,
  });
}
