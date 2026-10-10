// Arithmetic check for knowledge/07367c34/representative-builds.md. Production-branch reference; deployment unverified.
// WHAT THIS IS: it re-computes the worked calculations under the SAME CHOSEN ASSUMPTIONS the note states (a discrete PP-rule model plus
// closed forms) and requires each quoted number to appear in the note. It checks calculations, NOT parity with the combat engine.
// WHAT IT DOES NOT MODEL: movement/MovingState start, delayed attack commands, real attack timing, PeriodicEffect timer behaviour
// (the timer resets when it fires; it does not catch up missed intervals), damage-taken PP, statuses, targeting, fight length.
// Discrete PP-rule model: each decision is either a basic attack (+perAttack PP) or, if pp >= maxPP, a cast (pp -= maxPP, then optional Aqua Egg return).
// No times are computed. Usage: node assistant/check-build-arithmetic.mjs   (exit 0 = calculations agree with the note)
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
const HERE = dirname(fileURLToPath(import.meta.url))
const md = readFileSync(resolve(HERE, "knowledge/07367c34/representative-builds.md"), "utf8")
let fail = 0
const check = (name, got, want, inDoc = []) => {
  const ok = JSON.stringify(got) === JSON.stringify(want) && inDoc.every((t) => md.includes(t))
  if (!ok) { fail++; console.log("FAIL", name, JSON.stringify(got), "expected", JSON.stringify(want), inDoc.filter((t) => !md.includes(t)).map((t) => `(missing in note: ${t})`).join(" ")) } else console.log("PASS", name)
}
// basic attacks between casts under the PP rule only
function attacksBetweenCasts({ maxPP, startPP = 0, per = 5, egg = false, n = 3 }) {
  let pp = startPP, a = 0, cnt = 0; const out = []
  for (let i = 0; i < 100000 && out.length < n; i++) {
    if (pp >= maxPP) { cnt++; pp -= maxPP; if (egg) pp += Math.min(maxPP - 10, Math.round(0.2 * maxPP + 2 * cnt)); out.push(a); a = 0 }
    else { pp += per; a++ }
  }
  return out
}
// W1 Soul Dew vs Choice Specs (Charmander 1*, raw 30): damage per cast and attacks replaced by ticks
const sdRaw = (k) => 30 * (1 + (5 * k) / 100)
check("W1 Soul Dew raw per cast after k ticks", [10, 20, 40].map(sdRaw), [45, 60, 90], ["k = 10 → 45, 20 → 60, 40 → 90"])
check("W1 Choice Specs raw per cast", 30 * (1 + 100 / 100), 60, ["raw 60"])
check("W1 ticks replace attacks", [0, 5, 10, 20].map((k) => attacksBetweenCasts({ maxPP: 100, startPP: 5 * k, n: 1 })[0]), [20, 15, 10, 0], ["20 − k attacks (k = 5 → 15, k = 10 → 10)"])
check("W1 20 ticks equal one full cast of PP and Specs' AP", [20 * 5, 20 * 5], [100, 100], ["20 ticks = 100 PP and 100 AP"])
// W2
check("W2 none", attacksBetweenCasts({ maxPP: 100 }), [20, 20, 20], ["None: 20, 20, 20"])
check("W2 Water Stone", attacksBetweenCasts({ maxPP: 100, startPP: 30 }), [14, 20, 20], ["14, then 20, 20"])
check("W2 Efficient holder / neighbor", [attacksBetweenCasts({ maxPP: 85, startPP: 15 }), attacksBetweenCasts({ maxPP: 85 })], [[14, 17, 17], [17, 17, 17]], ["14, then 17, 17", "17, 17, 17"])
check("W2 Deep Sea Tooth", attacksBetweenCasts({ maxPP: 100, startPP: 15, per: 10 }), [9, 10, 10], ["9, then 10, 10"])
check("W2 Aqua Egg", attacksBetweenCasts({ maxPP: 100, startPP: 30, egg: true }), [14, 16, 15], ["14, 16, 15"])
check("W2 Aqua Egg with max PP 85", Math.round(0.2 * 85 + 2), 19, ["round(17 + 2n)"])
// W3 effective HP ratios
const ehpKR = (hp) => +(((hp + 100) * 1.2) / hp).toFixed(2)
const ehpRocky = (def) => +((1 + 0.05 * (def + 25)) / (1 + 0.05 * def)).toFixed(2)
check("W3 King's Rock ratios 1/2/3 star", [ehpKR(60), ehpKR(120), ehpKR(220)], [3.2, 2.2, 1.75], ["×3.2", "×2.2", "×1.75"])
check("W3 Rocky Helmet physical ratios", [ehpRocky(3), ehpRocky(4), ehpRocky(5)], [2.09, 2.04, 2], ["×2.09", "×2.04", "×2.00"])
check("W3 1-star pool and multiplier", [60 + 100 + 0.2 * 160, +(1 / (1 + 0.05 * 28) / (1 / (1 + 0.05 * 3))).toFixed(3)], [192, 0.479], ["160 HP + 32 shield = 192", "×0.479"])
check("W3 3-star pool", 220 + 100 + 0.2 * 320, 384, ["320 + 64 = 384"])
// W4
const be = (h, ap, lo, hi) => [Math.round((h - h * ap) / hi), Math.round((h - h * ap) / lo)]
check("W4 thresholds", [be(30, 0.3, 0.10, 0.15), be(120, 0.3, 0.10, 0.15)], [[140, 210], [560, 840]], ["about 140–210", "about 560–840"])
// W5
const per0 = Math.ceil(30 / 1.15), per100 = Math.ceil(60 / 1.15)
check("W5 Shell Bell", [per0, Math.ceil(0.33 * per0), 4 * Math.ceil(0.33 * per0), per100, Math.ceil(0.33 * per100), 4 * Math.ceil(0.33 * per100)], [27, 9, 36, 53, 18, 72], ["27 per target", "36 with four adjacent enemies", "18 each, 72"])
// W6 Totodile
check("W6 per-cycle amounts", [20 * 7, 20 * 27, 20 * 10, +(200 / 40).toFixed(1), +(200 / 160).toFixed(2)], [140, 540, 200, 5, 1.25], ["20 × 7 = **140**", "540 vs 160", "20 × 10 = **+200**", "five times", "1.25× apart"])
check("W6 Totodile survival", [+(((75 + 100) * 1.2) / 75).toFixed(2), ehpRocky(4)], [2.8, 2.04], ["×2.8", "×2.04"])
// W7 Vespiquen
check("W7 attacks between casts", [attacksBetweenCasts({ maxPP: 90 }), attacksBetweenCasts({ maxPP: 90, startPP: 30, egg: true })], [[18, 18, 18], [12, 14, 14]], ["none 18, 18, 18", "12, 14, 14"])
const effMax = Math.round(0.85 * 90)
check("W7 Efficient Bandanna holder", [effMax, effMax - 15, Math.ceil((effMax - 15) / 5), attacksBetweenCasts({ maxPP: effMax, startPP: 15 })], [77, 62, 13, [13, 15, 16]], ["round(90 × 0.85) = 77", "start 15, so 62 more PP: ceil(62 / 5) = **13** attacks", "then 15, 16"])
check("W7 Efficient Bandanna neighbor (no +15)", [Math.ceil(effMax / 5), attacksBetweenCasts({ maxPP: effMax })], [16, [16, 15, 16]], ["16, 15, 16"])
const bonus = (n, ap) => (60 + 30 * n) * (1 + ap / 100)
check("W7 ATTACK bonus table", [[1, 3, 5].map((n) => bonus(n, 0)), [1, 3, 5].map((n) => bonus(n, 100))], [[90, 150, 210], [180, 300, 420]], ["N=1 → 90, N=3 → 150, N=5 → 210", "180 / 300 / 420"])
check("W7 cycle", [90 / 5, (90 / 5) * 16, 18 * 10], [18, 288, 180], ["18 basic attacks (16 ATK) = 288", "+180 per cycle"])
check("W7 DEFEND survival", [+(((190 + 100) * 1.2) / 190).toFixed(2), ehpRocky(8)], [1.83, 1.89], ["×1.83", "×1.89"])
check("Blast Burn after SPE_DEF 3", [0, 50, 100].map((ap) => Math.ceil((30 * (1 + ap / 100)) / 1.15)), [27, 40, 53], [])
// the note must not present derived times as cast times
check("note quotes no derived cast times", /\b\d+(\.\d+)? s\b/.test(md.replace(/enraged 3 s|3000 ms/g, "")), false, [])
console.log(fail ? `\n${fail} check(s) FAILED` : "\ncalculations agree with the note under its stated assumptions (not an engine-parity check)")
process.exit(fail ? 1 : 0)
