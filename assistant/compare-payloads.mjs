// Compares the Pokémon payloads of two baseline JSON files (provenance is ignored).
// Usage: node assistant/compare-payloads.mjs <a.json> <b.json>
// Accepts both the v1 flat layout (checkpoint 1f9ee28) and the current nested layout.
// Exit code 0 = identical payloads, 1 = differences (all printed), 2 = usage/read error.
import { readFileSync } from "node:fs"
import { isDeepStrictEqual } from "node:util"

// Normalise a unit record from either layout to one flat shape.
function flat(rec) {
  if (rec.identity) {
    return {
      key: rec.identity.key, name: rec.identity.name, index: rec.identity.index,
      evolutionFamilyRoot: rec.evolutionFamilyRoot,
      evolution: rec.bareInstanceEvolution.evolution,
      evolutions: rec.bareInstanceEvolution.evolutions,
      types: rec.types, ...rec.stats
    }
  }
  const { baseline, ...rest } = rec // v1 called the family root "baseline"
  return { ...rest, evolutionFamilyRoot: baseline }
}

const [fa, fb] = process.argv.slice(2)
if (!fa || !fb) { console.error("usage: compare-payloads.mjs <a.json> <b.json>"); process.exit(2) }
let a, b
try { a = JSON.parse(readFileSync(fa, "utf8")).pokemon; b = JSON.parse(readFileSync(fb, "utf8")).pokemon } catch (e) {
  console.error(`cannot read inputs: ${e.message}`); process.exit(2)
}
const diffs = []
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
  if (!(k in a)) { diffs.push(`${k}: only in ${fb}`); continue }
  if (!(k in b)) { diffs.push(`${k}: only in ${fa}`); continue }
  const x = flat(a[k]), y = flat(b[k])
  for (const f of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (!isDeepStrictEqual(x[f], y[f])) diffs.push(`${k}.${f}: ${JSON.stringify(x[f])} -> ${JSON.stringify(y[f])}`)
  }
}
console.log(diffs.length ? `DIFFERENCES (${diffs.length}):\n${diffs.join("\n")}` : `IDENTICAL payloads (${Object.keys(a).length} units)`)
process.exit(diffs.length ? 1 : 0)
