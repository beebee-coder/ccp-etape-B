import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const AI_TIMEOUT_MS = 30000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${AI_TIMEOUT_MS}ms`)), AI_TIMEOUT_MS)
    ),
  ]);
}

const SYSTEM_PROMPT = `Tu es un assistant IA pour NexaFlow, une plateforme de gestion de procédures industrielles et d'automatisation. Tu aides les utilisateurs à créer des procédures, comprendre les intégrations, et utiliser la plateforme. Réponds toujours en français, de manière concise et professionnelle.`;

export type Provider = "groq" | "gemini" | "none";

export interface StreamEvent {
  event: "token" | "done";
  data: { text: string; provider: Provider };
}

function getGroqClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  try {
    return new Groq({ apiKey });
  } catch {
    return null;
  }
}

function getGenAIClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) return null;
  try {
    return new GoogleGenerativeAI(apiKey);
  } catch {
    return null;
  }
}

function isProviderAvailable(): boolean {
  return !!process.env.GROQ_API_KEY || !!process.env.GOOGLE_GENAI_API_KEY;
}

function generateMockResponse(message: string, context?: string): string {
  const contextHint = context ? ` (contexte: ${context})` : "";
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("étape") || lowerMessage.includes("procédure")) {
    return `Concernant l'étape demandée${contextHint}, assurez-vous de suivre les instructions de la phase en cours. Vérifiez les prérequis avant de procéder et respectez les dépendances entre étapes.`;
  }

  if (lowerMessage.includes("sécurité") || lowerMessage.includes("alarme")) {
    return `Pour les points de sécurité${contextHint}, vérifiez que toutes les alarmes sont configurées correctement et que les mesures de protection sont en place avant toute intervention.`;
  }

  if (lowerMessage.includes("donnée") || lowerMessage.includes("saisie")) {
    return `Pour la saisie de données${contextHint}, assurez-vous que toutes les valeurs sont correctes et conformes aux spécifications de l'étape. Vérifiez les unités et les plages acceptables.`;
  }

  if (lowerMessage.includes("inspection") || lowerMessage.includes("visuel")) {
    return `Pour l'inspection visuelle${contextHint}, examinez attentivement les éléments requis et documentez vos observations. Signalez toute anomalie détectée.`;
  }

  if (lowerMessage.includes("mesure") || lowerMessage.includes("numérique")) {
    return `Pour la mesure numérique${contextHint}, utilisez les instruments appropriés et enregistrez les valeurs avec les unités correspondantes. Comparez avec les seuils définis.`;
  }

  return `Je peux vous aider avec votre demande${contextHint}. Voici les points clés à retenir pour cette étape: assurez-vous de respecter les instructions de la phase en cours, vérifiez les dépendances et les alarmes configurées, et documentez vos actions.`;
}

function generateMockStreamResponse(
  message: string,
  context: string | undefined,
  onEvent: (event: StreamEvent) => void
): void {
  const response = generateMockResponse(message, context);
  const words = response.split(" ");
  let i = 0;
  const interval = setInterval(() => {
    if (i >= words.length) {
      clearInterval(interval);
      onEvent({ event: "done", data: { text: response, provider: "none" } });
      return;
    }
    onEvent({ event: "token", data: { text: words[i] + " ", provider: "none" } });
    i++;
  }, 30);
}

export async function generateAIStreamResponse(
  message: string,
  onEvent: (event: StreamEvent) => void,
  context?: string
): Promise<Provider> {
  if (!isProviderAvailable()) {
    generateMockStreamResponse(message, context, onEvent);
    return "none";
  }

  const groqClient = getGroqClient();

  if (groqClient) {
    try {
      const completion = await withTimeout(
        groqClient.chat.completions.create({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...(context
              ? [
                  {
                    role: "system" as const,
                    content: `Contexte utilisateur: ${context}`,
                  },
                ]
              : []),
            { role: "user", content: message },
          ],
          model: "llama3-70b-8192",
          temperature: 0.7,
          max_tokens: 1024,
          stream: true,
        }),
        "Groq stream API"
      );

      let fullText = "";
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          onEvent({ event: "token", data: { text: delta, provider: "groq" } });
        }
      }

      onEvent({ event: "done", data: { text: fullText, provider: "groq" } });
      return "groq";
    } catch (error) {
      console.error("GROQ stream error:", error);
    }
  }

  const genAIClient = getGenAIClient();

  if (genAIClient) {
    try {
      const model = genAIClient.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt =
        context && typeof context === "string"
          ? `${SYSTEM_PROMPT}\n\nContexte: ${context}\n\nUtilisateur: ${message}`
          : `${SYSTEM_PROMPT}\n\nUtilisateur: ${message}`;

      const result = await withTimeout(model.generateContentStream(prompt), "Gemini stream API");
      let fullText = "";
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullText += text;
          onEvent({ event: "token", data: { text, provider: "gemini" } });
        }
      }

      onEvent({ event: "done", data: { text: fullText, provider: "gemini" } });
      return "gemini";
    } catch (error) {
      console.error("Gemini stream error:", error);
    }
  }

  generateMockStreamResponse(message, context, onEvent);
  return "none";
}

export async function generateAIResponse(
  message: string,
  context?: string
): Promise<{ response: string; provider: Provider }> {
  if (!isProviderAvailable()) {
    return {
      response: generateMockResponse(message, context),
      provider: "none",
    };
  }

  const groqClient = getGroqClient();

  if (groqClient) {
    try {
      const completion = await withTimeout(
        groqClient.chat.completions.create({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...(context
              ? [
                  {
                    role: "system" as const,
                    content: `Contexte utilisateur: ${context}`,
                  },
                ]
              : []),
            { role: "user", content: message },
          ],
          model: "llama3-70b-8192",
          temperature: 0.7,
          max_tokens: 1024,
        }),
        "Groq API"
      );
      const text = completion.choices[0]?.message?.content;
      if (text) {
        return { response: text, provider: "groq" };
      }
    } catch (error) {
      console.error("GROQ provider error:", error);
    }
  }

  const genAIClient = getGenAIClient();

  if (genAIClient) {
    try {
      const model = genAIClient.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = context
        ? `${SYSTEM_PROMPT}\n\nContexte: ${context}\n\nUtilisateur: ${message}`
        : `${SYSTEM_PROMPT}\n\nUtilisateur: ${message}`;
      const result = await withTimeout(model.generateContent(prompt), "Gemini API");
      const response = await result.response;
      const text = response.text();
      if (text) {
        return { response: text, provider: "gemini" };
      }
    } catch (error) {
      console.error("Gemini provider error:", error);
    }
  }

  return {
    response: generateMockResponse(message, context),
    provider: "none",
  };
}
