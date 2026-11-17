// SOLMAR STREETS — deterministic random numbers.
// Every random choice in the city, traffic and pedestrians comes from here, so the same
// seed always builds the same Solmar. Nothing in this file touches the network or the DOM.
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small seeded random source with the helpers the rest of the game uses. */
export function createRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    /** Uniform float in [min, max). */
    range(min, max) {
      return min + (max - min) * next();
    },
    /** Uniform integer in [min, max]. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of `items`, uniformly. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** True with probability `p`. */
    chance(p) {
      return next() < p;
    },
  };
}
