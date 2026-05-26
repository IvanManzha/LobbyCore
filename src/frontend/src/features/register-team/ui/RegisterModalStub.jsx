import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMode, formatFeedDate } from '@/entities/feed-post';
import './RegisterModalStub.css';

/**
 * Заглушка модалки регистрации на турнир
 * В Sprint 2 будет заменена на реальный registration flow
 * @param {Object} props
 * @param {Object} props.tournament - данные турнира
 * @param {Function} props.onClose - callback закрытия модалки
 */
function RegisterModalStub({ tournament, onClose }) {
  const navigate = useNavigate();

  const handleOpenTournament = () => {
    onClose();
    if (tournament?.id) {
      navigate(`/tournament/${tournament.id}`);
    } else {
      navigate('/tournaments');
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const mode = formatMode(tournament?.type || tournament?.mode);
  const date = formatFeedDate(tournament?.date);

  return (
    <div className="register-modal-overlay" onClick={handleOverlayClick}>
      <div className="register-modal">
        {/* Header */}
        <div className="register-modal__header">
          <h2 className="register-modal__title">Регистрация</h2>
          <button 
            className="register-modal__close btn btn-ghost"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path 
                d="M15 5L5 15M5 5L15 15" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Tournament Info */}
        <div className="register-modal__info">
          <h3 className="register-modal__tournament-name">
            {tournament?.name || 'Турнир'}
          </h3>
          <div className="register-modal__meta">
            {mode && (
              <span className="register-modal__chip">{mode}</span>
            )}
            {date && (
              <span className="register-modal__chip">{date}</span>
            )}
          </div>
        </div>

        {/* Message */}
        <div className="register-modal__message">
          <div className="register-modal__icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
              <path 
                d="M24 16V26M24 32H24.02" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="register-modal__text">
            Регистрация будет доступна скоро
          </p>
          <p className="register-modal__subtext">
            Следите за обновлениями в ленте
          </p>
        </div>

        {/* Actions */}
        <div className="register-modal__actions">
          <button 
            className="btn btn-secondary"
            onClick={onClose}
          >
            Закрыть
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleOpenTournament}
          >
            Открыть турнир
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegisterModalStub;
