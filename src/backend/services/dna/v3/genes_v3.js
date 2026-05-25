/**
 * DNA v3 — gene update: skill/form latents, residual vs baseline, logistic 10..90, step cap ±10.
 * Uses per-gene config (clip r/z, alphaForm, maxStep, bias, sigmaBoost).
 * @module dna/v3/genes_v3
 */

const { GENES } = require('./types');
const { getGeneConfig } = require('./genesConfig');

const K_FORM_WINDOW = 5;
const ALPHA_SKILL = 0.15;
const W_PROXY = 0.6;
const LAMBDA_FORM = 0.9;
const K_SIGMOID = 1.6;
const MIN_GENE = 10;
const MAX_GENE = 90;

/** Clip residual and z to avoid explosions in AGR/RES */
const CLIP_R_MIN = -2.5;
const CLIP_R_MAX = 2.5;
const CLIP_Z_MIN = -2.0;
const CLIP_Z_MAX = 2.0;

const EPS = 1e-6;

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}
function clamp(x, a, b) {
  return Math.max(a, Math.min(b, Number(x) || 0));
}

function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function std(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) * (x - m), 0) / (arr.length - 1);
  return Math.sqrt(v) || 0;
}

function zScore(current, hist) {
  if (!hist || hist.length < 3) return 0;
  const m = mean(hist);
  const s = std(hist);
  return (current - m) / (s + EPS);
}

/**
 * Update player gene state for one match.
 * @param {Object} args
 * @param {Object} args.player - PlayerGeneState
 * @param {string} args.contextKey
 * @param {{ C: number, N: number, R: number, L: number }} args.context
 * @param {Record<string, number>} args.actual - 0..1 per gene
 * @param {Record<string, number>} args.proxy - 0..1 per gene
 * @param {Record<string, { mu: number, sigma: number }>} args.expected
 * @param {boolean} [args.isTeamMode=true] — если false (solo), teamwork не обновляется
 * @returns {{ next: Object, debug: Object }}
 */
function updateGenesV3(args) {
  const { player, contextKey, context, actual, proxy, expected, isTeamMode = true } = args;
  const next = JSON.parse(JSON.stringify(player));
  const debug = {
    contextKey,
    context: { ...context },
    expected: { ...expected },
    actual: { ...actual },
    proxy: { ...proxy },
    residual: {},
    zForm: {},
    impact: {},
    raw: {},
    next: {},
  };

  for (const g of GENES) {
    if (g === 'teamwork' && !isTeamMode) {
      next.value[g] = player.value && player.value[g] != null ? player.value[g] : 50;
      debug.next[g] = next.value[g];
      continue;
    }
    const cfg = getGeneConfig(g);
    const mu = expected[g]?.mu ?? 0.5;
    const sigma = (expected[g]?.sigma ?? 0.17) + (cfg.sigmaBoost ?? 0);
    const actualG = actual[g] != null ? actual[g] : 0.5;
    const proxyG = proxy[g] != null ? proxy[g] : 0.5;

    let r = (actualG - mu) / (sigma + EPS);
    const clipRMin = cfg.clipR != null ? -cfg.clipR : CLIP_R_MIN;
    const clipRMax = cfg.clipR != null ? cfg.clipR : CLIP_R_MAX;
    r = clamp(r, clipRMin, clipRMax);
    const hist = next.actualHist && next.actualHist[g] ? next.actualHist[g] : [];
    let z = zScore(actualG, hist.slice(-K_FORM_WINDOW));
    const clipZMin = cfg.clipZ != null ? -cfg.clipZ : CLIP_Z_MIN;
    const clipZMax = cfg.clipZ != null ? cfg.clipZ : CLIP_Z_MAX;
    z = clamp(z, clipZMin, clipZMax);

    const skillPrev = next.skill && next.skill[g] != null ? next.skill[g] : 0;
    const formPrev = next.form && next.form[g] != null ? next.form[g] : 0;
    const proxyCentered = proxyG - 0.5;
    const skillNew = (1 - ALPHA_SKILL) * skillPrev + ALPHA_SKILL * (r + W_PROXY * proxyCentered);
    const alphaForm = cfg.alphaForm ?? 0.5;
    const formNew = (1 - alphaForm) * formPrev + alphaForm * z;

    next.skill[g] = skillNew;
    next.form[g] = formNew;

    const bias = cfg.bias ?? 0;
    const kSigmoid = cfg.kSigmoid != null ? cfg.kSigmoid : K_SIGMOID;
    const lambdaForm = cfg.lambdaForm != null ? cfg.lambdaForm : LAMBDA_FORM;
    const x = kSigmoid * (skillNew + lambdaForm * formNew) + bias;
    const raw = MIN_GENE + (MAX_GENE - MIN_GENE) * sigmoid(x);

    const prevVal = next.value && next.value[g] != null ? next.value[g] : 50;
    const maxStep = cfg.maxStep ?? 10;
    const delta = clamp(raw - prevVal, -maxStep, maxStep);
    const stepped = prevVal + delta;
    const finalVal = clamp(stepped, MIN_GENE, MAX_GENE);
    next.value[g] = finalVal;

    if (!next.actualHist) next.actualHist = {};
    if (!next.actualHist[g]) next.actualHist[g] = [];
    next.actualHist[g] = [...hist.slice(-(K_FORM_WINDOW - 1)), actualG];

    debug.residual[g] = r;
    debug.zForm[g] = z;
    debug.raw[g] = raw;
    debug.next[g] = finalVal;
    debug.impact[g] = Math.tanh(0.85 * r + 0.25 * proxyCentered + 0.45 * z);
  }

  return { next, debug };
}

/** Default max step when no per-gene override (backward compatibility). */
const DEFAULT_MAX_STEP = 10;

module.exports = {
  updateGenesV3,
  MIN_GENE,
  MAX_GENE,
  MAX_STEP: DEFAULT_MAX_STEP,
};
