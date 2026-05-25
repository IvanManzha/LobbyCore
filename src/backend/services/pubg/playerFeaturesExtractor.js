/**
 * Extract full PlayerFeatures from telemetry events (one pass, per-accountId state).
 */
const { parseEvents, eventType, parseTime, getAccountId, isSameCharacter } = require('./telemetryHelpers');

const EXTRACTOR_VERSION = '1.0';

function emptyCombat() {
  return {
    kills: 0,
    assists: 0,
    knocks: 0,
    deaths: 0,
    headshots: 0,
    damageDealt: 0,
    damageTaken: 0,
    damageDealtToPlayers: 0,
    damageTakenFromPlayers: 0,
    damageByZone: 0,
    damageByWeapon: {},
    shotsApprox: null,
    engagements: { fightsParticipated: 0, firstEngagementT: null, lastEngagementT: null, damagePerMin: 0, killParticipationRate: 0 },
    ranges: { close: 0, mid: 0, long: 0 },
  };
}

function emptySurvival() {
  return {
    top1: false,
    top3: false,
    top10: false,
    timeInBlueZoneSec: 0,
    blueZoneDamage: 0,
    timeInRedZoneSec: 0,
    knocksReceived: 0,
    revivesReceived: 0,
  };
}

function emptyUtility() {
  return {
    healsUsedCount: 0,
    boostsUsedCount: 0,
    healAmountTotal: 0,
    boostCountTotal: 0,
    effectiveHealEstimate: 0,
    wasteHealEstimate: 0,
  };
}

function emptyMobility() {
  return {
    distanceTraveledM: 0,
    avgSpeedMps: 0,
    vehicle: { timeInVehicleSec: 0, distanceInVehicleM: 0, maxSpeedMps: 0 },
  };
}

function emptyTeamplay() {
  return { revivesDone: 0, revivesReceived: 0, assistsCount: 0 };
}

function emptyLateGame() {
  return { damageDealtLate: 0, killsLate: 0, timeAliveWhenAlivePlayersBelow10Sec: 0 };
}

function emptyQuality() {
  return {
    positionsPoints: 0,
    gameStateSnapshots: 0,
    damageEvents: 0,
    weaponFireEvents: 0,
    telemetryCoverageScore: 0,
    notes: [],
  };
}

/**
 * @param {Object|Array} telemetry
 * @param {Array<{ accountId: string, name?: string, teamId?: string }>} participants
 * @param {string} [matchId]
 * @param {string} [startedAt]
 * @param {number} [durationSec]
 * @returns {Map<string, import('./pubgContracts').PlayerFeatures>}
 */
function extractAllPlayerFeatures(telemetry, participants, matchId = '', startedAt = '', durationSec = 0) {
  const events = parseEvents(telemetry);
  const accountIds = new Set(participants.map((p) => p.accountId).filter(Boolean));
  const participantByAccountId = new Map(participants.map((p) => [p.accountId, p]));

  const state = new Map();
  function getState(accountId) {
    if (!state.has(accountId)) {
      state.set(accountId, {
        combat: emptyCombat(),
        survival: emptySurvival(),
        utility: emptyUtility(),
        mobility: emptyMobility(),
        teamplay: emptyTeamplay(),
        lateGame: emptyLateGame(),
        quality: emptyQuality(),
        firstTime: null,
        deathTime: null,
        lastTime: null,
        matchEndTime: null,
        inBlueSum: 0,
        lastPosition: null,
        lastPositionTime: null,
        distanceTraveledM: 0,
        weaponFireCount: 0,
        damageEventsCount: 0,
        positionCount: 0,
        gameStateCount: 0,
        inVehicleSince: null,
        vehicleDistance: 0,
        vehicleMaxSpeed: 0,
        numAliveWhenBelow10: null,
      });
    }
    return state.get(accountId);
  }
  for (const accountId of accountIds) getState(accountId);

  let matchStartTs = null;
  const LATE_GAME_THRESHOLD = 10; // alive players

  for (const evt of events) {
    const type = eventType(evt);
    const typeLower = type.toLowerCase();
    const t = parseTime(evt);
    if (matchStartTs == null && (typeLower === 'logmatchstart' || typeLower === 'logmatchdefinition')) matchStartTs = t;
    const tRel = matchStartTs != null ? t - matchStartTs : t;

    if (typeLower === 'logplayertakedamage') {
      const damage = Number(evt.damage ?? evt.damageTaken ?? 0) || 0;
      const victimId = getAccountId(evt.victim ?? evt.Victim);
      const attackerId = getAccountId(evt.attacker ?? evt.Attacker);
      const damageCauser = (evt.damageCauserName ?? evt.damageReason ?? '').toString();
      const isZone = !attackerId && (damageCauser.toLowerCase().includes('bluezone') || damageCauser.toLowerCase().includes('redzone') || damageCauser.toLowerCase().includes('poison'));

      if (victimId && accountIds.has(victimId)) {
        const s = getState(victimId);
        s.combat.damageTaken += damage;
        s.damageEventsCount += 1;
        if (isZone) {
          s.combat.damageByZone += damage;
          s.survival.blueZoneDamage += damage;
        } else if (attackerId) {
          s.combat.damageTakenFromPlayers += damage;
        }
        if (evt.victimGameResult && (evt.victimGameResult.reason === 'Death' || evt.victimGameResult.reason === 'Killed')) {
          s.deathTime = s.deathTime == null ? tRel : s.deathTime;
          s.combat.deaths += 1;
        }
      }
      if (attackerId && accountIds.has(attackerId)) {
        const s = getState(attackerId);
        s.combat.damageDealt += damage;
        s.combat.damageDealtToPlayers += damage;
        if (evt.damageCauserName) s.combat.damageByWeapon[evt.damageCauserName] = (s.combat.damageByWeapon[evt.damageCauserName] || 0) + damage;
        s.combat.engagements.fightsParticipated = (s.combat.engagements.fightsParticipated || 0) + 1;
        if (s.combat.engagements.firstEngagementT == null) s.combat.engagements.firstEngagementT = tRel;
        s.combat.engagements.lastEngagementT = tRel;
      }
    }

    if (typeLower === 'logplayerkill' || typeLower === 'logplayerkillv2') {
      const killerId = getAccountId(evt.killer ?? evt.Killer);
      const victimId = getAccountId(evt.victim ?? evt.Victim);
      const assistantId = evt.assistant ? getAccountId(evt.assistant) : null;
      if (killerId && accountIds.has(killerId)) {
        const s = getState(killerId);
        s.combat.kills += 1;
        if (evt.damageCauserName && String(evt.damageCauserName).toLowerCase().includes('head')) s.combat.headshots += 1;
      }
      if (assistantId && accountIds.has(assistantId)) {
        const s = getState(assistantId);
        s.combat.assists += 1;
        s.teamplay.assistsCount += 1;
      }
      if (victimId && accountIds.has(victimId)) {
        const s = getState(victimId);
        s.deathTime = s.deathTime == null ? tRel : s.deathTime;
        s.combat.deaths += 1;
        const vr = evt.victimGameResult ?? evt.victim?.gameResult;
        if (vr) {
          s.survival.top1 = vr.result === 'Win' || vr.win === 1;
          s.survival.top3 = (vr.ranking || 99) <= 3;
          s.survival.top10 = (vr.ranking || 99) <= 10;
        }
      }
    }

    if (typeLower === 'logplayerrevive') {
      const reviverId = getAccountId(evt.reviver ?? evt.Reviver ?? evt.character);
      const victimId = getAccountId(evt.victim ?? evt.Victim);
      if (reviverId && accountIds.has(reviverId)) {
        getState(reviverId).teamplay.revivesDone += 1;
      }
      if (victimId && accountIds.has(victimId)) {
        getState(victimId).teamplay.revivesReceived += 1;
        getState(victimId).survival.revivesReceived += 1;
      }
    }

    if (typeLower === 'healevent' || typeLower === 'logitemuse') {
      const char = evt.character ?? evt.Character;
      const accountId = getAccountId(char);
      if (accountId && accountIds.has(accountId)) {
        const s = getState(accountId);
        const item = (evt.item?.itemId ?? evt.item ?? '').toString().toLowerCase();
        const healAmt = Number(evt.healAmount ?? evt.amount ?? 0) || 0;
        if (item.includes('heal') || item.includes('firstaid') || item.includes('med')) {
          s.utility.healsUsedCount += 1;
          s.utility.healAmountTotal += healAmt || 1;
        } else if (item.includes('boost') || item.includes('energy') || item.includes('pain')) {
          s.utility.boostsUsedCount += 1;
          s.utility.boostCountTotal += 1;
        }
      }
    }

    if (typeLower === 'boostevent') {
      const accountId = getAccountId(evt.character ?? evt.Character);
      if (accountId && accountIds.has(accountId)) {
        getState(accountId).utility.boostsUsedCount += 1;
      }
    }

    if (typeLower === 'logplayerposition') {
      const accountId = getAccountId(evt.character ?? evt.Character);
      if (accountId && accountIds.has(accountId)) {
        const s = getState(accountId);
        s.positionCount += 1;
        if (s.firstTime == null) s.firstTime = tRel;
        s.lastTime = tRel;
        const loc = evt.character?.location ?? evt.character?.Location;
        if (loc) {
          const x = loc.x ?? loc.X;
          const y = loc.y ?? loc.Y;
          if (s.lastPosition && typeof x === 'number' && typeof y === 'number') {
            const dx = x - s.lastPosition.x;
            const dy = y - s.lastPosition.y;
            s.distanceTraveledM += Math.sqrt(dx * dx + dy * dy) / 100; // telemetry often in cm
          }
          s.lastPosition = { x: Number(x), y: Number(y) };
          s.lastPositionTime = tRel;
        }
        if (evt.character?.isInBlueZone === true) s.inBlueSum += 1;
        if (evt.numAlivePlayers != null && evt.numAlivePlayers <= LATE_GAME_THRESHOLD && s.numAliveWhenBelow10 == null) s.numAliveWhenBelow10 = tRel;
      }
    }

    if (typeLower === 'loggamestateperiodic') {
      for (const accountId of accountIds) getState(accountId).gameStateCount += 1;
    }

    if (typeLower === 'logweaponfirecount') {
      const accountId = getAccountId(evt.character ?? evt.Character);
      const count = Number(evt.fireCount ?? 0) || 0;
      if (accountId && accountIds.has(accountId)) {
        getState(accountId).weaponFireCount += count;
      }
    }

    if (typeLower === 'logvehicleride') {
      const accountId = getAccountId(evt.character ?? evt.Character);
      if (accountId && accountIds.has(accountId)) {
        const s = getState(accountId);
        s.inVehicleSince = tRel;
        s.vehicleDistance += Number(evt.rideDistance ?? 0) || 0;
        const ms = Number(evt.maxSpeed ?? 0) || 0;
        if (ms > s.vehicleMaxSpeed) s.vehicleMaxSpeed = ms;
      }
    }

    if (typeLower === 'logvehicleleave') {
      const accountId = getAccountId(evt.character ?? evt.Character);
      if (accountId && accountIds.has(accountId)) {
        const s = getState(accountId);
        if (s.inVehicleSince != null) {
          s.mobility.vehicle.timeInVehicleSec += (tRel - s.inVehicleSince);
          s.mobility.vehicle.distanceInVehicleM += s.vehicleDistance / 100;
          if (s.vehicleMaxSpeed > s.mobility.vehicle.maxSpeedMps) s.mobility.vehicle.maxSpeedMps = s.vehicleMaxSpeed / 100;
        }
        s.inVehicleSince = null;
        s.vehicleDistance = 0;
        s.vehicleMaxSpeed = 0;
      }
    }

    if (typeLower === 'logmatchdefinition' || typeLower === 'logmatchend') {
      for (const accountId of accountIds) getState(accountId).matchEndTime = tRel;
    }
  }

  // Finalize: timeAlive, placement, late game, quality, engagements
  const result = new Map();
  for (const accountId of accountIds) {
    const s = state.get(accountId);
    if (!s) continue;
    const endT = s.deathTime != null ? s.deathTime : (s.matchEndTime != null ? s.matchEndTime : s.lastTime);
    const timeAliveSec = s.firstTime != null && endT != null ? Math.max(0, endT - s.firstTime) : 0;
    const part = participantByAccountId.get(accountId);

    s.mobility.distanceTraveledM = s.distanceTraveledM / 100;
    if (timeAliveSec > 0) s.mobility.avgSpeedMps = s.mobility.distanceTraveledM / timeAliveSec;
    s.mobility.vehicle.timeInVehicleSec = s.mobility.vehicle.timeInVehicleSec || (s.inVehicleSince != null && endT != null ? Math.max(0, endT - s.inVehicleSince) : 0);
    s.mobility.vehicle.distanceInVehicleM = s.vehicleDistance / 100;
    s.mobility.vehicle.maxSpeedMps = s.vehicleMaxSpeed / 100;

    s.survival.timeInBlueZoneSec = s.inBlueSum; // approximate: count of position samples in blue
    if (s.numAliveWhenBelow10 != null && s.firstTime != null) {
      s.lateGame.timeAliveWhenAlivePlayersBelow10Sec = Math.max(0, (endT || 0) - s.numAliveWhenBelow10);
    }

    s.quality.positionsPoints = s.positionCount;
    s.quality.gameStateSnapshots = s.gameStateCount;
    s.quality.damageEvents = s.damageEventsCount;
    s.quality.weaponFireEvents = s.weaponFireCount;
    if (s.weaponFireCount > 0) s.combat.shotsApprox = s.weaponFireCount;
    const totalEvents = s.positionCount + s.gameStateCount + s.damageEventsCount;
    s.quality.telemetryCoverageScore = totalEvents > 0 ? Math.min(1, (s.positionCount / 100 + s.damageEventsCount) / 200) : 0;
    if (s.weaponFireCount === 0) s.quality.notes.push('LogWeaponFireCount not found; shotsApprox is null');
    if (timeAliveSec > 0 && s.combat.engagements.lastEngagementT != null) {
      s.combat.engagements.damagePerMin = (s.combat.damageDealt / timeAliveSec) * 60;
    }

    result.set(accountId, {
      matchId,
      accountId,
      name: part?.name,
      teamId: part?.teamId,
      startedAt,
      durationSec,
      placement: part?.stats?.placement ?? 0,
      timeAliveSec,
      survivedToEnd: s.deathTime == null && s.matchEndTime != null,
      combat: s.combat,
      survival: s.survival,
      utility: s.utility,
      mobility: s.mobility,
      teamplay: s.teamplay,
      lateGame: s.lateGame,
      quality: s.quality,
      extractorVersion: EXTRACTOR_VERSION,
    });
  }
  return result;
}

module.exports = {
  extractAllPlayerFeatures,
  EXTRACTOR_VERSION,
};
