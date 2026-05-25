exports.up = function(knex) {
  return knex.schema
    .createTable('player_ladder', (table) => {
      table.increments('id');
      table.string('player_id').notNullable().index();
      table.string('season_id').notNullable().index();
      table.float('ladder_rating').notNullable().defaultTo(1200);
      table.string('ladder_rank_label', 32).nullable();
      table.string('last_tournament_id').nullable();
      table.float('last_delta').nullable();
      table.float('lifetime_best').nullable();
      table.float('previous_season_rating').nullable();
      table.dateTime('updated_at').notNullable();
      table.unique(['player_id', 'season_id']);
      table.index(['season_id', 'ladder_rating']);
    })
    .createTable('player_ladder_history', (table) => {
      table.increments('id');
      table.string('player_id').notNullable().index();
      table.string('tournament_id').notNullable().index();
      table.string('season_id').notNullable().index();
      table.float('ladder_before').notNullable();
      table.float('ladder_after').notNullable();
      table.float('delta').notNullable();
      table.float('actual_score').notNullable();
      table.float('expected_score').notNullable();
      table.float('bonus').nullable();
      table.dateTime('occurred_at').notNullable();
      table.index(['player_id', 'season_id', 'occurred_at']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('player_ladder_history')
    .dropTableIfExists('player_ladder');
};
