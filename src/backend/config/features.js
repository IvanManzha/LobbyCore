const FeatureFlagsService = require('../services/FeatureFlagsService');

function isPlayerPlaquesEnabled() {
  return FeatureFlagsService.is('playerPlaques');
}

module.exports = {
  isPlayerPlaquesEnabled,
};
