// Field-by-field comparison of two bare-factory pilot snapshots (development vs production-reference).
// Usage: node assistant/compare-snapshots.mjs <dev pilot-units.json> <prod pilot-units.json>
// Prints markdown: changed values, fields unavailable on one side, unchanged-field count. Exit 0 always (it is a report).
import { readFileSync } from "node:fs"
import { isDeepStrictEqual } from "node:util"

const [fd, fp] = process.argv.slice(2)
if (!fd || !fp) { console.error("usage: compare-snapshots.mjs <dev.json> <prod.json>"); process.exit(2) }
const dev = JSON.parse(readFileSync(fd, "utf8")), prod = JSON.parse(readFileSync(fp, "utf8"))
const flat = (r) => ({
  "identity.name": r.identity.name, "identity.index": r.identity.index, evolutionFamilyRoot: r.evolutionFamilyRoot,
  "bareInstanceEvolution.evolution": r.bareInstanceEvolution.evolution,
  "bareInstanceEvolution.evolutions": r.bareInstanceEvolution.evolutions,
  types: r.types, ...Object.fromEntries(Object.entries(r.stats).map(([k, v]) => [`stats.${k}`, v]))
})
const absent = (r) => Object.keys(r.fieldAvailability ?? {}).map((k) => `stats.${k}`)
const keys = Object.keys(dev.pokemon)
if (!isDeepStrictEqual(keys, Object.keys(prod.pokemon))) { console.error("key sets differ"); process.exit(2) }
const changed = [], unavailable = []
let same = 0, total = 0
for (const k of keys) {
  const a = flat(dev.pokemon[k]), b = flat(prod.pokemon[k])
  const aAbs = absent(dev.pokemon[k]), bAbs = absent(prod.pokemon[k])
  for (const f of new Set([...Object.keys(a), ...Object.keys(b), ...aAbs, ...bAbs])) {
    const inA = f in a, inB = f in b
    if (inA && inB) {
      total++
      if (isDeepStrictEqual(a[f], b[f])) same++
      else changed.push(`| ${k} | \`${f}\` | \`${JSON.stringify(a[f])}\` | \`${JSON.stringify(b[f])}\` |`)
    } else {
      unavailable.push(`| ${k} | \`${f}\` | ${inA ? `\`${JSON.stringify(a[f])}\`` : "unavailable"} | ${inB ? `\`${JSON.stringify(b[f])}\`` : "unavailable"} |`)
    }
  }
}
console.log(`## Changed values (${changed.length})\n\n| Unit | Field | Development 01a3e845 | Production-reference 07367c34 |\n|---|---|---|---|\n${changed.join("\n") || "| _none_ | | | |"}`)
console.log(`\n## Fields unavailable on one revision (${unavailable.length})\n\n| Unit | Field | Development | Production-reference |\n|---|---|---|---|\n${unavailable.join("\n") || "| _none_ | | | |"}`)
console.log(`\nCompared ${total} field values present on both revisions across ${keys.length} units: ${same} equal, ${changed.length} changed.`)
