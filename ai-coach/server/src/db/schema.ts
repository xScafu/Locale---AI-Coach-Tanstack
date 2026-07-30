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

  fileName: text("file_name").notNull(),

  filePath: text("file_path").notNull(),

  // JSON stringificato: [{ name, columns: [{name, type}], rowCount }]
  tables: text("tables"),

  status: text("status").notNull(), // "pending" | "parsed" | "error"

  errorMessage: text("error_message"),

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
