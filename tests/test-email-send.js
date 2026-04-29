require('dotenv').config();
const fetch = require('node-fetch');
const { pool } = require('../db');

(async () => {
  try {
    // Login
    const login = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'seed.agent@flutch.local', password: 'SeedPass1234' }),
    });
    const lj = await login.json();
    console.log('✓ Logged in, token:', lj.token?.substring(0, 16) + '...');

    // Get seed data
    const acq = await pool.query(
      "SELECT id FROM acquereurs WHERE titre LIKE '[SEED-E2E]%' AND archived=0 ORDER BY id LIMIT 1"
    );
    const biens = await pool.query(
      "SELECT id FROM biens WHERE titre LIKE '[SEED-E2E]%' AND archived=0 ORDER BY id LIMIT 2"
    );
    
    console.log('✓ Got acquereur', acq.rows[0]?.id, 'and biens', biens.rows.map(b => b.id));

    // Send email
    const body = {
      acquereur_id: acq.rows[0].id,
      bien_ids: biens.rows.map(r => r.id),
      subject: 'Test Email Custom',
      intro: 'Ceci est un test d\'envoi d\'email.',
      outro: 'Cordialement, Le Boutiquier',
    };

    console.log('Sending email to acquereur', body.acquereur_id, 'with biens', body.bien_ids);
    const r = await fetch('http://localhost:3000/api/email-send-custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + lj.token },
      body: JSON.stringify(body),
    });

    console.log('Status:', r.status);
    const d = await r.json();
    console.log('Response:', JSON.stringify(d, null, 2));

    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();