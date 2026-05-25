exports.up = function(knex) {
    return knex.schema.alterTable('participants', table => {
      table.string('api_name').nullable().after('player_id'); 
      // .after() сработает в MySQL/Postgres, в SQLite он игнорируется, но порядок не критичен
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.alterTable('participants', table => {
      table.dropColumn('api_name');
    });
  };
  