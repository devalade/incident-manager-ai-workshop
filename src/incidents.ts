export type Severity = "SEV1" | "SEV2" | "SEV3" | "SEV4";
export type IncidentStatus = "open" | "acknowledged" | "resolved";

export type Incident = {
  id: string;
  title: string;
  service: string;
  severity: Severity;
  status: IncidentStatus;
  owner?: string;
  createdAt: string;
  escalated: boolean;
};

export type CreateIncident = Pick<Incident, "title" | "service" | "severity">;

export class IncidentStore {
  private incidents = new Map<string, Incident>();

  create(input: CreateIncident): Incident {
    const incident: Incident = {
      ...input,
      id: crypto.randomUUID(),
      status: "open",
      createdAt: new Date().toISOString(),
      escalated: false,
    };
    this.incidents.set(incident.id, incident);
    return incident;
  }

  list(): Incident[] {
    return [...this.incidents.values()];
  }

  find(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  // Intentionally naive: this is the code participants must challenge.
  escalate(id: string): Incident | undefined {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;

    incident.escalated = true;
    incident.owner = "on-call";
    return incident;
  }
}
