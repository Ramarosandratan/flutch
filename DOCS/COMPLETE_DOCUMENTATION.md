# Documentation complète — Projet Le Flutch

Cette documentation rassemble les livrables et instructions pour les 3 défis du test technique, la façon de valider les changements, et les commandes utiles pour exécuter les workers, les scripts de validation, et les tests.

## Sommaire
- Contexte et objectifs
- Défi 1 — Architecture, résilience et file de webhooks
- Défi 2 — Critère DPE (base, CRM, matching)
- Défi 3 — Worker autonome (Agent)
- Migrations SQL
- Extraits de code modifiés / ajoutés
- Commandes d'exécution et validation
- Tests et validation automatique
- Fichiers impactés
- Dépannage & notes opérationnelles

---

## Contexte et objectifs

Le Flutch est un moteur Node.js/Express qui synchronise des données depuis Pipedrive vers PostgreSQL, et effectue un rapprochement entre `biens` et `acquereurs`. Les objectifs des défis étaient :

- Défi 1 : rendre l'ingestion des webhooks asynchrone, durable et résiliente (Producer/Consumer).
- Défi 2 : ajouter le critère DPE (A..G) au schéma, à la synchronisation Pipedrive, et au moteur de matching.
- Défi 3 : implémenter un worker autonome qui consomme l'API du Flutch pour relancer des acquéreurs.

---

## Défi 1 — Architecture, résilience et file de webhooks

Résumé des choix et artefacts principaux :

- Pattern : Producer/Consumer avec queue durable en PostgreSQL (table `webhook_events`).
- Producer : `routes/webhooks.js` (réception HTTP, validation minimale, `enqueueWebhook(...)`, réponse 202 rapide).
- Queue service : `services/webhookQueue.js` (insert idempotent ON CONFLICT, `processBatch(limit)` avec `FOR UPDATE SKIP LOCKED`, retries/backoff, dead-letter).
- Consumer / Worker : `services/webhookQueueWorker.js` (boucle continue, metrics Prometheus, démarrage à la commande `npm run worker:webhooks`).

Propriétés importantes : idempotence (clef `dedup_key`), locking par deal (`lib/syncLock.lockDeal()`), retries exponentiels, métriques.

---

## Défi 2 — Critère DPE (A..G)

Objectifs couverts :

1. Ajout des colonnes DPE en base
2. Mapping du champ CRM Pipedrive vers `biens.dpe` et `acquereur_criteria.dpe_min`
3. Logique de matching qui garantit qu'un acquéreur demandant `dpe_min = B` ne verra jamais un bien `F`

### Migration SQL (exemples)

Exécution : lancer la migration SQL sur la base (ou appliquer manuellement) :

```sql
ALTER TABLE biens ADD COLUMN IF NOT EXISTS dpe TEXT;
ALTER TABLE acquereur_criteria ADD COLUMN IF NOT EXISTS dpe_min TEXT;
```

Ces colonnes sont aussi ajoutées dans le bootstrap du schéma (voir `db.js` / scripts de création si nécessaire).

### Intégration CRM (Pipedrive)

Fichiers clés :

- `pipedrive/fieldMapping.js` — résolution du champ DPE (plusieurs libellés acceptés). Exemple :

```js
// extrait de fieldMapping.js
dpe: findKey('DPE') || findKey('Classe DPE') || findKey('Diagnostic de performance energetique'),
```

- `pipedrive/sync.js` — normalisation et stockage :

```js
function normalizeDpe(value) {
  if (!value) return null;
  const dpe = String(value).trim().toUpperCase();
  return ['A','B','C','D','E','F','G'].includes(dpe) ? dpe : null;
}

// Dans syncBiens / syncAcquereurs: stocker `dpe` / `dpe_min` dans la table correspondante
```

### Algorithmique et garantie DPE

Approche : transformer la lettre DPE en rang (A=1 ... G=7) et appliquer une comparaison numérique.

Exemple (implémentation dans `db.js`) :

```js
const DPE_ORDER = { A:1, B:2, C:3, D:4, E:5, F:6, G:7 };

// Pour un acquéreur avec dpe_min = 'B', on calcule rank_min = DPE_ORDER['B'] (2)
// On n'autorise que les biens dont rank_bien <= rank_min

if (criteriaDpeMin) {
  criteriaConditions.push(`
    (CASE UPPER(COALESCE(b.dpe, ''))
      WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4
      WHEN 'E' THEN 5 WHEN 'F' THEN 6 WHEN 'G' THEN 7
      ELSE NULL END) <= $${paramIdx++}
  `);
  criteriaParams.push(DPE_ORDER[criteriaDpeMin]);
}
```

Cette logique empêche explicitement qu'un acquéreur demandant 'A' ou 'B' reçoive un bien noté 'F'.

---

## Défi 3 — Worker autonome (Agent)

Fichiers clés :

- `services/agent-worker.js` — implémentation du worker autonome, login + retry 401, boucle planifiée, sélection max 3 biens par acquéreur, rate limit entre envois.
- `services/agentState.js` — persistence locale JSON atomique (`data/agent-state.json`) pour éviter doublons.
- `services/agentConfig.js` — config par variables d'environnement (heures de travail, limites, chemins).

Points opérationnels :

- Démarrer le worker agent : `npm run worker:agent`.
- Le worker : s'authentifie (`POST /api/login`), récupère `/api/todos/dashboard`, choisit au maximum `MAX_BIENS_PER_ACQUEREUR` (par défaut 3) non envoyés (`non_traite`) et appelle `/api/email-queue/enqueue`.
- Respecte `WORK_START_HOUR` / `WORK_END_HOUR` et `CYCLE_INTERVAL_MINUTES`.

---

## Commandes utiles

- Installer dépendances (si besoin) :

```bash
npm install
```

- Lancer l'app :

```bash
npm start
```

- Lancer worker webhooks :

```bash
npm run worker:webhooks
```

- Lancer worker agent :

```bash
npm run worker:agent
```

- Charger les données seed pour tester Défi 2 :

```bash
npm run seed:e2e
```

- Lancer la suite de tests :

```bash
npm test
```

- Scripts de vérification dédiés :

```bash
node tests/verify-defi2.js    # validation automatique Défi 2
node scripts/test-webhook-queue.js  # fumée Défi 1
```

---

## Tests et validation

- Les tests unitaires et d'intégration se trouvent dans `tests/` et couvrent les schémas, middlewares, et comportements core. Après correction mineure du test de logs, la suite est verte : `104/104`.
- `tests/verify-defi2.js` vérifie schéma, seed, matching et routes API pour DPE.

---

## Fichiers impactés (liste non exhaustive)

- `routes/webhooks.js`
- `services/webhookQueue.js`
- `services/webhookQueueWorker.js`
- `pipedrive/fieldMapping.js`
- `pipedrive/sync.js`
- `db.js` (matching, DPE ordering)
- `services/agent-worker.js`
- `services/agentState.js`
- `services/agentConfig.js`
- `tests/verify-defi2.js`, `scripts/test-webhook-queue.js`

---

## Dépannage & notes opérationnelles

- Si `npm test` échoue en raison d'absences de fichiers de logs, vérifiez que `logs/` existe et est accessible ; le logger crée le répertoire automatiquement, mais les tests lisent le fichier rotatif le plus récent.
- Pour exécuter les tests d'intégration qui contactent l'API, démarrez le serveur local (`npm start`) avant d'exécuter `node tests/verify-defi2.js`.
- Si Pipedrive a des libellés personnalisés pour DPE, `pipedrive/fieldMapping.js` supporte plusieurs variantes (`DPE`, `Classe DPE`, etc.).

---

## Résumé bref prêt à partager au client

- Défi 1 : File de webhooks durable + worker opérationnel ; idempotence et retries implémentés.
- Défi 2 : Colonne `dpe` / `dpe_min` ajoutées, mapping Pipedrive assuré, matching DPE implémenté et validé (tests automatisés et script `verify-defi2.js`).
- Défi 3 : Worker autonome complet (auth, retry, état local, limites par cycle et par acquéreur).

Pour toute demande de formatage (PDF, README simplifié, ou dépôt Git public prêt à livrer), dites-moi le format souhaité et je l'exporte.
