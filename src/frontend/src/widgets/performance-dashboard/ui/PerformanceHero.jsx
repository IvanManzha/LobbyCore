import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTournamentDate } from '@/entities/player';
import './PerformanceHero.css';

function getPlaceTone(placement) {
  if (placement == null) return 'muted';
  if (placement >= 1 && placement <= 3) return 'good';
  if (placement >= 4 && placement <= 10) return 'neutral';
  return 'bad';
}

function formatNumber(value, digits = 0) {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

function getModeLabel(mode) {
  const value = (mode || '').toLowerCase();
  if (value === 'solo') return 'solo';
  if (value === 'duo') return 'duo';
  if (value === 'squad') return 'squad';
  if (value === 'mixed') return 'mixed';
  return value || null;
}

function buildSummaryText({ name, tournament, summary, highlights }) {
  const lines = [];
  const headerParts = [];
  if (name) headerParts.push(name);
  if (tournament?.name) headerParts.push(tournament.name);
  if (headerParts.length) {
    lines.push(headerParts.join(' — '));
  }

  const coreParts = [];
  if (summary?.rank != null) coreParts.push(`Place: ${summary.rank}`);
  coreParts.push(`Points: ${formatNumber(summary?.totalPoints || 0)}`);
  if (summary?.totalKills != null) {
    coreParts.push(`Kills: ${formatNumber(summary.totalKills)}`);
  }
  if (summary?.avgPlace != null) {
    coreParts.push(`Avg place: ${formatNumber(summary.avgPlace, 1)}`);
  }
  if (coreParts.length) {
    lines.push(coreParts.join(' | '));
  }

  if (highlights?.bestMatch) {
    const m = highlights.bestMatch;
    lines.push(
      `Best match: M${m.matchIndex} (points: ${m.points ?? '—'}, kills: ${
        m.kills ?? '—'
      }, place: ${m.placement ?? '—'})`
    );
  }

  if (highlights?.mvp) {
    lines.push(`MVP: ${highlights.mvp.playerName} (${highlights.mvp.totalKills} kills)`);
  }

  return lines.join('\n');
}

function PerformanceHero({
  type,
  name,
  tournament,
  summary,
  matchResults,
  formDots,
  highlights,
  onMatchHover,
  onMatchSelect
}) {
  const tournamentId = tournament?.id || tournament?._id;
  const modeLabel = getModeLabel(tournament?.type);
  const [copied, setCopied] = useState(false);

  const handleCopySummary = () => {
    const text = buildSummaryText({ name, tournament, summary, highlights });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        })
        .catch(() => {
          // проглатываем ошибку, т.к. это необязательное действие
        });
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  const handleExportCsv = () => {
    if (!Array.isArray(matchResults) || matchResults.length === 0) return;
    const header = 'match,place,kills,points\n';
    const rows = matchResults
      .map((m) =>
        [
          m.matchIndex,
          m.placement ?? '',
          m.kills ?? '',
          m.points ?? ''
        ].join(',')
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'performance'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="performance-hero">
      <div className="performance-hero-top">
        <div className="performance-hero-left">
          <Link
            to={tournamentId ? `/tournament/${tournamentId}` : '#'}
            className="back-link"
          >
            ← Назад к турниру
          </Link>

          <div className="performance-title-block">
            <div className="performance-title-row">
              {type === 'player' ? (
                <h1>
                  <Link
                    to={name ? `/player/${encodeURIComponent(name)}` : '#'}
                    className="performance-player-link"
                  >
                    {name}
                  </Link>
                </h1>
              ) : (
                <h1>{name}</h1>
              )}
            </div>
            <div className="performance-subtitle-row">
              {tournament && (
                <>
                  <span className="performance-subtitle-main">
                    {tournament.name || 'Турнир'}
                  </span>
                  {modeLabel && (
                    <>
                      <span className="performance-dot">·</span>
                      <span className="performance-subtitle-secondary">
                        {modeLabel}
                      </span>
                    </>
                  )}
                  {tournament.date && (
                    <>
                      <span className="performance-dot">·</span>
                      <span className="performance-subtitle-secondary">
                        {formatTournamentDate(tournament.date)}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="performance-hero-right">
          <div className="performance-hero-summary">
            <div className="summary-kpi">
              <div className="summary-label">Место</div>
              <div className="summary-value table-number">
                {summary?.rank != null ? summary.rank : '—'}
              </div>
            </div>
            <div className="summary-kpi">
              <div className="summary-label">Очки</div>
              <div className="summary-value table-number">
                {formatNumber(summary?.totalPoints || 0)}
              </div>
            </div>
            <div className="summary-kpi">
              <div className="summary-label">Киллы</div>
              <div className="summary-value table-number">
                {summary?.totalKills != null
                  ? formatNumber(summary.totalKills)
                  : '—'}
              </div>
            </div>
            <div className="summary-kpi">
              <div className="summary-label">Среднее место</div>
              <div className="summary-value table-number">
                {summary?.avgPlace != null
                  ? formatNumber(summary.avgPlace, 1)
                  : '—'}
              </div>
            </div>
          </div>
          <div className="performance-actions">
            <button
              type="button"
              className="btn btn-primary performance-action-main"
              onClick={handleCopySummary}
              title="Скопирует итог в буфер обмена"
            >
              Скопировать итог
            </button>
            <button
              type="button"
              className="btn btn-secondary performance-action-secondary"
              onClick={handleShare}
              title="Скопировать ссылку на этот экран"
            >
              Поделиться
            </button>
            <button
              type="button"
              className="btn btn-ghost performance-action-ghost"
              onClick={handleExportCsv}
              title="Скачать таблицу матчей в CSV"
            >
              Экспорт CSV
            </button>
          </div>
          {copied && (
            <div className="performance-toast">
              Скопировано
            </div>
          )}
        </div>
      </div>

      {Array.isArray(formDots) && formDots.length > 0 && (
        <div className="performance-form-wrapper">
          <div
            className={
              'performance-form-strip' +
              (formDots.length <= 3 ? ' performance-form-strip-compact' : '')
            }
            aria-label="Форма по матчам"
          >
            {formDots.map((dot) => {
              const tone = getPlaceTone(dot.placement);
              const labelParts = [];
              labelParts.push(`Матч ${dot.matchIndex}`);
              if (dot.placement != null) {
                labelParts.push(`место ${dot.placement}`);
              } else {
                labelParts.push('место —');
              }
              if (dot.kills != null) {
                labelParts.push(`киллы ${dot.kills}`);
              } else {
                labelParts.push('киллы —');
              }
              if (dot.points != null) {
                labelParts.push(`очки ${dot.points}`);
              } else {
                labelParts.push('очки —');
              }

              return (
                <button
                  key={dot.matchIndex}
                  type="button"
                  className={`form-chip form-chip-${tone}`}
                  onMouseEnter={() =>
                    onMatchHover && onMatchHover(dot.matchIndex)
                  }
                  onMouseLeave={() =>
                    onMatchHover && onMatchHover(null)
                  }
                  onClick={() =>
                    onMatchSelect && onMatchSelect(dot.matchIndex)
                  }
                  title={labelParts.join(' · ')}
                >
                  <span className="form-chip-dot" />
                </button>
              );
            })}
          </div>
          <div className="performance-form-legend">
            <span className="legend-item">
              <span className="legend-dot legend-dot-good" />
              <span className="legend-label">1–3</span>
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-dot-neutral" />
              <span className="legend-label">4–10</span>
            </span>
            <span className="legend-item">
              <span className="legend-dot legend-dot-bad" />
              <span className="legend-label">11+</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default PerformanceHero;

