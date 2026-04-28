'use strict';

const express = require('express');
const crypto = require('crypto');
const config = require('../config');
const { logger } = require('../lib/logger');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireAdminAsync } = require('../middleware/auth');
const { pool } = require('../db');
const { syncSingleBien, syncSingleAcquereur, archiveDeal } = require('../pipedrive');
const { getCachedStageIds, listWebhooks } = require('../services/pipedriveService');

const router = express.Router();

// FIX Audit 3.6 — Cache d'idempotence pour rejeter les webhooks rejoués (LRU borné)
const IDEMPOTENCE_MAX = 10000;
const IDEMPOTENCE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const idempotenceCache = new Map();

function isWebhookDuplicate(event, dealId, timestamp) {
  const key = `${event}:${dealId}:${timestamp || ''}`;
  if (idempotenceCache.has(key)) return true;
  // Nettoyage si le cache dépasse la borne (FIX Audit 4.4)
  if (idempotenceCache.size >= IDEMPOTENCE_MAX) {
    const now = Date.now();
    for (const [k, ts] of idempotenceCache) {
      if (now - ts > IDEMPOTENCE_TTL_MS) idempotenceCache.delete(k);
    }
    // Si toujours plein, supprimer le plus ancien
    if (idempotenceCache.size >= IDEMPOTENCE_MAX) {
      const firstKey = idempotenceCache.keys().next().value;
      idempotenceCache.delete(firstKey);
    }
  }
  idempotenceCache.set(key, Date.now());
  return false;
}

router.post('/pipedrive', (req, res) => {
  const token = req.query.token;
  const expected = config.WEBHOOK_SECRET;
  if (!token || typeof token !== 'string' || token.length !== expected.length
      || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    logger.warn('⚠️ Webhook: token invalide rejeté');
    return res.status(403).json({ error: 'forbidden' });
  }

  // FIX Audit 3.6 — Vérification de timestamp pour rejeter les webhooks trop vieux
  const dateHeader = req.headers['date'] || req.headers['x-pipedrive-timestamp'];
  if (dateHeader) {
    const webhookTime = new Date(dateHeader).getTime();
    const now = Date.now();
    if (!isNaN(webhookTime) && Math.abs(now - webhookTime) > 5 * 60 * 1000) {
      logger.warn(`⚠️ Webhook: timestamp trop ancien/futur rejeté (${dateHeader})`);
      return res.status(403).json({ error: 'webhook expired' });
    }
  }

  const { event, current } = req.body || {};
  if (!current || !event) {
    return res.status(200).json({ ok: true });
  }

  // Persist webhook to durable queue and return immediately
  const dealId = current.id;
  try {
    const { enqueueWebhook } = require('../services/webhookQueue');
    const inserted = await enqueueWebhook(event, dealId, current);
    logger.info(`📨 Webhook queued: ${event} deal #${dealId} queued=${inserted}`);
    return res.status(202).json({ ok: true, queued: inserted });
  } catch (e) {
    logger.error('❌ Webhook enqueue error: ' + e.message);
    // Best-effort: still return 202 to avoid Pipedrive retries flooding; the error is logged for ops.
    return res.status(202).json({ ok: true, queued: false });
  }
});

router.get('/status', requireAuth, requireAdminAsync, asyncHandler(async (req, res) => {
  try {
    const hooks = await listWebhooks();
    const { bienStageId, acqStageId } = getCachedStageIds();
    res.json({ webhooks: hooks, bien_stage_id: bienStageId, acq_stage_id: acqStageId });
  } catch (e) {
    res.json({ error: e.message });
  }
}));

module.exports = router;
