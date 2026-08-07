import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("groq-sdk", () => {
  return {
    default: vi.fn().mockImplementation(function (config: { apiKey: string }) {
      return {
        _apiKey: config.apiKey,
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
      };
    }),
  };
});

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(function (apiKey: string) {
      return {
        _apiKey: apiKey,
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn(),
          generateContentStream: vi.fn(),
        }),
      };
    }),
  };
});

import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  generateAIResponse,
  generateAIStreamResponse,
  type Provider,
} from "@/lib/ai/providers";

const MockedGroq = vi.mocked(Groq);
const MockedGenAI = vi.mocked(GoogleGenerativeAI);

function makeGenAIContentResponse(text: string = "gemini response") {
  return {
    response: Promise.resolve({
      text: () => text,
    }),
  };
}

async function* makeGenAIStreamChunks(text: string = "gemini stream response") {
  yield { text: () => text };
}

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

type MockGroq = { _apiKey: string; chat: { completions: { create: ReturnType<typeof vi.fn> } } };
type MockGenAI = {
  _apiKey: string;
  getGenerativeModel: ReturnType<typeof vi.fn>;
};

function makeMockGenAI(apiKey: string): MockGenAI {
  const generateContent = vi.fn().mockResolvedValue(makeGenAIContentResponse());
  const generateContentStream = vi.fn().mockResolvedValue({
    stream: makeGenAIStreamChunks(),
  });
  return {
    _apiKey: apiKey,
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent,
      generateContentStream,
    }),
  };
}

function makeFailingGroq(apiKey: string): MockGroq {
  return {
    _apiKey: apiKey,
    chat: {
      completions: {
        create: vi.fn().mockRejectedValue(new Error("Groq API error")),
      },
    },
  };
}

describe("fallback behavior", () => {
  it("returns mock immediately when no API keys are set", async () => {
    const result = await generateAIResponse("étape procédure");

    expect(result.provider).toBe("none");
    expect(result.response).toContain("étape");
    expect(MockedGroq).not.toHaveBeenCalled();
    expect(MockedGenAI).not.toHaveBeenCalled();
  });

  it("returns mock immediately in streaming when no API keys are set", async () => {
    vi.useFakeTimers();

    const events: Array<{ event: string; provider: Provider }> = [];
    const promise = generateAIStreamResponse("sécurité", (e) =>
      events.push({ event: e.event, provider: e.data.provider })
    );

    await vi.advanceTimersByTimeAsync(2000);
    const provider = await promise;

    expect(provider).toBe("none");
    const doneEvent = events.find((e) => e.event === "done");
    expect(doneEvent?.provider).toBe("none");

    vi.useRealTimers();
  });

  it("falls back to Gemini when Groq is not configured", async () => {
    delete process.env.GROQ_API_KEY;
    process.env.GOOGLE_GENAI_API_KEY = "gemini-key";

    MockedGenAI.mockImplementation(function () {
      return makeMockGenAI("gemini-key") as unknown as GoogleGenerativeAI;
    });

    const result = await generateAIResponse("hello");

    expect(result.provider).toBe("gemini");
    expect(result.response).toBe("gemini response");
  });

  it("falls back to mock when Groq errors and no other provider is configured", async () => {
    process.env.GROQ_API_KEY = "key-1";

    MockedGroq.mockImplementationOnce(function () {
      return makeFailingGroq("key-1") as unknown as Groq;
    });

    const result = await generateAIResponse("hello");

    expect(result.provider).toBe("none");
    expect(MockedGroq).toHaveBeenCalledTimes(1);
    expect(MockedGenAI).not.toHaveBeenCalled();
  });
});
