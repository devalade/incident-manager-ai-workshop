import { Collection } from '@prisma/orm-postgres/orm-client';
import type { Contract } from './contract.d.js';

export class IncidentCollection extends Collection<Contract, 'Incident'> {
  forService(service: string): IncidentCollection {
    return this.where({ service }) as unknown as IncidentCollection;
  }

  newestFirst(): IncidentCollection {
    return this.orderBy((incident) => incident.createdAt.desc()) as unknown as IncidentCollection;
  }
}
