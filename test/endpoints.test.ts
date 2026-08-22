import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/prisma/db.js';

const runEndpointTests = process.env.RUN_ENDPOINT_TESTS === '1';
const endpointDescribe = runEndpointTests ? describe : describe.skip;
const app = createApp();

async function request(path: string, init?: RequestInit) {
  const response = await app.request(path, init);
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    // Keep non-JSON responses, such as the CSV export, as text.
  }
  return { response, body, text };
}

function jsonRequest(path: string, method: string, body: unknown) {
  return request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

endpointDescribe('HTTP endpoints', () => {
  afterAll(async () => {
    await db.close();
  });

  it('runs every public endpoint through the Hono app', async () => {
    const reset = await request('/workshop/reset', { method: 'POST' });
    expect(reset.response.status).toBe(200);
    expect(reset.body).toEqual({ reset: true });

    const health = await request('/health');
    expect(health.response.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });

    const emptyIncidents = await request('/incidents');
    expect(emptyIncidents.response.status).toBe(200);
    expect(emptyIncidents.body).toEqual([]);

    const emptyDashboard = await request('/dashboard');
    expect(emptyDashboard.body).toMatchObject({ total: 0, open: 0, critical: 0 });

    const services = await request('/services');
    expect(services.response.status).toBe(200);
    expect((services.body as Array<{ name: string }>).some((service) => service.name === 'payments')).toBe(true);

    const createdService = await jsonRequest('/services', 'POST', {
      name: 'Analytics',
      team: 'team-data',
      critical: false,
    });
    expect(createdService.response.status).toBe(201);
    expect(createdService.body).toMatchObject({ name: 'analytics', team: 'team-data' });

    const updatedService = await jsonRequest('/services/analytics', 'PATCH', {
      critical: true,
      active: false,
    });
    expect(updatedService.response.status).toBe(200);
    expect(updatedService.body).toMatchObject({ critical: true, active: false });

    const onCall = await request('/teams/team-money/on-call');
    expect(onCall.response.status).toBe(200);
    expect(onCall.body).toEqual({ team: 'team-money', people: ['alice', 'bob'] });

    const updatedOnCall = await jsonRequest('/teams/team-data/on-call', 'PUT', { people: ['zoe'] });
    expect(updatedOnCall.response.status).toBe(200);
    expect(updatedOnCall.body).toEqual({ team: 'team-data', people: ['zoe'] });

    const maintenanceBefore = await request('/maintenance?service=catalog');
    expect(maintenanceBefore.response.status).toBe(200);
    expect(maintenanceBefore.body).toEqual([]);

    const createdMaintenance = await jsonRequest('/maintenance', 'POST', {
      service: 'catalog',
      startsAt: '2026-08-22T22:00:00Z',
      endsAt: '2026-08-23T01:00:00Z',
      reason: 'Endpoint test window',
    });
    expect(createdMaintenance.response.status).toBe(201);
    const maintenanceId = (createdMaintenance.body as { id: string }).id;

    const maintenanceAfter = await request('/maintenance?service=catalog');
    expect(maintenanceAfter.body).toHaveLength(1);

    const deletedMaintenance = await request(`/maintenance/${maintenanceId}`, { method: 'DELETE' });
    expect(deletedMaintenance.response.status).toBe(200);

    const createdIncident = await jsonRequest('/incidents', 'POST', {
      title: 'Checkout unavailable in Europe',
      service: 'payments',
      severity: 'sev1',
      tags: ['customer-impact'],
    });
    expect(createdIncident.response.status).toBe(201);
    const incidentId = (createdIncident.body as { id: string }).id;
    expect(createdIncident.body).toMatchObject({
      service: 'payments',
      severity: 'SEV1',
      owner: 'team-money',
    });

    const createdDuplicate = await jsonRequest('/incidents', 'POST', {
      title: 'Checkout still unavailable',
      service: 'payments',
      severity: 'SEV2',
    });
    expect(createdDuplicate.response.status).toBe(201);
    const duplicateId = (createdDuplicate.body as { id: string }).id;

    const incidents = await request('/incidents?severity=sev1');
    expect(incidents.response.status).toBe(200);
    expect((incidents.body as Array<{ id: string }>).map((incident) => incident.id)).toContain(incidentId);

    const incidentsByOwner = await request('/incidents?owner=team-money');
    expect(incidentsByOwner.response.status).toBe(200);
    expect((incidentsByOwner.body as unknown[]).length).toBeGreaterThan(0);

    const incident = await request(`/incidents/${incidentId}`);
    expect(incident.response.status).toBe(200);
    expect(incident.body).toMatchObject({ id: incidentId });

    const bulk = await jsonRequest('/incidents/bulk', 'POST', {
      incidents: [
        { title: 'Search latency', service: 'search', severity: 'SEV3' },
        { title: 'Invalid row', service: 'search', severity: 'SEV9' },
      ],
    });
    expect(bulk.response.status).toBe(207);
    expect(bulk.body).toMatchObject({ created: [{ service: 'search', severity: 'SEV3' }], rejected: [{ index: 1 }] });
    const bulkIncidentId = (bulk.body as { created: Array<{ id: string }> }).created[0]!.id;

    const sla = await request(`/incidents/${incidentId}/sla`);
    expect(sla.response.status).toBe(200);
    expect(sla.body).toMatchObject({ incidentId, minutes: 7 });

    const similar = await request(`/incidents/${incidentId}/similar`);
    expect(similar.response.status).toBe(200);
    expect((similar.body as Array<{ id: string }>).map((item) => item.id)).toContain(duplicateId);

    const merged = await jsonRequest(`/incidents/${incidentId}/merge`, 'POST', {
      duplicateId,
      actor: 'incident-manager',
    });
    expect(merged.response.status).toBe(200);
    expect(merged.body).toMatchObject({ duplicate: { id: duplicateId, status: 'resolved' } });

    const assigned = await jsonRequest(`/incidents/${incidentId}/assign`, 'POST', {
      owner: 'alice',
      actor: 'incident-manager',
    });
    expect(assigned.response.status).toBe(200);
    expect(assigned.body).toMatchObject({ owner: 'alice' });

    const acknowledged = await jsonRequest(`/incidents/${incidentId}/acknowledge`, 'POST', { actor: 'alice' });
    expect(acknowledged.response.status).toBe(200);
    expect(acknowledged.body).toMatchObject({ status: 'acknowledged', owner: 'alice' });

    const noted = await jsonRequest(`/incidents/${incidentId}/notes`, 'POST', {
      text: 'Customer support confirms impact.',
      actor: 'alice',
    });
    expect(noted.response.status).toBe(200);
    expect((noted.body as { notes: string[] }).notes).toContain('Customer support confirms impact.');

    const resolved = await jsonRequest(`/incidents/${incidentId}/resolve`, 'POST', {
      actor: 'alice',
      resolution: 'Traffic rerouted.',
    });
    expect(resolved.response.status).toBe(200);
    expect(resolved.body).toMatchObject({ status: 'resolved' });

    const reopened = await jsonRequest(`/incidents/${incidentId}/reopen`, 'POST', {
      actor: 'alice',
      reason: 'Regression detected.',
    });
    expect(reopened.response.status).toBe(200);
    expect(reopened.body).toMatchObject({ status: 'open' });

    const notification = await jsonRequest(`/incidents/${incidentId}/notify`, 'POST', {
      channel: 'slack',
      recipient: '#incidents',
      message: 'Incident reopened.',
    });
    expect(notification.response.status).toBe(201);
    expect(notification.body).toMatchObject({ incidentId, status: 'sent' });

    const notifications = await request(`/incidents/${incidentId}/notifications`);
    expect(notifications.response.status).toBe(200);
    expect(notifications.body).toHaveLength(1);

    const dailyReport = await request('/reports/daily');
    expect(dailyReport.response.status).toBe(200);
    expect(dailyReport.body).toMatchObject({ created: 3, sev1: 1 });

    const changedSeverity = await jsonRequest(`/incidents/${incidentId}/severity`, 'PATCH', {
      severity: 'SEV2',
      actor: 'incident-manager',
      reason: 'Impact reduced.',
    });
    expect(changedSeverity.response.status).toBe(200);
    expect(changedSeverity.body).toMatchObject({ severity: 'SEV2' });

    const suppressed = await jsonRequest(`/incidents/${bulkIncidentId}/suppress`, 'POST', {
      actor: 'incident-manager',
      reason: 'Known search maintenance.',
    });
    expect(suppressed.response.status).toBe(200);
    expect(suppressed.body).toMatchObject({ status: 'resolved', tags: ['suppressed'] });

    const audit = await request('/audit?actor=alice');
    expect(audit.response.status).toBe(200);
    expect((audit.body as Array<{ actor: string }>).every((event) => event.actor === 'alice')).toBe(true);

    const csv = await request('/export/incidents.csv');
    expect(csv.response.status).toBe(200);
    expect(csv.response.headers.get('content-type')).toContain('text/csv');
    expect(csv.text).toContain('id,title,service,severity,status,owner,createdAt,resolvedAt');

    const events = await request(`/incidents/${incidentId}/events`);
    expect(events.response.status).toBe(200);
    expect((events.body as Array<{ incidentId: string }>).every((event) => event.incidentId === incidentId)).toBe(true);

    const escalated = await request(`/incidents/${bulkIncidentId}/escalate`, { method: 'POST' });
    expect(escalated.response.status).toBe(200);
    expect(escalated.body).toMatchObject({ escalated: true, owner: 'on-call' });
  });
});
