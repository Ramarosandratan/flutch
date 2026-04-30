#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const { exec } = require('child_process');
const { pool } = require('./db');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const pause = (ms = 3000) => new Promise(r => setTimeout(r, ms));

function log(msg, icon = '▶') {
  console.log(`\n${icon} ${msg}`);
}

function divider() {
  console.log('\n' + '='.repeat(70));
}

async function prompt(question) {
  return new Promise(resolve => {
    rl.question(`\n⏳ ${question} (Appuie sur Entrée...)`, () => {
      resolve();
    });
  });
}

async function demoDefi1() {
  divider();
  log('DÉFI 1 - Queue Webhook + Retry + Déduplication', '🎯');
  divider();

  await prompt('Étape 1: Vérifier la table webhook_events');
  const queueCheck = await pool.query(`
    SELECT COUNT(*) as total, 
           COUNT(CASE WHEN status='done' THEN 1 END) as done,
           COUNT(CASE WHEN attempts > 1 THEN 1 END) as retried
    FROM webhook_events
  `);
  const q = queueCheck.rows[0];
  log(`✅ Queue: ${q.total} événements | ${q.done} traités | ${q.retried} avec retry`, '📊');

  await prompt('Étape 2: Voir les événements les plus récents');
  const recent = await pool.query(`
    SELECT id, event_type, status, attempts, processed_at 
    FROM webhook_events 
    ORDER BY id DESC LIMIT 5
  `);
  log('Derniers événements:', '📋');
  recent.rows.forEach(r => {
    console.log(`  • Event #${r.id}: ${r.event_type} → ${r.status} (tentatives: ${r.attempts})`);
  });

  await prompt('Étape 3: Afficher les backoff exponential depuis les logs');
  const logFile = `logs/app-${new Date().toISOString().split('T')[0]}.log`;
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const retries = content.split('\n').filter(l => l.includes('[retry')).slice(-3);
    log('Derniers tentatives retry:', '🔄');
    retries.forEach(r => {
      if (r) {
        const match = r.match(/tentative (\d+).*retry dans (\d+)ms/);
        if (match) console.log(`  • Tentative ${match[1]} → retry dans ${match[2]}ms`);
      }
    });
  }

  log('✅ DÉFI 1 - Démontré: Queue durable, retry exponential, traitement asynchrone', '✅');
}

async function demoDefi2() {
  divider();
  log('DÉFI 2 - DPE Matching (Biens ↔ Acquéreurs)', '🎯');
  divider();

  await prompt('Étape 1: Afficher les biens avec DPE');
  const biens = await pool.query(`
    SELECT id, titre, dpe, prix_fai, rentabilite
    FROM biens 
    WHERE dpe IS NOT NULL 
    ORDER BY dpe, id 
    LIMIT 5
  `);
  log(`✅ ${biens.rowCount} biens avec DPE`, '📊');
  biens.rows.forEach(b => {
    console.log(`  • Bien #${b.id}: "${b.titre}" | DPE=${b.dpe} | ${b.prix_fai}€ | Rentabilité=${b.rentabilite}%`);
  });

  await prompt('Étape 2: Afficher les critères DPE des acquéreurs');
  const acq = await pool.query(`
    SELECT ac.id, a.titre, ac.dpe_min, ac.budget_min, ac.budget_max, ac.rentabilite_min
    FROM acquereur_criteria ac
    JOIN acquereurs a ON a.id = ac.acquereur_id
    WHERE ac.dpe_min IS NOT NULL
    ORDER BY ac.dpe_min
  `);
  log(`✅ ${acq.rowCount} acquéreurs avec critères DPE`, '👥');
  acq.rows.forEach(a => {
    console.log(`  • Acq #${a.id}: "${a.titre}" | Min DPE=${a.dpe_min} | Budget=${a.budget_min}-${a.budget_max}€ | Rentabilité min=${a.rentabilite_min}%`);
  });

  await prompt('Étape 3: Afficher les TODOS (résultats du matching)');
  const todos = await pool.query(`
    SELECT t.id, a.titre as acquereur, b.titre as bien, b.dpe, b.prix_fai
    FROM todos t
    JOIN acquereurs a ON a.id = t.acquereur_id
    JOIN biens b ON b.id = t.bien_id
    ORDER BY t.id
    LIMIT 5
  `);
  log(`✅ ${todos.rowCount} todos créés (premiers 5 affichés)`, '📋');
  todos.rows.forEach(t => {
    console.log(`  • Todo #${t.id}: "${t.acquereur}" ↔ "${t.bien}" (DPE=${t.dpe}, ${t.prix_fai}€)`);
  });

  log('✅ DÉFI 2 - Démontré: Matching intelligent basé sur critères DPE', '✅');
}

async function demoDefi3() {
  divider();
  log('DÉFI 3 - Agent Worker (Cycles + Contacts)', '🎯');
  divider();

  await prompt('Étape 1: Vérifier l\'état du worker');
  const stateFile = 'data/agent-state.json';
  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    log('Agent Worker State:', '⚙️');
    console.log(`  • Last cycle: ${state.lastCycleAt || 'N/A'}`);
    console.log(`  • Total sent: ${state.totalSent || 0}`);
    console.log(`  • Total errors: ${state.totalErrors || 0}`);
  }

  await prompt('Étape 2: Afficher l\'historique des cycles');
  const logFile = `logs/app-${new Date().toISOString().split('T')[0]}.log`;
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const cycles = content.split('\n')
      .filter(l => l.includes('Cycle completed'))
      .slice(-3);
    log('Derniers cycles exécutés:', '🔄');
    cycles.forEach(c => {
      const match = c.match(/Cycle completed.*?(\d+) contacted.*?(\d+) sent.*?(\d+) errors/);
      if (match) {
        console.log(`  • Contactés: ${match[1]}, Envoyés: ${match[2]}, Erreurs: ${match[3]}`);
      }
    });
  }

  await prompt('Étape 3: Afficher les action logs');
  const actions = await pool.query(`
    SELECT COUNT(*) as total FROM action_logs
  `);
  const logins = await pool.query(`
    SELECT COUNT(*) as logins FROM action_logs WHERE action = 'login'
  `);
  const contacts = await pool.query(`
    SELECT COUNT(*) as contacts FROM action_logs WHERE action = 'send_contact'
  `);

  log('Worker Activities:', '📝');
  console.log(`  • Total actions: ${actions.rows[0].total}`);
  console.log(`  • Logins: ${logins.rows[0].logins}`);
  console.log(`  • Contacts sent: ${contacts.rows[0].contacts}`);

  log('✅ DÉFI 3 - Démontré: Worker automatisé, cycles réguliers, logging complet', '✅');
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         🎉 DÉMONSTRATION LE FLUTCH - 3 DÉFIS                       ║');
  console.log('║                                                                    ║');
  console.log('║  Bienvenue! Cette démo montre les 3 défis implémentés:             ║');
  console.log('║  1️⃣  Queue Webhook + Retry + Dédup                                  ║');
  console.log('║  2️⃣  DPE Matching (Biens ↔ Acquéreurs)                              ║');
  console.log('║  3️⃣  Agent Worker (Cycles + Contacts)                               ║');
  console.log('║                                                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  try {
    await prompt('▶ Commencer la DÉMO - Étape 1: DÉFI 1 (Queue)');
    await demoDefi1();

    await prompt('▶ Continuer vers - Étape 2: DÉFI 2 (DPE Matching)');
    await demoDefi2();

    await prompt('▶ Continuer vers - Étape 3: DÉFI 3 (Agent Worker)');
    await demoDefi3();

    divider();
    log('🎉 DÉMONSTRATION COMPLÈTE!', '🎉');
    console.log('\n Tous les défis ont été validés et présentés.');
    console.log(' Pour continuer: visitez http://localhost:3000\n');
  } catch (e) {
    console.error('\n❌ Erreur:', e.message);
  } finally {
    await pool.end();
    rl.close();
    process.exit(0);
  }
}

main();
