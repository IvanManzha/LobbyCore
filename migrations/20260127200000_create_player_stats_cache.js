// migrations/20260127200000_create_player_stats_cache.js
exports.up = function(knex) {
  return knex.schema.createTable('player_stats_cache', table => {
    table.increments('id');
    table.string('player_id').notNullable(); // username или pubgNick
    table.string('scope').notNullable(); // 'all_time', 'year', 'quarter'
    table.string('period').nullable(); // NULL для all_time, '2025' для года, '2025-Q1' для квартала
    table.text('stats').notNullable(); // JSON с PlayerStatsResponse
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Уникальный индекс на комбинацию player_id, scope, period
    table.unique(['player_id', 'scope', 'period']);
    
    // Индекс для быстрого поиска по player_id
    table.index('player_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('player_stats_cache');
};
