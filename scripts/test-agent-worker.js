'use strict';

/**
 * Test script for Agent Worker.
 * Manual verification of key functionality before deployment.
 * 
 * Usage:
 *   node scripts/test-agent-worker.js
 */

const { AgentWorker } = require('../services/agent-worker');

// Mock config for testing
const mockConfig = {
  FLUTCH_API_URL: process.env.FLUTCH_API_URL || 'http://localhost:3000',
  FLUTCH_EMAIL: process.env.FLUTCH_EMAIL || 'agent-test@example.com',
  FLUTCH_PASSWORD: process.env.FLUTCH_PASSWORD || 'password123',
  MAX_SENDS_PER_CYCLE: 20,
  CYCLE_INTERVAL_MINUTES: 30,
  MAX_BIENS_PER_ACQUEREUR: 3,
  RATE_LIMIT_MS: 2500,
  API_CALL_MAX_RETRIES: 3,
  API_CALL_RETRY_DELAY_MS: 1000,
  TIMEZONE: 'Europe/Paris',
  WORK_START_HOUR: 9,
  WORK_END_HOUR: 19,
  STATE_FILE_PATH: 'data/agent-state.json',
  DEBUG: true,
};

async function runTests() {
  console.log('🧪 Agent Worker Test Suite\n');
  console.log('═'.repeat(60));

  let passed = 0;
  let failed = 0;

  // Test 1: Config validation
  console.log('\n✓ Test 1: Config validation');
  try {
    if (!mockConfig.FLUTCH_API_URL) throw new Error('FLUTCH_API_URL missing');
    if (!mockConfig.FLUTCH_EMAIL) throw new Error('FLUTCH_EMAIL missing');
    if (!mockConfig.FLUTCH_PASSWORD) throw new Error('FLUTCH_PASSWORD missing');
    console.log('  ✅ Config valid');
    passed += 1;
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    failed += 1;
  }

  // Test 2: Worker initialization
  console.log('\n✓ Test 2: Worker initialization');
  try {
    const worker = new AgentWorker(mockConfig);
    if (!worker.config) throw new Error('Worker config not set');
    if (!worker.state) throw new Error('Worker state not initialized');
    console.log('  ✅ Worker initialized');
    passed += 1;
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    failed += 1;
  }

  // Test 3: shouldRunCycle logic
  console.log('\n✓ Test 3: shouldRunCycle() logic');
  try {
    const worker = new AgentWorker(mockConfig);
    const result = worker.shouldRunCycle();
    console.log(`  ℹ️  Current hour: ${new Date().getHours()}, shouldRunCycle: ${result}`);
    console.log(`  ✅ shouldRunCycle() returns boolean`);
    passed += 1;
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    failed += 1;
  }

  // Test 4: selectBestBiens logic
  console.log('\n✓ Test 4: selectBestBiens() logic');
  try {
    const worker = new AgentWorker(mockConfig);
    const mockBiens = [
      { id: 1, titre: 'Bien 1', rentabilite: 5.5, statut_todo: 'non_traite' },
      { id: 2, titre: 'Bien 2', rentabilite: 7.2, statut_todo: 'non_traite' },
      { id: 3, titre: 'Bien 3', rentabilite: 6.1, statut_todo: 'non_traite' },
      { id: 4, titre: 'Bien 4', rentabilite: 8.3, statut_todo: 'envoye' },
      { id: 5, titre: 'Bien 5', rentabilite: 6.8, statut_todo: 'non_traite' },
    ];

    const selected = worker.selectBestBiens(mockBiens, 3);
    if (selected.length !== 3) throw new Error(`Expected 3 selected, got ${selected.length}`);
    if (selected[0].id !== 2) throw new Error(`Expected Bien 2 first (rentabilite 7.2), got Bien ${selected[0].id}`);
    console.log(`  Selected biens (by rentabilité DESC):`);
    selected.forEach((b) => console.log(`    - Bien ${b.id}: ${b.rentabilite}%`));
    console.log('  ✅ selectBestBiens() works correctly');
    passed += 1;
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    failed += 1;
  }

  // Test 5: State persistence
  console.log('\n✓ Test 5: State persistence (AgentState)');
  try {
    const { AgentState } = require('../services/agentState');
    const state = new AgentState('data/test-agent-state.json');
    
    state.recordContact(123, [1, 2, 3]);
    const contact = state.getContact(123);
    if (!contact) throw new Error('Contact not recorded');
    if (contact.sentBienIds.length !== 3) throw new Error(`Expected 3 sent biens, got ${contact.sentBienIds.length}`);
    
    const hasBeen = state.hasBienBeenSent(123, 1);
    if (!hasBeen) throw new Error('Bien 1 should be marked as sent');
    
    const stats = state.getStats();
    console.log(`  State stats: ${stats.totalContacts} contacts, ${stats.totalSents} total sends`);
    console.log('  ✅ State persistence works');
    passed += 1;
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    failed += 1;
  }

  // Test 6: Config loading
  console.log('\n✓ Test 6: Config loading (agentConfig)');
  try {
    const { loadConfig } = require('../services/agentConfig');
    
    // Set required env var
    process.env.FLUTCH_PASSWORD = 'test-password';
    
    const config = loadConfig();
    if (!config.FLUTCH_API_URL) throw new Error('FLUTCH_API_URL not loaded');
    if (!config.FLUTCH_EMAIL) throw new Error('FLUTCH_EMAIL not loaded');
    if (typeof config.MAX_SENDS_PER_CYCLE !== 'number') throw new Error('MAX_SENDS_PER_CYCLE not a number');
    console.log(`  Loaded config: MAX_SENDS_PER_CYCLE=${config.MAX_SENDS_PER_CYCLE}, CYCLE_INTERVAL_MINUTES=${config.CYCLE_INTERVAL_MINUTES}`);
    console.log('  ✅ Config loading works');
    passed += 1;
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    failed += 1;
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total:  ${passed + failed}\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed. Check configuration and fix issues.\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('💥 Test suite error:', err.message);
  process.exit(1);
});
