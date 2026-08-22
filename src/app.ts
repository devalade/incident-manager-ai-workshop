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
  acknowledgedAt?: string;
  resolvedAt?: string;
  tags: string[];
  notes: string[];
};

type IncidentEvent = {
  incidentId: string;
  type: string;
  at: string;
  actor: string;
  details?: string;
};

export function createApp() {
  const app = new Hono();
  const incidents: Incident[] = [];
  const events: IncidentEvent[] = [];
  let nextId = 1;

  // Kept here because this file used to be "temporary".
  const teams: Record<string, string> = {
    payments: "team-money",
    checkout: "team-money",
    search: "team-discovery",
    catalog: "team-commerce",
    identity: "team-platform",
  };

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/incidents", (c) => {
    const status = c.req.query("status");
    const severity = c.req.query("severity");
    const owner = c.req.query("owner");
    let result = incidents;
    if (status) result = result.filter((item) => item.status === status);
    if (severity) result = result.filter((item) => item.severity === severity.toUpperCase());
    if (owner) result = result.filter((item) => item.owner === owner);
    return c.json(result);
  });

  app.get("/dashboard", (c) => {
    const open = incidents.filter((item) => item.status !== "resolved");
    return c.json({
      total: incidents.length,
      open: open.length,
      critical: open.filter((item) => item.severity === "SEV1").length,
      unassigned: open.filter((item) => !item.owner).length,
      escalated: open.filter((item) => item.escalated).length,
      byService: open.reduce<Record<string, number>>((acc, item) => {
        acc[item.service] = (acc[item.service] ?? 0) + 1;
        return acc;
      }, {}),
    });
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
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      notes: [],
    };
    incidents.push(incident);
    events.push({ incidentId: incident.id, type: "created", at: new Date().toISOString(), actor: "api" });

    // Old convenience rule. Nobody remembers whether clients depend on it.
    if (severity === "SEV1" && teams[incident.service]) {
      incident.owner = teams[incident.service];
      events.push({ incidentId: incident.id, type: "assigned", at: new Date().toISOString(), actor: "system", details: incident.owner });
    }
    return c.json(incident, 201);
  });

  app.post("/incidents/:id/assign", async (c) => {
    const incident = incidents.find((item) => item.id === c.req.param("id"));
    if (!incident) return c.json({ error: "Incident not found" }, 404);
    const body = await c.req.json<{ owner?: string; actor?: string }>();
    if (!body.owner || body.owner.trim().length < 2) return c.json({ error: "owner is required" }, 400);
    incident.owner = body.owner.trim();
    events.push({
      incidentId: incident.id,
      type: "assigned",
      at: new Date().toISOString(),
      actor: body.actor || "unknown",
      details: incident.owner,
    });
    return c.json(incident);
  });

  app.post("/incidents/:id/acknowledge", async (c) => {
    const id = c.req.param("id");
    const incident = incidents.find((item) => item.id === id);
    if (!incident) return c.json({ error: "Incident not found" }, 404);
    if (incident.status === "resolved") return c.json({ error: "Resolved incident cannot be acknowledged" }, 409);
    const body = await c.req.json<{ actor?: string }>().catch(() => ({ actor: undefined }));
    incident.status = "acknowledged";
    incident.acknowledgedAt = new Date().toISOString();
    if (!incident.owner && body.actor) incident.owner = body.actor;
    events.push({ incidentId: id, type: "acknowledged", at: incident.acknowledgedAt, actor: body.actor || "unknown" });
    return c.json(incident);
  });

  app.post("/incidents/:id/notes", async (c) => {
    const incident = incidents.find((item) => item.id === c.req.param("id"));
    if (!incident) return c.json({ error: "Incident not found" }, 404);
    const body = await c.req.json<{ text?: string; actor?: string }>();
    if (!body.text || body.text.trim() === "") return c.json({ error: "text is required" }, 400);
    incident.notes.push(body.text.trim());
    events.push({ incidentId: incident.id, type: "note", at: new Date().toISOString(), actor: body.actor || "unknown", details: body.text.trim() });
    return c.json(incident);
  });

  app.post("/incidents/:id/resolve", async (c) => {
    const incident = incidents.find((item) => item.id === c.req.param("id"));
    if (!incident) return c.json({ error: "Incident not found" }, 404);
    const body = await c.req
      .json<{ actor?: string; resolution?: string }>()
      .catch((): { actor?: string; resolution?: string } => ({}));
    if (incident.status === "resolved") return c.json(incident);
    incident.status = "resolved";
    incident.resolvedAt = new Date().toISOString();
    if (body.resolution) incident.notes.push(`RESOLUTION: ${body.resolution}`);
    events.push({ incidentId: incident.id, type: "resolved", at: incident.resolvedAt, actor: body.actor || "unknown", details: body.resolution });
    return c.json(incident);
  });

  app.get("/incidents/:id/events", (c) => {
    const incident = incidents.find((item) => item.id === c.req.param("id"));
    if (!incident) return c.json({ error: "Incident not found" }, 404);
    return c.json(events.filter((event) => event.incidentId === incident.id));
  });

  app.post("/incidents/:id/escalate", (c) => {
    const id = c.req.param("id");
    const incident = incidents.find((item) => item.id === id);
    if (!incident) return c.json({ error: "Incident not found" }, 404);

    // Manual escalation. Automatic escalation is the workshop feature.
    incident.escalated = true;
    incident.owner = "on-call";
    events.push({ incidentId: id, type: "escalated", at: new Date().toISOString(), actor: "manual", details: "on-call" });
    return c.json(incident);
  });

  return app;
}
