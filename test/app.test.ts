import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("incident API", () => {
  it("creates and lists an incident", async () => {
    const app = createApp();
    const created = await app.request("/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Checkout unavailable", service: "checkout", severity: "SEV1" }),
    });
    expect(created.status).toBe(201);

    const listed = await app.request("/incidents");
    expect(await listed.json()).toHaveLength(1);
  });

  it("escalates an existing incident with the current naive rule", async () => {
    const app = createApp();
    const response = await app.request("/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Latency", service: "search", severity: "SEV3" }),
    });
    const incident = await response.json() as { id: string };

    const escalated = await app.request(`/incidents/${incident.id}/escalate`, { method: "POST" });
    expect(escalated.status).toBe(200);
    expect(await escalated.json()).toMatchObject({ escalated: true, owner: "on-call" });
  });
});
