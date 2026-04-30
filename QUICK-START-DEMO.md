# 🚀 DÉMO QUICK START

## ⚡ 30 secondes pour démarrer

```bash
# Terminal 1: Lancer la démo interactive
node demo-interactive.js

# Suivre les prompts (Entrée pour continuer)
# Durée totale: 15-20 minutes
```

---

## 📋 Alternative: Full Setup (5 min)

```bash
# Terminal 1: Vérifier l'état
node verify-all-defis.js

# Terminal 2: Serveur web
npm start

# Terminal 3: Webhook worker
npm run worker:webhooks

# Terminal 4: Agent worker
npm run worker:agent

# Terminal 5: Logs live
tail -f logs/app-$(date +%Y-%m-%d).log

# Dans le navigateur
# http://localhost:3000
# Login: seed.agent@flutch.local / SeedPass1234
```

---

## 📊 État Actuel

| Défi | Status | Preuve |
|------|--------|--------|
| 1 - Queue | ✅ | 11 events, 9 retries, 0 dupes |
| 2 - DPE | ✅ | 8 biens, 4 acq, 12 todos |
| 3 - Worker | ✅ | 7 logins, 8 cycles, 86 logs |

**⏱️ Durée: 25 minutes maximum**

---

## 📚 Documentation

- `DEMO-README.md` - Guide complet
- `DEMO-PLAN.md` - Plan détaillé
- `DEMO-CHECKLIST.md` - Points à montrer
- `PRESENTER-NOTES.md` - Notes du présentateur

---

## 🎬 Lancer!

```bash
node demo-interactive.js
```

**C'est tout! Bon courage! 🎉**
