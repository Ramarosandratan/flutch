# 🎯 Scénario Démonstration - Le Flutch
Date: 29 Avril 2026

## Plan de Démonstration (Semi-Automatisée)

### Phase 1️⃣ : DÉFI 1 - Queue Webhook + Retry + Dédup (5-10 min)
**Objectif**: Montrer le pipeline webhook durable avec retry/backoff

1. **Lancer le webhook worker**
   ```bash
   npm run worker:webhooks
   ```
   - Affiche metrics sur http://localhost:9101/metrics

2. **Poster un webhook test**
   ```bash
   node scripts/test-webhook-queue.js
   ```
   - Retour: 202 Accepted (découplé)
   - Worker traite en background

3. **Vérifier la queue**
   - SQL: `SELECT * FROM webhook_events ORDER BY id DESC LIMIT 1`
   - Expected: status='done', attempts=1, processed_at=NOW

4. **Montrer la déduplication**
   - Poster le même webhook 3× → seul 1 accepté
   - UNIQUE constraint sur dedup_key rejette doublons

### Phase 2️⃣ : DÉFI 2 - DPE Matching (3-5 min)
**Objectif**: Montrer matching Biens ↔ Acquéreurs sur critères DPE

1. **Lancer le serveur**
   ```bash
   npm start
   ```
   - App écoute sur http://localhost:3000

2. **Vérifier les données**
   - Biens: 8 avec DPE (A-G)
   - Acquéreurs: 4 avec dpe_min
   - Todos: 12 matches créés

3. **Afficher un match dans la UI**
   - Login: seed.agent@flutch.local / SeedPass1234
   - Voir la liste des todos générés par le matching

### Phase 3️⃣ : DÉFI 3 - Agent Worker (5-10 min)
**Objectif**: Montrer les cycles automatiques du worker

1. **Lancer l'agent worker**
   ```bash
   npm run worker:agent
   ```
   - Cycles every 30min (accelerated for demo)
   - Logs: "Cycle completed: X contacted, Y sent, Z errors"

2. **Vérifier les actions**
   - action_logs: 86 activités enregistrées
   - email_queue: messages préparés
   - Agent state: cycles exécutés

3. **Montrer les logs**
   - "✅ Login successful"
   - "📮 Processing acquereur #110: 2 bien(s)"
   - "✨ Cycle completed in XXs"

---

## 📊 Données de Démonstration

| Élément | Nombre | Status |
|---------|--------|--------|
| Biens | 8 | ✅ Avec DPE |
| Acquéreurs | 4 | ✅ Avec criteria DPE |
| Todos (matches) | 12 | ✅ Créés |
| Webhook events | 11 | ✅ Traités |
| Action logs | 86 | ✅ Enregistrés |

---

## 🚀 Commandes Rapides

```bash
# Vérification complète
node verify-all-defis.js

# Démo semi-auto Défi 1
npm run worker:webhooks &
sleep 2
node scripts/test-webhook-queue.js

# Démo semi-auto Défi 2+3
npm start &
sleep 3
npm run worker:agent

# Voir les logs en live
tail -f logs/app-$(date +%Y-%m-%d).log
```

---

## 💡 Points Clés à Montrer

✅ **Défi 1 (Queue)**: 202 immédiat → traitement asynchrone → retry exponential
✅ **Défi 2 (DPE)**: Matching intelligent basé sur critères (budget, DPE, secteur)
✅ **Défi 3 (Worker)**: Automation 24/7, logs clairs, cycles réguliers

**Durée totale: 15-25 minutes** (en fonction du rythme)
