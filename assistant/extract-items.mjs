// Extracts ItemRecipe, ItemStats and the item component lists from the pinned production-branch reference into
// data/07367c34/item-recipes-stats.json. Production-branch reference; deployment unverified.
// Read-only on the game: reads `git show <sha>:<path>` only (no checkout, no install). Writes only the one data file.
// Usage: node assistant/extract-items.mjs            (writes assistant/data/07367c34/item-recipes-stats.json)
//        node assistant/extract-items.mjs --check    (re-extract and compare with the committed file; exit 1 on difference)
// Parsing is line-based on the declared tables (every entry has `[Item.X]: ...`); validate-items.mjs re-derives the same
// tables with a different method (evaluating the literal) and compares.
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, "..")
const SHA = "07367c341fe928763da2b565c2eee010433e4fc1"
const OUT = resolve(HERE, "data/07367c34/item-recipes-stats.json")
const git = (f) => execFileSync("git", ["-C", REPO, "show", `${SHA}:${f}`], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\n")

const ITEM_FILE = "app/types/enum/Item.ts", STATS_FILE = "app/config/game/items.ts", GAME_FILE = "app/types/enum/Game.ts"
const item = git(ITEM_FILE), stats = git(STATS_FILE), game = git(GAME_FILE)

// Locate a `export const NAME ... = {` / `[` block: returns {start, end} as 1-based inclusive line numbers.
function block(lines, header, close) {
  const s = lines.findIndex((l) => l.startsWith(header))
  if (s < 0) throw new Error(`not found: ${header}`)
  for (let i = s + 1; i < lines.length; i++) if (lines[i] === close) return { start: s + 1, end: i + 1 }
  throw new Error(`unterminated: ${header}`)
}
const enumValues = (lines, header) => {
  const b = block(lines, header, "}")
  return new Set(lines.slice(b.start, b.end - 1).map((l) => l.match(/^\s+([A-Z0-9_]+) = "/)?.[1]).filter(Boolean))
}
const ITEMS = enumValues(item, "export enum Item "), STATS = enumValues(game, "export enum Stat ")
const itemName = (t) => { const m = t.match(/^Item\.([A-Z0-9_]+)$/); if (!m || !ITEMS.has(m[1])) throw new Error(`not an Item: ${t}`); return m[1] }
const statName = (t) => { const m = t.match(/^Stat\.([A-Z0-9_]+)$/); if (!m || !STATS.has(m[1])) throw new Error(`not a Stat: ${t}`); return m[1] }

// --- ItemRecipe ---
const rb = block(item, "export const ItemRecipe", "}")
const recipes = []
for (let n = rb.start + 1; n < rb.end; n++) {
  const m = item[n - 1].match(/^\s+\[(Item\.[A-Z0-9_]+)\]: \[(Item\.[A-Z0-9_]+), (Item\.[A-Z0-9_]+)\],?$/)
  if (!m) throw new Error(`unparsed ItemRecipe line ${n}: ${item[n - 1]}`)
  recipes.push({ result: itemName(m[1]), ingredients: [itemName(m[2]), itemName(m[3])], line: n })
}

// --- component lists (declared order) ---
const compBlock = (name) => {
  const b = block(item, `export const ${name}`, "]")
  return item.slice(b.start, b.end - 1).join(" ").replace(/\.\.\.\s*/g, "...").split(",").map((s) => s.trim()).filter(Boolean)
    .map((t) => (t.startsWith("...") ? t : itemName(t)))
}
const components = {
  ItemComponentsNoFossilOrScarf: compBlock("ItemComponentsNoFossilOrScarf"),
  ItemComponentsNoScarf: compBlock("ItemComponentsNoScarf"),
  ItemComponents: compBlock("ItemComponents:"),
}

// --- ItemStats --- (entries may span several lines; collect from `[Item.X]:` until the entry's closing brace)
const sb = block(stats, "export const ItemStats", "}")
const itemStats = []
for (let n = sb.start + 1; n < sb.end; ) {
  const head = stats[n - 1].match(/^  \[(Item\.[A-Z0-9_]+)\]: \{(.*)$/)
  if (!head) throw new Error(`unparsed ItemStats line ${n}: ${stats[n - 1]}`)
  let body = head[2], first = n
  while (!/\}\s*,?\s*$/.test(body)) { n++; body += " " + stats[n - 1].trim() }
  const inner = body.replace(/\}\s*,?\s*$/, "").trim()
  const values = {}
  if (inner) for (const part of inner.split(",").map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^\[(Stat\.[A-Z0-9_]+)\]: (-?\d+(?:\.\d+)?)$/)
    if (!m) throw new Error(`unparsed ItemStats entry at ${n}: ${part}`)
    values[statName(m[1])] = Number(m[2])
  }
  itemStats.push({ item: itemName(head[1]), values, lines: [first, n] })
  n++
}

const scarfResults = recipes.filter((r) => r.ingredients.includes("SILK_SCARF")).map((r) => r.result)
const statsByItem = Object.fromEntries(itemStats.map((s) => [s.item, s]))
const out = {
  label: "production-branch reference; deployment unverified",
  sourceSha: SHA,
  sources: {
    itemRecipe: { file: ITEM_FILE, lines: [rb.start, rb.end] },
    itemStats: { file: STATS_FILE, lines: [sb.start, sb.end] },
    components: { file: ITEM_FILE, note: "ItemComponents* lists" },
    statEnum: { file: GAME_FILE },
  },
  note: "Declared data only. ItemStats values are the amounts passed to applyStat when an item is added to a battle entity (pokemon-entity.ts applyItemEffect); they are not final in-combat values (Big Eater Belt, Twist Band and other modifiers can change a stat call). Behavioral effects are not in this file; see knowledge/07367c34/silk-scarf-items.md.",
  components,
  recipes,
  itemStats,
  derived: {
    scarvesRecipeResults: scarfResults,
    scarvesDefinition: "Scarves = keys of ItemRecipe whose recipe includes SILK_SCARF (Item.ts Scarves)",
    scarfItemStats: Object.fromEntries(scarfResults.map((r) => [r, statsByItem[r]?.values ?? null])),
  },
}
const text = JSON.stringify(out, null, 2) + "\n"
if (process.argv.includes("--check")) {
  const same = readFileSync(OUT, "utf8") === text
  console.log(same ? "item-recipes-stats.json matches a fresh extraction" : "DIFFERENT from a fresh extraction")
  process.exit(same ? 0 : 1)
}
writeFileSync(OUT, text)
console.log(`wrote ${OUT}: ${recipes.length} recipes, ${itemStats.length} ItemStats entries, ${scarfResults.length} scarf recipes`)
