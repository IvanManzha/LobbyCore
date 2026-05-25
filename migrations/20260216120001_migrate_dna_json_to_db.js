/**
 * One-time data migration: copy DNA from JSON files (data/dna/) into DB tables.
 * If data/dna does not exist or is empty, does nothing (tables remain empty).
 */
const path = require('path');
const fs = require('fs').promises;

const GENE_KEYS = [
  'accuracy', 'tactics', 'aggression', 'survival',
  'positioning', 'teamwork', 'resource', 'composure',
];

function getDnaDir() {
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, '..', 'data');
  return path.join(dataDir, 'dna');
}

exports.up = async function (knex) {
  const dnaDir = getDnaDir();
  let seasonNames = [];
  try {
    const entries = await fs.readdir(dnaDir, { withFileTypes: true });
    seasonNames = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }

  for (const seasonId of seasonNames) {
    const seasonDir = path.join(dnaDir, seasonId);
    const files = await fs.readdir(seasonDir).catch(() => []);

    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      if (f === 'baseline_v1.json' || f === 'pool_stats_v1.json') continue;

      const playerId = f.slice(0, -5);
      const filePath = path.join(seasonDir, f);
      let profile;
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        profile = JSON.parse(raw);
      } catch (_e) {
        continue;
      }

      const coreScore = profile.coreScore != null ? profile.coreScore : null;
      const lastUpdated = profile.lastUpdated || null;
      const lastUpdatedV3 = profile.lastUpdatedV3 || null;
      const data = JSON.stringify(profile);

      await knex('dna_profiles')
        .insert({
          season_id: String(seasonId),
          player_id: String(playerId),
          core_score: coreScore,
          data,
          last_updated: lastUpdated,
          last_updated_v3: lastUpdatedV3,
        })
        .onConflict(['season_id', 'player_id'])
        .merge({
          core_score: coreScore,
          data,
          last_updated: lastUpdated,
          last_updated_v3: lastUpdatedV3,
        });
    }

    const baselinePath = path.join(seasonDir, 'baseline_v1.json');
    try {
      const raw = await fs.readFile(baselinePath, 'utf8');
      const baseline = JSON.parse(raw);
      const updatedAt = baseline.updatedAt || new Date().toISOString();
      await knex('dna_baselines')
        .insert({
          season_id: String(seasonId),
          data: raw,
          updated_at: updatedAt,
        })
        .onConflict('season_id')
        .merge({ data: raw, updated_at: updatedAt });
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    const poolStatsPath = path.join(seasonDir, 'pool_stats_v1.json');
    try {
      const raw = await fs.readFile(poolStatsPath, 'utf8');
      const payload = JSON.parse(raw);
      const genes = payload.genes || {};
      const updatedAt = payload.updatedAt || new Date().toISOString();

      await knex('dna_pool_stats').where({ season_id: String(seasonId) }).del();

      const rows = GENE_KEYS.filter((k) => genes[k]).map((key) => ({
        season_id: String(seasonId),
        gene_key: key,
        median: Number(genes[key].median),
        mad: Number(genes[key].mad),
        updated_at: updatedAt,
      }));

      if (rows.length) {
        await knex('dna_pool_stats').insert(rows);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
};

exports.down = async function (_knex) {
  // One-way data migration; down() does not remove data from DB or restore files
};
