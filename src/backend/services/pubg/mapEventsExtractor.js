/**
 * Extract per-player map events (KILL, DEATH, REVIVE, DAMAGE, etc.) for DNA Map.
 */
const { parseEvents, eventType, parseTime, getAccountId, getLocation } = require('./telemetryHelpers');

function getEventLocation(evt) {
  return getLocation(evt.victim ?? evt.Victim) ?? getLocation(evt.character ?? evt.Character) ?? getLocation(evt.attacker ?? evt.Attacker) ?? getLocation(evt);
}

let eventIdCounter = 0;
function nextId() {
  return `evt_${Date.now()}_${++eventIdCounter}`;
}

/**
 * @param {Object|Array} telemetry
 * @param {string[]} accountIds
 * @param {string} [matchId]
 * @returns {Map<string, import('./pubgContracts').EventsFile>}
 */
function extractMapEvents(telemetry, accountIds, matchId = '') {
  const events = parseEvents(telemetry);
  const accountIdSet = new Set(accountIds);
  const byAccount = new Map(accountIds.map((id) => [id, []]));

  let matchStartTs = null;

  for (const evt of events) {
    const type = eventType(evt);
    const typeLower = type.toLowerCase();
    const t = parseTime(evt);
    if (matchStartTs == null && (typeLower === 'logmatchstart' || typeLower === 'logmatchdefinition')) matchStartTs = t;
    const tRel = matchStartTs != null ? t - matchStartTs : t;
    const loc = getEventLocation(evt);

    if (typeLower === 'logplayertakedamage') {
      const damage = Number(evt.damage ?? evt.damageTaken ?? 0) || 0;
      const victimId = getAccountId(evt.victim ?? evt.Victim);
      const attackerId = getAccountId(evt.attacker ?? evt.Attacker);
      const damageCauser = (evt.damageCauserName ?? evt.damageReason ?? '').toString();
      const isZone = !attackerId && (damageCauser.toLowerCase().includes('bluezone') || damageCauser.toLowerCase().includes('redzone') || damageCauser.toLowerCase().includes('poison'));

      const ev = {
        id: nextId(),
        t: tRel,
        type: isZone ? 'ZONE_DAMAGE' : 'DAMAGE',
        x: loc?.x,
        y: loc?.y,
        actorId: attackerId || undefined,
        targetId: victimId || undefined,
        weapon: damageCauser || undefined,
        damage,
        tags: [],
      };
      const added = new Set();
      if (victimId && accountIdSet.has(victimId)) {
        byAccount.get(victimId).push({ ...ev, type: isZone ? 'ZONE_DAMAGE' : 'DAMAGE' });
        added.add(victimId);
      }
      if (attackerId && accountIdSet.has(attackerId) && !added.has(attackerId)) {
        byAccount.get(attackerId).push({ ...ev });
      }
    }

    if (typeLower === 'logplayerkill' || typeLower === 'logplayerkillv2') {
      const killerId = getAccountId(evt.killer ?? evt.Killer);
      const victimId = getAccountId(evt.victim ?? evt.Victim);
      const dist = evt.distance ?? evt.Distance;
      const evKill = { id: nextId(), t: tRel, type: 'KILL', x: loc?.x, y: loc?.y, actorId: killerId, targetId: victimId, weapon: evt.damageCauserName, distanceM: dist ? dist / 100 : undefined, tags: [] };
      const evDeath = { id: nextId(), t: tRel, type: 'DEATH', x: loc?.x, y: loc?.y, actorId: killerId, targetId: victimId, weapon: evt.damageCauserName, distanceM: dist ? dist / 100 : undefined, tags: [] };
      if (killerId && accountIdSet.has(killerId)) byAccount.get(killerId).push(evKill);
      if (victimId && accountIdSet.has(victimId)) byAccount.get(victimId).push(evDeath);
    }

    if (typeLower === 'logplayerrevive') {
      const reviverId = getAccountId(evt.reviver ?? evt.Reviver ?? evt.character);
      const victimId = getAccountId(evt.victim ?? evt.Victim);
      const ev = { id: nextId(), t: tRel, type: 'REVIVE', x: loc?.x, y: loc?.y, actorId: reviverId, targetId: victimId, tags: [] };
      if (reviverId && accountIdSet.has(reviverId)) byAccount.get(reviverId).push(ev);
      if (victimId && accountIdSet.has(victimId) && victimId !== reviverId) byAccount.get(victimId).push({ ...ev, id: nextId() });
    }

    if (typeLower === 'healevent' || typeLower === 'logitemuse') {
      const accountId = getAccountId(evt.character ?? evt.Character);
      const item = (evt.item?.itemId ?? evt.item ?? '').toString().toLowerCase();
      if (accountId && accountIdSet.has(accountId)) {
        const evType = item.includes('heal') || item.includes('firstaid') || item.includes('med') ? 'HEAL' : item.includes('boost') || item.includes('energy') || item.includes('pain') ? 'BOOST' : null;
        if (evType) byAccount.get(accountId).push({ id: nextId(), t: tRel, type: evType, x: loc?.x, y: loc?.y, actorId: accountId, tags: [] });
      }
    }

    if (typeLower === 'boostevent') {
      const accountId = getAccountId(evt.character ?? evt.Character);
      if (accountId && accountIdSet.has(accountId)) byAccount.get(accountId).push({ id: nextId(), t: tRel, type: 'BOOST', x: loc?.x, y: loc?.y, actorId: accountId, tags: [] });
    }

    if (typeLower === 'logvehicleride') {
      const accountId = getAccountId(evt.character ?? evt.Character);
      if (accountId && accountIdSet.has(accountId)) byAccount.get(accountId).push({ id: nextId(), t: tRel, type: 'VEHICLE_ENTER', x: loc?.x, y: loc?.y, actorId: accountId, tags: [] });
    }

    if (typeLower === 'logvehicleleave') {
      const accountId = getAccountId(evt.character ?? evt.Character);
      if (accountId && accountIdSet.has(accountId)) byAccount.get(accountId).push({ id: nextId(), t: tRel, type: 'VEHICLE_EXIT', x: loc?.x, y: loc?.y, actorId: accountId, tags: [] });
    }
  }

  const result = new Map();
  for (const accountId of accountIds) {
    const list = byAccount.get(accountId) || [];
    list.sort((a, b) => a.t - b.t);
    result.set(accountId, { matchId, accountId, events: list });
  }
  return result;
}

module.exports = {
  extractMapEvents,
};
