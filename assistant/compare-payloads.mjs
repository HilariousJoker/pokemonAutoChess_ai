// Compares the payloads of two extraction JSON files (provenance is ignored).
// Usage: node assistant/compare-payloads.mjs <a.json> <b.json>
// Baseline files (`pokemon`): accepts both the v1 flat layout (checkpoint 1f9ee28) and the current nested layout.
// Evolution files (`units` + `probes`, from extract-evolution.ts): compares units, probes and baseDefaultRule.
// Exit code 0 = identical payloads, 1 = differences (all printed), 2 = usage/read error.
import { readFileSync } from "node:fs"
import { isDeepStrictEqual } from "node:util"

// Normalise a unit record from either layout to one flat shape.
function flat(rec) {
  if (rec.identity) {
    return {
      key: rec.identity.key, name: rec.identity.name, index: rec.identity.index,
      evolutionFamilyRoot: rec.evolutionFamilyRoot,
      ...(rec.fieldAvailability ? { fieldAvailability: rec.fieldAvailability } : {}),
      evolution: rec.bareInstanceEvolution.evolution,
      evolutions: rec.bareInstanceEvolution.evolutions,
      types: rec.types, ...rec.stats
    }
  }
  const { baseline, ...rest } = rec // v1 called the family root "baseline"
  return { ...rest, evolutionFamilyRoot: baseline }
}

// --subset: <b> may cover fewer units than <a>; only b's units are compared (a must contain all of them).
const subset = process.argv.includes("--subset")
const [fa, fb] = process.argv.slice(2).filter((x) => x !== "--subset")
if (!fa || !fb) { console.error("usage: compare-payloads.mjs <a.json> <b.json>"); process.exit(2) }
let docA, docB
try { docA = JSON.parse(readFileSync(fa, "utf8")); docB = JSON.parse(readFileSync(fb, "utf8")) } catch (e) {
  console.error(`cannot read inputs: ${e.message}`); process.exit(2)
}
if (docA.units && docB.units) {
  const d = []
  for (const k of new Set([...Object.keys(docA.units), ...Object.keys(docB.units)])) {
    if (!(k in docA.units) || !(k in docB.units)) d.push(`${k}: only in ${k in docA.units ? fa : fb}`)
    else if (!isDeepStrictEqual(docA.units[k], docB.units[k])) d.push(`${k}: unit record differs`)
  }
  if (!isDeepStrictEqual(docA.probes, docB.probes)) d.push("probes differ")
  if (!isDeepStrictEqual(docA.baseDefaultRule, docB.baseDefaultRule)) d.push("baseDefaultRule differs")
  console.log(d.length ? `DIFFERENCES (${d.length}):\n${d.join("\n")}` : `IDENTICAL evolution payloads (${Object.keys(docA.units).length} units + probes)`)
  process.exit(d.length ? 1 : 0)
}
const a = docA.pokemon, b = docB.pokemon
const diffs = []
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
  if (!(k in a)) { diffs.push(`${k}: only in ${fb}`); continue }
  if (!(k in b)) { if (!subset) diffs.push(`${k}: only in ${fa}`); continue }
  const x = flat(a[k]), y = flat(b[k])
  for (const f of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (!isDeepStrictEqual(x[f], y[f])) diffs.push(`${k}.${f}: ${JSON.stringify(x[f])} -> ${JSON.stringify(y[f])}`)
  }
}
console.log(diffs.length ? `DIFFERENCES (${diffs.length}):\n${diffs.join("\n")}` : `IDENTICAL payloads (${Object.keys(a).length} units)`)
process.exit(diffs.length ? 1 : 0)
