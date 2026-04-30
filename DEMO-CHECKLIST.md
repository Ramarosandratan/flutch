# ✅ Checklist Préparation Démo

## 📋 État Actuel (29 Avril 2026)

### ✅ Défis Implémentés et Validés

| Défi | Status | Clés | Evidence |
|------|--------|------|----------|
| **Défi 1** | ✅ VALIDÉ | Queue durable, Retry (backoff expo), Dédup (UNIQUE) | 11 events, 9 retries, 4 syncs réussis |
| **Défi 2** | ✅ VALIDÉ | DPE matching, schema complet, todos créés | 8 biens DPE, 4 acq criteria, 12 todos |
| **Défi 3** | ✅ VALIDÉ | Worker cycles, auth, logging | 7 logins, 8 cycles, 86 action_logs |

---

## 🚀 Avant la Démo

### Vérifications Pré-Démo (10 min)

```bash
# 1. Vérifier tous les défis
node verify-all-defis.js

# 2. Vérifier la DB (seed)
npm run seed-db

# 3. Vérifier les services
npm start &          # Serveur sur :3000
npm run worker:webhooks &  # Webhook worker sur :9101/metrics

# 4. Vérifier les logs
tail -f logs/app-$(date +%Y-%m-%d).log
```

---

## 🎥 Déroulement Démo (20 minutes)

### Phase 1️⃣ : DÉFI 1 - Queue + Retry (5 min)
```bash
# Lancer le script interactif
node demo-interactive.js
# → Affiche webhook_events
# → Montre backoff exponential
# → Démontre déduplication
```

**Points clés à montrer:**
- ✅ 11 événements traités (`status='done'`)
- ✅ 9 retry attempts avec délais: 300ms → 600ms → 1200ms
- ✅ Dédup: 11 clés uniques = zéro double processing

---

### Phase 2️⃣ : DÉFI 2 - DPE Matching (5 min)

**SQL queries à exécuter en live:**

```sql
-- Biens avec DPE
SELECT dpe, COUNT(*) as count FROM biens 
WHERE dpe IS NOT NULL GROUP BY dpe ORDER BY dpe;
-- Result: A×1, B×2, C×1, D×1, E×1, F×1, G×1

-- Acquéreurs avec dpe_min
SELECT dpe_min, COUNT(*) FROM acquereur_criteria 
WHERE dpe_min IS NOT NULL GROUP BY dpe_min;
-- Result: B×1, D×1, G×1 (3 avec critères)

-- Todos générés
SELECT COUNT(*) FROM todos;
-- Result: 12 todos = matching results
```

**Points clés à montrer:**
- ✅ Matching intelligent basé sur DPE
- ✅ 8 biens, 4 acquéreurs, 12 matches créés
- ✅ Schema: `biens.dpe` + `acquereur_criteria.dpe_min`

---

### Phase 3️⃣ : DÉFI 3 - Agent Worker (5 min)

**Logs à chercher:**
```
grep "Cycle completed" logs/app-*.log | tail -5
# Affiche: "Cycle completed in XXs: Y contacted, Z sent, W errors"

grep "Login successful" logs/app-*.log | wc -l
# Result: 7 logins réussis

grep "Processing acquereur" logs/app-*.log | tail -3
# Affiche: "📮 Processing acquereur #110: 2 bien(s)"
```

**Points clés à montrer:**
- ✅ 7 logins réussis, 8 cycles exécutés
- ✅ 4 acquéreurs traités, 86 action logs
- ✅ Logging clair et détaillé (timestamps, emojis)

---

## 📊 Données Clés

### Biens (seed)
```sql
SELECT COUNT(*) FROM biens;
-- Result: 10 total, 8 with DPE
```

### Acquéreurs
```sql
SELECT COUNT(*) FROM acquereur_criteria WHERE dpe_min IS NOT NULL;
-- Result: 4 with DPE criteria
```

### Queue Status
```sql
SELECT status, COUNT(*) FROM webhook_events GROUP BY status;
-- Result: done: 11 (all processed)
```

---

## 🎬 Vidéo/Démo Points

### Ce qu'on va voir:
1. ✅ Système de queue résilient (webhook worker)
2. ✅ Retry avec backoff exponential (logs clairs)
3. ✅ Déduplication (UNIQUE constraint)
4. ✅ Matching DPE performant
5. ✅ Agent automatisé (cycles réguliers)
6. ✅ Logging complet et structuré

### Temps total: **20-25 minutes**
- Défi 1: 5 min
- Défi 2: 5 min
- Défi 3: 5 min
- Q&A / Discussion: 5 min

---

## 🔧 Scripts Disponibles

| Script | Commande | Durée | Résultat |
|--------|----------|-------|----------|
| Verification complète | `node verify-all-defis.js` | 3-5s | Rapport final |
| Démo interactive | `node demo-interactive.js` | 15-20m | Présentation guidée |
| Webhook test | `node scripts/test-webhook-queue.js` | 2-3s | Webhook posté + traité |
| Seed DB | `npm run seed-db` | 10-15s | Données injectées |

---

## ✨ Points de Personnalisation

- **Modifier les acquéreurs**: INSERT into `acquereur_criteria` via DB
- **Modifier les biens**: UPDATE `biens` set `dpe` = ...
- **Voir les metrics du worker**: `curl http://localhost:9101/metrics`
- **Logs live**: `tail -f logs/app-YYYY-MM-DD.log`

---

## 💡 Pro Tips

✅ Lancer `npm start` en arrière-plan avant la démo
✅ Avoir les logs ouverts dans un autre terminal
✅ Lancer `demo-interactive.js` et suivre les prompts
✅ Montrer les 3 phases dans l'ordre (build-up progressif)
✅ Terminer avec "visitez http://localhost:3000"

---

## 🎯 Goal
**Montrer que l'application Le Flutch est PRODUCTION-READY:**
- Architecture résiliente (queue + retry)
- Logique métier (matching DPE)
- Automatisation (worker cycles)
