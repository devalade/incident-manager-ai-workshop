import { Hono } from "hono";

type Incident = {
  id: string;
  title: string;
  service: string;
  severity: string;
  status: string;
  owner?: string;
  createdAt: string;
  escalated: boolean;
};

export function createApp() {
  const app = new Hono();
  const incidents: Incident[] = [];
  let nextId = 1;

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/incidents", (c) => {
    const status = c.req.query("status");
    if (status) return c.json(incidents.filter((item) => item.status === status));
    return c.json(incidents);
  });

  app.get("/incidents/:id", (c) => {
    const id = c.req.param("id");
    for (const item of incidents) {
      if (item.id === id) return c.json(item);
    }
    return c.json({ error: "Incident not found" }, 404);
  });

  app.post("/incidents", async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const severity = String(body.severity ?? "").toUpperCase();
    if (!body.title || !body.service || !severity || !["SEV1", "SEV2", "SEV3", "SEV4"].includes(severity)) {
      return c.json({ error: "title, service and a valid severity are required" }, 400);
    }

    const incident: Incident = {
      id: String(nextId++),
      title: String(body.title).trim(),
      service: String(body.service).trim().toLowerCase(),
      severity,
      status: "open",
      createdAt: new Date().toISOString(),
      escalated: false,
    };
    incidents.push(incident);
    return c.json(incident, 201);
  });

  app.post("/incidents/:id/escalate", (c) => {
    const id = c.req.param("id");
    const incident = incidents.find((item) => item.id === id);
    if (!incident) return c.json({ error: "Incident not found" }, 404);

    // Manual escalation. Automatic escalation is the workshop feature.
    incident.escalated = true;
    incident.owner = "on-call";
    return c.json(incident);
  });

  return app;
}
