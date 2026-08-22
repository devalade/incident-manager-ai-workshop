# Mission — Sécuriser le legacy puis ajouter l’escalade automatique

Le code fonctionne en production, mais il est difficile à faire évoluer et ne possède aucun test automatisé.

## Intention 1 — Refactorer sans casser

- identifiez les comportements actuels importants ;
- ajoutez des tests de caractérisation via l’API publique ;
- refactorez le code sans modifier ces comportements.

## Intention 2 — Ajouter la fonctionnalité

Aujourd’hui, les incidents sont escaladés manuellement. Cela provoque des retards de prise en charge.

Ajoutez une escalade automatique :

- les incidents importants doivent être transmis à la bonne équipe ;
- l'escalade doit se produire lorsque personne ne réagit assez vite ;
- évitez de déranger inutilement l'astreinte ;
- exposez le résultat dans l'API et ajoutez les tests nécessaires.

Le comportement actuel doit continuer à fonctionner. Les nouvelles règles doivent être couvertes par des tests.
