#!/usr/bin/env node
/**
 * Сброс тестовых DNA, статов, DC и истории переводов для IVANCHK.
 * Usage: node scripts/cleanup_ivanchk_test_data.js
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { db, dbDnaTest } = require('../lib/db');
const {
  walletsPath,
  ledgerPath,
  topupsPath,
  cashoutsPath,
  playersDir,
  playerStatsPath,
} = require('../src/backend/config/dataPaths');
const { featuresDir } = require('../src/backend/config/dataPaths');
const FinanceService = require('../src/backend/services/FinanceService');

const PLAYER_IDS = ['ivanchk', 'IVANCHK'];
const PLAYER_KEY = 'player:IVANCHK';

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function involvesPlayer(entry) {
  const from = String(entry.from || '').toLowerCase();
  const to = String(entry.to || '').toLowerCase();
  const pid = String(entry.playerId || entry.metadata?.playerId || '').toLowerCase();
  return (
    from.includes('ivanchk') ||
    to.includes('ivanchk') ||
    pid === 'ivanchk'
  );
}

async function cleanupLadder() {
  const hist = await db('player_ladder_history').del();
  const rows = await db('player_ladder').del();
  console.log(`[app] player_ladder deleted: ${rows}, history: ${hist}`);
}

async function cleanupDb() {
  for (const knex of [db, dbDnaTest].filter(Boolean)) {
    const label = knex === dbDnaTest ? 'dnaTest' : 'app';
    const delProfiles = await knex('dna_profiles')
      .whereRaw('LOWER(player_id) = ?', ['ivanchk'])
      .del();
    console.log(`[${label}] dna_profiles deleted:`, delProfiles);

    if (knex === db) {
      const hist = await knex('player_dna_rating_history')
        .whereRaw('LOWER(player_id) = ?', ['ivanchk'])
        .del();
      console.log('[app] player_dna_rating_history deleted:', hist);

      const cache = await knex('player_stats_cache')
        .whereRaw('LOWER(player_id) = ?', ['ivanchk'])
        .del();
      console.log('[app] player_stats_cache deleted:', cache);

      await knex('player_profiles')
        .whereRaw('LOWER(player_id) = ?', ['ivanchk'])
        .update({ dna_rating: null, dominant_trait: null });
      console.log('[app] player_profiles dna_rating/dominant_trait cleared');
    }
  }
}

function cleanupFinance() {
  const ledger = readJson(ledgerPath, []);
  const before = ledger.length;
  const filtered = ledger.filter((e) => !involvesPlayer(e));
  writeJson(ledgerPath, filtered);
  console.log(`ledger: removed ${before - filtered.length} entries (${filtered.length} left)`);

  const topups = readJson(topupsPath, []);
  const topupsFiltered = topups.filter((t) => String(t.playerId || '').toLowerCase() !== 'ivanchk');
  writeJson(topupsPath, topupsFiltered);
  console.log(`topups: removed ${topups.length - topupsFiltered.length}`);

  const cashouts = readJson(cashoutsPath, []);
  const cashoutsFiltered = cashouts.filter((c) => String(c.playerId || '').toLowerCase() !== 'ivanchk');
  writeJson(cashoutsPath, cashoutsFiltered);
  console.log(`cashouts: removed ${cashouts.length - cashoutsFiltered.length}`);

  const wallets = readJson(walletsPath, {});
  delete wallets.ivanchk;
  delete wallets.IVANCHK;
  writeJson(walletsPath, wallets);
  const recomputed = FinanceService.recomputeWallet('IVANCHK');
  console.log('wallet after recompute:', recomputed);
}

function cleanupProfileJson() {
  const candidates = [
    path.join(playersDir, 'IVANCHK.json'),
    path.join(playersDir, 'ivanchk.json'),
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const profile = readJson(filePath, {});
    profile.history = (profile.history || []).filter(
      (h) => h.tournamentId !== 'testlast1_759924' && h.tournamentId !== 'testlast2_816160'
    );
    delete profile.dna_rating;
    delete profile.dominant_trait;
    delete profile.effectiveRating;
    delete profile.rating;
    delete profile.ratingHistory;
    delete profile.calibrating;
    delete profile.longAnchor;
    if (profile.yearSnapshots && typeof profile.yearSnapshots === 'object') {
      for (const year of Object.keys(profile.yearSnapshots)) {
        const snap = profile.yearSnapshots[year];
        if (snap && typeof snap === 'object') {
          delete snap.stats;
          delete snap.effectiveRating;
          delete snap.rating;
          delete snap.ratingHistory;
          delete snap.calibrating;
          delete snap.longAnchor;
        }
      }
    }
    writeJson(filePath, profile);
    console.log('profile cleaned:', filePath);
  }
}

function cleanupPlayerStatsJson() {
  if (!fs.existsSync(playerStatsPath)) return;
  const data = readJson(playerStatsPath, {});
  let changed = false;
  for (const key of Object.keys(data)) {
    if (key.toLowerCase() === 'ivanchk') {
      delete data[key];
      changed = true;
    }
  }
  if (changed) {
    writeJson(playerStatsPath, data);
    console.log('player_stats.json: removed ivanchk entry');
  }
}

function cleanupFeatureFiles() {
  if (!fs.existsSync(featuresDir)) return;
  let removed = 0;
  for (const matchDir of fs.readdirSync(featuresDir)) {
    const featureFile = path.join(featuresDir, matchDir, 'IVANCHK.json');
    if (fs.existsSync(featureFile)) {
      fs.unlinkSync(featureFile);
      removed += 1;
    }
  }
  console.log('feature files IVANCHK.json removed:', removed);
}

async function main() {
  console.log('\n=== Cleanup IVANCHK test data + Ladder ===\n');
  await cleanupLadder();
  await cleanupDb();
  cleanupFinance();
  cleanupProfileJson();
  cleanupPlayerStatsJson();
  cleanupFeatureFiles();
  console.log('\n✅ Done. Перезапустите пересчёт статов/DNA при появлении реальных матчей в app DB.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
