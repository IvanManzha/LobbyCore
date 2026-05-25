#!/usr/bin/env node
/*
 scripts/db_scripts/splitTelemetryAlternative.js

 Альтернативный скрипт разделения телеметрии на события,
 сразу вытягивает все поля, нужные для расчёта метрик,
 в том числе Resource Efficiency.
*/

require('dotenv').config()
const Knex = require('knex')
const knexConfig = require('../../knexfile')
const env = process.env.NODE_ENV || 'development'
const db = Knex(knexConfig[env])

await db.schema.hasTable('telemetry_events').then(async exists => {
  if (!exists) {
    console.log('→ Creating telemetry_events table...')
    await db.schema.createTable('telemetry_events', table => {
      table.increments('id')
      table.string('match_ref').notNullable()
      table.integer('participant_ref').nullable().references('id').inTable('participants')
      table.string('event_type').notNullable()
      table.text('event_time').notNullable()
      table.text('event_data').notNullable()
      table.integer('zone_phase').nullable()
      table.float('zone_center_x').nullable()
      table.float('zone_center_y').nullable()
      table.float('zone_radius').nullable()
      table.text('zone_start_time').nullable()
      table.string('item_name').nullable()
      table.float('damage').nullable()
      table.string('loot_item').nullable()
      table.integer('loot_count').nullable()
      table.integer('inCover').defaultTo(0)
    })
    console.log('→ telemetry_events table created.')
  }
})

// Все типы событий, которые мы хотим сохранять
const EVENT_TYPES = new Set([
  'LogPlayerPosition',
  'LogVehiclePosition',
  'LogParachuteLanding',
  'LogParachuteLeave',
  'LogGameStatePeriodic',
  'healEvent',
  'boostEvent',
  'LogPlayerTakeDamage',
  'LogItemPickup'
])

async function splitTelemetry() {
  // 1) Берём все матчи с непустой telemetry
  const matches = await db('matches')
    .select('id as matchId', 'telemetry')
    .whereNotNull('telemetry')

  console.log(`Found ${matches.length} matches`)

  for (const { matchId, telemetry } of matches) {
    console.log(`\nProcessing match ${matchId}`)

    // 2) Парсим JSON
    let events
    try {
      const payload = JSON.parse(telemetry)
      events = Array.isArray(payload.events)
        ? payload.events
        : Array.isArray(payload)
          ? payload
          : []
    } catch (err) {
      console.error(`✗ JSON parse error for match ${matchId}:`, err.message)
      continue
    }
    console.log(`  Raw events: ${events.length}`)

    // 3) Фильтрация и сбор полей
    const filtered = events.reduce((acc, evt) => {
      const type = evt._T || evt.eventType
      if (!EVENT_TYPES.has(type)) return acc

      const time = evt._D || evt.eventTime
      const name = evt.character?.name || null

      // общие поля зоны
      let zonePhase     = null
      let zoneCenterX   = null
      let zoneCenterY   = null
      let zoneRadius    = null
      let zoneStartTime = null

      if (type === 'LogGameStatePeriodic') {
        zonePhase     = evt.gamePhase ?? null
        zoneCenterX   = evt.safetyZonePosition?.x ?? null
        zoneCenterY   = evt.safetyZonePosition?.y ?? null
        zoneRadius    = evt.safetyZoneRadius ?? null
        zoneStartTime = time
      }

      // Resource Efficiency поля
      let itemName  = null      // для healEvent / boostEvent
      let damage    = null      // для LogPlayerTakeDamage
      let lootItem  = null      // для LogItemPickup
      let lootCount = null

      if (type === 'healEvent' || type === 'boostEvent') {
        itemName = evt.item?.itemId || evt.item || null
      }

      if (type === 'LogPlayerTakeDamage') {
        damage = evt.damageTaken ?? evt.damage ?? null
      }

      if (type === 'LogItemPickup') {
        lootItem  = evt.item?.category || null
        lootCount = evt.item?.count    ?? 1
      }

      acc.push({
        match_ref:       matchId,
        participant_ref: name,           // заменим на id ниже
        event_type:      type,
        event_time:      time,
        event_data:      JSON.stringify(evt),
        zone_phase:      zonePhase,
        zone_center_x:   zoneCenterX,
        zone_center_y:   zoneCenterY,
        zone_radius:     zoneRadius,
        zone_start_time: zoneStartTime,
        item_name:       itemName,
        damage:          damage,
        loot_item:       lootItem,
        loot_count:      lootCount
      })
      return acc
    }, [])

    console.log(`  Filtered events: ${filtered.length}`)
    if (!filtered.length) continue

    // 4) Сопоставляем player_name → participant_ref
    const parts = await db('participants')
      .where({ match_ref: matchId })
      .select('id','player_name')
    const nameToId = Object.fromEntries(parts.map(p => [p.player_name, p.id]))

    // 5) Устанавливаем правильный participant_ref вместо имени
    filtered.forEach(evt => {
      evt.participant_ref = nameToId[evt.participant_ref] || null
    })

    // 6) Вставляем в транзакции
    await db.transaction(async trx => {
      // удаляем старые
      const ids = parts.map(p => p.id)
      await trx('telemetry_events')
        .whereIn('participant_ref', ids)
        .del()

      // вставляем пакетами
      const chunkSize = 500
      for (let i = 0; i < filtered.length; i += chunkSize) {
        await trx('telemetry_events')
          .insert(filtered.slice(i, i + chunkSize))
      }
    })

    console.log(`  → Inserted ${filtered.length} rows for match ${matchId}`)
  }

  console.log('\n✅ Done.')
  await db.destroy()
}

splitTelemetry().catch(err => {
  console.error(err)
  process.exit(1)
})
