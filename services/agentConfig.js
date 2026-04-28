'use strict';

require('dotenv').config();

/**
 * Load and validate environment configuration for the Agent Worker.
 * Ensures all required env vars are present at startup.
 */

function loadConfig() {
  const config = {
    // Flutch API connection
    FLUTCH_API_URL: process.env.FLUTCH_API_URL || 'http://localhost:3000',
    FLUTCH_EMAIL: process.env.FLUTCH_EMAIL || 'agent-test@example.com',
    FLUTCH_PASSWORD: process.env.FLUTCH_PASSWORD,

    // Worker behavior
    MAX_SENDS_PER_CYCLE: parseInt(process.env.MAX_SENDS_PER_CYCLE || '20', 10),
    CYCLE_INTERVAL_MINUTES: parseInt(process.env.CYCLE_INTERVAL_MINUTES || '30', 10),
    MAX_BIENS_PER_ACQUEREUR: parseInt(process.env.MAX_BIENS_PER_ACQUEREUR || '3', 10),
    RATE_LIMIT_MS: parseInt(process.env.RATE_LIMIT_MS || '2500', 10), // ms between acquéreur sends
    API_CALL_MAX_RETRIES: parseInt(process.env.API_CALL_MAX_RETRIES || '3', 10),
    API_CALL_RETRY_DELAY_MS: parseInt(process.env.API_CALL_RETRY_DELAY_MS || '1000', 10),

    // Timezone
    TIMEZONE: process.env.TIMEZONE || 'Europe/Paris',

    // Operating hours (24h format)
    WORK_START_HOUR: parseInt(process.env.WORK_START_HOUR || '9', 10),
    WORK_END_HOUR: parseInt(process.env.WORK_END_HOUR || '19', 10),

    // State file path
    STATE_FILE_PATH: process.env.STATE_FILE_PATH || 'data/agent-state.json',

    // Debug mode
    DEBUG: process.env.DEBUG === 'true' || process.env.DEBUG === '1',
  };

  // Validate required fields
  const errors = [];
  if (!config.FLUTCH_PASSWORD) {
    errors.push('FLUTCH_PASSWORD is required (env var or .env file)');
  }
  if (!config.FLUTCH_API_URL) {
    errors.push('FLUTCH_API_URL is required');
  }

  if (errors.length > 0) {
    console.error('❌ Configuration errors:');
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }

  // Validate ranges
  if (config.WORK_START_HOUR < 0 || config.WORK_START_HOUR > 23) {
    console.error('❌ WORK_START_HOUR must be 0-23');
    process.exit(1);
  }
  if (config.WORK_END_HOUR < 0 || config.WORK_END_HOUR > 23) {
    console.error('❌ WORK_END_HOUR must be 0-23');
    process.exit(1);
  }

  return config;
}

module.exports = { loadConfig };
