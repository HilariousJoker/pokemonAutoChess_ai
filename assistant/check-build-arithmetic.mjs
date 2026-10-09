// Independent arithmetic check for knowledge/07367c34/representative-builds.md. Production-branch reference; deployment unverified.
// Method 1: slot-by-slot timeline (attack slots at k * interval, +5 PP per basic attack, cast at the first slot whose start PP >= maxPP,
//           PP -= maxPP, Soul Dew +5 AP/+5 PP each 1000 ms, Aqua Egg returns min(maxPP-10, round(0.2*maxPP + 2n)) PP after cast n).
// Method 2: closed forms for attack counts, effective-HP ratios and bonus tables.
// Each expected number is also required to appear in the Markdown. This is arithmetic, NOT a battle simulation.
// Usage: node assistant/check-build-arithmetic.mjs   (exit 0 = all agree)
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
const HERE = dirname(fileURLToPath(import.meta.url))
const md = readFileSync(resolve(HERE, "knowledge/07367c34/representative-builds.md"), "utf8")
let fail = 0
const check = (name, got, want, inDoc = []) => {
  const ok = JSON.stringify(got) === JSON.stringify(want) && inDoc.every((t) => md.includes(t))
  if (!ok) { fail++; console.log("FAIL", name, JSON.stringify(got), "expected", JSON.stringify(want), inDoc.filter((t) => !md.includes(t)).map((t) => `(missing in doc: ${t})`).join(" ")) } else console.log("PASS", name)
}
const interval = (speed) => Math.round(1000 / (0.4 + 0.007 * speed))
function timeline({ speed, maxPP, startPP = 0, perAttack = 5, soul = false, egg = false, n = 4 }) {
  const iv = interval(speed); let pp = startPP, ap = 0, tick = 1000, cnt = 0; const out = []
  for (let k = 1; k < 1000 && out.length < n; k++) {
    const t = k * iv
    while (soul && tick <= t) { pp += 5; ap += 5; tick += 1000 }
    if (pp >= maxPP) { cnt++; pp -= maxPP; if (egg) pp += Math.min(maxPP - 10, Math.round(0.2 * maxPP + 2 * cnt)); out.push([+(t / 1000).toFixed(1), ap, k - 1]) }
    else pp += perAttack
  }
  return out
}
const times = (o) => o.map((x) => x[0])
// intervals
check("intervals", [interval(57), interval(50), interval(38)], [1252, 1333, 1502], ["1252 ms", "1333 ms", "1502 ms"])
// W1 Charmander
check("W1 no item casts", times(timeline({ speed: 57, maxPP: 100, n: 2 })), [26.3, 52.6], ["26.3 s, 52.6 s"])
const sd = timeline({ speed: 57, maxPP: 100, soul: true })
check("W1 Soul Dew casts and AP", sd.map((x) => [x[0], x[1]]), [[12.5, 60], [23.8, 115], [35.1, 175], [47.6, 235]], ["12.5 s (AP 60", "23.8 s (AP 115", "35.1 s (AP 175", "47.6 s (AP 235"])
check("W1 Soul Dew raw per cast and total", [sd.map((x) => 30 * (1 + x[1] / 100)), sd.reduce((a, x) => a + 30 * (1 + x[1] / 100), 0)], [[48, 64.5, 82.5, 100.5], 295.5], ["raw 48", "64.5", "82.5", "100.5", "295.5"])
check("W1 Soul Dew reaches Choice Specs AP", 100 / 5, 20, ["after 20 ticks (20 s)"])
// W2
const attacksBefore = (maxPP, startPP, per) => Math.ceil((maxPP - startPP) / per)
check("W2 attacks before first cast", [attacksBefore(100, 0, 5), attacksBefore(100, 30, 5), attacksBefore(85, 15, 5), attacksBefore(85, 0, 5), attacksBefore(100, 15, 10)], [20, 14, 14, 17, 9], ["none 20 (26.3 s)", "14 (18.8 s)", "14 (18.8 s)", "17 (22.5 s)", "Deep Sea Tooth 9 (12.5 s)"])
check("W2 first-cast times (timeline)", [timeline({ speed: 57, maxPP: 100, startPP: 30, n: 1 })[0][0], timeline({ speed: 57, maxPP: 85, startPP: 15, n: 1 })[0][0], timeline({ speed: 57, maxPP: 85, n: 1 })[0][0], timeline({ speed: 57, maxPP: 100, startPP: 15, perAttack: 10, n: 1 })[0][0]], [18.8, 18.8, 22.5, 12.5], [])
check("W2 later casts", [times(timeline({ speed: 57, maxPP: 100, startPP: 30, n: 3 })).slice(1), times(timeline({ speed: 57, maxPP: 85, startPP: 15, n: 3 })).slice(1), times(timeline({ speed: 57, maxPP: 100, startPP: 30, egg: true, n: 4 })).slice(1)], [[45.1, 71.4], [41.3, 63.9], [40.1, 60.1, 80.1]], ["45.1 s, 71.4 s", "41.3 s, 63.9 s", "40.1 s, 60.1 s, 80.1 s"])
check("W2 Aqua Egg returns", [1, 2, 3].map((n) => Math.round(0.2 * 100 + 2 * n)), [22, 24, 26], ["22, 24, 26"])
check("W2 Aqua Egg with maxPP 85", Math.round(0.2 * 85 + 2), 19, [])
check("W2 Soul Dew + Deep Sea Tooth", times(timeline({ speed: 57, maxPP: 100, startPP: 15, perAttack: 10, soul: true, n: 3 })), [7.5, 16.3, 25], ["7.5 s, 16.3 s, 25.0 s"])
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
const ceil = Math.ceil
const per0 = ceil(30 / 1.15), per100 = ceil(60 / 1.15)
check("W5 Shell Bell", [per0, ceil(0.33 * per0), 4 * ceil(0.33 * per0), per100, ceil(0.33 * per100), 4 * ceil(0.33 * per100)], [27, 9, 36, 53, 18, 72], ["27 per target", "36 with four adjacent enemies", "18 each, 72"])
// W6 Totodile
check("W6 cycles", [20 * 7, 20 * 27, 20 * 10], [140, 540, 200], ["20 × 7 = **140**", "540 vs 160", "20 × 10 = **+200**"])
check("W6 Totodile timeline", [times(timeline({ speed: 50, maxPP: 100, n: 1 }))[0], times(timeline({ speed: 50, maxPP: 100, startPP: 15, perAttack: 10, n: 1 }))[0], times(timeline({ speed: 50, maxPP: 100, soul: true, n: 1 }))[0]], [28, 13.3, 13.3], ["28.0 s to 13.3 s", "13.3 s)"])
check("W6 Totodile survival", [+(((75 + 100) * 1.2) / 75).toFixed(2), ehpRocky(4)], [2.8, 2.04], ["×2.8", "×2.04"])
// W7 Vespiquen
check("W7 Vespiquen casts", [timeline({ speed: 38, maxPP: 90, n: 1 })[0][0], times(timeline({ speed: 38, maxPP: 90, soul: true, n: 2 })), times(timeline({ speed: 38, maxPP: 90, startPP: 30, egg: true, soul: true, n: 3 })), timeline({ speed: 38, maxPP: Math.round(0.85 * 90), n: 1 })[0][0], Math.round(0.85 * 90)], [28.5, [12, 24], [9, 18, 27], 25.5, 77], ["none 28.5 s", "12.0 s (AP 60)", "24.0 s (AP 120)", "9.0 s, 18.0 s, 27.0 s", "(maxPP 77) 25.5 s"])
const bonus = (n, ap) => (60 + 30 * n) * (1 + ap / 100)
check("W7 ATTACK bonus table", [[1, 3, 5].map((n) => bonus(n, 0)), [1, 3, 5].map((n) => bonus(n, 100))], [[90, 150, 210], [180, 300, 420]], ["N=1 → 90, N=3 → 150, N=5 → 210", "180 / 300 / 420"])
check("W7 cycle", [90 / 5, (90 / 5) * 16, 18 * 10], [18, 288, 180], ["18 basic attacks (16 ATK) = 288", "+180 per cycle"])
check("W7 DEFEND survival", [+(((190 + 100) * 1.2) / 190).toFixed(2), ehpRocky(8)], [1.83, 1.89], ["×1.83", "×1.89"])
// Blast Burn examples
check("Blast Burn after SPE_DEF 3", [0, 50, 100].map((ap) => ceil((30 * (1 + ap / 100)) / 1.15)), [27, 40, 53], [])
console.log(fail ? `\n${fail} check(s) FAILED` : "\nall build arithmetic checks agree")
process.exit(fail ? 1 : 0)
