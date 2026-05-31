const PlayerService = require('./PlayerService');
const ChampionshipsService = require('./ChampionshipsService');
const TournamentService = require('./TournamentService');
const dnaEngine = require('./dna/dnaEngine');
const {
  evaluateAllAchievements,
  getUnlockedCosmeticsFromStates,
  normalizeLoadout,
  DEFAULT_PLAQUE_LOADOUT,
  collectAchievementHistory,
} = require('../../shared/achievement');
const { buildAchievementContext } = require('../../shared/achievement/evaluateAchievements');

const DONE_STATES = new Set(['Турнир окончен', 'DONE']);

function isTournamentDone(state) {
  return state && DONE_STATES.has(state);
}

class AchievementService {
  static normalizeHistory(history) {
    return (history || []).map((entry) => ({
      ...entry,
      placement: entry.placement ?? entry.place ?? null,
    }));
  }

  static playerKeys(profile) {
    const keys = new Set();
    const add = (v) => {
      const k = PlayerService.normalizeUsername(v);
      if (k) keys.add(k);
    };
    add(profile?.username);
    add(profile?.name);
    add(profile?.pubgNick);
    return keys;
  }

  static teamHasPlayer(team, tournamentType, playerKeys) {
    if (!team) return false;
    const type = String(tournamentType || '').toLowerCase();
    const names =
      type === 'solo'
        ? [team.name]
        : Array.isArray(team.players) && team.players.length
          ? team.players
          : [team.name];
    return names.some((name) => playerKeys.has(PlayerService.normalizeUsername(name)));
  }

  /**
   * Полная история для ачивок: profile.history + yearSnapshots + завершённые турниры,
   * где игрок участвовал (без фильтра countInRating).
   */
  static async resolveAchievementHistory(profile) {
    const fromProfile = collectAchievementHistory(profile);
    const seen = new Set(
      fromProfile
        .map((entry) => (entry.tournamentId != null ? String(entry.tournamentId) : null))
        .filter(Boolean),
    );

    const playerKeys = this.playerKeys(profile);
    if (playerKeys.size === 0) {
      return this.normalizeHistory(fromProfile);
    }

    const tournaments = await TournamentService.getAllTournaments();
    const extra = [];

    for (const meta of tournaments || []) {
      if (!isTournamentDone(meta.state)) continue;
      const tournamentId = meta.id || meta._id;
      if (!tournamentId || seen.has(String(tournamentId))) continue;

      let table;
      try {
        table = await TournamentService.getTournamentTable(tournamentId);
      } catch {
        continue;
      }

      const team = (table?.teams || []).find((row) =>
        this.teamHasPlayer(row, meta.type, playerKeys),
      );
      if (!team) continue;

      seen.add(String(tournamentId));
      extra.push({
        tournamentId,
        tournamentName: meta.name || tournamentId,
        date: meta.date || '',
        place: team.rank ?? team.place ?? null,
        points: team.totalPoints ?? null,
      });
    }

    return this.normalizeHistory([...fromProfile, ...extra]);
  }

  static async resolveProfile(identifier) {
    const normalized = PlayerService.normalizeUsername(identifier);
    let profile = await PlayerService.getPlayerProfile(normalized);
    if (!profile) {
      const byPubg = await PlayerService.findPlayerByPubgNick(identifier);
      profile = byPubg?.profile || null;
    }
    return profile;
  }

  static async buildContextForProfile(profile) {
    if (!profile) return null;

    await PlayerService.enrichWithLadder(profile);
    await PlayerService.enrichWithDnaArchetypeFromLab(profile);

    const playerId = profile.username || profile.pubgNick;
    const championships = await ChampionshipsService.getChampionships(playerId);
    const history = await this.resolveAchievementHistory(profile);

    let dnaTier = Number(profile.dnaTier) || 0;
    if (!dnaTier && profile.dna_rating != null) {
      dnaTier = dnaEngine.computeDnaTier(profile.dna_rating);
    }

    return buildAchievementContext(profile, championships, history);
  }

  static serializeStates(states) {
    return states.map((state) => ({
      id: state.achievement.id,
      unlocked: state.unlocked,
      current: state.current,
      target: state.target,
      progressRatio: state.progressRatio,
    }));
  }

  static async getCosmeticsPayload(identifier) {
    const profile = await this.resolveProfile(identifier);
    if (!profile) return null;

    const ctx = await this.buildContextForProfile(profile);
    const states = evaluateAllAchievements(ctx);
    const unlockedCosmetics = getUnlockedCosmeticsFromStates(states);
    const rawLoadout = profile.plaqueLoadout || DEFAULT_PLAQUE_LOADOUT;
    const loadout = normalizeLoadout(rawLoadout, unlockedCosmetics);

    return {
      playerId: profile.username || profile.pubgNick,
      loadout,
      achievements: this.serializeStates(states),
      unlockedCosmetics: {
        badgeIds: [...unlockedCosmetics.badgeIds],
        backgroundIds: [...unlockedCosmetics.backgroundIds],
      },
    };
  }

  static async updateLoadout(username, body) {
    const profile = await PlayerService.getPlayerProfile(username);
    if (!profile) {
      throw new Error('Player not found');
    }

    const ctx = await this.buildContextForProfile(profile);
    const states = evaluateAllAchievements(ctx);
    const unlockedCosmetics = getUnlockedCosmeticsFromStates(states);
    const loadout = normalizeLoadout(body, unlockedCosmetics);

    await PlayerService.updatePlayerProfile(username, { plaqueLoadout: loadout });

    return {
      playerId: username,
      loadout,
      achievements: this.serializeStates(states),
      unlockedCosmetics: {
        badgeIds: [...unlockedCosmetics.badgeIds],
        backgroundIds: [...unlockedCosmetics.backgroundIds],
      },
    };
  }
}

module.exports = AchievementService;
