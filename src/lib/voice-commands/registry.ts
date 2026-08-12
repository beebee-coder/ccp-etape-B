import type { VoiceCommand, VoiceCommandContext, CommandMatchResult } from "./types";

const NAVIGATION_COMMANDS: VoiceCommand[] = [
  {
    id: "go-home",
    phrases: ["aller à l'accueil", "accueil", "page d'accueil", "retour accueil"],
    description: "Aller à la page d'accueil",
    category: "navigation",
    action: () => {
      window.location.href = "/";
    },
  },
  {
    id: "go-chat",
    phrases: ["ouvrir le chat", "aller au chat", "assistant ia", "chat ia", "ouvrir l'assistant"],
    description: "Ouvrir l'assistant IA",
    category: "navigation",
    action: () => {
      window.location.href = "/chat-ia";
    },
  },
  {
    id: "go-qr",
    phrases: ["ouvrir q r", "aller aux questions réponses", "questions réponses", "q r"],
    description: "Ouvrir Questions/Réponses",
    category: "navigation",
    action: () => {
      window.location.href = "/q-r";
    },
  },
  {
    id: "go-procedures",
    phrases: ["ouvrir les procédures", "aller aux procédures", "guide procédure", "mes procédures"],
    description: "Ouvrir les guides de procédures",
    category: "navigation",
    action: () => {
      window.location.href = "/guide-procedure";
    },
  },
  {
    id: "go-create-procedure",
    phrases: ["créer une procédure", "nouvelle procédure", "ajouter une procédure"],
    description: "Créer une nouvelle procédure",
    category: "navigation",
    action: () => {
      window.location.href = "/creer-procedure";
    },
  },
  {
    id: "go-reports",
    phrases: ["ouvrir les rapports", "aller aux rapports", "rapports"],
    description: "Ouvrir les rapports",
    category: "navigation",
    action: () => {
      window.location.href = "/rapports";
    },
  },
  {
    id: "go-etat-des-lieux",
    phrases: ["ouvrir état des lieux", "aller à l'état des lieux", "état des lieux", "inspection"],
    description: "Ouvrir État des lieux",
    category: "navigation",
    action: () => {
      window.location.href = "/etat-des-lieux";
    },
  },
  {
    id: "go-images",
    phrases: ["ouvrir les images", "banque d'images", "médiathèque", "images"],
    description: "Ouvrir la banque d'images",
    category: "navigation",
    action: () => {
      window.location.href = "/images";
    },
  },
  {
    id: "go-teams",
    phrases: ["ouvrir les équipes", "aller aux équipes", "équipes"],
    description: "Ouvrir les équipes",
    category: "navigation",
    action: () => {
      window.location.href = "/equipes";
    },
  },
  {
    id: "go-meetings",
    phrases: ["ouvrir visioconférence", "aller à la visio", "visioconférence", "vidéo conférence"],
    description: "Ouvrir la visioconférence",
    category: "navigation",
    action: () => {
      window.location.href = "/video-conference";
    },
  },
  {
    id: "go-profile",
    phrases: ["ouvrir le profil", "aller au profil", "mon profil", "profil"],
    description: "Ouvrir le profil",
    category: "navigation",
    action: () => {
      window.location.href = "/profile";
    },
  },
  {
    id: "go-contact",
    phrases: ["ouvrir contact", "aller au contact", "nous contacter", "contact"],
    description: "Ouvrir le contact",
    category: "navigation",
    action: () => {
      window.location.href = "/contact";
    },
  },
  {
    id: "go-admin",
    phrases: ["ouvrir administration", "aller à l'admin", "administration", "admin"],
    description: "Ouvrir l'administration",
    category: "navigation",
    action: () => {
      window.location.href = "/admin";
    },
  },
  {
    id: "go-rondier",
    phrases: ["ouvrir espace rondier", "aller au rondier", "rondier", "espace rondier"],
    description: "Ouvrir l'espace rondier",
    category: "navigation",
    action: () => {
      window.location.href = "/rondier";
    },
  },
  {
    id: "go-chef-quart",
    phrases: ["ouvrir chef de quart", "aller au chef de quart", "chef de quart"],
    description: "Ouvrir l'espace chef de quart",
    category: "navigation",
    action: () => {
      window.location.href = "/chef-de-quart";
    },
  },
  {
    id: "go-chef-bloc",
    phrases: ["ouvrir chef de bloc", "aller au chef de bloc", "chef de bloc"],
    description: "Ouvrir l'espace chef de bloc",
    category: "navigation",
    action: () => {
      window.location.href = "/chef-de-bloc";
    },
  },
  {
    id: "go-actions-ia",
    phrases: ["ouvrir actions ia", "aller aux actions ia", "système embarqué", "actions ia"],
    description: "Ouvrir Actions IA",
    category: "navigation",
    action: () => {
      window.location.href = "/actions-ia";
    },
  },
];

const SYSTEM_COMMANDS: VoiceCommand[] = [
  {
    id: "scroll-down",
    phrases: ["défiler vers le bas", "descendre", "voir plus", "plus bas"],
    description: "Défiler vers le bas",
    category: "system",
    action: () => {
      window.scrollBy({ top: 300, behavior: "smooth" });
    },
  },
  {
    id: "scroll-up",
    phrases: ["défiler vers le haut", "remonter", "retour en haut", "haut"],
    description: "Défiler vers le haut",
    category: "system",
    action: () => {
      window.scrollBy({ top: -300, behavior: "smooth" });
    },
  },
  {
    id: "go-top",
    phrases: ["aller en haut de page", "retour en haut de page", "tout en haut"],
    description: "Aller en haut de page",
    category: "system",
    action: () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  },
  {
    id: "refresh",
    phrases: ["actualiser la page", "recharger", "rafraîchir"],
    description: "Actualiser la page",
    category: "system",
    action: () => {
      window.location.reload();
    },
  },
  {
    id: "stop-speaking",
    phrases: ["tais-toi", "arrête de parler", "stop lecture", "silence"],
    description: "Arrêter la lecture vocale",
    category: "system",
    action: () => {
      window.speechSynthesis?.cancel();
    },
  },
];

function createActionCommands(ctx: VoiceCommandContext): VoiceCommand[] {
  const commands: VoiceCommand[] = [
    ...NAVIGATION_COMMANDS,
    ...SYSTEM_COMMANDS,
  ];

  if (ctx.currentPage === "rapports") {
    commands.push(
      {
        id: "report-new",
        phrases: ["nouveau rapport", "ajouter un rapport", "créer un rapport"],
        description: "Créer un nouveau rapport",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="new-report"]');
          btn?.click();
        },
      },
      {
        id: "report-export",
        phrases: ["exporter le rapport", "télécharger le rapport"],
        description: "Exporter le rapport",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="export-report"]');
          btn?.click();
        },
      },
      {
        id: "report-send",
        phrases: ["envoyer le rapport", "transmettre le rapport"],
        description: "Envoyer le rapport",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="send-report"]');
          btn?.click();
        },
      }
    );
  }

  if (ctx.currentPage === "etat-des-lieux") {
    commands.push(
      {
        id: "etat-send",
        phrases: ["envoyer le rapport", "transmettre l'état des lieux"],
        description: "Envoyer l'état des lieux",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="send-etat"]');
          btn?.click();
        },
      },
      {
        id: "etat-camera",
        phrases: ["ouvrir la caméra", "prendre une photo", "capturer"],
        description: "Ouvrir la caméra",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="camera-btn"]');
          btn?.click();
        },
      }
    );
  }

  if (ctx.currentPage === "q-r") {
    commands.push(
      {
        id: "qr-add",
        phrases: ["ajouter q r", "nouvelle question réponse", "ajouter une q r"],
        description: "Ajouter une Q/R",
        category: "action",
        action: () => {
          const questionInput = document.getElementById("question") as HTMLInputElement | null;
          if (questionInput) {
            questionInput.focus();
          }
        },
      },
      {
        id: "qr-clear",
        phrases: ["vider les q r", "supprimer toutes les q r"],
        description: "Vider toutes les Q/R",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="clear-qr"]');
          btn?.click();
        },
      },
      {
        id: "qr-send",
        phrases: ["envoyer les q r", "sauvegarder les q r"],
        description: "Envoyer les Q/R",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="send-qr"]');
          btn?.click();
        },
      }
    );
  }

  if (ctx.currentPage === "creer-procedure" || ctx.currentPage === "guide-procedure") {
    commands.push(
      {
        id: "proc-save",
        phrases: ["sauvegarder la procédure", "enregistrer la procédure"],
        description: "Sauvegarder la procédure",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="save-procedure"]');
          btn?.click();
        },
      },
      {
        id: "proc-export",
        phrases: ["exporter la procédure", "télécharger la procédure"],
        description: "Exporter la procédure",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="export-procedure"]');
          btn?.click();
        },
      }
    );
  }

  if (ctx.currentPage === "chat-ia") {
    commands.push(
      {
        id: "chat-clear",
        phrases: ["vider le chat", "effacer la conversation", "nouvelle conversation"],
        description: "Vider le chat",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="clear-chat"]');
          btn?.click();
        },
      },
      {
        id: "chat-copy-last",
        phrases: ["copier la dernière réponse", "copier la réponse"],
        description: "Copier la dernière réponse",
        category: "action",
        action: () => {
          const lastAssistant = document.querySelector('[data-role="assistant"] [data-testid="copy-btn"]');
          (lastAssistant as HTMLButtonElement | null)?.click();
        },
      }
    );
  }

  if (ctx.currentPage === "images") {
    commands.push(
      {
        id: "images-upload",
        phrases: ["ajouter une image", "importer une image", "nouvelle image"],
        description: "Ajouter une image",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="upload-image"]');
          btn?.click();
        },
      },
      {
        id: "images-camera",
        phrases: ["prendre une photo", "ouvrir la caméra"],
        description: "Prendre une photo",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="camera-image"]');
          btn?.click();
        },
      }
    );
  }

  if (ctx.currentPage === "video-conference") {
    commands.push(
      {
        id: "meeting-mute",
        phrases: ["couper le micro", "activer le micro", "micro"],
        description: "Couper/activer le micro",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="toggle-mic"]');
          btn?.click();
        },
      },
      {
        id: "meeting-video",
        phrases: ["couper la vidéo", "activer la vidéo", "vidéo"],
        description: "Couper/activer la vidéo",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="toggle-video"]');
          btn?.click();
        },
      },
      {
        id: "meeting-end",
        phrases: ["quitter l'appel", "fin de l'appel", "raccrocher"],
        description: "Quitter l'appel",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="end-call"]');
          btn?.click();
        },
      }
    );
  }

  if (ctx.currentPage === "rondier") {
    commands.push(
      {
        id: "rondier-incident",
        phrases: ["signaler un incident", "nouvel incident", "déclarer un incident"],
        description: "Signaler un incident",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="report-incident"]');
          btn?.click();
        },
      }
    );
  }

  if (ctx.currentPage === "admin" || ctx.currentPage === "admin/pipeline") {
    commands.push(
      {
        id: "admin-refresh",
        phrases: ["actualiser les données", "rafraîchir les stats"],
        description: "Actualiser les données",
        category: "action",
        action: () => {
          const btn = document.querySelector<HTMLButtonElement>('[data-testid="refresh-admin"]');
          btn?.click();
        },
      }
    );
  }

  return commands;
}

export function buildVoiceCommands(ctx: VoiceCommandContext): VoiceCommand[] {
  return createActionCommands(ctx);
}

export function matchVoiceCommand(
  transcript: string,
  ctx: VoiceCommandContext
): CommandMatchResult {
  const normalized = transcript.toLowerCase().trim();
  if (normalized.length < 3) return { matched: false };

  const commands = buildVoiceCommands(ctx);

  let bestMatch: VoiceCommand | null = null;
  let bestConfidence = 0;

  for (const cmd of commands) {
    for (const phrase of cmd.phrases) {
      const phraseLower = phrase.toLowerCase();
      if (normalized === phraseLower || normalized.includes(phraseLower) || phraseLower.includes(normalized)) {
        const confidence = phraseLower === normalized ? 1 : phraseLower.includes(normalized) ? 0.9 : 0.7;
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = cmd;
        }
      }
    }
  }

  if (bestMatch && bestConfidence >= 0.7) {
    return { matched: true, command: bestMatch, confidence: bestConfidence };
  }

  return { matched: false };
}
