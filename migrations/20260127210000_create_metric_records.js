// migrations/20260127210000_create_metric_records.js
exports.up = function(knex) {
  return knex.schema.createTable('metric_records', table => {
    table.increments('id');
    table.string('metric_id').notNullable(); // 'avg_place', 'kills_per_match', 'winrate', etc.
    table.string('scope').notNullable(); // 'all_time', 'year:2026', etc.
    table.string('player_id').notNullable();
    table.float('value').notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Уникальный индекс на комбинацию metric_id, scope, player_id
    table.unique(['metric_id', 'scope', 'player_id']);
    
    // Индекс для быстрого поиска по metric_id и scope (для перцентилей)
    table.index(['metric_id', 'scope']);
    
    // Индекс для быстрого поиска по player_id
    table.index('player_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('metric_records');
};
