"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Pencil,
  Trash2,
  Upload,
  HelpCircle,
  Send,
  Plus,
  Loader2,
  FileJson,
  FolderOpen,
  ChevronDown,
  Mic,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getCsrfTokenClient } from "@/lib/auth/cookies";
import { LOCATION_REGISTRY, getAllBlocCodes, getAllGroupeNames } from "@/lib/location";
import { useVoiceGuide } from "@/lib/voice-guide/orchestrator";

interface QAItem {
  id: string;
  question: string;
  answer: string;
}

interface UploadedFile {
  id: string;
  fileName: string;
  setName: string;
  version: number;
  directory: string;
  filePath: string;
  qaCount: number;
  createdAt: string;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const csrfToken = getCsrfTokenClient();
  if (csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }
  return headers;
}

function handleAuthError(response: Response): boolean {
  if (response.status === 401) {
    window.location.href = "/login?callbackUrl=/q-r";
    return true;
  }
  return false;
}

export default function QAPage() {
  const [items, setItems] = useState<QAItem[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendFileName, setSendFileName] = useState("");
  const [sendTag, setSendTag] = useState<string | null>(null);
  const [sendTagType, setSendTagType] = useState<"centrale" | "groupe" | null>(null);
  const [sendBlocCode, setSendBlocCode] = useState<string | null>(null);
  const [sendEquipCode, setSendEquipCode] = useState<string | null>(null);
  const [sendGroupeName, setSendGroupeName] = useState<string | null>(null);
  const [sendVueCode, setSendVueCode] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [expandedBlocs, setExpandedBlocs] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = useCallback(async () => {
    console.log("[q-r-page] fetchItems: starting");
    try {
      const res = await fetch("/api/q-r", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      console.log("[q-r-page] fetchItems: response status", res.status);
      if (!res.ok) {
        if (handleAuthError(res)) return;
        throw new Error("Erreur de chargement");
      }
      const data = await res.json();
      console.log("[q-r-page] fetchItems: data received", {
        count: data.data?.length || 0,
      });
      setItems(data.data || []);
    } catch (err) {
      console.error("[q-r-page] fetchItems: error", err);
      setError("Impossible de charger les Q/R");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUploadedFiles = useCallback(async () => {
    console.log("[q-r-page] fetchUploadedFiles: starting");
    try {
      const res = await fetch("/api/q-r/upload", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      console.log("[q-r-page] fetchUploadedFiles: response status", res.status);
      if (!res.ok) {
        if (handleAuthError(res)) return;
        return;
      }
      const data = await res.json();
      console.log("[q-r-page] fetchUploadedFiles: data received", {
        count: data.data?.length || 0,
      });
      setUploadedFiles(data.data || []);
    } catch (err) {
      console.error("[q-r-page] fetchUploadedFiles: error", err);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchUploadedFiles();
  }, [fetchItems, fetchUploadedFiles]);

  const handleAdd = async () => {
    if (!question.trim() || !answer.trim()) return;
    console.log("[q-r-page] handleAdd: adding new item", {
      question: question.trim(),
      answer: answer.trim(),
    });
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/q-r", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim(),
        }),
        credentials: "include",
      });

      console.log("[q-r-page] handleAdd: response status", res.status);
      if (!res.ok) {
        if (handleAuthError(res)) return;
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de l'ajout");
      }

      const data = await res.json();
      console.log("[q-r-page] handleAdd: item created", { id: data.data?.id });
      setItems((prev) => [data.data, ...prev]);
      setQuestion("");
      setAnswer("");
    } catch (err) {
      console.error("[q-r-page] handleAdd: error", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !question.trim() || !answer.trim()) return;
    console.log("[q-r-page] handleUpdate: updating item", { id: editingId });
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/q-r", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          id: editingId,
          question: question.trim(),
          answer: answer.trim(),
        }),
        credentials: "include",
      });

      console.log("[q-r-page] handleUpdate: response status", res.status);
      if (!res.ok) {
        if (handleAuthError(res)) return;
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la modification");
      }

      const data = await res.json();
      console.log("[q-r-page] handleUpdate: item updated", {
        id: data.data?.id,
      });
      setItems((prev) =>
        prev.map((item) => (item.id === editingId ? data.data : item)),
      );
      setEditingId(null);
      setQuestion("");
      setAnswer("");
    } catch (err) {
      console.error("[q-r-page] handleUpdate: error", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: QAItem) => {
    setEditingId(item.id);
    setQuestion(item.question);
    setAnswer(item.answer);
  };

  const handleDelete = async (id: string) => {
    console.log("[q-r-page] handleDelete: deleting item", { id });
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/q-r", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ id }),
        credentials: "include",
      });

      console.log("[q-r-page] handleDelete: response status", res.status);
      if (!res.ok) {
        if (handleAuthError(res)) return;
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la suppression");
      }

      console.log("[q-r-page] handleDelete: item deleted", { id });
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setQuestion("");
        setAnswer("");
      }
    } catch (err) {
      console.error("[q-r-page] handleDelete: error", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setQuestion("");
    setAnswer("");
    setError(null);
  };

  const handleClearAll = async () => {
    console.log("[q-r-page] handleClearAll: clearing all items", {
      count: items.length,
    });
    setSaving(true);
    setError(null);

    try {
      const results = await Promise.allSettled(
        items.map((item) =>
          fetch("/api/q-r", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ id: item.id }),
            credentials: "include",
          })
        ),
      );

      const failedIds = new Set<string>();
      results.forEach((result, index) => {
        if (result.status === "rejected" || !result.value.ok) {
          failedIds.add(items[index].id);
        }
      });

      if (failedIds.size > 0) {
        setError(`${failedIds.size} suppression(s) ont échoué`);
      }

      setItems((prev) => prev.filter((item) => failedIds.has(item.id)));
      if (failedIds.size === 0) {
        setEditingId(null);
        setQuestion("");
        setAnswer("");
      }
    } catch (err) {
      console.error("[q-r-page] handleClearAll: error", err);
      setError("Erreur lors du vidage");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (items.length === 0) {
      setError("Aucune Q/R à envoyer");
      return;
    }
    setSendFileName("");
    setSendDialogOpen(true);
  };

  const handleConfirmSend = async () => {
    const rawName = sendFileName.trim();
    if (!rawName) {
      setError("Nom de fichier requis");
      return;
    }

    const fileName = rawName.endsWith(".json") ? rawName : `${rawName}.json`;
    let targetPath: string;

    if (sendTagType === "centrale" && sendBlocCode && sendEquipCode) {
      targetPath = `Centrale/${sendBlocCode}/${sendEquipCode}/data/qr/${fileName}`;
    } else if (sendTagType === "groupe" && sendGroupeName && sendVueCode) {
      targetPath = `Groupes/${sendGroupeName}/${sendVueCode}/data/qr/${fileName}`;
    } else {
      targetPath = `items/${fileName}`;
    }

    const payload = {
      pairs: items.map((item) => ({
        question: item.question,
        answer: item.answer,
      })),
    };

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/registry/fs?t=${Date.now()}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          path: targetPath,
          content: JSON.stringify(payload, null, 2),
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur d'enregistrement" }));
        throw new Error(err.error || "Erreur d'enregistrement");
      }

      alert(`Fichier enregistré dans .registry/${targetPath}`);
      setSendDialogOpen(false);
      setSendTag(null);
      setSendTagType(null);
      setSendBlocCode(null);
      setSendEquipCode(null);
      setSendGroupeName(null);
      setSendVueCode(null);
      setSendFileName("");
    } catch (err) {
      console.error("[q-r-page] handleConfirmSend: error", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log("[q-r-page] handleFileUpload: uploading file", {
      fileName: file.name,
      size: file.size,
    });
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/q-r/upload", {
        method: "POST",
        body: formData,
        headers: getAuthHeaders(),
        credentials: "include",
      });

      console.log("[q-r-page] handleFileUpload: response status", res.status);
      if (!res.ok) {
        if (handleAuthError(res)) return;
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de l'envoi");
      }

      const data = await res.json();
      console.log("[q-r-page] handleFileUpload: file uploaded", data.data);
      setError(null);
      alert(data.data.message);
      await fetchUploadedFiles();
    } catch (err) {
      console.error("[q-r-page] handleFileUpload: error", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleLoadFile = async (fileId: string) => {
    console.log("[q-r-page] handleLoadFile: loading file", { fileId });
    try {
      const res = await fetch(`/api/q-r/upload/${fileId}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      console.log("[q-r-page] handleLoadFile: response status", res.status);
      if (!res.ok) {
        if (handleAuthError(res)) return;
        throw new Error("Erreur de chargement du fichier");
      }
      const data = await res.json();

      const qaPairs: QAItem[] = data.data.pairs || [];
      console.log("[q-r-page] handleLoadFile: pairs loaded", {
        count: qaPairs.length,
      });
      if (qaPairs.length === 0) {
        setError("Aucune paire Q/R valide dans ce fichier");
        return;
      }

      setItems((prev) => [...qaPairs, ...prev]);
      setError(null);
    } catch (err) {
      console.error("[q-r-page] handleLoadFile: error", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const handleDeleteUploadedFile = async (fileId: string) => {
    console.log("[q-r-page] handleDeleteUploadedFile: deleting file", {
      fileId,
    });
    try {
      const res = await fetch(`/api/q-r/upload/${fileId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      });

      console.log(
        "[q-r-page] handleDeleteUploadedFile: response status",
        res.status,
      );
      if (!res.ok) {
        if (handleAuthError(res)) return;
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la suppression");
      }

      console.log("[q-r-page] handleDeleteUploadedFile: file deleted", {
        fileId,
      });
      await fetchUploadedFiles();
    } catch (err) {
      console.error("[q-r-page] handleDeleteUploadedFile: error", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const isEditing = editingId !== null;

  const toggleBloc = (blocCode: string) => {
    setExpandedBlocs((prev) => {
      const next = new Set(prev);
      if (next.has(blocCode)) {
        next.delete(blocCode);
      } else {
        next.add(blocCode);
      }
      return next;
    });
  };

  const {
    activate: activateVoiceGuide,
    startGuidance: startVoiceGuidance,
  } = useVoiceGuide();

  const handleVoiceGuideActivate = async () => {
    await activateVoiceGuide();
    setTimeout(() => startVoiceGuidance(), 300);
  };

  return (
    <>
      <section className="py-8 sm:py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* ── Page Header ── */}
        <div className="mb-8 flex items-center gap-4 animate-slide-in-3d">
          <div className="icon-glow">
            <div className="icon-inner">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight gradient-text sm:text-3xl">
              Questions / Réponses
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Collecte et gestion des questions fréquentes pour l&apos;assistant
              IA.
            </p>
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ── Form ── */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Nouvelle paire Q/R</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleVoiceGuideActivate}
              className="gap-2 rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200"
            >
              <Mic className="h-4 w-4" />
              Guide vocal
            </Button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isEditing) handleUpdate();
              else handleAdd();
            }}
            className="dashboard-card p-6"
          >
            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="question"
                  className="mb-1.5 block text-sm font-medium text-foreground/80"
                >
                  Question
                </label>
                <div className="relative">
                  <Input
                    id="question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Tapez votre question ici..."
                    autoComplete="off"
                    disabled={saving}
                    className="pr-9 bg-background/60 border-border/60 rounded-xl focus:border-primary/50 focus:shadow-primary-glow transition-all duration-200"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-primary"
                    title="Dictater la question"
                  >
                    <Mic className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="answer"
                  className="mb-1.5 block text-sm font-medium text-foreground/80"
                >
                  Réponse
                </label>
                <div className="relative">
                  <Input
                    id="answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Tapez la réponse correspondante..."
                    autoComplete="off"
                    disabled={saving}
                    className="pr-9 bg-background/60 border-border/60 rounded-xl focus:border-primary/50 focus:shadow-primary-glow transition-all duration-200"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-primary"
                    title="Dictater la réponse"
                  >
                    <Mic className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button
                  type="submit"
                  className="flex-1 btn-primary-gradient gap-2"
                  disabled={saving || !question.trim() || !answer.trim()}
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isEditing ? (
                    <>
                      <Pencil className="h-3.5 w-3.5" />
                      Modifier
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter
                    </>
                  )}
                </Button>
                {isEditing && (
                  <Button
                    type="button"
                    onClick={cancelEdit}
                    variant="outline"
                    disabled={saving}
                    className="flex-1 rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200"
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* ── File Upload ── */}
        <div className="mt-8">
          <div className="dashboard-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 border border-primary/20">
                <FileJson className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                Import de fichiers Q/R
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={uploading}
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                disabled={uploading}
                className="btn-primary-gradient gap-2"
              >
                {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Upload className="h-3.5 w-3.5" />
                Envoyer le fichier
              </Button>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Upload un fichier JSON contenant des paires Q/R. Le nom du fichier
              (sans .json) devient le nom du lot. En cas de doublon, l&apos;app
              crée un dossier avec versionnage automatique.
            </p>
          </div>
        </div>

        {/* ── Uploaded files list ── */}
        {uploadedFiles.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 border border-primary/20">
                <FolderOpen className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                Fichiers uploadés
              </h2>
              <Badge
                variant="secondary"
                className="rounded-md px-2 py-0.5 text-xs bg-primary/10 text-primary border-primary/20"
              >
                {uploadedFiles.length}
              </Badge>
            </div>

            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="group rounded-xl border border-border/50 bg-card/60 p-4 shadow-3d-sm transition-all duration-200 hover:shadow-3d-lg hover:border-primary/30"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 text-sm">
                      <span className="font-semibold text-foreground">
                        {file.fileName}
                      </span>
                      <span className="mx-2 text-muted-foreground">|</span>
                      <span className="text-muted-foreground">
                        {file.qaCount} paire(s) Q/R
                      </span>
                      <span className="mx-2 text-muted-foreground">|</span>
                      <span className="text-muted-foreground">
                        v{file.version}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleLoadFile(file.id)}
                        aria-label="Charger les Q/R"
                        className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteUploadedFile(file.id)}
                        aria-label="Supprimer le fichier"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FAQ list ── */}
        <div className="mt-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 border border-primary/20">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                Collecteur de Q/R
              </h2>
              <Badge
                variant="secondary"
                className="rounded-md px-2 py-0.5 text-xs bg-primary/10 text-primary border-primary/20"
              >
                {items.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                data-testid="clear-qr"
                type="button"
                size="sm"
                variant="outline"
                onClick={handleClearAll}
                disabled={saving || items.length === 0}
                className="rounded-xl border-border/60 bg-card/60 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all duration-200"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Vider
              </Button>
              <Button
                data-testid="send-qr"
                size="sm"
                className="btn-primary-gradient gap-1.5"
                onClick={handleSend}
                disabled={saving || items.length === 0}
              >
                <Send className="h-3.5 w-3.5" />
                Envoyer
              </Button>
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="dashboard-card p-10 text-center">
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Chargement des Q/R...
                </p>
              </div>
            ) : items.length === 0 ? (
              <div className="dashboard-card p-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30 border border-border/40">
                  <HelpCircle className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Aucune Q/R enregistrée pour le moment.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="group rounded-xl border border-border/50 bg-card/60 p-4 shadow-3d-sm transition-all duration-200 hover:shadow-3d-lg hover:border-primary/30"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-sm break-words leading-relaxed">
                        <span className="font-semibold text-foreground">
                          {"{Q:"}
                        </span>
                        <span className="mx-1 text-foreground">
                          {item.question}
                        </span>
                        <span className="text-foreground">{"; R:"}</span>
                        <span className="mx-1 text-muted-foreground">
                          {item.answer}
                        </span>
                        <span className="font-semibold text-foreground">
                          {"}"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(item)}
                          aria-label="Modifier"
                          className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item.id)}
                          aria-label="Supprimer"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>

    <Dialog open={sendDialogOpen} onOpenChange={(open) => {
      if (!open) {
        setSendTag(null);
        setSendTagType(null);
        setSendBlocCode(null);
        setSendEquipCode(null);
        setSendGroupeName(null);
        setSendVueCode(null);
        setSendFileName("");
        setTagsExpanded(false);
      }
      setSendDialogOpen(open);
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enregistrer la Q/R dans la BDD web</DialogTitle>
          <DialogDescription>
            Le fichier JSON sera généré et stocké dans .registry/.
            Sans tag : items/nom.json.
            Avec tag Centrale : Centrale/bloc/tag/data/qr/nom.json.
            Avec tag Groupe : Groupes/groupe/vue/data/qr/nom.json.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-2">
            <label htmlFor="qr-file-name" className="text-sm font-medium">
              Nom du fichier
            </label>
            <Input
              id="qr-file-name"
              value={sendFileName}
              onChange={(event) => setSendFileName(event.target.value)}
              placeholder="ex: mon-fichier-qr"
            />
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setTagsExpanded(!tagsExpanded)}
              className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card/60 px-4 py-2.5 text-sm font-medium transition-all hover:bg-primary/8 hover:border-primary/30"
            >
              <span>
                {sendTag ? `Tag sélectionné : ${sendTag}` : "Choisir un équipement (tag)"}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${tagsExpanded ? "rotate-180" : ""}`} />
            </button>

            {tagsExpanded && (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border/60 bg-background/60 p-2">
                {getAllBlocCodes().map((blocCode) => {
                  const bloc = LOCATION_REGISTRY.Centrale[blocCode];
                  if (!bloc) return null;
                  const isBlocExpanded = expandedBlocs.has(blocCode);
                  return (
                    <div key={blocCode} className="mb-1 last:mb-0">
                      <button
                        type="button"
                        onClick={() => toggleBloc(blocCode)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold hover:bg-accent transition-colors"
                      >
                        <span>
                          {blocCode} — {bloc.libelle}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isBlocExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {isBlocExpanded && (
                        <div className="ml-4 mt-1 grid grid-cols-2 gap-1">
                          {bloc.descendants.map((desc) => (
                            <button
                              key={`${blocCode}-${desc.nom}`}
                              type="button"
                              onClick={() => {
                                setSendTagType("centrale");
                                setSendBlocCode(blocCode);
                                setSendEquipCode(desc.nom);
                                setSendTag(`${blocCode}/${desc.nom}`);
                                setSendGroupeName(null);
                                setSendVueCode(null);
                              }}
                              className={`rounded-md px-2 py-1.5 text-left text-xs transition-colors truncate ${
                                sendTagType === "centrale" && sendEquipCode === desc.nom && sendBlocCode === blocCode
                                  ? "bg-primary/20 text-primary border border-primary/30"
                                  : "bg-muted/30 hover:bg-accent border border-transparent"
                              }`}
                            >
                              <span className="font-mono font-medium">{desc.nom}</span>
                              <span className="ml-1.5 text-muted-foreground">{desc.libelle}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {getAllGroupeNames().map((groupeName) => {
                  const groupe = LOCATION_REGISTRY.Groupes[groupeName];
                  if (!groupe) return null;
                  const isGroupeExpanded = expandedBlocs.has(`groupe-${groupeName}`);
                  return (
                    <div key={`groupe-${groupeName}`} className="mb-1 last:mb-0">
                      <button
                        type="button"
                        onClick={() => toggleBloc(`groupe-${groupeName}`)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold hover:bg-accent transition-colors"
                      >
                        <span className="truncate">
                          {groupeName}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isGroupeExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {isGroupeExpanded && (
                        <div className="ml-4 mt-1 grid grid-cols-2 gap-1">
                          {groupe.descendants.map((desc) => (
                            <button
                              key={`${groupeName}-${desc.nom}`}
                              type="button"
                              onClick={() => {
                                setSendTagType("groupe");
                                setSendGroupeName(groupeName);
                                setSendVueCode(desc.nom);
                                setSendTag(`${groupeName}/${desc.nom}`);
                                setSendBlocCode(null);
                                setSendEquipCode(null);
                              }}
                              className={`rounded-md px-2 py-1.5 text-left text-xs transition-colors truncate ${
                                sendTagType === "groupe" && sendVueCode === desc.nom && sendGroupeName === groupeName
                                  ? "bg-primary/20 text-primary border border-primary/30"
                                  : "bg-muted/30 hover:bg-accent border border-transparent"
                              }`}
                            >
                              <span className="font-mono font-medium">{desc.nom}</span>
                              <span className="ml-1.5 text-muted-foreground">{desc.libelle}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setSendDialogOpen(false)}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button onClick={handleConfirmSend} disabled={saving || items.length === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
