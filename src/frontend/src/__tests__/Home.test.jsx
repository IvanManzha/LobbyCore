import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../pages/Home';

const mockGetActive = vi.fn();
const mockGetAll = vi.fn();
const mockGetTable = vi.fn();
const mockGetAvailableYears = vi.fn();
const mockGetStats = vi.fn();
const mockGetProfile = vi.fn();
const mockSubscribe = vi.fn(() => () => {});

vi.mock('../services/api', () => ({
  tournamentApi: {
    getActive: (...args) => mockGetActive(...args),
    getAll: (...args) => mockGetAll(...args),
    getTable: (...args) => mockGetTable(...args)
  },
  playerApi: {
    getAvailableYears: (...args) => mockGetAvailableYears(...args),
    getStats: (...args) => mockGetStats(...args),
    getProfile: (...args) => mockGetProfile(...args),
    verifyToken: () => Promise.resolve({
      profile: { name: 'PlayerOne', history: [{ date: '2026-01-10' }] }
    })
  },
  getProfile: () => ({ name: 'PlayerOne', history: [{ date: '2026-01-10' }] }),
  getToken: () => 'token',
  isAuthenticated: () => true,
  subscribeToUpdates: (...args) => mockSubscribe(...args)
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      username: 'PlayerOne',
      pubgNick: 'PlayerOne',
      name: 'PlayerOne',
      history: [{ date: '2026-01-10' }]
    },
    isAuthenticated: true
  })
}));

describe('Home', () => {
  beforeEach(() => {
    mockGetActive.mockRejectedValue(new Error('no active'));
    mockGetAll.mockResolvedValue([
      { id: 't1', name: 'Winter Cup', date: '2026-01-10', type: 'squad', state: 'Турнир окончен' }
    ]);
    mockGetTable.mockResolvedValue({
      tournament: { id: 't1', name: 'Winter Cup', state: 'Турнир окончен' },
      teams: [
        { name: 'Team A', rank: 1, totalPoints: 100, results: [{ kills: 5 }, { kills: 3 }] },
        { name: 'Team B', rank: 2, totalPoints: 80, results: [{ kills: 2 }, { kills: 4 }] }
      ]
    });
    mockGetProfile.mockResolvedValue({ name: 'PlayerOne', history: [{ tournamentId: 't1', place: 2, points: 80 }] });
    mockGetAvailableYears.mockResolvedValue(['2026']);
    mockGetStats.mockResolvedValue({
      core: [
        { id: 'rating', displayValue: '120' },
        { id: 'winrate', displayValue: '50%' },
        { id: 'kills_per_match', displayValue: '2.5' },
        { id: 'top_rate', label: 'Top-3', displayValue: '30%' },
        { id: 'matches_played', displayValue: '2' }
      ],
      coverage: {
        kills: { trackedMatches: 1, totalMatches: 2, label: 'Kills tracked: 1/2' },
        deaths: { trackedMatches: 0, totalMatches: 0, label: '' },
        kd: { trackedMatches: 0, totalMatches: 0, label: '' }
      },
      formLast5: { items: [] },
      ratingBreakdown: null,
      meta: { scope: 'year', year: '2026', modeFilter: 'all', matchesPlayed: 2, tournamentsPlayed: 1, tournamentsCompleted: 1, hasData: true }
    });
  });

  it('показывает сводку игрока и coverage', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetStats).toHaveBeenCalledWith('PlayerOne', '2026'));
    await screen.findByText('Сейчас нет активного турнира');
    await screen.findByRole('heading', { name: 'Последние турниры' });
    await screen.findByTitle('Kills tracked: 1/2');
  });
});
