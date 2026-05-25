/**
 * Persist DNA rating after each genes/rating calculation: update player_profiles.dna_rating
 * and append a row to player_dna_rating_history.
 * Used from DnaOnCloseService (tournament close) and MatchMonitorService (per-match pipeline).
 */
const { db } = require('../../../../lib/db');
const PlayerService = require('../PlayerService');
const dnaStorage = require('./dnaStorage');
const dnaEngine = require('./dnaEngine');
const { archetypeFromGenes } = require('./archetype');

/**
 * Persist DNA rating for one player: compute from dnaStorage, update player_profiles, insert history.
 * @param {string} playerId - Pubg nick / player identifier (as used in pipeline)
 * @param {string} seasonId - Season/year (e.g. "2026")
 * @param {Object} context - { date: Date|string, matchId?: string, tournamentId?: string, matchRef?: number }
 * @param {string} [displayName] - Optional display name for new player_profiles row
 * @returns {Promise<{ ok: boolean, rating?: number, error?: string }>}
 */
async function persistDnaRating(playerId, seasonId, context, displayName) {
  try {
    const dnaProfile = await dnaStorage.getProfile(seasonId, playerId);
    if (!dnaProfile) {
      return { ok: false, error: 'No DNA profile' };
    }

    const genesForRating =
      dnaProfile.genesV3 && dnaProfile.genesV3.value
        ? Object.keys(dnaProfile.genesV3.value).map((key) => ({
            key,
            value: dnaProfile.genesV3.value[key],
          }))
        : dnaProfile.genes || [];

    const dnaTarget = dnaEngine.computeDnaRating(genesForRating);

    const prevDisplayed =
      typeof dnaProfile.dnaDisplayed === 'number'
        ? dnaProfile.dnaDisplayed
        : typeof dnaProfile.coreScore === 'number'
        ? dnaProfile.coreScore
        : dnaTarget;

    const beta = 0.1;
    const dnaDisplayed = prevDisplayed + beta * (dnaTarget - prevDisplayed);
    const dnaRating = Math.round(dnaDisplayed);
    const dnaTier = dnaEngine.computeDnaTier(dnaRating);
    const dominantTrait = archetypeFromGenes(genesForRating);

    const playerIdForDb = PlayerService.normalizeUsername(playerId);
    const nameForDb = displayName || playerId;

    const existing = await db('player_profiles').whereRaw('LOWER(player_id) = ?', [playerIdForDb]).first('id');
    if (existing) {
      await db('player_profiles').where('id', existing.id).update({
        dna_rating: dnaRating,
        dominant_trait: dominantTrait,
      });
    } else {
      await db('player_profiles').insert({
        player_id: playerIdForDb,
        player_name: nameForDb,
        dna_rating: dnaRating,
        dominant_trait: dominantTrait,
      });
    }

    // Persist tier inside DNA profile JSON for frontend (DNA Lab, profile, etc.)
    dnaProfile.dnaTier = dnaTier;
    await dnaStorage.saveProfile(seasonId, playerId, dnaProfile);

    const occurredAt = context.date instanceof Date ? context.date : new Date(context.date || Date.now());
    await db('player_dna_rating_history').insert({
      player_id: playerIdForDb,
      season_id: String(seasonId),
      occurred_at: occurredAt,
      rating: dnaRating,
      match_ref: context.matchRef ?? null,
      tournament_id: context.tournamentId ?? null,
    });

    return { ok: true, rating: dnaRating };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

module.exports = {
  persistDnaRating,
};
