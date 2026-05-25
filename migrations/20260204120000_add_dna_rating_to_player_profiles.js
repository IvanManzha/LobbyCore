exports.up = function(knex) {
  return knex.schema.alterTable('player_profiles', table => {
    table.float('dna_rating').defaultTo(null);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('player_profiles', table => {
    table.dropColumn('dna_rating');
  });
};
