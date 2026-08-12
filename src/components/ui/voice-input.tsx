"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSpeech } from "@/lib/speech/use-speech";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSend?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function VoiceInput({
  value,
  onChange,
  onSend,
  placeholder = "Écrivez ou parlez...",
  disabled = false,
  className,
}: VoiceInputProps) {
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const { isListening, error, startListening, stopListening } =
    useSpeech({ language: "fr-FR", continuous: false });

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening();
      setIsVoiceMode(false);
    } else {
      setIsVoiceMode(true);
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return (
    <div className={cn("relative flex items-center gap-1", className)}>
      <Input
        value={value}
        onChange={(e) => {
          onChange?.(e.target.value);
          if (isVoiceMode) {
            setIsVoiceMode(false);
            stopListening();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && onSend) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 bg-background/60 border-border/60 rounded-xl focus:border-primary/50 focus:shadow-primary-glow transition-all duration-200"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleVoiceToggle}
        disabled={disabled}
        className={cn(
          "h-8 w-8 rounded-xl border border-transparent transition-all duration-200",
          isListening
            ? "bg-red-500/10 border-red-500/30 text-red-500 animate-glow-pulse"
            : "hover:bg-primary/10 hover:border-primary/20 text-muted-foreground hover:text-primary"
        )}
        title={isListening ? "Arrêter l'écoute" : "Mode vocal"}
      >
        {isListening ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
      {error && <p className="text-[10px] text-destructive absolute -bottom-4 left-0">{error}</p>}
    </div>
  );
}
