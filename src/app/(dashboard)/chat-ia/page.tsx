"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { useSpeech } from "@/lib/speech/use-speech";
import { cn } from "@/lib/utils";
import { getCsrfTokenClient } from "@/lib/auth/cookies";
import {
  Send,
  Mic,
  MicOff,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  Bot,
  Sparkles,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHAT_STORAGE_KEY = "chat-ia-messages";

type StoredMessage = Omit<Message, "timestamp"> & { timestamp: string };

export default function ChatIAPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isListening,
    transcript,
    stopListening,
    speak,
    stopSpeaking,
    toggleListening,
  } = useSpeech({ language: "fr-FR", continuous: false });

  // Load session messages safely after mount (avoids SSR crash)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return;
      const parsed: StoredMessage[] = JSON.parse(raw);
      const loaded: Message[] = parsed.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
      if (loaded.length > 0) setMessages(loaded);
    } catch {
      // sessionStorage unavailable or corrupt — ignore
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = area;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
    };
    area.addEventListener("scroll", handleScroll);
    return () => area.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (transcript && voiceMode) {
      setInput(transcript);
    }
  }, [transcript, voiceMode]);

  const isMock =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mock") === "true";

  const fetchAIResponse = useCallback(
    async (userMessage: string): Promise<void> => {
      try {
        const csrfToken = getCsrfTokenClient();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (csrfToken) {
          headers["x-csrf-token"] = csrfToken;
        }
 
        const res = await fetch("/api/ai/chat/stream", {
          method: "POST",
          headers,
          body: JSON.stringify({ message: userMessage }),
        });

        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          const assistantId = `${Date.now()}-stream`;

          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              content: "",
              timestamp: new Date(),
            },
          ]);

          let buffer = "";
          let fullText = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(":")) continue;

              if (trimmed.startsWith("data: ")) {
                try {
                  const data = JSON.parse(trimmed.slice(6));
                  if (typeof data.text === "string") {
                    fullText += data.text;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId ? { ...m, content: fullText } : m
                      )
                    );
                  }
                } catch {
                  // ignore malformed SSE data
                }
              }
            }
          }

          if (voiceMode && fullText) {
            speak(fullText);
          }
          return;
        }
      } catch {
        // fallback to JSON below
      }

       setIsTyping(true);
       try {
         const csrfToken = getCsrfTokenClient();
         const headers: Record<string, string> = { "Content-Type": "application/json" };
         if (csrfToken) {
           headers["x-csrf-token"] = csrfToken;
         }
 
         const res = await fetch("/api/ai/chat", {
           method: "POST",
           headers,
           body: JSON.stringify({ message: userMessage }),
         });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Erreur lors de la génération de la réponse");
        }

        const data = await res.json();
        const response = data.data?.response || "Désolé, je n'ai pas pu générer de réponse.";

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: response,
            timestamp: new Date(),
          },
        ]);

        if (voiceMode) {
          speak(response);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Une erreur est survenue. Veuillez réessayer.";

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: errorMessage,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [voiceMode, speak]
  );

  const simulateResponse = useCallback(
    (userMessage: string) => {
      setIsTyping(true);

      setTimeout(() => {
        let response = "";
        const lower = userMessage.toLowerCase();

        if (
          lower.includes("créer") ||
          lower.includes("procedure") ||
          lower.includes("procédure")
        ) {
          response =
            "Pour créer une procédure, rendez-vous sur la page dédiée et suivez les 3 étapes : définir le déclencheur, ajouter des actions, puis tester et publier.";
        } else if (
          lower.includes("prix") ||
          lower.includes("tarif") ||
          lower.includes("abonnement")
        ) {
          response =
            "Nos tarifs : Starter gratuit, Pro à 49$/mois, Enterprise sur mesure. Plus d'infos sur la page Pricing.";
        } else if (
          lower.includes("connecter") ||
          lower.includes("intégration") ||
          lower.includes("outil")
        ) {
          response =
            "NexaFlow supporte plus de 200 intégrations natives : Slack, GitHub, Notion, Linear, et bien d'autres. Un SDK est aussi disponible pour vos outils custom.";
        } else if (
          lower.includes("bonjour") ||
          lower.includes("salut") ||
          lower.includes("hello")
        ) {
          response =
            "Bonjour ! Je suis là pour vous aider. Posez-moi vos questions sur NexaFlow.";
        } else {
          response =
            "Je comprends votre demande. Pour aller plus loin, je vous invite à consulter notre section Q/R ou à contacter notre support.";
        }

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: response,
            timestamp: new Date(),
          },
        ]);
        setIsTyping(false);

        if (voiceMode) {
          speak(response);
        }
      }, 1200);
    },
    [voiceMode, speak]
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setVoiceMode(false);
    stopListening();

    if (isMock) {
      simulateResponse(trimmed);
    } else {
      fetchAIResponse(trimmed);
    }
  }, [input, fetchAIResponse, simulateResponse, stopListening, isMock]);

  useEffect(() => {
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setVoiceMode(false);
    stopListening();
    stopSpeaking();
    sessionStorage.removeItem(CHAT_STORAGE_KEY);
  }, [stopListening, stopSpeaking]);

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleVoiceToggle = useCallback(() => {
    if (voiceMode) {
      setVoiceMode(false);
      stopListening();
    } else {
      setVoiceMode(true);
      toggleListening();
    }
  }, [voiceMode, toggleListening, stopListening]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <section className="flex flex-1 flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="relative flex-shrink-0">
        {/* Glassmorphism background */}
        <div className="absolute inset-0 bg-background/85 backdrop-blur-xl" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        <div className="relative mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Left — Logo + Status */}
          <div className="flex items-center gap-3">
            {/* Animated logo */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-xl bg-primary/25 blur-md animate-glow-pulse" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/25 shadow-3d-sm">
                <NexaFlowLogo className="h-5 w-5" />
              </div>
            </div>

            <div>
              <h1 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                Assistant IA
                <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <p className="text-[10px] text-muted-foreground font-medium">En ligne · Réponse instantanée</p>
              </div>
            </div>
          </div>

          {/* Right — Clear button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-xl border border-transparent",
              "hover:bg-destructive/10 hover:border-destructive/20",
              "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm",
              "active:translate-y-0 group"
            )}
            onClick={handleClearChat}
            title="Effacer la conversation"
          >
            <Trash2 className="h-4 w-4 text-foreground/50 group-hover:text-destructive transition-colors" />
          </Button>
        </div>
      </header>

      {/* ── Chat Body ── */}
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden relative">

        {/* Messages area */}
        <ScrollArea className="flex-1 px-4 py-6 sm:px-6" ref={scrollAreaRef}>
          {/* Empty state */}
          {messages.length === 0 && !isTyping && (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-slide-in-3d">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-glow-pulse" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-purple-500/10 to-blue-500/10 border border-primary/20 shadow-3d">
                  <Bot className="h-10 w-10 text-primary" />
                </div>
              </div>
              <h2 className="text-xl font-bold gradient-text mb-2">Comment puis-je vous aider ?</h2>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Posez vos questions sur NexaFlow. Je suis là pour vous guider.
              </p>

              {/* Quick prompt pills */}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {["Créer une procédure", "Voir les intégrations", "Nos tarifs"].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                    className={cn(
                      "rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5",
                      "text-xs font-medium text-primary/80",
                      "hover:bg-primary/15 hover:border-primary/30 hover:text-primary",
                      "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm",
                      "active:translate-y-0"
                    )}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 pb-4">
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              const showAvatar =
                !isUser &&
                (index === 0 || messages[index - 1].role !== "assistant");

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-end gap-2",
                    isUser ? "flex-row-reverse animate-message-in-right" : "flex-row animate-message-in-left",
                    showAvatar ? "mt-4" : "mt-1"
                  )}
                >
                  {/* Avatar */}
                  {showAvatar ? (
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md" />
                      <Avatar className="relative h-8 w-8 shadow-3d-sm">
                        <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20 text-primary text-xs">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  ) : (
                    <div className="w-8 flex-shrink-0" />
                  )}

                  {/* Message bubble */}
                  <div
                    className={cn(
                      "group flex flex-col max-w-[85%] sm:max-w-[72%]",
                      isUser ? "items-end" : "items-start"
                    )}
                  >
                    {/* Bubble */}
                    <div
                      className={cn(
                        "relative px-4 py-3 text-sm leading-relaxed",
                        "transition-all duration-200 group-hover:-translate-y-0.5",
                        isUser
                          ? [
                              "bg-gradient-to-br from-primary to-purple-600",
                              "text-white rounded-3xl rounded-br-sm",
                              "shadow-3d shadow-primary/25",
                              "border border-primary/30",
                            ].join(" ")
                          : [
                              "bg-card/80 border border-border/50",
                              "text-foreground rounded-3xl rounded-bl-sm",
                              "shadow-3d-sm backdrop-blur-sm",
                              "dark:bg-card/60 dark:border-border/30",
                            ].join(" ")
                      )}
                    >
                      {/* Shimmer overlay for user messages */}
                      {isUser && (
                        <div className="absolute inset-0 rounded-3xl rounded-br-sm overflow-hidden pointer-events-none">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        </div>
                      )}
                      <div className="relative whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                    </div>

                    {/* Footer: time + check + copy */}
                    <div
                      className={cn(
                        "flex items-center gap-1.5 mt-1 px-1",
                        isUser ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatTime(message.timestamp)}
                      </span>
                      {isUser && (
                        <Check className="h-3 w-3 text-primary/40" />
                      )}
                    </div>

                    {/* Copy button for assistant messages */}
                    {!isUser && (
                      <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className={cn(
                            "h-6 w-6 rounded-lg border border-transparent",
                            "hover:bg-primary/10 hover:border-primary/20",
                            "transition-all duration-150"
                          )}
                          onClick={() => handleCopy(message.id, message.content)}
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-end gap-2 mt-4 animate-message-in-left">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 rounded-xl bg-primary/15 blur-md" />
                  <Avatar className="relative h-8 w-8 shadow-3d-sm">
                    <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20 text-primary text-xs">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className={cn(
                  "px-4 py-3 rounded-3xl rounded-bl-sm",
                  "bg-card/80 border border-border/50 shadow-3d-sm backdrop-blur-sm"
                )}>
                  <div className="flex items-center gap-1.5">
                    <span className="typing-dot h-2 w-2 rounded-full bg-primary/60" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-primary/60" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-primary/60" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
            <Button
              variant="secondary"
              size="sm"
              className={cn(
                "h-8 w-8 rounded-full p-0 shadow-3d",
                "bg-background/90 border border-border/60 backdrop-blur",
                "hover:-translate-y-0.5 hover:shadow-3d-lg transition-all duration-200",
                "active:translate-y-0"
              )}
              onClick={scrollToBottom}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ── Input area ── */}
        <div className="relative flex-shrink-0">
          {/* Top fade gradient */}
          <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-background/60 to-transparent pointer-events-none" />

          <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl px-4 py-3 sm:px-6 pb-5">
            <div className="mx-auto max-w-2xl">
              {/* Input wrapper with 3D focus effect */}
              <div
                className={cn(
                  "relative flex items-center rounded-2xl border transition-all duration-300",
                  "bg-card/60 backdrop-blur-sm",
                  isFocused
                    ? "border-primary/50 shadow-primary-glow"
                    : "border-border/60 shadow-3d-sm hover:border-border"
                )}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Écrivez votre message..."
                  className={cn(
                    "flex-1 bg-transparent px-4 py-3 text-sm",
                    "placeholder:text-muted-foreground/50 text-foreground",
                    "focus:outline-none focus-visible:outline-none",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                />

                {/* Buttons inside input */}
                <div className="flex items-center gap-1 pr-2">
                  {/* Mic button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-xl border border-transparent",
                      "transition-all duration-200",
                      isListening
                        ? "bg-red-500/10 border-red-500/30 text-red-500 animate-glow-pulse"
                        : "hover:bg-primary/10 hover:border-primary/20 text-muted-foreground hover:text-primary"
                    )}
                    onClick={handleVoiceToggle}
                    title={voiceMode ? "Arrêter l'écoute" : "Mode vocal"}
                  >
                    {isListening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>

                  {/* Send button */}
                  <Button
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-xl transition-all duration-200",
                      "bg-gradient-to-br from-primary to-purple-600",
                      "border border-primary/30 shadow-3d-sm",
                      "hover:-translate-y-0.5 hover:shadow-primary-glow",
                      "active:translate-y-0 active:shadow-3d-sm",
                      "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-3d-sm"
                    )}
                    onClick={handleSend}
                    disabled={!input.trim()}
                  >
                    <Send className="h-3.5 w-3.5 text-white" />
                  </Button>
                </div>
              </div>

              <p className="mt-2 text-center text-[10px] text-muted-foreground/40">
                Entrée pour envoyer · Mode vocal disponible
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}