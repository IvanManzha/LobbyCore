export type TournamentStatus = 'REG' | 'LIVE' | 'DONE';
export type TournamentMode = 'solo' | 'duo' | 'squad' | 'mixed' | 'unknown';

export type RawTournament = {
  id?: string;
  _id?: string;
  name?: string;
  date?: string;
  type?: string;
  state?: string;
  rounds?: number;
  playedRounds?: number;
  scoring?: {
    placement?: Record<string | number, number>;
    per_kill?: number;
  };
};

export type RawTable = {
  tournament?: {
    id?: string;
    name?: string;
    type?: string;
    rounds?: number;
    scoring?: {
      placement?: Record<string | number, number>;
      per_kill?: number;
    };
  };
  teams?: RawTeam[];
};

export type RawTeam = {
  name?: string;
  players?: string[];
  results?: Array<{
    placement?: number | null;
    kills?: number | null;
  }>;
  playerKills?: Array<{ kills?: Array<number | null> }>;
  playerDeaths?: Array<{ deaths?: Array<number | null> }>;
  totalPoints?: number;
  rank?: number;
};

export type NormalizedTournament = {
  id: string;
  name: string;
  date: string | null;
  mode: TournamentMode;
  status: TournamentStatus;
  roundsCount: number;
  participantsCount: number | null;
  scoring: {
    placement: Record<string | number, number>;
    perKill: number;
  };
};

export type NormalizedMatch = {
  tournamentId: string;
  tournamentName: string;
  date: string | null;
  mode: TournamentMode;
  status: TournamentStatus;
  roundIndex: number;
  placement: number | null;
  points: number | null;
  kills: number | null;
  deaths: number | null;
  participantsCount: number | null;
};

export type PlayerHistoryEntry = {
  tournamentId?: string;
  tournamentName?: string;
  date?: string;
  place?: number | string | null;
  points?: number | string | null;
  personalKills?: number | string | null;
  personalDeaths?: number | string | null;
  oldRating?: number | null;
  newRating?: number | null;
};

export type PlayerProfile = {
  name: string;
  rating?: number;
  effectiveRating?: number;
  longAnchor?: number;
  dna_rating?: number;
  history?: PlayerHistoryEntry[];
  yearSnapshots?: Record<string, { history?: PlayerHistoryEntry[] }>;
};

export type CoverageInfo = {
  trackedMatches: number;
  totalMatches: number;
  label: string;
};

export type MetricItem = {
  id: string;
  label: string;
  value: number | null;
  displayValue: string;
  tooltip?: string;
  coverage?: CoverageInfo;
  emphasize?: boolean;
};

export type FormItem = {
  placement: number;
  isTop: boolean;
};

export type RatingBreakdown = {
  longAnchor: number | null;
  shortAnchor: number | null;
  windowRating: number | null;
  effectiveRating: number | null;
  windowSize: number;
  shortWindowSize: number;
  formula: string;
};

export type PlayerStatsMeta = {
  scope: 'all_time' | 'year' | 'last_5_tournaments' | 'live_only';
  year?: string | null;
  modeFilter: 'all' | 'solo' | 'duo' | 'squad' | 'mixed';
  matchesPlayed: number;
  tournamentsPlayed: number;
  tournamentsCompleted: number;
  hasData: boolean;
};

export type PlayerStatsResponse = {
  core: MetricItem[];
  secondary: MetricItem[];
  coverage: {
    kills: CoverageInfo;
    deaths: CoverageInfo;
    kd: CoverageInfo;
  };
  formLast5: {
    items: FormItem[];
    tooltip: string;
  };
  ratingBreakdown: RatingBreakdown | null;
  meta: PlayerStatsMeta;
};

export type PlayerStatsOptions = {
  scope?: PlayerStatsMeta['scope'];
  includeLive?: boolean;
  modeFilter?: PlayerStatsMeta['modeFilter'];
  year?: string | null;
};

export type PlayerStatsInput = {
  profile: PlayerProfile;
  tournaments: RawTournament[];
  tablesById: Record<string, RawTable | null | undefined>;
};

export type LeaderboardRow = {
  rank: number | null;
  name: string;
  players: string[];
  totalPoints: number;
  totalKills: number;
  matchesPlayed: number;
  killsCoverage: CoverageInfo;
};

export type TournamentLeaderboardResponse = {
  tournamentId: string;
  tournamentName: string;
  status: TournamentStatus;
  mode: TournamentMode;
  roundsCount: number;
  rows: LeaderboardRow[];
};
