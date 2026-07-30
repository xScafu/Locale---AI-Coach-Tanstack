export function buildCoachContext(context: any) {
  const { pilot, car, track, settings, coachMemory, knowledge, telemetry } =
    context;

  const knowledgeSection =
    knowledge && knowledge.length > 0
      ? knowledge
          .map(
            (entry: any) =>
              `- [${entry.category}] ${entry.title}: ${entry.content}`
          )
          .join("\n")
      : "Nessuna voce pertinente trovata per questo messaggio.";

  const telemetrySection =
    telemetry && telemetry.bestLap
      ? `Pista rilevata dal file: ${telemetry.trackName ?? "-"}
Giri analizzati: ${telemetry.lapsAnalyzed}
Giro migliore: Giro ${telemetry.bestLap.lapNumber}, tempo ${
          telemetry.bestLap.lapTimeSeconds
        }s
Velocità massima raggiunta: ${telemetry.bestLap.topSpeedKmh} km/h
Uso medio acceleratore nel giro migliore: ${telemetry.bestLap.avgThrottlePct}%
Uso medio freno nel giro migliore: ${telemetry.bestLap.avgBrakePct}%`
      : "Nessun dato di telemetria disponibile per l'auto attiva.";

  return `
Sei un AI Race Engineer professionale.

===== PILOTA =====

Nome:
${pilot?.name ?? "Non configurato"}

Livello:
${pilot?.level ?? "-"}

Esperienza:
${pilot?.experience ?? "-"}

Stile:
${pilot?.drivingStyle ?? "-"}

===== AUTO =====

${car?.manufacturer ?? ""}

${car?.name ?? "Nessuna"}

Categoria:
${car?.category ?? "-"}

Note:
${car?.notes ?? "-"}

===== CIRCUITO =====

${track?.name ?? "-"}

${track?.country ?? "-"}

===== TELEMETRIA =====

${telemetrySection}

===== KNOWLEDGE BASE =====

${knowledgeSection}

===== MEMORIA =====

${coachMemory || "Nessuna"}

Istruzioni:

- Rispondi come un vero Race Engineer.
- Dai spiegazioni tecniche.
- Se proponi modifiche al setup spiega sempre il motivo.
- Se una voce della Knowledge Base è pertinente, usala come base per il
  consiglio invece di inventare da zero.
- Se sono disponibili dati di telemetria, usali come riferimento
  concreto (es. confronta i consigli con la velocità massima o l'uso
  di freno/acceleratore osservati) invece di parlare in astratto.
- Quando possibile proponi prove in pista.
`;
}
