// src/backend/routes/api.js
const express = require('express');
const TournamentController = require('../controllers/TournamentController');
const PlayerController = require('../controllers/PlayerController');
const PlayerCosmeticsController = require('../controllers/PlayerCosmeticsController');
const StatsController = require('../controllers/StatsController');
const MatchMonitorController = require('../controllers/MatchMonitorController');
const FeedController = require('../controllers/FeedController');
const AdminFeedController = require('../controllers/AdminFeedController');
const AdminTournamentController = require('../controllers/AdminTournamentController');
const AdminScenariosController = require('../controllers/AdminScenariosController');
const AdminToolsController = require('../controllers/AdminToolsController');
const AdminLogController = require('../controllers/AdminLogController');
const FinanceController = require('../controllers/FinanceController');
const SteamLinkRequestController = require('../controllers/SteamLinkRequestController');
const DnaController = require('../controllers/DnaController');
const PubgController = require('../controllers/PubgController');
const LadderController = require('../controllers/LadderController');
const { isAdmin, isBankir, requireDevData, isDeveloper } = require('../middleware/auth');
const { isDevDataMode } = require('../config/dataPaths');
const { verifyToken, optionalAuth } = require('../middleware/jwtAuth');
const {
  validateAddTeam,
  validateCreateTournament,
  validateUpdateTournament,
  validateLogin,
  validateRegister,
  validateUpdateProfile,
  validateRegisterTournament,
  validateCosmeticsLoadout
} = require('../middleware/validation');

const router = express.Router();

// Feed routes (публичные)
router.get('/feed', FeedController.getFeed.bind(FeedController));

// Ladder (турнирный рейтинг, публичный)
router.get('/ladder', LadderController.getLeaderboard.bind(LadderController));
router.post('/ladder/seasonal-reset', verifyToken, isAdmin, LadderController.runSeasonalReset.bind(LadderController));

// DNA routes (частично публичные; order: specific paths before :playerId)
router.get('/dna/seasons', DnaController.getSeasons.bind(DnaController));
router.get('/dna/dictionary', DnaController.getDictionary.bind(DnaController));
router.get('/dna/leaderboard', DnaController.getLeaderboard.bind(DnaController));
router.get('/dna/dna-test/last-match', DnaController.getDnaTestLastMatch.bind(DnaController));
router.get('/dna/dna-map/session', DnaController.getDnaMapSession.bind(DnaController));
router.get('/dna/dna-map/tournaments', DnaController.getDnaMapTournaments.bind(DnaController));
router.get('/dna/dna-map/tournaments/:tournamentId/matches', DnaController.getDnaMapTournamentMatches.bind(DnaController));

// PUBG feature store (запись — только админ)
router.post('/pubg/ingest', verifyToken, isAdmin, PubgController.postIngest.bind(PubgController));
router.get('/pubg/matches', PubgController.getMatches.bind(PubgController));
router.get('/pubg/match/:matchId/player/:accountId/features', PubgController.getPlayerFeatures.bind(PubgController));
router.get('/dna/match/:matchId/export', DnaController.exportMatchZip.bind(DnaController));
router.get('/dna/match/:matchId/map-data', DnaController.getMatchMapData.bind(DnaController));
router.post('/dna/ingest-match', verifyToken, isAdmin, DnaController.ingestMatch.bind(DnaController));
router.post('/dna/extract-features', verifyToken, isAdmin, DnaController.extractFeatures.bind(DnaController));
router.post('/dna/recompute', verifyToken, isAdmin, DnaController.recompute.bind(DnaController));
router.post('/dna/pipeline', verifyToken, isAdmin, DnaController.pipeline.bind(DnaController));
router.post('/dna/pipeline/retry', verifyToken, isAdmin, DnaController.pipelineRetry.bind(DnaController));
router.get('/dna/pipeline/:jobId', DnaController.getPipelineStatus.bind(DnaController));
// Sync genes из тестовой БД — только для авторизованных разработчиков
router.post(
  '/dna/sync-genes',
  verifyToken,
  isDeveloper,
  DnaController.syncGenes.bind(DnaController)
);
router.get('/dna/:playerId', DnaController.getProfile.bind(DnaController));

// Tournament routes (публичные)
router.get('/tournaments', TournamentController.getAllTournaments.bind(TournamentController));
router.get('/tournaments/active', TournamentController.getActiveTournament.bind(TournamentController));
router.get('/tournaments/:id/table', TournamentController.getTournamentTable.bind(TournamentController));
router.get('/tournaments/:id/leave-preview', verifyToken, FinanceController.leavePreview.bind(FinanceController));
router.get('/tournaments/:id', TournamentController.getTournamentById.bind(TournamentController));

// Tournament routes (требуют админ прав)
router.post('/tournaments', verifyToken, isAdmin, validateCreateTournament, TournamentController.createTournament.bind(TournamentController));
router.put('/tournaments/:id', verifyToken, isAdmin, validateUpdateTournament, TournamentController.updateTournament.bind(TournamentController));

// Tournament routes (требуют авторизации)
router.post('/tournaments/:id/teams', verifyToken, validateAddTeam, TournamentController.addTeam.bind(TournamentController));
router.delete('/tournaments/:id/teams/:teamName', verifyToken, TournamentController.removeTeam.bind(TournamentController));
router.post('/tournaments/:id/register', verifyToken, validateRegisterTournament, TournamentController.register.bind(TournamentController));
router.post('/tournaments/:id/withdraw-free-agent', verifyToken, TournamentController.withdrawFreeAgent.bind(TournamentController));
router.post('/tournaments/:id/pay-entry', verifyToken, FinanceController.payEntry.bind(FinanceController));
router.post('/tournaments/:id/pay-share', verifyToken, FinanceController.payShare.bind(FinanceController));
router.post('/tournaments/:id/leave', verifyToken, FinanceController.leave.bind(FinanceController));
router.post('/tournaments/:id/leaderboard/recalculate', verifyToken, isAdmin, TournamentController.recalculateLeaderboard.bind(TournamentController));

// Tournament routes (требуют админ прав)
router.post('/tournaments/:id/start', verifyToken, isAdmin, TournamentController.startTournament.bind(TournamentController));
router.post('/tournaments/:id/add-round', verifyToken, isAdmin, TournamentController.addRound.bind(TournamentController));
router.post('/tournaments/:id/close', verifyToken, isAdmin, TournamentController.closeTournament.bind(TournamentController));
router.post('/tournaments/:id/cancel', verifyToken, isAdmin, TournamentController.cancelTournament.bind(TournamentController));
router.delete('/tournaments/:id', verifyToken, isAdmin, TournamentController.deleteTournament.bind(TournamentController));

// Player routes — /players/me/* до /players/:name
router.get('/players/me/cosmetics', verifyToken, PlayerCosmeticsController.getMyCosmetics.bind(PlayerCosmeticsController));
router.put('/players/me/cosmetics', verifyToken, validateCosmeticsLoadout, PlayerCosmeticsController.updateMyCosmetics.bind(PlayerCosmeticsController));
router.get('/players/me', verifyToken, PlayerController.getCurrentUser.bind(PlayerController));
router.put('/players/me', verifyToken, validateUpdateProfile, PlayerController.updateProfile.bind(PlayerController));

// Player routes (публичные)
router.get('/players', PlayerController.getAllPlayers.bind(PlayerController));
router.get('/players/:name/cosmetics', PlayerCosmeticsController.getPlayerCosmetics.bind(PlayerCosmeticsController));
router.get('/players/:name', PlayerController.getPlayerProfile.bind(PlayerController));
router.get('/players/:name/stats', PlayerController.getPlayerStats.bind(PlayerController));
router.get('/players/:name/championships', PlayerController.getChampionships.bind(PlayerController));
router.get('/players/:name/years', PlayerController.getAvailableYears.bind(PlayerController));

// Auth routes (публичные)
router.post('/players/register', validateRegister, PlayerController.register.bind(PlayerController));
router.post('/players/login', validateLogin, PlayerController.login.bind(PlayerController));
router.post('/players/logout', PlayerController.logout.bind(PlayerController));
router.post('/players/verify-token', verifyToken, PlayerController.verifyToken.bind(PlayerController));

// Finance (DropCoins) — с авторизацией
// Steam link request (игрок создаёт запрос на привязку Steam к PUBG-профилю)
router.post('/steam-link-request', verifyToken, SteamLinkRequestController.createRequest.bind(SteamLinkRequestController));

router.get('/finance/wallet', verifyToken, FinanceController.getWallet.bind(FinanceController));
router.get('/finance/ledger', verifyToken, FinanceController.getLedger.bind(FinanceController));
router.get('/finance/topups', verifyToken, FinanceController.getMyTopups.bind(FinanceController));
router.get('/finance/cashouts', verifyToken, FinanceController.getMyCashouts.bind(FinanceController));
router.post('/finance/topup', verifyToken, FinanceController.createTopup.bind(FinanceController));
router.post('/finance/cashout/request', verifyToken, FinanceController.createCashout.bind(FinanceController));
router.post('/finance/transfer', verifyToken, FinanceController.transfer.bind(FinanceController));

// Protected routes (требуют авторизации) — /players/me перенесён выше

// Stats routes
router.post('/stats/recalculate-all', verifyToken, isAdmin, StatsController.recalculateAllRatings.bind(StatsController));
router.post('/stats/update-histories/:tournamentId', verifyToken, isAdmin, StatsController.updateHistories.bind(StatsController));
router.post('/stats/create-year-snapshot/:year', verifyToken, isAdmin, StatsController.createYearSnapshot.bind(StatsController));
router.post('/stats/recalculate/:playerId', verifyToken, isAdmin, StatsController.recalculatePlayerStats.bind(StatsController));
router.post('/stats/recalculate-all-stats', verifyToken, isAdmin, StatsController.recalculateAllPlayerStats.bind(StatsController));
router.post('/stats/rebuild-championships', verifyToken, isAdmin, StatsController.rebuildChampionships.bind(StatsController));
router.get('/stats/queue-status', verifyToken, isAdmin, StatsController.getQueueStatus.bind(StatsController));
router.get('/stats/percentile', StatsController.getPercentile.bind(StatsController));

// Match Monitor routes
router.get('/monitor/status', MatchMonitorController.status.bind(MatchMonitorController));
router.post('/monitor/start', verifyToken, (req, res, next) => {
  req.body.playerName = req.body.playerName || req.query.playerName;
  isAdmin(req, res, next);
}, MatchMonitorController.start.bind(MatchMonitorController));
router.post('/monitor/stop', verifyToken, (req, res, next) => {
  req.body.playerName = req.body.playerName || req.query.playerName;
  isAdmin(req, res, next);
}, MatchMonitorController.stop.bind(MatchMonitorController));
router.post('/monitor/check', verifyToken, (req, res, next) => {
  req.body.playerName = req.body.playerName || req.query.playerName;
  isAdmin(req, res, next);
}, MatchMonitorController.check.bind(MatchMonitorController));

// Admin Studio (verifyToken + isAdmin + requireDevData)
router.get('/admin/config', verifyToken, isAdmin, (req, res) => {
  res.json({ devDataMode: isDevDataMode() });
});
router.get('/admin/feed', verifyToken, isAdmin, requireDevData, AdminFeedController.getAll.bind(AdminFeedController));
router.post('/admin/feed', verifyToken, isAdmin, requireDevData, AdminFeedController.create.bind(AdminFeedController));
router.put('/admin/feed/:id', verifyToken, isAdmin, requireDevData, AdminFeedController.update.bind(AdminFeedController));
router.delete('/admin/feed/:id', verifyToken, isAdmin, requireDevData, AdminFeedController.delete.bind(AdminFeedController));

router.get('/admin/tournaments', verifyToken, isAdmin, requireDevData, AdminTournamentController.getAll.bind(AdminTournamentController));
router.get('/admin/tournaments/:id', verifyToken, isAdmin, requireDevData, AdminTournamentController.getById.bind(AdminTournamentController));
router.post('/admin/tournaments', verifyToken, isAdmin, requireDevData, AdminTournamentController.create.bind(AdminTournamentController));
router.put('/admin/tournaments/:id', verifyToken, isAdmin, requireDevData, AdminTournamentController.update.bind(AdminTournamentController));
router.post('/admin/tournaments/:id/status', verifyToken, isAdmin, requireDevData, AdminTournamentController.setStatus.bind(AdminTournamentController));

router.get('/admin/scenarios', verifyToken, isAdmin, requireDevData, AdminScenariosController.list.bind(AdminScenariosController));
router.post('/admin/scenarios/run', verifyToken, isAdmin, requireDevData, AdminScenariosController.run.bind(AdminScenariosController));

router.get('/admin/export', verifyToken, isAdmin, requireDevData, AdminToolsController.export.bind(AdminToolsController));
router.post('/admin/clear', verifyToken, isAdmin, requireDevData, AdminToolsController.clear.bind(AdminToolsController));

router.get('/admin/logs', verifyToken, isAdmin, requireDevData, AdminLogController.getLogs.bind(AdminLogController));

// Admin Finance — только для банкиров (BANKIR_USERS), без requireDevData
router.get('/admin/finance/topups', verifyToken, isBankir, FinanceController.listTopups.bind(FinanceController));
router.get('/admin/finance/cashouts', verifyToken, isBankir, FinanceController.listCashouts.bind(FinanceController));
router.post('/admin/finance/topup/:id/confirm', verifyToken, isBankir, FinanceController.confirmTopup.bind(FinanceController));
router.post('/admin/finance/topup/:id/reject', verifyToken, isBankir, FinanceController.rejectTopup.bind(FinanceController));
router.post('/admin/finance/cashout/:id/mark-paid', verifyToken, isBankir, FinanceController.markCashoutPaid.bind(FinanceController));
router.post('/admin/finance/cashout/:id/reject', verifyToken, isBankir, FinanceController.rejectCashout.bind(FinanceController));
router.post('/admin/finance/tournaments/:id/payout', verifyToken, isBankir, FinanceController.finalizePayout.bind(FinanceController));
router.get('/admin/finance/payout-batches', verifyToken, isBankir, FinanceController.listPayoutBatches.bind(FinanceController));
router.get('/admin/finance/payout-batches/:id', verifyToken, isBankir, FinanceController.getPayoutBatch.bind(FinanceController));
router.post('/admin/finance/payout-batches/:id/lines/:lineId/mark-paid', verifyToken, isBankir, FinanceController.markPayoutLinePaid.bind(FinanceController));
router.post('/admin/finance/payout-batches/:id/mark-all-paid', verifyToken, isBankir, FinanceController.markPayoutBatchAllPaid.bind(FinanceController));
router.get('/admin/finance/final-funds', verifyToken, isBankir, FinanceController.getFinalFunds.bind(FinanceController));
router.get('/admin/finance/reconcile/:tournamentId', verifyToken, isBankir, FinanceController.reconcileTournament.bind(FinanceController));

// Steam link requests — только админ (в том же разделе что и финансы)
router.get('/admin/steam-link-requests', verifyToken, isAdmin, SteamLinkRequestController.list.bind(SteamLinkRequestController));
router.post('/admin/steam-link-requests/:id/approve', verifyToken, isAdmin, SteamLinkRequestController.approve.bind(SteamLinkRequestController));
router.post('/admin/steam-link-requests/:id/reject', verifyToken, isAdmin, SteamLinkRequestController.reject.bind(SteamLinkRequestController));

module.exports = router;

