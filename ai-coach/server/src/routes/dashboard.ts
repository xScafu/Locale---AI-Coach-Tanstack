import { Hono } from "hono";

import { getDashboard } from "../services/dashboard.service";

const dashboard = new Hono();

dashboard.get("/", async (c) => {
  const result = await getDashboard();

  return c.json(result);
});

export default dashboard;
