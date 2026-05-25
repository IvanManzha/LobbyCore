// migrations/XXXXXXXX_create_player_profiles.js
exports.up = function(knex) {
    return knex.schema.createTable('player_profiles', table => {
      table.increments('id');
      table.string('player_id').notNullable().unique().index(); // UUID или ник
      table.string('player_name').notNullable();               // для удобного показа
      // Ваши кастомные поля:
      table.integer('total_matches').defaultTo(0);
      table.integer('total_kills').defaultTo(0);
      table.float('avg_kills').defaultTo(0);
      table.integer('total_wins').defaultTo(0);
      table.integer('top10_finishes').defaultTo(0);
      table.float('avg_damage').defaultTo(0);
      table.integer('total_assists').defaultTo(0);
      // любое другое, что нужно считать в профиле:
      // table.integer('headshot_count').defaultTo(0);
      // table.float('avg_survival_time').defaultTo(0);
  
      table.timestamps(true, true);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTableIfExists('player_profiles');
  };
  