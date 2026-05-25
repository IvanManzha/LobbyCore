// migrations/XXXXXXXX_add_efficient_rating_to_player_profiles.js
exports.up = function(knex) {
    return knex.schema.alterTable('player_profiles', table => {
      table.float('efficient_rating').notNullable().defaultTo(0);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.alterTable('player_profiles', table => {
      table.dropColumn('efficient_rating');
    });
  };
  