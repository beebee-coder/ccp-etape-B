"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  MessageSquare,
  Users,
  PhoneOff,
  Settings,
  Send,
  MoreVertical,
  ScreenShare,
  Copy,
  Clock,
} from "lucide-react";

const participants = [
  { id: 1, name: "Admin User", email: "admin@nexaflow.com", initials: "AD", isSelf: true, isMuted: false, isVideoOn: true },
  { id: 2, name: "Alice Martin", email: "alice@exemple.com", initials: "AM", isSelf: false, isMuted: true, isVideoOn: true },
  { id: 3, name: "Bob Dupont", email: "bob@exemple.com", initials: "BD", isSelf: false, isMuted: false, isVideoOn: false },
  { id: 4, name: "Claire Leroy", email: "claire@exemple.com", initials: "CL", isSelf: false, isMuted: true, isVideoOn: true },
];

const chatMessages = [
  { id: 1, user: "Alice Martin", text: "Pouvez-vous partager votre écran ?", time: "14:32" },
  { id: 2, user: "Admin User", text: "Oui, je lance le partage.", time: "14:33" },
  { id: 3, user: "Bob Dupont", text: "Merci, je regarde.", time: "14:33" },
];

export default function VideoConferencePage() {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState(chatMessages);
  const [callDuration, setCallDuration] = useState("00:00:00");

  const mountTimeRef = useRef<Date | null>(null);

  const formatDuration = useCallback((elapsed: number) => {
    const totalSeconds = Math.floor(elapsed / 1000);
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, []);

  useEffect(() => {
    mountTimeRef.current = new Date();
    const interval = setInterval(() => {
      if (mountTimeRef.current) {
        const elapsed = Date.now() - mountTimeRef.current.getTime();
        setCallDuration(formatDuration(elapsed));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [formatDuration]);

  return (
    <section className="flex h-[calc(100vh-4rem)] flex-col">
      {/* ── Page Header ── */}
      <header className="relative flex-shrink-0">
        <div className="absolute inset-0 bg-background/85 backdrop-blur-xl" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="relative mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="icon-glow">
              <div className="icon-inner h-10 w-10">
                <Video className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-bold gradient-text flex items-center gap-1.5">
                Visioconférence
                <Badge
                  variant="secondary"
                  className="text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                >
                  En direct
                </Badge>
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="h-3 w-3 text-muted-foreground/60" />
                <span className="text-[10px] font-mono text-muted-foreground">
                  {callDuration}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-xl border border-transparent",
              "hover:bg-destructive/10 hover:border-destructive/20",
              "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm",
              "active:translate-y-0 group"
            )}
            onClick={() => alert("Fin de l'appel")}
            title="Raccrorir"
          >
            <PhoneOff className="h-4 w-4 text-foreground/50 group-hover:text-destructive transition-colors" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Video Grid ── */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4">
            <div
              className="grid h-full gap-3 rounded-2xl border border-border/50 bg-muted/10 p-1"
              style={{ gridTemplateColumns: "repeat(2, 1fr)", gridTemplateRows: "repeat(2, 1fr)" }}
            >
              {participants.map((p) => (
                <Card
                  key={p.id}
                  className={cn(
                    "relative overflow-hidden rounded-xl border border-border/40",
                    "bg-gradient-to-br from-muted/30 to-muted/10",
                    p.isSelf && "ring-2 ring-primary/30"
                  )}
                >
                  {p.isVideoOn ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-purple-500/10 text-2xl font-semibold text-primary">
                        {p.initials}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary">
                        {p.initials}
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white drop-shadow-md">
                        {p.name}
                      </span>
                      {p.isSelf && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-4 px-1 bg-primary/10 text-primary border-primary/20"
                        >
                          Vous
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {p.isMuted && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/80">
                          <MicOff className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {!p.isVideoOn && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/80">
                          <VideoOff className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* ── Controls bar ── */}
          <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl px-4 py-3">
            <div className="mx-auto max-w-4xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-mono text-muted-foreground">
                  {callDuration}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={isMuted ? "destructive" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>

                <Button
                  variant={isVideoOn ? "secondary" : "destructive"}
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40"
                  onClick={() => setIsVideoOn(!isVideoOn)}
                >
                  {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>

                <Button
                  variant={isScreenSharing ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40"
                  onClick={() => setIsScreenSharing(!isScreenSharing)}
                >
                  <ScreenShare className="h-5 w-5" />
                </Button>

                <Button
                  variant={showChat ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40"
                  onClick={() => setShowChat(!showChat)}
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>

                <Button
                  variant={showParticipants ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40"
                  onClick={() => setShowParticipants(!showParticipants)}
                >
                  <Users className="h-5 w-5" />
                </Button>

                <Button
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40"
                  onClick={() => alert("Paramètres de la réunion")}
                >
                  <Settings className="h-5 w-5" />
                </Button>

                <Button
                  variant="destructive"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40 bg-rose-500/20 hover:bg-rose-500/30"
                  onClick={() => alert("Fin de l'appel")}
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Chat sidebar ── */}
        {showChat && (
          <div className="w-80 border-l border-border/50 bg-card/80 backdrop-blur-sm flex flex-col">
            <div className="border-b border-border/50 px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Chat de la réunion</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{msg.user}</span>
                    <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-0">{msg.text}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-border/50 p-3">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = newMessage.trim();
                  if (!trimmed) return;
                  const now = new Date();
                  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
                  setMessages((prev) => [...prev, { id: Date.now(), user: "Admin User", text: trimmed, time }]);
                  setNewMessage("");
                }}
              >
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Écrire un message..."
                  className="h-9 text-sm bg-background/60 border-border/60 rounded-xl focus:border-primary/50 transition-all duration-200"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-r from-primary to-purple-600 border border-primary/30 shadow-3d-sm text-white hover:-translate-y-0.5 hover:shadow-primary-glow transition-all duration-200 active:translate-y-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* ── Participants sidebar ── */}
        {showParticipants && (
          <div className="w-72 border-l border-border/50 bg-card/80 backdrop-blur-sm flex flex-col">
            <div className="border-b border-border/50 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Participants ({participants.length})
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {p.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.isMuted && <MicOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    {!p.isVideoOn && <VideoOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border/50 p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200"
                onClick={() => {
                  const inviteLink = "https://nexaflow.com/meeting/abc123";
                  navigator.clipboard?.writeText(inviteLink).then(
                    () => alert("Lien copié !"),
                    () => alert(`Lien : ${inviteLink}`)
                  );
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copier le lien d&apos;invitation
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
