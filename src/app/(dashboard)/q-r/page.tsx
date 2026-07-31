"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Upload, HelpCircle, Send, Plus } from "lucide-react";

interface QAItem {
  question: string;
  answer: string;
}

export default function QAPage() {
  const [items, setItems] = useState<QAItem[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAdd = () => {
    if (!question.trim() || !answer.trim()) return;
    if (editingIndex !== null) {
      const updated = [...items];
      updated[editingIndex] = { question: question.trim(), answer: answer.trim() };
      setItems(updated);
      setEditingIndex(null);
    } else {
      setItems([...items, { question: question.trim(), answer: answer.trim() }]);
    }
    setQuestion("");
    setAnswer("");
  };

  const handleEdit = (index: number) => {
    setQuestion(items[index].question);
    setAnswer(items[index].answer);
    setEditingIndex(index);
  };

  const handleDelete = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setQuestion("");
      setAnswer("");
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setQuestion("");
    setAnswer("");
  };

  return (
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
              Collecte et gestion des questions fréquentes pour l&apos;assistant IA.
            </p>
          </div>
        </div>

        {/* ── Form ── */}
        <div className="mt-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
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
                <Input
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Tapez votre question ici..."
                  autoComplete="off"
                  className="bg-background/60 border-border/60 rounded-xl focus:border-primary/50 focus:shadow-primary-glow transition-all duration-200"
                />
              </div>
              <div>
                <label
                  htmlFor="answer"
                  className="mb-1.5 block text-sm font-medium text-foreground/80"
                >
                  Réponse
                </label>
                <Input
                  id="answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Tapez la réponse correspondante..."
                  autoComplete="off"
                  className="bg-background/60 border-border/60 rounded-xl focus:border-primary/50 focus:shadow-primary-glow transition-all duration-200"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button
                  type="submit"
                  className="flex-1 btn-primary-gradient gap-2"
                >
                  {editingIndex !== null ? (
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
                {editingIndex !== null && (
                  <Button
                    type="button"
                    onClick={cancelEdit}
                    variant="outline"
                    className="flex-1 rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200"
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>

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
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setItems([]);
                  setEditingIndex(null);
                  setQuestion("");
                  setAnswer("");
                }}
                className="rounded-xl border-border/60 bg-card/60 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all duration-200"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Vider
              </Button>
              <Button
                size="sm"
                className="btn-primary-gradient gap-1.5"
                onClick={() => alert("Envoi des Q/R en cours...")}
              >
                <Send className="h-3.5 w-3.5" />
                Envoyer
              </Button>
            </div>
          </div>

          <div className="mt-6">
            {items.length === 0 ? (
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
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="group rounded-xl border border-border/50 bg-card/60 p-4 shadow-3d-sm transition-all duration-200 hover:shadow-3d-lg hover:border-primary/30"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-sm break-words leading-relaxed">
                        <span className="font-semibold text-foreground">{"{Q:"}</span>
                        <span className="mx-1 text-foreground">{item.question}</span>
                        <span className="text-foreground">{"; R:"}</span>
                        <span className="mx-1 text-muted-foreground">{item.answer}</span>
                        <span className="font-semibold text-foreground">{"}"}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(i)}
                          aria-label="Modifier"
                          className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(i)}
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
  );
}
