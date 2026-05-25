exports.up = function (knex) {
  return knex.schema
    .createTable('dna_profiles', (table) => {
      table.string('season_id').notNullable();
      table.string('player_id').notNullable();
      table.integer('core_score').nullable();
      table.text('data').notNullable();
      table.timestamp('last_updated').nullable();
      table.timestamp('last_updated_v3').nullable();
      table.primary(['season_id', 'player_id']);
    })
    .createTable('dna_baselines', (table) => {
      table.string('season_id').primary();
      table.text('data').notNullable();
      table.timestamp('updated_at').nullable();
    })
    .createTable('dna_pool_stats', (table) => {
      table.string('season_id').notNullable();
      table.string('gene_key').notNullable();
      table.float('median').notNullable();
      table.float('mad').notNullable();
      table.timestamp('updated_at').nullable();
      table.primary(['season_id', 'gene_key']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('dna_pool_stats')
    .dropTableIfExists('dna_baselines')
    .dropTableIfExists('dna_profiles');
};
