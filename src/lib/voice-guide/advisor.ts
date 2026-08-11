const GUIDANCE_API_URL = "/api/voice-guide/guidance";

interface FieldGuidanceOptions {
  fieldLabel: string;
  fieldType: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  formContext?: string;
  currentValue?: string;
  isFirstField?: boolean;
  isLastField?: boolean;
  filledCount?: number;
  totalFields?: number;
}

export async function generateFieldGuidance(options: FieldGuidanceOptions): Promise<string> {
  const {
    fieldLabel,
    fieldType,
    placeholder,
    required,
    helpText,
    formContext,
    currentValue,
    isFirstField,
    isLastField,
    filledCount,
    totalFields,
  } = options;

  const prompt = buildGuidancePrompt({
    fieldLabel,
    fieldType,
    placeholder,
    required,
    helpText,
    formContext,
    currentValue,
    isFirstField,
    isLastField,
    filledCount,
    totalFields,
  });

  try {
    const res = await fetch(GUIDANCE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ prompt, context: formContext }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.guidance && typeof data.guidance === "string") {
        return cleanGuidance(data.guidance);
      }
    }
  } catch {
    // fallback below
  }

  return buildFallbackGuidance({
    fieldLabel,
    fieldType,
    required,
    isFirstField,
    isLastField,
    filledCount,
    totalFields,
  });
}

export async function generateTransitionGuidance(
  fromField: string,
  toField: string,
  formContext?: string
): Promise<string> {
  const prompt = `L'utilisateur vient de remplir le champ "${fromField}". Passe maintenant au champ "${toField}". Donne une brève transition naturelle (1 phrase) pour l'inviter à remplir le nouveau champ. Contexte : ${formContext || "formulaire général"}. Réponds UNIQUEMENT par la phrase de transition, sans guillemets.`;

  try {
    const res = await fetch(GUIDANCE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ prompt, context: formContext }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.guidance && typeof data.guidance === "string") {
        return cleanGuidance(data.guidance);
      }
    }
  } catch {
    // fallback
  }

  return `Parfait. Maintenant, ${toField.toLowerCase()}.`;
}

export async function generateCompletionMessage(
  formName: string,
  filledCount: number
): Promise<string> {
  const prompt = `L'utilisateur a terminé de remplir le formulaire "${formName}" avec ${filledCount} champ(s). Donne un message de confirmation bref et encourageant (1 phrase). Réponds UNIQUEMENT par le message.`;

  try {
    const res = await fetch(GUIDANCE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ prompt }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.guidance && typeof data.guidance === "string") {
        return cleanGuidance(data.guidance);
      }
    }
  } catch {
    // fallback
  }

  return `Excellent ! Le formulaire ${formName} est complet. Vous pouvez maintenant l'envoyer.`;
}

export async function generateValidationMessage(
  fieldLabel: string,
  issue: string
): Promise<string> {
  const prompt = `L'utilisateur a saisi une valeur incorrecte dans le champ "${fieldLabel}". Problème : ${issue}. Donne un message d'erreur vocal clair et bienveillant (1 phrase) pour lui demander de corriger. Réponds UNIQUEMENT par le message.`;

  try {
    const res = await fetch(GUIDANCE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ prompt }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.guidance && typeof data.guidance === "string") {
        return cleanGuidance(data.guidance);
      }
    }
  } catch {
    // fallback
  }

  return `Le champ ${fieldLabel} semble incorrect. ${issue}. Veuillez corriger et réessayer.`;
}

function buildGuidancePrompt(opts: FieldGuidanceOptions): string {
  const parts: string[] = [`Guide l'utilisateur pour remplir le champ suivant :`];
  parts.push(`Champ : ${opts.fieldLabel}`);
  parts.push(`Type : ${opts.fieldType}`);
  if (opts.placeholder) parts.push(`Exemple attendu : ${opts.placeholder}`);
  if (opts.required) parts.push("Ce champ est obligatoire.");
  if (opts.helpText) parts.push(`Aide : ${opts.helpText}`);
  if (opts.currentValue) parts.push(`Valeur actuelle : ${opts.currentValue}`);
  if (opts.formContext) parts.push(`Contexte du formulaire : ${opts.formContext}`);

  const positionParts: string[] = [];
  if (opts.isFirstField) positionParts.push("premier champ du formulaire");
  if (opts.isLastField) positionParts.push("dernier champ du formulaire");
  if (opts.filledCount !== undefined && opts.totalFields !== undefined) {
    positionParts.push(`champ ${opts.filledCount + 1} sur ${opts.totalFields}`);
  }
  if (positionParts.length > 0) {
    parts.push(`Position : ${positionParts.join(", ")}`);
  }

  parts.push("Donne une instruction vocale claire (1-2 phrases max).");
  parts.push("Réponds UNIQUEMENT par l'instruction, sans guillemets ni préfixe.");

  return parts.join("\n");
}

function buildFallbackGuidance(opts: FieldGuidanceOptions): string {
  const { fieldLabel, fieldType, required, isFirstField, isLastField, filledCount, totalFields } = opts;

  const prefix = isFirstField
    ? "Commençons par "
    : isLastField
    ? "Enfin, "
    : filledCount !== undefined && totalFields !== undefined
    ? `Champ ${filledCount + 1} sur ${totalFields}. `
    : "";

  const typeHints: Record<string, string> = {
    text: `Dictes naturellement le contenu pour "${fieldLabel}".`,
    textarea: `Dictes votre texte pour "${fieldLabel}". Vous pouvez faire une phrase complète.`,
    email: `Dictes votre adresse email pour "${fieldLabel}".`,
    password: `Dictes votre mot de passe pour "${fieldLabel}".`,
    number: `Dictes un nombre pour "${fieldLabel}".`,
    select: `Choisissez une option pour "${fieldLabel}".`,
    checkbox: `Cochez la case "${fieldLabel}" si nécessaire.`,
    file: `Préparez votre fichier pour "${fieldLabel}".`,
    date: `Dictes la date pour "${fieldLabel}".`,
  };

  const suffix = required ? " Ce champ est obligatoire." : "";

  return `${prefix}${typeHints[fieldType] || `Remplissez le champ "${fieldLabel}".`}${suffix}`;
}

function cleanGuidance(text: string): string {
  return text
    .replace(/^[""'']|[""'']$/g, "")
    .replace(/^\s*[-•]\s*/, "")
    .replace(/^(Assistant:|Guide:|IA:)\s*/i, "")
    .trim();
}
