import * as THREE from "three";

/**
 * Build a double-helix geometry (pure math, no assets).
 * Returns arrays that are easy to render with Lines/Instancing.
 */
export function buildHelix({
  turns = 9,
  radius = 2.0,
  height = 12.0,
  segmentsPerTurn = 36,
  rungEvery = 2,
} = {}) {
  const totalSegments = Math.max(12, Math.floor(turns * segmentsPerTurn));
  const aPoints = [];
  const bPoints = [];

  // y goes from 0..height
  for (let i = 0; i <= totalSegments; i++) {
    const t = (i / totalSegments) * Math.PI * 2 * turns;
    const y = (i / totalSegments) * height;

    const ax = radius * Math.cos(t);
    const az = radius * Math.sin(t);

    const bx = radius * Math.cos(t + Math.PI);
    const bz = radius * Math.sin(t + Math.PI);

    aPoints.push(new THREE.Vector3(ax, y, az));
    bPoints.push(new THREE.Vector3(bx, y, bz));
  }

  const rungs = [];
  for (let i = 0; i < aPoints.length; i += rungEvery) {
    const a = aPoints[i];
    const b = bPoints[i];
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(a, mid).normalize(); // outward
    const nodePos = new THREE.Vector3().copy(mid).add(dir.multiplyScalar(0.48)); // where match nodes sit
    rungs.push({
      index: i,
      a: a.clone(),
      b: b.clone(),
      mid: mid.clone(),
      nodePos: nodePos.clone(),
    });
  }

  return {
    turns,
    radius,
    height,
    segmentsPerTurn,
    totalSegments,
    aPoints,
    bPoints,
    rungs,
  };
}

/**
 * Map matches to positions along the helix (evenly spaced).
 */
export function computeMatchPositions(matches, helix) {
  const byId = {};
  const ordered = [];

  const rungCount = helix.rungs.length;
  const matchCount = matches.length;

  if (matchCount === 0 || rungCount === 0) {
    return { byId, ordered };
  }

  for (let i = 0; i < matchCount; i++) {
    const m = matches[i];

    const alpha = matchCount === 1 ? 1 : i / (matchCount - 1);
    const rungIdx = Math.round(alpha * (rungCount - 1));
    const rung = helix.rungs[rungIdx];

    const pos = rung.nodePos.clone();
    byId[m.id] = { pos, rungIdx, rungIndex: rung.index };
    ordered.push({ id: m.id, pos, rungIdx, rungIndex: rung.index });
  }

  return { byId, ordered };
}

/**
 * Utility: orientation matrix for a cylinder connecting point a→b
 */
export function makeCylinderMatrix(a, b, scaleRadius = 1.0) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();

  const midpoint = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

  // Cylinder is aligned with Y axis by default.
  const yAxis = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(yAxis, dir);

  const mat = new THREE.Matrix4();
  mat.compose(midpoint, quat, new THREE.Vector3(scaleRadius, len, scaleRadius));
  return mat;
}
