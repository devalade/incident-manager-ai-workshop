import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/prisma/db';

const testService = `collection-test-${process.pid}`;

async function removeTestIncidents() {
  await db.orm.public.Incident.where({ service: testService }).deleteAll();
}

describe('Prisma collections', () => {
  beforeAll(removeTestIncidents);
  afterAll(async () => {
    await removeTestIncidents();
    await db.close();
  });

  it('filters, orders, and limits a collection', async () => {
    const latestIncident = await db.orm.public.Incident
      .orderBy((incident) => incident.id.desc())
      .first();
    const firstId = (latestIncident?.id ?? 0) + 1;

    await db.orm.public.Incident.create({
      id: firstId,
      title: 'Older test incident',
      service: testService,
      severity: 'SEV2',
      status: 'open',
      owner: null,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      escalated: false,
      acknowledgedAt: null,
      resolvedAt: null,
      tags: [],
      notes: [],
    });
    await db.orm.public.Incident.create({
      id: firstId + 1,
      title: 'Newer test incident',
      service: testService,
      severity: 'SEV1',
      status: 'open',
      owner: null,
      createdAt: new Date('2026-01-02T10:00:00.000Z'),
      escalated: false,
      acknowledgedAt: null,
      resolvedAt: null,
      tags: [],
      notes: [],
    });
    await db.orm.public.Incident.create({
      id: firstId + 2,
      title: 'Newest test incident',
      service: testService,
      severity: 'SEV1',
      status: 'open',
      owner: null,
      createdAt: new Date('2026-01-03T10:00:00.000Z'),
      escalated: false,
      acknowledgedAt: null,
      resolvedAt: null,
      tags: [],
      notes: [],
    });

    const incidents = await db.orm.public.Incident
      .forService(testService)
      .newestFirst()
      .take(2)
      .all();

    expect(incidents.map((incident) => incident.title)).toEqual([
      'Newest test incident',
      'Newer test incident',
    ]);
  });
});
