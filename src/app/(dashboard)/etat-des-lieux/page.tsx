"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  MapPin,
  Camera,
  X,
  Play,
  Square,
  CheckCircle2,
  Send,
  Loader2,
  Image as ImageIcon,
  Film,
  Plus,
  FileUp,
} from "lucide-react";
import { etatDesLieuxService } from "@/lib/etat-des-lieux/etat-des-lieux-service";
import type { MediaAttachment, EtatDesLieuxReport } from "@/lib/etat-des-lieux/server-store";
import { SpeechControls } from "@/components/ui/speech-controls";
import type { ChangeEvent } from "react";

type FormData = {
  title: string;
  location: string;
  description: string;
  attachments: MediaAttachment[];
};

const emptyForm: FormData = {
  title: "",
  location: "",
  description: "",
  attachments: [],
};

type CaptureMode = "idle" | "camera" | "recording";

export default function EtatDesLieuxPage() {
  const [reports, setReports] = useState<EtatDesLieuxReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"image" | "video" | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      await etatDesLieuxService.init();
      const allReports = await etatDesLieuxService.getAll();
      setReports(allReports);
    } catch {
      toast.error("Erreur lors du chargement des rapports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const getAuthorInfo = () => {
    if (typeof window === "undefined") return { name: "Utilisateur", role: "rondier" };
    const role = window.sessionStorage.getItem("dashboardRole") || "rondier";
    const roleLabels: Record<string, string> = {
      admin: "Administrateur",
      "chef-de-quart": "Chef de quart",
      "chef-de-bloc": "Chef de bloc",
      rondier: "Rondier",
    };
    return { name: roleLabels[role] || "Utilisateur", role };
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Format non supporté. Utilisez une image ou une vidéo.");
      return;
    }
    const kind: MediaAttachment["kind"] = file.type.startsWith("image/") ? "image" : "video";
    const dataUrl = await readFileAsDataUrl(file);
    const buffer = await readFileAsArrayBuffer(file);

    const attachment: MediaAttachment = {
      kind,
      dataUrl,
      mimeType: file.type,
      size: buffer.byteLength,
    };

    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, attachment],
    }));

    setPreviewUrl(dataUrl);
    setPreviewKind(kind);
    toast.success(`${kind === "image" ? "Photo" : "Vidéo"} ajoutée`);
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileSelect(file);
    e.target.value = "";
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCaptureMode("camera");
    } catch {
      toast.error("Impossible d'accéder à la caméra");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCaptureMode("idle");
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    const attachment: MediaAttachment = {
      kind: "image",
      dataUrl,
      mimeType: "image/jpeg",
      size: dataUrl.length,
    };

    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, attachment],
    }));
    setPreviewUrl(dataUrl);
    setPreviewKind("image");
    stopCamera();
    toast.success("Photo capturée");
  };

  const startVideoRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const attachment: MediaAttachment = {
          kind: "video",
          dataUrl,
          mimeType: "video/webm",
          size: blob.size,
        };
        setFormData((prev) => ({
          ...prev,
          attachments: [...prev.attachments, attachment],
        }));
        setPreviewUrl(dataUrl);
        setPreviewKind("video");
      };
      reader.readAsDataURL(blob);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setCaptureMode("recording");
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setCaptureMode("camera");
  };

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
    if (formData.attachments.length === 1) {
      setPreviewUrl(null);
      setPreviewKind(null);
    }
    toast.success("Média supprimé");
  };

  const handleSend = async () => {
    if (!formData.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    if (!formData.location.trim()) {
      toast.error("Le lieu est requis");
      return;
    }
    if (formData.attachments.length === 0) {
      toast.error("Veuillez ajouter au moins une photo ou une vidéo");
      return;
    }
    if (!formData.description.trim()) {
      toast.error("Veuillez ajouter une description");
      return;
    }

    const author = getAuthorInfo();
    setSending(true);
    try {
      await etatDesLieuxService.create({
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        attachments: formData.attachments,
        status: "sent",
        authorName: author.name,
        authorRole: author.role,
      });
      toast.success("Rapport envoyé aux utilisateurs avec succès");
      setFormData(emptyForm);
      setPreviewUrl(null);
      setPreviewKind(null);
      await loadReports();
    } catch {
      toast.error("Erreur lors de l'envoi du rapport");
    } finally {
      setSending(false);
    }
  };

  const sentReports = reports.filter((r) => r.status === "sent");

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      {/* ── Page Header ── */}
      <div className="mb-8 flex items-center gap-4 animate-slide-in-3d">
        <div className="relative flex-shrink-0">
          <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-lg animate-glow-pulse" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20 shadow-3d">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">État des lieux</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Créez et suivez vos rapports de terrain</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">

        {/* ── Form Card ── */}
        <div className={cn(
          "rounded-2xl border border-border/50",
          "bg-card/80 backdrop-blur-sm",
          "shadow-3d",
          "transition-all duration-300",
          "hover:shadow-3d-lg hover:-translate-y-0.5",
          "p-6"
        )}>
          {/* Card Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/15">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Nouveau rapport</h2>
          </div>

          <div className="space-y-5">
            {/* Title field */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium text-foreground/80">Titre *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Ex: Inspection secteur turbine"
                className={cn(
                  "bg-background/60 border-border/60",
                  "focus:border-primary/50 focus:shadow-primary-glow",
                  "transition-all duration-200 rounded-xl"
                )}
              />
            </div>

            {/* Location field */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium text-foreground/80">Lieu de travail *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/50" />
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, location: e.target.value }))
                  }
                  placeholder="Ex: Salle des turbines, Bloc A"
                  className={cn(
                    "pl-9 bg-background/60 border-border/60",
                    "focus:border-primary/50 focus:shadow-primary-glow",
                    "transition-all duration-200 rounded-xl"
                  )}
                />
              </div>
            </div>

            {/* Media section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground/80">Médias (photo et/ou vidéo) *</Label>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "gap-2 flex-1 rounded-xl border-border/60",
                    "hover:bg-primary/8 hover:border-primary/30 hover:text-primary",
                    "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm",
                    "active:translate-y-0"
                  )}
                >
                  <FileUp className="h-4 w-4" />
                  Importer
                </Button>
                <Button
                  type="button"
                  variant={captureMode !== "idle" ? "default" : "outline"}
                  size="sm"
                  onClick={startCamera}
                  disabled={captureMode !== "idle"}
                  className={cn(
                    "gap-2 flex-1 rounded-xl",
                    captureMode === "idle" && [
                      "border-border/60",
                      "hover:bg-primary/8 hover:border-primary/30 hover:text-primary",
                      "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm",
                      "active:translate-y-0",
                    ].join(" "),
                    captureMode !== "idle" && "shadow-3d-sm"
                  )}
                >
                  <Camera className="h-4 w-4" />
                  Capturer
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>

              {/* Camera capture UI */}
              {captureMode !== "idle" && (
                <div className={cn(
                  "space-y-3 rounded-2xl border border-border/40 bg-muted/20 p-4",
                  "shadow-3d-sm backdrop-blur-sm"
                )}>
                  <div className="relative overflow-hidden rounded-xl bg-black shadow-3d">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-56 w-full object-cover"
                    />
                    {captureMode === "recording" && (
                      <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-xs text-white shadow-lg">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                        <span className="font-bold tracking-wider">REC</span>
                      </div>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {captureMode === "camera" && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={capturePhoto}
                          className="gap-2 rounded-xl hover:-translate-y-0.5 hover:shadow-3d-sm transition-all active:translate-y-0"
                        >
                          <Camera className="h-4 w-4" />
                          Photo
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={startVideoRecording}
                          className="gap-2 rounded-xl shadow-3d-sm hover:-translate-y-0.5 hover:shadow-3d transition-all active:translate-y-0"
                        >
                          <Play className="h-4 w-4" />
                          Vidéo
                        </Button>
                      </>
                    )}
                    {captureMode === "recording" && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={stopVideoRecording}
                        className="gap-2 rounded-xl shadow-3d-sm hover:-translate-y-0.5 transition-all active:translate-y-0"
                      >
                        <Square className="h-4 w-4" />
                        Arrêter
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={stopCamera}
                      className="rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Fermer
                    </Button>
                  </div>
                </div>
              )}

              {/* Preview */}
              {previewUrl && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Aperçu</Label>
                  <div className="relative overflow-hidden rounded-xl border border-border/40 bg-muted/20 shadow-3d-sm">
                    {previewKind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Aperçu"
                        className="h-44 w-full object-contain"
                      />
                    ) : (
                      <video
                        src={previewUrl}
                        controls
                        className="h-44 w-full object-contain"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Attachment thumbnails */}
              {formData.attachments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Médias ajoutés ({formData.attachments.length})
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {formData.attachments.map((att, index) => (
                      <div
                        key={index}
                        className={cn(
                          "relative h-16 w-16 overflow-hidden rounded-xl",
                          "border border-border/50 bg-muted/20",
                          "shadow-3d-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d",
                          "group"
                        )}
                      >
                        {att.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={att.dataUrl}
                            alt={`Média ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/10">
                            <Film className="h-6 w-6 text-purple-400" />
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-destructive text-white hover:bg-destructive/80 opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-foreground/80">Description *</Label>
              <SpeechControls
                value={formData.description}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, description: value }))
                }
                placeholder="Décrivez l'état des lieux... Vous pouvez utiliser le microphone pour dicter."
                language="fr-FR"
                continuous={false}
                showActions={true}
                showTextInput={true}
                sendOnSpeechEnd={false}
                className={cn(
                  "bg-background/60 border-border/60 rounded-xl",
                  "focus-within:border-primary/50 focus-within:shadow-primary-glow",
                  "transition-all duration-200"
                )}
              />
            </div>

            {/* Submit button */}
            <Button
              onClick={handleSend}
              disabled={sending}
              className={cn(
                "w-full gap-2 h-11 rounded-xl font-semibold",
                "bg-gradient-to-r from-primary to-purple-600",
                "border border-primary/30 shadow-3d",
                "hover:-translate-y-0.5 hover:shadow-primary-glow",
                "active:translate-y-0 active:shadow-3d-sm",
                "transition-all duration-200",
                "disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-3d"
              )}
              size="lg"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Envoyer aux utilisateurs
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── Reports list ── */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Rapports envoyés</h2>
            {sentReports.length > 0 && (
              <Badge className="ml-auto bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-600 border border-emerald-500/20 font-semibold">
                {sentReports.length}
              </Badge>
            )}
          </div>

          {/* Loading skeleton */}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn(
                  "rounded-2xl border border-border/40 p-5 shadow-3d-sm",
                  "bg-card/60 space-y-3"
                )}>
                  <div className="h-5 w-3/4 rounded-lg bg-muted shimmer" />
                  <div className="h-4 w-1/2 rounded-lg bg-muted shimmer" />
                  <div className="h-20 w-full rounded-lg bg-muted shimmer" />
                </div>
              ))}
            </div>
          ) : sentReports.length === 0 ? (
            /* Empty state */
            <div className={cn(
              "rounded-2xl border border-border/40 p-10 text-center",
              "bg-card/60 shadow-3d-sm",
              "animate-slide-in-3d"
            )}>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-foreground">Aucun rapport envoyé</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Remplissez le formulaire pour envoyer votre premier état des lieux.
              </p>
            </div>
          ) : (
            /* Report cards */
            <div className="space-y-4">
              {sentReports.map((report, idx) => (
                <div
                  key={report.id}
                  style={{ animationDelay: `${idx * 80}ms` }}
                  className={cn(
                    "rounded-2xl border border-border/40 overflow-hidden",
                    "bg-card/80 backdrop-blur-sm",
                    "shadow-3d transition-all duration-300",
                    "hover:shadow-3d-lg hover:-translate-y-1",
                    "animate-slide-in-3d"
                  )}
                >
                  {/* Top color accent bar */}
                  <div className="h-0.5 bg-gradient-to-r from-primary/60 via-emerald-500/40 to-transparent" />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground truncate">
                            {report.title}
                          </h3>
                          <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-semibold flex-shrink-0">
                            ✓ Envoyé
                          </Badge>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 text-primary/50" />
                          {report.location}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                          {report.description}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium">Par {report.authorName}</span>
                          <span className="text-border">·</span>
                          <span>{new Date(report.createdAt).toLocaleString("fr-FR")}</span>
                          <span className="text-border">·</span>
                          <span className="flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            {report.attachments.filter((a) => a.kind === "image").length} photos
                          </span>
                          <span className="flex items-center gap-1">
                            <Film className="h-3 w-3" />
                            {report.attachments.filter((a) => a.kind === "video").length} vidéos
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Attachments strip */}
                    {report.attachments.length > 0 && (
                      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                        {report.attachments.map((att, idx2) => (
                          <div
                            key={idx2}
                            className={cn(
                              "h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl",
                              "border border-border/40 bg-muted/20",
                              "shadow-3d-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d"
                            )}
                          >
                            {att.kind === "image" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={att.dataUrl}
                                alt={`Média ${idx2 + 1}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/10">
                                <Film className="h-6 w-6 text-purple-400" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
