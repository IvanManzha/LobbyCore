#!/usr/bin/env node
/**
 * Debug: IVANCHK genes with additive edge-damped update on test DB (dna_test).
 *
 * - Загружает матчи игрока IVANCHK из dna_test.
 * - Строит feature vectors через featureExtractor.
 * - По каждому матчу считает match scores (10–90) + confidence.
 * - Обновляет гены аддитивно (geneUpdate.updateGenes).
 * - Печатает итоговые значения генов и промежуточные значения по матчам.
 *
 * Запуск: node scripts/debug_dna_genes_ivanchk_additive.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { dbDnaTest } = require('../lib/db');
const featureExtractor = require('../src/backend/services/dna/featureExtractor');
const dnaEngine = require('../src/backend/services/dna/dnaEngine');
const geneUpdate = require('../src/backend/services/dna/geneUpdate');

const PLAYER_ID = 'IVANCHK';

async function main() {
  const normalizedName = PLAYER_ID.trim().toLowerCase();
  const participantRows = await dbDnaTest('participants')
    .whereRaw('LOWER(player_name) = ? OR player_id = ?', [normalizedName, PLAYER_ID])
    .orderBy('id', 'asc');

  if (!participantRows.length) {
    console.log('Игрок не найден в dna_test:', PLAYER_ID);
    process.exit(1);
  }

  const matchRefs = [...new Set(participantRows.map((p) => p.match_ref))];
  const matches = await dbDnaTest('matches')
    .whereIn('id', matchRefs)
    .orderBy('played_at', 'asc');

  if (!matches.length) {
    console.log('Нет матчей для игрока:', PLAYER_ID);
    process.exit(1);
  }

  const featureVectors = [];
  const matchesMeta = [];

  for (const row of matches) {
    let telemetry = null;
    try {
      if (row.telemetry) {
        telemetry = typeof row.telemetry === 'string' ? JSON.parse(row.telemetry) : row.telemetry;
      }
    } catch (_e) {
      continue;
    }
    if (!telemetry) continue;

    const participant = participantRows.find((p) => p.match_ref === row.id);
    const identifier = participant.player_id || participant.player_name || PLAYER_ID;
    const vector = featureExtractor.extractFeatures(telemetry, identifier);

    if (vector.placement === 0 && participant.placement != null) {
      vector.placement = Number(participant.placement) || 0;
    }
    if (vector.timeAliveSeconds === 0 && participant.stats) {
      try {
        const s = typeof participant.stats === 'string' ? JSON.parse(participant.stats) : participant.stats;
        if (s && typeof s.timeSurvived === 'number') vector.timeAliveSeconds = s.timeSurvived;
      } catch (_e) {}
    }

    featureVectors.push(vector);
    matchesMeta.push({
      matchId: row.match_id,
      dateISO: row.played_at ? new Date(row.played_at).toISOString() : undefined,
    });
  }

  if (!featureVectors.length) {
    console.log('Нет векторизованных матчей с телеметрией для игрока:', PLAYER_ID);
    process.exit(1);
  }

  const GENE_KEYS = dnaEngine.GENE_KEYS;
  let genes = {};
  GENE_KEYS.forEach((k) => {
    genes[k] = 50;
  });

  console.log('=== IVANCHK: инкрементальный аддитивный апдейт генов (test DB) ===\n');

  featureVectors.forEach((vec, idx) => {
    const scores = dnaEngine.scoreMatchGenes(vec);
    const conf = dnaEngine.getGeneConfidence(vec);
    const nextGenes = geneUpdate.updateGenes(genes, scores, conf);

    const meta = matchesMeta[idx] || {};
    console.log(`Матч ${idx + 1} (${meta.matchId || '?'}, ${meta.dateISO || 'no-date'}):`);
    GENE_KEYS.forEach((k) => {
      const gPrev = genes[k];
      const s = scores[k];
      const c = conf[k];
      const gNext = nextGenes[k];
      const delta = gNext - gPrev;
      console.log(
        `  ${k}: prev=${gPrev.toFixed(2)}, score=${s.toFixed(2)}, conf=${c.toFixed(3)}, ` +
          `delta=${delta.toFixed(3)}, next=${gNext.toFixed(2)}`
      );
    });
    console.log('');

    genes = nextGenes;
  });

  console.log('=== Итоговые значения генов после всех матчей ===\n');
  GENE_KEYS.forEach((k) => {
    console.log(`${k}: ${genes[k].toFixed(3)}`);
  });

  await dbDnaTest.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

