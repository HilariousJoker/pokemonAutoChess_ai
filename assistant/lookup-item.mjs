// Read-only item lookup over saved data of the production-branch reference (07367c34); deployment unverified.
// Reads ONLY data/07367c34/item-effects.json and data/07367c34/item-recipes-stats.json. No game-code imports, no network,
// no writes, no installation. Usage:
//   node assistant/lookup-item.mjs "Soul Dew"                       one item (enum key or ordinary name)
//   node assistant/lookup-item.mjs "Soul Dew" "Choice Specs" ...    several items, one snapshot label
//   node assistant/lookup-item.mjs --component "Silk Scarf"         recipe outputs that use a component
//   node assistant/lookup-item.mjs --list                           coverage
//   (test option) --data-dir <dir>                                  read the two JSON files from another directory
// Exit codes: 0 ok; 1 usage / unknown / ambiguous / outside coverage; 2 data missing or inconsistent; 3 revision mismatch.
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SHA = "07367c341fe928763da2b565c2eee010433e4fc1"
const LABEL = "production-branch reference; deployment unverified"
const USAGE = `usage: node assistant/lookup-item.mjs "<item>" ["<item>" ...] | --component "<component>" | --list`

const die = (code, msg) => { process.stderr.write(msg.trimEnd() + "\n"); process.exit(code) }

// ---- arguments ----
let argv = process.argv.slice(2)
let dataDir = resolve(HERE, "data/07367c34")
const di = argv.indexOf("--data-dir")
if (di !== -1) {
  if (!argv[di + 1] || argv[di + 1].startsWith("--")) die(1, `--data-dir needs a directory.\n${USAGE}`)
  dataDir = resolve(argv[di + 1]); argv.splice(di, 2)
}
let mode = null, component = null; const names = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === "--list") { if (mode && mode !== "list") die(1, `--list cannot be combined with other modes.\n${USAGE}`); mode = "list" }
  else if (a === "--component") {
    if (mode && mode !== "component") die(1, `--component cannot be combined with other modes.\n${USAGE}`)
    if (component !== null) die(1, `--component takes exactly one component.\n${USAGE}`)
    const v = argv[++i]
    if (v === undefined || v.startsWith("--")) die(1, `--component needs a component name.\n${USAGE}`)
    component = v; mode = "component"
  }
  else if (a.startsWith("--")) die(1, `Unknown option ${JSON.stringify(a)}.\n${USAGE}`)
  else { if (mode && mode !== "items") die(1, `Item names cannot be combined with --list / --component.\n${USAGE}`); mode = "items"; names.push(a) }
}
if (!mode) die(1, USAGE)
if (mode === "list" && argv.length !== 1) die(1, `--list takes no other arguments.\n${USAGE}`)

// ---- data (verified before anything is combined) ----
const readJson = (f) => {
  try { return JSON.parse(readFileSync(resolve(dataDir, f), "utf8")) } catch (e) { die(2, `Cannot read ${f} in ${dataDir}: ${e.message}`) }
}
const fx = readJson("item-effects.json"), rs = readJson("item-recipes-stats.json")
for (const [n, d] of [["item-effects.json", fx], ["item-recipes-stats.json", rs]]) {
  if (d.sourceSha !== SHA) die(3, `${n}: sourceSha ${JSON.stringify(d.sourceSha)} is not the pinned production-branch reference ${SHA}; refusing to combine files.`)
  if (d.label !== LABEL) die(3, `${n}: label ${JSON.stringify(d.label)} is not "${LABEL}"; refusing to combine files.`)
}
if (!fx.items || typeof fx.items !== "object" || !Array.isArray(rs.recipes) || !Array.isArray(rs.itemStats) || !rs.components) die(2, "Required data fields are missing (items / recipes / itemStats / components).")
const recipe = new Map(rs.recipes.map((r) => [r.result, r.ingredients]))
const stats = new Map(rs.itemStats.map((s) => [s.item, s.values]))
const keys = rs.recipes.map((r) => r.result)
const fxKeys = Object.keys(fx.items)
if (keys.length !== fxKeys.length || keys.some((k) => !Object.hasOwn(fx.items, k))) die(2, "item-effects.json and item-recipes-stats.json do not cover the same recipe outputs.")
const REQUIRED = ["displayName", "summary", "caveats", "noteLink", "recipe", "declaredStats"]
for (const k of keys) {
  const rec = fx.items[k]
  for (const f of REQUIRED) if (!(f in rec) || (typeof rec[f] === "string" && !rec[f].trim())) die(2, `${k}: required field ${f} is missing or empty.`)
  if (JSON.stringify(rec.recipe.ingredients) !== JSON.stringify(recipe.get(k))) die(2, `${k}: recipe differs between the two files.`)
  const st = stats.has(k) ? stats.get(k) : null
  if (JSON.stringify(rec.declaredStats) !== JSON.stringify(st)) die(2, `${k}: declared stats differ between the two files.`)
}
const comp = rs.components
const COMPONENTS = [...comp.ItemComponentsNoFossilOrScarf, "FOSSIL_STONE", "SILK_SCARF"]
if (JSON.stringify(comp.ItemComponents) !== JSON.stringify(["...ItemComponentsNoFossilOrScarf", "FOSSIL_STONE", "SILK_SCARF"])) die(2, "Unexpected component list shape.")

// ---- name normalization: explicit, no guessing ----
const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
const ALIASES = new Map([["x ray vision", "XRAY_VISION"]]) // explicit alias; everything else must equal the normalized key or display name
const index = new Map() // normalized -> Set(keys)
const add = (norm, key) => { if (!index.has(norm)) index.set(norm, new Set()); index.get(norm).add(key) }
for (const k of keys) { add(strip(k.replace(/_/g, " ")), k); add(strip(fx.items[k].displayName), k) }
for (const [n, k] of ALIASES) if (Object.hasOwn(fx.items, k)) add(n, k)
const compIndex = new Map()
for (const c of COMPONENTS) { const n = strip(c.replace(/_/g, " ")); if (!compIndex.has(n)) compIndex.set(n, new Set()); compIndex.get(n).add(c) }
const OUTSIDE = new Map([["eviolite", "Eviolite"], ["shiny stone", "Shiny Stone"]])

const resolveItem = (raw) => {
  if (Object.hasOwn(fx.items, raw)) return raw // an exact enum key is always unambiguous
  const n = strip(raw)
  if (!n) die(1, `Empty item name.\n${USAGE}`)
  const hit = index.get(n)
  if (hit && hit.size === 1) return [...hit][0]
  if (hit && hit.size > 1) die(1, `Ambiguous item ${JSON.stringify(raw)}: matches ${[...hit].sort().join(", ")}. Use the exact enum key.`)
  if (OUTSIDE.has(n)) die(1, `${OUTSIDE.get(n)} is outside this 55-item recipe-output catalog (it is not a recipe output); see knowledge/07367c34/core-mechanics.md section G.`)
  die(1, `Unknown item ${JSON.stringify(raw)}: not one of the ${keys.length} craftable recipe outputs covered here, so no effect is assigned to it. Run --list for coverage.`)
}
const resolveComponent = (raw) => {
  const n = strip(raw)
  const hit = n && compIndex.get(n)
  if (hit && hit.size === 1) return [...hit][0]
  if (hit && hit.size > 1) die(1, `Ambiguous component ${JSON.stringify(raw)}: ${[...hit].sort().join(", ")}.`)
  die(1, `Unknown component ${JSON.stringify(raw)}. Components: ${COMPONENTS.map((c) => c.replace(/_/g, " ").toLowerCase()).join(", ")}.`)
}

// ---- output ----
const pretty = (k) => fx.items[k].displayName
const statsText = (k) => {
  const v = fx.items[k].declaredStats
  if (v === null) return "none (no ItemStats entry)"
  const e = Object.entries(v)
  return e.length ? e.map(([a, b]) => `${a} ${b}`).join(", ") : "none (empty ItemStats entry)"
}
const recipeText = (k) => fx.items[k].recipe.ingredients.map((i) => i.replace(/_/g, " ").toLowerCase().replace(/(^| |-)([a-z])/g, (m, a, b) => a + b.toUpperCase())).join(" + ")
const snapshot = `Snapshot: ${LABEL}; pinned ${SHA.slice(0, 8)}; source-traced from saved data only (no gameplay evidence).`
const card = (k) => {
  const r = fx.items[k]
  return [`${pretty(k).toUpperCase()}  (${k})`, `Recipe: ${recipeText(k)}`, `Declared bonuses: ${statsText(k)}`, `Effect: ${r.summary}`, `Limits / interactions: ${r.caveats}`, `Source note: ${r.noteLink}`].join("\n")
}

const out = [snapshot, ""]
if (mode === "list") {
  out.push(`Coverage: ${keys.length} craftable recipe outputs (every ItemRecipe key), each with a source-traced record.`)
  out.push("Outside this catalog: Eviolite and Shiny Stone (core-mechanics section G), consumables, tools, memory discs and other special items.")
  out.push("Accepted names: enum keys or ordinary names (case, accents, apostrophes and hyphens ignored; alias: X Ray Vision).", "")
  for (const k of keys) out.push(`${k.padEnd(20)} ${pretty(k)}  [${recipeText(k)}]`)
} else if (mode === "component") {
  const c = resolveComponent(component)
  const hits = keys.filter((k) => recipe.get(k).includes(c))
  out.push(`Recipe outputs using ${c.replace(/_/g, " ").toLowerCase()} (${hits.length}):`, "")
  for (const k of hits) out.push(`${pretty(k)} (${k}): ${recipeText(k)} | ${statsText(k)}`, `  ${fx.items[k].summary}`, "")
  if (!hits.length) out.push("(none)")
} else {
  const seen = new Set(), resolved = []
  for (const n of names) { const k = resolveItem(n); if (!seen.has(k)) { seen.add(k); resolved.push(k) } }
  resolved.forEach((k, i) => { if (i) out.push(""); out.push(card(k)) })
}
process.stdout.write(out.join("\n").replace(/\n+$/, "") + "\n")
