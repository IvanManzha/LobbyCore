import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import './TournamentTable.css';
import { PlayerPlaque } from '@/entities/player';
import {
  getParticipantPerformanceLink,
  isSoloLikeParticipant,
} from '../lib/participantDisplay';

const COL = {
  rank: 'tournament-table__col-rank',
  participant: 'tournament-table__col-participant',
  rating: 'tournament-table__col-rating',
  stat: 'tournament-table__col-stat',
  paid: 'tournament-table__col-paid',
  action: 'tournament-table__col-action',
};

function RegColGroup({ hasPaidCol }) {
  return (
    <colgroup>
      <col className={COL.rank} />
      <col className={COL.participant} />
      <col className={COL.rating} />
      {hasPaidCol && <col />}
      <col className={COL.action} />
    </colgroup>
  );
}

function FinishedColGroup() {
  return (
    <colgroup>
      <col className={COL.rank} />
      <col className={COL.participant} />
      <col className={COL.rating} />
      <col className={COL.stat} />
      <col className={COL.stat} />
      <col className={COL.stat} />
      <col className={COL.action} />
    </colgroup>
  );
}

function TournamentTable({ table, tournamentId: propTournamentId, tournament, status = '', myRegistration = null }) {
  const [expandedRegRow, setExpandedRegRow] = useState(null);
  const { id: urlTournamentId } = useParams();
  const tournamentId = propTournamentId || urlTournamentId || table?.tournament?.id || table?.tournament?._id;
  const tournamentType = table?.tournament?.type || 'solo';
  const isSoloTournament = tournamentType === 'solo';
  const isReg = status === 'REG';
  const entryFeeDC = tournament?.finance?.entryFeeDC ?? tournament?.extra?.finance?.entryFeeDC ?? 0;
  const entries = tournament?.registration?.entries || [];
  const getEntryByTeamName = (teamName) => entries.find((e) => e.kind === 'team' && (e.name || '').trim() === (teamName || '').trim());
  const getPaidCount = (teamName) => {
    const entry = getEntryByTeamName(teamName);
    if (!entry || entryFeeDC <= 0) return null;
    const members = entry.members || (entry.captainId ? [entry.captainId] : []);
    const mp = entry.memberPayments && typeof entry.memberPayments === 'object' ? entry.memberPayments : {};
    const paid = members.filter((pid) => (mp[pid] || 0) >= entryFeeDC).length;
    return { paid, total: members.length || 0 };
  };

  const getTeamLink = (teamName, players) =>
    getParticipantPerformanceLink(tournamentId, tournamentType, teamName, players);

  const usesPlayerPlaque = (row) =>
    isSoloLikeParticipant({
      tournamentType,
      players: row?.players,
      name: row?.name,
    });

  const renderPlayerPlaque = (playerName, { to, trailing, players } = {}) => (
    <PlayerPlaque
      playerId={playerName}
      displayName={playerName}
      size="table"
      to={to || getTeamLink(playerName, players) || `/player/${encodeURIComponent(playerName)}`}
      trailing={trailing}
    />
  );

  const renderTeamName = (team) => {
    const teamLink = getTeamLink(team.name, team.players);
    return (
      <div className="team-name-with-players">
        {teamLink ? (
          <Link to={teamLink} className="team-name-link">
            {team.name}
          </Link>
        ) : (
          <span className="team-name-text">{team.name}</span>
        )}
        <span className="team-players-list">
          {' ('}
          {team.players.map((player, idx) => (
            <React.Fragment key={idx}>
              <Link to={`/player/${encodeURIComponent(player)}`}>{player}</Link>
              {idx < team.players.length - 1 && ', '}
            </React.Fragment>
          ))}
          {')'}
        </span>
      </div>
    );
  };

  const leaderboardRows = useMemo(() => {
    if (!table?.teams) return [];
    return (table.teams || []).map((team) => {
      const results = team.results || [];
      const totalKills = results.reduce((sum, r) => sum + (Number(r?.kills) || 0), 0);
      const matchesPlayed = results.filter((r) => r?.placement != null).length;
      const killsTracked = results.filter((r) => r?.kills != null).length;

      return {
        rank: team.rank ?? null,
        name: team.name,
        players: team.players || (team.name ? [team.name] : []),
        totalPoints: team.totalPoints || 0,
        totalKills,
        matchesPlayed,
        killsCoverage: {
          trackedMatches: killsTracked,
          totalMatches: matchesPlayed,
          label: `Kills tracked: ${killsTracked}/${matchesPlayed}`,
        },
        totalRating: team.totalRating ?? null,
        budget: team.budget,
        rating_value: team.rating_value ?? null,
        rating_delta: team.rating_delta ?? null,
      };
    }).sort((a, b) => {
      if (a.rank == null && b.rank == null) return 0;
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      return a.rank - b.rank;
    });
  }, [table]);

  const regColSpan = entryFeeDC > 0 ? 5 : 4;

  if (!table || !table.teams) {
    return <div className="muted">Нет данных</div>;
  }

  if (isReg) {
    return (
      <div className="tournament-table tournament-table--reg">
        <div className="table-shell">
        <table className="table-premium">
          <RegColGroup hasPaidCol={entryFeeDC > 0} />
          <thead>
            <tr>
              <th className={COL.rank}>№</th>
              <th className={COL.participant}>Команда / участник</th>
              <th className={COL.rating}>Рейтинг</th>
              {entryFeeDC > 0 && <th className={COL.paid}>Оплата</th>}
              <th className={COL.action} />
            </tr>
          </thead>
          <tbody>
            {leaderboardRows.map((row) => {
              const team = table.teams.find((t) => t.name === row.name) || row;
              const hasRoster = row.players && row.players.length > 1;
              const isExpanded = expandedRegRow === row.name;
              const isParticipant = myRegistration && (row.name || '').trim() === (myRegistration.teamName || '').trim();
              const paid = getPaidCount(row);
              const link = getTeamLink(row.name, row.players) || `/player/${encodeURIComponent(row.name)}`;
              const showPlaque = usesPlayerPlaque(row);

              return (
                <React.Fragment key={row.name}>
                  <tr
                    className={[
                      hasRoster ? 'tournament-table__row--expandable' : '',
                      isParticipant ? 'row--participant' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => hasRoster && setExpandedRegRow(isExpanded ? null : row.name)}
                  >
                    <td className={COL.rank}>
                      <span className="table-number">{row.rank ?? '—'}</span>
                    </td>
                    <td
                      className={
                        showPlaque
                          ? 'tournament-table__player-cell tournament-table__col-participant'
                          : 'tournament-table__col-participant'
                      }
                    >
                      {showPlaque ? (
                        renderPlayerPlaque(row.name, { to: link, players: row.players })
                      ) : (
                        <div className="tournament-table__team-cell">
                          {hasRoster && (
                            <span className="tournament-table__expand-icon">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          )}
                          <Link to={getTeamLink(row.name, row.players) || '#'} onClick={(e) => e.stopPropagation()}>
                            {row.name}
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className={COL.rating}>
                      <span className="table-number">
                        {row.totalRating != null ? row.totalRating : '—'}
                      </span>
                    </td>
                    {entryFeeDC > 0 && (
                      <td className={COL.paid}>
                        {paid ? (
                          <span className="tournament-table__paid-count">{paid.paid}/{paid.total}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    <td className={COL.action}>
                      {getTeamLink(row.name, row.players) && (
                        <Link className="table-action" to={getTeamLink(row.name, row.players)} onClick={(e) => e.stopPropagation()}>
                          →
                        </Link>
                      )}
                    </td>
                  </tr>
                  {hasRoster && isExpanded && (
                    <tr key={`${row.name}-roster`} className="tournament-table__roster-row">
                      <td colSpan={regColSpan}>
                        <div className="tournament-table__roster">
                          <div className="tournament-table__roster-title">Состав</div>
                          <ul className="tournament-table__roster-list">
                            {(row.players || []).map((player, idx) => (
                              <li key={idx} className="tournament-table__roster-list-item">
                                <Link to={`/player/${encodeURIComponent(player)}`}>{player}</Link>
                                {team.budget && team.budget[idx] != null && (
                                  <span className="tournament-table__roster-rating"> ({team.budget[idx]} р.)</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    );
  }

  return (
    <div className="tournament-table">
      <div className="table-shell">
      <table className="table-premium">
        <FinishedColGroup />
        <thead>
          <tr>
            <th className={COL.rank}>Rank</th>
            <th className={COL.participant}>{isSoloTournament ? 'Игрок' : 'Участник'}</th>
            <th className={COL.rating}>Рейтинг</th>
            <th className={COL.stat}>Очки</th>
            <th className={COL.stat}>Киллы</th>
            <th className={COL.stat}>Матчи</th>
            <th className={COL.action} />
          </tr>
        </thead>
        <tbody>
          {leaderboardRows.map((row) => {
            const isParticipant = myRegistration && (row.name || '').trim() === (myRegistration.teamName || '').trim();
            const link = getTeamLink(row.name, row.players) || `/player/${encodeURIComponent(row.name)}`;
            const showPlaque = usesPlayerPlaque(row);

            return (
              <tr key={row.name} className={isParticipant ? 'row--participant' : ''}>
                <td className={COL.rank}>
                  <span className="table-number">{row.rank ?? '—'}</span>
                </td>
                <td
                  className={
                    showPlaque
                      ? 'tournament-table__player-cell tournament-table__col-participant'
                      : 'tournament-table__col-participant'
                  }
                >
                  {showPlaque
                    ? renderPlayerPlaque(row.name, { to: link, players: row.players })
                    : renderTeamName({ name: row.name, players: row.players })}
                </td>
                <td className={COL.rating}>
                  {row.rating_value != null ? (
                    <span className="tournament-table-rating-value">
                      <span className="table-number">{row.rating_value}</span>
                      {row.rating_delta != null && (
                        <span
                          className={`tournament-table-rating-delta ${
                            row.rating_delta > 0 ? 'is-up' : row.rating_delta < 0 ? 'is-down' : 'is-flat'
                          }`}
                        >
                          {row.rating_delta > 0 ? '↑' : row.rating_delta < 0 ? '↓' : '→'}{' '}
                          {Math.abs(row.rating_delta)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="table-number muted">—</span>
                  )}
                </td>
                <td className={COL.stat}>
                  <span className="table-number">{row.totalPoints ?? 0}</span>
                </td>
                <td className={COL.stat}>
                  <span className="table-number">
                    {row.totalKills}
                    {row.killsCoverage.totalMatches > 0 &&
                      row.killsCoverage.trackedMatches < row.killsCoverage.totalMatches && (
                        <span className="coverage-badge" title={row.killsCoverage.label}>!</span>
                      )}
                  </span>
                </td>
                <td className={COL.stat}>
                  <span className="table-number">{row.matchesPlayed ?? 0}</span>
                </td>
                <td className={COL.action}>
                  {getTeamLink(row.name, row.players) && (
                    <Link className="table-action" to={getTeamLink(row.name, row.players)}>→</Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default TournamentTable;
