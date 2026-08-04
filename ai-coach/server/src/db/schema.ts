import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),

  openAiModel: text("openai_model").$defaultFn(() => "gpt-5-mini"),

  maxInputTokens: integer("max_input_tokens").$defaultFn(() => 3000),

  maxOutputTokens: integer("max_output_tokens").$defaultFn(() => 1000),

  temperature: real("temperature").$defaultFn(() => 0.7),

  autoSummaryEvery: integer("auto_summary_every").$defaultFn(() => 20),

  createdAt: integer("created_at")
    .$defaultFn(() => Math.floor(Date.now() / 1000))
    .notNull(),
});

export const sessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),

  title: text("title").notNull(),

  isActive: integer("is_active", { mode: "boolean" })
    .$defaultFn(() => true)
    .notNull(),

  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),

  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),

  role: text("role").notNull(),

  content: text("content").notNull(),

  inputTokens: integer("input_tokens"),

  outputTokens: integer("output_tokens"),

  // JSON delle modifiche al setup proposte in questa risposta, cosi'
  // come le ha restituite il modello (vedi SetupChange in
  // openai.service.ts). Persistite qui perche' la chat lato client vive
  // solo in memoria: senza, i suggerimenti sparirebbero a ogni ricarica
  // della pagina.
  setupChanges: text("setup_changes"),

  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const pilots = sqliteTable("pilots", {
  id: text("id").primaryKey(),

  name: text("name").notNull(),

  level: text("level"),

  experience: text("experience"),

  drivingStyle: text("driving_style"),

  isActive: integer("is_active", { mode: "boolean" })
    .$defaultFn(() => true)
    .notNull(),

  createdAt: integer("created_at")
    .$defaultFn(() => Math.floor(Date.now() / 1000))
    .notNull(),
});

export const cars = sqliteTable("cars", {
  id: text("id").primaryKey(),

  pilotId: text("pilot_id")
    .references(() => pilots.id)
    .notNull(),

  manufacturer: text("manufacturer"),

  name: text("name").notNull(),

  simulator: text("simulator"),

  category: text("category"),

  notes: text("notes"),

  isActive: integer("is_active", {
    mode: "boolean",
  })
    .$defaultFn(() => true)
    .notNull(),

  createdAt: integer("created_at")
    .$defaultFn(() => Math.floor(Date.now() / 1000))
    .notNull(),
});

export const tracks = sqliteTable("tracks", {
  id: text("id").primaryKey(),

  pilotId: text("pilot_id")
    .references(() => pilots.id)
    .notNull(),

  name: text("name").notNull(),

  country: text("country"),

  // JSON stringificato: array di {lat, lon} presi da un giro pulito,
  // usato come sagoma fissa di sfondo nella pagina Telemetria.
  layout: text("layout"),

  // Variante del tracciato dichiarata dal simulatore (TrackLayout nei
  // metadata del file .duckdb): stesso circuito, layout diversi.
  variant: text("variant"),

  // ---- Scheda compilabile a mano ----
  // Precompilata dal profilo derivato quando disponibile, ma modificabile:
  // il valore scritto dal pilota vince sempre su quello calcolato.
  lengthM: real("length_m"),

  cornerCount: integer("corner_count"),

  // Tempo di riferimento personale in secondi, per dare al coach un
  // metro di paragone su cui misurare i giri nuovi.
  referenceLapSeconds: real("reference_lap_seconds"),

  notes: text("notes"),

  // ---- Profilo derivato dalla telemetria ----
  // JSON stringificato: { lengthM, bestLapSeconds, corners: [...] }.
  // Rigenerato a ogni import di quel circuito, vedi
  // services/track-profile.service.ts.
  profile: text("profile"),

  profileImportId: text("profile_import_id"),

  profileUpdatedAt: integer("profile_updated_at"),

  isActive: integer("is_active", {
    mode: "boolean",
  })
    .$defaultFn(() => true)
    .notNull(),

  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const setups = sqliteTable("setups", {
  id: text("id").primaryKey(),

  carId: text("car_id")
    .references(() => cars.id)
    .notNull(),

  name: text("name").notNull(),

  brakeBias: real("brake_bias"),

  frontRideHeight: real("front_ride_height"),

  rearRideHeight: real("rear_ride_height"),

  frontCamber: real("front_camber"),

  rearCamber: real("rear_camber"),

  frontToe: real("front_toe"),

  rearToe: real("rear_toe"),

  frontARB: real("front_arb"),

  rearARB: real("rear_arb"),

  frontSpring: real("front_spring"),

  rearSpring: real("rear_spring"),

  diffPreload: real("diff_preload"),

  notes: text("notes"),

  // Come pilots/cars/tracks, ma l'unicita' e' **per auto**: ogni auto ha
  // il suo setup attivo, ed e' quello che il coach usa come base per
  // suggerire modifiche.
  isActive: integer("is_active", { mode: "boolean" })
    .$defaultFn(() => true)
    .notNull(),

  // Il .svm originale, conservato per intero. La tabella tiene solo 12
  // valori numerici, mentre un setup di LMU ne contiene molti di piu':
  // senza il file di partenza non si potrebbe riprodurre un .svm
  // caricabile nel simulatore.
  sourceSvm: text("source_svm"),

  sourceFileName: text("source_file_name"),

  // Da quale setup deriva questa versione, quando nasce applicando i
  // suggerimenti del coach: serve a non perdere il punto di partenza.
  derivedFromId: text("derived_from_id"),

  createdAt: integer("created_at")
    .$defaultFn(() => Math.floor(Date.now() / 1000))
    .notNull(),
});

export const carProblems = sqliteTable("car_problems", {
  id: text("id").primaryKey(),

  carId: text("car_id")
    .references(() => cars.id)
    .notNull(),

  phase: text("phase").notNull(),

  problem: text("problem").notNull(),

  severity: integer("severity"),

  notes: text("notes"),

  createdAt: integer("created_at")
    .$defaultFn(() => Math.floor(Date.now() / 1000))
    .notNull(),
});

export const coachContexts = sqliteTable("coach_context", {
  id: text("id").primaryKey(),

  sessionId: text("session_id").references(() => sessions.id),

  pilotId: text("pilot_id").references(() => pilots.id),

  carId: text("car_id").references(() => cars.id),

  trackId: text("track_id").references(() => tracks.id),

  summary: text("summary"),

  createdAt: integer("created_at")
    .$defaultFn(() => Math.floor(Date.now() / 1000))
    .notNull(),
});

// Knowledge Base: voci curate (setup, tecniche di guida,
// problema->soluzione, note generali) che il coach consulta in base
// al messaggio dell'utente per dare risposte più informate e coerenti.
export const knowledgeBase = sqliteTable("knowledge_base", {
  id: text("id").primaryKey(),

  // "setup" | "tecnica" | "problema" | "generale" (libero, non enum
  // vincolante a livello DB per restare flessibili)
  category: text("category").notNull(),

  title: text("title").notNull(),

  content: text("content").notNull(),

  // parole chiave separate da virgola, usate per la ricerca
  tags: text("tags"),

  createdAt: integer("created_at")
    .$defaultFn(() => Math.floor(Date.now() / 1000))
    .notNull(),
});

// Import Telemetria: riferimento al file .duckdb caricato +
// struttura introspezionata (tabelle/colonne/righe) in JSON. Non
// salviamo i dati grezzi in SQLite: il file .duckdb resta la fonte di
// verità e viene interrogato al bisogno.
export const telemetryImports = sqliteTable("telemetry_imports", {
  id: text("id").primaryKey(),

  carId: text("car_id").references(() => cars.id),

  // Collegato automaticamente all'import leggendo "TrackName" dai
  // metadata del file: senza questo i dati non si aggregano per
  // circuito e il profilo del tracciato non si puo' costruire.
  trackId: text("track_id").references(() => tracks.id),

  // Anche il pilota viene dal file ("DriverName"): un import appartiene
  // a chi lo ha guidato, non a chi era attivo nell'app in quel momento.
  pilotId: text("pilot_id").references(() => pilots.id),

  fileName: text("file_name").notNull(),

  filePath: text("file_path").notNull(),

  // JSON stringificato: [{ name, columns: [{name, type}], rowCount }]
  tables: text("tables"),

  status: text("status").notNull(), // "pending" | "parsed" | "error"

  errorMessage: text("error_message"),

  // Tutti i metadata del file in JSON (DriverName, CarName, CarClass,
  // TrackName, TrackLayout, SessionType, WeatherConditions...): copiati
  // qui una volta sola per non dover riaprire il .duckdb ogni volta che
  // servono in elenco.
  metadata: text("metadata"),

  // Quando la sessione e' stata registrata, da "RecordingTime". Diverso
  // da createdAt, che e' quando il file e' stato caricato nell'app.
  recordedAt: integer("recorded_at"),

  createdAt: integer("created_at")
    .$defaultFn(() => Math.floor(Date.now() / 1000))
    .notNull(),
});

// RELAZIONI

export const coachContextsRelations = relations(coachContexts, ({ one }) => ({
  pilot: one(pilots, {
    fields: [coachContexts.pilotId],
    references: [pilots.id],
  }),

  car: one(cars, {
    fields: [coachContexts.carId],
    references: [cars.id],
  }),

  track: one(tracks, {
    fields: [coachContexts.trackId],
    references: [tracks.id],
  }),

  session: one(sessions, {
    fields: [coachContexts.sessionId],
    references: [sessions.id],
  }),
}));

export const pilotsRelations = relations(pilots, ({ many }) => ({
  cars: many(cars),

  tracks: many(tracks),

  contexts: many(coachContexts),
}));

export const carsRelations = relations(cars, ({ one, many }) => ({
  pilot: one(pilots, {
    fields: [cars.pilotId],
    references: [pilots.id],
  }),

  setups: many(setups),

  problems: many(carProblems),
}));

export const setupsRelations = relations(setups, ({ one }) => ({
  car: one(cars, {
    fields: [setups.carId],
    references: [cars.id],
  }),
}));

export const carProblemsRelations = relations(carProblems, ({ one }) => ({
  car: one(cars, {
    fields: [carProblems.carId],
    references: [cars.id],
  }),
}));

export const tracksRelations = relations(tracks, ({ one }) => ({
  pilot: one(pilots, {
    fields: [tracks.pilotId],
    references: [pilots.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ many }) => ({
  messages: many(messages),

  contexts: many(coachContexts),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(sessions, {
    fields: [messages.sessionId],
    references: [sessions.id],
  }),
}));
