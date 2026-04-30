#!/usr/bin/env node
/**
 * Préparateur de Démo - Le Flutch
 * Lance les services et prépare l'environnement
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║     🎬 PRÉPARATEUR DÉMO - LE FLUTCH                           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const services = [];

function log(msg, icon = '▶') {
  console.log(`${icon} ${msg}`);
}

function logSection(title) {
  console.log(`\n${title}`);
  console.log('─'.repeat(60));
}

async function runCommand(cmd, args, name) {
  return new Promise((resolve, reject) => {
    log(`Lançage: ${name}`, '🚀');
    const proc = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
    });

    services.push({ name, process: proc });

    proc.on('error', (err) => {
      console.error(`❌ Erreur ${name}:`, err);
      reject(err);
    });

    // Attendre un peu avant de continuer
    setTimeout(() => resolve(), 2000);
  });
}

async function prepare() {
  try {
    logSection('📋 ÉTAPE 1: Vérification de la DB');
    const { exec } = require('child_process');
    const { pool } = require('./db');
    
    const dbCheck = await pool.query('SELECT COUNT(*) FROM webhook_events');
    log(`✅ Database OK - ${dbCheck.rows[0].count} webhook events`, '✓');
    await pool.end();

    logSection('📋 ÉTAPE 2: Vérification des logs');
    const logDir = './logs';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      log('📁 Répertoire logs créé', '✓');
    } else {
      const files = fs.readdirSync(logDir);
      log(`✅ Logs: ${files.length} fichiers`, '✓');
    }

    logSection('📋 ÉTAPE 3: Vérification des seed');
    require('dotenv').config();
    log(`✅ Env variables chargées`, '✓');

    logSection('✨ PRÉPARATION COMPLÈTE!');
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  🎬 PRÊT POUR LA DÉMO                         ║
╚════════════════════════════════════════════════════════════════╝

📖 PROCHAINES ÉTAPES:

  1️⃣  Ouvrir 4 terminaux:
      Terminal 1: npm start
      Terminal 2: npm run worker:webhooks
      Terminal 3: npm run worker:agent
      Terminal 4: tail -f logs/app-\$(date +%Y-%m-%d).log

  2️⃣  Lancer la démo interactive:
      node demo-interactive.js

  3️⃣  Suivre les prompts (Entrée pour continuer)

📚 Documentation:
  - DEMO-PLAN.md: Vue d'ensemble
  - DEMO-CHECKLIST.md: Points clés à montrer
  - verify-all-defis.js: Rapport complet

🌐 Accès web:
  - App: http://localhost:3000
  - Metrics webhook: http://localhost:9101/metrics

💬 Login pour la démo:
  Email: seed.agent@flutch.local
  Password: SeedPass1234

═══════════════════════════════════════════════════════════════════
    Durée totale: 20-25 minutes
    Type: Semi-automatisée (interactif avec prompts)
═══════════════════════════════════════════════════════════════════
`);

  } catch (e) {
    console.error('\n❌ Erreur lors de la préparation:', e.message);
    process.exit(1);
  }
}

// Cleanup gracieux
process.on('SIGINT', () => {
  log('\nArrêt des services...', '🛑');
  services.forEach(({ name, process: proc }) => {
    log(`Fermeture: ${name}`, '⏹');
    proc.kill();
  });
  setTimeout(() => process.exit(0), 1000);
});

prepare();
