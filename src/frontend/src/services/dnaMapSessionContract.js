/**
 * DNA Map Studio session contract (matches backend response).
 * @typedef {Object} DnaMapSessionMatch
 * @property {string} matchId
 * @property {string} mapName
 * @property {string} startedAt
 * @property {number} durationSec
 * @property {{ imageUrl: string, worldSize?: number, bounds?: { minX: number, minY: number, maxX: number, maxY: number } }} [map]
 *
 * @typedef {Object} DnaMapSessionEntity
 * @property {string} id
 * @property {string} label
 * @property {string} [color]
 *
 * @typedef {Object} DnaMapSessionTrackPoint
 * @property {number} t
 * @property {number} x
 * @property {number} y
 * @property {{ alive?: boolean, hp?: number }} [meta]
 *
 * @typedef {Object} DnaMapSessionEventActor
 * @property {string} id
 * @property {string} label
 * @property {string} [teamId]
 *
 * @typedef {Object} DnaMapSessionEvent
 * @property {string} id
 * @property {number} t
 * @property {string} type
 * @property {number} x
 * @property {number} y
 * @property {DnaMapSessionEventActor} [actor]
 * @property {DnaMapSessionEventActor} [target]
 * @property {string} [weapon]
 * @property {number} [damage]
 * @property {number} [distanceM]
 * @property {string[]} [tags]
 * @property {string} [fightId]
 *
 * @typedef {Object} DnaMapSessionFight
 * @property {string} id
 * @property {number} startT
 * @property {number} endT
 * @property {{ x: number, y: number }} centroid
 * @property {{ sideA: string[], sideB: string[] }} participants
 * @property {'win'|'loss'|'draw'} [outcome]
 * @property {{ damageA?: number, damageB?: number, knocksA?: number, knocksB?: number, killsA?: number, killsB?: number }} [stats]
 *
 * @typedef {Object} DnaMapSession
 * @property {DnaMapSessionMatch} match
 * @property {Record<string, string>} [idNameMap] PUBG account id -> in-game name (id/name pass: DB participants + telemetry fill)
 * @property {Record<string, string>} [idTeamMap] PUBG account id -> team id
 * @property {Array<{ id: string, label: string, teamId?: string | null }>} [roster]
 * @property {{ primary: DnaMapSessionEntity, secondary?: DnaMapSessionEntity }} entities
 * @property {{ primary: DnaMapSessionTrackPoint[], secondary?: DnaMapSessionTrackPoint[], byPlayer?: Record<string, DnaMapSessionTrackPoint[]> }} tracks
 * @property {DnaMapSessionEvent[]} events
 * @property {DnaMapSessionFight[]} [fights]
 * @property {Array<{ t: number, safe: { x: number, y: number, r: number }, next: { x: number, y: number, r: number } | null }>} [zoneSnapshots]
 * @property {{ tracks: boolean, events: boolean, damage: boolean, zone: boolean }} coverage
 */

export default {};
