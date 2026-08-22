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

type Service = {
  name: string;
  team: string;
  critical: boolean;
  active: boolean;
  businessHoursOnly: boolean;
};

type MaintenanceWindow = {
  id: string;
  service: string;
  startsAt: string;
  endsAt: string;
  reason: string;
};

type Notification = {
  id: string;
  incidentId: string;
  channel: string;
  recipient: string;
  message: string;
  sentAt: string;
  status: "sent" | "failed";
};

export function createApp() {
  const app = new Hono();
  const incidents: Incident[] = [];
  const events: IncidentEvent[] = [];
  const maintenance: MaintenanceWindow[] = [];
  const notifications: Notification[] = [];
  let nextId = 1;
  let nextMaintenanceId = 1;
  let nextNotificationId = 1;

  // Kept here because this file used to be "temporary".
  const teams: Record<string, string> = {
    payments: "team-money",
    checkout: "team-money",
    search: "team-discovery",
    catalog: "team-commerce",
    identity: "team-platform",
  };

  const services: Service[] = [
    { name: "payments", team: "team-money", critical: true, active: true, businessHoursOnly: false },
    { name: "checkout", team: "team-money", critical: true, active: true, businessHoursOnly: false },
    { name: "search", team: "team-discovery", critical: false, active: true, businessHoursOnly: true },
    { name: "catalog", team: "team-commerce", critical: false, active: true, businessHoursOnly: true },
    { name: "identity", team: "team-platform", critical: true, active: true, businessHoursOnly: false },
  ];

  const onCall: Record<string, string[]> = {
    "team-money": ["alice", "bob"],
    "team-discovery": ["carol"],
    "team-commerce": ["dave", "erin"],
    "team-platform": ["frank"],
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

  app.get("/services", (c) => c.json(services));

  app.post("/services", async (c) => {
    const body = await c.req.json<Partial<Service>>();
    if (!body.name || !body.team) return c.json({ error: "name and team are required" }, 400);
    if (services.some((service) => service.name === body.name)) return c.json({ error: "Service already exists" }, 409);
    const service: Service = {
      name: body.name.toLowerCase().trim(),
      team: body.team.trim(),
      critical: body.critical === true,
      active: body.active !== false,
      businessHoursOnly: body.businessHoursOnly === true,
    };
    services.push(service);
    teams[service.name] = service.team;
    if (!onCall[service.team]) onCall[service.team] = [];
    return c.json(service, 201);
  });

  app.patch("/services/:name", async (c) => {
    const service = services.find((item) => item.name === c.req.param("name"));
    if (!service) return c.json({ error: "Service not found" }, 404);
    const body = await c.req.json<Partial<Service>>();
    if (typeof body.critical === "boolean") service.critical = body.critical;
    if (typeof body.active === "boolean") service.active = body.active;
    if (typeof body.businessHoursOnly === "boolean") service.businessHoursOnly = body.businessHoursOnly;
    if (body.team) {
      service.team = body.team;
      teams[service.name] = body.team;
    }
    return c.json(service);
  });

  app.get("/teams/:team/on-call", (c) => {
    const people = onCall[c.req.param("team")];
    if (!people) return c.json({ error: "Team not found" }, 404);
    return c.json({ team: c.req.param("team"), people });
  });

  app.put("/teams/:team/on-call", async (c) => {
    const body = await c.req.json<{ people?: string[] }>();
    if (!Array.isArray(body.people)) return c.json({ error: "people must be an array" }, 400);
    onCall[c.req.param("team")] = body.people.map((person) => person.trim()).filter(Boolean);
    return c.json({ team: c.req.param("team"), people: onCall[c.req.param("team")] });
  });

  app.get("/maintenance", (c) => {
    const service = c.req.query("service");
    if (service) return c.json(maintenance.filter((window) => window.service === service));
    return c.json(maintenance);
  });

  app.post("/maintenance", async (c) => {
    const body = await c.req.json<Partial<MaintenanceWindow>>();
    if (!body.service || !body.startsAt || !body.endsAt || !body.reason) {
      return c.json({ error: "service, startsAt, endsAt and reason are required" }, 400);
    }
    if (new Date(body.startsAt).getTime() >= new Date(body.endsAt).getTime()) {
      return c.json({ error: "endsAt must be after startsAt" }, 400);
    }
    const window: MaintenanceWindow = {
      id: String(nextMaintenanceId++),
      service: body.service,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      reason: body.reason,
    };
    maintenance.push(window);
    return c.json(window, 201);
  });

  app.delete("/maintenance/:id", (c) => {
    const index = maintenance.findIndex((window) => window.id === c.req.param("id"));
    if (index === -1) return c.json({ error: "Maintenance window not found" }, 404);
    const removed = maintenance.splice(index, 1)[0];
    return c.json(removed);
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

  app.post("/incidents/bulk", async (c) => {
    const body = await c.req.json<{ incidents?: Record<string, unknown>[] }>();
    if (!Array.isArray(body.incidents)) return c.json({ error: "incidents must be an array" }, 400);
    const created: Incident[] = [];
    const rejected: { index: number; reason: string }[] = [];
    for (let index = 0; index < body.incidents.length; index++) {
      const row = body.incidents[index];
      const severity = String(row.severity ?? "").toUpperCase();
      if (!row.title || !row.service || !["SEV1", "SEV2", "SEV3", "SEV4"].includes(severity)) {
        rejected.push({ index, reason: "invalid incident" });
        continue;
      }
      const incident: Incident = {
        id: String(nextId++),
        title: String(row.title).trim(),
        service: String(row.service).trim().toLowerCase(),
        severity,
        status: "open",
        createdAt: new Date().toISOString(),
        escalated: false,
        tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
        notes: [],
      };
      incidents.push(incident);
      created.push(incident);
      events.push({ incidentId: incident.id, type: "created", at: new Date().toISOString(), actor: "bulk-api" });
    }
    return c.json({ created, rejected }, rejected.length ? 207 : 201);
  });

  app.get("/incidents/:id/sla", (c) => {
    const incident = incidents.find((item) => item.id === c.req.param("id"));
    if (!incident) return c.json({ error: "Incident not found" }, 404);
    const service = services.find((item) => item.name === incident.service);
    let minutes = 480;
    if (incident.severity === "SEV1") minutes = 15;
    if (incident.severity === "SEV2") minutes = 60;
    if (incident.severity === "SEV3") minutes = 240;
    if (service?.critical && incident.severity !== "SEV4") minutes = Math.floor(minutes / 2);
    const dueAt = new Date(new Date(incident.createdAt).getTime() + minutes * 60_000).toISOString();
    return c.json({ incidentId: incident.id, minutes, dueAt, breached: Date.now() > new Date(dueAt).getTime() });
  });

  app.get("/incidents/:id/similar", (c) => {
    const incident = incidents.find((item) => item.id === c.req.param("id"));
    if (!incident) return c.json({ error: "Incident not found" }, 404);
    const words = incident.title.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
    const candidates = incidents.filter((other) => {
      if (other.id === incident.id || other.status === "resolved") return false;
      if (other.service === incident.service) return true;
      const title = other.title.toLowerCase();
      return words.some((word) => title.includes(word));
    });
    return c.json(candidates);
  });

  app.post("/incidents/:id/merge", async (c) => {
    const target = incidents.find((item) => item.id === c.req.param("id"));
    if (!target) return c.json({ error: "Incident not found" }, 404);
    const body = await c.req.json<{ duplicateId?: string; actor?: string }>();
    const duplicate = incidents.find((item) => item.id === body.duplicateId);
    if (!duplicate) return c.json({ error: "Duplicate incident not found" }, 404);
    if (duplicate.id === target.id) return c.json({ error: "Cannot merge incident into itself" }, 400);
    target.notes.push(...duplicate.notes, `Merged incident ${duplicate.id}: ${duplicate.title}`);
    target.tags = [...new Set([...target.tags, ...duplicate.tags])];
    if (!target.owner && duplicate.owner) target.owner = duplicate.owner;
    duplicate.status = "resolved";
    duplicate.resolvedAt = new Date().toISOString();
    events.push({ incidentId: target.id, type: "merged", at: new Date().toISOString(), actor: body.actor || "unknown", details: duplicate.id });
    events.push({ incidentId: duplicate.id, type: "merged-into", at: new Date().toISOString(), actor: body.actor || "unknown", details: target.id });
    return c.json({ target, duplicate });
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

  app.post("/incidents/:id/reopen", async (c) => {
    const incident = incidents.find((item) => item.id === c.req.param("id"));
    if (!incident) return c.json({ error: "Incident not found" }, 404);
    if (incident.status !== "resolved") return c.json({ error: "Only resolved incidents can be reopened" }, 409);
    const body = await c.req.json<{ actor?: string; reason?: string }>().catch((): { actor?: string; reason?: string } => ({}));
    incident.status = "open";
    incident.resolvedAt = undefined;
    if (body.reason) incident.notes.push(`REOPENED: ${body.reason}`);
    events.push({ incidentId: incident.id, type: "reopened", at: new Date().toISOString(), actor: body.actor || "unknown", details: body.reason });
    return c.json(incident);
  });

  app.post("/incidents/:id/notify", async (c) => {
    const incident = incidents.find((item) => item.id === c.req.param("id"));
    if (!incident) return c.json({ error: "Incident not found" }, 404);
    const body = await c.req.json<{ channel?: string; recipient?: string; message?: string }>();
    if (!body.channel || !body.recipient) return c.json({ error: "channel and recipient are required" }, 400);
    const notification: Notification = {
      id: String(nextNotificationId++),
      incidentId: incident.id,
      channel: body.channel,
      recipient: body.recipient,
      message: body.message || `[${incident.severity}] ${incident.title}`,
      sentAt: new Date().toISOString(),
      status: body.recipient.includes("invalid") ? "failed" : "sent",
    };
    notifications.push(notification);
    events.push({ incidentId: incident.id, type: "notification", at: notification.sentAt, actor: "api", details: `${notification.channel}:${notification.recipient}:${notification.status}` });
    return c.json(notification, notification.status === "sent" ? 201 : 502);
  });

  app.get("/incidents/:id/notifications", (c) => {
    const incident = incidents.find((item) => item.id === c.req.param("id"));
    if (!incident) return c.json({ error: "Incident not found" }, 404);
    return c.json(notifications.filter((notification) => notification.incidentId === incident.id));
  });

  app.get("/reports/daily", (c) => {
    const day = c.req.query("day") || new Date().toISOString().slice(0, 10);
    const selected = incidents.filter((incident) => incident.createdAt.startsWith(day));
    const closed = selected.filter((incident) => incident.status === "resolved");
    const durations = closed
      .filter((incident) => incident.resolvedAt)
      .map((incident) => new Date(incident.resolvedAt!).getTime() - new Date(incident.createdAt).getTime());
    return c.json({
      day,
      created: selected.length,
      resolved: closed.length,
      sev1: selected.filter((incident) => incident.severity === "SEV1").length,
      averageResolutionMinutes: durations.length
        ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length / 60_000)
        : null,
      services: [...new Set(selected.map((incident) => incident.service))],
    });
  });

  app.patch("/incidents/:id/severity", async (c) => {
    const incident = incidents.find((item) => item.id === c.req.param("id"));
    if (!incident) return c.json({ error: "Incident not found" }, 404);
    const body = await c.req.json<{ severity?: string; actor?: string; reason?: string }>();
    const severity = String(body.severity || "").toUpperCase();
    if (!["SEV1", "SEV2", "SEV3", "SEV4"].includes(severity)) return c.json({ error: "Invalid severity" }, 400);
    const previous = incident.severity;
    incident.severity = severity;
    events.push({
      incidentId: incident.id,
      type: "severity-changed",
      at: new Date().toISOString(),
      actor: body.actor || "unknown",
      details: `${previous}->${severity}:${body.reason || "no reason"}`,
    });
    return c.json(incident);
  });

  app.post("/incidents/:id/suppress", async (c) => {
    const incident = incidents.find((item) => item.id === c.req.param("id"));
    if (!incident) return c.json({ error: "Incident not found" }, 404);
    const body = await c.req.json<{ actor?: string; reason?: string }>();
    if (!body.reason) return c.json({ error: "reason is required" }, 400);
    incident.status = "resolved";
    incident.resolvedAt = new Date().toISOString();
    incident.tags.push("suppressed");
    incident.notes.push(`SUPPRESSED: ${body.reason}`);
    events.push({ incidentId: incident.id, type: "suppressed", at: incident.resolvedAt, actor: body.actor || "unknown", details: body.reason });
    return c.json(incident);
  });

  app.get("/audit", (c) => {
    const actor = c.req.query("actor");
    const type = c.req.query("type");
    const since = c.req.query("since");
    let result = events;
    if (actor) result = result.filter((event) => event.actor === actor);
    if (type) result = result.filter((event) => event.type === type);
    if (since) result = result.filter((event) => new Date(event.at).getTime() >= new Date(since).getTime());
    return c.json(result);
  });

  app.get("/export/incidents.csv", (c) => {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = ["id,title,service,severity,status,owner,createdAt,resolvedAt"];
    for (const incident of incidents) {
      rows.push([
        incident.id,
        escape(incident.title),
        escape(incident.service),
        incident.severity,
        incident.status,
        escape(incident.owner || ""),
        incident.createdAt,
        incident.resolvedAt || "",
      ].join(","));
    }
    c.header("content-type", "text/csv; charset=utf-8");
    c.header("content-disposition", 'attachment; filename="incidents.csv"');
    return c.body(rows.join("\n"));
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
