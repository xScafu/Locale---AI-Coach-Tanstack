# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Lingua

Il codice e i commenti di questo repo sono in italiano. I commenti esistenti spiegano
*perché* una cosa è fatta così (spesso descrivendo il bug che risolvono), non *cosa* fa
il codice: mantieni questo stile quando aggiungi commenti.

## Comandi

Dalla root (`ai-coach/`):

```bash
npm run dev          # client (Vite :5173) + server (tsx watch :3001) in parallelo
npm run build        # build:client (tsc -b && vite build) + build:server (tsc)
```

Per singolo workspace:

```bash
npm --prefix client run dev      # solo frontend
npm --prefix client run lint     # ESLint (unico linter del progetto)
npm --prefix server run dev      # solo API
```

Migrazioni Drizzle (da `server/`, la config usa path relativi al cwd):

```bash
npm --prefix server run db:generate   # genera SQL in server/drizzle/ dallo schema
npm --prefix server run db:migrate    # applica le migrazioni a server/data/ai-coach.db
```

Non ci sono test: nessun test runner è configurato in nessuno dei due workspace.

Il server richiede `server/.env` con `OPENAI_API_KEY`. `PORT` è opzionale (default 3001).

## Architettura

Monorepo a due workspace non collegati da tipi condivisi: `client/` e `server/`
si parlano solo via HTTP JSON, e i tipi delle risposte sono ridichiarati a mano
lato client in `client/src/services/*.api.ts`. Se cambi la forma di una risposta
API, aggiorna entrambi i lati.

### Server (`server/src`) — Hono + Drizzle

Stratificazione rigida, rispettala quando aggiungi funzionalità:

```
routes/ → services/ → repositories/ → db/
```

- **`routes/`** — un file Hono per risorsa, montato in `index.ts` sotto `/api/<nome>`.
  Le route fanno validazione a mano (`if (!body.x) return c.json({ error }, 400)`),
  generano gli id con `randomUUID()` e non toccano mai `db` direttamente.
  Zod è una dipendenza del *client*, non del server: non aspettarti schemi condivisi.
- **`repositories/`** — funzioni esportate singolarmente (non classi) che incapsulano
  le query Drizzle. Ogni file esporta anche i propri tipi `XInsert` / `XUpdate`.
- **`services/`** — logica applicativa e integrazioni esterne (OpenAI, DuckDB).

### Il "contesto del coach"

È il cuore dell'app e attraversa più file. Flusso di una richiesta di chat:

1. `routes/chat.ts` salva il messaggio utente, chiama `askCoach`, salva la risposta,
   poi chiama `checkMemoryUpdate`.
2. `services/app-context.service.ts` → `loadAppContext()` raccoglie in parallelo:
   pilota attivo, auto attiva, pista attiva, settings, memoria di sessione e voci
   della knowledge base pertinenti al messaggio; poi carica il riassunto telemetria
   dell'auto attiva.
3. `services/context.service.ts` → `buildCoachContext()` assembla il system prompt
   (sezioni `===== PILOTA =====`, `AUTO`, `TELEMETRIA`, `KNOWLEDGE BASE`, `MEMORIA`).
4. `services/openai.service.ts` chiama la **Responses API** (`client.responses.create`),
   non Chat Completions. Modello, `max_output_tokens` e `temperature` vengono dalla
   tabella `settings`.

**`temperature` non si passa ai modelli reasoning.** La famiglia `gpt-5` e gli `o1`/`o3`/`o4`
rispondono `400 Unsupported parameter` se la ricevono, e il default del progetto è
`gpt-5-mini`: il parametro va incluso solo quando `supportsTemperature(model)` è vero.
Quel controllo è basato sui prefissi del nome e invecchia a ogni nuovo modello, perciò
`createResponse` riprova una volta senza `temperature` se l'API la rifiuta comunque.
Conseguenza per l'interfaccia: il campo "Temperature" in Impostazioni non ha alcun effetto
finché il modello scelto è un reasoning.

Sempre sui reasoning: il ragionamento interno consuma il budget di `max_output_tokens`
(in una prova, 2176 token su 2278 erano `reasoning_tokens`). Per questo `askCoach`
distingue il caso `status === "incomplete"` con `reason === "max_output_tokens"` e
restituisce un messaggio dedicato invece di una risposta vuota.

**Pattern "record attivo"**: pilots, cars e tracks hanno tutti `isActive`. Deve essere
attivo un solo record per tabella — attivarne uno *deve* prima disattivare tutti gli
altri (vedi `activateCar` / `deactivateCars` in `car.repository.ts`). È il meccanismo
con cui il coach sa di cosa sta parlando.

Anche `setups` ha `isActive`, ma con una differenza: l'unicità è **per auto**, non
globale. `deactivateSetups` prende quindi un `carId` — ogni auto ha il suo setup attivo.

**Il coach non inventa mai i valori di partenza del setup.** Se l'auto attiva non ha un
setup attivo, la sezione `===== SETUP =====` gli dice esplicitamente di non proporre
modifiche e di chiedere invece il caricamento del `.svm`. Senza sapere da dove il pilota
parte, qualsiasi valore suggerito sarebbe campato in aria.

**Risposta strutturata.** `askCoach` usa un JSON Schema (`COACH_RESPONSE_FORMAT`): la
prosa sta in `reply`, le modifiche al setup in `setupChanges`, già tipizzate. L'enum dei
campi coincide con le colonne di `setups`. Estrarre i numeri dal testo libero era
l'alternativa, e si rompe appena il coach scrive "un paio di punti indietro".

Due fallback, perché il modello lo sceglie l'utente in Impostazioni: `createResponse`
riprova senza `text.format` se l'API lo rifiuta, e `parseCoachPayload` ricade sul testo
grezzo se la risposta non è il JSON atteso. In entrambi i casi si perdono i suggerimenti,
non la chat.

`setupChanges` viene persistito su `messages.setup_changes`, e `GET /api/setups/suggestions`
restituisce l'ultimo non vuoto. Serve perché **la chat lato client vive solo in memoria**
(`features/chat/store/chat.store.ts` non carica lo storico): senza persistenza i
suggerimenti sparirebbero a ogni ricarica della pagina.

### Setup: versioni e file `.svm`

Applicare i suggerimenti **non sovrascrive**: `POST /api/setups/:id/apply` crea una nuova
versione (`Base Monza` → `Base Monza v2`), la attiva e tiene `derivedFromId` verso quella
di partenza, che resta consultabile.

`setups.sourceSvm` conserva il file `.svm` **per intero**. La tabella ha solo dodici
colonne numeriche, mentre un setup di LMU contiene molti più parametri: senza l'originale
non si potrebbe produrre un file caricabile nel simulatore. Le versioni derivate lo
ereditano.

**Un setup senza `sourceSvm` degrada il coach in silenzio.** `buildSetupSection` ha due
rami: con il file elenca tutte le regolazioni dell'auto, senza ricade sulle dodici colonne
e **ordina di lasciare `setupChanges` vuoto**. Il sintomo è "il coach suggerisce sempre le
stesse parti e non cita mai ala o barre antirollio" — la causa non è il modello, è il file
mancante. Peggiora perché le barre della Ferrari valgono `E-P2`/`A-P1`, che non sono
numeri: `parseCommentNumber` le scarta e restano `NULL` anche tra le dodici colonne.
Quando manca il file, la scheda Setup mostra un avviso con il pulsante per ricaricarlo.

### Il formato `.svm` e il ragionamento a click

`services/svm.service.ts` è l'unico posto che legge e riscrive i file di setup.

Il valore che LMU legge è un **indice** (`CamberSetting=30`), il numero leggibile sta nel
commento (`//-1.0 deg`), e la scala che li lega **cambia per auto e per posizione**: sulla
BMW l'indice 30 davanti vale −1.0° e l'indice 20 dietro vale sempre −1.0°. Da un file non
si può quindi convertire un valore fisico nel suo indice.

Non serve: **l'interfaccia del gioco lavora a click**, ogni scatto è un `+1`/`-1`
sull'indice. Tutte le modifiche viaggiano perciò come `deltaClicks`, che si sommano
all'indice senza conoscere la scala. Il coach propone click, non valori finali — vedi lo
schema di `setupChanges` in `openai.service.ts`.

Conseguenze pratiche:

- `applyClicks` riscrive **solo** le righe toccate: su un file di 205 righe ne cambia 3.
  Il commento vecchio descriverebbe il valore precedente, quindi viene sostituito con
  `//era -1.4 deg (-2 click)`; il gioco legge l'indice e ricalcola l'etichetta da sé.
- Il limite **superiore** della scala non è nel file: si può solo impedire di scendere
  sotto zero, al resto pensa il gioco quando carica.
- Sulle auto con `Symmetric=1` i lati vengono accorpati in `FRONT.*` / `REAR.*` e
  riespansi in fase di applicazione: elencarli separati raddoppiava il prompt e invitava
  a muovere un lato solo, sbilanciando la vettura.
- `describeAdjustableSettings` scarta le regolazioni non pertinenti alla dinamica
  (carburante, soste, rapporti del cambio) e quelle marcate `N/A` / `Non-adjustable` /
  `Detached`. Senza questi due filtri l'elenco passa da 68 a 107 voci, e il modello
  reasoning ci impiega **oltre cinque minuti** a rispondere.

`POST /api/setups/:id/apply` genera il nuovo `.svm` e lo salva come `sourceSvm` della
nuova versione, poi rilegge da lì i dodici valori delle colonne. `GET /api/setups/:id/export`
restituisce quindi sempre `sourceSvm`, che per una versione derivata **contiene già le
modifiche**.

**Memoria di sessione**: ogni 20 messaggi `services/memory.manager.ts` riassume l'intera
conversazione via `summary.service.ts` e la scrive in `coach_context.summary`, che
rientra nel prompt al giro successivo.

### Telemetria — due database, due ruoli

Questa è la parte meno ovvia del progetto:

- **SQLite** (`server/data/ai-coach.db`, via Drizzle) è il database applicativo:
  piloti, auto, setup, chat, knowledge base e i *metadati* degli import di telemetria.
- **DuckDB** è il formato dei file di telemetria caricati dall'utente. I dati grezzi
  **non** vengono mai importati in SQLite: il file `.duckdb` resta la fonte di verità
  in `server/data/telemetry/<id>.duckdb` e viene interrogato al volo.
  `db/schema.ts` → `telemetry_imports` conserva solo path, stato e struttura in JSON.

`services/telemetry.service.ts` usa il driver **legacy `duckdb`** (API a callback,
wrappata in promise dagli helper locali `openDb` / `all`). Tiene una cache di
connessioni per filePath e una cache dei riassunti: entrambe vivono finché vive il
processo, e vanno bene perché un nuovo import produce sempre un nuovo filePath.

La logica dei giri non usa gli eventi `Lap` per i confini: rileva i reset del canale
`Lap Dist` (calo > 500 m). Vedi il commento sopra `computeLapSegments` prima di
toccarla. I canali hanno frequenze diverse e vengono riallineati per indice tramite
`channelsList` — non assumere che due canali condividano l'indice, tranne
`Lap Dist` / `GPS Latitude` / `GPS Longitude` che sono tutti a 10 Hz.

L'upload passa da un `bodyLimit` dedicato di 200 MB in `index.ts`.

### Le due famiglie di tabelle del file

Un file reale ha 101 tabelle, ed è un errore trattarle allo stesso modo:

- I **58 canali** elencati in `channelsList` sono serie continue senza `ts`: si
  allineano **per indice**, dividendo per la frequenza. Quindici di questi sono
  **per ruota** e hanno `value1`..`value4` invece di `value`: `fetchWholeChannel`
  legge `value` e su `TyresPressure` fallisce con "column not found". Per leggerli
  serve `fetchChannelShapes`, che ricava la forma di tutte le tabelle con una
  query sola.
- I **40 eventi** di `eventsList` hanno `ts` + `value`, ma **quasi nessuno è un
  evento**: trentacinque hanno una riga sola, scritta all'avvio. Sono le
  *regolazioni* con cui il pilota è sceso in pista — `TCLevel`, `ABSLevel`,
  `Brake Bias Rear`, `FuelMixtureMap`, `Engine Max RPM`. Non stanno nel `.svm`
  perché si cambiano dal volante, quindi il coach le riceve ma ha l'ordine
  esplicito di non metterle in `setupChanges`.

**L'ordine delle ruote è AS, AD, PS, PD** (anteriore sinistra, anteriore destra,
posteriore sinistra, posteriore destra), quello di rFactor 2 che LMU eredita.
Verificato su un file reale: `Brakes Temp` tocca 556 °C sulle prime due colonne e
478 °C sulle altre due — gli anteriori scaldano sempre di più — e dopo un incidente
`WheelsDetached` segna `value3` mentre l'usura della stessa ruota crolla a zero.

**`GPS Time` è l'unico canale con il tempo assoluto** e il suo primo campione
coincide con il `ts` del primo evento. È il modo per agganciare un evento a un giro:
senza, gli eventi hanno un orologio di sessione e i canali un indice, e i due non si
parlano.

### Il digest per il coach

`services/telemetry-digest.service.ts` produce quello che finisce nella sezione
`===== TELEMETRIA =====`: **una riga per giro** più il giro migliore aperto per
famiglia (gomme, frenata, energia, guida). Prima erano cinque numeri; ora sono ~46
righe, circa 780 token, e la risposta del coach resta sui 20 secondi.

La divisione del lavoro è dettata dal costo di marshalling del driver: i sei canali
che servono su **tutti** i giri si leggono interi una volta e si affettano in JS;
gli altri diciannove si leggono già ritagliati sul solo giro migliore. Leggere
venticinque canali interi vorrebbe dire milioni di righe convertite in oggetti JS.

Ogni campo è nullable e una sezione vuota **sparisce** dal prompt: una GT3 non ha
`Virtual Energy` né `Regen Rate`, e mostrarli a zero sarebbe peggio che tacerli.

Quattro trappole dei dati, tutte trovate confrontando i canali tra loro:

- **`Regen Rate` ha segno e unità diversi da quelli dichiarati.** In frenata la media
  è +112.700, in accelerazione −45.400: positivo è *recupero*, negativo è
  *erogazione*, e i valori sono **watt**, non i kW scritti in `channelsList`
  (194 kW di picco, coerenti con l'MGU di una Hypercar).
- **`Throttle Pos` è il gas dopo il controllo di trazione, `Throttle Pos Unfiltered`
  è il piede del pilota.** Quando il TC interviene (20% dei campioni) il pilota
  chiede 51.5% e al motore arriva 24.1%. Differiscono su 17.578 campioni su 40.858:
  chiamare il canale filtrato "uso acceleratore del pilota" attribuisce a lui quello
  che fa l'elettronica.
- **`Gear` conta doppio.** Il cambio passa per la folle a ogni innesto e la registra
  come evento a sé, 37 ms prima della marcia vera: in un file reale 288 eventi a
  zero su 576 esatti. I cambi sono gli eventi con valore diverso da zero.
- **`SurfaceTypes` va letto per numero di ruote.** "Almeno una ruota fuori
  dall'asfalto" fa 119 s su 817, il 15% della sessione: sono i cordoli, cioè guida
  normale, e passarli al coach come fuori pista lo porterebbe a rimproverare il
  pilota a ogni giro. "Tutte e quattro" fa 4.8 s ed è il fuori pista vero. Le due
  misure non sono simmetriche nemmeno per ruota: le destre stanno fuori tre volte
  più delle sinistre, perché i cordoli si prendono da un lato solo.

### Confronto fra telemetrie

`services/telemetry-compare.service.ts` confronta due giri — il proprio e uno di
**riferimento** — e dice dove se ne va il tempo.

Il confronto si fa **per distanza, non per tempo**. Due giri passano dagli stessi punti
in istanti diversi: allineandoli sul tempo, dopo la prima curva si confronterebbe la
propria staccata con l'uscita di curva dell'altro. Su una griglia di metri dal traguardo
(passo 5 m) ogni confronto è fra due auto nello stesso punto di pista.

Il numero che conta è il **delta cumulativo**: quanto tempo si è perso dall'inizio del
giro fino a lì. La sua pendenza dice dove il tempo se ne va.

**L'attribuzione è per sezioni, non per curve.** Ogni sezione va dall'ingresso di una
curva all'ingresso della successiva, cioè curva **più il rettilineo che la segue**, e le
sezioni sommate danno lo scarto totale. Con la sola finestra ingresso-uscita, su un giro
più lento di 6.5s se ne spiegavano 1.5: una curva sbagliata la si paga nei metri dopo.

**La numerazione delle curve è quella del profilo del circuito**, non ricavata dai due
giri: il coach ha l'ordine di chiamare le curve per numero, e due numerazioni diverse
nello stesso prompt lo farebbero contraddire nella stessa risposta.

Due cose falsano il confronto, e vanno distinte perché una è un evento vero e l'altra no:

- **Il giro con una fermata dentro** (`stopped`, minima sotto 20 km/h) non è un giro
  lento: è un testacoda o un rientro. Su un file reale un giro con l'auto ferma a 0.0 km/h
  si prende 5.6 dei 6.5 secondi di scarto in una curva sola, che detto al pilota suona
  come "sei lento lì".
- **I salti di `Lap Dist`** (`glitches`, e le curve toccate risultano `unreliable`).
  `Lap Dist` non è la distanza percorsa: è la posizione proiettata sulla linea del
  tracciato, e dove la pista si ripiega la proiezione scatta in avanti. A COTA lo stesso
  punto (3787 m) scatta di 9 metri in un decimo — 328 km/h — in tre giri diversi, con la
  velocità ferma a 72 km/h. Un salto in un giro solo produce un picco di quasi un secondo
  nel delta, che poi rientra.

  Il segnale che separa i due casi è il confronto fra i canali: nel testacoda la velocità
  crolla e la distanza si ferma, nel salto la velocità non cambia e la distanza corre.
  Le sezioni marcate `unreliable` restano visibili ma escluse dalle classifiche, sia a
  schermo sia nel prompt.

### Import di riferimento

`telemetry_imports.isReference` marca il giro con cui confrontarsi: uno per circuito,
come `setups.isActive` è uno per auto.

**Un riferimento NON deve passare da `syncImportFromMetadata`.** Quella funzione legge
`DriverName` e crea o attiva quel pilota, poi crea auto e circuito sotto di lui e
riscrive il profilo del tracciato. Su un file di un altro pilota vorrebbe dire spostare
l'app su di lui — Garage, Circuiti e Telemetria si svuotano dei propri dati — e cambiare
la numerazione delle curve che il coach usa per parlare. Il percorso alternativo è
`linkReferenceImport`, che copia i metadata e aggancia il circuito **fra quelli già
esistenti**, senza creare né attivare niente.

### Import: un file configura l'app

`POST /api/telemetry/import` non salva solo un file: `import-sync.service.ts` legge i
metadata e **allinea l'app alla sessione contenuta nel file**. Pilota (`DriverName`), auto
(`CarName` + `CarClass`) e circuito (`TrackName` + `TrackLayout`) vengono riconosciuti o
creati, **resi attivi**, collegati all'import, e il profilo del tracciato rigenerato.

Il confronto dei nomi passa da `namesMatch` (normalizzato, uno contenuto nell'altro), lo
stesso usato per i circuiti: ricaricare lo stesso file due volte non crea doppioni, la
seconda volta le entità risultano `matched` invece di `created`.

La sincronizzazione **non può far fallire l'import**: se un metadato manca o qualcosa
esplode, l'import resta `parsed` e il campo corrispondente torna `null`. Il risultato
(`sync`) descrive cosa è stato creato e cosa riconosciuto, e il client lo mostra —
un'app che si riconfigura da sola senza spiegarsi sembrerebbe un bug.

L'ordine conta: senza pilota non si può creare nient'altro, perché `cars.pilot_id` e
`tracks.pilot_id` sono `NOT NULL`.

**Il `carId` scelto a mano nel form vince** sul metadato: è una correzione esplicita.

Lato client `TelemetryUploader` (in dashboard) si limita a invalidare le query: il pilota
attivo arriva dal server, quindi non c'è nessuna copia locale da tenere allineata.

### Profilo del tracciato

Un circuito **non** è una scheda compilata a mano: le curve sono ricavate dalla
telemetria del pilota. `computeTrackProfile` (in `telemetry.service.ts`) prende il giro
più veloce del file e lo segmenta in curve.

Come funziona il rilevamento, in ordine:

1. Tratti in cui `|G Force Lat|` supera `0.6`.
2. Unione dei soli tratti **dello stesso verso** entro 60 m — due tratti di verso opposto
   sono curve distinte (una chicane), lo stesso verso spezzato in due è una curva sola il
   cui carico è calato a metà. Senza questa distinzione le curve lunghe si contano doppie.
3. Scarto dei tratti sotto 25 m o sotto 0.9G di picco: sono correzioni in rettilineo.
4. Per ogni curva, la staccata si cerca risalendo dall'ingresso **senza mai superare
   l'uscita della curva precedente**, altrimenti si attribuisce a una curva la frenata di
   quella prima.

La soglia definisce cosa è una curva *per il pilota*, non per la geometria della pista:
un curvone preso in pieno resta fuori di proposito. A Monza la Curva Grande segna 0.5G a
250 km/h e infatti non compare. Dipende quindi anche dall'auto.

Tarato su un file reale: Hypercar a Monza, 10 curve, 5775 m contro i 5793 ufficiali.

**Collegamento import → circuito.** `telemetry_imports.track_id` viene popolato
automaticamente da `track-profile.service.ts` leggendo `TrackName` dai metadata. Il
confronto dei nomi è volutamente tollerante (uno contenuto nell'altro, normalizzato):
il simulatore scrive "Autodromo Nazionale Monza" mentre il pilota chiama il circuito
"Monza", e un confronto esatto creerebbe un doppione a ogni import.

**Campi manuali vs derivati.** `lengthM` e `cornerCount` in `tracks` sono precompilati
dal profilo, ma `saveTrackProfile` li sovrascrive **solo se vuoti**: un valore corretto a
mano dal pilota sopravvive ai nuovi import. Il profilo grezzo sta in `tracks.profile`
come JSON e viene rigenerato per intero ogni volta.

### Riferimento personale (`profile.reference`)

Confronta **tutti** i giri dello stint, non solo il migliore: per ogni settore il tempo
più veloce (anche se viene da giri diversi) e per ogni curva la velocità minima più alta.
La somma dei settori migliori è il **giro teorico**.

**Solo i giri continui entrano nel confronto.** LMU tiene `Lap Dist` a 0 finché l'auto è
ferma ai box, poi la fa saltare di colpo al punto di rientro in pista. Su quel giro tutti
i traguardi intermedi risultano attraversati nello stesso istante, e i suoi "settori" da
pochi millesimi battono qualsiasi giro vero: senza filtro il giro teorico veniva 33s
invece di 96s. Il criterio è la continuità (nessun avanzamento oltre 100 m tra due
campioni a 10 Hz, cioè 3600 km/h), non il valore iniziale — che in quel caso è proprio 0
e quindi non distingue nulla.

`theoreticalLapSeconds` è `null` se anche un solo settore non ha un tempo valido: una
somma parziale sembrerebbe un giro teorico strepitoso mentre è solo incompleta.

**Limite noto.** Un giro in cui il pilota taglia una chicane risulta più veloce in quella
curva e finisce tra i "massimi personali". Il digest **misura** ora il fuori pista da
`SurfaceTypes` (vedi sopra il criterio delle quattro ruote), ma `computeReference` non
lo usa ancora per scartare i giri: il riferimento per curva resta quindi falsabile da un
taglio.

**Il primo e l'ultimo giro non entrano mai nelle analisi** (`analysableLaps`): il primo
esce dai box, l'ultimo è quasi sempre il frammento troncato di fine registrazione — in un
file reale durava 0.9 s e vinceva come "giro migliore", riducendo il best a 29.9 s su un
giro da 118 s e azzerando il giro teorico. Sotto i tre giri non si scarta nulla, altrimenti
non resterebbe niente da analizzare. La pagina Telemetria li mostra comunque, smorzati e
con la spiegazione: nasconderli farebbe sembrare persi dei dati.

**I giri sono numerati da `computeLapSegments` in sequenza, 1, 2, 3**, nell'ordine in cui
compaiono nel file. Il numero è quindi anche la posizione, e `getLapTelemetrySeries`
indicizza direttamente (`segments[lapNumber - 1]`).

Prima l'etichetta veniva dagli eventi `Lap` del simulatore tramite `labelForTime`, ma quel
contatore non riparte a ogni sessione e **non è univoco**: in un file reale tutti e sette
i giri risultavano "giro 8". Le conseguenze erano due, entrambe invisibili a occhio: la
selezione con `find()` sul numero rendeva irraggiungibili sei giri su sette (mostravano i
dati del primo), e nel riferimento del circuito ogni settore migliore riportava lo stesso
inutile "giro 8".

### Client (`client/src`) — TanStack Router (file-based)

- Le rotte sono **file-based**: `routes/*.tsx` genera `routeTree.gen.ts` tramite il
  plugin Vite. `routeTree.gen.ts` è generato — non modificarlo a mano.
- Molte pagine hanno tutta la logica dentro il file di rotta (es. `routes/telemetry.tsx`
  contiene anche la proiezione GPS→SVG della mappa). Solo `dashboard` delega a `pages/`.
- **TanStack Query** per i dati server, **Zustand** per lo stato puramente locale
  (`stores/settings.store.ts`).
- **Il pilota attivo è stato server**, non client: `hooks/useActivePilot.ts` legge
  `GET /api/profile/current`. Non reintrodurre una copia in `localStorage` — c'era, e
  divergeva dalla colonna `isActive`: bastava aprire l'app da un altro browser perché
  Garage, Circuiti e Telemetria filtrassero per un pilota diverso da quello attivo e
  apparissero vuoti. Chi cambia il pilota attivo invalida `ACTIVE_PILOT_KEY`.
  Le pagine devono distinguere `isPending` da "nessun pilota", altrimenti lampeggiano
  "salva prima un profilo" a ogni caricamento.
- `services/*.api.ts` sono le funzioni `fetch`. Ognuna ridichiara
  `const API_URL = "http://localhost:3001"` — non c'è un client HTTP centralizzato né
  una variabile d'ambiente per l'URL dell'API.
- CORS lato server è fissato su `http://localhost:5173`: se cambi la porta di Vite,
  aggiorna `server/src/index.ts`. Per lo stesso motivo il dev server del client deve
  restare sulla 5173.

### UI — shadcn/ui + Tailwind 4

- I componenti di base stanno in `components/ui/` e sono **codice del progetto**, non una
  dipendenza: si modificano direttamente. `components.json` fissa preset `radix-nova`,
  icone `lucide`, alias `@/`.
- **Alias `@/` → `client/src/`**, dichiarato in `tsconfig.json`, `tsconfig.app.json` e
  `vite.config.ts` (tutti e tre, altrimenti o TypeScript o Vite non risolve). Niente
  `baseUrl`: è deprecato in TypeScript 6, `paths` da solo risolve rispetto al tsconfig.
  Il codice più vecchio usa ancora import relativi; nei file che tocchi passa a `@/`.
- **Temi**: `ThemeProvider` in `components/theme-provider.tsx` applica la classe `light`
  o `dark` su `<html>` e la persiste in `localStorage`. Non usare `next-themes`: è un
  pacchetto Next e questo è un progetto Vite. Se rigeneri `components/ui/sonner.tsx`
  con la CLI, torna a importare `useTheme` da `next-themes` e va ricorretto a mano.
- **Colori solo via token semantici** (`bg-background`, `text-muted-foreground`,
  `bg-card`, `border-border`…), mai `bg-slate-900` o `text-gray-500` diretti: un colore
  hardcoded non segue il cambio di tema. I token sono definiti in `styles/global.css`,
  `:root` per il chiaro e `.dark` per lo scuro — vanno sempre aggiornati in coppia.
- La **sidebar è scura in entrambi i temi**: usa i token `--sidebar-*`, che nel tema
  chiaro sono volutamente scuri.
- I `--chart-*` sono assegnati per canale di telemetria (1 freno, 2 gas, 3 velocità,
  4 cursore, 5 canale scelto dal selettore) e vanno tenuti stabili tra le pagine,
  altrimenti lo stesso canale cambia colore da un grafico all'altro.
- I `--wheel-*` sono un asse diverso: identificano la **ruota** (AS, AD, PS, PD) nei
  canali che ne hanno quattro. Sono separati dai `--chart-*` apposta — riusare il rosso
  del freno per l'anteriore sinistra farebbe leggere il grafico come se parlasse di
  freno.
- `--font-mono` è impostato per tempi sul giro e valori di telemetria: cifre a larghezza
  fissa, così i numeri non "ballano" mentre si aggiornano.
- **Il padding di pagina lo mette `AppLayout`** (`max-w-7xl p-6`). Le pagine partono da
  `<div className="space-y-6">` e non aggiungono `p-6`/`p-8`, altrimenti il margine
  raddoppia. Per il titolo si usa `components/layout/PageHeader.tsx`.
- Radix `Select` non accetta `SelectItem` con `value=""`: dove serve un'opzione "nessuno"
  si usa un valore sentinella da tradurre in stringa vuota (vedi `NONE` in
  `routes/telemetry.tsx`).

## Trappole note

- **Codice morto nel client.** Convivono più versioni della stessa cosa: la chat viva è
  `features/chat/` (`ChatWindow`, `ChatInput`, `features/chat/hooks/useChat.ts`), mentre
  `stores/chat.store.ts`, `api/profile.ts`, `pages/Chat.tsx` e `pages/Cars.tsx` non sono
  importati da nessuna parte. Verifica sempre chi importa un file prima di modificarlo:
  attenzione che `features/chat/components/*` importa `../hooks/useChat`, cioè quello
  dentro `features/chat/`, non uno omonimo altrove.
- **Nomi di file con refusi**, da non "correggere" alla cieca perché gli import sono
  coerenti con il refuso: `services/settings.ap.ts` (manca la `i` di `api`).
- L'auto e il circuito attivi restano **solo** sul server (`isActive`), come il pilota:
  non aggiungere copie lato client, è la duplicazione che aveva già creato problemi con
  `pilot.store`.
- **DuckDB restituisce BigInt** da `COUNT(*)` e simili, e `JSON.stringify` sui BigInt
  lancia. `inspectDuckDbFile` e `runReadOnlyQuery` convertono già con `Number(...)`:
  fallo anche in ogni nuova query che finisce serializzata, o l'import torna "error".
- `server/.env.example` cita `DATABASE_URL`, ma non è letto da nessuna parte: il path del
  DB è hardcoded in `db/index.ts` e in `drizzle.config.ts`.
- La tabella `settings` ha `autoSummaryEvery`, ma `memory.manager.ts` usa `20` hardcoded.
- `storage/telemetry/` nella root è un residuo: il codice scrive in `server/data/telemetry/`.
- Le query DuckDB in `telemetry.service.ts` sono costruite per interpolazione di stringa
  (i nomi di tabella/canale vengono dal file caricato); `runReadOnlyQuery` esegue SQL
  arbitrario dal client aggiungendo solo un `LIMIT 200` se manca.
- I file `.duckdb` si aprono in **sola lettura** (`duckdb.OPEN_READONLY`): l'app non ci
  scrive mai. In lettura e scrittura DuckDB prende un lock esclusivo, e un secondo
  processo — uno script di analisi mentre gira il dev server — non riesce ad aprirli.
  Aprire un percorso **inesistente** non è un errore per DuckDB: crea un database vuoto,
  e il sintomo diventa "Table with name channelsList does not exist" con un `.duckdb` da
  12 KB rimasto fra gli orfani. Per questo `openDb` controlla prima che il file esista.
- I tempi sul giro si scrivono **mm:ss:mmm** (`01:58:300`). La funzione è duplicata a
  mano in `client/src/lib/lap-time.ts` e in `context.service.ts`, perché i due workspace
  non condividono codice: se cambia il formato, va cambiato in entrambi.
- **`npm run build:server` non compila** (98 errori già su `main`): `tsconfig.json` del
  server usa `moduleResolution: NodeNext`, che pretende l'estensione `.js` in ogni import
  relativo, mentre il codice non la mette da nessuna parte. Non è emerso prima perché
  `dev` gira su `tsx`, che se ne infischia. Per controllare davvero i tipi del server
  serve un tsconfig di servizio con `moduleResolution: Bundler` — con quello gli errori
  sono zero.
