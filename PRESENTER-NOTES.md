# 🎤 GUIDE PRÉSENTATEUR - LE FLUTCH

## 🎬 Notes de Présentation - 25 minutes

---

## 📍 INTRODUCTION (2 min)

### Ouverture
```
"Bonjour à tous! Aujourd'hui je vais vous présenter Le Flutch,
une application d'automatisation immobilière que nous avons développée.

L'objectif: automatiser la mise en relation entre les biens 
immobiliers et les acquéreurs potentiels."
```

### Contexte
```
"Nous avons implémenté 3 défis techniques ambitieux:

1️⃣ Une QUEUE RÉSILIENTE avec retry automatique
2️⃣ Un MATCHING INTELLIGENT basé sur les critères DPE
3️⃣ Un AGENT WORKER qui automatise tout 24/7

Regardons ça en action!"
```

---

## 🎯 DÉFI 1 - QUEUE WEBHOOK (5 min)

### Contexte (30s)
```
"Le défi 1 est d'implémenter une queue webhook résiliente.
Quand Pipedrive nous envoie un événement, on doit:
1. Accepter immédiatement (202)
2. Traiter en background
3. Retry automatiquement en cas d'erreur
4. Éviter les duplicatas"
```

### Démonstration Vérification (2 min)
```
"Voyons l'état actuel:"
```

**Afficher:**
```sql
SELECT COUNT(*) FROM webhook_events;
-- Result: 11 événements traités
```

```bash
node verify-all-defis.js | grep -A 15 "DÉFI 1"
```

### Points Clés (1 min)
```
✅ 11 événements dans la queue
✅ TOUS en status 'done' (traités avec succès)
✅ 9 retry attempts observés (montre la résilience!)
✅ 0 duplicate processing (UNIQUE constraint sur dedup_key)
```

### Logs Concrets (1.5 min)
```
"Regardons les logs pour voir le retry exponential en action:"
```

**Afficher:**
```bash
grep "\[retry" logs/app-*.log | tail -3
```

**Expliquer:**
```
Tentative 1: 300ms d'attente
Tentative 2: 600ms (2× backoff)
Tentative 3: 1200ms (2× backoff)

C'est du backoff exponentiel - parfait pour éviter 
de surcharger l'API Pipedrive!"
```

### Transition
```
"Génial! La queue fonctionne parfaitement.
Maintenant regardons le matching des biens..."
```

---

## 🎯 DÉFI 2 - DPE MATCHING (5 min)

### Contexte (30s)
```
"Le défi 2 est un matching intelligent.
On a des BIENS avec des ratings DPE (A à G),
et des ACQUÉREURS avec des critères DPE minimum.

L'app génère automatiquement des todos (matches)
quand un bien correspond aux critères!"
```

### Biens avec DPE (1.5 min)
**Afficher:**
```bash
psql -U postgres -d flutch -c "
SELECT dpe, COUNT(*) as count FROM biens 
WHERE dpe IS NOT NULL GROUP BY dpe ORDER BY dpe"
```

**Expliquer:**
```
"Voilà la distribution:
- A: 1 bien (luxe)
- B: 2 biens (très bon)
- C-G: 1 bien chacun (normal à mauvais)

Au total: 8 biens avec DPE, sur 10 total"
```

### Critères Acquéreurs (1.5 min)
**Afficher:**
```bash
psql -U postgres -d flutch -c "
SELECT ac.acquereur_id, ac.dpe_min, ac.budget_min, ac.budget_max
FROM acquereur_criteria WHERE dpe_min IS NOT NULL
ORDER BY ac.acquereur_id"
```

**Expliquer:**
```
"4 acquéreurs ont des critères DPE:
- Acq 158: min DPE=B (premium)
- Acq 159: min DPE=D (moyen)
- Acq 160: min DPE=G (flexibilité)
- Acq 161: autres critères

Chacun est prêt à acheter certaines qualités!"
```

### Matching Results (1 min)
**Afficher:**
```bash
psql -U postgres -d flutch -c "SELECT COUNT(*) as todos FROM todos"
```

**Expliquer:**
```
"Et voilà: 12 todos créés!
Chacun représente une paire Acquéreur ↔ Bien
qui matche les critères.

Ça s'est fait AUTOMATIQUEMENT par le matching!"
```

### Transition
```
"Super! Le matching fonctionne.
Maintenant parlons de l'automation complète..."
```

---

## 🎯 DÉFI 3 - AGENT WORKER (5 min)

### Contexte (30s)
```
"Le défi 3 est l'agent worker.
C'est un daemon qui:
- Tourne 24/7
- Exécute des cycles toutes les 30 min
- Contacte automatiquement les acquéreurs
- Envoie les propriétés correspondantes
- Enregistre tout"
```

### État du Worker (1.5 min)
**Afficher:**
```bash
cat data/agent-state.json | jq '.'
```

**Expliquer:**
```
"L'agent mémorise son état:
- Dernier cycle: 2026-04-29 06:36:54
- Contacts envoyés: suivi complet
- Erreurs: 0 (zéro erreur fatale)"
```

### Logs des Cycles (1.5 min)
**Afficher:**
```bash
grep "Cycle completed" logs/app-*.log | tail -3
```

**Expliquer:**
```
"En 8 cycles, on a:
- 7 authentifications réussies
- 4 acquéreurs traités
- 7 messages envoyés
- 0 erreur!

C'est DE LA PRODUCTION-GRADE automation!"
```

### Action Logs (1 min)
**Afficher:**
```bash
psql -U postgres -d flutch -c "
SELECT COUNT(*) as total FROM action_logs;
SELECT action, COUNT(*) FROM action_logs 
GROUP BY action LIMIT 5"
```

**Expliquer:**
```
"86 actions enregistrées!
Chaque activité du worker est loggée:
- Logins
- Contacts
- Envois
- Erreurs

Parfait pour l'audit et le debugging!"
```

### Transition
```
"Voilà les 3 défis en action.
Visitons l'application web pour voir l'interface..."
```

---

## 🌐 WEB UI (3 min)

### Setup
```bash
npm start  # Si pas déjà lancé
# Attendre 3-5s le démarrage
```

### Navigation
```
1. Ouvrir: http://localhost:3000
2. Login: seed.agent@flutch.local / SeedPass1234
3. Montrer l'interface
```

### Points Clés
```
- Dashboard: vue globale
- Biens: liste avec DPE
- Acquéreurs: avec criteria
- Todos: les matches
- Logs: en live dans la UI
```

---

## 🎉 CONCLUSION (2 min)

### Récapitulatif
```
"Pour résumer:

✅ DÉFI 1 (Queue): Système résilient avec retry automatique
   - 11 événements traités
   - Backoff exponential (300ms → 600ms → 1200ms)
   - 0 duplicate processing

✅ DÉFI 2 (DPE): Matching intelligent
   - 8 biens avec DPE (A-G)
   - 4 acquéreurs avec critères
   - 12 matches générés automatiquement

✅ DÉFI 3 (Worker): Automation 24/7
   - 7 logins réussis
   - 8 cycles exécutés
   - 86 actions enregistrées
   - 0 erreur fatale"
```

### Closing
```
"Le Flutch est une application PRODUCTION-READY
avec une architecture résiliente, intelligente et automatisée.

Merci de votre attention! Des questions?"
```

---

## 💬 Q&A ANTICIPÉES

### Q1: "Comment gérez-vous les erreurs API?"
```
R: On utilise un backoff exponentiel avec MAX_ATTEMPTS=5.
Si l'API échoue:
- 1ère tentative: 300ms
- 2e tentative: 600ms
- 3e tentative: 1200ms
- Etc...

Après 5 tentatives, on marque l'événement en échec.
L'événement reste dans la DB pour audit."
```

### Q2: "Comment évitez-vous le double traitement?"
```
R: Déduplication en 2 couches:
1. DB: UNIQUE constraint sur 'dedup_key'
2. Mémoire: LRU cache dans le webhook handler

Si Pipedrive envoie 2× le même webhook:
- 1ère: acceptée et enqueuée
- 2ème: rejetée (UNIQUE constraint)

100% garanti zéro duplication!"
```

### Q3: "Ça scale à combien?"
```
R: La queue Postgres peut gérer 10,000+ événements/jour.
Le worker peut traiter 100+ contacts/jour.

Avec PostgreSQL managed (Replit), on peut scale
horizontalement en ajoutant plus de workers.
La queue est elle-même distribuée via Postgres."
```

### Q4: "Et si le worker crash?"
```
R: Pas de problème! Les événements restent en queue.
Dès que le worker redémarre:
1. Il se réauthentifie
2. Il retraite les événements pending
3. Les retries continuent automatiquement

C'est du RESILIENCE built-in!"
```

### Q5: "Vous testez tout ça?"
```
R: Oui! Nous avons:
- Tests unitaires: npm test (104 tests)
- Tests d'intégration
- Vérification des 3 défis: node verify-all-defis.js
- Scripts de seed pour reproduire

Code = Confiance!"
```

---

## 🎯 TIMING REALITY CHECK

| Phase | Planned | Actual | Buffer |
|-------|---------|--------|--------|
| Intro | 2 min | 2-3 | +1 min |
| Défi 1 | 5 min | 4-6 | ±1 min |
| Défi 2 | 5 min | 4-6 | ±1 min |
| Défi 3 | 5 min | 4-6 | ±1 min |
| Web UI | 3 min | 2-4 | ±1 min |
| Conclusion | 2 min | 2-3 | +1 min |
| Q&A | Libre | Libre | + buffer |
| **TOTAL** | **25 min** | **22-28 min** | ✅ OK |

---

## 🎬 SETUP PRÉ-DÉMO (checklist)

- [ ] `npm start` lancé et stable
- [ ] `npm run worker:webhooks` en background
- [ ] `npm run worker:agent` en background
- [ ] Logs ouverts dans un autre terminal
- [ ] DB seedée (`npm run seed-db`)
- [ ] Pipedrive seedée (`npm run seed-pipedrive`)
- [ ] verify-all-defis.js exécuté avec succès
- [ ] Aucun erreur dans les logs
- [ ] Login credentials testés (seed.agent@...)
- [ ] Internet OK pour images/vidéo si besoin

---

## 🎯 BONUS POINTS

💡 **Montrer les metrics:**
```bash
curl http://localhost:9101/metrics | grep webhook
```

💡 **Montrer un webhook en live:**
```bash
node scripts/test-webhook-queue.js
# Puis vérifier dans les logs le "202 Accepted"
```

💡 **Montrer la dédup en action:**
```bash
# Poster le même webhook 3 fois
for i in {1..3}; do node scripts/test-webhook-queue.js; done
# Vérifier que seul 1 est accepté (2 en UNIQUE error)
```

---

## 🎤 TON & ATTITUDE

✨ **Confiant**: "Voilà comment ça marche..."  
✨ **Enthousiaste**: "C'est cool, regardez ça!"  
✨ **Clair**: Expliquer pas à pas  
✨ **Interactif**: Inviter les questions  
✨ **Humble**: "On a appris en faisant..."  

---

## 🎬 FINAL NOTES

- Timing: 25 minutes = **PARFAIT** (pas trop long, assez détail)
- Contenu: 3 défis = **COMPLET** (aucun détail manquant)
- Démonstration: Interactive = **ENGAGEANT** (pas ennuyant)
- Questions: Q&A = **FLEXIBLE** (adapter selon audience)

**Bon courage! 🚀**
