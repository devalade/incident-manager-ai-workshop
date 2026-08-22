# Guide confidentiel du facilitateur

Vous jouez l'Incident Manager. Ne donnez pas toutes les règles spontanément : répondez aux questions précises des participants.

## Règles métier de référence

- **Sévérité ≠ priorité.** La sévérité mesure l'impact observé. La priorité d'action dépend aussi de la criticité du service, du nombre de clients, des obligations contractuelles et du contexte.
- **Accusé de prise en charge.** Le délai porte d'abord sur un accusé explicite par un humain responsable, pas sur la résolution.
- **SLA contextuel.** Les seuils diffèrent selon la sévérité, le service critique ou non, les heures ouvrées et l'astreinte. Il n'existe pas un délai universel.
- **Incident majeur.** Un SEV1 ou un incident multi-services ouvre une coordination dédiée ; il ne doit pas seulement être réassigné à « on-call ».
- **Corrélation.** Plusieurs alertes peuvent représenter le même incident. Les escalader séparément provoque une tempête de notifications.
- **Ownership.** L'équipe propriétaire du service est contactée d'abord. L'Incident Manager devient propriétaire de la coordination, pas nécessairement de la résolution technique.
- **Escalade graduelle.** Notification de l'équipe, puis lead d'astreinte, puis Incident Manager. Chaque étape attend un accusé et conserve son historique.
- **Réassignation.** Une réassignation ne doit ni réinitialiser silencieusement le SLA ni effacer les personnes déjà notifiées.
- **Temps et audit.** Toute décision utilise une horloge injectée, stocke l'instant, la règle appliquée, l'acteur et le résultat. Une simple valeur booléenne est insuffisante.
- **Faux positifs.** Les incidents supprimés, en maintenance planifiée ou déjà résolus ne sont pas escaladés.
- **Exceptions.** Un Incident Manager peut suspendre, accélérer ou rediriger une escalade avec une justification auditée.

## Questions que les participants devraient poser

- Que signifie « important » : sévérité, priorité, criticité ou impact ?
- « Personne ne réagit » signifie quoi et comment mesure-t-on l'accusé ?
- Quels seuils s'appliquent à quelles heures et à quels services ?
- Qui est « la bonne équipe » et où trouve-t-on l'ownership ?
- Que faire des doublons, maintenances, incidents résolus et incidents majeurs ?
- Faut-il notifier, réassigner, créer une action ou ouvrir une coordination ?
- Quel historique doit être conservé ? Peut-on rejouer la décision ?

## Signal pédagogique

Une solution qui ajoute seulement un `setTimeout`, compare la sévérité et affecte `owner = "on-call"` semble fonctionner techniquement, mais invente presque tout le métier. La réussite de l'exercice se mesure d'abord à la qualité des questions et du modèle métier produit.
