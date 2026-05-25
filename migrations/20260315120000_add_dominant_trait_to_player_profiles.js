exports.up = function (knex) {
  return knex.schema.alterTable('player_profiles', (table) => {
    table.string('dominant_trait', 32).nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('player_profiles', (table) => {
    table.dropColumn('dominant_trait');
  });
};
