import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Pencil, Trash2, Upload } from "lucide-react";

import {
  createProblem,
  createSetup,
  deleteProblem,
  deleteSetup,
  getCar,
  getProblems,
  getSetups,
  importSetupFile,
  updateCar,
  updateProblem,
  updateSetup,
  type CarProblem,
  type Setup,
} from "@/services/garage.api";
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
import { Textarea } from "@/components/ui/textarea";

const emptySetupForm = {
  name: "Setup Base",
  brakeBias: "",
  frontRideHeight: "",
  rearRideHeight: "",
  frontCamber: "",
  rearCamber: "",
  frontToe: "",
  rearToe: "",
  frontARB: "",
  rearARB: "",
  frontSpring: "",
  rearSpring: "",
  diffPreload: "",
  notes: "",
};

type SetupFormKey = keyof Omit<typeof emptySetupForm, "name" | "notes">;

// I 13 campi numerici del setup differiscono solo per chiave ed
// etichetta: elencarli come dati evita 13 blocchi di JSX identici.
const SETUP_FIELDS: { key: SetupFormKey; label: string }[] = [
  { key: "brakeBias", label: "Brake bias" },
  { key: "frontRideHeight", label: "Altezza ant." },
  { key: "rearRideHeight", label: "Altezza post." },
  { key: "frontCamber", label: "Camber ant." },
  { key: "rearCamber", label: "Camber post." },
  { key: "frontToe", label: "Convergenza ant." },
  { key: "rearToe", label: "Convergenza post." },
  { key: "frontARB", label: "Barra ant." },
  { key: "rearARB", label: "Barra post." },
  { key: "frontSpring", label: "Molla ant." },
  { key: "rearSpring", label: "Molla post." },
  { key: "diffPreload", label: "Precarico diff." },
];

const emptyProblemForm = {
  phase: "Entry",
  problem: "Understeer",
  severity: "1",
  notes: "",
};

export const Route = createFileRoute("/garage/$carId")({
  component: GarageCarDetailPage,
});

function setupToForm(setup: Setup) {
  return {
    name: setup.name,
    brakeBias: setup.brakeBias?.toString() ?? "",
    frontRideHeight: setup.frontRideHeight?.toString() ?? "",
    rearRideHeight: setup.rearRideHeight?.toString() ?? "",
    frontCamber: setup.frontCamber?.toString() ?? "",
    rearCamber: setup.rearCamber?.toString() ?? "",
    frontToe: setup.frontToe?.toString() ?? "",
    rearToe: setup.rearToe?.toString() ?? "",
    frontARB: setup.frontARB?.toString() ?? "",
    rearARB: setup.rearARB?.toString() ?? "",
    frontSpring: setup.frontSpring?.toString() ?? "",
    rearSpring: setup.rearSpring?.toString() ?? "",
    diffPreload: setup.diffPreload?.toString() ?? "",
    notes: setup.notes ?? "",
  };
}

function problemToForm(problem: CarProblem) {
  return {
    phase: problem.phase,
    problem: problem.problem,
    severity: problem.severity?.toString() ?? "1",
    notes: problem.notes ?? "",
  };
}

function GarageCarDetailPage() {
  const { carId } = Route.useParams();
  const queryClient = useQueryClient();

  const carQuery = useQuery({
    queryKey: ["car", carId],
    queryFn: () => getCar(carId),
  });

  const setupsQuery = useQuery({
    queryKey: ["setups", carId],
    queryFn: () => getSetups(carId),
  });

  const problemsQuery = useQuery({
    queryKey: ["problems", carId],
    queryFn: () => getProblems(carId),
  });

  const car = carQuery.data?.car;

  // ---------- Dati auto ----------

  const [carForm, setCarForm] = useState<{
    manufacturer: string;
    name: string;
    simulator: string;
    category: string;
    notes: string;
  } | null>(null);

  const [savingCar, setSavingCar] = useState(false);

  function startEditCar() {
    if (!car) return;
    setCarForm({
      manufacturer: car.manufacturer ?? "",
      name: car.name,
      simulator: car.simulator ?? "",
      category: car.category ?? "",
      notes: car.notes ?? "",
    });
  }

  async function saveCar() {
    if (!carForm || !carForm.name.trim()) return;

    setSavingCar(true);

    try {
      await updateCar(carId, carForm);
      await queryClient.invalidateQueries({ queryKey: ["car", carId] });
      setCarForm(null);
    } finally {
      setSavingCar(false);
    }
  }

  // ---------- Setup ----------

  const [setupForm, setSetupForm] = useState(emptySetupForm);
  const [editingSetupId, setEditingSetupId] = useState<string | null>(null);
  const [savingSetup, setSavingSetup] = useState(false);
  const [busySetupId, setBusySetupId] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<Record<
    string,
    string
  > | null>(null);

  async function handleImportSvm(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      const result = await importSetupFile(carId, file);

      setImportPreview(result.keyValues);

      // Precompila solo i campi per cui è stato trovato un valore
      // numerico plausibile: il resto del form resta come l'utente lo
      // aveva lasciato, da completare/verificare a mano.
      setSetupForm((prev) => ({
        ...prev,
        name: prev.name === emptySetupForm.name ? result.fileName : prev.name,
        brakeBias: result.suggestions.brakeBias?.toString() ?? prev.brakeBias,
        frontRideHeight:
          result.suggestions.frontRideHeight?.toString() ??
          prev.frontRideHeight,
        rearRideHeight:
          result.suggestions.rearRideHeight?.toString() ?? prev.rearRideHeight,
        frontCamber:
          result.suggestions.frontCamber?.toString() ?? prev.frontCamber,
        rearCamber:
          result.suggestions.rearCamber?.toString() ?? prev.rearCamber,
        frontToe: result.suggestions.frontToe?.toString() ?? prev.frontToe,
        rearToe: result.suggestions.rearToe?.toString() ?? prev.rearToe,
        frontARB: result.suggestions.frontARB?.toString() ?? prev.frontARB,
        rearARB: result.suggestions.rearARB?.toString() ?? prev.rearARB,
        frontSpring:
          result.suggestions.frontSpring?.toString() ?? prev.frontSpring,
        rearSpring:
          result.suggestions.rearSpring?.toString() ?? prev.rearSpring,
        diffPreload:
          result.suggestions.diffPreload?.toString() ?? prev.diffPreload,
      }));
    } finally {
      setImporting(false);
    }
  }

  function startEditSetup(setup: Setup) {
    setEditingSetupId(setup.id);
    setSetupForm(setupToForm(setup));
  }

  function cancelEditSetup() {
    setEditingSetupId(null);
    setSetupForm(emptySetupForm);
  }

  function buildSetupPayload() {
    return {
      name: setupForm.name,
      brakeBias: setupForm.brakeBias ? Number(setupForm.brakeBias) : null,
      frontRideHeight: setupForm.frontRideHeight
        ? Number(setupForm.frontRideHeight)
        : null,
      rearRideHeight: setupForm.rearRideHeight
        ? Number(setupForm.rearRideHeight)
        : null,
      frontCamber: setupForm.frontCamber ? Number(setupForm.frontCamber) : null,
      rearCamber: setupForm.rearCamber ? Number(setupForm.rearCamber) : null,
      frontToe: setupForm.frontToe ? Number(setupForm.frontToe) : null,
      rearToe: setupForm.rearToe ? Number(setupForm.rearToe) : null,
      frontARB: setupForm.frontARB ? Number(setupForm.frontARB) : null,
      rearARB: setupForm.rearARB ? Number(setupForm.rearARB) : null,
      frontSpring: setupForm.frontSpring ? Number(setupForm.frontSpring) : null,
      rearSpring: setupForm.rearSpring ? Number(setupForm.rearSpring) : null,
      diffPreload: setupForm.diffPreload ? Number(setupForm.diffPreload) : null,
      notes: setupForm.notes,
    };
  }

  async function saveSetup() {
    setSavingSetup(true);

    try {
      if (editingSetupId) {
        await updateSetup(editingSetupId, buildSetupPayload());
      } else {
        await createSetup({ carId, ...buildSetupPayload() });
      }

      queryClient.invalidateQueries({ queryKey: ["setups", carId] });
      cancelEditSetup();
    } finally {
      setSavingSetup(false);
    }
  }

  async function removeSetup(id: string) {
    if (!confirm("Eliminare questo setup?")) return;

    setBusySetupId(id);

    try {
      await deleteSetup(id);
      queryClient.invalidateQueries({ queryKey: ["setups", carId] });

      if (editingSetupId === id) {
        cancelEditSetup();
      }
    } finally {
      setBusySetupId(null);
    }
  }

  // ---------- Problemi ----------

  const [problemForm, setProblemForm] = useState(emptyProblemForm);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [savingProblem, setSavingProblem] = useState(false);
  const [busyProblemId, setBusyProblemId] = useState<string | null>(null);

  function startEditProblem(problem: CarProblem) {
    setEditingProblemId(problem.id);
    setProblemForm(problemToForm(problem));
  }

  function cancelEditProblem() {
    setEditingProblemId(null);
    setProblemForm(emptyProblemForm);
  }

  async function saveProblem() {
    setSavingProblem(true);

    try {
      const payload = {
        phase: problemForm.phase,
        problem: problemForm.problem,
        severity: Number(problemForm.severity),
        notes: problemForm.notes,
      };

      if (editingProblemId) {
        await updateProblem(editingProblemId, payload);
      } else {
        await createProblem({ carId, ...payload });
      }

      queryClient.invalidateQueries({ queryKey: ["problems", carId] });
      cancelEditProblem();
    } finally {
      setSavingProblem(false);
    }
  }

  async function removeProblem(id: string) {
    if (!confirm("Eliminare questo problema?")) return;

    setBusyProblemId(id);

    try {
      await deleteProblem(id);
      queryClient.invalidateQueries({ queryKey: ["problems", carId] });

      if (editingProblemId === id) {
        cancelEditProblem();
      }
    } finally {
      setBusyProblemId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/garage">
            <ArrowLeft className="size-4" />
            Torna al garage
          </Link>
        </Button>

        {carQuery.isPending ? (
          <Skeleton className="mt-3 h-8 w-56" />
        ) : (
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {car?.name ?? "Auto"}
          </h1>
        )}

        <p className="text-muted-foreground mt-1 text-sm">
          {car?.manufacturer ?? "Senza marca"} ·{" "}
          {car?.category ?? "Senza categoria"} ·{" "}
          {car?.simulator ?? "Senza simulatore"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>
              {editingSetupId ? "Modifica setup" : "Nuovo setup"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-lg border border-dashed p-3">
              <Label htmlFor="svm" className="text-sm font-medium">
                <Upload className="size-4" />
                Importa da file .svm (LMU)
              </Label>

              <Input
                id="svm"
                type="file"
                accept=".svm"
                className="mt-2 cursor-pointer"
                disabled={importing}
                onChange={handleImportSvm}
              />

              <p className="text-muted-foreground mt-2 text-xs">
                I valori vengono precompilati come suggerimento: verificali
                prima di salvare, il parser è "best effort" e non conosce con
                certezza il formato esatto di LMU.
              </p>

              {importPreview && (
                <details className="mt-2 text-xs">
                  <summary className="text-primary cursor-pointer">
                    Vedi tutti i campi trovati nel file (
                    {Object.keys(importPreview).length})
                  </summary>

                  <div className="bg-muted mt-2 max-h-48 overflow-y-auto rounded p-2">
                    {Object.entries(importPreview).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="font-mono">{value}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-name">Nome setup</Label>
              <Input
                id="setup-name"
                value={setupForm.name}
                onChange={(e) =>
                  setSetupForm({ ...setupForm, name: e.target.value })
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {SETUP_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`setup-${field.key}`} className="text-xs">
                    {field.label}
                  </Label>
                  <Input
                    id={`setup-${field.key}`}
                    inputMode="decimal"
                    className="font-mono"
                    value={setupForm[field.key]}
                    onChange={(e) =>
                      setSetupForm({
                        ...setupForm,
                        [field.key]: e.target.value,
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-notes">Note setup</Label>
              <Textarea
                id="setup-notes"
                rows={3}
                value={setupForm.notes}
                onChange={(e) =>
                  setSetupForm({ ...setupForm, notes: e.target.value })
                }
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={saveSetup} disabled={savingSetup}>
                {savingSetup
                  ? "Salvataggio..."
                  : editingSetupId
                    ? "Aggiorna setup"
                    : "Salva setup"}
              </Button>

              {editingSetupId && (
                <Button
                  variant="ghost"
                  onClick={cancelEditSetup}
                  disabled={savingSetup}
                >
                  Annulla
                </Button>
              )}
            </div>

            <div className="space-y-3 border-t pt-5">
              <h3 className="text-sm font-medium">Setup salvati</h3>

              {setupsQuery.isPending && <Skeleton className="h-24 rounded-lg" />}

              {!setupsQuery.isPending &&
                setupsQuery.data?.items?.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    Nessun setup salvato per quest'auto.
                  </p>
                )}

              {setupsQuery.data?.items?.map((setup) => (
                <div key={setup.id} className="rounded-lg border p-3">
                  <div className="truncate font-medium">{setup.name}</div>

                  <div className="text-muted-foreground mt-0.5 font-mono text-sm">
                    BB {setup.brakeBias ?? "-"} · Camber F{" "}
                    {setup.frontCamber ?? "-"} / R {setup.rearCamber ?? "-"}
                  </div>

                  {setup.notes && (
                    <p className="mt-2 text-sm leading-relaxed">
                      {setup.notes}
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditSetup(setup)}
                    >
                      <Pencil className="size-3.5" />
                      Modifica
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={busySetupId === setup.id}
                      onClick={() => removeSetup(setup.id)}
                    >
                      <Trash2 className="size-3.5" />
                      Elimina
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Problemi ricorrenti</CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="problem-phase" className="text-xs">
                    Fase
                  </Label>
                  <Input
                    id="problem-phase"
                    placeholder="Entry"
                    value={problemForm.phase}
                    onChange={(e) =>
                      setProblemForm({ ...problemForm, phase: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="problem-what" className="text-xs">
                    Problema
                  </Label>
                  <Input
                    id="problem-what"
                    placeholder="Understeer"
                    value={problemForm.problem}
                    onChange={(e) =>
                      setProblemForm({
                        ...problemForm,
                        problem: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="problem-severity" className="text-xs">
                    Gravità
                  </Label>
                  <Input
                    id="problem-severity"
                    inputMode="numeric"
                    className="font-mono"
                    value={problemForm.severity}
                    onChange={(e) =>
                      setProblemForm({
                        ...problemForm,
                        severity: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="problem-notes">Note problema</Label>
                <Textarea
                  id="problem-notes"
                  rows={3}
                  value={problemForm.notes}
                  onChange={(e) =>
                    setProblemForm({ ...problemForm, notes: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-3">
                <Button onClick={saveProblem} disabled={savingProblem}>
                  {savingProblem
                    ? "Salvataggio..."
                    : editingProblemId
                      ? "Aggiorna problema"
                      : "Salva problema"}
                </Button>

                {editingProblemId && (
                  <Button
                    variant="ghost"
                    onClick={cancelEditProblem}
                    disabled={savingProblem}
                  >
                    Annulla
                  </Button>
                )}
              </div>

              <div className="space-y-3 border-t pt-5">
                {problemsQuery.isPending && (
                  <Skeleton className="h-20 rounded-lg" />
                )}

                {!problemsQuery.isPending &&
                  problemsQuery.data?.items?.length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      Nessun problema registrato.
                    </p>
                  )}

                {problemsQuery.data?.items?.map((problem) => (
                  <div key={problem.id} className="rounded-lg border p-3">
                    <div className="font-medium">
                      {problem.phase} · {problem.problem}
                    </div>

                    <div className="text-muted-foreground mt-0.5 text-sm">
                      Gravità {problem.severity ?? "-"}
                    </div>

                    {problem.notes && (
                      <p className="mt-2 text-sm leading-relaxed">
                        {problem.notes}
                      </p>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditProblem(problem)}
                      >
                        <Pencil className="size-3.5" />
                        Modifica
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={busyProblemId === problem.id}
                        onClick={() => removeProblem(problem.id)}
                      >
                        <Trash2 className="size-3.5" />
                        Elimina
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Dettagli auto</CardTitle>

              {car && !carForm && (
                <Button variant="outline" size="sm" onClick={startEditCar}>
                  <Pencil className="size-3.5" />
                  Modifica
                </Button>
              )}
            </CardHeader>

            <CardContent>
              {carQuery.isPending && <Skeleton className="h-28 rounded-lg" />}

              {car && !carForm && (
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-28 shrink-0">
                      Marca
                    </dt>
                    <dd>{car.manufacturer ?? "-"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-28 shrink-0">
                      Categoria
                    </dt>
                    <dd>{car.category ?? "-"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-28 shrink-0">
                      Simulatore
                    </dt>
                    <dd>{car.simulator ?? "-"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-28 shrink-0">
                      Note
                    </dt>
                    <dd className="whitespace-pre-wrap">{car.notes ?? "-"}</dd>
                  </div>
                </dl>
              )}

              {carForm && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-manufacturer">Marca</Label>
                      <Input
                        id="edit-manufacturer"
                        value={carForm.manufacturer}
                        onChange={(e) =>
                          setCarForm({
                            ...carForm,
                            manufacturer: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Nome auto</Label>
                      <Input
                        id="edit-name"
                        value={carForm.name}
                        onChange={(e) =>
                          setCarForm({ ...carForm, name: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-simulator">Simulatore</Label>
                      <Input
                        id="edit-simulator"
                        value={carForm.simulator}
                        onChange={(e) =>
                          setCarForm({ ...carForm, simulator: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-category">Categoria</Label>
                      <Input
                        id="edit-category"
                        value={carForm.category}
                        onChange={(e) =>
                          setCarForm({ ...carForm, category: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">Note</Label>
                    <Textarea
                      id="edit-notes"
                      rows={3}
                      value={carForm.notes}
                      onChange={(e) =>
                        setCarForm({ ...carForm, notes: e.target.value })
                      }
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={saveCar} disabled={savingCar}>
                      {savingCar ? "Salvataggio..." : "Salva"}
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => setCarForm(null)}
                      disabled={savingCar}
                    >
                      Annulla
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
