# Incident Manager — exercice pour agents IA

Petite API TypeScript/Hono utilisée pour montrer qu'un agent ne peut pas compenser un besoin métier implicite.

## Installation

```bash
npm install
npm test
npm run typecheck
npm run dev
```

## API

- `POST /incidents`
- `GET /incidents`
- `GET /incidents/:id`
- `POST /incidents/:id/escalate`

## Déroulé du workshop

1. Donnez uniquement [TICKET.md](./TICKET.md) à votre agent et demandez-lui d'implémenter la fonctionnalité.
2. Notez ses hypothèses, les changements proposés et les questions qu'il n'a pas posées.
3. Interrogez l'Incident Manager joué par le facilitateur.
4. Formalisez les règles découvertes, puis recommencez avec le même agent.
5. Comparez le code, les tests, les allers-retours et la supervision nécessaire.

> Participants : ne lisez pas `FACILITATOR.md` avant la phase d'entretien métier.

Le code initial est volontairement naïf, mais il compile et ses tests passent. L'objectif n'est pas de deviner la « bonne » solution : c'est de découvrir les questions qui la rendent possible.
