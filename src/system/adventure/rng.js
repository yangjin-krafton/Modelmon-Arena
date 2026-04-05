/** Deterministic RNG helpers for adventure generation. */

export function createSeed(value) {
  const text = String(value ?? Date.now());
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function nextRandom(state) {
  let t = state.rngState += 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(state, min, max) {
  return Math.floor(nextRandom(state) * (max - min + 1)) + min;
}

export function pickWeighted(state, entries, weightKey = 'weight') {
  const filtered = entries.filter(entry => Number(entry[weightKey]) > 0);
  if (!filtered.length) return null;

  const total = filtered.reduce((sum, entry) => sum + Number(entry[weightKey]), 0);
  let roll = nextRandom(state) * total;

  for (const entry of filtered) {
    roll -= Number(entry[weightKey]);
    if (roll <= 0) return entry;
  }
  return filtered[filtered.length - 1];
}

export function pickWeightedDistinct(state, entries, count, weightKey = 'weight') {
  const pool = [...entries];
  const result = [];

  while (pool.length && result.length < count) {
    const picked = pickWeighted(state, pool, weightKey);
    if (!picked) break;
    result.push(picked);
    const index = pool.indexOf(picked);
    if (index >= 0) pool.splice(index, 1);
  }

  return result;
}
