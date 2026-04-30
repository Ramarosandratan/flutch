# 🎬 DÉMO - LE FLUTCH (3 Défis)

## 📌 Vue Rapide

**Application**: Le Flutch - Automatisation Immobilière  
**Date**: 29 Avril 2026  
**Défis**: 3 implémentés et validés ✅  
**Durée démo**: 20-25 minutes  

---

## 🚀 Démarrage Rapide

### Option 1: Démo Complète (Recommandée)

```bash
# Terminal 1: Vérifier que tout est prêt
node verify-all-defis.js

# Terminal 2: Lancer la démo interactive
node demo-interactive.js
```

### Option 2: Services Individuels

```bash
# Terminal 1: Serveur (http://localhost:3000)
npm start

# Terminal 2: Webhook worker (http://localhost:9101/metrics)
npm run worker:webhooks

# Terminal 3: Agent worker (cycles auto)
npm run worker:agent

# Terminal 4: Logs live
tail -f logs/app-$(date +%Y-%m-%d).log
```

---

## 📖 Structure des Défis

### 🎯 Défi 1 - Queue Webhook + Retry + Déduplication (5 min)

**Objectif**: Montrer un système de queue résilient

- ✅ **Queue durable**: Events stockés en Postgres
- ✅ **Retry exponential**: 300ms → 600ms → 1200ms
- ✅ **Déduplication**: UNIQUE constraint sur `dedup_key`
- ✅ **202 Accepted**: Réponse immédiate, traitement async

**Commandes de démo**:
```bash
# Vérifier la queue
psql -U postgres -d flutch -c "SELECT * FROM webhook_events ORDER BY id DESC LIMIT 5"

# Voir les retries dans les logs
grep "[retry" logs/app-*.log | tail -5

# Tester un webhook
node scripts/test-webhook-queue.js
```

**Points clés**:
- 11 événements traités (`status='done'`)
- 9 retry attempts observés
- 0 duplicate processing (UNIQUE constraint)

---

### 🎯 Défi 2 - DPE Matching (5 min)

**Objectif**: Montrer un matching intelligent basé sur critères DPE

- ✅ **Biens avec DPE**: 8/10 biens ont un rating DPE (A-G)
- ✅ **Critères acquéreurs**: 4 acquéreurs avec `dpe_min` configuré
- ✅ **Matching auto**: 12 todos créés (résultats du matching)

**Commandes de démo**:
```bash
# Voir les biens avec DPE
psql -U postgres -d flutch -c "
  SELECT id, titre, dpe, prix_fai, rentabilite FROM biens 
  WHERE dpe IS NOT NULL ORDER BY dpe LIMIT 8"

# Voir les critères acquéreurs
psql -U postgres -d flutch -c "
  SELECT ac.acquereur_id, ac.dpe_min, ac.budget_min, ac.budget_max 
  FROM acquereur_criteria WHERE dpe_min IS NOT NULL"

# Voir les todos générés
psql -U postgres -d flutch -c "SELECT COUNT(*) FROM todos"
```

**Points clés**:
- Distribution DPE complète: A×1, B×2, C×1, D×1, E×1, F×1, G×1
- 4 acquéreurs avec critères: B, D, G
- 12 matches générés automatiquement

---

### 🎯 Défi 3 - Agent Worker (5 min)

**Objectif**: Montrer l'automatisation avec cycles réguliers

- ✅ **Cycles auto**: Every 30 min (logged)
- ✅ **Authentication**: 7 logins réussis
- ✅ **Logging**: 86 action_logs enregistrées
- ✅ **Failsafe**: Retry sur erreur API

**Commandes de démo**:
```bash
# Voir l'état du worker
cat data/agent-state.json | jq '.'

# Compter les actions
psql -U postgres -d flutch -c "SELECT COUNT(*) FROM action_logs"

# Voir les derniers cycles
grep "Cycle completed" logs/app-*.log | tail -5

# Voir les logins
grep "Login successful" logs/app-*.log | wc -l
```

**Points clés**:
- 7 logins réussis en 8 cycles
- 4 acquéreurs traités
- 86 activités enregistrées
- 0 erreurs fatales

---

## 🎯 Scénario de Démo Guidée

### Setup (5 min avant la démo)

```bash
# Préparer l'environnement
node prepare-demo.js

# Ou manuellement:
npm install           # Dépendances
npm run seed-db      # Seed local DB
npm run seed-pipedrive  # Seed Pipedrive
```

### Phase 1: Accueil (1 min)

```
"Bonjour, je vais vous montrer Le Flutch - 
une application d'automatisation immobilière avec 3 défis implémentés."
```

### Phase 2: Défi 1 (5 min)

```bash
node demo-interactive.js
# → Affiche webhook_events
# → Montre retry exponential
# → Démontre déduplication
```

### Phase 3: Défi 2 (5 min)

```
Continuer dans la démo interactive...
# → Affiche biens avec DPE
# → Montre critères acquéreurs
# → Liste les todos générés
```

### Phase 4: Défi 3 (5 min)

```
Terminer la démo interactive...
# → État du worker
# → Historique des cycles
# → Action logs
```

### Phase 5: Démo Web (5 min)

```bash
# Lancer le serveur
npm start

# Accès:
# http://localhost:3000
# Login: seed.agent@flutch.local / SeedPass1234
```

---

## 📊 Données de Démo

| Élément | Nombre | Source |
|---------|--------|--------|
| Biens | 10 | DB seed |
| Biens avec DPE | 8 | Schema `dpe` |
| Acquéreurs | 4 | DB seed |
| Acquéreurs avec dpe_min | 4 | `acquereur_criteria` |
| Todos (matches) | 12 | Matching auto |
| Webhook events | 11 | Queue test |
| Action logs | 86 | Worker logs |

---

## 🔧 Fichiers Clés

| Fichier | Usage |
|---------|-------|
| `verify-all-defis.js` | Rapport complet des 3 défis |
| `demo-interactive.js` | **Démo guidée (MAIN)** |
| `prepare-demo.js` | Setup environnement |
| `DEMO-PLAN.md` | Plan détaillé |
| `DEMO-CHECKLIST.md` | Points à montrer |

---

## 💾 Login Credentials (Démo Web)

```
Email: seed.agent@flutch.local
Password: SeedPass1234
```

---

## 🌐 Accès Services

| Service | URL | Port | Usage |
|---------|-----|------|-------|
| App Web | http://localhost:3000 | 3000 | UI + API |
| Webhook Metrics | http://localhost:9101/metrics | 9101 | Prometheus |
| Database | postgres://localhost:5432/flutch | 5432 | Postgres |

---

## ⏱️ Timing

| Phase | Durée | Contenu |
|-------|-------|---------|
| Setup | 5 min | Vérifs + seeds |
| Accueil | 1 min | Intro |
| Défi 1 | 5 min | Queue + Retry |
| Défi 2 | 5 min | DPE Matching |
| Défi 3 | 5 min | Agent Worker |
| Web UI | 5 min | Visite de l'app |
| Q&A | 5 min | Questions |
| **TOTAL** | **25-30 min** | |

---

## 🎓 Points Pédagogiques

✅ Architecture résiliente (queue + retry)  
✅ Logique métier intelligente (matching)  
✅ Automation en production (worker cycles)  
✅ Logging structuré (Winston + JSON)  
✅ Monitoring (Prometheus metrics)  

---

## 💡 Pro Tips

1. **Avant la démo**: Lancer `npm start` en background
2. **Logs live**: Ouvrir `tail -f logs/app-*.log` dans un terminal dédié
3. **Pause naturelle**: Entre chaque défi, prendre 30s pour questions
4. **Terminer fort**: "Visitez http://localhost:3000 pour explorer"
5. **Avoir un backup**: Screenshots/vidéo des logs si demo échoue

---

## 🚨 Troubleshooting

**La démo s'arrête?**
```bash
# Redémarrer les services
npm start &
npm run worker:webhooks &
```

**Pas de logs?**
```bash
# Vérifier fichier log
ls -la logs/app-$(date +%Y-%m-%d).log
```

**DB vide?**
```bash
# Reseed
npm run seed-db
```

---

## 🎉 Success Criteria

✅ Tous les 3 défis validés et présentés  
✅ Q&A sans erreurs  
✅ Code accessible sur https://github.com  
✅ Feedback positif  

---

**Créé le**: 29 Avril 2026  
**Version**: 1.0  
**Statut**: 🟢 Production Ready
