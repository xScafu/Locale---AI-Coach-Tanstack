import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";

import {
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  getKnowledgeEntries,
  updateKnowledgeEntry,
  type KnowledgeEntry,
} from "@/services/knowledge.api";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/knowledge")({
  component: KnowledgePage,
});

const CATEGORIES = [
  "Setup",
  "Tecnica di guida",
  "Problema-Soluzione",
  "Generale",
];

const emptyForm = {
  category: CATEGORIES[0],
  title: "",
  content: "",
  tags: "",
};

function entryToForm(entry: KnowledgeEntry) {
  return {
    category: entry.category,
    title: entry.title,
    content: entry.content,
    tags: entry.tags ?? "",
  };
}

function KnowledgePage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["knowledge", search],
    queryFn: () => getKnowledgeEntries(search || undefined),
  });

  function startEdit(entry: KnowledgeEntry) {
    setEditingId(entry.id);
    setForm(entryToForm(entry));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save() {
    if (!form.title.trim() || !form.content.trim()) return;

    setSaving(true);

    try {
      if (editingId) {
        await updateKnowledgeEntry(editingId, form);
      } else {
        await createKnowledgeEntry(form);
      }

      await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Eliminare questa voce dalla Knowledge Base?")) return;

    setBusyId(id);

    try {
      await deleteKnowledgeEntry(id);
      await queryClient.invalidateQueries({ queryKey: ["knowledge"] });

      if (editingId === id) {
        cancelEdit();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        description="Voci che il coach consulta automaticamente in base al messaggio dell'utente per dare consigli più mirati."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{editingId ? "Modifica voce" : "Nuova voce"}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kb-category">Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value })}
              >
                <SelectTrigger id="kb-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-title">Titolo</Label>
              <Input
                id="kb-title"
                placeholder="Es. Sottosterzo in ingresso curva"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-content">Contenuto</Label>
              <Textarea
                id="kb-content"
                placeholder="Il consiglio, spiegato come lo diresti a voce."
                rows={6}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-tags">Tag</Label>
              <Input
                id="kb-tags"
                placeholder="Separati da virgola: sottosterzo, freni, GT3"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
              <p className="text-muted-foreground text-xs">
                I tag alimentano la ricerca con cui il coach seleziona le voci
                pertinenti al messaggio.
              </p>
            </div>

            <div className="flex gap-3">
              <Button onClick={save} disabled={saving}>
                {saving
                  ? "Salvataggio..."
                  : editingId
                    ? "Aggiorna voce"
                    : "Salva voce"}
              </Button>

              {editingId && (
                <Button variant="ghost" onClick={cancelEdit} disabled={saving}>
                  Annulla
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Voci salvate</CardTitle>

            <div className="relative sm:w-56">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                className="pl-8"
                placeholder="Cerca..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {isPending && (
              <>
                <Skeleton className="h-28 rounded-lg" />
                <Skeleton className="h-28 rounded-lg" />
              </>
            )}

            {!isPending && (!data?.items || data.items.length === 0) && (
              <p className="text-muted-foreground text-sm">
                Nessuna voce trovata.
              </p>
            )}

            {data?.items?.map((entry) => (
              <div key={entry.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate font-medium">{entry.title}</div>
                  <Badge variant="secondary" className="shrink-0">
                    {entry.category}
                  </Badge>
                </div>

                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {entry.content}
                </p>

                {entry.tags && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {entry.tags
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                      .map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(entry)}
                  >
                    <Pencil className="size-3.5" />
                    Modifica
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busyId === entry.id}
                    onClick={() => remove(entry.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Elimina
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
