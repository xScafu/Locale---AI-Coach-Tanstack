// Il formato dei tempi sul giro: mm:ss:mmm, come li scrive il pilota.
//
// Prima ogni pagina aveva la sua copia della funzione — dashboard, chat e
// circuiti, tre volte la stessa — e tutte producevano "1:58.300", o
// "58.300s" sotto il minuto. Cosi' lo stesso giro cambiava aspetto a
// seconda della schermata, e un tempo senza minuti non si riconosce a
// colpo d'occhio come un tempo.
//
// I minuti si mostrano sempre, anche a zero: incolonnati, due tempi si
// confrontano leggendoli, senza contare le cifre.
export function formatLapTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";

  // Si arrotonda ai millesimi PRIMA di spezzare il valore: con 119.9996
  // i secondi verrebbero 59 e i millesimi 1000, cioe' "01:59:1000".
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

// Uno scarto non e' un tempo sul giro: resta in secondi col segno,
// perche' quello che conta e' di quanto e da che parte.
export function formatDeltaSeconds(seconds: number, digits = 3): string {
  if (!Number.isFinite(seconds)) return "—";

  return `${seconds > 0 ? "+" : ""}${seconds.toFixed(digits)}s`;
}
