import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/shared/ui';
import { PlayerPlaque } from '@/entities/player';
import './TournamentPlayers.css';
import './TournamentTable.css';
import {
  getParticipantPerformanceLink,
  isSoloLikeParticipant,
} from '../lib/participantDisplay';

const COL = {
  rank: 'tournament-table__col-rank',
  participant: 'tournament-table__col-participant',
  stat: 'tournament-table__col-stat',
  form: 'tournament-table__col-form',
  remove: 'tournament-table__col-remove',
};

function PlayersColGroup({ showRemoveCol }) {
  return (
    <colgroup>
      <col className={COL.rank} />
      <col className={COL.participant} />
      <col className={COL.stat} />
      <col className={COL.stat} />
      <col className={COL.stat} />
      <col className={COL.form} />
      {showRemoveCol && <col className={COL.remove} />}
    </colgroup>
  );
}

function FormTimeline({ form, onMatchClick }) {
  if (!form || form.length === 0) return null;

  return (
    <div className="form-timeline-wrapper">
      <div className="form-timeline-label">
        <span>Форма (место)</span>
      </div>
      <div className="form-timeline form-timeline--all-rounds">
        {form.map((match) => {
          const hasPlace = match.place != null;
          const bucket = hasPlace
            ? (match.place >= 1 && match.place <= 3
                ? 'good'
                : match.place >= 4 && match.place <= 10
                ? 'neutral'
                : 'bad')
            : 'empty';
          const tooltipText = hasPlace
            ? `Матч ${match.matchIndex}: место #${match.place}${match.points != null ? `, ${match.points} очков` : ''}${match.kills != null ? `, ${match.kills} киллов` : ''}`
            : `Матч ${match.matchIndex}: результат не внесён`;
          return (
            <div
              key={match.matchIndex}
              className={`form-tile ${bucket}`}
              title={tooltipText}
              onClick={(e) => {
                e.stopPropagation();
                if (onMatchClick) {
                  onMatchClick(match.matchIndex);
                }
              }}
            >
              <span className="form-tile-place">{hasPlace ? match.place : '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getEntityLink(tournamentId, tournamentType, entity) {
  return getParticipantPerformanceLink(
    tournamentId,
    tournamentType,
    entity.name,
    entity.players ?? entity.name,
  );
}

function TeamRow({ entity, tournamentId, tournamentType, isSolo, onFormMatchClick, onRemoveTeam, canRemove, isParticipant, entry, entryFeeDC }) {
  const [expanded, setExpanded] = useState(false);
  const hasPlayers = !isSoloLikeParticipant({ tournamentType, players: entity.players, name: entity.name })
    && entity.players
    && entity.players.length > 1;
  const members = entry?.members || (entry?.captainId ? [entry.captainId] : []);
  const memberPayments = entry?.memberPayments && typeof entry.memberPayments === 'object' ? entry.memberPayments : {};
  const paidMembers = entryFeeDC > 0 && members.length > 0
    ? members.filter((pid) => (memberPayments[pid] || 0) >= entryFeeDC).length
    : 0;
  const totalMembers = members.length || 0;
  const showPaidCount = entryFeeDC > 0 && totalMembers > 0;
  const entityLink = getEntityLink(tournamentId, tournamentType, entity);
  const showPlaque = isSoloLikeParticipant({
    tournamentType,
    players: entity.players,
    name: entity.name,
  });

  const paidBadge = showPaidCount ? (
    <span className="team-paid-badge" title="Оплатили взнос">
      {paidMembers}/{totalMembers}
    </span>
  ) : null;

  const nameCell = showPlaque ? (
    <td className="tournament-table__player-cell tournament-table__col-participant">
      <PlayerPlaque
        playerId={entity.name}
        displayName={entity.name}
        size="table"
        to={entityLink}
        trailing={paidBadge}
      />
    </td>
  ) : (
    <td className={COL.participant}>
      <span className="player-name-cell">
        <Link to={entityLink} className="player-name-link" onClick={(e) => e.stopPropagation()}>
          {entity.name}
        </Link>
        {paidBadge}
      </span>
    </td>
  );

  const handleRemove = (e) => {
    e.stopPropagation();
    if (!onRemoveTeam || !canRemove) return;
    if (!window.confirm(`Отменить регистрацию команды «${entity.name}»? Это действие нельзя отменить.`)) return;
    onRemoveTeam(entity.name);
  };

  if (showPlaque && isSolo) {
    return (
      <tr className={`player-row${isParticipant ? ' row--participant' : ''}`}>
        <td className={COL.rank}>
          <span className="table-number">
            {entity.rank != null ? entity.rank : '—'}
          </span>
        </td>
        {nameCell}
        <td className={COL.stat}>
          <span className="table-number">
            {entity.totalPoints != null ? entity.totalPoints : '—'}
          </span>
        </td>
        <td className={COL.stat}>
          <span className="table-number">
            {entity.totalKills != null ? entity.totalKills : '—'}
          </span>
        </td>
        <td className={COL.stat}>
          <span className="table-number">
            {entity.avgPlace != null ? entity.avgPlace.toFixed(1) : '—'}
          </span>
        </td>
        <td className={COL.form}>
          {entity.form && entity.form.length > 0 && (
            <FormTimeline form={entity.form} onMatchClick={onFormMatchClick} />
          )}
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr 
        className={`player-row${isParticipant ? ' row--participant' : ''}`}
        onClick={() => hasPlayers && setExpanded(!expanded)}
      >
        <td className={COL.rank}>
          <span className="table-number">
            {entity.rank != null ? entity.rank : '—'}
          </span>
        </td>
        {nameCell}
        <td className={COL.stat}>
          <span className="table-number">
            {entity.totalPoints != null ? entity.totalPoints : '—'}
          </span>
        </td>
        <td className={COL.stat}>
          <span className="table-number">
            {entity.totalKills != null ? entity.totalKills : '—'}
          </span>
        </td>
        <td className={COL.stat}>
          <span className="table-number">
            {entity.avgPlace != null ? entity.avgPlace.toFixed(1) : '—'}
          </span>
        </td>
        <td className={COL.form}>
          {entity.form && entity.form.length > 0 && (
            <FormTimeline form={entity.form} onMatchClick={onFormMatchClick} />
          )}
        </td>
        {onRemoveTeam && (
          <td className={COL.remove} onClick={(e) => e.stopPropagation()}>
            {canRemove && (
              <button
                type="button"
                className="tournament-remove-btn"
                onClick={handleRemove}
                title="Отменить регистрацию"
                aria-label="Отменить регистрацию"
              >
                ×
              </button>
            )}
          </td>
        )}
      </tr>
      {expanded && hasPlayers && (
        <tr className="player-row-expanded">
          <td colSpan={onRemoveTeam ? 7 : 6}>
            <div className="roster-breakdown">
              <div className="roster-title">Состав команды</div>
              <div className="roster-players">
                {entity.players.map((player, idx) => (
                  <div key={idx} className="roster-player">
                    <Link
                      to={`/player/${encodeURIComponent(player.name)}`}
                      className="player-name-link roster-player-name"
                    >
                      {player.name}
                    </Link>
                    <div className="roster-player-stats">
                      <div className="roster-stat">
                        <span className="roster-stat-label">Киллы:</span>
                        <span className="roster-stat-value">
                          {player.totalKills != null ? player.totalKills : '—'}
                        </span>
                      </div>
                      {player.avgKills != null && (
                        <div className="roster-stat">
                          <span className="roster-stat-label">Среднее:</span>
                          <span className="roster-stat-value">
                            {player.avgKills.toFixed(1)}
                          </span>
                        </div>
                      )}
                      {player.bestMatch && (
                        <div className="roster-stat">
                          <span className="roster-stat-label">Лучший матч:</span>
                          <span className="roster-stat-value">
                            М{player.bestMatch.matchIndex} ({player.bestMatch.kills} к.)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function TournamentPlayers({ entities = [], tournamentId, tournamentType, tournament, status, currentPlayerId, isAdmin, onAddResult, onFormMatchClick, onRemoveTeam }) {
  const isSolo = tournamentType === 'solo';

  if (entities.length === 0) {
    return (
      <div className="tournament-players">
        <EmptyState
          title="Список игроков недоступен"
          description="Данные появятся после добавления результатов."
          primaryAction={
            isAdmin ? (
              <button 
                className="btn btn-primary"
                onClick={() => onAddResult && onAddResult(1)}
              >
                Добавить результат
              </button>
            ) : null
          }
        />
      </div>
    );
  }

  const hasResults = entities.some(e => e.matchesPlayed > 0);

  if (!hasResults) {
    return (
      <div className="tournament-players">
        <EmptyState
          title="Список игроков появится после добавления результатов"
          description="Добавьте результаты матчей, чтобы увидеть статистику участников."
          primaryAction={
            isAdmin ? (
              <button 
                className="btn btn-primary"
                onClick={() => onAddResult && onAddResult(1)}
              >
                Добавить результат
              </button>
            ) : null
          }
        />
      </div>
    );
  }

  const showRemoveCol = !isSolo && Boolean(onRemoveTeam);

  return (
    <div className="tournament-players">
      <div className="players-header">
        <h2 className="players-title">
          {isSolo ? 'Игроки' : 'Команды'}
        </h2>
        <span className="players-count">
          {entities.length} {isSolo ? 'игроков' : 'команд'}
        </span>
      </div>

      <div className="players-table-view">
        <div className="table-shell">
          <table className="table-premium">
            <PlayersColGroup showRemoveCol={showRemoveCol} />
            <thead>
              <tr>
                <th className={COL.rank}>Место</th>
                <th className={COL.participant}>{isSolo ? 'Игрок' : 'Участник'}</th>
                <th className={COL.stat}>Очки</th>
                <th className={COL.stat}>Киллы</th>
                <th className={COL.stat}>Ср. место</th>
                <th className={COL.form}>
                  <span className="form-column-header">
                    Форма
                    <span className="form-column-hint" title="Показывает места в последних матчах">i</span>
                  </span>
                </th>
                {showRemoveCol && (
                  <th className={COL.remove} aria-label="Отменить регистрацию" />
                )}
              </tr>
            </thead>
            <tbody>
              {entities.map(entity => {
                const entry = tournament?.registration?.entries?.find(
                  (e) => e.kind === 'team' && (e.name || '').trim() === (entity.name || '').trim()
                );
                const currentKey = (currentPlayerId || '').toLowerCase();
                const isCaptainFromEntry = entry && (entry.captainId || '').toLowerCase() === currentKey;
                const firstPlayerKey = (entity.players?.[0] || '').toString().trim().toLowerCase();
                const isCaptainFallback = !entry && firstPlayerKey && firstPlayerKey === currentKey;
                const isCaptain = isCaptainFromEntry || isCaptainFallback;
                const canRemove = (isAdmin || (status === 'REG' && isCaptain));
                const isParticipant = currentKey
                  ? (isSolo
                    ? (entity.name || '').toString().trim().toLowerCase() === currentKey
                    : (entity.players || []).some((p) =>
                        (typeof p === 'string' ? p : p?.name ?? '').toString().trim().toLowerCase() === currentKey
                      ))
                  : false;
                const entryFeeDC = tournament?.finance?.entryFeeDC ?? tournament?.extra?.finance?.entryFeeDC ?? 0;
                return (
                  <TeamRow
                    key={entity.entityId}
                    entity={entity}
                    tournamentId={tournamentId}
                    tournamentType={tournamentType}
                    isSolo={isSolo}
                    onFormMatchClick={onFormMatchClick}
                    onRemoveTeam={onRemoveTeam}
                    canRemove={canRemove}
                    isParticipant={isParticipant}
                    entry={entry}
                    entryFeeDC={entryFeeDC}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TournamentPlayers;
