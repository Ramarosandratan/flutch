# Livrable Technique — Defi 1

## Projet
Le Flutch (moteur de rapprochement immobilier)

## Objet du document
Documenter les attentes client du Defi 1 et les modifications implementees dans le code, avec les validations techniques associees.

---

## 1) Attentes client (extraites du brief)

### Contexte
Le traitement initial des webhooks Pipedrive etait synchrone dans le cycle HTTP, avec ecriture immediate en base de donnees.

### Missions attendues
1. Analyse critique des risques en cas de forte charge (ex: 500 webhooks/s).
2. Proposition d'architecture asynchrone, resiliente et tolerante aux pannes.
3. Implementation d'un pattern Producer/Consumer:
- un Producer qui recoit la requete webhook et la place en file
- un Consumer qui depile et traite de maniere sure en base

---

## 2) Analyse critique de l'architecture initiale

Sous forte charge, un traitement synchrone dans la requete HTTP expose les risques suivants:
1. Saturation du serveur API (latence et timeouts sur endpoint webhook).
2. Couplage fort entree reseau / traitement metier (faible resilience aux pics).
3. Risque de perte d'evenements en cas d'erreur transitoire (DB/API CRM).
4. Difficulte d'absorber les rafales (pas de buffering durable).
5. Scalabilite limitee (pas de repartition propre entre ingestion et execution metier).

---

## 3) Architecture cible retenue

### Pattern
Producer/Consumer avec file durable sur PostgreSQL.

### Composants
1. Producer HTTP:
- endpoint webhook valide la requete
- persiste l'evenement en file durable
- retourne rapidement une reponse HTTP (`202`)

2. Queue durable (PostgreSQL):
- table `webhook_events`
- deduplication par `dedup_key` (idempotence)
- statut de traitement (`pending`, `processing`, `done`, `failed`)
- retries avec `next_retry_at` et compteur `attempts`

3. Consumer (worker):
- depile en batch (`FOR UPDATE SKIP LOCKED`)
- lock logique par deal (advisory lock)
- execute le traitement metier
- applique retries exponentiels et dead-letter logique (`failed`)

4. Observabilite:
- compteurs/histogrammes Prometheus
- endpoint `/metrics` cote worker

---

## 4) Modifications implementees

## 4.1 Base de donnees
- Ajout migration idempotente de la table `webhook_events`.
- Colonnes clefs: `event_type`, `deal_id`, `dedup_key`, `payload`, `status`, `attempts`, `next_retry_at`, `last_error`, `processed_at`.

## 4.2 Producer (ingestion webhook)
- Le routeur webhook enqueue l'evenement au lieu de traiter le metier inline.
- Reponse HTTP immediate en `202` pour decoupler reception et execution.
- Correctif applique: handler route webhook rendu `async` pour permettre `await enqueueWebhook(...)`.

## 4.3 Consumer (worker)
- Ajout d'un worker dedie pour traitement continu des webhooks en file.
- Traitement batch + retries exponentiels + gestion des erreurs.
- Serialisation par deal via advisory lock PostgreSQL.

## 4.4 Service de queue
- `enqueueWebhook(...)`: insertion durable + idempotence.
- `processBatch(...)`: selection concurente sure, traitement metier, transitions d'etat.

## 4.5 Monitoring
- Ajout instrumentation Prometheus (`prom-client`).
- Gestion defensive des cas de duplicate registration et port metrics deja occupe.

## 4.6 Robustesse de configuration DB
- Chargement environnement au demarrage (`dotenv`).
- Coercition defensive `DATABASE_URL` / `password` en string pour eviter les erreurs SASL de type.

---

## 5) Fichiers impactes

- `db.js`
- `routes/webhooks.js`
- `services/webhookQueue.js`
- `services/webhookQueueWorker.js`
- `scripts/test-webhook-queue.js`
- `package.json`

---

## 6) Validation technique effectuee

### Verification syntaxe route webhook
- Chargement du module route sans erreur de syntaxe.
- Le blocage `await` hors fonction `async` a ete corrige.

### Verification flux queue (integration)
- Script de test execute:
- enqueue OK (`Enqueued: true`)
- traitement OK (`Processed items: 1`)

### Verification worker
- Demarrage worker OK.
- Exposition metrics OK (si port disponible).

---

## 7) Commits associes

- `3af0668` feat(webhooks): implement durable Producer/Consumer queue with resilience
- `8a6e362` fix(webhooks): make pipedrive handler async

---

## 8) Statut du Defi 1

Statut: Termine techniquement sur le perimetre demande.

Objectifs couverts:
1. Analyse critique: couverte.
2. Refactoring theorique: couvert et materialise.
3. Implementation Producer/Consumer: livree et validee.

---

## 9) Points d'amelioration optionnels (hors perimetre strict)

1. Ajouter des tests d'integration automatises sur route webhook + worker avec base dediee CI.
2. Ajouter une politique de retention/archivage des evenements `done` et `failed`.
3. Ajouter un endpoint admin de replay des evenements `failed`.
4. Etendre l'observabilite (alertes sur taux d'echec et temps de traitement).

---

## 10) Livrable remis

Ce document est produit dans le format attendu (Markdown structure) pour accompagner le depot Git et expliciter:
1. les attentes client,
2. les choix d'architecture,
3. les changements concrets,
4. les preuves de validation.
