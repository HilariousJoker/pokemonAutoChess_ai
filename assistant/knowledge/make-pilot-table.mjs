// Prints markdown tables for the pilot notes, generated from the pilot JSON files.
// Usage: node assistant/knowledge/make-pilot-table.mjs [path/to/pilot-units.json]
//        node assistant/knowledge/make-pilot-table.mjs --evolution [path/to/pilot-evolution.json]       # evolution declarations table
//        node assistant/knowledge/make-pilot-table.mjs --type-null-map [path/to/pilot-evolution.json]   # TYPE_NULL item -> variant probe results
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const typeNullMap = args.includes("--type-null-map")
const evolutionMode = args.includes("--evolution") || typeNullMap
const given = args.find((a) => !a.startsWith("--"))
const file =
  given ??
  resolve(here, "../data/01a3e845", evolutionMode ? "pilot-evolution.json" : "pilot-units.json")
const data = JSON.parse(readFileSync(file, "utf8"))

if (!evolutionMode) {
  const rows = Object.entries(data.pokemon).map(([key, u]) => {
    const s = u.stats
    const types = u.types.length ? u.types.join(", ") : "— (none on bare instance)"
    return `| ${key} | ${s.rarity} | ${s.stars} | ${s.hp} | ${s.atk} | ${types} | ${s.skill} |`
  })
  console.log(["| Unit | Rarity | Stars | HP | Attack | Types | Ability |", "|---|---|---|---|---|---|---|", ...rows].join("\n"))
} else if (typeNullMap) {
  const tn = data.probes?.TYPE_NULL
  if (!tn) throw new Error("no TYPE_NULL probe in " + file)
  const byVariant = new Map()
  for (const x of tn.itemToVariant) {
    if (!x.ok) throw new Error(`probe failed for ${x.item}: ${x.error}`)
    if (!byVariant.has(x.result)) byVariant.set(x.result, [])
    byVariant.get(x.result).push(`${x.item} (${x.synergyGivenByItem})`)
  }
  console.log(["| Result of `divergentEvolution` | # items | Items (synergy given by item) |", "|---|---|---|"].join("\n"))
  for (const [variant, items] of byVariant) console.log(`| ${variant} | ${items.length} | ${items.join(", ")} |`)
  console.log(`\nTotal: ${tn.itemToVariant.length} items probed, ${byVariant.size} distinct results.`)
} else {
  const params = (r) => {
    const p = r.properties
    const out = []
    if (p.numberRequired.present) out.push(`numberRequired=${p.numberRequired.value}`)
    if (p.itemsTriggeringEvolution.present) out.push(`itemsTriggeringEvolution=[${p.itemsTriggeringEvolution.value.length} items]`)
    if (p.moneyRequired.present) out.push(`moneyRequired=${p.moneyRequired.value}`)
    return out.join(", ") || "—"
  }
  const callbacks = (r) => {
    const out = []
    for (const [n, v] of Object.entries(r.properties)) {
      if (v.present && v.kind === "callback") out.push(`${n} (pokemon.ts:${v.source.line ?? "?"})`)
    }
    return out.join(", ") || "—"
  }
  const rows = Object.entries(data.units).map(([key, u]) => {
    const d = u.declaredEvolution
    const r = u.evolutionRule
    const evolutions = d.evolutions.length ? d.evolutions.join(", ") : "[]"
    const evidence = u.evolutionEvidence.status.startsWith("declares") ? "declares evolution" : "none declared"
    return `| ${key} | ${d.evolution} | ${evolutions} | ${d.stacksRequired} | ${r.type} | ${params(r)} | ${callbacks(r)} | ${r.matchesInheritedBaseDefault ? "yes" : "no"} | ${evidence} |`
  })
  console.log(
    [
      "| Unit | `evolution` | `evolutions` | `stacksRequired` | Rule type | Rule parameters | Callbacks | Rule = inherited default | Evidence |",
      "|---|---|---|---|---|---|---|---|---|",
      ...rows
    ].join("\n")
  )
}
