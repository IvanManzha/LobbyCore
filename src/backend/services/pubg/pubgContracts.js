/**
 * PUBG Feature Store contracts (shapes only).
 * Used by telemetry pipeline and API.
 *
 * @typedef {Object} Participant
 * @property {string} accountId
 * @property {string} name
 * @property {string} [teamId]
 * @property {Object} [stats] { kills, damage, placement }
 *
 * @typedef {Object} MatchMeta
 * @property {string} matchId
 * @property {string} mapName
 * @property {string} [startedAt] ISO date
 * @property {number} [durationSec]
 * @property {boolean} [isCustomMatch]
 * @property {Participant[]} participants
 * @property {Object[]} [rosters]
 *
 * @typedef {Object} CombatFeatures
 * @property {number} kills
 * @property {number} assists
 * @property {number} knocks
 * @property {number} deaths
 * @property {number} [headshots]
 * @property {number} damageDealt
 * @property {number} damageTaken
 * @property {number} [damageDealtToPlayers]
 * @property {number} [damageTakenFromPlayers]
 * @property {number} [damageByZone]
 * @property {Object.<string,number>} [damageByWeapon]
 * @property {number|null} [shotsApprox]
 * @property {{ fightsParticipated?: number, firstEngagementT?: number, lastEngagementT?: number, damagePerMin?: number, killParticipationRate?: number }} [engagements]
 * @property {{ close?: number, mid?: number, long?: number }} [ranges]
 *
 * @typedef {Object} SurvivalFeatures
 * @property {boolean} top1
 * @property {boolean} top3
 * @property {boolean} top10
 * @property {number} timeInBlueZoneSec
 * @property {number} [blueZoneDamage]
 * @property {number} [timeInRedZoneSec]
 * @property {number} [knocksReceived]
 * @property {number} revivesReceived
 *
 * @typedef {Object} UtilityFeatures
 * @property {number} healsUsedCount
 * @property {number} boostsUsedCount
 * @property {number} [healAmountTotal]
 * @property {number} [boostCountTotal]
 * @property {number} [effectiveHealEstimate]
 * @property {number} [wasteHealEstimate]
 *
 * @typedef {Object} MobilityFeatures
 * @property {number} distanceTraveledM
 * @property {number} [avgSpeedMps]
 * @property {{ timeInVehicleSec?: number, distanceInVehicleM?: number, maxSpeedMps?: number }} [vehicle]
 *
 * @typedef {Object} TeamplayFeatures
 * @property {number} revivesDone
 * @property {number} revivesReceived
 * @property {number} assistsCount
 * @property {number} [teammatesSavedScore]
 * @property {number} [proximityToTeamAvgM]
 *
 * @typedef {Object} LateGameFeatures
 * @property {number} [damageDealtLate]
 * @property {number} [killsLate]
 * @property {number} [timeAliveWhenAlivePlayersBelow10Sec]
 *
 * @typedef {Object} QualityFeatures
 * @property {number} positionsPoints
 * @property {number} gameStateSnapshots
 * @property {number} damageEvents
 * @property {number} [weaponFireEvents]
 * @property {number} telemetryCoverageScore
 * @property {string[]} notes
 *
 * @typedef {Object} PlayerFeatures
 * @property {string} matchId
 * @property {string} accountId
 * @property {string} [name]
 * @property {string} [teamId]
 * @property {string} [startedAt]
 * @property {number} [durationSec]
 * @property {number} [placement]
 * @property {number} [timeAliveSec]
 * @property {boolean} [survivedToEnd]
 * @property {CombatFeatures} combat
 * @property {SurvivalFeatures} survival
 * @property {UtilityFeatures} utility
 * @property {MobilityFeatures} mobility
 * @property {TeamplayFeatures} teamplay
 * @property {LateGameFeatures} [lateGame]
 * @property {QualityFeatures} quality
 * @property {string} extractorVersion
 *
 * @typedef {Object} TrackPoint
 * @property {number} t
 * @property {number} x
 * @property {number} y
 * @property {boolean} [alive]
 * @property {number} [hp]
 * @property {boolean} [isInBlueZone]
 * @property {number} [numAlivePlayers]
 *
 * @typedef {Object} Track
 * @property {string} matchId
 * @property {string} accountId
 * @property {TrackPoint[]} points
 *
 * @typedef {Object} MapEvent
 * @property {string} id
 * @property {number} t
 * @property {string} type KILL|KNOCK|DEATH|REVIVE|DAMAGE|ZONE_DAMAGE|VEHICLE_ENTER|VEHICLE_EXIT|HEAL|BOOST
 * @property {number} [x]
 * @property {number} [y]
 * @property {string} [actorId]
 * @property {string} [targetId]
 * @property {string} [weapon]
 * @property {number} [damage]
 * @property {number} [distanceM]
 * @property {string[]} [tags]
 *
 * @typedef {Object} EventsFile
 * @property {string} matchId
 * @property {string} accountId
 * @property {MapEvent[]} events
 *
 * @typedef {Object} TelemetryIndex
 * @property {number} timeStart
 * @property {number} timeEnd
 * @property {string[]} players
 * @property {Object.<string,number>} eventCountsByType
 * @property {{ minX?: number, maxX?: number, minY?: number, maxY?: number }} [mapBounds]
 * @property {string} [extractorVersion]
 */

module.exports = {};
