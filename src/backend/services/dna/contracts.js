/**
 * DNA API contracts (shapes only; no logic).
 * Shared conceptually with frontend types.
 *
 * @typedef {Object} Gene
 * @property {string} key
 * @property {string} label
 * @property {number} value 0-100
 * @property {number} [trend] delta vs previous
 * @property {number} [confidence] 0-1
 *
 * @typedef {Object} MatchNode
 * @property {string} id
 * @property {string} matchId
 * @property {string} label
 * @property {number} order
 * @property {string} [dateISO]
 * @property {string} [dateShort]
 * @property {Object} summary { kills, damage, placement, win }
 * @property {Object.<string,number>} geneValues
 *
 * @typedef {Object} SeasonSlice
 * @property {string} seasonId
 * @property {string[]} [matchIds]
 * @property {string} [startDate]
 * @property {string} [endDate]
 *
 * @typedef {Object} Confidence
 * @property {number} level 0-1
 * @property {number} matchesCount
 * @property {string} [label] e.g. "low" | "medium" | "high"
 *
 * @typedef {Object} DNAProfile
 * @property {string} playerId
 * @property {string} seasonId
 * @property {number} coreScore
 * @property {Gene[]} genes
 * @property {MatchNode[]} matches
 * @property {SeasonSlice} [seasonSlice]
 * @property {Confidence} [confidence]
 *
 * @typedef {Object} DictionaryEntry
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string[]} howComputed
 * @property {string[]} howToImprove
 * @property {string} lowDataHint
 *
 * @typedef {Object} LeaderboardEntry
 * @property {string} playerId
 * @property {string} [playerName]
 * @property {number} coreScore
 * @property {Object.<string,number>} [genes]
 */

module.exports = {};
