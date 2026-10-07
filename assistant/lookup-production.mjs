// Read-only lookup for the PRODUCTION-BRANCH REFERENCE snapshot (pinned 07367c341fe928763da2b565c2eee010433e4fc1; deployment unverified).
// Reads committed assistant files only (data/07367c34/*.json, knowledge/07367c34/*.md). No game code, no server, no npm install, no writes.
// Separate from lookup-unit.mjs (development snapshot 01a3e845); development data and notes are never read here.
//
// Usage: node assistant/lookup-production.mjs <PKM_KEY>     one catalog identifier (exact, case-sensitive)
//        node assistant/lookup-production.mjs --list        counts, coverage and the catalog identifiers
//   optional (mainly for tests): --catalog <f> --evolution <f> --abilities <f>   alternate data files (still validated)
// Exit codes: 0 ok · 1 unknown / excluded identifier · 2 usage or unreadable/malformed input · 3 data refused (revision, provenance or identity mismatch).
import { readFileSync } from "node:fs"
import { dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { isDeepStrictEqual } from "node:util"

const HERE = dirname(fileURLToPath(import.meta.url))
const SHA = "07367c341fe928763da2b565c2eee010433e4fc1"
const LABEL = "Production-branch reference; deployment unverified"
const DATA_DIR = resolve(HERE, "data", "07367c34")
const NOTES_DIR = resolve(HERE, "knowledge", "07367c34")
const NOTE_FILES = { "pilot-evolution": "pilot-evolution.md", "evolution-context": "evolution-context.md", "pilot-abilities": "pilot-abilities.md" }

class Refusal extends Error { constructor(code, msg) { super(msg); this.code = code } }
const fail = (code, msg) => { throw new Refusal(code, msg) }
const own = (o, k) => Object.hasOwn(o, k)

function parseArgs(argv) {
  const o = { key: undefined, list: false, catalog: resolve(DATA_DIR, "catalog-units.json"), evolution: resolve(DATA_DIR, "pilot-evolution.json"), abilities: resolve(DATA_DIR, "pilot-abilities.json") }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--list") o.list = true
    else if (a === "--catalog" || a === "--evolution" || a === "--abilities") {
      const v = argv[++i]
      if (!v || v.startsWith("--")) fail(2, `${a} requires a file path`)
      o[a.slice(2)] = resolve(process.cwd(), v)
    } else if (a.startsWith("--")) fail(2, `unknown option ${a}`)
    else if (o.key === undefined) o.key = a
    else fail(2, `unexpected extra argument ${a}`)
  }
  if (o.list && o.key !== undefined) fail(2, "give either an identifier or --list, not both")
  if (!o.list && o.key === undefined) fail(2, "usage: lookup-production.mjs <PKM_KEY> | --list")
  return o
}

const readJson = (file, what) => {
  try { return JSON.parse(readFileSync(file, "utf8")) } catch (e) { return fail(2, `cannot read ${what} ${file}: ${e.message}`) }
}

// ---- load + validate (refuses on any revision / provenance / identity inconsistency) -------------------------
function revisionsIn(o, acc = []) { // every "revision" field in a data tree
  if (Array.isArray(o)) o.forEach((x) => revisionsIn(x, acc))
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (k === "revision") acc.push(v); else revisionsIn(v, acc) }
  return acc
}
function checkProvenance(doc, what) {
  const p = doc?.provenance
  if (!p) fail(3, `${what} has no provenance block; cannot verify the revision`)
  if (p.auditedSourceCommit !== SHA) fail(3, `${what} describes revision ${p.auditedSourceCommit}, not the pinned ${SHA}; refusing`)
  if (p.profile !== "production-reference") fail(3, `${what} has profile ${p.profile}, expected production-reference; refusing`)
  if (p.gameSourceMatchesAudited !== true) fail(3, `${what}: gameSourceMatchesAudited=${p.gameSourceMatchesAudited}; refusing data not produced from matching game source`)
  if (!String(p.snapshotLabel).includes("deployment unverified")) fail(3, `${what}: snapshot label lacks "deployment unverified"; refusing`)
  const bad = revisionsIn(doc).filter((r) => r !== SHA)
  if (bad.length) fail(3, `${what} contains source references to another revision (${bad[0]}); refusing`)
}
function load(o) {
  const cat = readJson(o.catalog, "catalog"), evo = readJson(o.evolution, "evolution data"), abi = readJson(o.abilities, "ability records")
  if (!cat || typeof cat.pokemon !== "object" || !cat.inventory || !Array.isArray(cat.inventory.identifiers)) fail(2, `${o.catalog} is not a catalog (no pokemon/inventory)`)
  if (!evo || typeof evo.units !== "object" || evo.units === null) fail(2, `${o.evolution} has no "units" section`)
  if (!abi || typeof abi.abilities !== "object" || abi.abilities === null) fail(2, `${o.abilities} has no "abilities" section`)
  checkProvenance(cat, "catalog"); checkProvenance(evo, "evolution data")
  if (abi.sourceSha !== SHA) fail(3, `ability records describe ${abi.sourceSha}, not the pinned ${SHA}; refusing`)
  if (!String(abi.label).includes("deployment unverified")) fail(3, "ability records lack the 'deployment unverified' label; refusing")
  if (cat.availabilityAndPlayability !== "unverified") fail(3, "catalog does not mark availability/playability as unverified; refusing")

  const excluded = cat.inventory.excluded ?? {}
  const ids = cat.inventory.identifiers
  const recKeys = Object.keys(cat.pokemon)
  if (new Set(ids).size !== ids.length || recKeys.length + Object.keys(excluded).length !== ids.length || !recKeys.every((k) => ids.includes(k)) || !Object.keys(excluded).every((k) => ids.includes(k) && !own(cat.pokemon, k))) {
    fail(3, "catalog inventory does not partition into records and exclusions")
  }
  for (const k of recKeys) {
    const r = cat.pokemon[k]
    if (r?.identity?.key !== k || r.identity.name !== k || typeof r.identity.index !== "string") fail(3, `catalog identity inconsistent for ${k}`)
    if (!ids.includes(r.evolutionFamilyRoot)) fail(3, `catalog family root of ${k} is not an inventory identifier`)
    if (!own(cat.registry ?? {}, k)) fail(3, `catalog registry facts missing for ${k}`)
  }
  for (const [k, u] of Object.entries(evo.units)) {
    const c = cat.pokemon[k]
    if (!own(cat.pokemon, k)) fail(3, `evolution record ${k} is not a catalog identifier`)
    if (!isDeepStrictEqual(u.identity, c.identity)) fail(3, `evolution identity of ${k} differs from the catalog identity`)
    if (u.declaredEvolution.evolution !== c.bareInstanceEvolution.evolution || !isDeepStrictEqual(u.declaredEvolution.evolutions, c.bareInstanceEvolution.evolutions)) fail(3, `evolution declarations of ${k} disagree with the catalog bare instance`)
  }
  for (const [name, rec] of Object.entries(abi.abilities)) {
    if (rec.ability !== name || rec.sourceSha !== SHA) fail(3, `ability record ${name} has inconsistent ability/revision`)
    for (const u of rec.appliesTo) {
      const s = own(cat.pokemon, u.key) ? cat.pokemon[u.key].stats : null
      if (!s || s.skill !== u.declaredSkill || s.stars !== u.stars || s.maxPP !== u.maxPP || s.range !== u.range) fail(3, `ability record ${name}: appliesTo ${u.key} disagrees with the catalog`)
    }
  }
  return { cat, evo, abi }
}

// ---- notes (headings and "Unresolved" lines are read from the committed production notes; nothing is paraphrased) ----
const noteCache = new Map()
function noteLines(id) {
  if (!noteCache.has(id)) {
    const f = resolve(NOTES_DIR, NOTE_FILES[id])
    if (relative(NOTES_DIR, f).startsWith("..")) fail(3, "note path escapes knowledge/07367c34")
    try { noteCache.set(id, readFileSync(f, "utf8").split("\n")) } catch (e) { fail(2, `cannot read note ${f}: ${e.message}`) }
  }
  return noteCache.get(id)
}
const slug = (h) => h.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-")
function section(id, heading) {
  const L = noteLines(id)
  const i = L.findIndex((l) => l.startsWith("## ") && l.slice(3).trim().startsWith(heading))
  if (i < 0) fail(3, `note ${NOTE_FILES[id]} has no section "${heading}"`)
  let j = i + 1
  while (j < L.length && !L[j].startsWith("## ")) j++
  const title = L[i].slice(3).trim()
  return { id, title, link: `assistant/knowledge/07367c34/${NOTE_FILES[id]}#${slug(title)}`, body: L.slice(i + 1, j) }
}
const NOTE_MAP = {
  MAGIKARP: [["pilot-evolution", "MAGIKARP"]],
  PIKACHU: [["pilot-evolution", "PIKACHU"], ["evolution-context", "Pikachu"]],
  RAICHU: [["evolution-context", "Pikachu"]],
  ALOLAN_RAICHU: [["evolution-context", "Pikachu"]],
  TYPE_NULL: [["pilot-evolution", "TYPE_NULL"]],
  PRIMEAPE: [["pilot-evolution", "PRIMEAPE"]],
  COSMOEM: [["pilot-evolution", "COSMOEM"], ["evolution-context", "Cosmoem"], ["evolution-context", "Cosmog"]],
  COSMOG: [["evolution-context", "Cosmog"]]
}
const ABILITY_HEADING = { BLAST_BURN: "BLAST_BURN", CRUNCH: "CRUNCH", VESPIQUEN_ORDERS: "VESPIQUEN_ORDERS" }
const unresolvedLines = (sec) => sec.body.filter((l) => /^(- )?\*\*(Unresolved|Resolved later|Not claimed)/.test(l.trim()))

// ---- rendering ------------------------------------------------------------------------------------------
const code = (s) => `\`${s}\``
const arr = (a) => (a.length ? a.join(", ") : "—")
const cap = (s, n = 700) => (s.length > n ? s.slice(0, n) + " … (see the note)" : s)
const rawTable = (t) => Object.entries(t).map(([k, v]) => (/^\d+$/.test(k) ? `${k}★ ${v}` : `${k} ${v}`)).join(", ")

function renderEvolution(L, key, cat, evo) {
  L.push("## Evolution declarations")
  const u = own(evo.units, key) ? evo.units[key] : null
  const bare = cat.pokemon[key].bareInstanceEvolution
  if (!u) {
    L.push("**Not covered:** this unit is outside the 20-unit evolution pilot (`data/07367c34/pilot-evolution.json`). Evolution coverage is intentionally a subset of the catalog; absence here is *missing coverage*, not a statement that the unit is terminal or that it cannot evolve.")
    L.push(`Only the raw bare-instance fields from the catalog are known: \`evolution\` = ${code(bare.evolution)} (${bare.evolution === "DEFAULT" ? "none declared on the class" : "default next stage declared by the class"}), \`evolutions\` = [${bare.evolutions.join(", ")}]. These are **not** a complete evolution map; the evolution rule (counts, items, conditions, callbacks) was not extracted.`)
    return
  }
  const d = u.declaredEvolution, r = u.evolutionRule, ev = u.evolutionEvidence
  L.push(`**Covered** (pilot). Declared: \`evolution\` = ${code(d.evolution)}${d.evolution === "DEFAULT" ? " (none)" : ""}, \`evolutions\` = [${d.evolutions.join(", ")}], \`stacksRequired\` = ${d.stacksRequired}${d.stacksRequired === 0 ? " (not set)" : ""}.`)
  if (ev.status === "declares-evolution") L.push(`- **Can evolve (declared):** yes — the class declares ${ev.declaresEvolutionTarget ? "an evolution target" : ""}${ev.declaresEvolutionTarget && ev.declaresEvolutionsArray ? " and " : ""}${ev.declaresEvolutionsArray ? "a branching targets list" : ""}.`)
  else L.push("- **Terminal in the declarations:** no evolution target and no targets list are declared. Any rule shown below is the inherited base default and is **not** evidence that the unit evolves.")
  const props = r.properties
  const params = []
  if (props.numberRequired?.present) params.push(`numberRequired = ${props.numberRequired.value}`)
  if (props.itemsTriggeringEvolution?.present) params.push(`itemsTriggeringEvolution = [${props.itemsTriggeringEvolution.value.length} items]`)
  if (props.moneyRequired?.present) params.push(`moneyRequired = ${props.moneyRequired.value}`)
  L.push(`- **Rule:** type ${code(r.type)}${params.length ? ` (${params.join(", ")})` : ""}, handler ${code(r.handler.class)}. ${r.matchesInheritedBaseDefault ? "This **equals the inherited base default** (COUNT, numberRequired 3, no callbacks) — it is not a class-specific rule." : "This is **not** the inherited default (class-specific rule)."}`)
  for (const [n, p] of Object.entries(props)) {
    if (p.present && p.kind === "callback") L.push(`- **Callback ${code(n)}** (arity ${p.arity}) at ${code(`${p.source.file}:${p.source.line}`)} (revision ${p.source.revision.slice(0, 8)}). Its behavior is documented in the notes below, not in this data record.`)
  }
  const probe = own(evo.probes ?? {}, key) ? evo.probes[key] : null
  if (probe) {
    L.push("- **Executed stub probe** (callback called with stub arguments; *not* game behavior):")
    if (key === "PIKACHU") L.push(`  - regionalPokemons without ALOLAN_RAICHU → ${probe.withoutAlolanRaichuInRegionalPokemons.result}; with it → ${probe.withAlolanRaichuInRegionalPokemons.result}`)
    else if (key === "TYPE_NULL") {
      const m = {}
      for (const x of probe.itemToVariant) (m[x.result] ??= []).push(x.item)
      L.push(`  - ${probe.itemCount} trigger items map to ${Object.keys(m).length} distinct results (${Object.entries(m).map(([k, v]) => `${k}×${v.length}`).join(", ")})`)
    }
  }
}

function renderAbility(L, key, cat, abi, covering) {
  const s = cat.pokemon[key].stats
  L.push("## Skill and passive")
  L.push(`Skill identifier ${code(s.skill)}${s.tm !== "DEFAULT" ? `, TM ${code(s.tm)}` : ""}; passive identifier ${code(s.passive)}. Identifiers alone say nothing about behavior (passives are covered in the next section).`)
  const sameId = Object.values(abi.abilities).filter((r) => r.ability === s.skill && !r.appliesTo.some((u) => u.key === key))
  if (!covering.length) {
    L.push(`**No reviewed ability information for this unit.** ${sameId.length ? `A reviewed record for ${code(s.skill)} exists but covers only ${sameId[0].appliesTo.map((u) => u.key).join(", ")}; it is **not** applied to ${key}.` : `The ability ${code(s.skill)} has not been reviewed.`} No description is invented.`)
    return
  }
  for (const rec of covering) {
    const a = rec.appliesTo.find((u) => u.key === key)
    L.push(`### Reviewed: ${rec.ability} (record \`abilities.${rec.ability}\`, covers ${rec.appliesTo.map((u) => u.key).join(", ")})`)
    L.push("> **Amounts below are RAW declared values from the ability code — not final damage, healing or shields.** Final results depend on the generic combat pipeline, which is mostly unverified.")
    if (rec.scope) L.push(`Scope: ${rec.scope}`)
    L.push(`Unit facts: ${key} is ${a.stars}★, maxPP ${a.maxPP}, range ${a.range}.`)
    L.push(`**Summary:** ${rec.summary}`)
    if (rec.targeting) L.push(`- Targets: ${rec.targeting.who}${rec.targeting.note ? `; note: ${rec.targeting.note}` : ""}.`)
    if (rec.geometry) L.push(`- Geometry: ${rec.geometry.shape}${rec.geometry.cells ? ` (${rec.geometry.cells} cells)` : ""}.`)
    for (const e of rec.effects ?? []) {
      L.push(`- ${e.kind}${e.damageType ? ` (${e.damageType})` : ""}${e.condition ? `, ${e.condition}` : ""}: raw ${e.declaredRaw.byStars ? rawTable(e.declaredRaw.byStars) : e.declaredRaw.formula}${e.declaredRaw.byStars && rec.starBehavior?.declaredRawDamage?.[key] !== undefined ? ` → this unit (${a.stars}★): **raw ${rec.starBehavior.declaredRawDamage[key]}**` : ""}.`)
      L.push(`  - Scaling: ${e.scaling}. Resolution: ${e.resolution}.`)
    }
    if (rec.identifierOnlyBehavior) {
      L.push(`**The bare skill ${code(rec.ability)} is a placeholder.** As a cast it does: ${rec.identifierOnlyBehavior.effects}.`)
      L.push(`**Mode selection (conditional):** ${rec.modeSelection.mechanism}. Applied to ${rec.modeSelection.appliedTo}.`)
      for (const m of rec.modes) {
        L.push(`- **${m.mode}** — ${m.setBy}; range ${m.rangeSet}; needs target: ${m.requiresTarget}.`)
        for (const d of m.does) L.push(`  - ${d}`)
        if (m.nextAttackBonus) L.push(`  - Next-attack bonus (raw): base ${rawTable(m.nextAttackBonus.declaredRaw.base)}; per allied Combee ${rawTable(m.nextAttackBonus.declaredRaw.perAlliedCombee)}; Vespiquen (3★): ${m.nextAttackBonus.declaredRaw.vespiquen3Star}, N = ${m.nextAttackBonus.N}. ${m.nextAttackBonus.scaling}.`)
        if (m.heal) L.push(`  - Heal (raw): ${rawTable({ 1: m.heal.declaredRaw["1"], 2: m.heal.declaredRaw["2"], 3: m.heal.declaredRaw["3"], 4: m.heal.declaredRaw["4"] })}; Vespiquen: ${m.heal.declaredRaw.vespiquen3Star}. ${m.heal.scaling}. ${m.heal.stacking}.`)
        if (m.shield) L.push(`  - Shield (raw): ${rawTable({ 1: m.shield.declaredRaw["1"], 2: m.shield.declaredRaw["2"], 3: m.shield.declaredRaw["3"], 4: m.shield.declaredRaw["4"] })}; Vespiquen: ${m.shield.declaredRaw.vespiquen3Star}. ${m.shield.scaling}.`)
      }
    }
    L.push(`- Positional: ${rec.positionalConditions}`)
    L.push(`- Repeated casts / modes: ${rec.repeatedCastsAndModes}`)
    L.push(`- Raw vs resolved: ${rec.rawVsResolved}`)
    L.push("- Depends on generic combat processing that is **unverified**:")
    for (const d of rec.dependsOnUnverifiedGenericCombat) L.push(`  - ${d}`)
    L.push("- **Unresolved:**")
    for (const d of rec.unresolved) L.push(`  - ${d}`)
    if (rec.identifierOnlyBehavior) L.push("- **Acquisition caveat:** the mode is written when the player moves the unit to rows 1–3; acquisition paths that do not go through that handler (for example evolution) were not traced, so such a Vespiquen may still hold the placeholder skill.")
  }
}


// Passive information comes in two different strengths, kept apart:
//  (a) a STRUCTURED passive record — none exists in the data files (data/07367c34 has records for abilities only; the VESPIQUEN
//      passive's position-change effect is described inside the VESPIQUEN_ORDERS ability record);
//  (b) SOURCE-BACKED CONTEXT in the linked production notes that mention this passive (quoted, never paraphrased or extended).
function renderPassive(L, key, cat, covering, secs) {
  const p = cat.pokemon[key].stats.passive
  L.push("## Passive")
  if (p === "NONE") { L.push("Passive identifier `NONE`: the unit declares no passive."); return }
  L.push(`Passive identifier ${code(p)}.`)
  const viaAbility = covering.find((r) => r.modeSelection && r.modeSelection.mechanism.includes(`Passive.${p}`))
  L.push(`- **Structured passive record:** none. Passive records do not exist in \`data/07367c34\`; ${viaAbility ? `the position-change effect of this passive is described inside the reviewed ability record \`abilities.${viaAbility.ability}\` (see above), not as a passive record` : "no field of the data files explains this passive"}.`)
  const mention = new RegExp(`passive[^\\n]*\\b${p}\\b|\\bPassive\\.${p}\\b|\\b${p}\\b[^\\n]*passive`, "i")
  const hits = []
  for (const sec of secs) for (const l of sec.body) if (mention.test(l)) hits.push({ sec, line: l.trim().replace(/^- /, "") })
  const seen = new Set()
  const uniq = hits.filter((h) => !seen.has(h.line) && seen.add(h.line))
  if (!uniq.length) { L.push("- **Source-backed context in linked notes:** none found. The passive's effect has not been investigated; no description is invented."); return }
  L.push("- **Source-backed context in linked production notes that mention this passive** (quoted from the notes; this is source reading, not a structured record, and what it leaves unresolved stays unresolved there):")
  for (const h of uniq.slice(0, 4)) L.push(`  - ${cap(h.line, 520)} — [${h.sec.title}](${h.sec.link})`)
}

function renderUnit(key, { cat, evo, abi }) {
  const r = cat.pokemon[key], s = r.stats, reg = cat.registry[key]
  const L = []
  L.push(`# ${key} — production-reference lookup`, "")
  L.push(`> **${LABEL}.** Pinned source \`${SHA}\` (upstream \`prod\` head; what the live game runs is not established).`)
  L.push("> Read from committed assistant files only. Values are **bare factory instance** values; a catalog entry does **not** show shop availability, obtainability or playability (unverified). Live-game parity is unverified.", "")
  L.push("## Identity")
  L.push(`- Key / name / index: ${code(r.identity.key)} / ${code(r.identity.name)} / ${code(r.identity.index)}`)
  L.push(`- Evolution-family root (\`getPokemonBaseline\`; a separate field, not this unit's identity): ${code(r.evolutionFamilyRoot)}`)
  L.push(`- Factory class: ${code(reg.registeredClass)}${reg.sharedClassWith.length ? `; the same class is registered for ${reg.sharedClassWith.length} other identifier(s) (${reg.sharedClassWith.slice(0, 6).join(", ")}${reg.sharedClassWith.length > 6 ? ", …" : ""}) — a registry fact, no further interpretation` : " (not shared with other identifiers)"}`, "")
  L.push("## Bare baseline")
  L.push(`- Types: ${arr(r.types)}; rarity ${s.rarity}; stars ${s.stars}`)
  L.push(`- HP ${s.hp} (maxHP ${s.maxHP}), ATK ${s.atk}, DEF ${s.def}, SPE_DEF ${s.speDef}, speed ${s.speed}, range ${s.range}, maxPP ${s.maxPP}, AP ${s.ap}, luck ${s.luck}, crit ${s.critChance}% ×${s.critPower}`)
  L.push(`- Skill ${code(s.skill)}, passive ${code(s.passive)}, TM ${code(s.tm)} (identifiers only)`)
  L.push(`- Class flags: additional=${s.additional}, regional=${s.regional}, canHoldItems=${s.canHoldItems}, canBeBenched=${s.canBeBenched}, canBeSold=${s.canBeSold} (flags, not availability)`)
  if (r.fieldAvailability) for (const [f, v] of Object.entries(r.fieldAvailability)) L.push(`- Field \`${f}\`: **absent** on this revision (${v.note})`)
  L.push("")
  renderEvolution(L, key, cat, evo)
  L.push("")
  const covering = Object.values(abi.abilities).filter((r) => r.appliesTo.some((u) => u.key === key))
  const secs = []
  for (const [id, h] of NOTE_MAP[key] ?? []) secs.push(section(id, h))
  for (const rec of covering) secs.push(section("pilot-abilities", ABILITY_HEADING[rec.ability]))
  if (own(evo.units, key)) secs.push({ ...section("pilot-evolution", "Shared mechanics"), shared: true })
  renderAbility(L, key, cat, abi, covering)
  L.push("")
  renderPassive(L, key, cat, covering, secs)
  L.push("")
  // notes: only production notes; unresolved lines are quoted from them
  L.push("## Production-reference notes and unresolved conditions")
  if (!secs.length) L.push("No production-reference note is linked for this unit (it is covered only by the catalog baseline).")
  const seen = new Set()
  for (const sec of secs) {
    if (seen.has(sec.link)) continue
    seen.add(sec.link)
    L.push(`- [${sec.title}](${sec.link})`)
    for (const u of unresolvedLines(sec)) L.push(`  - ${cap(u.trim().replace(/^- /, ""))}`)
  }
  L.push("", `Source files: assistant/data/07367c34/{catalog-units,pilot-evolution,pilot-abilities}.json (revision ${SHA.slice(0, 8)}).`)
  return L.join("\n")
}

function renderList({ cat, evo, abi }) {
  const L = [`# Production-reference lookup — coverage`, "", `> **${LABEL}.** Pinned source \`${SHA}\`. Identifiers do not establish shop availability or playability.`, ""]
  const c = cat.inventory.counts
  L.push(`- Catalog identifiers: ${c.inventory} (${c.extracted} with baseline records, ${c.excluded} excluded: ${Object.keys(cat.inventory.excluded).map((k) => `${k} — ${cat.inventory.excluded[k].reason.split(":")[0]}`).join("; ")}, ${c.failed} failed)`)
  L.push(`- Evolution records (pilot subset, ${Object.keys(evo.units).length}): ${Object.keys(evo.units).join(", ")}`)
  for (const [n, r] of Object.entries(abi.abilities)) L.push(`- Reviewed ability ${n} applies to: ${r.appliesTo.map((u) => u.key).join(", ")}`)
  L.push("", `## Catalog identifiers with baseline records (${Object.keys(cat.pokemon).length})`, Object.keys(cat.pokemon).join(", "))
  return L.join("\n")
}

try {
  const o = parseArgs(process.argv.slice(2))
  const data = load(o)
  if (o.list) console.log(renderList(data))
  else {
    const key = o.key
    if (!own(data.cat.pokemon, key)) {
      if (own(data.cat.inventory.excluded ?? {}, key)) fail(1, `${key} is an identifier of the catalog but is excluded from it: ${data.cat.inventory.excluded[key].reason} (source: ${data.cat.inventory.excluded[key].source}). No record is shown.`)
      fail(1, `unknown identifier "${key}" — not a production-reference catalog identifier (exact, case-sensitive Pkm key; use --list). Nothing was guessed.`)
    }
    console.log(renderUnit(key, data))
  }
} catch (e) {
  if (e instanceof Refusal) {
    console.error(`lookup-production: ${e.code === 3 ? "REFUSED — " : ""}${e.message}`)
    process.exit(e.code)
  }
  throw e
}
