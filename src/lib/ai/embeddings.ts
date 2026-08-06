import { GoogleGenerativeAI } from "@google/generative-ai";

export const EMBEDDING_DIMENSION = 384;

export async function getGoogleEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    const values = result.embedding?.values ?? [];
    return values.slice(0, EMBEDDING_DIMENSION);
  } catch {
    return null;
  }
}

export async function vectorize(text: string): Promise<number[]> {
  const embedding = await getGoogleEmbedding(text);
  if (embedding && embedding.length > 0) return embedding;
  const hash = Buffer.from(text).toString("base64");
  const vec = new Array(EMBEDDING_DIMENSION).fill(0);
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    const idx = (i * 7 + 3) % hash.length;
    vec[i] = hash.charCodeAt(idx) / 255;
  }
  return vec;
}
