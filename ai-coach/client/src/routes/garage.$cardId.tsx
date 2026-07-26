import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createProblem,
  createSetup,
  deleteProblem,
  deleteSetup,
  getCar,
  getProblems,
  getSetups,
  updateCar,
  updateProblem,
  updateSetup,
  type CarProblem,
  type Setup,
} from "../services/garage.api.ts";

export const Route = createFileRoute("/garage/$cardId")({
  component: GarageCarDetailPage,
});

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

const emptyProblemForm = {
  phase: "Entry",
  problem: "Understeer",
  severity: "1",
  notes: "",
};

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
    <div className="space-y-6 p-6">
      <div>
        <Link to="/garage" className="text-sm underline">
          ← Torna al garage
        </Link>

        <h1 className="mt-3 text-2xl font-bold">{car?.name ?? "Auto"}</h1>

        <p className="text-sm text-gray-500">
          {car?.manufacturer ?? "Senza marca"} ·{" "}
          {car?.category ?? "Senza categoria"} ·{" "}
          {car?.simulator ?? "Senza simulatore"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-semibold">Setup</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded border p-2"
              placeholder="Nome setup"
              value={setupForm.name}
              onChange={(e) =>
                setSetupForm({ ...setupForm, name: e.target.value })
              }
            />
            <input
              className="rounded border p-2"
              placeholder="Brake Bias"
              value={setupForm.brakeBias}
              onChange={(e) =>
                setSetupForm({ ...setupForm, brakeBias: e.target.value })
              }
            />
            <input
              className="rounded border p-2"
              placeholder="Front Ride Height"
              value={setupForm.frontRideHeight}
              onChange={(e) =>
                setSetupForm({ ...setupForm, frontRideHeight: e.target.value })
              }
            />
            <input
              className="rounded border p-2"
              placeholder="Rear Ride Height"
              value={setupForm.rearRideHeight}
              onChange={(e) =>
                setSetupForm({ ...setupForm, rearRideHeight: e.target.value })
              }
            />
            <input
              className="rounded border p-2"
              placeholder="Front Camber"
              value={setupForm.frontCamber}
              onChange={(e) =>
                setSetupForm({ ...setupForm, frontCamber: e.target.value })
              }
            />
            <input
              className="rounded border p-2"
              placeholder="Rear Camber"
              value={setupForm.rearCamber}
              onChange={(e) =>
                setSetupForm({ ...setupForm, rearCamber: e.target.value })
              }
            />
            <input
              className="rounded border p-2"
              placeholder="Front Toe"
              value={setupForm.frontToe}
              onChange={(e) =>
                setSetupForm({ ...setupForm, frontToe: e.target.value })
              }
            />
            <input
              className="rounded border p-2"
              placeholder="Rear Toe"
              value={setupForm.rearToe}
              onChange={(e) =>
                setSetupForm({ ...setupForm, rearToe: e.target.value })
              }
            />
            <input
              className="rounded border p-2"
              placeholder="Front ARB"
              value={setupForm.frontARB}
              onChange={(e) =>
                setSetupForm({ ...setupForm, frontARB: e.target.value })
              }
            />
            <input
              className="rounded border p-2"
              placeholder="Rear ARB"
              value={setupForm.rearARB}
              onChange={(e) =>
                setSetupForm({ ...setupForm, rearARB: e.target.value })
              }
            />
            <input
              className="rounded border p-2"
              placeholder="Front Spring"
              value={setupForm.frontSpring}
              onChange={(e) =>
                setSetupForm({ ...setupForm, frontSpring: e.target.value })
              }
            />
            <input
              className="rounded border p-2"
              placeholder="Rear Spring"
              value={setupForm.rearSpring}
              onChange={(e) =>
                setSetupForm({ ...setupForm, rearSpring: e.target.value })
              }
            />
            <input
              className="rounded border p-2"
              placeholder="Diff Preload"
              value={setupForm.diffPreload}
              onChange={(e) =>
                setSetupForm({ ...setupForm, diffPreload: e.target.value })
              }
            />
          </div>

          <textarea
            className="mt-3 w-full rounded border p-2"
            placeholder="Note setup"
            value={setupForm.notes}
            onChange={(e) =>
              setSetupForm({ ...setupForm, notes: e.target.value })
            }
          />

          <div className="mt-3 flex gap-3">
            <button
              className="rounded border px-4 py-2 disabled:opacity-50"
              onClick={saveSetup}
              disabled={savingSetup}
            >
              {savingSetup
                ? "Salvataggio..."
                : editingSetupId
                  ? "Aggiorna setup"
                  : "Salva setup"}
            </button>

            {editingSetupId && (
              <button
                className="rounded border px-4 py-2"
                onClick={cancelEditSetup}
                disabled={savingSetup}
              >
                Annulla
              </button>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="font-semibold">Setup salvati</h3>
            {setupsQuery.data?.items?.map((setup) => (
              <div key={setup.id} className="rounded border p-3">
                <div className="font-medium">{setup.name}</div>
                <div className="text-sm text-gray-500">
                  BB {setup.brakeBias ?? "-"} · Camber F{" "}
                  {setup.frontCamber ?? "-"} / R {setup.rearCamber ?? "-"}
                </div>
                {setup.notes && (
                  <div className="mt-2 text-sm">{setup.notes}</div>
                )}

                <div className="mt-3 flex gap-3">
                  <button
                    className="text-sm text-blue-600 underline"
                    onClick={() => startEditSetup(setup)}
                  >
                    Modifica
                  </button>
                  <button
                    className="text-sm text-red-600 underline disabled:opacity-50"
                    disabled={busySetupId === setup.id}
                    onClick={() => removeSetup(setup.id)}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h2 className="mb-4 text-lg font-semibold">Problemi ricorrenti</h2>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded border p-2"
                placeholder="Phase"
                value={problemForm.phase}
                onChange={(e) =>
                  setProblemForm({ ...problemForm, phase: e.target.value })
                }
              />
              <input
                className="rounded border p-2"
                placeholder="Problem"
                value={problemForm.problem}
                onChange={(e) =>
                  setProblemForm({ ...problemForm, problem: e.target.value })
                }
              />
              <input
                className="rounded border p-2"
                placeholder="Severity"
                value={problemForm.severity}
                onChange={(e) =>
                  setProblemForm({ ...problemForm, severity: e.target.value })
                }
              />
            </div>

            <textarea
              className="mt-3 w-full rounded border p-2"
              placeholder="Note problema"
              value={problemForm.notes}
              onChange={(e) =>
                setProblemForm({ ...problemForm, notes: e.target.value })
              }
            />

            <div className="mt-3 flex gap-3">
              <button
                className="rounded border px-4 py-2 disabled:opacity-50"
                onClick={saveProblem}
                disabled={savingProblem}
              >
                {savingProblem
                  ? "Salvataggio..."
                  : editingProblemId
                    ? "Aggiorna problema"
                    : "Salva problema"}
              </button>

              {editingProblemId && (
                <button
                  className="rounded border px-4 py-2"
                  onClick={cancelEditProblem}
                  disabled={savingProblem}
                >
                  Annulla
                </button>
              )}
            </div>

            <div className="mt-6 space-y-3">
              {problemsQuery.data?.items?.map((problem) => (
                <div key={problem.id} className="rounded border p-3">
                  <div className="font-medium">
                    {problem.phase} · {problem.problem}
                  </div>
                  <div className="text-sm text-gray-500">
                    Severità {problem.severity ?? "-"}
                  </div>
                  {problem.notes && (
                    <div className="mt-2 text-sm">{problem.notes}</div>
                  )}

                  <div className="mt-3 flex gap-3">
                    <button
                      className="text-sm text-blue-600 underline"
                      onClick={() => startEditProblem(problem)}
                    >
                      Modifica
                    </button>
                    <button
                      className="text-sm text-red-600 underline disabled:opacity-50"
                      disabled={busyProblemId === problem.id}
                      onClick={() => removeProblem(problem.id)}
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Dettagli auto</h2>
              {car && !carForm && (
                <button
                  className="text-sm text-blue-600 underline"
                  onClick={startEditCar}
                >
                  Modifica
                </button>
              )}
            </div>

            {carQuery.isPending && <p>Caricamento...</p>}

            {car && !carForm && (
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Marca:</strong> {car.manufacturer ?? "-"}
                </div>
                <div>
                  <strong>Categoria:</strong> {car.category ?? "-"}
                </div>
                <div>
                  <strong>Simulatore:</strong> {car.simulator ?? "-"}
                </div>
                <div>
                  <strong>Note:</strong> {car.notes ?? "-"}
                </div>
              </div>
            )}

            {carForm && (
              <div className="space-y-3">
                <input
                  className="w-full rounded border p-2"
                  placeholder="Marca"
                  value={carForm.manufacturer}
                  onChange={(e) =>
                    setCarForm({ ...carForm, manufacturer: e.target.value })
                  }
                />
                <input
                  className="w-full rounded border p-2"
                  placeholder="Nome auto"
                  value={carForm.name}
                  onChange={(e) =>
                    setCarForm({ ...carForm, name: e.target.value })
                  }
                />
                <input
                  className="w-full rounded border p-2"
                  placeholder="Simulatore"
                  value={carForm.simulator}
                  onChange={(e) =>
                    setCarForm({ ...carForm, simulator: e.target.value })
                  }
                />
                <input
                  className="w-full rounded border p-2"
                  placeholder="Categoria"
                  value={carForm.category}
                  onChange={(e) =>
                    setCarForm({ ...carForm, category: e.target.value })
                  }
                />
                <textarea
                  className="w-full rounded border p-2"
                  placeholder="Note"
                  value={carForm.notes}
                  onChange={(e) =>
                    setCarForm({ ...carForm, notes: e.target.value })
                  }
                />

                <div className="flex gap-3">
                  <button
                    className="rounded border px-4 py-2 disabled:opacity-50"
                    onClick={saveCar}
                    disabled={savingCar}
                  >
                    {savingCar ? "Salvataggio..." : "Salva"}
                  </button>
                  <button
                    className="rounded border px-4 py-2"
                    onClick={() => setCarForm(null)}
                    disabled={savingCar}
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
