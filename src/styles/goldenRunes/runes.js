/**
 * Elder Futhark runes as SVG path geometry.
 *
 * Deliberately not Unicode Runic (U+16A0–16FF): most systems ship no font for
 * that block, so the glyphs would render as tofu boxes. Drawing them as paths
 * means they look the same everywhere and need no download — the style works
 * offline, which a webfont cannot promise.
 *
 * Each rune is drawn in a 10 × 16 box, origin top-left, so they can be scaled
 * and placed uniformly.
 */
const RUNES = {
  /* ᚠ fehu — cattle, wealth */
  fehu: 'M2,0 L2,16 M2,3 L8,1 M2,8 L8,6',
  /* ᚢ uruz — aurochs, strength */
  uruz: 'M2,16 L2,2 L8,5 L8,16',
  /* ᚦ thurisaz — thorn */
  thurisaz: 'M2,0 L2,16 M2,4 L7,7 L2,10',
  /* ᚨ ansuz — the god, speech */
  ansuz: 'M2,0 L2,16 M2,2 L8,5 M2,7 L8,10',
  /* ᚱ raidho — the ride */
  raidho: 'M2,0 L2,16 M2,0 L7,3 L2,7 M2,7 L8,16',
  /* ᚲ kenaz — torch */
  kenaz: 'M8,2 L2,8 L8,14',
  /* ᚷ gebo — gift */
  gebo: 'M1,1 L9,15 M9,1 L1,15',
  /* ᚹ wunjo — joy */
  wunjo: 'M2,0 L2,16 M2,1 L8,4 L2,8',
  /* ᛁ isa — ice */
  isa: 'M5,0 L5,16',
  /* ᛏ tiwaz — the god Tyr */
  tiwaz: 'M5,2 L5,16 M1,6 L5,1 L9,6',
  /* ᛉ algiz — elk, protection */
  algiz: 'M5,16 L5,4 M1,0 L5,4 L9,0',
  /* ᛊ sowilo — sun */
  sowilo: 'M8,1 L3,5 L7,9 L2,15',
};

export default RUNES;

/** Stable pseudo-random placement, so the scatter does not reshuffle on render. */
export function scatter(count, seed = 1) {
  const names = Object.keys(RUNES);
  const out = [];
  let s = seed;
  const next = () => {
    /* Small LCG — deterministic, so the layout is identical every mount. */
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    out.push({
      name: names[Math.floor(next() * names.length)],
      x: next() * 100,
      y: next() * 100,
      size: 0.7 + next() * 1.6,
      rotate: (next() - 0.5) * 40,
      opacity: 0.05 + next() * 0.13,
      drift: 9 + next() * 16,
      delay: -next() * 20,
    });
  }
  return out;
}
