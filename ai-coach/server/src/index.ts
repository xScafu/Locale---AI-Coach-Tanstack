import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";

import { env } from "./env";
import chat from "./routes/chat.ts";
import profile from "./routes/profile.ts";
import dashboard from "./routes/dashboard.ts";
import cars from "./routes/cars";
import setups from "./routes/setups";
import problems from "./routes/problems";
import sessions from "./routes/sessions";
import knowledge from "./routes/knowledge";
import telemetry from "./routes/telemetry";
import tracks from "./routes/tracks";
import settingsRoute from "./routes/settings";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "http://localhost:5173",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// I file .duckdb possono essere grandi: limite dedicato più alto solo
// per l'endpoint di import (default Hono è più basso).
app.use(
  "/api/telemetry/import",
  bodyLimit({ maxSize: 200 * 1024 * 1024 }) // 200MB
);

app.get("/", (c) => c.json({ status: "AI Coach API running" }));

app.route("/api/dashboard", dashboard);
app.route("/api/chat", chat);
app.route("/api/profile", profile);
app.route("/api/cars", cars);
app.route("/api/setups", setups);
app.route("/api/problems", problems);
app.route("/api/sessions", sessions);
app.route("/api/knowledge", knowledge);
app.route("/api/telemetry", telemetry);
app.route("/api/tracks", tracks);
app.route("/api/settings", settingsRoute);

serve({ fetch: app.fetch, port: env.PORT }, () =>
  console.log(`API running on ${env.PORT}`)
);
