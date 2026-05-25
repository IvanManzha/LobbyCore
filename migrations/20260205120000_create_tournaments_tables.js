exports.up = function(knex) {
  return knex.schema
    .createTable('tournaments', table => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('date').notNullable();
      table.string('type').notNullable();
      table.string('state').notNullable();
      table.timestamp('start_at').nullable();
      table.integer('price').nullable();
      table.integer('rounds').notNullable().defaultTo(5);
      table.integer('played_rounds').notNullable().defaultTo(0);
      table.integer('barrier').nullable();
      table.text('rules').defaultTo('');
      table.json('rating_rules').nullable();
      table.json('registration').nullable();
      table.json('scoring').nullable();
      table.json('extra').nullable();
    })
    .createTable('tournament_teams', table => {
      table.increments('id').primary();
      table.string('tournament_id').notNullable().references('id').inTable('tournaments').onDelete('CASCADE');
      table.string('name').notNullable();
      table.integer('rank').notNullable().defaultTo(0);
      table.integer('total_points').notNullable().defaultTo(0);
      table.json('players').nullable();
      table.json('budget').nullable();
      table.json('results').nullable();
      table.json('player_kills').nullable();
      table.json('player_deaths').nullable();
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('tournament_teams')
    .dropTableIfExists('tournaments');
};
