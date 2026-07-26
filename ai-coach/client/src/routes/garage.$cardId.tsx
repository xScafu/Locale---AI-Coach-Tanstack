import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createProblem,
  createSetup,
  getCar,
  getProblems,
  getSetups,
} from "../services/garage.api";

export const Route = createFileRoute("/garage/$cardId")({
  component: GarageCarDetailPage,
});

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

  const [setupForm, setSetupForm] = useState({
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
  });

  const [problemForm, setProblemForm] = useState({
    phase: "Entry",
    problem: "Understeer",
    severity: "1",
    notes: "",
  });

  const [savingSetup, setSavingSetup] = useState(false);
  const [savingProblem, setSavingProblem] = useState(false);

  async function saveSetup() {
    setSavingSetup(true);

    try {
      await createSetup({
        carId,
        name: setupForm.name,
        brakeBias: setupForm.brakeBias ? Number(setupForm.brakeBias) : null,
        frontRideHeight: setupForm.frontRideHeight
          ? Number(setupForm.frontRideHeight)
          : null,
        rearRideHeight: setupForm.rearRideHeight
          ? Number(setupForm.rearRideHeight)
          : null,
        frontCamber: setupForm.frontCamber
          ? Number(setupForm.frontCamber)
          : null,
        rearCamber: setupForm.rearCamber ? Number(setupForm.rearCamber) : null,
        frontToe: setupForm.frontToe ? Number(setupForm.frontToe) : null,
        rearToe: setupForm.rearToe ? Number(setupForm.rearToe) : null,
        frontARB: setupForm.frontARB ? Number(setupForm.frontARB) : null,
        rearARB: setupForm.rearARB ? Number(setupForm.rearARB) : null,
        frontSpring: setupForm.frontSpring
          ? Number(setupForm.frontSpring)
          : null,
        rearSpring: setupForm.rearSpring ? Number(setupForm.rearSpring) : null,
        diffPreload: setupForm.diffPreload
          ? Number(setupForm.diffPreload)
          : null,
        notes: setupForm.notes,
      });

      queryClient.invalidateQueries({ queryKey: ["setups", carId] });
    } finally {
      setSavingSetup(false);
    }
  }

  async function saveProblem() {
    setSavingProblem(true);

    try {
      await createProblem({
        carId,
        phase: problemForm.phase,
        problem: problemForm.problem,
        severity: Number(problemForm.severity),
        notes: problemForm.notes,
      });

      queryClient.invalidateQueries({ queryKey: ["problems", carId] });
    } finally {
      setSavingProblem(false);
    }
  }

  const car = carQuery.data?.car;

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

          <button
            className="mt-3 rounded border px-4 py-2 disabled:opacity-50"
            onClick={saveSetup}
            disabled={savingSetup}
          >
            {savingSetup ? "Salvataggio..." : "Salva setup"}
          </button>

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

            <button
              className="mt-3 rounded border px-4 py-2 disabled:opacity-50"
              onClick={saveProblem}
              disabled={savingProblem}
            >
              {savingProblem ? "Salvataggio..." : "Salva problema"}
            </button>

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
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="mb-4 text-lg font-semibold">Dettagli auto</h2>
            {carQuery.isPending && <p>Caricamento...</p>}
            {car && (
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
          </div>
        </div>
      </div>
    </div>
  );
}
