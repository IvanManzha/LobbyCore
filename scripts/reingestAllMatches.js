#!/usr/bin/env node
/**
 * Пересобирает треки/события/фичи для всех матчей в хранилище (data/pubg/matches/).
 * Применяет актуальную логику (трек без самолёта/парашюта, размеры карт и т.д.).
 * Usage: node scripts/reingestAllMatches.js
 *        npm run ingest:reingest-all
 */
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { pubgMatchesDir } = require('../src/backend/config/dataPaths');
const { ingestMatchFull } = require('../src/backend/services/pubg/telemetryMetricsPipeline');

async function main() {
  let entries;
  try {
    entries = await fs.readdir(pubgMatchesDir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log('Нет папки хранилища матчей. Сначала загрузите матчи (ingest:match или dna-test:sync).');
      return;
    }
    throw e;
  }
  const dirs = entries.filter((d) => d.isDirectory()).map((d) => d.name);
  const matchIds = [];
  for (const name of dirs) {
    const metaPath = path.join(pubgMatchesDir, name, 'match.json');
    const indexPath = path.join(pubgMatchesDir, name, 'telemetry.index.json');
    try {
      await fs.access(metaPath);
      matchIds.push(name);
    } catch (_e) {
      try {
        await fs.access(indexPath);
        matchIds.push(name);
      } catch (_e2) {}
    }
  }
  if (matchIds.length === 0) {
    console.log('В хранилище нет матчей.');
    return;
  }
  console.log(`Найдено матчей: ${matchIds.length}. Пересборка треков/событий/фичей...\n`);
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < matchIds.length; i++) {
    const matchId = matchIds[i];
    process.stdout.write(`  [${i + 1}/${matchIds.length}] ${matchId} ... `);
    try {
      const result = await ingestMatchFull(matchId, 'steam');
      if (result.success) {
        ok++;
        console.log('OK');
      } else {
        fail++;
        console.log('FAIL:', result.error || '');
      }
    } catch (err) {
      fail++;
      console.log('ERR:', err.message);
    }
  }
  console.log(`\nГотово: OK=${ok}, FAIL=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
