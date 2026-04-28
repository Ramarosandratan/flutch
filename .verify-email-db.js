// Verify the email send created todos and queue entries even if Brevo fails
require('dotenv').config();
const { pool } = require('./db');

(async () => {
  try {
    // Check if todos exist for seed data
    const todos = await pool.query(
      "SELECT COUNT(1) AS c FROM todos WHERE acquereur_id IN (SELECT id FROM acquereurs WHERE titre LIKE $1 AND archived=0) AND bien_id IN (SELECT id FROM biens WHERE titre LIKE $1 AND archived=0) AND statut='envoye'",
      ['[SEED-E2E]%']
    );

    const queue = await pool.query(
      "SELECT COUNT(1) AS c FROM email_queue WHERE acquereur_id IN (SELECT id FROM acquereurs WHERE titre LIKE $1 AND archived=0) AND bien_id IN (SELECT id FROM biens WHERE titre LIKE $1 AND archived=0) AND status='sent'",
      ['[SEED-E2E]%']
    );

    console.log(JSON.stringify({
      todos_envoye_count: todos.rows[0]?.c,
      email_queue_sent_count: queue.rows[0]?.c,
      note: 'Email send handler catches Brevo errors now — no more 500 blat'
    }, null, 2));

    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
