// Lettura e riscrittura dei file .svm di Le Mans Ultimate.
//
// Il punto chiave del formato: il valore che il gioco legge e' un
// INDICE intero ("CamberSetting=30"), mentre il numero leggibile sta
// nel commento ("//-1.0 deg"). La scala che lega i due cambia per auto
// e per posizione — sulla BMW l'indice 30 davanti vale -1.0 deg e
// l'indice 20 dietro vale sempre -1.0 deg — quindi da un file non si
// puo' convertire un valore fisico nel suo indice.
//
// Non serve: l'interfaccia del gioco lavora a click, ogni modifica e'
// un +1 o -1 sull'indice. Tutte le modifiche qui viaggiano quindi come
// delta di click, che si sommano all'indice senza bisogno di conoscere
// la scala.

export type SvmSetting = {
  section: string;
  key: string;
  /** Identificatore stabile usato nel prompt e nelle modifiche. */
  path: string;
  index: number;
  comment: string;
  /** Riga del file, per riscrivere senza toccare il resto. */
  line: number;
};

export type SvmDocument = {
  lines: string[];
  settings: SvmSetting[];
};

// Un setting non regolabile ha un commento che lo dichiara. Proporre di
// muoverlo sarebbe rumore: il gioco non lo espone nemmeno.
const NOT_ADJUSTABLE = [
  "n/a",
  "n/d",
  "non-adjustable",
  "detached",
  "separata",
];

export function isAdjustable(setting: SvmSetting) {
  const comment = setting.comment.trim().toLowerCase();

  if (!comment) return false;

  return !NOT_ADJUSTABLE.includes(comment);
}

// Righe "Chiave=Valore//Commento" dentro sezioni "[NOME]". Le righe che
// iniziano con "//" sono note del file, non impostazioni.
const SETTING_LINE = /^([A-Za-z0-9_]+)\s*=\s*(-?\d+)\s*(?:\/\/(.*))?$/;

export function parseSvm(raw: string): SvmDocument {
  const lines = raw.split(/\r?\n/);
  const settings: SvmSetting[] = [];

  let section = "ROOT";

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("//")) return;

    const sectionMatch = trimmed.match(/^\[([A-Za-z0-9_]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      return;
    }

    const match = trimmed.match(SETTING_LINE);
    if (!match) return;

    settings.push({
      section,
      key: match[1],
      path: `${section}.${match[1]}`,
      index: Number(match[2]),
      comment: (match[3] ?? "").trim(),
      line: index,
    });
  });

  return { lines, settings };
}

export type SvmClickChange = {
  /** "SECTION.Key", come esposto nel prompt. */
  setting: string;
  deltaClicks: number;
};

export type AppliedChange = SvmClickChange & {
  previousIndex: number;
  newIndex: number;
  previousComment: string;
};

export type ApplyResult = {
  raw: string;
  applied: AppliedChange[];
  /** Modifiche scartate, con il motivo: nessuna viene ignorata in silenzio. */
  rejected: { setting: string; reason: string }[];
};

// Riscrive il file applicando i delta di click. Tutto il resto resta
// invariato byte per byte: si tocca solo la riga dell'impostazione
// modificata.
export function applyClicks(
  raw: string,
  changes: SvmClickChange[]
): ApplyResult {
  const doc = parseSvm(raw);
  const lines = [...doc.lines];

  const applied: AppliedChange[] = [];
  const rejected: { setting: string; reason: string }[] = [];

  const reject = (setting: string, reason: string) =>
    rejected.push({ setting, reason });

  function rewrite(setting: SvmSetting, deltaClicks: number) {
    // Il limite superiore non e' scritto nel file: lo conosce solo il
    // gioco, che riporta il valore dentro il range quando carica. Qui si
    // impedisce solo di scendere sotto zero, che e' certo.
    const newIndex = Math.max(0, setting.index + deltaClicks);

    if (newIndex === setting.index) return false;

    const indent = lines[setting.line].match(/^\s*/)?.[0] ?? "";
    const sign = deltaClicks > 0 ? "+" : "";

    // Il commento vecchio descriverebbe il valore precedente, quindi
    // sarebbe falso: al suo posto si annota da dove si e' partiti. Il
    // gioco legge l'indice e ricalcola l'etichetta da solo.
    const note = setting.comment
      ? `era ${setting.comment} (${sign}${deltaClicks} click)`
      : `${sign}${deltaClicks} click`;

    lines[setting.line] = `${indent}${setting.key}=${newIndex}//${note}`;

    applied.push({
      setting: setting.path,
      deltaClicks,
      previousIndex: setting.index,
      newIndex,
      previousComment: setting.comment,
    });

    return true;
  }

  for (const change of changes) {
    if (!Number.isInteger(change.deltaClicks) || change.deltaClicks === 0) {
      reject(change.setting, "delta di click non valido");
      continue;
    }

    // Un percorso accorpato (FRONT./REAR.) vale per entrambi i lati:
    // muoverne uno solo su un'auto simmetrica la sbilancerebbe.
    const grouped = change.setting.match(/^(FRONT|REAR)\.(.+)$/);

    const targets = grouped
      ? doc.settings.filter(
          (s) => SIDE_SECTIONS[s.section] === grouped[1] && s.key === grouped[2]
        )
      : doc.settings.filter((s) => s.path === change.setting);

    if (targets.length === 0) {
      reject(change.setting, "impostazione non presente nel file");
      continue;
    }

    const usable = targets.filter(isAdjustable);

    if (usable.length === 0) {
      reject(
        change.setting,
        `non regolabile su questa auto (${targets[0].comment})`
      );
      continue;
    }

    const moved = usable
      .map((setting) => rewrite(setting, change.deltaClicks))
      .some(Boolean);

    if (!moved) reject(change.setting, "gia' al minimo della scala");
  }

  return { raw: lines.join("\n"), applied, rejected };
}

// Regolazioni che non riguardano il comportamento dinamico dell'auto:
// carburante, soste, rapporti del cambio. Includerle raddoppiava
// l'elenco nel prompt senza aggiungere nulla su cui il coach possa
// ragionare per risolvere sotto/sovrasterzo.
const IRRELEVANT_KEYS =
  /^(Fuel|FuelCapacity|VirtualEnergy|NumPitstops|Pitstop\d|Gear\d|Reverse|FinalDrive|RatioSet|SteerLock)Setting$/;

// Le auto simmetriche hanno FRONTLEFT e FRONTRIGHT identici: elencarli
// entrambi raddoppia la lista e invita a muoverne uno solo, che e' un
// errore. Vengono quindi accorpati sotto FRONT/REAR e riespansi in fase
// di applicazione.
const SIDE_SECTIONS: Record<string, string> = {
  FRONTLEFT: "FRONT",
  FRONTRIGHT: "FRONT",
  REARLEFT: "REAR",
  REARRIGHT: "REAR",
};

function isSymmetric(doc: SvmDocument) {
  const symmetric = doc.settings.find(
    (s) => s.section === "GENERAL" && s.key === "Symmetric"
  );

  // Symmetric non ha commento, quindi isAdjustable lo scarta: si legge
  // direttamente l'indice.
  return symmetric ? symmetric.index === 1 : false;
}

function relevant(setting: SvmSetting) {
  return isAdjustable(setting) && !IRRELEVANT_KEYS.test(setting.key);
}

// Nomi leggibili delle regolazioni, al posto delle chiavi del file.
// "REARWING.RWSetting" non dice nulla al pilota, che nel gioco legge
// "Ala posteriore".
//
// ATTENZIONE: queste etichette sono ricavate dai nomi delle chiavi e
// dalla terminologia corrente, NON lette dall'interfaccia di LMU. Se una
// non corrisponde a quello che vedi in gioco, correggila qui: e' l'unico
// punto in cui compaiono.
const KEY_LABELS: Record<string, string> = {
  // Aerodinamica e carrozzeria
  FWSetting: "Ala anteriore",
  RWSetting: "Ala posteriore",
  WaterRadiatorSetting: "Nastro radiatore acqua",
  OilRadiatorSetting: "Nastro radiatore olio",
  BrakeDuctSetting: "Condotti freni anteriori",
  BrakeDuctRearSetting: "Condotti freni posteriori",

  // Sospensioni
  FrontAntiSwaySetting: "Barra antirollio anteriore",
  RearAntiSwaySetting: "Barra antirollio posteriore",
  FrontToeInSetting: "Convergenza anteriore",
  RearToeInSetting: "Convergenza posteriore",
  Front3rdPackerSetting: "Tampone terzo elemento anteriore",
  Rear3rdPackerSetting: "Tampone terzo elemento posteriore",
  Front3rdSpringSetting: "Molla terzo elemento anteriore",
  Rear3rdSpringSetting: "Molla terzo elemento posteriore",
  Front3rdSlowBumpSetting: "Compressione lenta terzo elemento ant.",
  Rear3rdSlowBumpSetting: "Compressione lenta terzo elemento post.",
  Front3rdFastBumpSetting: "Compressione veloce terzo elemento ant.",
  Rear3rdFastBumpSetting: "Compressione veloce terzo elemento post.",
  Front3rdSlowReboundSetting: "Estensione lenta terzo elemento ant.",
  Rear3rdSlowReboundSetting: "Estensione lenta terzo elemento post.",
  Front3rdFastReboundSetting: "Estensione veloce terzo elemento ant.",
  Rear3rdFastReboundSetting: "Estensione veloce terzo elemento post.",

  // Freni e controlli
  RearBrakeSetting: "Ripartitore di frenata",
  BrakeMigrationSetting: "Migrazione frenata",
  BrakePressureSetting: "Pressione freni",
  TractionControlMapSetting: "Mappa controllo trazione",
  TCPowerCutMapSetting: "TC taglio potenza",
  TCSlipAngleMapSetting: "TC angolo di slittamento",
  SteerLockSetting: "Blocco sterzo",

  // Motore e ibrido
  RegenerationMapSetting: "Mappa rigenerazione",
  ElectricMotorMapSetting: "Mappa motore elettrico",
  EngineMixtureSetting: "Miscela",
  EngineBrakingMapSetting: "Freno motore",

  // Trasmissione
  DiffPowerSetting: "Differenziale in accelerazione",
  DiffCoastSetting: "Differenziale in rilascio",
  DiffPreloadSetting: "Precarico differenziale",

  // Per ruota o assale: la posizione viene aggiunta dalla sezione
  CamberSetting: "Camber",
  PressureSetting: "Pressione gomme",
  SpringSetting: "Molla",
  RideHeightSetting: "Altezza da terra",
  PackerSetting: "Tampone",
  SlowBumpSetting: "Compressione lenta",
  FastBumpSetting: "Compressione veloce",
  SlowReboundSetting: "Estensione lenta",
  FastReboundSetting: "Estensione veloce",
  BrakeDiscSetting: "Disco freno",
  BrakePadSetting: "Pastiglie",
  CompoundSetting: "Mescola",
};

// Solo per le sezioni per-ruota: altrove la posizione e' gia' dentro il
// nome della chiave (FrontAntiSwaySetting).
const SECTION_POSITION: Record<string, string> = {
  FRONT: "anteriore",
  REAR: "posteriore",
  FRONTLEFT: "anteriore sinistra",
  FRONTRIGHT: "anteriore destra",
  REARLEFT: "posteriore sinistra",
  REARRIGHT: "posteriore destra",
};

// Aggiunge il nome leggibile a un elenco di modifiche, cosi' il client
// non deve conoscere la mappa: vive in un punto solo.
export function withSettingLabels<T extends { setting: string }>(
  changes: T[] | undefined
) {
  return (changes ?? []).map((change) => ({
    ...change,
    label: settingLabel(change.setting),
  }));
}

export function settingLabel(path: string) {
  const [section, key] = path.split(".");
  if (!key) return path;

  const base = KEY_LABELS[key];
  if (!base) return path;

  const position = SECTION_POSITION[section];

  return position ? `${base} ${position}` : base;
}

// Etichette per area. Un elenco piatto di 68 voci non fa percepire al
// modello che esistono leve diverse dal camber: raggruppandole si vede
// a colpo d'occhio che ci sono aerodinamica, barre, differenziale e
// ammortizzatori.
const AREA_LABELS: Record<string, string> = {
  FRONTWING: "Aerodinamica",
  REARWING: "Aerodinamica",
  BODYAERO: "Raffreddamento e condotti freni",
  SUSPENSION: "Sospensioni: barre, convergenza, terzi elementi",
  CONTROLS: "Freni e controlli",
  ENGINE: "Motore e ibrido",
  DRIVELINE: "Differenziale",
  FRONT: "Assale anteriore (entrambi i lati)",
  REAR: "Assale posteriore (entrambi i lati)",
  FRONTLEFT: "Anteriore sinistra",
  FRONTRIGHT: "Anteriore destra",
  REARLEFT: "Posteriore sinistra",
  REARRIGHT: "Posteriore destra",
  GENERAL: "Generale",
};

export function describeAdjustableSettingsByArea(raw: string) {
  const grouped = new Map<string, string[]>();

  // Si raggruppa sulla sezione strutturata, non spezzando il testo
  // formattato: la riga ora comincia con il nome leggibile, e ricavare
  // da li' la sezione produceva un'area per ogni singola regolazione.
  for (const entry of adjustableEntries(raw)) {
    const label = AREA_LABELS[entry.section] ?? entry.section;

    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(entry.text);
  }

  return [...grouped.entries()].map(([label, entries]) => ({
    label,
    entries,
  }));
}

// Nota lasciata da applyClicks al posto del commento originale: dice da
// dove si e' partiti, non il valore attuale.
const APPLIED_NOTE = /^era .*\(-?\+?\d+ click\)$/;

// Elenco strutturato delle regolazioni su cui il coach puo' intervenire.
function adjustableEntries(raw: string) {
  const doc = parseSvm(raw);
  const symmetric = isSymmetric(doc);

  const seen = new Set<string>();
  const out: { path: string; section: string; text: string }[] = [];

  for (const setting of doc.settings) {
    if (!relevant(setting)) continue;

    const groupedSection = symmetric ? SIDE_SECTIONS[setting.section] : undefined;
    const section = groupedSection ?? setting.section;
    const path = groupedSection
      ? `${groupedSection}.${setting.key}`
      : setting.path;

    if (seen.has(path)) continue;
    seen.add(path);

    // Su un setup gia' modificato il commento non contiene piu' il
    // valore leggibile ma la nota "era X (+n click)": spacciarla per
    // valore attuale farebbe ragionare il coach su un dato vecchio. Il
    // valore vero lo ricalcola il gioco al caricamento, qui resta
    // affidabile solo l'indice.
    const value = APPLIED_NOTE.test(setting.comment)
      ? `valore ricalcolato dal gioco, ${setting.comment}`
      : setting.comment;

    // Il nome leggibile viene prima perche' e' quello che il coach deve
    // usare parlando col pilota; il percorso resta perche' e' quello che
    // deve copiare in "setting".
    out.push({
      path,
      section,
      text: `${settingLabel(path)} — ${path} = ${setting.index} (${value})`,
    });
  }

  return out;
}

export function describeAdjustableSettings(raw: string) {
  return adjustableEntries(raw).map((e) => e.text);
}
