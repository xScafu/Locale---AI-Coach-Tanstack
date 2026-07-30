// Trasforma il profilo derivato dalla telemetria in poche righe dense.
// Le curve non hanno nome perche' sono rilevate dai dati, non da una
// mappa: il riferimento condiviso col pilota e' la distanza dal
// traguardo, che compare anche sul grafico della pagina Telemetria.
function buildTrackSection(track: any) {
  if (!track) return "Nessun circuito attivo.";

  const lines: string[] = [];

  lines.push(`Nome: ${track.name}`);
  if (track.country) lines.push(`Paese: ${track.country}`);
  if (track.variant && track.variant !== track.name) {
    lines.push(`Variante: ${track.variant}`);
  }
  if (track.lengthM) lines.push(`Lunghezza: ${Math.round(track.lengthM)} m`);
  if (track.cornerCount) lines.push(`Curve rilevate: ${track.cornerCount}`);
  if (track.referenceLapSeconds) {
    lines.push(`Tempo di riferimento del pilota: ${track.referenceLapSeconds}s`);
  }
  if (track.notes) lines.push(`Note del pilota: ${track.notes}`);

  let profile: any = null;

  try {
    profile = track.profile ? JSON.parse(track.profile) : null;
  } catch {
    profile = null;
  }

  if (!profile?.corners?.length) {
    lines.push(
      "Profilo curve: non disponibile (nessuna telemetria importata per questo circuito)."
    );

    return lines.join("\n");
  }

  lines.push(`Giro migliore analizzato: ${profile.bestLapSeconds}s`);
  lines.push("");
  lines.push(
    "Profilo curve dal giro migliore del pilota (distanze in metri dal traguardo):"
  );

  for (const c of profile.corners) {
    const braking =
      c.brakingDistanceM !== null && c.brakingDistanceM !== undefined
        ? `stacca ${c.brakingDistanceM}m prima`
        : "senza frenata";

    lines.push(
      `- Curva ${c.number} (${c.direction}) a ${c.entryM}m: minima ${c.minSpeedKmh} km/h, ` +
        `${c.peakLatG}G laterali, ${braking}, apice a ${c.apexM}m`
    );
  }

  lines.push("");
  lines.push(
    `Sono elencate solo le curve che superano ${profile.detection.latGThreshold}G: ` +
      "i curvoni percorsi in pieno non compaiono, perche' non richiedono " +
      "frenata ne' correzione di traiettoria con questa auto."
  );

  return lines.join("\n");
}

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

${buildTrackSection(track)}

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
- Il profilo curve viene dai dati reali di questo pilota su questo
  simulatore: quando parli di una curva, citala con la sua distanza dal
  traguardo e i suoi numeri, non con nomi presi dalla tua conoscenza
  del circuito reale, che nel simulatore possono non corrispondere.
- Quando possibile proponi prove in pista.
`;
}
