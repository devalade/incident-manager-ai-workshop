import { Hono } from "hono";
import { IncidentStore, type CreateIncident, type Severity } from "./incidents.js";

const severities: Severity[] = ["SEV1", "SEV2", "SEV3", "SEV4"];

export function createApp(store = new IncidentStore()) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/incidents", (c) => c.json(store.list()));

  app.get("/incidents/:id", (c) => {
    const incident = store.find(c.req.param("id"));
    return incident ? c.json(incident) : c.json({ error: "Incident not found" }, 404);
  });

  app.post("/incidents", async (c) => {
    const body = await c.req.json<Partial<CreateIncident>>();
    if (!body.title || !body.service || !body.severity || !severities.includes(body.severity)) {
      return c.json({ error: "title, service and a valid severity are required" }, 400);
    }
    return c.json(store.create(body as CreateIncident), 201);
  });

  app.post("/incidents/:id/escalate", (c) => {
    const incident = store.escalate(c.req.param("id"));
    return incident ? c.json(incident) : c.json({ error: "Incident not found" }, 404);
  });

  return app;
}
