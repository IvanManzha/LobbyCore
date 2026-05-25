/**
 * Extract MatchFeatureVector v2 from PUBG telemetry for one player.
 * Supports 7-gene DNA: Combat, Pressure, Conversion, Survival, Positioning, Recovery, Teamwork.
 * Telemetry: { events: [...] } or raw array; events have _T (type), _D (time), attacker, victim, killer, character, etc.
 */
const fs = require('fs').promises;
const path = require('path');
const { getPubgTelemetryPath, getFeaturesPath, getPubgMatchMetaPath } = require('../../config/dataPaths');
const telemetryFetcher = require('../pubg/telemetryFetcher');

/**
 * Load telemetry for DNA pipeline. Tries gzip (matches/<id>/telemetry.json.gz) first, then JSON (telemetry/<id>.json).
 * @param {string} matchId
 * @returns {Promise<Object|Array>}
 */
async function loadTelemetryForDna(matchId) {
  try {
    if (await telemetryFetcher.hasCachedTelemetryGzip(matchId)) {
      return telemetryFetcher.readTelemetryFromGzip(matchId);
    }
  } catch (_e) {
    /* fallback to JSON */
  }
  const telemetryPath = getPubgTelemetryPath(matchId);
  const raw = await fs.readFile(telemetryPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * MatchFeatureVector v2 — fields for 7-gene scoring.
 * @typedef {Object} MatchFeatureVector
 * @property {number} teamRank
 * @property {number} numStartTeams
 * @property {number} individualRank
 * @property {number} numStartPlayers
 * @property {number} timeAfterLandSec
 * @property {number} timeAliveShare
 * @property {number} timeToFirstEnemyContactAfterLand
 * @property {number} survivalAfterFirstEnemyContactSec
 * @property {number} matchDurationSec
 * @property {number} shotsTotal
 * @property {number} enemyHits
 * @property {number} damageDealtLive
 * @property {number} damageTakenEnemy
 * @property {number} damageDealtTeam
 * @property {number} kills
 * @property {number} knocks
 * @property {number} assists
 * @property {number} revives
 * @property {number} throwableUses
 * @property {number} boostPointsAfterContact
 * @property {number} healUsesAfterContact
 * @property {number} recoveryAfterContactRatio
 * @property {number} teamKillParticipationHuman
 * @property {number} friendlyFireIncidents
 * @property {number} firstOutgoingDamageSec
 * @property {number} firstIncomingDamageSec
 * @property {boolean} isTeamMode
 */

const DEFAULT_VECTOR = {
  teamRank: 50,
  numStartTeams: 16,
  individualRank: 50,
  numStartPlayers: 100,
  timeAfterLandSec: 0,
  timeAliveShare: 0,
  timeToFirstEnemyContactAfterLand: 0,
  survivalAfterFirstEnemyContactSec: 0,
  matchDurationSec: 1200,
  shotsTotal: 0,
  enemyHits: 0,
  damageDealtLive: 0,
  damageTakenEnemy: 0,
  damageDealtTeam: 0,
  kills: 0,
  knocks: 0,
  assists: 0,
  revives: 0,
  throwableUses: 0,
  boostPointsAfterContact: 0,
  healUsesAfterContact: 0,
  recoveryAfterContactRatio: 0,
  teamKillParticipationHuman: 0,
  friendlyFireIncidents: 0,
  firstOutgoingDamageSec: -1,
  firstIncomingDamageSec: -1,
  isTeamMode: true,
};

/** Legacy aliases for backward compatibility (dnaEngine/buildProfile may still read placement, damageDealt, etc.). */
function toLegacyFields(v) {
  return {
    ...v,
    placement: v.individualRank || 50,
    damageDealt: v.damageDealtLive,
    damageTaken: v.damageTakenEnemy,
    timeAliveSeconds: v.timeAfterLandSec,
    healsUsed: v.healUsesAfterContact + (v.healsUsedLegacy ?? 0),
    boostsUsed: Math.floor((v.boostPointsAfterContact ?? 0) / 15) + (v.boostsUsedLegacy ?? 0),
    revives: v.revives,
    win: v.individualRank === 1 ? 1 : 0,
    shotsApprox: v.shotsTotal,
    engagementsCount: v.enemyHits,
  };
}

/** Из MatchId или gameMode определить, соло ли матч. */
function parseIsTeamModeFromEvents(events) {
  for (const evt of events) {
    const type = (evt._T ?? evt.eventType ?? evt.event_type ?? '').toString().toLowerCase();
    if (type === 'logmatchstart') {
      const mode = (evt.gameMode ?? evt.GameMode ?? '').toString().toLowerCase();
      if (mode) return mode !== 'solo' && mode !== 'solo-fpp';
    }
    if (type === 'logmatchdefinition') {
      const matchId = (evt.MatchId ?? evt.matchId ?? '').toString().toLowerCase();
      if (matchId.includes('solo-fpp') || matchId.includes('.solo.')) return false;
      if (matchId.includes('duo') || matchId.includes('squad')) return true;
    }
  }
  return true;
}

function isSameCharacter(obj, playerId) {
  if (!obj) return false;
  const id = (obj.accountId ?? obj.account_id ?? obj.AccountId ?? '').toString().trim();
  const name = (obj.name ?? obj.Name ?? '').toString().toLowerCase().trim();
  const pid = String(playerId).toLowerCase().trim();
  const pidSpace = pid.replace(/_/g, ' ');
  if (id && (id === playerId || id === pid || id.toLowerCase() === pid)) return true;
  if (name && (name === pid || name === pidSpace || name.includes(pid) || pid.includes(name))) return true;
  return false;
}

function isTeammate(char, playerTeamId) {
  if (!char || playerTeamId == null) return false;
  const tid = char.teamId ?? char.team_id;
  return tid != null && String(tid) === String(playerTeamId);
}

function parseEvents(telemetry) {
  if (Array.isArray(telemetry)) return telemetry;
  if (telemetry && Array.isArray(telemetry.events)) return telemetry.events;
  if (telemetry && Array.isArray(telemetry.Telemetry)) return telemetry.Telemetry;
  return [];
}

/**
 * Keep only events related to the player (by accountId/name) + global match events.
 * This is useful for strict per-player stats from full telemetry.
 * @param {Array} events
 * @param {string} playerId
 * @returns {Array}
 */
function filterEventsForPlayer(events, playerId) {
  const GLOBAL = new Set(['logmatchstart', 'logmatchdefinition', 'logmatchend', 'loggamestateperiodic']);
  const pid = String(playerId || '').trim();
  if (!pid || !Array.isArray(events) || events.length === 0) return events || [];
  const typeNorm = (t) => (t ? String(t).toLowerCase() : '');
  return events.filter((evt) => {
    const type = typeNorm(evt._T ?? evt.eventType ?? evt.event_type);
    if (GLOBAL.has(type)) return true;
    const char = evt.character ?? evt.Character;
    const attacker = evt.attacker ?? evt.Attacker;
    const victim = evt.victim ?? evt.Victim;
    const killer = evt.killer ?? evt.Killer;
    const reviver = evt.reviver ?? evt.Reviver;
    const assistant = evt.assistant ?? evt.Assistant;
    return (
      isSameCharacter(char, pid) ||
      isSameCharacter(attacker, pid) ||
      isSameCharacter(victim, pid) ||
      isSameCharacter(killer, pid) ||
      isSameCharacter(reviver, pid) ||
      isSameCharacter(assistant, pid)
    );
  });
}

function parseTime(evt) {
  const d = evt._D ?? evt.eventTime ?? evt.event_time;
  if (d == null) return 0;
  if (typeof d === 'number' && Number.isFinite(d)) return d < 1e12 ? d : d / 1000;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t / 1000 : 0;
}

function getTeamId(char) {
  if (!char) return null;
  const t = char.teamId ?? char.team_id;
  return t != null ? String(t) : null;
}

/** Throwable item ids/names (partial match). */
function isThrowable(itemStr) {
  const s = (itemStr || '').toString().toLowerCase();
  return s.includes('grenade') || s.includes('molotov') || s.includes('stun') || s.includes('c4') || s.includes('bottle');
}

/**
 * Extract feature vector v2 for one player from telemetry.
 * @param {Object|Array} telemetry - Telemetry JSON (object with .events or array of events)
 * @param {string} playerId - Account ID or player name to identify the player
 * @returns {MatchFeatureVector}
 */
function extractFeatures(telemetry, playerId) {
  const events = parseEvents(telemetry);
  const v = { ...DEFAULT_VECTOR };

  let landTime = null;
  let deathTime = null;
  let matchEndTime = null;
  let matchStartTime = null;
  let lastTime = 0;

  let playerTeamId = null;
  const teamIdToKills = new Map(); // teamId -> number of kills by that team

  let firstContactTime = null;
  let firstOutgoingSec = -1;
  let firstIncomingSec = -1;

  let healsUsedLegacy = 0;
  let boostsUsedLegacy = 0;

  const typeNorm = (t) => (t ? String(t).toLowerCase() : '');

  for (const evt of events) {
    const type = typeNorm(evt._T ?? evt.eventType ?? evt.event_type);
    const t = parseTime(evt);
    const char = evt.character ?? evt.Character;
    const attacker = evt.attacker ?? evt.Attacker;
    const victim = evt.victim ?? evt.Victim;
    const killer = evt.killer ?? evt.Killer;

    if (type === 'logmatchdefinition' || type === 'logmatchend') {
      if (matchEndTime == null && type === 'logmatchend') matchEndTime = t;
      if (matchStartTime == null && t > 0) matchStartTime = t;
    }

    if (type === 'logplayerposition') {
      if (char && isSameCharacter(char, playerId)) {
        if (landTime == null) landTime = t;
        lastTime = t;
        if (playerTeamId == null) playerTeamId = getTeamId(char);
      }
    }

    if (type === 'logplayertakedamage') {
      const damage = evt.damage ?? evt.damageTaken ?? 0;
      const damageNum = Number(damage) || 0;
      const damageCauser = (evt.damageCauserName ?? evt.damageReason ?? '').toString().toLowerCase();
      const isZoneDamage = !attacker && (damageCauser.includes('bluezone') || damageCauser.includes('redzone') || damageCauser.includes('poison'));

      const weAttacker = isSameCharacter(attacker, playerId);
      const weVictim = isSameCharacter(victim, playerId);
      const victimIsTeammate = victim && isTeammate(victim, playerTeamId);
      const attackerIsTeammate = attacker && isTeammate(attacker, playerTeamId);

      if (weAttacker) {
        if (victimIsTeammate) {
          v.damageDealtTeam += damageNum;
          v.friendlyFireIncidents += 1;
        } else {
          v.damageDealtLive += damageNum;
          if (damageNum > 0) v.enemyHits += 1;
          if (firstOutgoingSec < 0 && landTime != null) firstOutgoingSec = t - landTime;
        }
      }
      if (weVictim && !isZoneDamage) {
        v.damageTakenEnemy += damageNum;
        if (firstIncomingSec < 0 && landTime != null) firstIncomingSec = t - landTime;
        const vgr = evt.victimGameResult ?? evt.VictimGameResult ?? victim?.gameResult;
        if (vgr && (String(vgr.reason || '').toLowerCase() === 'death' || String(vgr.reason || '').toLowerCase() === 'killed')) {
          deathTime = deathTime == null ? t : deathTime;
        }
      }

      if (firstContactTime == null && landTime != null && (weAttacker && !victimIsTeammate) || (weVictim && !attackerIsTeammate)) {
        firstContactTime = t;
      }
    }

    if (type === 'logplayerkill' || type === 'logplayerkillv2') {
      if (isSameCharacter(killer, playerId)) v.kills += 1;
      if (isSameCharacter(evt.assistant ?? evt.Assistant, playerId)) v.assists += 1;
      if (isSameCharacter(victim, playerId)) deathTime = deathTime == null ? t : deathTime;
      const ktid = killer && getTeamId(killer);
      if (ktid != null) {
        teamIdToKills.set(ktid, (teamIdToKills.get(ktid) || 0) + 1);
      }
      const vr = evt.victimGameResult ?? evt.VictimGameResult ?? victim?.gameResult;
      if (vr && isSameCharacter(victim, playerId)) {
        const rank = vr.ranking ?? vr.Ranking ?? vr.placement ?? vr.winPlace ?? vr.place;
        const won = vr.result === 'Win' || vr.win === 1 || vr.result === 'win';
        if (rank != null) v.individualRank = Number(rank) || v.individualRank;
        if (won) v.individualRank = 1;
      }
    }

    if (type === 'logplayermakegroggy') {
      if (isSameCharacter(attacker, playerId)) v.knocks += 1;
    }

    if (type === 'logplayerrevive') {
      if (isSameCharacter(evt.reviver ?? evt.Reviver ?? char, playerId)) v.revives += 1;
    }

    if (type === 'healevent' || type === 'logitemuse') {
      if (char && isSameCharacter(char, playerId)) {
        const item = (evt.item?.itemId ?? evt.item ?? '').toString().toLowerCase();
        if (item.includes('heal') || item.includes('firstaid') || item.includes('med')) {
          if (firstContactTime != null && t >= firstContactTime) {
            v.healUsesAfterContact += 1;
          } else {
            healsUsedLegacy += 1;
          }
        } else if (item.includes('boost') || item.includes('energy') || item.includes('pain')) {
          if (firstContactTime != null && t >= firstContactTime) {
            v.boostPointsAfterContact += 15;
          } else {
            boostsUsedLegacy += 1;
          }
        } else if (isThrowable(item)) {
          v.throwableUses += 1;
        }
      }
    }

    if (type === 'boostevent') {
      if (char && isSameCharacter(char, playerId)) {
        if (firstContactTime != null && t >= firstContactTime) {
          v.boostPointsAfterContact += 15;
        } else {
          boostsUsedLegacy += 1;
        }
      }
    }

    if (type === 'logweaponfirecount') {
      if (char && isSameCharacter(char, playerId)) {
        const count = Number(evt.fireCount ?? evt.fire_count ?? 0) || 0;
        v.shotsTotal += count;
      }
    }

    if (char && playerTeamId == null && isSameCharacter(char, playerId)) {
      playerTeamId = getTeamId(char);
    }
  }

  if (landTime != null) {
    const end = deathTime != null ? deathTime : (matchEndTime != null ? matchEndTime : lastTime);
    v.timeAfterLandSec = Math.max(0, end - landTime);
  }

  if (matchStartTime != null && matchEndTime != null) {
    v.matchDurationSec = Math.max(1, matchEndTime - matchStartTime);
  }
  if (v.matchDurationSec > 0) {
    v.timeAliveShare = Math.min(1, v.timeAfterLandSec / v.matchDurationSec);
  }

  if (firstContactTime != null) {
    if (firstOutgoingSec >= 0) v.firstOutgoingDamageSec = firstOutgoingSec;
    if (firstIncomingSec >= 0) v.firstIncomingDamageSec = firstIncomingSec;
    const contactFromLand = firstContactTime - landTime;
    if (contactFromLand >= 0) v.timeToFirstEnemyContactAfterLand = contactFromLand;
    const end = deathTime != null ? deathTime : (matchEndTime != null ? matchEndTime : lastTime);
    v.survivalAfterFirstEnemyContactSec = Math.max(0, end - firstContactTime);
  }

  const teamKills = playerTeamId != null ? (teamIdToKills.get(playerTeamId) || 0) : 0;
  if (teamKills > 0) {
    v.teamKillParticipationHuman = Math.min(1, (v.kills + v.assists) / teamKills);
  }

  if (v.damageTakenEnemy > 0) {
    const estimatedRecovery = v.healUsesAfterContact * 20 + v.boostPointsAfterContact * 0.5;
    v.recoveryAfterContactRatio = Math.min(1, estimatedRecovery / v.damageTakenEnemy);
  }

  v.isTeamMode = parseIsTeamModeFromEvents(events);
  v.healsUsedLegacy = healsUsedLegacy;
  v.boostsUsedLegacy = boostsUsedLegacy;

  return v;
}

/**
 * Load match.json if available and fill teamRank, numStartTeams, individualRank, numStartPlayers.
 * @param {string} matchId
 * @param {MatchFeatureVector} vector - mutable vector to enrich
 * @param {string} playerId - player identifier (name or accountId)
 */
async function enrichFromMatchMeta(matchId, vector, playerId) {
  let meta;
  try {
    const metaPath = getPubgMatchMetaPath(matchId);
    const raw = await fs.readFile(metaPath, 'utf8');
    meta = JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }

  const participants = meta.participants || [];
  const rosters = meta.rosters || [];
  const numTeams = rosters.length || 16;
  const numPlayers = participants.length || 100;

  let indRank = vector.individualRank;
  let teamRank = vector.teamRank;

  for (const p of participants) {
    const name = (p.name || '').toString().toLowerCase();
    const acc = (p.accountId || '').toString();
    const pid = String(playerId).toLowerCase();
    if (acc && (acc === pid || acc.toLowerCase() === pid)) {
      indRank = p.stats?.placement ?? indRank;
      break;
    }
    if (name && (name === pid || name.includes(pid) || pid.includes(name))) {
      indRank = p.stats?.placement ?? indRank;
      break;
    }
  }

  vector.individualRank = indRank;
  vector.numStartPlayers = numPlayers;
  vector.numStartTeams = numTeams;
  vector.teamRank = teamRank !== 50 ? teamRank : indRank;
}

/**
 * Load telemetry from storage, extract features v2, optionally enrich from match.json, save to storage.
 * @param {string} matchId
 * @param {string} playerId
 * @param {Object} [opts] - { enrichFromMatch: boolean } default true
 * @returns {Promise<MatchFeatureVector>}
 */
async function extractAndSaveFeatures(matchId, playerId, opts = {}) {
  let telemetry;
  try {
    telemetry = await loadTelemetryForDna(matchId);
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`Telemetry not found for match ${matchId}. Run ingest-match first.`);
    throw e;
  }

  const strictPlayerFilter = opts.strictPlayerFilter !== false;
  const telemetryForStats = strictPlayerFilter
    ? filterEventsForPlayer(parseEvents(telemetry), playerId)
    : telemetry;
  const vector = extractFeatures(telemetryForStats, playerId);
  if (opts.enrichFromMatch !== false) {
    await enrichFromMatchMeta(matchId, vector, playerId);
  }

  const outPath = getFeaturesPath(matchId, playerId);
  const dir = path.dirname(outPath);
  await fs.mkdir(dir, { recursive: true });
  const toSave = toLegacyFields(vector);
  await fs.writeFile(outPath, JSON.stringify(toSave, null, 0), 'utf8');
  return toSave;
}

module.exports = {
  extractFeatures,
  extractAndSaveFeatures,
  loadTelemetryForDna,
  enrichFromMatchMeta,
  DEFAULT_VECTOR,
  toLegacyFields,
  filterEventsForPlayer,
};
