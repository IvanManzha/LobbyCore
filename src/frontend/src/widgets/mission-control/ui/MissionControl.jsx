import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, StatusPill, Modal } from '@/shared/ui';
import { useTranslation } from '@/contexts/LanguageContext';
import { tournamentApi } from '@/services/api';
import './MissionControl.css';

function MissionControl({
  tournaments,
  activeTournament,
  isAdmin,
  getTournamentStatus,
  getTournamentId,
  canEditTournament,
  canDeleteTournament,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const hasTournaments = tournaments.length > 0;
  const completed = tournaments
    .filter((tItem) => tItem.state === 'Турнир окончен' || tItem.state === 'DONE')
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const lastCompleted = completed[0] || null;

  if (!hasTournaments) {
    return (
      <div className="panel mission-control mission-control-a">
        <EmptyState
          title={t('missionControl.emptyTitle')}
          description={t('missionControl.emptyDesc')}
          primaryAction={
            <Link className="btn btn-primary" to="/create">
              {t('nav.createTournament')}
            </Link>
          }
          footnote={t('missionControl.footnote')}
        />
      </div>
    );
  }

  if (!activeTournament) {
    return (
      <div className="panel mission-control mission-control-b">
        <h2 className="mission-control-title">{t('missionControl.noActive')}</h2>
        {lastCompleted && (
          <div className="mission-control-last">
            <span className="mission-control-last-label">{t('missionControl.lastFinishedLabel')}</span>
            <span className="mission-control-last-name">{lastCompleted.name}</span>
            <span className="mission-control-last-date">{lastCompleted.date}</span>
          </div>
        )}
        <div className="mission-control-actions">
          {lastCompleted && (
            <Link
              className="btn btn-primary"
              to={`/tournament/${getTournamentId(lastCompleted)}`}
            >
              {t('missionControl.openLast')}
            </Link>
          )}
          <Link className="btn btn-secondary" to="/tournaments">
            {t('missionControl.tournamentList')}
          </Link>
        </div>
      </div>
    );
  }

  const tournament = activeTournament.tournament;
  const teams = activeTournament.teams || [];
  const top3 = teams
    .slice()
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    .slice(0, 3);
  const rounds = tournament.rounds ?? 0;
  const played = tournament.playedRounds ?? 0;
  const status = getTournamentStatus(tournament);
  const tid = getTournamentId(tournament);

  const relevanceLabel =
    status === 'REG' ? t('missionControl.regOpen') : status === 'DONE' ? t('missionControl.lastFinished') : null;

  const canDelete = canDeleteTournament && (status === 'REG' || tournament.state === 'Турнир отменен');
  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    try {
      await tournamentApi.deleteTournament(tid);
      setDeleteModalOpen(false);
      navigate('/tournaments');
    } catch (err) {
      alert(err.response?.data?.error || err.message || t('missionControl.deleteError'));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
    <div className="panel mission-control mission-control-c">
      <div className="mission-control-top-row">
        {relevanceLabel && <span className="mission-control-relevance">{relevanceLabel}</span>}
        <StatusPill status={status} />
      </div>
      <div className="mission-control-header">
        <h2 className="mission-control-name">{tournament.name}</h2>
      </div>
      <div className="mission-control-meta">
        <span>{t('missionControl.date')}: {tournament.date}</span>
        <span>{t('missionControl.format')}: {tournament.type}</span>
        {rounds > 0 && (
          <span>
            {t('missionControl.matchesEntered')}: {played} / {rounds}
          </span>
        )}
      </div>
      {top3.length > 0 && (
        <div className="mission-control-top3">
          <span className="mission-control-top3-label">{t('missionControl.top3')}</span>
          {top3.map((team, idx) => (
            <span key={team.name || idx} className="mission-control-top3-item">
              {team.rank}. {team.name}
              {team.totalPoints != null ? ` (${team.totalPoints})` : ''}
            </span>
          ))}
        </div>
      )}
      <div className="mission-control-actions">
        <Link className="btn btn-primary" to={`/tournament/${tid}`}>
          {status === 'DONE' ? t('missionControl.results') : t('missionControl.openTournament')}
        </Link>
        {canEditTournament && (
          <Link className="btn btn-secondary" to={`/tournament/${tid}/edit`}>
            {t('missionControl.edit')}
          </Link>
        )}
        {canDelete && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setDeleteModalOpen(true)}
          >
            {t('missionControl.deleteTournament')}
          </button>
        )}
      </div>
    </div>
    {deleteModalOpen && (
      <Modal
        title={t('missionControl.deleteTournament')}
        onClose={() => !deleteLoading && setDeleteModalOpen(false)}
        actions={[
          <button key="cancel" className="btn btn-secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleteLoading}>
            {t('common.cancel')}
          </button>,
          <button key="delete" className="btn btn-primary" onClick={handleDeleteConfirm} disabled={deleteLoading}>
            {deleteLoading ? t('common.loading') : t('missionControl.deleteTournament')}
          </button>
        ]}
      >
        <p>{t('missionControl.deleteConfirm', { name: tournament.name })}</p>
      </Modal>
    )}
    </>
  );
}

export default MissionControl;
