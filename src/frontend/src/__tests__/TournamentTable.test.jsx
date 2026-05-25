import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TournamentTable from '../components/TournamentTable';

describe('TournamentTable', () => {
  it('показывает пустое состояние', () => {
    render(
      <MemoryRouter>
        <TournamentTable table={null} />
      </MemoryRouter>
    );

    expect(screen.getByText('Нет данных')).toBeInTheDocument();
  });

  it('рендерит строки и бейдж coverage', () => {
    const table = {
      tournament: { id: 't1', type: 'squad', rounds: 2 },
      teams: [
        {
          rank: 1,
          name: 'Alpha',
          players: ['PlayerOne', 'PlayerTwo'],
          totalPoints: 40,
          results: [{ placement: 1, kills: 5 }, { placement: 2, kills: null }]
        }
      ]
    };

    render(
      <MemoryRouter>
        <TournamentTable table={table} tournamentId="t1" />
      </MemoryRouter>
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByTitle('Kills tracked: 1/2')).toBeInTheDocument();
  });
});
