"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Volume2, VolumeX, Play, Square, MessageSquare, Clock, AlertTriangle, CheckCircle2, Mic, MicOff } from "lucide-react";
import { useSpeech } from "@/lib/speech/use-speech";
import { DeviceService } from "@/lib/embedded/device-service";

interface VoiceOutputEntry {
  id: string;
  text: string;
  timestamp: Date;
  type: "result" | "alert" | "status" | "error";
}

interface VoiceOutputProps {
  deviceName: string;
  autoReadResults?: boolean;
}

export function VoiceOutput({ deviceName, autoReadResults = true }: VoiceOutputProps) {
  const [entries, setEntries] = useState<VoiceOutputEntry[]>([]);
  const { isSpeaking, speak, stopSpeaking, isListening, transcript, toggleListening } =
    useSpeech({ language: "fr-FR", continuous: false });

  const addEntry = useCallback(
    (text: string, type: VoiceOutputEntry["type"]) => {
      const entry: VoiceOutputEntry = {
        id: `${Date.now()}-${Math.random()}`,
        text,
        timestamp: new Date(),
        type,
      };
      setEntries((prev) => [entry, ...prev].slice(0, 50));

      if (autoReadResults && type !== "status") {
        speak(text);
      }
    },
    [speak, autoReadResults]
  );

  useEffect(() => {
    const service = new DeviceService("embarque-01");
    const unsub = service.onEvent((event) => {
      if (event.type === "sensor") {
        const { camera, microphone, temperature } = event.data;
        if (camera.motionDetected) {
          addEntry("Mouvement détecté sur la caméra.", "alert");
        }
        if (microphone.noiseDetected) {
          addEntry("Bruit anormal détecté par le microphone.", "alert");
        }
        if (temperature.alert) {
          addEntry(`Alerte température : seuil dépassé — ${temperature.current}°C détecté.`, "alert");
        }
      }
      if (event.type === "status") {
        addEntry(
          event.data.connected ? "Connexion rétablie avec le dispositif embarqué." : "Connexion perdue avec le dispositif.",
          "status"
        );
      }
      if (event.type === "actuator") {
        addEntry(
          `Actionneur ${event.data.name} : ${event.data.state === "active" ? "activé" : event.data.state === "error" ? "erreur" : "désactivé"}.`,
          "result"
        );
      }
    });

    service.connect();

    return () => {
      unsub();
      service.disconnect();
    };
  }, [addEntry]);

  const handleSimulateResult = useCallback(() => {
    addEntry("Résultat de la caméra : aucune anomalie détectée.", "result");
  }, [addEntry]);

  const handleSimulateAlert = useCallback(() => {
    addEntry("Alerte température : seuil dépassé — 38.2°C détecté.", "alert");
  }, [addEntry]);

  const handleSimulateError = useCallback(() => {
    addEntry("Erreur de communication avec le détecteur de température.", "error");
  }, [addEntry]);

  const handleSimulateStatus = useCallback(() => {
    addEntry("Tous les capteurs fonctionnent normalement.", "status");
  }, [addEntry]);

  const typeConfig = {
    result: { icon: Play, color: "text-primary", bg: "bg-primary/10", border: "border-l-primary", label: "Résultat", badge: "bg-primary/15 text-primary border-primary/30" },
    alert: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-l-amber-500", label: "Alerte", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
    error: { icon: Square, color: "text-red-500", bg: "bg-red-500/10", border: "border-l-red-500", label: "Erreur", badge: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" },
    status: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-l-emerald-500", label: "Statut", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  };

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="p-5 space-y-4 h-full flex flex-col flex-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2.5 text-foreground">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Volume2 className="h-4 w-4 text-primary" />
            </div>
            Sortie vocale — {deviceName}
          </h3>
          <div className="flex items-center gap-2">
            {isSpeaking && (
              <div className="flex items-center gap-0.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              isSpeaking ? "text-primary" : isListening ? "text-amber-600" : "text-muted-foreground"
            }`}>
              {isSpeaking ? "Parle..." : isListening ? "Écoute..." : "Prêt"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isListening ? "destructive" : "default"}
            size="sm"
            onClick={toggleListening}
            className="gap-1.5 text-xs h-8"
            aria-label={isListening ? "Arrêter l'écoute" : "Démarrer l'écoute"}
            aria-pressed={isListening}
          >
            {isListening ? (
              <>
                <MicOff className="h-3.5 w-3.5" />
                Arrêter
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" />
                Écouter
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={stopSpeaking}
            disabled={!isSpeaking}
            className="gap-1.5 text-xs h-8"
            aria-label="Arrêter la voix"
          >
            <VolumeX className="h-3.5 w-3.5" />
            Arrêter voix
          </Button>
          {isListening && transcript && (
            <Badge variant="secondary" className="text-[10px] animate-pulse border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
              {transcript}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={handleSimulateResult} className="text-[10px] gap-1 h-7 border-primary/20 hover:bg-primary/5 hover:text-primary">
            <Play className="h-3 w-3" />
            Résultat caméra
          </Button>
          <Button variant="outline" size="sm" onClick={handleSimulateAlert} className="text-[10px] gap-1 h-7 border-amber-500/20 hover:bg-amber-500/5 hover:text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            Alerte temp
          </Button>
          <Button variant="outline" size="sm" onClick={handleSimulateError} className="text-[10px] gap-1 h-7 border-red-500/20 hover:bg-red-500/5 hover:text-red-600">
            <Square className="h-3 w-3" />
            Erreur capteur
          </Button>
          <Button variant="outline" size="sm" onClick={handleSimulateStatus} className="text-[10px] gap-1 h-7 border-emerald-500/20 hover:bg-emerald-500/5 hover:text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            Statut OK
          </Button>
        </div>

        <ScrollArea className="h-[200px] rounded-xl border border-border/50 bg-muted/20 flex-1">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-6">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">Aucune sortie vocale</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Les alarmes et événements apparaîtront ici en temps réel</p>
            </div>
          ) : (
            <div className="p-3 space-y-2.5">
              {entries.map((entry) => {
                const config = typeConfig[entry.type];
                const Icon = config.icon;
                return (
                  <div
                    key={entry.id}
                    className={`border-l-2 ${config.border} pl-3 py-2.5 rounded-r-lg bg-background/60 backdrop-blur-sm transition-all hover:bg-background/90 border border-border/30`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`inline-flex h-5 w-5 items-center justify-center rounded-md ${config.bg}`}>
                        <Icon className={`h-3 w-3 ${config.color}`} />
                      </div>
                      <Badge variant="outline" className={`text-[8px] px-2 py-0.5 font-bold ${config.badge}`}>
                        {config.label}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground flex items-center gap-1 ml-auto">
                        <Clock className="h-2.5 w-2.5" />
                        {entry.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed pl-7 font-medium">{entry.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}