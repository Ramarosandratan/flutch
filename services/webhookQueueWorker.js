"use strict";

const { processBatch } = require('./webhookQueue');
const { logger } = require('../lib/logger');
const clientProm = require('prom-client');
const http = require('http');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function startMetricsServer(port = 9101) {
  try {
    // Register Prometheus default metrics (CPU, memory, etc.)
    // Wrap in try/catch to handle duplicate registration if multiple workers are started.
    try {
      clientProm.collectDefaultMetrics();
    } catch (metricErr) {
      if (!metricErr.message.includes('already been registered')) throw metricErr;
      logger.debug('Default Prometheus metrics already registered');
    }
    
    const server = http.createServer(async (req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', clientProm.register.contentType);
        res.end(await clientProm.register.metrics());
      } else {
        res.statusCode = 404; res.end('not found');
      }
    });
    
    server.listen(port, () => logger.info(`Metrics exposed on http://localhost:${port}/metrics`));
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Metrics port ${port} already in use; metrics server disabled`);
      } else {
        logger.warn('Metrics server error: ' + err.message);
      }
    });
  } catch (e) {
    logger.warn('Metrics server failed to start: ' + e.message);
  }
}

async function runLoop() {
  logger.info('Webhook worker started');
  await startMetricsServer();
  while (true) {
    try {
      const processed = await processBatch(50);
      if (processed === 0) {
        // backoff when idle
        await sleep(3000);
      }
    } catch (e) {
      logger.error('Webhook worker error: ' + e.message);
      await sleep(5000);
    }
  }
}

if (require.main === module) {
  runLoop().catch((e) => {
    logger.error('Fatal worker error: ' + e.message);
    process.exit(1);
  });
}

module.exports = { runLoop };
