import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import './TournamentTable.css';
import DnaTierBadge from "./dna-lab/DnaTierBadge";

function TournamentTable({ table, tournamentId: propTournamentId, tournament, status = '', myRegistration = null }) {
  const [expandedRegRow, setExpandedRegRow] = useState(null);

  if (!table || !table.teams) {
    return <div className="muted">Нет данных</div>;
  }

  const { id: urlTournamentId } = useParams();
  const tournamentId = propTournamentId || urlTournamentId || table.tournament?.id || table.tournament?._id;
  const tournamentType = table.tournament?.type || 'solo';
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

  const getTeamLink = (teamName) => {
    // Если нет ID турнира, не создаем ссылку
    if (!tournamentId) {
      return null;
    }
    
    if (tournamentType === 'solo') {
      // Для соло турниров используем отдельную страницу
      return `/tournament/${tournamentId}/solo/${encodeURIComponent(teamName)}`;
    }
    
    // Для командных турниров используем страницу команды
    return `/tournament/${tournamentId}/team/${encodeURIComponent(teamName)}`;
  };

  const renderTeamName = (team) => {
    const teamLink = getTeamLink(team.name);
    
    // Если это команда с несколькими игроками - показываем название команды как ссылку, а игроков отдельно
    if (team.players && team.players.length > 1) {
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
                <Link to={`/player/${encodeURIComponent(player)}`}>
                  {player}
                </Link>
                {idx < team.players.length - 1 && ', '}
              </React.Fragment>
            ))}
            {')'}
          </span>
        </div>
      );
    }
    
    // Иначе просто ссылка на команду/игрока
    if (teamLink) {
      return (
        <Link to={teamLink}>
          {team.name}
        </Link>
      );
    }
    // Если ссылка не может быть создана (нет ID турнира), показываем просто текст
    return <span>{team.name}</span>;
  };

  const leaderboardRows = useMemo(() => {
    // Строим строки лидерборда сами по данным из table.teams,
    // чтобы форма данных всегда точно соответствовала колонкам таблицы.
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
          label: `Kills tracked: ${killsTracked}/${matchesPlayed}`
        },
        totalRating: team.totalRating ?? null,
        budget: team.budget,
        ladder_rank_label: team.ladder_rank_label ?? null,
        dominant_trait: team.dominant_trait ?? null,
        dna_tier: team.dna_tier ?? null,
        rating_value: team.rating_value ?? null,
        rating_delta: team.rating_delta ?? null
      };
    })
      // Сортируем по месту (rank) по возрастанию, null/undefined в конец
      .sort((a, b) => {
        if (a.rank == null && b.rank == null) return 0;
        if (a.rank == null) return 1;
        if (b.rank == null) return -1;
        return a.rank - b.rank;
      });
  }, [table]);

  // Режим регистрации: №, Команда/участник (с раскрытием состава), Рейтинг, Оплата
  if (isReg) {
    const paidCount = (row) => getPaidCount(row.name);
    return (
      <div className="tournament-table tournament-table--reg">
        <table className="table-premium">
          <thead>
            <tr>
              <th>№</th>
              <th>Команда / участник</th>
              <th>Рейтинг</th>
              {entryFeeDC > 0 && <th>Оплата</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {leaderboardRows.map((row) => {
              const team = table.teams.find((t) => t.name === row.name) || row;
              const hasRoster = row.players && row.players.length > 1;
              const isExpanded = expandedRegRow === row.name;
              const isParticipant = myRegistration && (row.name || '').trim() === (myRegistration.teamName || '').trim();
              const paid = paidCount(row);
              return (
                <React.Fragment key={row.name}>
                  <tr
                    className={[
                      hasRoster ? 'tournament-table__row--expandable' : '',
                      isParticipant ? 'row--participant' : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => hasRoster && setExpandedRegRow(isExpanded ? null : row.name)}
                  >
                    <td>
                      <span className="table-number">{row.rank ?? '—'}</span>
                    </td>
                    <td>
                      <div className="tournament-table__team-cell">
                        {hasRoster && (
                          <span className="tournament-table__expand-icon">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        )}
                        {hasRoster ? (
                          <Link to={getTeamLink(row.name) || '#'} onClick={(e) => e.stopPropagation()}>
                            {row.name}
                          </Link>
                        ) : (
                          renderTeamName({ name: row.name, players: row.players })
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="table-number">
                        {row.totalRating != null ? row.totalRating : '—'}
                      </span>
                    </td>
                    {entryFeeDC > 0 && (
                      <td>
                        {paid ? (
                          <span className="tournament-table__paid-count">{paid.paid}/{paid.total}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    <td>
                      {getTeamLink(row.name) && (
                        <Link className="table-action" to={getTeamLink(row.name)} onClick={(e) => e.stopPropagation()}>
                          →
                        </Link>
                      )}
                    </td>
                  </tr>
                  {hasRoster && isExpanded && (
                    <tr key={`${row.name}-roster`} className="tournament-table__roster-row">
                      <td colSpan={entryFeeDC > 0 ? 5 : 4}>
                        <div className="tournament-table__roster">
                          <div className="tournament-table__roster-title">Состав</div>
                          <ul className="tournament-table__roster-list">
                            {(row.players || []).map((player, idx) => (
                              <li key={idx}>
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
    );
  }

  // Завершённые и в процессе: Rank, Команда, Archetype (solo), Рейтинг (число + дельта), очки, киллы, матчи
  return (
    <div className="tournament-table">
      <table className="table-premium">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Команда</th>
            {isSoloTournament && <th>Archetype</th>}
            <th>Рейтинг</th>
            <th>Очки</th>
            <th>Киллы</th>
            <th>Матчи</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {leaderboardRows.map((row) => {
            const isParticipant = myRegistration && (row.name || '').trim() === (myRegistration.teamName || '').trim();
            return (
            <tr key={row.name} className={isParticipant ? 'row--participant' : ''}>
              <td>
                <span className="table-number">{row.rank ?? '—'}</span>
              </td>
              <td>{renderTeamName({ name: row.name, players: row.players })}</td>
              {isSoloTournament && (
                <td>
                  <span className="tournament-table-archetype">
                    {row.dominant_trait || '—'}
                    {row.dna_tier != null && (
                      <span className="tournament-table-dna-tier">
                        <DnaTierBadge tier={row.dna_tier} />
                      </span>
                    )}
                  </span>
                </td>
              )}
              <td>
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
              <td>
                <span className="table-number">{row.totalPoints ?? 0}</span>
              </td>
              <td>
                <span className="table-number">
                  {row.totalKills}
                  {row.killsCoverage.totalMatches > 0 &&
                    row.killsCoverage.trackedMatches <
                      row.killsCoverage.totalMatches && (
                      <span
                        className="coverage-badge"
                        title={row.killsCoverage.label}
                      >
                        !
                      </span>
                    )}
                </span>
              </td>
              <td>
                <span className="table-number">{row.matchesPlayed ?? 0}</span>
              </td>
              <td>
                {getTeamLink(row.name) && (
                  <Link className="table-action" to={getTeamLink(row.name)}>
                    →
                  </Link>
                )}
              </td>
            </tr>
          );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default TournamentTable;

