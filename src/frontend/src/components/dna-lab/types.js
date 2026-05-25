/**
 * DNA API types (aligned with backend contracts v2).
 * Used for JSDoc / consistency; no runtime validation.
 *
 * @typedef {Object} GeneTrend
 * @property {number|null} delta
 * @property {"up"|"down"|"flat"|null} direction
 * @property {"last_match"|"avg"|null} [basis]
 *
 * @typedef {Object} Gene
 * @property {string} key
 * @property {string} label
 * @property {string} [shortLabel]
 * @property {number|null} value 0-100, null if not enough data
 * @property {GeneTrend|number} [trend] object with delta/direction or legacy number
 * @property {"low"|"medium"|"high"} [confidence]
 *
 * @typedef {Object} MatchNode
 * @property {string} id
 * @property {string} [matchId]
 * @property {string} label
 * @property {number} [order]
 * @property {string} [dateISO]
 * @property {string} [startedAt]
 * @property {string} [dateShort]
 * @property {string} [mapName]
 * @property {{ kills?: number, damage?: number, placement?: number, win?: boolean }} [summary]
 * @property {Object.<string,number|null>} [geneValues]
 * @property {Object.<string,number|null>} [geneDeltas]
 *
 * @typedef {Object} DNAProfile
 * @property {string} playerId
 * @property {string} seasonId
 * @property {number|null} coreScore
 * @property {Gene[]} genes
 * @property {MatchNode[]} matches
 * @property {MatchNode[]} [matchHistory]
 * @property {Object} [seasonSlice]
 * @property {string} [confidence] "low"|"medium"|"high"
 * @property {Object} [coverage]
 * @property {number} [coverage.matchesTotal]
 * @property {number} [coverage.telemetryMatches]
 * @property {number} [coverage.killsTrackedMatches]
 * @property {string} [updatedAt]
 * @property {string} [lastUpdated]
 * @property {DNAReasons} [reasons]
 *
 * @typedef {Object} DNAReasons
 * @property {Object.<string, { highlights: Array<{ kind: string, text: string, metricKey?: string, value?: number, delta?: number }>, metrics?: Object }>} [perGene]
 *
 * @typedef {Object} DictionaryEntry
 * @property {string} id
 * @property {string} [key]
 * @property {string} [name]
 * @property {string} [label]
 * @property {string} [shortLabel]
 * @property {string} [description]
 * @property {string} [meaning]
 * @property {string[]} [howComputed]
 * @property {string[]} [computedFrom]
 * @property {string[]} [howToImprove]
 * @property {string[]} [improveBy]
 * @property {string} [lowDataHint]
 * @property {string} [label_ru]
 * @property {string} [meaning_ru]
 * @property {string[]} [computedFrom_ru]
 * @property {string[]} [improveBy_ru]
 * @property {string[]} [notes]
 *
 * @typedef {Object} LeaderboardEntry
 * @property {string} playerId
 * @property {string} [playerName]
 * @property {number} coreScore
 * @property {Object.<string,number>} [genes]
 */

export {};
