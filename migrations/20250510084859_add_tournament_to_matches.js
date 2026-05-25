exports.up = function(knex) {
    return knex.schema.alterTable('matches', table => {
      table.string('tournament_id').notNullable().index();
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.alterTable('matches', table => {
      table.dropColumn('tournament_id');
    });
  };
  