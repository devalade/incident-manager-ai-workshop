# Incident Manager — exercice pour agents IA

Petite API TypeScript/Hono utilisée pour montrer qu'un agent ne peut pas compenser un besoin métier implicite.

## Installation

```bash
npm install
npm run typecheck
npm run dev
```

## API

- `POST /incidents`
- `GET /incidents`
- `GET /incidents/:id`
- `POST /incidents/:id/assign`
- `POST /incidents/:id/acknowledge`
- `POST /incidents/:id/notes`
- `POST /incidents/:id/resolve`
- `POST /incidents/:id/escalate`
- `GET /incidents/:id/events`
- `GET /dashboard`

## Déroulé du workshop

1. Donnez uniquement [TICKET.md](./TICKET.md) à votre agent.
2. Faites-lui d’abord caractériser le comportement actuel avec des tests, puis refactorer.
3. Notez ses hypothèses, les changements proposés et les questions qu'il n'a pas posées.
4. Interrogez l'Incident Manager joué par le facilitateur avant d’implémenter l’escalade automatique.
5. Comparez le code, les tests, les allers-retours et la supervision nécessaire.

> Participants : ne lisez pas `FACILITATOR.md` avant la phase d'entretien métier.

Le code initial est volontairement désordonné et ne possède aucun test. Il compile et fonctionne. L’objectif est de créer un filet de sécurité avant le refactoring, puis de découvrir les questions métier nécessaires à la nouvelle fonctionnalité.
