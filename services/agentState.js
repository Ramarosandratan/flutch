'use strict';

const fs = require('fs');
const path = require('path');
const { logger } = require('../lib/logger');

/**
 * Manages agent state persistence (JSON file).
 * Handles reading/writing contact history to prevent duplicate sends on crash.
 * 
 * State structure:
 * {
 *   version: 1,
 *   lastLogin: "2026-04-28T12:00:00Z",
 *   lastCycleAt: "2026-04-28T12:30:00Z",
 *   contacts: {
 *     [acquereurId]: {
 *       firstName: true/false (if first contact),
 *       lastContactAt: "ISO8601",
 *       sentBienIds: [1, 2, 3],
 *       cyclesSinceContact: 0,
 *       totalSents: 5
 *     }
 *   }
 * }
 */

class AgentState {
  constructor(stateFilePath) {
    this.stateFilePath = stateFilePath;
    this.state = { version: 1, lastLogin: null, lastCycleAt: null, contacts: {} };
    this.loadState();
  }

  /**
   * Load state from JSON file, or initialize empty state if file doesn't exist.
   */
  loadState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const data = fs.readFileSync(this.stateFilePath, 'utf-8');
        this.state = JSON.parse(data);
        logger.debug(`✓ Loaded agent state from ${this.stateFilePath}`);
      } else {
        logger.info(`📝 No state file found; starting fresh at ${this.stateFilePath}`);
        this.state = { version: 1, lastLogin: null, lastCycleAt: null, contacts: {} };
      }
    } catch (err) {
      logger.warn(`⚠️ Failed to load state: ${err.message}; starting fresh`);
      this.state = { version: 1, lastLogin: null, lastCycleAt: null, contacts: {} };
    }
  }

  /**
   * Atomically save state to JSON file (write to temp, then rename).
   */
  saveState() {
    try {
      const dir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const tempPath = `${this.stateFilePath}.tmp`;
      const data = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(tempPath, data, 'utf-8');
      fs.renameSync(tempPath, this.stateFilePath);
      logger.debug(`✓ Saved agent state to ${this.stateFilePath}`);
    } catch (err) {
      logger.error(`❌ Failed to save state: ${err.message}`);
    }
  }

  /**
   * Record a successful contact with an acquéreur.
   */
  recordContact(acquereurId, bienIds) {
    const acqIdStr = String(acquereurId);
    if (!this.state.contacts[acqIdStr]) {
      this.state.contacts[acqIdStr] = {
        firstName: true,
        lastContactAt: new Date().toISOString(),
        sentBienIds: [],
        cyclesSinceContact: 0,
        totalSents: 0,
      };
    }

    const contact = this.state.contacts[acqIdStr];
    contact.firstName = false;
    contact.lastContactAt = new Date().toISOString();
    contact.totalSents += 1;
    contact.cyclesSinceContact = 0;
    // Append bien IDs to sent list (avoid duplicates)
    for (const bid of bienIds) {
      if (!contact.sentBienIds.includes(bid)) {
        contact.sentBienIds.push(bid);
      }
    }
    this.saveState();
  }

  /**
   * Get contact history for an acquéreur.
   */
  getContact(acquereurId) {
    return this.state.contacts[String(acquereurId)] || null;
  }

  /**
   * Check if bien has already been sent to acquéreur.
   */
  hasBienBeenSent(acquereurId, bienId) {
    const contact = this.getContact(acquereurId);
    if (!contact) return false;
    return contact.sentBienIds.includes(bienId);
  }

  /**
   * Update login timestamp.
   */
  updateLogin() {
    this.state.lastLogin = new Date().toISOString();
    this.saveState();
  }

  /**
   * Update last cycle timestamp.
   */
  updateCycleTimestamp() {
    this.state.lastCycleAt = new Date().toISOString();
    this.saveState();
  }

  /**
   * Increment cycles since last contact (for relance logic v2).
   */
  incrementCyclesSinceContact() {
    for (const acqIdStr in this.state.contacts) {
      const contact = this.state.contacts[acqIdStr];
      if (contact.cyclesSinceContact !== undefined) {
        contact.cyclesSinceContact += 1;
      }
    }
    this.saveState();
  }

  /**
   * Get summary stats for logging.
   */
  getStats() {
    let totalContacts = 0;
    let totalSents = 0;
    for (const contact of Object.values(this.state.contacts)) {
      totalContacts += 1;
      totalSents += contact.totalSents || 0;
    }
    return { totalContacts, totalSents, lastLogin: this.state.lastLogin, lastCycleAt: this.state.lastCycleAt };
  }
}

module.exports = { AgentState };
