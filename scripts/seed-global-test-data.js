'use strict';

require('dotenv').config();

const { pool, initSchema, hashPassword, matchAcquereurToBiens } = require('../db');

const SEED_PREFIX = '[SEED-E2E]';
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL || 'seed.agent@flutch.local';
const OWNER_NAME = process.env.SEED_OWNER_NAME || 'Seed Agent';

const BIENS = [
  { ref: 1, titre: 'Paris 11 - Local premium', cp: '75011', ville: 'Paris', prix: 420000, renta: 5.8, dpe: 'A', occ: '333' },
  { ref: 2, titre: 'Paris 15 - Immeuble angle', cp: '75015', ville: 'Paris', prix: 590000, renta: 6.2, dpe: 'B', occ: '351' },
  { ref: 3, titre: 'Boulogne - Murs occupes', cp: '92100', ville: 'Boulogne', prix: 490000, renta: 5.1, dpe: 'C', occ: '332' },
  { ref: 4, titre: 'Versailles - Bureaux libres', cp: '78000', ville: 'Versailles', prix: 360000, renta: 6.4, dpe: 'D', occ: '353' },
  { ref: 5, titre: 'Evry - Immeuble mixte', cp: '91000', ville: 'Evry', prix: 310000, renta: 7.0, dpe: 'E', occ: '352' },
  { ref: 6, titre: 'Saint-Denis - Activite', cp: '93200', ville: 'Saint-Denis', prix: 270000, renta: 7.3, dpe: 'F', occ: '334' },
  { ref: 7, titre: 'Nanterre - Lot commerce', cp: '92000', ville: 'Nanterre', prix: 330000, renta: 6.0, dpe: 'G', occ: '333' },
  { ref: 8, titre: 'Paris 9 - Boutique rue passante', cp: '75009', ville: 'Paris', prix: 455000, renta: 5.6, dpe: 'B', occ: '333' },
];

const ACQUEREURS = [
  {
    ref: 1,
    titre: 'Acquereur defensif - DPE B',
    budgetMin: 300000,
    budgetMax: 650000,
    rentaMin: 5,
    dpeMin: 'B',
    secteurs: ['75', '92'],
    occIds: ['333', '351', '353'],
  },
  {
    ref: 2,
    titre: 'Acquereur opportuniste - DPE D',
    budgetMin: 250000,
    budgetMax: 550000,
    rentaMin: 6,
    dpeMin: 'D',
    secteurs: ['00'],
    occIds: ['332', '352', '334'],
  },
  {
    ref: 3,
    titre: 'Acquereur rendement - DPE G',
    budgetMin: 200000,
    budgetMax: 500000,
    rentaMin: 7,
    dpeMin: 'G',
    secteurs: ['93', '91'],
    occIds: ['334', '333'],
  },
  {
    ref: 4,
    titre: 'Acquereur premium - DPE A',
    budgetMin: 400000,
    budgetMax: 800000,
    rentaMin: 5,
    dpeMin: 'A',
    secteurs: ['99'],
    occIds: ['333', '351'],
  },
];

function makeSeedDealId(typeOffset, ref) {
  return 900000 + typeOffset * 1000 + ref;
}

async function ensureSeedUser(client) {
  const existing = await client.query('SELECT id, email, name FROM users WHERE email = $1', [OWNER_EMAIL]);
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await client.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name`,
    [OWNER_NAME, OWNER_EMAIL, hashPassword('SeedPass1234'), 'agent']
  );
  return inserted.rows[0];
}

async function cleanupPreviousSeed(client) {
  const { rows: seedAcqRows } = await client.query(
    'SELECT id FROM acquereurs WHERE titre LIKE $1',
    [`${SEED_PREFIX}%`]
  );
  if (seedAcqRows.length > 0) {
    const ids = seedAcqRows.map(r => r.id);
    await client.query('DELETE FROM acquereurs WHERE id = ANY($1::int[])', [ids]);
  }

  const { rows: seedBienRows } = await client.query(
    'SELECT id FROM biens WHERE titre LIKE $1',
    [`${SEED_PREFIX}%`]
  );
  if (seedBienRows.length > 0) {
    const ids = seedBienRows.map(r => r.id);
    await client.query('DELETE FROM biens WHERE id = ANY($1::int[])', [ids]);
  }
}

async function insertBiens(client, owner) {
  const created = [];
  for (const b of BIENS) {
    const pipedriveDealId = makeSeedDealId(1, b.ref);
    const { rows } = await client.query(
      `INSERT INTO biens (
         pipedrive_deal_id, titre, adresse, code_postal, ville,
         prix_fai, rentabilite, rentabilite_post_rev,
         occupation_status, dpe, occupation_id,
         owner_id, owner_email, owner_name,
         archived, pipeline_stage, synced_at, pipedrive_updated_at, pipedrive_created_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14,
         0, $15, NOW(), NOW(), NOW()
       )
       RETURNING id, titre, dpe, code_postal, prix_fai, rentabilite_post_rev`,
      [
        pipedriveDealId,
        `${SEED_PREFIX} ${b.titre}`,
        `${b.ref} rue de test`,
        b.cp,
        b.ville,
        b.prix,
        b.renta,
        b.renta,
        'Libre',
        b.dpe,
        b.occ,
        owner.id,
        owner.email,
        owner.name,
        'Commercialise',
      ]
    );
    created.push(rows[0]);
  }
  return created;
}

async function insertAcquereurs(client, owner) {
  const created = [];

  for (const a of ACQUEREURS) {
    const pipedriveDealId = makeSeedDealId(2, a.ref);
    const acqInsert = await client.query(
      `INSERT INTO acquereurs (
         pipedrive_deal_id, titre, owner_id, owner_name, owner_email,
         contact_name, contact_email, contact_phone, contact_org,
         archived, synced_at, pipedrive_updated_at, pipedrive_created_at, pipedrive_stage_id
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         0, NOW(), NOW(), NOW(), 13
       )
       RETURNING id, titre`,
      [
        pipedriveDealId,
        `${SEED_PREFIX} ${a.titre}`,
        owner.id,
        owner.name,
        owner.email,
        `Contact ${a.ref}`,
        `contact${a.ref}@seed.local`,
        `+3360000000${a.ref}`,
        `Org ${a.ref}`,
      ]
    );

    const acqId = acqInsert.rows[0].id;

    await client.query(
      `INSERT INTO acquereur_criteria (
         acquereur_id, budget_min, budget_max, rentabilite_min, dpe_min,
         occupation_status, occupation_ids, secteurs, apport, condition_pret, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10, NOW()
       )`,
      [
        acqId,
        a.budgetMin,
        a.budgetMax,
        a.rentaMin,
        a.dpeMin,
        JSON.stringify(['Libre']),
        JSON.stringify(a.occIds),
        JSON.stringify(a.secteurs),
        Math.round(a.budgetMax * 0.2),
        'Oui',
      ]
    );

    created.push({ id: acqId, titre: acqInsert.rows[0].titre, dpeMin: a.dpeMin });
  }

  return created;
}

async function insertTodos(client, acquereurs, biens, ownerId) {
  const created = [];
  const statusCycle = ['non_traite', 'envoye', 'refuse'];

  for (let i = 0; i < acquereurs.length; i++) {
    const acq = acquereurs[i];
    for (let j = 0; j < 3; j++) {
      const bien = biens[(i + j) % biens.length];
      const statut = statusCycle[(i + j) % statusCycle.length];
      const { rows } = await client.query(
        `INSERT INTO todos (acquereur_id, bien_id, statut, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, acquereur_id, bien_id, statut`,
        [acq.id, bien.id, statut, ownerId, ownerId]
      );
      created.push(rows[0]);
    }
  }

  return created;
}

async function runMatchingPreview(acquereurs) {
  const previews = [];
  for (const acq of acquereurs) {
    const matched = await matchAcquereurToBiens(acq.id, false);
    previews.push({
      acquereur: acq.titre,
      dpeMin: acq.dpeMin,
      matchedCount: matched.length,
      firstBiens: matched.slice(0, 5).map(b => `${b.titre} (DPE ${b.dpe || 'N/A'})`),
    });
  }
  return previews;
}

async function main() {
  await initSchema();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const owner = await ensureSeedUser(client);
    await cleanupPreviousSeed(client);

    const biens = await insertBiens(client, owner);
    const acquereurs = await insertAcquereurs(client, owner);
    const todos = await insertTodos(client, acquereurs, biens, owner.id);

    await client.query('COMMIT');

    const matchingPreview = await runMatchingPreview(acquereurs);

    const summary = {
      ok: true,
      owner,
      created: {
        biens: biens.length,
        acquereurs: acquereurs.length,
        todos: todos.length,
      },
      sample: {
        biens: biens.slice(0, 3),
        acquereurs: acquereurs.slice(0, 3),
      },
      matchingPreview,
      next: [
        'Demarrer le serveur: npm start',
        'Verifier le dashboard todos: GET /api/todos/dashboard',
        'Tester un acquereur detail: GET /api/acquereurs/:id/detail',
      ],
    };

    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error(err.stack || err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
