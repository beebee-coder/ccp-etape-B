"use client";

import { TStep } from "@/lib/procedures/services/validator.service";
import { GuidePhase } from "@/lib/procedures/types";
import { proceduresFR } from "@/lib/i18n/procedures";

export type SpeechStatus = "idle" | "listening" | "speaking" | "error";

export function buildStepScript(
  step: TStep,
  stepIndex: number,
  totalSteps: number,
  phase?: GuidePhase
): string {
  const parts: string[] = [];

  if (phase === "briefing") {
    parts.push("Briefing de la procédure.");
    if (step.title) parts.push(`Objectif : ${step.title}.`);
    if (step.instructions) parts.push(step.instructions);
    return parts.join(" ");
  }

  if (phase === "prerequisites") {
    parts.push("Vérifiez les prérequis suivants avant de démarrer.");
    return parts.join(" ");
  }

  parts.push(`Étape ${stepIndex + 1} sur ${totalSteps}.`);
  if (step.title) parts.push(phase ? `${step.title}.` : `Titre : ${step.title}.`);
  if (step.subtitle) parts.push(phase ? `${step.subtitle}.` : `Sous-titre : ${step.subtitle}.`);
  if (step.instructions) parts.push(phase ? `${step.instructions}.` : `Instructions : ${step.instructions}.`);
  if (step.isMandatory) {
    parts.push(phase ? "Étape obligatoire." : "Cette étape est obligatoire et ne peut pas être ignorée.");
  }
  if (step.timerEnabled && step.timerSeconds > 0) {
    const mins = Math.floor(step.timerSeconds / 60);
    const secs = step.timerSeconds % 60;
    if (phase) {
      parts.push(`Chronomètre : ${mins} minute${mins > 1 ? "s" : ""}${secs > 0 ? ` et ${secs} seconde${secs > 1 ? "s" : ""}` : ""}.`);
    } else {
      parts.push(`Chronomètre activé : durée maximale ${mins} minute${mins > 1 ? "s" : ""}${secs > 0 ? ` et ${secs} seconde${secs > 1 ? "s" : ""}` : ""}.`);
    }
  }
  if (step.mediaRequirements.length > 0) {
    if (phase) {
      parts.push("Captures requises :");
      step.mediaRequirements.forEach((m) => {
        parts.push(`${m.type}${m.mandatory ? " obligatoire" : ""}.`);
      });
    } else {
      const mediaList = step.mediaRequirements
        .map((m) => {
          const parts: string[] = [];
          parts.push(proceduresFR.media[m.type] || m.type);
          if (m.mandatory) parts.push("obligatoire");
          if (m.options?.geolocation) parts.push("avec géolocalisation");
          if (m.options?.timestamp) parts.push("avec horodatage");
          return parts.join(" ");
        })
        .join(", ");
      parts.push(`Captures requises : ${mediaList}.`);
    }
  }
  if (step.alarms.length > 0) {
    if (phase) {
      parts.push(`${step.alarms.length} alerte(s) configurée(s).`);
      step.alarms.forEach((alarm) => {
        parts.push(`Alerte ${alarm.type} : ${alarm.message}.`);
      });
    } else {
      parts.push(`Attention : ${step.alarms.length} alerte(s) configurée(s) sur cette étape.`);
      step.alarms.forEach((alarm) => {
        parts.push(
          `Alerte ${alarm.type} : ${alarm.condition}${alarm.threshold ? ` (seuil ${alarm.threshold})` : ""}. Message : ${alarm.message}.`
        );
      });
    }
  }
  return parts.join(" ");
}
