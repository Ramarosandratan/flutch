'use strict';

const { loadConfig } = require('../services/agentConfig');
const { AgentWorker } = require('../services/agent-worker');
const { logger } = require('../lib/logger');

(async function runOnce() {
  try {
    const config = loadConfig();
    const worker = new AgentWorker(config);

    logger.info('🔁 Running a single agent cycle (integration test)');
    await worker.runCycle();
    logger.info('✅ Single cycle finished');
    process.exitCode = 0;
  } catch (err) {
    logger.error(`❌ Single cycle failed: ${err.message}`);
    process.exitCode = 1;
  }
})();
