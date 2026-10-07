// Prints the compact markdown table for the pilot notes, generated from the pilot JSON.
// Usage: node assistant/knowledge/make-pilot-table.mjs [path/to/pilot-units.json]
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] ?? resolve(here, "../data/01a3e845/pilot-units.json")
const { pokemon } = JSON.parse(readFileSync(file, "utf8"))

const rows = Object.entries(pokemon).map(([key, u]) => {
  const s = u.stats
  const types = u.types.length ? u.types.join(", ") : "— (none on bare instance)"
  return `| ${key} | ${s.rarity} | ${s.stars} | ${s.hp} | ${s.atk} | ${types} | ${s.skill} |`
})
console.log(["| Unit | Rarity | Stars | HP | Attack | Types | Ability |", "|---|---|---|---|---|---|---|", ...rows].join("\n"))
