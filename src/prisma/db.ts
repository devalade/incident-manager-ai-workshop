import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import { orm } from '@prisma/orm-postgres/orm-client';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };
import { IncidentCollection } from './collections.js';

const client = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});

export const db = {
  ...client,
  orm: orm({
    runtime: client.runtime(),
    context: client.context,
    collections: { Incident: IncidentCollection },
  }),
};
