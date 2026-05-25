exports.up = function(knex) {
    return knex.schema.alterTable('player_profiles', table => {
      // Агрегаты по турнирам
      table.float('averagePlacement').defaultTo(null);
      table.float('averageKills').defaultTo(null);
      table.float('averageDamage').defaultTo(null);
      table.float('percentTop1').defaultTo(null);
      table.float('percentTop3').defaultTo(null);
  
      // «Шестиугольные» метрики
      table.float('metric_intellect').defaultTo(null);
      table.float('metric_shooting').defaultTo(null);
      table.float('metric_aggression').defaultTo(null);
      table.float('metric_efficiency').defaultTo(null);
      table.float('metric_activity').defaultTo(null);
      table.float('metric_stability').defaultTo(null);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.alterTable('player_profiles', table => {
      table.dropColumn('averagePlacement');
      table.dropColumn('averageKills');
      table.dropColumn('averageDamage');
      table.dropColumn('percentTop1');
      table.dropColumn('percentTop3');
  
      table.dropColumn('metric_intellect');
      table.dropColumn('metric_shooting');
      table.dropColumn('metric_aggression');
      table.dropColumn('metric_efficiency');
      table.dropColumn('metric_activity');
      table.dropColumn('metric_stability');
    });
  };
  