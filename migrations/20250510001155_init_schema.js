exports.up = function(knex) {
    return knex.schema
      .createTable('matches', table => {
        table.increments('id');
        table.string('match_id').unique().notNullable();
        table.string('shard').notNullable().defaultTo('steam');
        table.string('map_name').notNullable();
        table.timestamp('played_at').notNullable();
        table.json('telemetry').nullable();
        table.boolean('processed').defaultTo(false);
      })
      .createTable('participants', table => {
        table.increments('id');
        table.integer('match_ref').references('id').inTable('matches').onDelete('CASCADE');
        table.string('player_id').notNullable();
        table.string('team_id');
        table.integer('kills').notNullable();
        table.float('damage').notNullable();
        table.integer('placement').notNullable();
        table.json('stats');
      })
      .createTable('telemetry_events', table => {
        table.increments('id');
        table.integer('participant_ref').references('id').inTable('participants').onDelete('CASCADE');
        table.float('event_time').notNullable();
        table.string('event_type').notNullable();
        table.json('event_data').notNullable();
      });
  };
  
  exports.down = function(knex) {
    return knex.schema
      .dropTableIfExists('telemetry_events')
      .dropTableIfExists('participants')
      .dropTableIfExists('matches');
  };
  