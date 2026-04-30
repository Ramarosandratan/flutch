'use strict';

require('dotenv').config();

const fetch = require('node-fetch');
const config = require('../config');
const { logger } = require('../lib/logger');
const { pdGet, pdPost, PIPEDRIVE_BASE } = require('../pipedrive/client');
const { getDealFieldsMap, findPipelineId, findStageId, ACQ_KEYS, norm } = require('../pipedrive');

const SEED_PREFIX = '[SEED-PD]';

const BIENS = [
  { ref: 1, titre: 'Paris 11 - Local premium', cp: '75011', ville: 'Paris', prix: 420000, renta: 5.8, dpe: 'A', occ: '333' },
  { ref: 2, titre: 'Paris 15 - Immeuble angle', cp: '75015', ville: 'Paris', prix: 590000, renta: 6.2, dpe: 'B', occ: '351' },
  { ref: 3, titre: 'Boulogne - Murs occupes', cp: '92100', ville: 'Boulogne', prix: 490000, renta: 5.1, dpe: 'C', occ: '332' },
  { ref: 4, titre: 'Versailles - Bureaux libres', cp: '78000', ville: 'Versailles', prix: 360000, renta: 6.4, dpe: 'D', occ: '353' },
  { ref: 5, titre: 'Evry - Immeuble mixte', cp: '91000', ville: 'Evry', prix: 310000, renta: 7, dpe: 'E', occ: '352' },
  { ref: 6, titre: 'Saint-Denis - Activite', cp: '93200', ville: 'Saint-Denis', prix: 270000, renta: 7.3, dpe: 'F', occ: '334' },
  { ref: 7, titre: 'Nanterre - Lot commerce', cp: '92000', ville: 'Nanterre', prix: 330000, renta: 6, dpe: 'G', occ: '333' },
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

const FIELD_NAME_ALIASES = {
  bienDpe: ['DPE', 'Classe DPE', 'Diagnostic de performance energetique'],
  acquereurDpe: ['DPE minimum', 'DPE min', 'Classe DPE minimum', 'Classe DPE'],
};

const BIENS_ADDRESS_FIELD = '7dae704151dd042a6dfef1c152b03670441a0332';
const BIENS_PRICE_FIELD = 'e47953f94beac00febac89a76afb3860cdb51fef';
const BIENS_RENTABILITY_FIELD = 'd90975abce5b5abb909d65bba327ec4936c2da0e';
const BIENS_OCCUPATION_FIELD = 'ff88b708d9d16f9729825144ab907171364ef744';

function requirePipedriveToken() {
  if (!config.PIPEDRIVE_API_TOKEN) {
    throw new Error('PIPEDRIVE_API_TOKEN manquant. Renseignez-le dans .env avant de lancer le seed Pipedrive.');
  }
}

function findFieldKey(fieldMap, aliases) {
  return Object.entries(fieldMap).find(([, name]) => aliases.some((alias) => norm(name) === norm(alias)))?.[0] || null;
}

async function pdDelete(path, apiToken) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${PIPEDRIVE_BASE}${path}${sep}api_token=${apiToken}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Pipedrive ${res.status}: ${path}`);
  }
  return res.json();
}

async function listAllDealsByStage(stageId, apiToken) {
  const deals = [];
  const limit = 100;
  let start = 0;
  let moreItems = true;

  while (moreItems) {
    const data = await pdGet(`/deals?stage_id=${stageId}&status=all_not_deleted&start=${start}&limit=${limit}`, apiToken);
    if (!data?.data?.length) break;
    deals.push(...data.data);
    moreItems = Boolean(data.additional_data?.pagination?.more_items_in_collection);
    start += limit;
  }

  return deals;
}

async function cleanupPreviousSeed(apiToken, stageIds) {
  const allDeals = [];
  for (const stageId of stageIds) {
    const deals = await listAllDealsByStage(stageId, apiToken);
    allDeals.push(...deals.filter((deal) => String(deal.title || '').startsWith(SEED_PREFIX)));
  }

  const uniqueDeals = [...new Map(allDeals.map((deal) => [deal.id, deal])).values()];
  for (const deal of uniqueDeals) {
    await pdDelete(`/deals/${deal.id}`, apiToken);
  }

  return uniqueDeals.length;
}

function buildBienPayload(bien, pipelineId, stageId, bienDpeKey) {
  return {
    title: `${SEED_PREFIX} ${bien.titre}`,
    pipeline_id: pipelineId,
    stage_id: stageId,
    value: bien.prix,
    currency: 'EUR',
    [BIENS_ADDRESS_FIELD]: `${bien.ref} rue de test`,
    [`${BIENS_ADDRESS_FIELD}_postal_code`]: bien.cp,
    [`${BIENS_ADDRESS_FIELD}_locality`]: bien.ville,
    [BIENS_PRICE_FIELD]: bien.prix,
    [BIENS_RENTABILITY_FIELD]: bien.renta,
    [BIENS_OCCUPATION_FIELD]: bien.occ,
    ...(bienDpeKey ? { [bienDpeKey]: bien.dpe } : {}),
  };
}

function buildAcquereurPayload(acq, pipelineId, stageId, acquereurDpeKey) {
  return {
    title: `${SEED_PREFIX} ${acq.titre}`,
    pipeline_id: pipelineId,
    stage_id: stageId,
    value: acq.budgetMax,
    currency: 'EUR',
    [ACQ_KEYS.budget_min]: acq.budgetMin,
    [ACQ_KEYS.budget_max]: acq.budgetMax,
    [ACQ_KEYS.rentabilite_min]: acq.rentaMin,
    [ACQ_KEYS.occupation]: acq.occIds.join(','),
    [ACQ_KEYS.secteurs]: acq.secteurs.join(','),
    [ACQ_KEYS.apport]: Math.round(acq.budgetMax * 0.2),
    [ACQ_KEYS.condition_pret]: 320,
    ...(acquereurDpeKey ? { [acquereurDpeKey]: acq.dpeMin } : {}),
  };
}

async function main() {
  requirePipedriveToken();

  const fieldMap = await getDealFieldsMap(config.PIPEDRIVE_API_TOKEN);
  const bienDpeKey = findFieldKey(fieldMap, FIELD_NAME_ALIASES.bienDpe);
  const acquereurDpeKey = findFieldKey(fieldMap, FIELD_NAME_ALIASES.acquereurDpe);

  if (!bienDpeKey) {
    throw new Error('Champ Pipedrive DPE introuvable pour les biens. Vérifiez le mapping des champs avant de lancer le seed.');
  }
  if (!acquereurDpeKey) {
    throw new Error('Champ Pipedrive DPE minimum introuvable pour les acquéreurs. Vérifiez le mapping des champs avant de lancer le seed.');
  }

  const biensPipelineId = await findPipelineId(config.BIENS_PIPELINE, config.PIPEDRIVE_API_TOKEN);
  const acquereursPipelineId = await findPipelineId(config.ACQUEREURS_PIPELINE, config.PIPEDRIVE_API_TOKEN);
  const biensStageId = await findStageId(config.BIENS_STAGE, config.PIPEDRIVE_API_TOKEN, biensPipelineId);
  const acquereursStageId = await findStageId(config.ACQUEREURS_STAGE, config.PIPEDRIVE_API_TOKEN, acquereursPipelineId);

  if (!biensPipelineId || !biensStageId) {
    throw new Error(`Pipeline ou étape introuvable pour les biens: ${config.BIENS_PIPELINE} / ${config.BIENS_STAGE}`);
  }
  if (!acquereursPipelineId || !acquereursStageId) {
    throw new Error(`Pipeline ou étape introuvable pour les acquéreurs: ${config.ACQUEREURS_PIPELINE} / ${config.ACQUEREURS_STAGE}`);
  }

  const deletedCount = await cleanupPreviousSeed(config.PIPEDRIVE_API_TOKEN, [biensStageId, acquereursStageId]);

  const createdBiens = [];
  for (const bien of BIENS) {
    const payload = buildBienPayload(bien, biensPipelineId, biensStageId, bienDpeKey);
    const res = await pdPost('/deals', payload, config.PIPEDRIVE_API_TOKEN);
    createdBiens.push({ id: res?.data?.id, title: payload.title });
  }

  const createdAcquereurs = [];
  for (const acq of ACQUEREURS) {
    const payload = buildAcquereurPayload(acq, acquereursPipelineId, acquereursStageId, acquereurDpeKey);
    const res = await pdPost('/deals', payload, config.PIPEDRIVE_API_TOKEN);
    createdAcquereurs.push({ id: res?.data?.id, title: payload.title });
  }

  const summary = {
    ok: true,
    prefix: SEED_PREFIX,
    deleted: deletedCount,
    created: {
      biens: createdBiens.length,
      acquereurs: createdAcquereurs.length,
    },
    stages: {
      biens: { pipelineId: biensPipelineId, stageId: biensStageId },
      acquereurs: { pipelineId: acquereursPipelineId, stageId: acquereursStageId },
    },
  };

  logger.info(`✅ Seed Pipedrive terminé: ${createdBiens.length} biens, ${createdAcquereurs.length} acquéreurs, ${deletedCount} anciens deals supprimés`);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  logger.error(`❌ Seed Pipedrive échoué: ${error.message}`);
  // eslint-disable-next-line no-console
  console.error(error.stack || error.message);
  process.exit(1);
});