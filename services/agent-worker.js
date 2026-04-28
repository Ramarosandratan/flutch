'use strict';

const { loadConfig } = require('./agentConfig');
const { AgentState } = require('./agentState');
const { logger } = require('../lib/logger');

// ============================================================================
// Agent Worker - Autonomous prospect re-engagement agent
// ============================================================================

class AgentWorker {
  constructor(config) {
    this.config = config;
    this.state = new AgentState(config.STATE_FILE_PATH);
    this.token = null;
    this.tokenExpiredAt = null;
    this.lastSuccessfulCycle = null;

    logger.info('🤖 Agent Worker initialized', {
      apiUrl: config.FLUTCH_API_URL,
      workHours: `${config.WORK_START_HOUR}h-${config.WORK_END_HOUR}h`,
      cycleInterval: `${config.CYCLE_INTERVAL_MINUTES}min`,
      maxSendsPerCycle: config.MAX_SENDS_PER_CYCLE,
      maxBienPerAcquereur: config.MAX_BIENS_PER_ACQUEREUR,
    });
  }

  /**
   * API Call wrapper with retry logic, backoff, and auth refresh.
   */
  async apiCall(method, path, body = null) {
    const url = `${this.config.FLUTCH_API_URL}${path}`;
    let attempt = 0;
    let lastError = null;

    while (attempt < this.config.API_CALL_MAX_RETRIES) {
      try {
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
        };

        if (this.token) {
          options.headers.Authorization = `Bearer ${this.token}`;
        }

        if (body) {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        // Handle 401: token expired or invalid
        if (response.status === 401) {
          logger.warn('🔄 Got 401 — token expired, re-authenticating...');
          this.token = null;
          await this.login();
          if (!this.token) {
            throw new Error('Re-authentication failed');
          }
          // Retry with new token
          attempt += 1;
          continue;
        }

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        return data;
      } catch (err) {
        lastError = err;
        attempt += 1;

        if (attempt < this.config.API_CALL_MAX_RETRIES) {
          const delay = this.config.API_CALL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          logger.warn(`⚠️ API call failed (attempt ${attempt}/${this.config.API_CALL_MAX_RETRIES}): ${err.message}; retrying in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`API call failed after ${this.config.API_CALL_MAX_RETRIES} attempts: ${lastError.message}`);
  }

  /**
   * Authenticate with the Flutch API, get JWT token.
   */
  async login() {
    try {
      logger.info('🔐 Logging in...');
      const response = await this.apiCall('POST', '/api/login', {
        email: this.config.FLUTCH_EMAIL,
        password: this.config.FLUTCH_PASSWORD,
      });

      if (!response.success || !response.token) {
        throw new Error('Login response missing token');
      }

      this.token = response.token;
      // Assume token valid for 7 days
      this.tokenExpiredAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      this.state.updateLogin();

      logger.info(`✅ Login successful — token valid until ${this.tokenExpiredAt.toISOString()}`);
      return response;
    } catch (err) {
      logger.error(`❌ Login failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Ensure authentication (login if needed).
   */
  async ensureAuth() {
    if (!this.token || (this.tokenExpiredAt && new Date() > this.tokenExpiredAt)) {
      await this.login();
    }
  }

  /**
   * Check if we're within working hours (9h-19h Paris time).
   */
  shouldRunCycle() {
    // For now, use local system time; in production would use TZ-aware time
    const now = new Date();
    const hour = now.getHours();
    const isWorkHour = hour >= this.config.WORK_START_HOUR && hour < this.config.WORK_END_HOUR;
    return isWorkHour;
  }

  /**
   * Fetch dashboard with acquéreurs and matched biens.
   */
  async fetchDashboard() {
    try {
      logger.debug('📊 Fetching dashboard...');
      const response = await this.apiCall('GET', '/api/todos/dashboard');
      return response;
    } catch (err) {
      logger.error(`❌ Failed to fetch dashboard: ${err.message}`);
      throw err;
    }
  }

  /**
   * Enqueue email/SMS for a list of biens to an acquéreur.
   */
  async enqueueContact(acquereurId, bienIds, channel = 'both') {
    try {
      logger.debug(`📬 Enqueueing contact for acquereur ${acquereurId}: ${bienIds.length} bien(s) via ${channel}`);
      const response = await this.apiCall('POST', '/api/email-queue/enqueue', {
        acquereur_id: acquereurId,
        bien_ids: bienIds,
        channel,
      });

      if (!response.success) {
        throw new Error(response.error || 'Enqueue failed');
      }

      logger.debug(`✅ Enqueued: queued=${response.queued}, skipped=${response.skipped_duplicates}`);
      return response;
    } catch (err) {
      logger.error(`❌ Enqueue failed for acquereur ${acquereurId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Select top N biens by rentabilité for an acquéreur.
   */
  selectBestBiens(biens, maxCount = 3) {
    // Filter to non_traite status
    let available = biens.filter((b) => !b.statut_todo || b.statut_todo === 'non_traite');

    // Sort by rentabilité DESC (best yield first)
    available.sort((a, b) => (b.rentabilite || 0) - (a.rentabilite || 0));

    // Take top N
    const selected = available.slice(0, maxCount);
    return selected;
  }

  /**
   * Process a single cycle: fetch dashboard, send biens to eligible acquéreurs.
   */
  async runCycle() {
    const cycleStartTime = Date.now();
    let acquereursTreated = 0;
    let biensSent = 0;
    let errors = 0;

    try {
      // Ensure we're authenticated
      await this.ensureAuth();

      // Fetch dashboard
      const dashboard = await this.fetchDashboard();
      if (!dashboard.acquereurs || !Array.isArray(dashboard.acquereurs)) {
        throw new Error('Invalid dashboard response');
      }

      logger.info(`📈 Dashboard fetched: ${dashboard.acquereurs.length} acquéreurs, ${dashboard.total_todos} todos`);

      // Filter acquéreurs with non_traite biens
      let acquereursToProcess = dashboard.acquereurs.filter((a) => a.non_traite > 0);
      logger.info(`🎯 Found ${acquereursToProcess.length} acquéreurs with non-traité biens`);

      // Respect MAX_SENDS_PER_CYCLE
      acquereursToProcess = acquereursToProcess.slice(0, this.config.MAX_SENDS_PER_CYCLE);
      logger.info(`⚡ Will contact ${acquereursToProcess.length} acquéreurs this cycle (limit: ${this.config.MAX_SENDS_PER_CYCLE})`);

      // Process each acquéreur
      for (const acq of acquereursToProcess) {
        try {
          // Select best biens
          const selectedBiens = this.selectBestBiens(acq.biens, this.config.MAX_BIENS_PER_ACQUEREUR);

          if (selectedBiens.length === 0) {
            logger.debug(`⊘ Acquereur ${acq.id} (${acq.titre}): no non-traité biens after filtering`);
            continue;
          }

          const bienIds = selectedBiens.map((b) => b.id);
          logger.info(`📮 Processing acquereur ${acq.id} (${acq.contact_name}): ${selectedBiens.length} bien(s)`);

          // Enqueue contact
          const enqueueResponse = await this.enqueueContact(acq.id, bienIds, 'both');

          if (enqueueResponse.queued > 0) {
            // Record in state
            this.state.recordContact(acq.id, bienIds);
            biensSent += enqueueResponse.queued;
            acquereursTreated += 1;
            logger.info(`✅ Acquereur ${acq.id}: ${enqueueResponse.queued} bien(s) queued, ${enqueueResponse.skipped_duplicates} skipped`);
          }

          // Rate limit: wait between acquéreurs
          if (acquereursToProcess.indexOf(acq) < acquereursToProcess.length - 1) {
            await this.sleep(this.config.RATE_LIMIT_MS);
          }
        } catch (err) {
          logger.warn(`⚠️ Failed to contact acquereur ${acq.id}: ${err.message}`);
          errors += 1;
        }
      }

      // Update cycle timestamp
      this.state.updateCycleTimestamp();
      this.state.incrementCyclesSinceContact();

      const cycleDuration = (Date.now() - cycleStartTime) / 1000;
      this.lastSuccessfulCycle = new Date();

      logger.info(`✨ Cycle completed in ${cycleDuration.toFixed(1)}s: ${acquereursTreated} contacted, ${biensSent} sent, ${errors} errors`);
    } catch (err) {
      logger.error(`❌ Cycle failed: ${err.message}`);
    }
  }

  /**
   * Main infinite loop: run cycles on schedule.
   */
  async runLoop() {
    logger.info('🚀 Agent Worker starting main loop...');
    logger.info(`   Working hours: ${this.config.WORK_START_HOUR}h — ${this.config.WORK_END_HOUR}h (Paris time)`);
    logger.info(`   Cycle interval: ${this.config.CYCLE_INTERVAL_MINUTES}min`);

    // Try initial login
    try {
      await this.ensureAuth();
    } catch (err) {
      logger.error('Failed initial login — will retry on next cycle');
    }

    while (true) {
      try {
        if (this.shouldRunCycle()) {
          logger.info('⏰ In working hours — running cycle...');
          await this.runCycle();
        } else {
          const now = new Date();
          const hour = now.getHours();
          logger.debug(`😴 Outside working hours (${hour}h) — sleeping...`);
        }

        // Sleep until next cycle
        await this.sleep(this.config.CYCLE_INTERVAL_MINUTES * 60 * 1000);
      } catch (err) {
        logger.error(`💥 Unexpected error in main loop: ${err.message}`);
        logger.error(err.stack);
        // Continue after error
        await this.sleep(this.config.CYCLE_INTERVAL_MINUTES * 60 * 1000);
      }
    }
  }

  /**
   * Utility: sleep for N milliseconds.
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Entry point
// ============================================================================

if (require.main === module) {
  const config = loadConfig();
  const worker = new AgentWorker(config);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('🛑 Received SIGTERM — shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('🛑 Received SIGINT — shutting down gracefully...');
    process.exit(0);
  });

  // Start worker
  worker.runLoop().catch((err) => {
    logger.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { AgentWorker };
