/**
 * Mock DNA data.
 * Replace later with real API.
 */

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function round(n) {
  return Math.round(n);
}

function formatDateShort(d) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2,"0")}`;
}

export const GENES = [
  { key: "combat", label: "Combat", descriptionShort: "Overall combat impact: damage, hits, kills/knocks, low friendly fire." },
  { key: "pressure", label: "Pressure", descriptionShort: "Tempo & initiative: early contact, shooting, throwables, creating tension." },
  { key: "conversion", label: "Conversion", descriptionShort: "Turning contact into results: kills, knocks, damage efficiency." },
  { key: "survival", label: "Survival", descriptionShort: "Match depth: placement, time alive, living after first contact." },
  { key: "positioning", label: "Positioning", descriptionShort: "Spatial play: safe entry, avoiding early contact, not hotdrop fail." },
  { key: "recovery", label: "Recovery", descriptionShort: "Recovering after pressure: heals/boost after contact, recovery ratio." },
  { key: "teamwork", label: "Teamwork", descriptionShort: "Team value: assists, revives, kill participation, no friendly fire." },
];

const MATCH_NAMES = [
  "Hot Drop",
  "Ice Ridge",
  "Night Duo",
  "Storm Run",
  "Hill Control",
  "Last Circle",
  "Ghost Town",
  "Bridge Fight",
  "Blue Zone",
  "Sniper Nest",
];

export function createMockDnaProfile({
  playerId = "me",
  seasonId = "2026-02",
  matchCount = 18,
  seed = 1337,
} = {}) {
  const rng = mulberry32(seed);

  // Base genome (stable tendency) — 7 genes
  const base = {
    combat: 35 + rng() * 40,
    pressure: 35 + rng() * 40,
    conversion: 35 + rng() * 40,
    survival: 35 + rng() * 40,
    positioning: 35 + rng() * 40,
    recovery: 35 + rng() * 40,
    teamwork: 35 + rng() * 40,
  };

  const matches = [];
  const now = new Date();
  const start = new Date(now.getTime() - (matchCount - 1) * 24 * 60 * 60 * 1000);

  // A little storyline: player improves slowly
  const growth = 0.7 + rng() * 0.9;

  let totalKills = 0;
  let totalDamage = 0;
  let totalPlacement = 0;
  let wins = 0;

  for (let i = 0; i < matchCount; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);

    const tilt = (rng() - 0.5) * 12; // day mood
    const progress = (i / Math.max(1, matchCount - 1)) * 10 * growth;

    const geneValues = {};
    GENES.forEach((g) => {
      // small oscillation with progress
      const noise = (rng() - 0.5) * 18;
      const v = base[g.key] + progress + noise + tilt * 0.15;
      geneValues[g.key] = round(clamp(v, 5, 98));
    });

    // derive match summary from genes (just for believable demo)
    const combat = (geneValues.combat ?? 50) / 100;
    const survival = (geneValues.survival ?? 50) / 100;
    const positioning = (geneValues.positioning ?? 50) / 100;
    const conversion = (geneValues.conversion ?? 50) / 100;

    const kills = clamp(
      round(combat * 3.5 + conversion * 3.5 + (rng() - 0.35) * 4.0),
      0,
      12
    );

    const damage = clamp(
      round(kills * 110 + combat * 190 + (rng() - 0.45) * 260),
      0,
      1800
    );

    const placement = clamp(
      round(28 - (survival * 10 + positioning * 7) + (rng() - 0.4) * 10),
      1,
      30
    );

    const win = placement === 1 && rng() > 0.35;
    if (win) wins += 1;

    totalKills += kills;
    totalDamage += damage;
    totalPlacement += placement;

    const label = `${pick(rng, MATCH_NAMES)} #${i + 1}`;

    matches.push({
      id: `match_${String(i + 1).padStart(3, "0")}`,
      label,
      dateISO: d.toISOString(),
      dateShort: formatDateShort(d),
      summary: {
        kills,
        damage,
        placement,
        win,
      },
      geneValues,
    });
  }

  const avgKills = totalKills / matchCount;
  const avgDamage = totalDamage / matchCount;
  const avgPlace = totalPlacement / matchCount;

  // coreScore is just a nice-looking number here (replace later with real formula)
  const coreScore = round(
    clamp(
      avgKills * 85 + avgDamage * 0.55 + (30 - avgPlace) * 22 + wins * 95,
      0,
      3000
    )
  );

  // Aggregate genes (weighted toward recent matches)
  const genes = GENES.map((g) => {
    let wSum = 0;
    let vSum = 0;
    for (let i = 0; i < matches.length; i++) {
      const weight = 0.65 + i / matches.length; // later matches heavier
      wSum += weight;
      vSum += matches[i].geneValues[g.key] * weight;
    }
    const value = round(vSum / wSum);

    const recent = matches[matches.length - 1].geneValues[g.key];
    const prev = matches[matches.length - 2]?.geneValues[g.key] ?? recent;
    const trend = round(recent - prev);

    return { key: g.key, label: g.label, value, trend };
  });

  return {
    playerId,
    seasonId,
    coreScore,
    genes,
    matches,
  };
}
