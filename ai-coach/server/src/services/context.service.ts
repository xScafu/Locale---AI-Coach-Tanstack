// I tempi sul giro nel formato in cui il pilota li legge a schermo,
// mm:ss:mmm. Averne due diversi — secondi nel prompt, mm:ss:mmm
// nell'interfaccia — costringerebbe il pilota a convertire a mente ogni
// numero che il coach gli dice.
//
// Gemella di client/src/lib/lap-time.ts. I due workspace non condividono
// tipi ne' codice: se cambia il formato, va cambiato in entrambi.
function formatLapTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "-";
  }

  // Arrotondare prima di spezzare: con 119.9996 i secondi verrebbero 59
  // e i millesimi 1000.
  const total = Math.round(seconds * 1000);

  const minutes = Math.floor(total / 60000);
  const secs = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;

  return [
    String(minutes).padStart(2, "0"),
    String(secs).padStart(2, "0"),
    String(millis).padStart(3, "0"),
  ].join(":");
}

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
  let profile: any = null;

  try {
    profile = track.profile ? JSON.parse(track.profile) : null;
  } catch {
    profile = null;
  }

  // Lunghezza e numero curve devono venire dalla STESSA fonte
  // dell'elenco qui sotto. Le colonne di `tracks` vengono riempite solo
  // se vuote, per non sovrascrivere una correzione del pilota: se pero'
  // le ha riempite un import parziale, restano sbagliate per sempre. Su
  // COTA il riepilogo diceva "1406 m, 4 curve" mentre l'elenco ne
  // mostrava sedici fino a 5397 m, e con una contraddizione simile il
  // modello smette di fidarsi della numerazione.
  const lengthM = profile?.lengthM ?? track.lengthM;
  const cornerCount = profile?.corners?.length ?? track.cornerCount;

  if (lengthM) lines.push(`Lunghezza: ${Math.round(lengthM)} m`);
  if (cornerCount) lines.push(`Curve rilevate: ${cornerCount}`);

  // Il valore in colonna NON viene riportato quando differisce: lo
  // schema non distingue una correzione del pilota da un riempimento
  // automatico di un import precedente, quindi presentarlo come
  // "dichiarato dal pilota" affermerebbe qualcosa che non sappiamo.
  if (track.referenceLapSeconds) {
    lines.push(`Tempo di riferimento del pilota: ${formatLapTime(track.referenceLapSeconds)}`);
  }
  if (track.notes) lines.push(`Note del pilota: ${track.notes}`);

  if (!profile?.corners?.length) {
    lines.push(
      "Profilo curve: non disponibile (nessuna telemetria importata per questo circuito)."
    );

    return lines.join("\n");
  }

  lines.push(`Giro migliore analizzato: ${formatLapTime(profile.bestLapSeconds)}`);
  lines.push("");
  lines.push(
    "Profilo curve dal giro migliore del pilota. Le curve si identificano " +
      "SEMPRE con il loro numero: le distanze in metri dal traguardo " +
      "servono solo a te per riconoscerle, non vanno usate per nominarle " +
      "parlando col pilota."
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
        `- Giro migliore ${formatLapTime(reference.bestLapSeconds)}, giro teorico ` +
          `${formatLapTime(reference.theoreticalLapSeconds)} (somma dei settori migliori): ` +
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
import type {
  TelemetryDigest,
  WheelValues,
} from "./telemetry-digest.service";
import type { LapComparison } from "./telemetry-compare.service";
import { normalize } from "./track-profile.service";

// Le quattro ruote nell'ordine del file: AS, AD, PS, PD.
function wheels(values: WheelValues | null, unit: string): string | null {
  if (!values) return null;
  return `${values[0]}/${values[1]}/${values[2]}/${values[3]} ${unit}`;
}

// Una riga per giro. Serve a far vedere l'ANDAMENTO — gomme che salgono,
// freni che scaldano, energia che cala — che in un riassunto del solo
// giro migliore sparirebbe.
function buildLapLines(digest: TelemetryDigest): string[] {
  return digest.laps.map((lap) => {
    const parts = [formatLapTime(lap.lapTimeSeconds)];

    if (lap.topSpeedKmh) parts.push(`max ${lap.topSpeedKmh} km/h`);
    const tyres = wheels(lap.tyreTempC, "C");
    if (tyres) parts.push(`gomme ${tyres}`);
    const brakes = wheels(lap.brakeTempC, "C");
    if (brakes) parts.push(`freni ${brakes}`);
    if (lap.virtualEnergyDeltaPct !== null) {
      parts.push(`energia ${lap.virtualEnergyDeltaPct}%`);
    }
    if (lap.tcActivePct !== null) parts.push(`TC ${lap.tcActivePct}%`);
    if (lap.offTrackSeconds) parts.push(`fuori ${lap.offTrackSeconds}s`);

    const marker = lap.isBest ? " (migliore)" : "";

    return `- Giro ${lap.lapNumber}${marker}: ${parts.join(", ")}`;
  });
}

function buildTyreLines(digest: TelemetryDigest): string[] {
  const tyres = digest.tyres;
  if (!tyres) return [];

  const lines = ["Gomme nel giro migliore:"];

  lines.push(`- Temperatura media: ${wheels(tyres.avgTempC, "C")}`);
  lines.push(`- Picco: ${wheels(tyres.peakTempC, "C")}`);

  if (tyres.innerMinusOuterC) {
    lines.push(
      `- Battistrada interno meno esterno: ${wheels(
        tyres.innerMinusOuterC,
        "C"
      )}. Positivo vuol dire che l'interno lavora piu' caldo, cioe' ` +
        "troppo camber negativo o troppa poca pressione; negativo il " +
        "contrario. Sotto i 5 C di differenza la ruota lavora piatta."
    );
  }

  const pressure = wheels(tyres.pressureKPa, "kPa");
  if (pressure) lines.push(`- Pressione media: ${pressure}`);

  const wear = wheels(tyres.wearPct, "%");
  if (wear) lines.push(`- Battistrada residuo a fine giro: ${wear}`);

  return lines;
}

function buildBrakingLines(digest: TelemetryDigest): string[] {
  const braking = digest.braking;
  if (!braking) return [];

  const lines = ["Frenata nel giro migliore:"];

  lines.push(
    `- Pressione massima ${braking.maxPressurePct}%, media in frenata ` +
      `${braking.avgPressureWhileBrakingPct}%`
  );
  lines.push(
    `- ${braking.brakingSeconds}s col freno premuto, il ` +
      `${braking.brakingSharePct}% del giro`
  );

  if (
    braking.trailBrakingSharePct !== null &&
    braking.avgTrailPressurePct !== null
  ) {
    lines.push(
      `- Trail braking: il pilota tiene il freno nel ` +
        `${braking.trailBrakingSharePct}% del tempo in cui l'auto e' gia' ` +
        `oltre 0.6G laterali, con ${braking.avgTrailPressurePct}% medio`
    );
  }

  if (braking.pedalOverlapSeconds > 0) {
    lines.push(
      `- Gas e freno premuti insieme per ${braking.pedalOverlapSeconds}s`
    );
  }

  if (braking.lockupCount !== null) {
    lines.push(
      braking.lockupCount === 0
        ? "- Nessun bloccaggio rilevato"
        : `- ${braking.lockupCount} bloccaggi, ${braking.lockupSeconds}s ` +
            "complessivi (ruota sotto l'85% della velocita' dell'auto)"
    );
  }

  if (braking.frontTempC && braking.rearTempC) {
    lines.push(
      `- Picco temperatura dischi: ${braking.frontTempC[0]}/` +
        `${braking.frontTempC[1]} C davanti, ${braking.rearTempC[0]}/` +
        `${braking.rearTempC[1]} C dietro`
    );
  }

  if (braking.biasRearPct !== null) {
    const migration =
      braking.migration !== null ? `, migration ${braking.migration}` : "";

    lines.push(
      `- Ripartitore impostato al ${braking.biasRearPct}% sul posteriore` +
        migration
    );
  }

  return lines;
}

function buildEnergyLines(digest: TelemetryDigest): string[] {
  const energy = digest.energy;
  if (!energy) return [];

  const lines = ["Motore ed energia nel giro migliore:"];

  if (
    energy.virtualEnergyFromPct !== null &&
    energy.virtualEnergyToPct !== null
  ) {
    lines.push(
      `- Virtual Energy da ${energy.virtualEnergyFromPct}% a ` +
        `${energy.virtualEnergyToPct}%`
    );
  }

  if (energy.socFromPct !== null && energy.socToPct !== null) {
    lines.push(
      `- Batteria da ${energy.socFromPct}% a ${energy.socToPct}%, minimo ` +
        `${energy.socMinPct}% durante il giro`
    );
  }

  if (energy.avgRecoveryKw !== null || energy.avgDeploymentKw !== null) {
    lines.push(
      `- Ibrido: ${energy.avgRecoveryKw ?? "-"} kW medi recuperati in ` +
        `frenata, ${energy.avgDeploymentKw ?? "-"} kW medi erogati in ` +
        "accelerazione"
    );
  }

  if (energy.maxRpm !== null) {
    const limit =
      energy.engineMaxRpm !== null ? ` su ${energy.engineMaxRpm} massimi` : "";
    lines.push(`- Regime massimo ${energy.maxRpm} giri${limit}`);
  }

  if (energy.shifts !== null) {
    lines.push(
      `- ${energy.shifts} cambi marcia nel giro, massima usata la ` +
        `${energy.maxGear}a`
    );
  }

  if (energy.fuelUsedL !== null) {
    lines.push(`- Carburante consumato nel giro: ${energy.fuelUsedL} L`);
  }

  if (energy.waterTempC !== null || energy.oilTempC !== null) {
    lines.push(
      `- Temperature massime: acqua ${energy.waterTempC ?? "-"} C, olio ` +
        `${energy.oilTempC ?? "-"} C`
    );
  }

  return lines;
}

function buildHandlingLines(digest: TelemetryDigest): string[] {
  const handling = digest.handling;
  if (!handling) return [];

  const lines = ["Guida e comportamento dell'auto nel giro migliore:"];

  if (
    handling.requestedThrottlePct !== null &&
    handling.deliveredThrottlePct !== null
  ) {
    lines.push(
      `- Gas: il pilota chiede ${handling.requestedThrottlePct}% medio col ` +
        `piede, al motore ne arriva ${handling.deliveredThrottlePct}%. La ` +
        "differenza e' il controllo di trazione, non il pilota: sono due " +
        "canali distinti del file."
    );
  }

  if (handling.tcActiveSharePct !== null) {
    lines.push(
      `- Il TC interviene per il ${handling.tcActiveSharePct}% del giro`
    );
  }

  if (handling.maxLatG !== null || handling.maxBrakingG !== null) {
    lines.push(
      `- Picchi: ${handling.maxLatG ?? "-"}G laterali, ` +
        `${handling.maxBrakingG ?? "-"}G in decelerazione`
    );
  }

  if (handling.maxSteeringPct !== null) {
    lines.push(
      `- Sterzo: massimo ${handling.maxSteeringPct}% della corsa, ` +
        `${handling.steeringReversals} inversioni di almeno il 3%, ` +
        `velocita' media ${handling.avgSteeringRatePctPerSec}%/s. Il numero ` +
        "di inversioni ha senso solo confrontando giri dello stesso " +
        "circuito: comprende i normali cambi di curva, non solo le correzioni."
    );
  }

  if (handling.offTrackSeconds !== null) {
    const episodes =
      handling.offTrackEpisodes === 1
        ? "1 occasione"
        : `${handling.offTrackEpisodes} occasioni`;

    lines.push(
      `- Fuori pista (tutte e quattro le ruote oltre l'asfalto): ` +
        `${handling.offTrackSeconds}s in ${episodes}. Con almeno una ruota ` +
        `fuori, ${handling.onKerbSeconds}s: sono i cordoli, e non sono un ` +
        "errore."
    );
  }

  if (
    handling.minFrontRideHeightMm !== null ||
    handling.minRearRideHeightMm !== null
  ) {
    lines.push(
      `- Altezze minime da terra: ${handling.minFrontRideHeightMm ?? "-"} mm ` +
        `davanti, ${handling.minRearRideHeightMm ?? "-"} mm dietro`
    );
  }

  return lines;
}

// Il confronto con il giro di riferimento.
//
// La regola di lettura sta scritta nel prompt perche' senza il modello
// sommerebbe i delta sbagliati: il numero che conta e' la variazione del
// delta dentro una sezione, non il delta assoluto in un punto, che porta
// con se' tutto quello che e' successo prima.
// "2026-08-04T23_00_03Z" -> "4 agosto 2026, 23:00". LMU usa gli
// underscore al posto dei due punti perche' il valore finisce anche nel
// nome del file.
function formatRecordingTime(value: string | null): string | null {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})_(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;

  const mesi = [
    "gennaio",
    "febbraio",
    "marzo",
    "aprile",
    "maggio",
    "giugno",
    "luglio",
    "agosto",
    "settembre",
    "ottobre",
    "novembre",
    "dicembre",
  ];

  const nome = mesi[Number(month) - 1];
  if (!nome) return null;

  return `${Number(day)} ${nome} ${year}, ${hour}:${minute}`;
}

function buildComparisonSection(
  comparison: LapComparison | null,
  pilotName: string | null
): string {
  if (!comparison) {
    return `Nessun giro di riferimento per questo circuito.

Se il pilota chiede un confronto, spiegagli che puoi farlo quando avra'
caricato una telemetria di riferimento dalla pagina Telemetria — la sua
o quella di qualcun altro che gira forte sullo stesso circuito — e
marcata come riferimento.`;
  }

  const lines: string[] = [];

  const driver = comparison.reference.driverName;
  const car = comparison.reference.carName;
  const when = formatRecordingTime(comparison.reference.recordingTime);

  // Chi ha guidato il giro di riferimento va detto senza ambiguita'.
  //
  // Quando il riferimento e' un'altra sessione dello stesso pilota — il
  // caso piu' comune, ci si confronta col proprio giro migliore — nel
  // prompt comparivano due volte lo stesso nome, e il modello ne
  // concludeva che "non c'e' un riferimento esterno" ignorando tutta la
  // sezione e ripiegando sui dati del singolo file.
  const own =
    !!driver && !!pilotName && normalize(driver) === normalize(pilotName);

  const chi = own
    ? `un'altra sessione dello stesso pilota${when ? ` (${when})` : ""}`
    : `${driver ?? "un altro pilota"}${when ? `, ${when}` : ""}`;

  lines.push(
    `Riferimento: ${chi}${car ? `, ${car}` : ""}, giro ` +
      `${comparison.reference.lapNumber} in ${formatLapTime(comparison.reference.seconds)}.`
  );

  lines.push(
    "Questo confronto e' gia' calcolato dai due file: usalo cosi' com'e'. " +
      "Non dire che manca un riferimento e non sostituirlo con il confronto " +
      "fra i giri di una sola sessione, che sta nella sezione CIRCUITO ed e' " +
      "un'altra cosa."
  );

  lines.push(
    `Il giro migliore del pilota: giro ${comparison.lap.lapNumber} in ` +
      `${formatLapTime(comparison.lap.seconds)}.`
  );

  const gap = comparison.gapSeconds;

  lines.push(
    gap > 0
      ? `Scarto: ${gap}s piu' lento del riferimento.`
      : gap < 0
        ? `Scarto: ${Math.abs(gap)}s piu' veloce del riferimento.`
        : "I due giri hanno lo stesso tempo."
  );

  if (!comparison.sameCar) {
    lines.push(
      "ATTENZIONE: le due auto sono diverse. Le traiettorie e i punti di " +
        "frenata restano confrontabili, le velocita' molto meno: non dire al " +
        "pilota che deve passare piu' veloce solo perche' l'altra auto lo fa."
    );
  }

  // Un giro con una fermata dentro non e' un giro lento, e i suoi delta
  // raccontano un incidente invece di un errore di guida.
  if (comparison.lap.stopped || comparison.reference.stopped) {
    lines.push(
      "ATTENZIONE: in uno dei due giri l'auto si e' quasi fermata " +
        "(testacoda, uscita o rientro ai box). I secondi persi in quel punto " +
        "non sono un problema di guida: dillo invece di costruirci sopra un " +
        "consiglio."
    );
  }

  const corners = comparison.corners;

  if (corners.length === 0) {
    return lines.join("\n");
  }

  lines.push("");
  lines.push(
    "Il tempo e' diviso per sezioni: ogni curva porta con se' il " +
      "rettilineo che la segue, perche' un'uscita lenta si paga nei metri " +
      "dopo, non dentro la curva. Le sezioni sommate danno lo scarto " +
      "totale, quindi i valori qui sotto si possono confrontare fra loro " +
      "e sommare."
  );

  const describe = (c: (typeof corners)[number]) => {
    const parts: string[] = [];

    const sign = c.sectionDeltaSeconds > 0 ? "+" : "";
    parts.push(
      `Curva ${c.number}: ${sign}${c.sectionDeltaSeconds}s ` +
        `(in curva ${c.deltaSeconds > 0 ? "+" : ""}${c.deltaSeconds}, ` +
        `in uscita ${c.exitDeltaSeconds > 0 ? "+" : ""}${c.exitDeltaSeconds})`
    );

    if (c.minSpeedKmh !== null && c.referenceMinSpeedKmh !== null) {
      parts.push(
        `minima ${c.minSpeedKmh} contro ${c.referenceMinSpeedKmh} km/h`
      );
    }

    if (c.brakingDeltaM !== null && Math.abs(c.brakingDeltaM) >= 5) {
      parts.push(
        c.brakingDeltaM > 0
          ? `stacca ${c.brakingDeltaM} m prima del riferimento`
          : `stacca ${Math.abs(c.brakingDeltaM)} m dopo il riferimento`
      );
    }

    return `- ${parts.join(", ")}`;
  };

  // Sotto i cinque centesimi la differenza e' rumore di misura: a 10Hz un
  // campione vale un decimo, e riportarla inviterebbe a inseguire
  // decimali che non esistono.
  const SOGLIA = 0.05;

  // Le sezioni con un salto di "Lap Dist" restano fuori da entrambe le
  // classifiche: il loro delta e' un artefatto del canale, e un salto in
  // un giro solo vale quasi un secondo.
  const attendibili = corners.filter((c) => !c.unreliable);
  const scartate = corners.filter((c) => c.unreliable);

  const perse = attendibili
    .filter((c) => c.sectionDeltaSeconds >= SOGLIA)
    .sort((a, b) => b.sectionDeltaSeconds - a.sectionDeltaSeconds)
    .slice(0, 6);

  const guadagnate = attendibili
    .filter((c) => c.sectionDeltaSeconds <= -SOGLIA)
    .sort((a, b) => a.sectionDeltaSeconds - b.sectionDeltaSeconds)
    .slice(0, 4);

  if (perse.length > 0) {
    lines.push("");
    lines.push("Dove il pilota perde tempo:");
    lines.push(...perse.map(describe));
  }

  // Anche i tratti in guadagno servono: senza, il coach vede solo una
  // lista di colpe e propone di cambiare cose che gia' funzionano.
  if (guadagnate.length > 0) {
    lines.push("");
    lines.push("Dove invece il pilota e' piu' veloce del riferimento:");
    lines.push(...guadagnate.map(describe));
  }

  if (perse.length === 0 && guadagnate.length === 0) {
    lines.push("");
    lines.push(
      "Nessuna sezione con uno scarto superiore a mezzo decimo: i due giri " +
        "sono equivalenti curva per curva."
    );
  }

  if (scartate.length > 0) {
    lines.push("");
    lines.push(
      `Escluse dal confronto le curve ${scartate
        .map((c) => c.number)
        .join(", ")}: li' il canale della distanza sul giro fa un salto in ` +
        "uno dei due file e il tempo calcolato non e' attendibile. NON dire " +
        "al pilota che perde o guadagna tempo in quelle curve. Se te lo " +
        "chiede, spiega che in quel punto il dato non regge."
    );
  }

  return lines.join("\n");
}

function buildTelemetrySection(digest: TelemetryDigest | null): string {
  if (!digest) {
    return "Nessun dato di telemetria disponibile per l'auto attiva.";
  }

  const lines: string[] = [];

  const session = [
    digest.sessionType,
    digest.weather,
    digest.airTempC !== null ? `aria ${digest.airTempC} C` : null,
    digest.trackTempC !== null ? `asfalto ${digest.trackTempC} C` : null,
  ].filter(Boolean);

  lines.push(
    `File: ${digest.trackName ?? "-"}, ${digest.carName ?? "-"}.` +
      (session.length > 0 ? ` Sessione: ${session.join(", ")}.` : "")
  );

  lines.push(
    `Giri analizzati: ${digest.lapsAnalyzed} su ${digest.lapsInFile} nel ` +
      "file (il primo esce dai box e l'ultimo e' troncato, quindi sono " +
      `esclusi). Giro migliore: giro ${digest.bestLapNumber} in ` +
      `${formatLapTime(digest.bestLapSeconds)}.`
  );

  const electronics = digest.electronics;

  if (electronics) {
    const settings = [
      electronics.tcLevel !== null ? `TC livello ${electronics.tcLevel}` : null,
      electronics.tcCut !== null ? `taglio ${electronics.tcCut}` : null,
      electronics.tcSlipAngle !== null
        ? `angolo di slittamento ${electronics.tcSlipAngle}`
        : null,
      electronics.absLevel !== null ? `ABS livello ${electronics.absLevel}` : null,
      electronics.fuelMixtureMap !== null
        ? `mappa carburante ${electronics.fuelMixtureMap}`
        : null,
    ].filter(Boolean);

    if (settings.length > 0) {
      lines.push("");
      // Non stanno nel file .svm: il pilota le cambia dal volante in
      // pista. Vanno percio' consigliate a parole, mai in setupChanges.
      lines.push(
        "Elettronica con cui il pilota e' sceso in pista (dal file, non dal " +
          "setup: si cambiano dal volante e NON vanno messe in setupChanges): " +
          settings.join(", ") + "."
      );
    }
  }

  if (digest.laps.length > 0) {
    lines.push("");
    lines.push("Andamento dello stint, un giro per riga (ruote AS/AD/PS/PD):");
    lines.push(...buildLapLines(digest));
  }

  for (const block of [
    buildTyreLines(digest),
    buildBrakingLines(digest),
    buildEnergyLines(digest),
    buildHandlingLines(digest),
  ]) {
    if (block.length === 0) continue;
    lines.push("");
    lines.push(...block);
  }

  return lines.join("\n");
}

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
        "Nome leggibile — SEZIONE.Chiave = indice (valore attuale). " +
        "Sono TUTTE modificabili:"
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
(negativo per scendere).

Nella prosa NON scrivere mai il percorso del file: usa il nome
leggibile, cioe' quello prima del trattino nell'elenco. Si dice "ala
posteriore" e "ripartitore di frenata", non "REARWING.RWSetting" o
"CONTROLS.RearBrakeSetting" — quei percorsi servono solo al campo
setting. Cita sempre anche il valore attuale.

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
    comparison,
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

  const telemetrySection = buildTelemetrySection(telemetry);

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

===== CONFRONTO CON IL RIFERIMENTO =====

${buildComparisonSection(comparison ?? null, pilot?.name ?? null)}

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
- Se sono disponibili dati di telemetria, parti sempre da lì invece di
  parlare in astratto: cita il numero che hai visto, non un'impressione.
  Le temperature delle gomme e la differenza interno-esterno reggono un
  discorso su camber e pressioni; i picchi dei dischi dicono se i freni
  sono in finestra; l'andamento giro per giro dice se il problema
  peggiora con lo stint o c'è da subito.
- Non inventare valori che nella sezione TELEMETRIA non ci sono. Se un
  dato manca (auto senza ibrido, canale assente nel file) dillo e chiedi
  cosa ti serve, invece di stimarlo.
- I dati della telemetria descrivono il giro migliore e lo stint di UN
  file. Non trattarli come una costante dell'auto: se il pilota descrive
  un problema che i dati non mostrano, può semplicemente essere successo
  in un'altra sessione.
- Quando c'è un confronto con il riferimento, **parti dalle sezioni che
  costano di più** invece di commentare tutto il giro: due o tre punti su
  cui lavorare valgono più di un elenco completo. Di' quanto vale ciascuno
  in secondi, così il pilota sa cosa gli conviene provare per primo.
- Distingui sempre il tempo perso **in** curva da quello perso **in
  uscita**: sono due errori diversi. In curva si guadagna con la
  traiettoria e la velocità di percorrenza, in uscita con il punto in cui
  si riapre il gas e con la trazione, che dipende anche dal setup.
- Il confronto dice DOVE si perde, non PERCHÉ. Il perché va cercato negli
  altri dati — gomme, TC, sterzo, staccata — o chiesto al pilota. Non
  inventare una causa per far tornare il discorso.
- **Chiama sempre le curve per numero**: "curva 7", mai "la curva a
  3588 m". Le distanze nel profilo servono a te per riconoscerle e per
  ragionare sulle staccate, ma al pilota non dicono nulla: lui in pista
  vede i cartelli e la sequenza delle curve, non l'odometro. Puoi citare
  una distanza solo per indicare un punto di frenata rispetto a un
  riferimento ("stacca una decina di metri piu' tardi"), mai per
  identificare la curva.
- La numerazione e' quella del profilo qui sopra, ricavata dai dati
  reali di questo pilota: non usare nomi presi dalla tua conoscenza del
  circuito reale, che nel simulatore possono non corrispondere. Se un
  nome noto e' utile puoi affiancarlo tra parentesi, ma il riferimento
  principale resta il numero.
- Quando possibile proponi prove in pista.
`;
}
