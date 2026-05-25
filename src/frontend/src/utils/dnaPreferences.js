/**
 * DNA Lab preferences (localStorage).
 */

export const DNA_LAST_MODE_KEY = "dna.lastMode";

const VALID_MODES = ["genes", "map"];

export function getDnaLastMode() {
  if (typeof window === "undefined") return "genes";
  const v = localStorage.getItem(DNA_LAST_MODE_KEY);
  return VALID_MODES.includes(v) ? v : "genes";
}

export function setDnaLastMode(mode) {
  if (typeof window === "undefined") return;
  if (VALID_MODES.includes(mode)) {
    localStorage.setItem(DNA_LAST_MODE_KEY, mode);
  }
}

/** Entry point: always last mode (Stats/Compare/Map), no Hub. */
export function resolveDnaEntry() {
  return getDnaLastMode();
}
