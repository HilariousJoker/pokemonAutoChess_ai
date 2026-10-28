// FAST lookup: units and items in ONE read-only command (production-branch reference 07367c34; deployment unverified).
// Reads saved canonical data only (data/07367c34/*.json, knowledge/07367c34/*.md headings, automation/review-status.json).
// Never reads candidate drafts, development datasets, game source, the network, and never writes. Provenance, identity, unit-binding and
// review-status checks are those of lookup-production.mjs (imported `load`); item names/cards come from lookup-item.mjs (same checks).
//
//   node assistant/lookup-fast.mjs --unit WALREIN --item "Big Eater Belt"
//   node assistant/lookup-fast.mjs --unit CHARIZARD --unit "Poliwag" --item "Nullify Bandanna" --item "Twist Band"
//   node assistant/lookup-fast.mjs --component "Silk Scarf"        recipe outputs that use a component (complete list)
//   node assistant/lookup-fast.mjs --item-list                      all craftable item recipes
//   node assistant/lookup-fast.mjs --list                           unit coverage (ability / passive / evolution records)
//   --detail   adds what the default omits: record scope, review scope, shared-record roster, unverified generic dependencies
//   (test options) --catalog --evolution --abilities --reusable --review <file>, --data-dir <dir> (item files)
// Exit codes: 0 ok · 1 unknown / ambiguous / excluded identifier or usage · 2 unreadable data · 3 data refused (revision, provenance, identity, binding).
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Refusal, load, rawDesc, rawTable, aiOf, unresolvedLines } from "./lookup-production.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const SHA = "07367c341fe928763da2b565c2eee010433e4fc1"
const DATA = resolve(HERE, "data/07367c34"), NOTES = resolve(HERE, "knowledge/07367c34")
const USAGE = 'usage: lookup-fast.mjs [--unit <unit>]... [--item <item>]... [--component <component>] [--item-list] [--list] [--detail]'
const own = (o, k) => Object.hasOwn(o, k)
const fail = (code, msg) => { throw new Refusal(code, msg) }

function parse(argv) {
  const o = { units: [], items: [], component: null, itemList: false, list: false, detail: false, catalog: resolve(DATA, "catalog-units.json"), evolution: resolve(DATA, "pilot-evolution.json"), abilities: resolve(DATA, "pilot-abilities.json"), reusable: resolve(DATA, "reusable-abilities.json"), review: resolve(HERE, "automation/review-status.json"), dataDir: null }
  const val = (i, a) => { const v = argv[i + 1]; if (v === undefined || v.startsWith("--")) fail(1, `${a} needs a value.\n${USAGE}`); return v }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--unit") o.units.push(val(i++, a))
    else if (a === "--item") o.items.push(val(i++, a))
    else if (a === "--component") { if (o.component !== null) fail(1, "--component takes exactly one component."); o.component = val(i++, a) }
    else if (a === "--item-list") o.itemList = true
    else if (a === "--list") o.list = true
    else if (a === "--detail") o.detail = true
    else if (["--catalog", "--evolution", "--abilities", "--reusable", "--review"].includes(a)) o[a.slice(2)] = resolve(process.cwd(), val(i++, a))
    else if (a === "--data-dir") o.dataDir = resolve(process.cwd(), val(i++, a))
    else fail(1, `${a.startsWith("--") ? "Unknown option" : "Unexpected argument"} ${JSON.stringify(a)} (use --unit / --item).\n${USAGE}`)
  }
  if (!o.units.length && !o.items.length && o.component === null && !o.itemList && !o.list) fail(1, USAGE)
  return o
}

// ---- unit names: exact catalog key, else a normalized name that matches exactly one key ----
const squash = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "")
function resolveUnit(raw, cat) {
  if (own(cat.pokemon, raw)) return raw
  const ex = cat.inventory.excluded ?? {}
  if (own(ex, raw)) fail(1, `${raw} is a catalog identifier but is excluded from it: ${ex[raw].reason}. No record is shown.`)
  const n = squash(raw)
  if (!n) fail(1, `Empty unit name.\n${USAGE}`)
  const hits = [...Object.keys(cat.pokemon), ...Object.keys(ex)].filter((k) => squash(k) === n)
  if (hits.length === 1) { if (own(ex, hits[0])) fail(1, `${hits[0]} is excluded from the catalog: ${ex[hits[0]].reason}.`); return hits[0] }
  if (hits.length > 1) fail(1, `Ambiguous unit ${JSON.stringify(raw)}: matches ${hits.sort().join(", ")}. Use the exact identifier.`)
  fail(1, `Unknown unit ${JSON.stringify(raw)}: not a production-reference catalog identifier (exact key or an unambiguous name). Nothing was guessed; --list shows coverage.`)
}

// ---- notes: link by heading, so a newly imported record is linked without a hand-written map ----
const noteCache = new Map()
const noteLines = (f) => { if (!noteCache.has(f)) { try { noteCache.set(f, readFileSync(resolve(NOTES, f), "utf8").split("\n")) } catch { noteCache.set(f, []) } } return noteCache.get(f) }
const slug = (h) => h.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-")
function noteSection(file, pred) {
  const L = noteLines(file), i = L.findIndex((l) => l.startsWith("## ") && pred(l.slice(3).trim()))
  if (i < 0) return null
  let j = i + 1; while (j < L.length && !L[j].startsWith("## ")) j++
  const title = L[i].slice(3).trim()
  return { title, link: `assistant/knowledge/07367c34/${file}#${slug(title)}`, body: L.slice(i + 1, j) }
}
const word = (t, w) => new RegExp(`(^|[^A-Za-z0-9_])${w}($|[^A-Za-z0-9_])`, "i").test(t)

// ---- rendering ----
const aiShort = (ai, detail) => `${ai.kind} by ${ai.reviewer} recorded${detail ? ` (${ai.scope})` : " (scoped to named mechanics; see --detail)"}; ${ai.projectOwnerReviewed ? "project-owner review also recorded" : "NOT a project-owner review"}; ${ai.gameplayTested ? "gameplay-tested" : "NOT gameplay-tested"}`
function reviewText(review, kind, name, detail) {
  if (review[kind][name] === "reviewed") return "independently reviewed (see automation/review-status.json)"
  const ai = aiOf(review, kind, name)
  return `source-traced; independent review pending${ai ? `; ${aiShort(ai, detail)}` : "; no AI review recorded"}`
}
const sentence = (s) => (s === undefined || s === null ? "" : String(s).trim())
const noDot = (s) => sentence(s).replace(/\.+$/, "")
const arr = (a) => (a.length ? a.join(", ") : "none")

function ability(L, key, rec, ctx, detail) {
  const { review, pilot } = ctx
  const a = rec.appliesTo.find((u) => u.key === key)
  const file = pilot.includes(rec.ability) ? "pilot-abilities" : "reusable-abilities"
  const sec = noteSection(`${file}.md`, (t) => t === rec.ability || t.startsWith(`${rec.ability} `) || t.startsWith(`${rec.ability}—`) || t.startsWith(`${rec.ability} —`))
  L.push(`Ability ${rec.ability} — ${reviewText(review, "abilities", rec.ability, detail)}. ${a.stars}★, maxPP ${a.maxPP}, range ${a.range}.`)
  if (rec.importRecheck) L.push(`  Imported after a recheck against the pinned source (${rec.importRecheck.run}); corrections are in the record's importRecheck.`)
  if (detail && rec.scope) L.push(`  Scope: ${sentence(rec.scope)}`)
  if (rec.summary) L.push(`  Summary: ${sentence(rec.summary)}`)
  if (rec.targeting) L.push(`  Targets: ${rec.targeting.who}${rec.targeting.note ? `; ${noDot(rec.targeting.note)}` : ""}${rec.geometry ? `. Geometry: ${rec.geometry.shape}${rec.geometry.cells ? ` (${rec.geometry.cells} cells)` : ""}` : ""}.`)
  for (const e of rec.effects ?? []) {
    const pu = e.perUnitRaw ? e.perUnitRaw[key] : e.declaredRaw?.byStars ? rec.starBehavior?.declaredRawDamage?.[key] : undefined
    L.push(`  - ${e.kind}${e.damageType ? ` (${e.damageType})` : ""}${e.stat ? ` ${e.stat}` : ""}${e.target ? ` → ${e.target}` : ""}${e.condition ? `, ${e.condition}` : ""}: raw ${rawDesc(e.declaredRaw)}${pu !== undefined ? ` → this unit (${a.stars}★): raw ${typeof pu === "object" ? JSON.stringify(pu) : pu}` : ""}.`)
    L.push(`    Scaling: ${sentence(e.scaling)}${e.resolution ? ` Resolution: ${sentence(e.resolution)}` : ""}`)
    if (e.conditional) {
      const c = e.conditional, vs = Object.entries(c).find(([k]) => /^perUnitRaw(Vs|If)/.test(k))?.[1]?.[key]
      const what = c.multiplier !== undefined ? `raw ×${c.multiplier}` : c.replacementRaw !== undefined ? `raw ${c.replacementRaw}${c.replacementDamageType ? ` as ${c.replacementDamageType}` : ""} instead of the table value` : "see record"
      L.push(`    Conditional: ${c.condition} → ${what}${vs !== undefined ? ` (this unit: raw ${vs})` : ""}. ${sentence(c.note)}`.trimEnd())
    }
  }
  if (rec.identifierOnlyBehavior) {
    L.push(`  The bare skill ${rec.ability} is a placeholder; as a cast it does: ${rec.identifierOnlyBehavior.effects}.`)
    L.push(`  Mode selection (conditional): ${rec.modeSelection.mechanism}. Applied to ${rec.modeSelection.appliedTo}.`)
    for (const m of rec.modes) {
      L.push(`  - ${m.mode} — ${m.setBy}; range ${m.rangeSet}; needs target: ${m.requiresTarget}. ${m.does.join(" ")}`)
      if (m.nextAttackBonus) L.push(`    Next-attack bonus (raw): base ${rawTable(m.nextAttackBonus.declaredRaw.base)}; per allied Combee ${rawTable(m.nextAttackBonus.declaredRaw.perAlliedCombee)}; Vespiquen 3★ ${m.nextAttackBonus.declaredRaw.vespiquen3Star}, N = ${m.nextAttackBonus.N}. ${sentence(m.nextAttackBonus.scaling)}`)
      if (m.heal) L.push(`    Heal (raw): ${rawTable({ 1: m.heal.declaredRaw["1"], 2: m.heal.declaredRaw["2"], 3: m.heal.declaredRaw["3"], 4: m.heal.declaredRaw["4"] })}; Vespiquen ${m.heal.declaredRaw.vespiquen3Star}. ${sentence(m.heal.scaling)}. ${sentence(m.heal.stacking)}`)
      if (m.shield) L.push(`    Shield (raw): ${rawTable({ 1: m.shield.declaredRaw["1"], 2: m.shield.declaredRaw["2"], 3: m.shield.declaredRaw["3"], 4: m.shield.declaredRaw["4"] })}; Vespiquen ${m.shield.declaredRaw.vespiquen3Star}. ${sentence(m.shield.scaling)}`)
    }
    L.push("  Acquisition caveat: the mode is written when the unit is moved to rows 1–3; paths that skip that handler (for example evolution) were not traced, so such a Vespiquen may keep the placeholder skill.")
  }
  for (const st of rec.statusEffects ?? []) {
    L.push(`  - status ${st.status} → ${st.target}: raw ${rawTable(st.declaredRaw.byStars ?? { duration: `${st.declaredRaw.duration} ${st.declaredRaw.unit}` })}${st.perUnitRaw?.[key] !== undefined ? ` → this unit: raw ${st.perUnitRaw[key]}${st.declaredRaw.unit ? " " + st.declaredRaw.unit : ""}` : ""}.`)
    L.push(`    Scaling: ${sentence(st.scaling)} Guards: ${sentence(st.guards)}${st.applicationOrder ? ` Order: ${sentence(st.applicationOrder)}` : ""}`)
    L.push(`    Combat effect (traced): ${sentence(st.combatEffect)}`)
  }
  if (rec.positionalConditions) L.push(`  Positional: ${sentence(rec.positionalConditions)}`)
  if (rec.repeatedCastsAndModes) L.push(`  Repeated casts / modes: ${sentence(rec.repeatedCastsAndModes)}`)
  if (rec.rawVsResolved) L.push(`  Raw vs resolved: ${sentence(rec.rawVsResolved)}`)
  if (rec.unresolved?.length) { L.push("  Unresolved / not established:"); for (const u of rec.unresolved) L.push(`   · ${sentence(u)}`) }
  if (detail) {
    if (rec.appliesTo.length > 1) L.push(`  Shared record: declared by ${rec.appliesTo.map((u) => `${u.key} (${u.stars}★)`).join(", ")}; only these units are covered.`)
    if (rec.dependsOnUnverifiedGenericCombat?.length) { L.push("  Depends on generic combat processing that is unverified:"); for (const d of rec.dependsOnUnverifiedGenericCombat) L.push(`   · ${sentence(d)}`) }
  } else if (rec.dependsOnUnverifiedGenericCombat?.length) L.push(`  Raw amounts only: final damage/healing/shield results depend on the generic combat pipeline (${rec.dependsOnUnverifiedGenericCombat.length} unverified dependencies listed under --detail).`)
  L.push(`  Source: data/07367c34/${file}.json#abilities.${rec.ability}${sec ? `; note ${sec.link}` : ""}`)
}

function passive(L, key, s, ctx, detail) {
  const { reusable, review } = ctx, p = s.passive
  if (p === "NONE") { L.push("Passive: none declared."); return }
  const rec = own(reusable.passives, p) && reusable.passives[p].appliesTo.some((u) => u.key === key) ? reusable.passives[p] : null
  const gap = own(reusable.passiveGaps, p) && reusable.passiveGaps[p].appliesTo.some((u) => u.key === key) ? reusable.passiveGaps[p] : null
  if (gap) { L.push(`Passive ${p}: GAP — not covered. ${sentence(gap.status)}`); return }
  if (!rec) { L.push(`Passive ${p}: no canonical passive record for ${key} (identifier only; no behaviour is assumed from the name or from other units).`); return }
  const sec = noteSection("reusable-abilities.md", (t) => word(t, p))
  L.push(`Passive ${p} — ${reviewText(review, "passives", p, detail)}.`)
  if (rec.notApplied) L.push(`  Applies to: ${sentence(rec.notApplied)}`)
  L.push(`  Summary: ${sentence(rec.summary)}`)
  for (const t of rec.triggers ?? []) L.push(`  Trigger (${t.event}): ${sentence(t.effect)} — ${sentence(t.note)}`)
  for (const e of rec.effects ?? []) L.push(`  - ${e.kind}${e.stat ? ` ${e.stat}` : ""}${e.amount !== undefined ? ` ${e.amount > 0 ? "+" : ""}${e.amount}` : ""}${e.permanent ? " (permanent)" : ""}: ${sentence(e.scaling)}`)
  for (const c of rec.conditions ?? []) L.push(`  Condition: ${sentence(c)}`)
  if (rec.evolution) L.push(`  Evolution link: ${sentence(rec.evolution.declared)}. Trigger: ${sentence(rec.evolution.trigger)}. Gate: ${sentence(rec.evolution.gate)}. Result: ${sentence(rec.evolution.result)}. Plain case: ${sentence(rec.evolution.plainCaseArithmetic)}.`)
  if (rec.evolution?.lifecycle) L.push(`  Lifecycle: fresh Annihilape — ${sentence(rec.evolution.lifecycle.freshAnnihilape)}; existing entity after a mid-fight evolution — ${sentence(rec.evolution.lifecycle.existingEntityAfterMidFightEvolution)}; ${sentence(rec.evolution.lifecycle.status)}`)
  L.push(`  Reset behaviour: ${sentence(rec.resetBehaviour)}`)
  if (rec.unresolved?.length) { L.push("  Unresolved / not established:"); for (const u of rec.unresolved) L.push(`   · ${sentence(u)}`) }
  if (detail && rec.dependsOnUnverifiedGenericCombat?.length) { L.push("  Depends on generic combat processing that is unverified:"); for (const d of rec.dependsOnUnverifiedGenericCombat) L.push(`   · ${sentence(d)}`) }
  L.push(`  Source: data/07367c34/reusable-abilities.json#passives.${p}${sec ? `; note ${sec.link}` : ""}`)
}

function evolution(L, key, cat, evo) {
  const bare = cat.pokemon[key].bareInstanceEvolution
  if (!own(evo.units, key)) {
    L.push(`Evolution: NOT covered (outside the 20-unit evolution pilot). Raw class fields only: evolution ${bare.evolution}${bare.evolution === "DEFAULT" ? " (none declared)" : ""}, evolutions [${bare.evolutions.join(", ")}]; not a complete evolution map, and not a statement that the unit is terminal.`)
    return
  }
  const u = evo.units[key], d = u.declaredEvolution, r = u.evolutionRule, props = r.properties
  const sec = noteSection("pilot-evolution.md", (t) => word(t, key)) ?? noteSection("evolution-context.md", (t) => word(t, key.replace(/_/g, " ")) || word(t, key))
  const params = []
  if (props.numberRequired?.present) params.push(`numberRequired ${props.numberRequired.value}`)
  if (props.itemsTriggeringEvolution?.present) params.push(`${props.itemsTriggeringEvolution.value.length} trigger items`)
  if (props.moneyRequired?.present) params.push(`moneyRequired ${props.moneyRequired.value}`)
  L.push(`Evolution (pilot record): declared evolution ${d.evolution}${d.evolution === "DEFAULT" ? " (none)" : ""}, evolutions [${d.evolutions.join(", ")}], stacksRequired ${d.stacksRequired}. ${u.evolutionEvidence.status === "declares-evolution" ? "The class declares an evolution." : "Terminal in the declarations (a shown rule would be the inherited default, not evidence of evolving)."} Rule: ${r.type}${params.length ? ` (${params.join(", ")})` : ""}, handler ${r.handler.class}${r.matchesInheritedBaseDefault ? "; equals the inherited base default, not a class-specific rule" : ""}.`)
  for (const [n, p] of Object.entries(props)) if (p.present && p.kind === "callback") L.push(`  Callback ${n} at ${p.source.file}:${p.source.line}; its behaviour is described in the note.`)
  if (sec) { for (const x of unresolvedLines(sec)) L.push(`  ${sentence(x).replace(/^- /, "")}`); L.push(`  Source: data/07367c34/pilot-evolution.json#units.${key}; note ${sec.link}`) } else L.push(`  Source: data/07367c34/pilot-evolution.json#units.${key}`)
}

function unit(L, key, ctx, detail) {
  const { cat, evo, abi, review } = ctx, r = cat.pokemon[key], s = r.stats
  const covering = Object.values(abi.abilities).filter((x) => x.appliesTo.some((u) => u.key === key))
  L.push(`[UNIT] ${key} — ${r.types.join("/")}, ${s.rarity}, ${s.stars}★ (bare instance; shop availability and playability not established). Family root ${r.evolutionFamilyRoot}.`)
  L.push(`Stats: HP ${s.hp}${s.maxHP !== s.hp ? ` (max ${s.maxHP})` : ""}, ATK ${s.atk}, DEF ${s.def}, SPE_DEF ${s.speDef}, speed ${s.speed}, range ${s.range}, maxPP ${s.maxPP}, AP ${s.ap}, luck ${s.luck}, crit ${s.critChance}% ×${s.critPower}. Skill ${s.skill}, passive ${s.passive}${s.tm !== "DEFAULT" ? `, TM ${s.tm}` : ""}.`)
  if (!s.canHoldItems || !s.canBeBenched || !s.canBeSold) L.push(`Class flags: canHoldItems=${s.canHoldItems}, canBeBenched=${s.canBeBenched}, canBeSold=${s.canBeSold}.`)
  if (r.fieldAvailability) for (const [f, v] of Object.entries(r.fieldAvailability)) L.push(`Field ${f} is absent on this revision (${v.note}).`)
  if (!covering.length) {
    const same = Object.values(abi.abilities).filter((x) => x.ability === s.skill)
    L.push(`Ability ${s.skill}: NOT covered — no canonical ability record applies to ${key}.${same.length ? ` A record for ${s.skill} exists but covers only ${same.flatMap((x) => x.appliesTo.map((u) => u.key)).join(", ")}; it is not applied here.` : ""} No description is invented.`)
  } else for (const rec of covering) ability(L, key, rec, ctx, detail)
  passive(L, key, s, ctx, detail)
  evolution(L, key, cat, evo)
}

function listUnits(ctx) {
  const { cat, evo, abi, reusable } = ctx
  const L = [`Unit coverage — ${Object.keys(cat.pokemon).length} catalog units with baseline records; ${Object.keys(abi.abilities).length} ability records, ${Object.keys(reusable.passives).length} passive records, ${Object.keys(reusable.passiveGaps).length} labelled passive gap(s), ${Object.keys(evo.units).length} evolution-pilot units. Coverage is per unit (appliesTo), never inferred from family or a shared skill identifier.`]
  for (const [n, r] of Object.entries(abi.abilities)) L.push(`Ability ${n}: ${r.appliesTo.map((u) => u.key).join(", ")}`)
  for (const [n, r] of Object.entries(reusable.passives)) L.push(`Passive ${n}: ${r.appliesTo.map((u) => u.key).join(", ")}`)
  for (const [n, r] of Object.entries(reusable.passiveGaps)) L.push(`Passive gap ${n}: ${r.appliesTo.map((u) => u.key).join(", ")}`)
  L.push(`Evolution pilot: ${Object.keys(evo.units).join(", ")}`)
  return L
}

function items(o, names, extra) {
  const args = [resolve(HERE, "lookup-item.mjs"), ...extra, ...(o.dataDir ? ["--data-dir", o.dataDir] : [])]
  const r = spawnSync(process.execPath, args.concat(names), { encoding: "utf8" })
  if (r.status !== 0) fail(r.status ?? 2, (r.stderr || "lookup-item failed").trimEnd())
  return r.stdout.split("\n").filter((l, i) => !(i === 0 && l.startsWith("Snapshot:"))).join("\n").replace(/^\n+/, "").trimEnd()
}

function main() {
  const o = parse(process.argv.slice(2))
  const out = []
  if (o.itemList && o.items.length) fail(1, "--item-list cannot be combined with --item.")
  // items and component lists first: they validate their own names, so a bad request prints nothing partial
  let itemText = null, compText = null, listText = null
  if (o.items.length) itemText = items(o, o.items, [])
  if (o.component !== null) compText = items(o, [], ["--component", o.component])
  if (o.itemList) listText = items(o, [], ["--list"])
  let ctx = null, keys = []
  if (o.units.length || o.list) {
    ctx = load(o)
    ctx.pilot = ctx.pilotNames
    keys = [...new Set(o.units.map((u) => resolveUnit(u, ctx.cat)))]
  }
  out.push(`FAST lookup — production-branch reference ${SHA.slice(0, 8)}; deployment unverified. Saved canonical data only; source-traced, no gameplay evidence. Ability/passive amounts are RAW declared values, not final damage/healing.`)
  if (o.list) out.push("", ...listUnits(ctx))
  keys.forEach((k) => { const L = []; unit(L, k, ctx, o.detail); out.push("", ...L) })
  if (itemText) out.push("", "[ITEMS]", itemText)
  if (compText) out.push("", "[COMPONENT]", compText)
  if (listText) out.push("", "[ITEM LIST]", listText)
  process.stdout.write(out.join("\n") + "\n")
}
try { main() } catch (e) {
  if (e instanceof Refusal) { process.stderr.write(`lookup-fast: ${e.code === 3 ? "REFUSED — " : ""}${e.message}\n`); process.exit(e.code) }
  throw e
}
