"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Upload,
  Search,
  Image as ImageIcon,
  Trash2,
  Download,
  Plus,
  Camera,
  X,
  Edit3,
  FileUp,
  Play,
  Square,
  Loader2,
  Sparkles,
  Film,
  Tag,
  FolderOpen,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { MediaItem, MediaKind, imageService } from "@/lib/images/image-service";
import type { ChangeEvent } from "react";

type FormData = {
  title: string;
  category: string;
  description: string;
  tags: string;
  kind: MediaKind;
  dataUrl: string;
  thumbnailDataUrl?: string;
  mimeType: string;
  size: number;
};

const emptyForm: FormData = {
  title: "",
  category: "",
  description: "",
  tags: "",
  kind: "image",
  dataUrl: "",
  mimeType: "",
  size: 0,
};

const CATEGORY_COLORS: Record<string, string> = {
  Équipement: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Inspection: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  Sécurité: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Maintenance: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  Documentation: "bg-sky-500/10 text-sky-600 border-sky-500/20",
};

export default function ImagesPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["Tous"]);
  const [filterCategory, setFilterCategory] = useState("Tous");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<MediaKind | null>(null);
  const [sourceMode, setSourceMode] = useState<"upload" | "camera">("upload");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await imageService.init();
      const [allItems, cats] = await Promise.all([
        imageService.getAll(),
        imageService.getCategories(),
      ]);
      setItems(allItems);
      setCategories(cats);
    } catch {
      toast.error("Erreur lors du chargement des médias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const filtered = items.filter((item) => {
    const matchesCategory =
      filterCategory === "Tous" || item.category === filterCategory;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags.some((tag) => tag.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const resetForm = () => {
    setFormData(emptyForm);
    setPreviewUrl(null);
    setPreviewKind(null);
    setEditingItem(null);
    setSourceMode("upload");
    setIsRecording(false);
    setDragActive(false);
  };

  const openEditDialog = async (item: MediaItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      category: item.category,
      description: item.description,
      tags: item.tags.join(", "),
      kind: item.kind,
      dataUrl: item.dataUrl,
      thumbnailDataUrl: item.thumbnailDataUrl,
      mimeType: item.mimeType,
      size: item.size,
    });
    setPreviewUrl(item.dataUrl || null);
    setPreviewKind(item.kind);
    setSourceMode("upload");
    setDialogOpen(true);
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
    const kind: MediaKind = file.type.startsWith("image/") ? "image" : "video";
    const dataUrl = await readFileAsDataUrl(file);
    const buffer = await readFileAsArrayBuffer(file);

    setFormData((prev) => ({
      ...prev,
      kind,
      dataUrl,
      mimeType: file.type,
      size: buffer.byteLength,
      title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
    }));
    setPreviewUrl(dataUrl);
    setPreviewKind(kind);
    setSourceMode("upload");
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileSelect(file);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCapturing(true);
      setSourceMode("camera");
    } catch {
      toast.error("Impossible d'accéder à la caméra");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
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
    setFormData((prev) => ({
      ...prev,
      kind: "image",
      dataUrl,
      mimeType: "image/jpeg",
      size: dataUrl.length,
      title: prev.title || `Photo ${new Date().toLocaleString("fr-FR")}`,
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
        setFormData((prev) => ({
          ...prev,
          kind: "video",
          dataUrl,
          mimeType: "video/webm",
          size: blob.size,
          title: prev.title || `Vidéo ${new Date().toLocaleString("fr-FR")}`,
        }));
        setPreviewUrl(dataUrl);
        setPreviewKind("video");
      };
      reader.readAsDataURL(blob);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    if (!formData.category) {
      toast.error("La catégorie est requise");
      return;
    }
    if (!formData.dataUrl) {
      toast.error("Veuillez fournir un média (upload ou capture)");
      return;
    }

    const tags = formData.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setSaving(true);
    try {
      if (editingItem) {
        await imageService.update(editingItem.id, {
          title: formData.title.trim(),
          category: formData.category,
          description: formData.description.trim(),
          tags,
          kind: formData.kind,
          dataUrl: formData.dataUrl,
          thumbnailDataUrl: formData.thumbnailDataUrl,
          mimeType: formData.mimeType,
          size: formData.size,
        });
        toast.success("Média mis à jour avec succès");
      } else {
        await imageService.create({
          title: formData.title.trim(),
          category: formData.category,
          description: formData.description.trim(),
          tags,
          kind: formData.kind,
          dataUrl: formData.dataUrl,
          thumbnailDataUrl: formData.thumbnailDataUrl,
          mimeType: formData.mimeType,
          size: formData.size,
        });
        toast.success("Média ajouté avec succès");
      }
      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const success = await imageService.delete(id);
    setDeletingId(null);
    if (success) {
      toast.success("Média supprimé");
      await loadData();
    } else {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleDownload = (item: MediaItem) => {
    if (!item.dataUrl) {
      toast.error("Aucune donnée disponible pour le téléchargement");
      return;
    }
    const link = document.createElement("a");
    link.href = item.dataUrl;
    link.download = item.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Téléchargement lancé");
  };

  const totalSize = items.reduce((acc, item) => acc + item.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const imageCount = items.filter((i) => i.kind === "image").length;
  const videoCount = items.filter((i) => i.kind === "video").length;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">

        {/* ── Page Header ── */}
        <div className="flex items-center gap-4 animate-slide-in-3d">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-lg animate-glow-pulse" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20 shadow-3d">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight gradient-text">
              Banque d&apos;images
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gérez vos médias : photos et vidéos
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="gap-2 rounded-xl bg-gradient-to-r from-primary to-purple-600 border border-primary/30 shadow-3d hover:-translate-y-0.5 hover:shadow-primary-glow transition-all duration-200 active:translate-y-0"
          >
            <Plus className="h-4 w-4" />
            Ajouter un média
          </Button>
        </div>

        {/* ── Stats chips (glassmorphism) ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-primary/15 bg-primary/8 px-4 py-2.5 shadow-3d-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/20">
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">{imageCount}</span>
            <span className="text-xs text-muted-foreground">images</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-violet-500/15 bg-violet-500/8 px-4 py-2.5 shadow-3d-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/20">
              <Film className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <span className="text-sm font-semibold text-foreground">{videoCount}</span>
            <span className="text-xs text-muted-foreground">vidéos</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-muted/40 px-4 py-2.5 shadow-3d-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">{formatSize(totalSize)}</span>
          </div>
        </div>

        {/* ── Filters + Search ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                  filterCategory === cat
                    ? "bg-gradient-to-r from-primary to-purple-600 text-white shadow-3d-sm border border-primary/30 -translate-y-0.5"
                    : "border border-border/60 bg-background/60 text-muted-foreground hover:border-primary/30 hover:bg-primary/8 hover:text-primary hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par titre, description ou tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-72 bg-background/60 backdrop-blur-sm border-border/60 rounded-xl focus:border-primary/50 focus:shadow-primary-glow transition-all duration-200"
            />
          </div>
        </div>

        {loading ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border/40 bg-card/60 shadow-3d-sm">
                <Skeleton className="aspect-square rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded-lg shimmer" />
                  <Skeleton className="h-3 w-1/2 rounded-lg shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center text-center py-16 animate-slide-in-3d">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 border border-border/40 shadow-3d-sm">
              <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-bold text-foreground">Aucun média trouvé</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              {search || filterCategory !== "Tous"
                ? "Essayez de modifier vos filtres ou votre recherche."
                : "Ajoutez votre premier média en cliquant sur le bouton ci-dessous."}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((item, idx) => (
              <div
                key={item.id}
                style={{ animationDelay: `${idx * 50}ms` }}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-3d-sm animate-slide-in-3d transition-all duration-300 hover:shadow-3d-lg hover:-translate-y-1.5 hover:border-primary/25"
              >
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/40 via-purple-500/30 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div
                  className="aspect-square bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center cursor-pointer overflow-hidden"
                  onClick={() => openEditDialog(item)}
                >
                  {item.dataUrl ? (
                    item.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.dataUrl}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="relative h-full w-full">
                        <video
                          src={item.dataUrl}
                          className="h-full w-full object-cover"
                          muted
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/50 transition-colors duration-300">
                          <div className="rounded-full bg-white/90 p-3 shadow-3d transition-transform duration-200 group-hover:scale-110">
                            <Play className="h-5 w-5 text-foreground" />
                          </div>
                        </div>
                      </div>
                    )
                  ) : item.kind === "video" ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                      <Film className="h-8 w-8" />
                      <span className="text-[10px] uppercase tracking-wider">Vidéo</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                      <ImageIcon className="h-8 w-8" />
                      <span className="text-[10px] uppercase tracking-wider">Image</span>
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-[10px] border rounded-full ${
                        CATEGORY_COLORS[item.category] || "bg-muted text-muted-foreground border-muted"
                      }`}
                    >
                      {item.category}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground/70">{formatSize(item.size)}</span>
                  </div>
                </div>

                {/* Hover action overlay */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-gradient-to-b from-black/70 to-black/80 backdrop-blur-sm opacity-0 transition-all duration-250 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl bg-white/15 text-white hover:bg-white/30 border border-white/20 shadow-3d-sm hover:-translate-y-0.5 transition-all duration-200"
                    onClick={() => handleDownload(item)}
                    title="Télécharger"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl bg-white/15 text-white hover:bg-white/30 border border-white/20 shadow-3d-sm hover:-translate-y-0.5 transition-all duration-200"
                    onClick={() => openEditDialog(item)}
                    title="Modifier"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl bg-red-500/25 text-white hover:bg-red-500/45 border border-red-500/30 shadow-3d-sm hover:-translate-y-0.5 transition-all duration-200"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    title="Supprimer"
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[560px] rounded-2xl border border-border/50 shadow-3d-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20">
                  {editingItem ? (
                    <Edit3 className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <span className="gradient-text">{editingItem ? "Modifier le média" : "Ajouter un média"}</span>
              </DialogTitle>
              <DialogDescription>
                {editingItem
                  ? "Modifiez les métadonnées ou remplacez le média."
                  : "Importez ou capturez un média, puis renseignez les métadonnées."}
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Source du média</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={sourceMode === "upload" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        stopCamera();
                        setSourceMode("upload");
                      }}
                      className="gap-1.5 flex-1"
                    >
                      <FileUp className="h-4 w-4" />
                      Importer
                    </Button>
                    <Button
                      type="button"
                      variant={sourceMode === "camera" ? "default" : "outline"}
                      size="sm"
                      onClick={startCamera}
                      className="gap-1.5 flex-1"
                    >
                      <Camera className="h-4 w-4" />
                      Capturer
                    </Button>
                  </div>
                </div>

                {sourceMode === "upload" && (
                  <div
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-10 px-4 text-center transition-all duration-300 cursor-pointer ${
                      dragActive
                        ? "border-primary bg-primary/8 scale-[1.02] shadow-primary-glow"
                        : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-primary/5 hover:shadow-3d-sm"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div
                      className={`flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-300 ${
                        dragActive
                          ? "bg-primary/20 border-primary/30 text-primary shadow-3d animate-float"
                          : "bg-muted/50 border-border/40 text-muted-foreground hover:bg-primary/10"
                      }`}
                    >
                      <Upload className="h-7 w-7" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-foreground">
                      {dragActive ? "Déposez le fichier ici ✨" : "Glissez-déposez un fichier"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ou parcourez vos fichiers — Images et vidéos acceptées
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                  </div>
                )}

                {sourceMode === "camera" && (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-xl bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-56 w-full object-cover"
                      />
                      {isRecording && (
                        <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs text-white">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                          REC
                        </div>
                      )}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {!isRecording ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={capturePhoto}
                          disabled={!isCapturing}
                          className="gap-1.5"
                        >
                          <Camera className="h-4 w-4" />
                          Photo
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={stopVideoRecording}
                          className="gap-1.5"
                        >
                          <Square className="h-4 w-4" />
                          Arrêter
                        </Button>
                      )}
                      {!isRecording && isCapturing && (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={startVideoRecording}
                          className="gap-1.5"
                        >
                          <Play className="h-4 w-4" />
                          Vidéo
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={stopCamera}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Fermer
                      </Button>
                    </div>
                  </div>
                )}

                {previewUrl && (
                  <div className="space-y-2">
                    <Label>Aperçu</Label>
                    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/20">
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">Titre *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder="Nom du média"
                      className="bg-background/60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, category: value as string }))
                      }
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                          .filter((c) => c !== "Tous")
                          .map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Décrire le média..."
                    rows={3}
                    className="bg-background/60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">
                    <Tag className="h-3 w-3 inline mr-1" />
                    Tags
                  </Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, tags: e.target.value }))
                    }
                    placeholder="ex: équipement, bloc B, inspection"
                    className="bg-background/60"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Séparez les tags par des virgules
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="kind">Type de média</Label>
                    <Select
                      value={formData.kind}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          kind: value as MediaKind,
                        }))
                      }
                    >
                      <SelectTrigger id="kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">
                          <span className="flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" /> Image
                          </span>
                        </SelectItem>
                        <SelectItem value="video">
                          <span className="flex items-center gap-2">
                            <Film className="h-4 w-4" /> Vidéo
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Format MIME</Label>
                    <Input
                      value={formData.mimeType || "—"}
                      readOnly
                      className="bg-muted/30"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Taille</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {formatSize(formData.size || 0)}
                  </span>
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
                disabled={saving}
                className="rounded-xl border-border/60 hover:bg-muted transition-all duration-200"
              >
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2 rounded-xl bg-gradient-to-r from-primary to-purple-600 border border-primary/30 shadow-3d-sm hover:-translate-y-0.5 hover:shadow-primary-glow transition-all duration-200 active:translate-y-0 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : editingItem ? (
                  "Enregistrer"
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Ajouter
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}