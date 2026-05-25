/**
 * DNA v3 — per-gene overrides: alphaForm, maxStep, bias, sigmaBoost.
 * Used by updateGenesV3 to smooth AGR/RES, cap steps, and shift TAC/COM latents.
 * @module dna/v3/genesConfig
 */

const { GENES } = require('./types');

/** @type {Record<string, { alphaForm: number, maxStep: number, bias: number, sigmaBoost: number, kSigmoid?: number, lambdaForm?: number, clipR?: number, clipZ?: number }>} */
const GENES_CONFIG = {};

const DEFAULTS = {
  alphaForm: 0.5,
  maxStep: 10,
  bias: 0,
  sigmaBoost: 0,
};

// POS: sigmaBoost +0.03; μ raised at R=0 in priors.
// COM: lower bias/scale/form so not stuck at 90; pressure gating in actual.
const OVERRIDES = {
  accuracy: { alphaForm: 0.5, maxStep: 10, bias: 0, sigmaBoost: 0 },
  tactics: { alphaForm: 0.5, maxStep: 10, bias: 0.15, sigmaBoost: 0.04 },
  aggression: { alphaForm: 0.35, maxStep: 9, bias: 0, sigmaBoost: 0 },
  survival: { alphaForm: 0.5, maxStep: 10, bias: 0, sigmaBoost: 0 },
  positioning: { alphaForm: 0.5, maxStep: 6, bias: -0.06, sigmaBoost: 0.05 },
  teamwork: { alphaForm: 0.5, maxStep: 10, bias: 0, sigmaBoost: 0 },
  resource: { alphaForm: 0.25, maxStep: 7, bias: 0, sigmaBoost: 0.02 },
  composure: {
    alphaForm: 0.25,
    maxStep: 6,
    bias: 0.10,
    sigmaBoost: 0.03,
    kSigmoid: 1.10,
    lambdaForm: 0.45,
    clipR: 2.0,
    clipZ: 1.6,
  },
};

for (const g of GENES) {
  GENES_CONFIG[g] = { ...DEFAULTS, ...(OVERRIDES[g] || {}) };
}

/**
 * Get config for a gene (alphaForm, maxStep, bias, sigmaBoost, optional kSigmoid, lambdaForm, clipR, clipZ).
 * @param {string} geneKey
 * @returns {{ alphaForm: number, maxStep: number, bias: number, sigmaBoost: number, kSigmoid?: number, lambdaForm?: number, clipR?: number, clipZ?: number }}
 */
function getGeneConfig(geneKey) {
  return GENES_CONFIG[geneKey] || DEFAULTS;
}

module.exports = {
  GENES_CONFIG,
  getGeneConfig,
  DEFAULTS,
};
