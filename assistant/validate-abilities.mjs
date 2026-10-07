// Validates assistant/data/07367c34/pilot-abilities.json against the pinned source (read with `git show <sha>:<path>`; no checkout needed,
// only that the commit object exists locally) and checks that knowledge/07367c34/pilot-abilities.md agrees with the records.
// Production-branch reference; deployment unverified. Usage: node assistant/validate-abilities.mjs   (exit 0 = all checks pass)
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, "..")
const data = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/pilot-abilities.json"), "utf8"))
const md = readFileSync(resolve(HERE, "knowledge/07367c34/pilot-abilities.md"), "utf8")
const units = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/pilot-units.json"), "utf8")).pokemon
const SHA = "07367c341fe928763da2b565c2eee010433e4fc1"
const norm = (s) => s.replace(/\s+/g, " ").trim()
const problems = []
const bad = (m) => problems.push(m)
const srcCache = new Map()
const src = (f) => {
  if (!srcCache.has(f)) srcCache.set(f, execFileSync("git", ["-C", REPO, "show", `${SHA}:${f}`], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\n"))
  return srcCache.get(f)
}
if (data.sourceSha !== SHA) bad(`sourceSha is ${data.sourceSha}`)
if (!/production-branch reference; deployment unverified/.test(data.label)) bad("label missing")

// 1. every evidence entry: lines exist and contain the expected text
for (const [name, rec] of Object.entries(data.abilities)) {
  const ids = new Set()
  for (const e of rec.evidence) {
    if (ids.has(e.id)) bad(`${name}: duplicate evidence id ${e.id}`)
    ids.add(e.id)
    const L = src(e.file)
    const [a, b] = e.lines
    if (!(a >= 1 && b >= a && b <= L.length)) { bad(`${name}/${e.id}: bad line range ${a}-${b} in ${e.file}`); continue }
    if (!norm(L.slice(a - 1, b).join(" ")).includes(norm(e.expect))) bad(`${name}/${e.id}: "${e.expect}" not found in ${e.file}:${a}-${b}`)
  }
  // 2. every evidence reference used in the record resolves
  const walk = (o, path) => {
    if (Array.isArray(o)) return o.forEach((x, i) => walk(x, `${path}[${i}]`))
    if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o)) {
        if (k === "evidence" && Array.isArray(v) && typeof v[0] === "string") for (const id of v) if (!ids.has(id)) bad(`${name}${path}: unknown evidence id ${id}`)
        if (k !== "evidence") walk(v, `${path}.${k}`)
      }
    }
  }
  walk({ ...rec, evidence: undefined }, "")
  if (!rec.unresolved?.length) bad(`${name}: no explicit unresolved list`)
  if (!rec.dependsOnUnverifiedGenericCombat?.length) bad(`${name}: no generic-combat dependency list`)
  // 3. unit facts agree with the production pilot-units.json
  for (const u of rec.appliesTo) {
    const s = units[u.key]?.stats
    if (!s || s.stars !== u.stars || s.maxPP !== u.maxPP || s.range !== u.range) bad(`${name}: ${u.key} stars/maxPP/range disagree with pilot-units.json`)
    if (u.declaredSkill !== s?.skill) bad(`${name}: ${u.key} skill ${u.declaredSkill} vs ${s?.skill}`)
  }
}

// 4. declared tables equal the arrays in the source text
const table = (file, re) => {
  const m = src(file).join("\n").match(re)
  if (!m) { bad(`table not found: ${re}`); return [] }
  return m[1].split(",").map((x) => Number(x.trim()))
}
const byStars = (o) => [1, 2, 3, 4].map((i) => o[i] ?? o.fallback)
const bb = table("app/core/abilities/blast-burn.ts", /const damage = \[([^\]]+)\]/)
const cr = table("app/core/abilities/crunch.ts", /const damage = \[([^\]]+)\]/)
const ho = table("app/core/abilities/heal-order.ts", /const heal = \[([^\]]+)\]/)
const dfo = table("app/core/abilities/defend-order.ts", /const shield = \[([^\]]+)\]/)
const aoBase = table("app/core/pokemon-state.ts", /\(\(\[([^\]]+)\]\[pokemon\.stars - 1\] \?\? 120\)/)
const aoPer = table("app/core/pokemon-state.ts", /nbComfeeAllies \* \(\[([^\]]+)\]\[pokemon\.stars - 1\]/)
const eq = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad(`${what}: record ${JSON.stringify(a)} vs source ${JSON.stringify(b)}`) }
const A = data.abilities
eq(byStars(A.BLAST_BURN.effects[0].declaredRaw.byStars), bb, "BLAST_BURN damage table")
eq(byStars(A.CRUNCH.effects[0].declaredRaw.byStars), cr, "CRUNCH damage table")
const mode = (n) => A.VESPIQUEN_ORDERS.modes.find((m) => m.mode === n)
eq(byStars(mode("HEAL_ORDER").heal.declaredRaw), ho.length === 4 ? ho : [], "HEAL_ORDER table")
eq(byStars(mode("DEFEND_ORDER").shield.declaredRaw), dfo, "DEFEND_ORDER table")
eq(byStars(mode("ATTACK_ORDER").nextAttackBonus.declaredRaw.base), aoBase, "ATTACK_ORDER base table")
eq(byStars(mode("ATTACK_ORDER").nextAttackBonus.declaredRaw.perAlliedCombee), aoPer, "ATTACK_ORDER per-Combee table")
// mode rows/ranges/skills vs passive source
const passive = src("app/core/effects/passives.ts").slice(1750, 1764).join(" ")
for (const [row, skill, range] of [[1, "ATTACK_ORDER", 3], [2, "HEAL_ORDER", 2], [3, "DEFEND_ORDER", 1]]) {
  const re = new RegExp(`newY === ${row}\\) \\{ pokemon\\.range = ${range} pokemon\\.skill = Ability\\.${skill}`)
  if (!re.test(norm(passive))) bad(`passive mapping row ${row} -> ${skill}/${range} not found`)
  const m = mode(skill)
  if (m.rangeSet !== range || !m.setBy.includes(`row ${row}`)) bad(`record mode ${skill} disagrees with passive mapping`)
}
// registry
for (const [id, cls] of [["BLAST_BURN", "BlastBurnStrategy"], ["CRUNCH", "CrunchStrategy"], ["VESPIQUEN_ORDERS", "AbilityStrategy"], ["ATTACK_ORDER", "AttackOrderStrategy"], ["HEAL_ORDER", "HealOrderStrategy"], ["DEFEND_ORDER", "DefendOrderStrategy"]]) {
  if (!src("app/core/abilities/abilities.ts").some((l) => l.includes(`[Ability.${id}]: new ${cls}()`))) bad(`registry entry ${id} -> ${cls} not found`)
}
const rage = src("app/models/colyseus-models/status.ts").join(" ")
if (!/pokemon\.addSpeed\(80, pokemon, 0, false\)/.test(rage) || !/status\.triggerRage\(3000, p\)/.test(src("app/core/abilities/attack-order.ts").join(" "))) bad("rage 3000 ms / +80 speed not confirmed")

// 5. the Markdown agrees with the records
const slash = (a) => a.join(" / ")
const need = [
  ["BLAST_BURN raw table", slash(bb)], ["CRUNCH raw table", slash(cr)], ["HEAL_ORDER raw table", slash(ho)],
  ["DEFEND_ORDER raw table", slash(dfo)], ["ATTACK_ORDER base", slash(aoBase)], ["ATTACK_ORDER per-Combee", slash(aoPer)],
  ["Vespiquen attack bonus", "60 + 30 × N"], ["Crunch heal", "ceil(0.5 × the victim's max HP)"], ["rage", "3000 ms"], ["+80 speed", "+80 speed"],
  ["production sha", SHA], ["label", "Production-branch reference; deployment unverified"], ["8 adjacent cells", "8 adjacent cells"]
]
for (const [what, s] of need) if (!md.includes(s)) bad(`Markdown lacks ${what}: "${s}"`)
for (const name of Object.keys(A)) if (!md.includes(`abilities.${name}`)) bad(`Markdown does not link record ${name}`)
for (const row of ["| 1 | ATTACK_ORDER | 3 |", "| 2 | HEAL_ORDER | 2 |", "| 3 | DEFEND_ORDER | 1 |"]) if (!md.includes(row)) bad(`Markdown lacks mode row ${row}`)
for (const [k, v] of [["Charmander (1★) 30", 1], ["Charmeleon (2★) 60", 1], ["Charizard (3★) 120", 1], ["Totodile is 1★ → 40", 1]]) if (!md.includes(k)) bad(`Markdown lacks "${k}"`)

const nEv = Object.values(A).reduce((n, r) => n + r.evidence.length, 0)
if (problems.length) { console.error(`FAILED (${problems.length}):\n- ${problems.join("\n- ")}`); process.exit(1) }
console.log(`OK: 3 records, ${nEv} evidence references verified against ${SHA.slice(0, 8)}, tables/mappings/units/Markdown agree`)
