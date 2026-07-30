import { useQuery } from "@tanstack/react-query";

import { getActivePilot } from "@/services/profile.api";

export const ACTIVE_PILOT_KEY = ["active-pilot"];

// Il pilota attivo viene dal server, non da localStorage.
//
// Prima viveva in uno store Zustand persistito nel browser, in
// parallelo alla colonna isActive sul database: le due copie potevano
// divergere, e quando succedeva Garage, Circuiti e Telemetria
// filtravano per un pilota diverso da quello attivo e sembravano
// vuoti. Bastava aprire l'app da un altro browser per vederlo.
//
// Chi cambia il pilota attivo (attivazione, creazione, import di una
// telemetria) deve invalidare ACTIVE_PILOT_KEY.
export function useActivePilot() {
  const query = useQuery({
    queryKey: ACTIVE_PILOT_KEY,
    queryFn: getActivePilot,
  });

  return {
    pilot: query.data?.pilot ?? null,
    pilotId: query.data?.pilot?.id ?? null,
    pilotName: query.data?.pilot?.name ?? null,
    // Distinto da "non c'e' pilota": finche' la richiesta e' in corso
    // non si sa ancora, e le pagine non devono mostrare "nessun pilota".
    isPending: query.isPending,
  };
}
