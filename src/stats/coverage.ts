import { NormalizedMatch } from './types';
import { buildCoverage } from './helpers';

export const computeCoverage = (matches: NormalizedMatch[]) => {
  const completed = matches.filter((match) => typeof match.placement === 'number' && match.placement > 0);
  const totalMatches = completed.length;
  const killsTrackedMatches = completed.filter((match) => match.kills != null).length;
  const deathsTrackedMatches = completed.filter((match) => match.deaths != null).length;

  return {
    kills: buildCoverage(killsTrackedMatches, totalMatches, `Kills tracked: ${killsTrackedMatches}/${totalMatches}`),
    deaths: buildCoverage(deathsTrackedMatches, totalMatches, `Deaths tracked: ${deathsTrackedMatches}/${totalMatches}`),
    kd: buildCoverage(deathsTrackedMatches, totalMatches, `K/D based on deaths in ${deathsTrackedMatches}/${totalMatches}`)
  };
};
