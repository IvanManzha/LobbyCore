// lib/profileDb.js
async function upsertProfileStats(profile) {
    // profile может содержать любые из новых полей
    const insert = {
      player_id:      profile.player_id,
      player_name:    profile.player_name,
      total_matches:  profile.total_matches,
      total_kills:    profile.total_kills,
      avg_kills:      profile.avg_kills,
      total_wins:     profile.total_wins,
      top10_finishes: profile.top10_finishes,
      avg_damage:     profile.avg_damage,
      total_assists:  profile.total_assists,
  
      // новые поля
      averagePlacement: profile.averagePlacement,
      averageKills:     profile.averageKills,
      averageDamage:    profile.averageDamage,
      percentTop1:      profile.percentTop1,
      percentTop3:      profile.percentTop3,
  
      metric_intellect:    profile.metric_intellect,
      metric_shooting:     profile.metric_shooting,
      metric_aggression:   profile.metric_aggression,
      metric_efficiency:   profile.metric_efficiency,
      metric_activity:     profile.metric_activity,
      metric_stability:    profile.metric_stability
    };
  
    const exists = await db('player_profiles')
      .where({ player_id: profile.player_id })
      .first('id');
    if (exists) {
      await db('player_profiles')
        .where({ player_id: profile.player_id })
        .update(insert);
    } else {
      await db('player_profiles').insert(insert);
    }
  }
  