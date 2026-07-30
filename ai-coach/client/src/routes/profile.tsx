import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

import { usePilotStore } from "@/stores/pilot.store";
import {
  activatePilot,
  createPilot,
  getPilots,
  updatePilot,
  type Pilot,
} from "@/services/profile.api";
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
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

const emptyForm = {
  name: "",
  level: "",
  experience: "",
  drivingStyle: "",
};

function pilotToForm(pilot: Pilot) {
  return {
    name: pilot.name,
    level: pilot.level ?? "",
    experience: pilot.experience ?? "",
    drivingStyle: pilot.drivingStyle ?? "",
  };
}

function ProfilePage() {
  const queryClient = useQueryClient();
  const setPilot = usePilotStore((state) => state.setPilot);
  const activePilotId = usePilotStore((state) => state.pilotId);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["pilots"],
    queryFn: getPilots,
  });

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function startEdit(pilot: Pilot) {
    setEditingId(pilot.id);
    setForm(pilotToForm(pilot));
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save() {
    if (!form.name.trim()) return;

    setSaving(true);

    try {
      if (editingId) {
        await updatePilot(editingId, form);

        // Se stavo modificando il pilota attualmente attivo, aggiorna
        // anche il nome mostrato altrove nell'app (es. Garage).
        if (editingId === activePilotId) {
          setPilot(editingId, form.name);
        }
      } else {
        const result = await createPilot(form);

        // Un pilota appena creato diventa automaticamente attivo lato
        // server (vedi createPilot -> deactivatePilots), quindi
        // sincronizziamo subito anche lo store del client.
        setPilot(result.id, form.name);
      }

      await queryClient.invalidateQueries({ queryKey: ["pilots"] });
      cancelForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(pilot: Pilot) {
    setBusyId(pilot.id);

    try {
      await activatePilot(pilot.id);
      setPilot(pilot.id, pilot.name);
      await queryClient.invalidateQueries({ queryKey: ["pilots"] });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profilo pilota"
        description="Il pilota attivo è quello di cui il coach conosce caratteristiche e stile di guida."
        action={
          !formOpen && (
            <Button onClick={startCreate}>
              <Plus className="size-4" />
              Nuovo pilota
            </Button>
          )
        }
      />

      {formOpen && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? "Modifica pilota" : "Nuovo pilota"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pilot-name">Nome</Label>
                <Input
                  id="pilot-name"
                  placeholder="Come ti chiami"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pilot-level">Livello</Label>
                <Input
                  id="pilot-level"
                  placeholder="Es. amatoriale avanzato"
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pilot-experience">Esperienza</Label>
                <Input
                  id="pilot-experience"
                  placeholder="Es. 3 anni su iRacing"
                  value={form.experience}
                  onChange={(e) =>
                    setForm({ ...form, experience: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pilot-style">Stile di guida</Label>
                <Input
                  id="pilot-style"
                  placeholder="Es. aggressivo in staccata"
                  value={form.drivingStyle}
                  onChange={(e) =>
                    setForm({ ...form, drivingStyle: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={save} disabled={saving}>
                {saving
                  ? "Salvataggio..."
                  : editingId
                    ? "Aggiorna pilota"
                    : "Salva pilota"}
              </Button>

              <Button variant="ghost" onClick={cancelForm} disabled={saving}>
                Annulla
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-sm font-medium">Piloti salvati</h2>

        {isPending && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        )}

        {!isPending && (!data?.items || data.items.length === 0) && (
          <Card className="border-dashed">
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Nessun pilota ancora. Creane uno per iniziare.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.items?.map((pilot) => (
            <Card
              key={pilot.id}
              onClick={() => {
                if (!pilot.isActive) handleActivate(pilot);
              }}
              className={
                pilot.isActive
                  ? "border-primary/60 bg-primary/5"
                  : "hover:border-foreground/20 cursor-pointer transition-colors"
              }
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{pilot.name}</span>

                  {pilot.isActive && <Badge>Attivo</Badge>}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <dl className="text-muted-foreground space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="shrink-0">Livello:</dt>
                    <dd className="text-foreground truncate">
                      {pilot.level ?? "-"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">Esperienza:</dt>
                    <dd className="text-foreground truncate">
                      {pilot.experience ?? "-"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0">Stile:</dt>
                    <dd className="text-foreground truncate">
                      {pilot.drivingStyle ?? "-"}
                    </dd>
                  </div>
                </dl>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground text-xs">
                    {pilot.isActive
                      ? "In uso dal coach"
                      : busyId === pilot.id
                        ? "Attivazione..."
                        : "Click per attivare"}
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(pilot);
                    }}
                  >
                    <Pencil className="size-3.5" />
                    Modifica
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
