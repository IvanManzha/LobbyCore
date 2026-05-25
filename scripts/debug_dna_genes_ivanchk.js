#!/usr/bin/env node
/**
 * Выводит для игрока IVANCHK (тестовая БД) сырые значения генов до нормировки:
 * по каждому матчу: raw (getRawGeneMetrics), target (rawToTarget), valueAfter (после инкрементального шага).
 * Итоговые значения генов (после окна 20 матчей).
 *
 * Запуск: node scripts/debug_dna_genes_ivanchk.js
 * Требует: pubg_dna_test.db (knexfile.dna_test).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { dbDnaTest } = require('../lib/db');
const featureExtractor = require('../src/backend/services/dna/featureExtractor');
const dnaEngine = require('../src/backend/services/dna/dnaEngine');

const PLAYER_ID = 'IVANCHK';

async function main() {
  const normalizedName = PLAYER_ID.trim().toLowerCase();
  const participantRows = await dbDnaTest('participants')
    .whereRaw('LOWER(player_name) = ? OR player_id = ?', [normalizedName, PLAYER_ID])
    .orderBy('id', 'asc');

  if (!participantRows.length) {
    console.log('Игрок не найден в bd_dna_test:', PLAYER_ID);
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
    if (vector.placement === 0 && participant.placement != null) vector.placement = Number(participant.placement) || 0;
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

  const { genes, matchGeneValues, rawPerMatch } = dnaEngine.computeGenesDebug(featureVectors);

  console.log('=== IVANCHK: итоговые значения генов (после окна 20 матчей) ===\n');
  genes.forEach((g) => {
    console.log(`${g.key}: value=${g.value}, trend=${g.trend}`);
  });

  console.log('\n=== Сырые значения по матчам (raw → target → valueAfter) ===\n');
  rawPerMatch.forEach((row, i) => {
    const meta = matchesMeta[i] || {};
    console.log(`Матч ${i + 1} (${meta.matchId || '?'}):`);
    dnaEngine.GENE_KEYS.forEach((key) => {
      const r = row.raw[key];
      const t = row.target[key];
      const v = row.valueAfter[key];
      console.log(`  ${key}: raw=${typeof r === 'number' ? r.toFixed(2) : r} → target=${typeof t === 'number' ? t.toFixed(2) : t} → valueAfter=${v}`);
    });
    console.log('');
  });

  console.log('Всего матчей:', featureVectors.length);
  await dbDnaTest.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
