exports.up = function(knex) {
  return knex.schema.createTable('player_dna_rating_history', (table) => {
    table.increments('id');
    table.string('player_id').notNullable().index();
    table.string('season_id').notNullable().index();
    table.dateTime('occurred_at').notNullable();
    table.float('rating').notNullable();
    table.integer('match_ref').nullable();
    table.string('tournament_id').nullable();
    table.index(['player_id', 'season_id', 'occurred_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('player_dna_rating_history');
};
