"use strict";

const { Pool } = require('pg');
const { enqueueWebhook, processBatch } = require('../services/webhookQueue');
const { logger } = require('../lib/logger');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('DATABASE_URL not set. Skipping DB integration test. To run test set DATABASE_URL env var and re-run.');
    process.exit(0);
  }

  // Insert a fake webhook event and trigger processing once
  try {
    const payload = {
      id: 999999,
      title: 'Test deal',
      stage_id: null,
      status: 'open',
      update_time: new Date().toISOString(),
      event: 'updated.deal'
    };
    const inserted = await enqueueWebhook('updated.deal', payload.id, payload);
    console.log('Enqueued:', inserted);
    const processed = await processBatch(5);
    console.log('Processed items:', processed);
    process.exit(0);
  } catch (e) {
    console.error('Test failed:', e.message);
    process.exit(1);
  }
}

main();
