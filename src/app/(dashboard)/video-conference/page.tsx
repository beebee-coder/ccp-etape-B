"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { meetingService } from "@/lib/meetings/meeting-service";
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
import { VoiceInput } from "@/components/ui/voice-input";

import type {
  Meeting,
  MeetingParticipant,
  MeetingChatMessage,
  AuthenticatedUser,
} from "@/lib/meetings/meeting-service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "video-conference-page" });

const FALLBACK_PARTICIPANTS: MeetingParticipant[] = [
  {
    id: "admin",
    name: "Admin User",
    email: "admin@nexaflow.com",
    initials: "AD",
    isSelf: true,
    isMuted: false,
    isVideoOn: true,
  },
  {
    id: "2",
    name: "Alice Martin",
    email: "alice@exemple.com",
    initials: "AM",
    isSelf: false,
    isMuted: true,
    isVideoOn: true,
  },
  {
    id: "3",
    name: "Bob Dupont",
    email: "bob@exemple.com",
    initials: "BD",
    isSelf: false,
    isMuted: false,
    isVideoOn: false,
  },
  {
    id: "4",
    name: "Claire Leroy",
    email: "claire@exemple.com",
    initials: "CL",
    isSelf: false,
    isMuted: true,
    isVideoOn: true,
  },
];

export default function VideoConferencePage() {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(
    null,
  );
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [messages, setMessages] = useState<MeetingChatMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [callDuration, setCallDuration] = useState("00:00:00");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const mountTimeRef = useRef<Date | null>(null);

  const formatDuration = useCallback((elapsed: number) => {
    const totalSeconds = Math.floor(elapsed / 1000);
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      log.debug("fetchCurrentUser: resolving authenticated user");
      const user = await meetingService.getCurrentUser();
      if (!user) {
        log.warn("fetchCurrentUser: no authenticated user found");
        toast.error("Session non valide. Veuillez vous reconnecter.");
        return false;
      }
      setCurrentUser(user);
      log.info("fetchCurrentUser: user resolved", {
        userId: user.id,
        role: user.role,
      });
      return true;
    } catch (error) {
      log.error("fetchCurrentUser: failed to fetch current user", { error });
      toast.error("Erreur lors de la récupération de l'utilisateur.");
      return false;
    }
  }, []);

  const initMeeting = useCallback(async (user: AuthenticatedUser) => {
    try {
      log.debug("initMeeting: checking for existing active meeting", {
        userId: user.id,
      });
      const existing = await meetingService.getActiveMeetingForUser(user.id);

      if (existing) {
        log.info("initMeeting: active meeting found", {
          meetingId: existing.id,
        });
        setMeeting(existing);
        setParticipants(existing.participants || []);
        return existing;
      }

      log.info("initMeeting: no active meeting, creating new one", {
        userId: user.id,
      });
      const firstName = user.firstName || "Utilisateur";
      const lastName = user.lastName || "";
      const initials =
        `${firstName.charAt(0)}${lastName ? lastName.charAt(0) : ""}`.toUpperCase() ||
        "UN";

      const newMeeting = await meetingService.createMeeting({
        title: "Visioconférence",
        participants: [
          {
            id: user.id,
            name: `${firstName}${lastName ? " " + lastName : ""}`,
            email: `${firstName.toLowerCase()}@nexaflow.local`,
            initials: initials,
            isSelf: true,
            isMuted: false,
            isVideoOn: true,
          },
        ],
        createdBy: user.id,
      });

      if (!newMeeting) {
        log.warn(
          "initMeeting: failed to create meeting, falling back to participants",
        );
        setParticipants(FALLBACK_PARTICIPANTS);
        toast.error(
          "Impossible de créer la réunion. Affichage des données locales.",
        );
        return null;
      }

      log.info("initMeeting: meeting created", {
        meetingId: newMeeting.id,
        title: newMeeting.title,
      });
      setMeeting(newMeeting);
      setParticipants(newMeeting.participants || []);
      toast.success("Réunion créée et connectée à la base de données.");
      return newMeeting;
    } catch (error) {
      log.error("initMeeting: failed to initialize meeting", {
        userId: user.id,
        error,
      });
      setParticipants(FALLBACK_PARTICIPANTS);
      toast.error(
        "Erreur de connexion à la base de données. Affichage des données locales.",
      );
      return null;
    }
  }, []);

  const loadChatMessages = useCallback(async (meetingId: string) => {
    try {
      log.debug("loadChatMessages: fetching chat messages", { meetingId });
      const msgs = await meetingService.getChatMessages(meetingId);
      setMessages(msgs);
      log.info("loadChatMessages: messages loaded", {
        meetingId,
        count: msgs.length,
      });
    } catch (error) {
      log.error("loadChatMessages: failed to load messages", {
        meetingId,
        error,
      });
      toast.error("Erreur lors du chargement des messages.");
    }
  }, []);

  const saveParticipantState = useCallback(
    async (updates: { isMuted?: boolean; isVideoOn?: boolean }) => {
      if (!meeting || !currentUser) {
        log.debug("saveParticipantState: no meeting or user, skipping save", {
          hasMeeting: !!meeting,
          hasUser: !!currentUser,
        });
        return;
      }

      setIsSaving(true);
      try {
        log.debug("saveParticipantState: updating participant state", {
          meetingId: meeting.id,
          userId: currentUser.id,
          updates,
        });
        const updatedMeeting = await meetingService.updateParticipantState(
          meeting.id,
          updates,
        );

        if (updatedMeeting) {
          setMeeting(updatedMeeting);
          setParticipants(updatedMeeting.participants || []);
          log.info("saveParticipantState: participant state saved", {
            meetingId: meeting.id,
            userId: currentUser.id,
            updates,
          });
        } else {
          log.warn("saveParticipantState: failed to update participant state", {
            meetingId: meeting.id,
            userId: currentUser.id,
          });
          toast.error("Impossible de synchroniser l'état du participant.");
        }
      } catch (error) {
        log.error("saveParticipantState: error updating participant state", {
          meetingId: meeting.id,
          userId: currentUser.id,
          error,
        });
        toast.error("Erreur lors de la synchronisation.");
      } finally {
        setIsSaving(false);
      }
    },
    [meeting, currentUser],
  );

  const handleSendChatMessage = useCallback(async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || !meeting || !currentUser) {
      if (!trimmed) {
        log.debug("handleSendChatMessage: empty message, skipped");
      }
      return;
    }

    const firstName = currentUser.firstName || "Utilisateur";
    const lastName = currentUser.lastName || "";
    const initials =
      `${firstName.charAt(0)}${lastName ? lastName.charAt(0) : ""}`.toUpperCase() ||
      "UN";

    const optimisticMessage: MeetingChatMessage = {
      id: `local-${Date.now()}`,
      meetingId: meeting.id,
      userId: currentUser.id,
      userName: `${firstName}${lastName ? " " + lastName : ""}`,
      userInitials: initials,
      isSelf: true,
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");

    try {
      log.debug("handleSendChatMessage: sending message to API", {
        meetingId: meeting.id,
        userId: currentUser.id,
      });
      const saved = await meetingService.sendChatMessage(meeting.id, {
        userId: currentUser.id,
        userName: `${firstName}${lastName ? " " + lastName : ""}`,
        userInitials: initials,
        isSelf: true,
        text: trimmed,
      });

      if (saved) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMessage.id ? saved : m)),
        );
        log.info("handleSendChatMessage: message saved", {
          meetingId: meeting.id,
          messageId: saved.id,
        });
      } else {
        log.warn("handleSendChatMessage: message not saved to database", {
          meetingId: meeting.id,
        });
        toast.error("Le message n'a pas été enregistré en base de données.");
      }
    } catch (error) {
      log.error("handleSendChatMessage: error sending message", {
        meetingId: meeting.id,
        error,
      });
      toast.error("Erreur lors de l'envoi du message.");
    }
  }, [newMessage, meeting, currentUser]);

  const handleEndCall = useCallback(async () => {
    if (!meeting) {
      log.warn("handleEndCall: no active meeting");
      alert("Fin de l'appel");
      return;
    }

    try {
      log.info("handleEndCall: ending meeting", { meetingId: meeting.id });
      await meetingService.endMeeting(meeting.id);
      toast.success("Réunion terminée et enregistrée en base de données.");
    } catch (error) {
      log.error("handleEndCall: failed to end meeting", {
        meetingId: meeting.id,
        error,
      });
      toast.error("Erreur lors de la fin de la réunion.");
    }

    alert("Fin de l'appel");
  }, [meeting]);

  const handleMuteToggle = useCallback(() => {
    const newState = !isMuted;
    setIsMuted(newState);
    log.debug("handleMuteToggle: mute toggled", { isMuted: newState });
    saveParticipantState({ isMuted: newState });
  }, [isMuted, saveParticipantState]);

  const handleVideoToggle = useCallback(() => {
    const newState = !isVideoOn;
    setIsVideoOn(newState);
    log.debug("handleVideoToggle: video toggled", { isVideoOn: newState });
    saveParticipantState({ isVideoOn: newState });
  }, [isVideoOn, saveParticipantState]);

  const formatTime = (date: Date) => {
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

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

  useEffect(() => {
    const init = async () => {
      const ok = await fetchCurrentUser();
      if (!ok || !currentUser) {
        setIsLoading(false);
        return;
      }

      const activeMeeting = await initMeeting(currentUser);
      if (activeMeeting) {
        await loadChatMessages(activeMeeting.id);
      }
      setIsLoading(false);
    };

    if (currentUser) {
      init();
    } else {
      void init();
    }
  }, [fetchCurrentUser, initMeeting, loadChatMessages, currentUser]);

  if (isLoading) {
    return (
      <section className="flex h-[calc(100vh-4rem)] flex-col">
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
                <h1 className="text-sm font-bold gradient-text">
                  Visioconférence
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="h-3 w-3 text-muted-foreground/60" />
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Initialisation…
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Connexion à la base de données…
          </p>
        </div>
      </section>
    );
  }

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
                {meeting && (
                  <span className="text-[10px] font-mono text-muted-foreground/40">
                    • ID: {meeting.id.slice(0, 8)}
                  </span>
                )}
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
              "active:translate-y-0 group",
            )}
            onClick={handleEndCall}
            title="Raccrochir"
            disabled={isSaving}
          >
            <PhoneOff className="h-4 w-4 text-foreground/50 group-hover:text-destructive transition-colors" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden flex-col sm:flex-row">
        {/* ── Video Grid ── */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4">
            <div
              className="grid h-full gap-3 rounded-2xl border border-border/50 bg-muted/10 p-1 grid-cols-1 sm:grid-cols-2 grid-rows-[repeat(4,1fr)] sm:grid-rows-[repeat(2,1fr)]"
            >
              {participants.map((p) => (
                <Card
                  key={p.id}
                  className={cn(
                    "relative overflow-hidden rounded-xl border border-border/40",
                    "bg-gradient-to-br from-muted/30 to-muted/10",
                    p.isSelf && "ring-2 ring-primary/30",
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
              <div className="flex flex-wrap items-center gap-2 justify-center">
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

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  data-testid="toggle-mic"
                  variant={isMuted ? "destructive" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40"
                  onClick={handleMuteToggle}
                  disabled={isSaving}
                >
                  {isMuted ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>

                <Button
                  data-testid="toggle-video"
                  variant={isVideoOn ? "secondary" : "destructive"}
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40"
                  onClick={handleVideoToggle}
                  disabled={isSaving}
                >
                  {isVideoOn ? (
                    <Video className="h-5 w-5" />
                  ) : (
                    <VideoOff className="h-5 w-5" />
                  )}
                </Button>

                <Button
                  data-testid="toggle-screen"
                  variant={isScreenSharing ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40"
                  onClick={() => {
                    setIsScreenSharing(!isScreenSharing);
                    log.debug("Screen share toggled", {
                      isScreenSharing: !isScreenSharing,
                    });
                  }}
                >
                  <ScreenShare className="h-5 w-5" />
                </Button>

                <Button
                  data-testid="toggle-chat"
                  variant={showChat ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40"
                  onClick={() => {
                    setShowChat(!showChat);
                    log.debug("Chat toggled", { showChat: !showChat });
                  }}
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>

                <Button
                  data-testid="toggle-participants"
                  variant={showParticipants ? "default" : "secondary"}
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40"
                  onClick={() => {
                    setShowParticipants(!showParticipants);
                    log.debug("Participants panel toggled", {
                      showParticipants: !showParticipants,
                    });
                  }}
                >
                  <Users className="h-5 w-5" />
                </Button>

                <Button
                  data-testid="meeting-settings"
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40"
                  onClick={() => {
                    alert("Paramètres de la réunion");
                    log.debug("Meeting settings clicked");
                  }}
                >
                  <Settings className="h-5 w-5" />
                </Button>

                <Button
                  data-testid="end-call"
                  variant="destructive"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/40 bg-rose-500/20 hover:bg-rose-500/30"
                  onClick={handleEndCall}
                  disabled={isSaving}
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Chat sidebar ── */}
        {showChat && (
          <div className="w-full sm:w-80 border-l border-border/50 bg-card/80 backdrop-blur-sm flex flex-col shrink-0">
            <div className="border-b border-border/50 px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">
                Chat de la réunion
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {msg.userName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(msg.timestamp)}
                    </span>
                    {msg.isSelf && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-3 px-1 bg-primary/10 text-primary border-primary/20"
                      >
                        Vous
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground pl-0">
                    {msg.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-border/50 p-3">
              <form
                data-testid="meeting-chat-form"
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendChatMessage();
                }}
              >
                <VoiceInput
                  value={newMessage}
                  onChange={setNewMessage}
                  onSend={handleSendChatMessage}
                  placeholder="Écrire un message..."
                  disabled={isSaving}
                  className="flex-1"
                />
                <Button
                  data-testid="send-chat-message"
                  type="submit"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-r from-primary to-purple-600 border border-primary/30 shadow-3d-sm text-white hover:-translate-y-0.5 hover:shadow-primary-glow transition-all duration-200 active:translate-y-0"
                  disabled={isSaving || !newMessage.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* ── Participants sidebar ── */}
        {showParticipants && (
          <div className="w-full sm:w-72 border-l border-border/50 bg-card/80 backdrop-blur-sm flex flex-col shrink-0">
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
                    <p className="text-xs text-muted-foreground truncate">
                      {p.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.isMuted && (
                      <MicOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {!p.isVideoOn && (
                      <VideoOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
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
                  const inviteLink = meeting
                    ? `https://nexaflow.com/meeting/${meeting.id}`
                    : "https://nexaflow.com/meeting/abc123";
                  navigator.clipboard?.writeText(inviteLink).then(
                    () => {
                      toast.success("Lien d'invitation copié !");
                      log.debug("Invite link copied", { inviteLink });
                    },
                    () => {
                      toast.error(`Lien : ${inviteLink}`);
                      log.warn("Failed to copy invite link", { inviteLink });
                    },
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
