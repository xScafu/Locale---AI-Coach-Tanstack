// server/src/services/setup-import.service.ts

export type SvmField = {
  section: string;
  key: string;
  rawValue: string;
  comment: string;
};

export type SetupSuggestions = Partial<{
  brakeBias: number;
  frontRideHeight: number;
  rearRideHeight: number;
  frontCamber: number;
  rearCamber: number;
  frontToe: number;
  rearToe: number;
  frontARB: number;
  rearARB: number;
  frontSpring: number;
  rearSpring: number;
  diffPreload: number;
}>;

export type ParsedSvm = {
  raw: string;
  keyValues: Record<string, string>;
  suggestions: SetupSuggestions;
};

export function parseSvmFile(buffer: Buffer): ParsedSvm {
  const raw = buffer.toString("utf8");
  const fields = parseFields(raw);

  const keyValues: Record<string, string> = {};
  for (const field of fields) {
    const displayKey = `${field.section}.${field.key}`;
    keyValues[displayKey] = field.comment
      ? `${field.rawValue} (${field.comment})`
      : field.rawValue;
  }

  return { raw, keyValues, suggestions: buildSuggestions(fields) };
}

// Formato osservato (file .svm reale di LMU): sezioni [NOME] stile INI,
// righe Chiave=ValoreGrezzo//CommentoLeggibile. Le righe che iniziano
// per intero con "//" sono impostazioni disattivate/commentate e
// vengono ignorate.
function parseFields(raw: string): SvmField[] {
  const fields: SvmField[] = [];
  let currentSection = "ROOT";

  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) continue;
    if (trimmed.startsWith("//")) continue;

    const sectionMatch = trimmed.match(/^\[([A-Za-z0-9_]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    if (!key) continue;

    const rest = trimmed.slice(eqIndex + 1);
    const commentIndex = rest.indexOf("//");

    const rawValue =
      commentIndex === -1 ? rest.trim() : rest.slice(0, commentIndex).trim();
    const comment =
      commentIndex === -1 ? "" : rest.slice(commentIndex + 2).trim();

    fields.push({ section: currentSection, key, rawValue, comment });
  }

  return fields;
}

function findComment(fields: SvmField[], section: string, key: string) {
  return fields.find((f) => f.section === section && f.key === key)?.comment;
}

// Estrae un numero dal commento SOLO se non è "attaccato" a lettere:
// evita che "P1" o "P8" (preset non numerici) vengano letti come "1"
// o "8". Il lookbehind (?<![A-Za-z]) blocca match preceduti da lettere.
const STANDALONE_NUMBER = /(?<![A-Za-z])-?\d+(?:[.,]\d+)?/;

function parseCommentNumber(comment: string | undefined): number | undefined {
  if (!comment) return undefined;

  const match = comment.match(STANDALONE_NUMBER);
  if (!match) return undefined;

  const value = parseFloat(match[0].replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}

// Il brake bias in LMU è espresso come "Posteriore:Anteriore"
// (es. "55.0:45.0" = 55% posteriore, 45% anteriore). ASSUNZIONE: il
// campo "brakeBias" dell'app rappresenta la percentuale ANTERIORE.
// Verifica questa convenzione al primo import: se nella tua app
// significa il contrario, inverti qui sotto (usa ratioMatch[1] invece
// di ratioMatch[2]).
function parseBrakeBias(comment: string | undefined): number | undefined {
  if (!comment) return undefined;

  const ratioMatch = comment.match(
    /(-?\d+(?:[.,]\d+)?)\s*:\s*(-?\d+(?:[.,]\d+)?)/
  );

  if (!ratioMatch) return parseCommentNumber(comment);

  const front = parseFloat(ratioMatch[2].replace(",", "."));
  return Number.isFinite(front) ? front : undefined;
}

function average(...values: (number | undefined)[]): number | undefined {
  const valid = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );

  if (valid.length === 0) return undefined;

  const sum = valid.reduce((a, b) => a + b, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

function buildSuggestions(fields: SvmField[]): SetupSuggestions {
  const c = (section: string, key: string) => findComment(fields, section, key);

  const frontCamber = average(
    parseCommentNumber(c("FRONTLEFT", "CamberSetting")),
    parseCommentNumber(c("FRONTRIGHT", "CamberSetting"))
  );

  const rearCamber = average(
    parseCommentNumber(c("REARLEFT", "CamberSetting")),
    parseCommentNumber(c("REARRIGHT", "CamberSetting"))
  );

  const frontRideHeight = average(
    parseCommentNumber(c("FRONTLEFT", "RideHeightSetting")),
    parseCommentNumber(c("FRONTRIGHT", "RideHeightSetting"))
  );

  const rearRideHeight = average(
    parseCommentNumber(c("REARLEFT", "RideHeightSetting")),
    parseCommentNumber(c("REARRIGHT", "RideHeightSetting"))
  );

  // Nota: SpringSetting nel commento è ancora un indice ("8", "3"),
  // non una vera rigidezza in N/mm - LMU non espone quel valore fisico
  // nel file. Meglio di niente come riferimento relativo, ma non è
  // un dato fisico assoluto: trattalo come tale.
  const frontSpring = average(
    parseCommentNumber(c("FRONTLEFT", "SpringSetting")),
    parseCommentNumber(c("FRONTRIGHT", "SpringSetting"))
  );

  const rearSpring = average(
    parseCommentNumber(c("REARLEFT", "SpringSetting")),
    parseCommentNumber(c("REARRIGHT", "SpringSetting"))
  );

  return {
    brakeBias: parseBrakeBias(c("CONTROLS", "RearBrakeSetting")),
    frontRideHeight,
    rearRideHeight,
    frontCamber,
    rearCamber,
    frontToe: parseCommentNumber(c("SUSPENSION", "FrontToeInSetting")),
    rearToe: parseCommentNumber(c("SUSPENSION", "RearToeInSetting")),
    // Nel tuo file questi sono preset ("P1"), non numeri: restano
    // undefined finché LMU non espone il valore Nm/mm reale nel commento.
    frontARB: parseCommentNumber(c("SUSPENSION", "FrontAntiSwaySetting")),
    rearARB: parseCommentNumber(c("SUSPENSION", "RearAntiSwaySetting")),
    frontSpring,
    rearSpring,
    diffPreload: parseCommentNumber(c("DRIVELINE", "DiffPreloadSetting")),
  };
}
