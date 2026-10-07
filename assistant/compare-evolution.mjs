// Compares two pilot-evolution.json files (e.g. development vs production-reference): value changes vs source-reference relocation.
// Usage: node assistant/compare-evolution.mjs <a.json> <b.json>   (read-only; `revision` and callback `line` are ignored for value comparison)
import { readFileSync } from "node:fs"
import { isDeepStrictEqual as eq } from "node:util"
const [fa, fb] = process.argv.slice(2)
if (!fa || !fb) { console.error("usage: compare-evolution.mjs <a.json> <b.json>"); process.exit(2) }
const a = JSON.parse(readFileSync(fa, "utf8")), b = JSON.parse(readFileSync(fb, "utf8"))
const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === "revision" || k === "line" ? undefined : v)))
const keysA = Object.keys(a.units), keysB = Object.keys(b.units)
console.log(`units: ${keysA.length} vs ${keysB.length}; same keys in same order: ${eq(keysA, keysB)}`)
const lines = (u) => Object.entries(u.evolutionRule.properties).filter(([, v]) => v.kind === "callback").map(([n, v]) => `${n}@${v.source.line}`)
let changed = 0
for (const k of keysA) {
  if (!b.units[k]) { console.log(`${k}: missing in b`); changed++; continue }
  for (const part of ["identity", "declaredEvolution", "evolutionRule", "evolutionEvidence"]) {
    if (!eq(strip(a.units[k][part]), strip(b.units[k][part]))) {
      changed++
      console.log(`VALUE CHANGE ${k}.${part}: ${JSON.stringify(strip(a.units[k][part]))} -> ${JSON.stringify(strip(b.units[k][part]))}`)
    }
  }
  if (!eq(lines(a.units[k]), lines(b.units[k]))) console.log(`RELOCATED ${k}: ${lines(a.units[k])} -> ${lines(b.units[k])}`)
}
console.log(`probes equal: ${eq(a.probes, b.probes)}; baseDefaultRule equal: ${eq(strip(a.baseDefaultRule), strip(b.baseDefaultRule))}; value changes: ${changed}`)
