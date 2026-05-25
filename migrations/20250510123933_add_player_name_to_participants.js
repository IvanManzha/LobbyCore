// migrations/20250510123933_add_player_name_to_participants.js

exports.up = function(knex) {
    return knex.schema.alterTable('participants', table => {
      table.string('player_name').index(); // убрали notNullable()
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.alterTable('participants', table => {
      table.dropColumn('player_name');
    });
  };
  