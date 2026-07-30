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

**Pattern "record attivo"**: pilots, cars e tracks hanno tutti `isActive`. Deve essere
attivo un solo record per tabella — attivarne uno *deve* prima disattivare tutti gli
altri (vedi `activateCar` / `deactivateCars` in `car.repository.ts`). È il meccanismo
con cui il coach sa di cosa sta parlando.

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

### Client (`client/src`) — TanStack Router (file-based)

- Le rotte sono **file-based**: `routes/*.tsx` genera `routeTree.gen.ts` tramite il
  plugin Vite. `routeTree.gen.ts` è generato — non modificarlo a mano.
- Molte pagine hanno tutta la logica dentro il file di rotta (es. `routes/telemetry.tsx`
  contiene anche la proiezione GPS→SVG della mappa). Solo `dashboard` delega a `pages/`.
- **TanStack Query** per i dati server, **Zustand** per lo stato locale
  (`stores/pilot.store.ts`, `stores/settings.store.ts`).
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
- I `--chart-*` sono assegnati per canale di telemetria (1 freno, 2 gas, 3 velocità) e
  vanno tenuti stabili tra le pagine, altrimenti lo stesso canale cambia colore da un
  grafico all'altro.
- `--font-mono` è impostato per tempi sul giro e valori di telemetria: cifre a larghezza
  fissa, così i numeri non "ballano" mentre si aggiornano.

## Trappole note

- **Codice morto nel client.** Convivono più versioni della stessa cosa: la chat viva è
  `features/chat/` (`ChatWindow`, `ChatInput`, `features/chat/hooks/useChat.ts`), mentre
  `stores/chat.store.ts`, `api/profile.ts`, `pages/Chat.tsx` e `pages/Cars.tsx` non sono
  importati da nessuna parte. Verifica sempre chi importa un file prima di modificarlo:
  attenzione che `features/chat/components/*` importa `../hooks/useChat`, cioè quello
  dentro `features/chat/`, non uno omonimo altrove.
- **Nomi di file con refusi**, da non "correggere" alla cieca perché gli import sono
  coerenti con il refuso: `services/settings.ap.ts` (manca la `i` di `api`).
- La dashboard mostra il **primo** pilota/auto/circuito, non quello attivo:
  `dashboard.repository.ts` fa `.limit(1)` senza filtrare su `isActive`. Divergenza dal
  resto dell'app, che passa sempre da `getActivePilot` / `getActiveCar`.
- `server/.env.example` cita `DATABASE_URL`, ma non è letto da nessuna parte: il path del
  DB è hardcoded in `db/index.ts` e in `drizzle.config.ts`.
- La tabella `settings` ha `autoSummaryEvery`, ma `memory.manager.ts` usa `20` hardcoded.
- `storage/telemetry/` nella root è un residuo: il codice scrive in `server/data/telemetry/`.
- Le query DuckDB in `telemetry.service.ts` sono costruite per interpolazione di stringa
  (i nomi di tabella/canale vengono dal file caricato); `runReadOnlyQuery` esegue SQL
  arbitrario dal client aggiungendo solo un `LIMIT 200` se manca.
