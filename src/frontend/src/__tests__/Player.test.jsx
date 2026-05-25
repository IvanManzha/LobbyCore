import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Player from '../pages/Player';

const mockGetProfile = vi.fn();
const mockGetAvailableYears = vi.fn();
const mockGetStats = vi.fn();
const mockGetAll = vi.fn();

vi.mock('../components/PlayerCharts', () => ({
  default: () => <div>Charts</div>
}));

vi.mock('../services/api', () => ({
  playerApi: {
    getProfile: (...args) => mockGetProfile(...args),
    getAvailableYears: (...args) => mockGetAvailableYears(...args),
    getStats: (...args) => mockGetStats(...args)
  },
  tournamentApi: {
    getAll: (...args) => mockGetAll(...args)
  },
  getProfile: () => null,
  getToken: () => null,
  isAuthenticated: () => false
}));

describe('Player', () => {
  beforeEach(() => {
    mockGetProfile.mockResolvedValue({
      name: 'PlayerOne',
      history: [
        {
          tournamentId: 't1',
          tournamentName: 'Winter Cup',
          date: '2026-01-10',
          place: 2,
          points: 40,
          personalKills: 5
        }
      ]
    });
    mockGetAvailableYears.mockResolvedValue(['2026']);
    mockGetStats.mockResolvedValue({
      core: [
        { id: 'rating', displayValue: '120' },
        { id: 'matches_played', displayValue: '1' }
      ],
      secondary: [],
      coverage: {
        kills: { trackedMatches: 1, totalMatches: 1, label: 'Kills tracked: 1/1' },
        deaths: { trackedMatches: 0, totalMatches: 0, label: '' },
        kd: { trackedMatches: 0, totalMatches: 0, label: '' }
      },
      formLast5: { items: [] },
      ratingBreakdown: null,
      meta: { scope: 'year', year: '2026', modeFilter: 'all', matchesPlayed: 1, tournamentsPlayed: 1, tournamentsCompleted: 1, hasData: true }
    });
    mockGetAll.mockResolvedValue([{ id: 't1', state: 'Турнир окончен' }]);
  });

  it('показывает профиль и историю турниров', async () => {
    render(
      <MemoryRouter initialEntries={['/player/PlayerOne']}>
        <Routes>
          <Route path="/player/:name" element={<Player />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'PlayerOne' })).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Турниры' })).toBeInTheDocument();
    expect(screen.getByText('Winter Cup')).toBeInTheDocument();
  });
});
