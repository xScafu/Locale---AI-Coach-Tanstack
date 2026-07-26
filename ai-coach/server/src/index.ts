import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { env } from "./env";
import chat from "./routes/chat.ts";
import profile from "./routes/profile.ts";
import dashboard from "./routes/dashboard.ts";
import cars from "./routes/cars";
import setups from "./routes/setups";
import problems from "./routes/problems";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "http://localhost:5173",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

app.get("/", (c) => {
  return c.json({
    status: "AI Coach API running",
  });
});

app.route("/api/dashboard", dashboard);
app.route("/api/chat", chat);
app.route("/api/profile", profile);
app.route("/api/cars", cars);
app.route("/api/setups", setups);
app.route("/api/problems", problems);

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  () => {
    console.log(`API running on ${env.PORT}`);
  }
);
