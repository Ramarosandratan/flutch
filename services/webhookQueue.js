"use strict";

const { pool } = require('../db');
const { logger } = require('../lib/logger');
const clientProm = require('prom-client');
const { lockDeal } = require('../lib/syncLock');
const { syncSingleBien, syncSingleAcquereur, archiveDeal } = require('../pipedrive');
const { getCachedStageIds } = require('../services/pipedriveService');

const MAX_ATTEMPTS = 5;

/**
 * Enqueue a received Pipedrive webhook into durable PostgreSQL queue.
 * dedupKey = `${event}:${dealId}:${update_time||''}` ensures idempotence across restarts.
 */
async function enqueueWebhook(eventType, dealId, payload) {
  const updateTime = (payload && (payload.update_time || payload.update_time)) || '';
  const dedupKey = `${eventType}:${dealId}:${updateTime}`;
  try {
    const res = await pool.query(
      `INSERT INTO webhook_events (event_type, deal_id, dedup_key, payload)
       VALUES ($1,$2,$3,$4) ON CONFLICT (dedup_key) DO NOTHING RETURNING id`,
      [eventType, dealId, dedupKey, payload || null]
    );
    // metrics
    try { webhookEnqueued.inc(); } catch (_) {}
    return res.rows.length > 0;
  } catch (e) {
    logger.error('enqueueWebhook error: ' + e.message);
    throw e;
  }
}

/**
 * Process a batch of pending webhook events from DB.
 * Uses FOR UPDATE SKIP LOCKED to allow multiple workers and per-deal advisory locks
 * to serialize mutations on the same deal.
 */
async function processBatch(limit = 20) {
  const start = Date.now();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM webhook_events
       WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW())
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );

    if (!rows.length) {
      await client.query('COMMIT');
      return 0;
    }

    // Mark as processing and increment attempts
    const ids = rows.map(r => r.id);
    for (const id of ids) {
      await client.query('UPDATE webhook_events SET status=$1, attempts = attempts + 1 WHERE id=$2', ['processing', id]);
    }
    await client.query('COMMIT');

    for (const row of rows) {
      try {
        const payload = row.payload || {};
        const dealId = row.deal_id;

        // Acquire a dedicated client to hold the advisory lock during processing
        const lockClient = await pool.connect();
        try {
          await lockClient.query('BEGIN');
          await lockDeal(lockClient, dealId);

          // Decide processing path (replicates original routes/webhooks logic)
          const stageId = payload.stage_id;
          const status = payload.status;
          const { bienStageId, acqStageId } = getCachedStageIds();
          const isBienStage = stageId === bienStageId;
          const isAcqStage = stageId === acqStageId;

          if (payload.event === 'deleted.deal' || status === 'deleted' || status === 'lost') {
            await archiveDeal(dealId);
          } else if (isBienStage) {
            await syncSingleBien(payload, process.env.PIPEDRIVE_API_TOKEN);
          } else if (isAcqStage) {
            await syncSingleAcquereur(payload, process.env.PIPEDRIVE_API_TOKEN);
          } else {
            // Fallback: try to sync both (best-effort)
            try { await syncSingleBien(payload, process.env.PIPEDRIVE_API_TOKEN); } catch(_) {}
            try { await syncSingleAcquereur(payload, process.env.PIPEDRIVE_API_TOKEN); } catch(_) {}
          }

          await lockClient.query('COMMIT');
          await pool.query('UPDATE webhook_events SET status=$1, processed_at=NOW() WHERE id=$2', ['done', row.id]);
        } catch (procErr) {
          await lockClient.query('ROLLBACK').catch(()=>{});
          throw procErr;
        } finally {
          lockClient.release();
        }
      } catch (e) {
        logger.error(`Webhook event ${row.id} failed: ${e.message}`);
        // Determine if we should retry or mark failed
        const attempts = row.attempts || 1;
        if (attempts >= MAX_ATTEMPTS) {
          await pool.query('UPDATE webhook_events SET status=$1, last_error=$2 WHERE id=$3', ['failed', e.message, row.id]);
          try { webhookFailed.inc(); } catch(_) {}
        } else {
          const backoffSec = Math.min(30 * Math.pow(2, attempts - 1), 3600);
          await pool.query(
            `UPDATE webhook_events SET status=$1, next_retry_at = NOW() + ($2 || ' seconds')::interval, last_error=$3 WHERE id=$4`,
            ['pending', backoffSec, e.message, row.id]
          );
          try { webhookRetry.inc(); } catch(_) {}
        }
      }
    }

    try { webhookProcessed.inc(rows.length); } catch(_) {}
    const elapsed = Date.now() - start;
    try { webhookProcessTime.observe(elapsed / 1000); } catch(_) {}
    return rows.length;
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    logger.error('processBatch error: ' + e.message);
    throw e;
  } finally {
    client.release();
  }
}

// Prometheus metrics (exported if present)
let webhookEnqueued = { inc: () => {} };
let webhookProcessed = { inc: () => {} };
let webhookFailed = { inc: () => {} };
let webhookRetry = { inc: () => {} };
let webhookProcessTime = { observe: () => {} };
try {
  webhookEnqueued = new clientProm.Counter({ name: 'webhook_enqueued_total', help: 'Webhook events enqueued' });
  webhookProcessed = new clientProm.Counter({ name: 'webhook_processed_total', help: 'Webhook events processed' });
  webhookFailed = new clientProm.Counter({ name: 'webhook_failed_total', help: 'Webhook events failed' });
  webhookRetry = new clientProm.Counter({ name: 'webhook_retry_total', help: 'Webhook events retried' });
  webhookProcessTime = new clientProm.Histogram({ name: 'webhook_process_seconds', help: 'Webhook processing time seconds' });
} catch (e) {
  // metrics optional
}

module.exports = { enqueueWebhook, processBatch };
