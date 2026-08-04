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

  const reference = profile.reference;

  if (reference) {
    lines.push("");
    lines.push(
      `Confronto su ${reference.lapsAnalyzed} giri completi dello stesso stint:`
    );

    if (reference.theoreticalLapSeconds !== null) {
      lines.push(
        `- Giro migliore ${reference.bestLapSeconds}s, giro teorico ` +
          `${reference.theoreticalLapSeconds}s (somma dei settori migliori): ` +
          `${reference.potentialGainSeconds}s gia' alla portata del pilota ` +
          "senza migliorare nulla di nuovo, solo mettendo insieme cio' che ha " +
          "gia' fatto."
      );
    }

    // Solo le curve dove c'e' davvero margine: elencarle tutte
    // annacquerebbe il segnale.
    const gaps = reference.corners
      .filter((c: any) => c.deltaKmh >= 3)
      .sort((a: any, b: any) => b.deltaKmh - a.deltaKmh)
      .slice(0, 5);

    if (gaps.length > 0) {
      lines.push(
        "- Curve dove il pilota e' gia' passato piu' veloce in un altro giro " +
          "(nel giro migliore -> suo massimo, giro di riferimento):"
      );

      for (const c of gaps) {
        lines.push(
          `  Curva ${c.number}: ${c.bestLapMinSpeedKmh} -> ${c.bestMinSpeedKmh} km/h ` +
            `(+${c.deltaKmh}, giro ${c.bestLapNumber})`
        );
      }
    }
  }

  return lines.join("\n");
}

import { describeAdjustableSettingsByArea } from "./svm.service";

// I campi del setup con la loro etichetta: elencarli come dati evita
// tredici righe di stringhe quasi identiche e tiene fuori dal prompt
// quelli non compilati.
const SETUP_FIELDS: [string, string][] = [
  ["brakeBias", "Brake bias"],
  ["frontRideHeight", "Altezza anteriore"],
  ["rearRideHeight", "Altezza posteriore"],
  ["frontCamber", "Camber anteriore"],
  ["rearCamber", "Camber posteriore"],
  ["frontToe", "Convergenza anteriore"],
  ["rearToe", "Convergenza posteriore"],
  ["frontARB", "Barra antirollio anteriore"],
  ["rearARB", "Barra antirollio posteriore"],
  ["frontSpring", "Molla anteriore"],
  ["rearSpring", "Molla posteriore"],
  ["diffPreload", "Precarico differenziale"],
];

function buildSetupSection(setup: any, car: any) {
  if (!car) {
    return "Nessuna auto attiva, quindi nessun setup da analizzare.";
  }

  if (!setup) {
    // Il coach non deve inventare i valori di partenza: senza un setup
    // caricato non sa da dove il pilota parte, e qualsiasi modifica
    // proposta sarebbe campata in aria.
    return `Nessun setup attivo per questa auto.

NON proporre modifiche al setup, non inventare valori di partenza e
lascia setupChanges vuoto.
Se il pilota chiede aiuto sul setup, spiega che ti serve prima il suo
setup attuale e invitalo a caricarlo con il pulsante di caricamento
nella scheda Setup, a destra della chat. Il file e' quello con
estensione .svm esportato da Le Mans Ultimate.`;
  }

  const lines: string[] = [`Setup attivo: ${setup.name}`];

  if (setup.notes) lines.push(`Note del pilota sul setup: ${setup.notes}`);

  // Con il file .svm originale il coach vede TUTTE le regolazioni
  // dell'auto — ala, mappe TC, ammortizzatori, migration — non solo le
  // dodici che l'app tiene in colonne dedicate.
  if (setup.sourceSvm) {
    const areas = describeAdjustableSettingsByArea(setup.sourceSvm);

    lines.push("");
    lines.push(
      "Regolazioni disponibili su questa auto, nel formato " +
        "SEZIONE.Chiave = indice (valore attuale). Sono TUTTE modificabili:"
    );

    for (const area of areas) {
      lines.push("");
      lines.push(`${area.label}:`);
      lines.push(...area.entries.map((s) => `- ${s}`));
    }

    lines.push("");
    lines.push(
      `L'interfaccia del gioco lavora a CLICK: ogni scatto e' +1 o -1
sull'indice, e la scala che lega indice e valore leggibile cambia da
auto ad auto. Non proporre quindi un valore finale, ma di quanti click
muovere: nel campo setupChanges usa "setting" con il percorso ESATTO
copiato dall'elenco qui sopra e "deltaClicks" con lo spostamento
(negativo per scendere). Nella prosa spiega la modifica anche in termini
comprensibili, citando il valore attuale.

Dove l'elenco mostra un percorso che inizia con FRONT. o REAR., quello
vale gia' per entrambi i lati: usalo cosi' com'e', non scrivere
FRONTLEFT o FRONTRIGHT.

Scegli le leve piu' adatte al problema descritto, spaziando su tutta la
vettura invece di tornare sempre sulle stesse: le barre antirollio e
l'ala sono spesso lo strumento piu' diretto per spostare il bilanciamento,
il differenziale agisce su trazione e rotazione in uscita, gli
ammortizzatori sui trasferimenti di carico, il brake bias e la migration
sull'ingresso in staccata. Il camber e la convergenza sono regolazioni
fini: non usarli come prima risposta a un problema di bilanciamento.

Se non sei certo del verso di una regolazione su questa auto, dillo
invece di indovinare. Il verso non e' sempre intuitivo: per il camber,
per esempio, un indice piu' ALTO significa camber MENO negativo.`
    );
  } else {
    // Setup creato a mano: restano solo i dodici valori dell'app e non
    // c'e' modo di generare un file per il simulatore.
    for (const [key, label] of SETUP_FIELDS) {
      const value = setup[key];
      if (value !== null && value !== undefined) {
        lines.push(`- ${label}: ${value}`);
      }
    }

    lines.push("");
    lines.push(
      "Questo setup e' stato inserito a mano e non ha un file .svm di " +
        "origine, quindi non e' esportabile verso il simulatore e non si " +
        "puo' ragionare a click: lascia setupChanges vuoto e limitati a " +
        "consigli descrittivi."
    );
  }

  return lines.join("\n");
}

export function buildCoachContext(context: any) {
  const {
    pilot,
    car,
    track,
    settings,
    coachMemory,
    knowledge,
    telemetry,
    setup,
  } = context;

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

===== SETUP =====

${buildSetupSection(setup, car)}

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
