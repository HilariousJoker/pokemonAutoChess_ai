// Validates assistant/data/07367c34/pilot-abilities.json against the pinned source (read with `git show <sha>:<path>`; no checkout needed,
// only that the commit object exists locally) and checks that knowledge/07367c34/pilot-abilities.md agrees with the records.
// Production-branch reference; deployment unverified. Usage: node assistant/validate-abilities.mjs   (exit 0 = all checks pass)
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { checkRecord, makeContext } from "./automation/record-checks.mjs"

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


// ===== 6. reusable-abilities.json: NUZZLE / DRAGON_RAGE / THRASH and the imported BUG_BUZZ / FOUL_PLAY / LEAF_BLADE / SOAK / TORMENT / IRON_DEFENSE / MACH_PUNCH / ROCK_SLIDE / SLASH / VENOSHOCK / AERIAL_ACE / AQUA_TAIL / CLANGOROUS_SOUL / CRABHAMMER / DISCHARGE / DIVE / DOUBLE_SHOCK / DRAGON_TAIL / FAKE_TEARS / FIRE_LASH / KING_SHIELD / LEECH_SEED / FLAME_CHARGE / SLUDGE / VOLT_SWITCH / FLOWER_TRICK / DARKEST_LARIAT / DRAGON_BREATH / DRUM_BEATING / EXPANDING_FORCE ability records, SURGE_SURFER / PRIMEAPE passive records, PACHIRISU gap =====
const reuse = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/reusable-abilities.json"), "utf8"))
const catalog = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/catalog-units.json"), "utf8"))
const reuseMd = readFileSync(resolve(HERE, "knowledge/07367c34/reusable-abilities.md"), "utf8")
if (reuse.sourceSha !== SHA) bad(`reusable-abilities.json sourceSha is ${reuse.sourceSha}`)
if (!/production-branch reference; deployment unverified/.test(reuse.label)) bad("reusable-abilities.json label missing")
for (const k of Object.keys(A)) if (Object.hasOwn(reuse.abilities, k)) bad(`reusable-abilities.json overrides pilot record ${k}`)
const RA = reuse.abilities, RP = reuse.passives, RG = reuse.passiveGaps
const allRecs = [...Object.entries(RA), ...Object.entries(RP), ...Object.entries(RG)]
let nEv2 = 0
const idsUsed = (o, acc = new Set()) => {
  if (Array.isArray(o)) o.forEach((x) => idsUsed(x, acc))
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (k === "evidence" && Array.isArray(v) && typeof v[0] === "string") v.forEach((i) => acc.add(i)); else idsUsed(v, acc) }
  return acc
}
for (const [name, rec] of allRecs) {
  if (rec.sourceSha !== SHA) bad(`reuse ${name}: sourceSha`)
  const ids = new Set()
  for (const e of rec.evidence) {
    nEv2++
    if (ids.has(e.id)) bad(`reuse ${name}: duplicate evidence id ${e.id}`)
    ids.add(e.id)
    const L = src(e.file)
    const [a, b] = e.lines
    if (!(a >= 1 && b >= a && b <= L.length)) { bad(`reuse ${name}/${e.id}: bad line range ${a}-${b} in ${e.file}`); continue }
    if (!norm(L.slice(a - 1, b).join(" ")).includes(norm(e.expect))) bad(`reuse ${name}/${e.id}: "${e.expect}" not found in ${e.file}:${a}-${b}`)
  }
  for (const id of idsUsed({ ...rec, evidence: undefined })) if (!ids.has(id)) bad(`reuse ${name}: unknown evidence id ${id}`)
  for (const id of ids) if (!idsUsed({ ...rec, evidence: undefined }).has(id)) bad(`reuse ${name}: evidence ${id} is never referenced`)
  if (RA[name]) {
    if (!rec.unresolved?.length) bad(`reuse ${name}: no unresolved list`)
    if (!rec.dependsOnUnverifiedGenericCombat?.length) bad(`reuse ${name}: no generic-combat dependency list`)
    if (rec.ability !== name) bad(`reuse ${name}: ability field`)
  }
  if (RP[name] && (!rec.unresolved?.length || !rec.dependsOnUnverifiedGenericCombat?.length)) bad(`reuse passive ${name}: missing unresolved / dependency list`)
  // unit facts against the saved catalog (stars, PP, range, skill, passive), and the unit class block in the pinned source
  for (const u of rec.appliesTo) {
    const c = catalog.pokemon[u.key]
    if (!c) { bad(`reuse ${name}: ${u.key} not in catalog`); continue }
    const s = c.stats
    if (s.stars !== u.stars || s.maxPP !== u.maxPP || s.range !== u.range) bad(`reuse ${name}: ${u.key} stars/maxPP/range disagree with the catalog`)
    if (s.skill !== u.declaredSkill) bad(`reuse ${name}: ${u.key} skill ${u.declaredSkill} vs catalog ${s.skill}`)
    if (s.passive !== u.declaredPassive) bad(`reuse ${name}: ${u.key} passive ${u.declaredPassive} vs catalog ${s.passive}`)
    const cls = catalog.registry[u.key].registeredClass
    const text = src("app/models/colyseus-models/pokemon.ts").join("\n")
    const m = text.match(new RegExp(`export class ${cls} extends Pokemon \\{([\\s\\S]*?)\\n\\}`))
    if (!m) { bad(`reuse ${name}: class ${cls} not found in pokemon.ts`); continue }
    if (!m[1].includes(`skill = Ability.${u.declaredSkill}`)) bad(`reuse ${name}: class ${cls} does not declare skill ${u.declaredSkill}`)
    if (u.declaredPassive === "NONE" ? /passive = Passive\./.test(m[1]) : !m[1].includes(`passive = Passive.${u.declaredPassive}`)) bad(`reuse ${name}: class ${cls} passive disagrees with ${u.declaredPassive}`)
    if (!m[1].includes(`stars = ${u.stars}`)) bad(`reuse ${name}: class ${cls} stars disagree`)
  }
}
// coverage completeness against the catalog: every catalog unit with these skills/passives is bound, no others
const boundBy = (field, id) => Object.entries(catalog.pokemon).filter(([, v]) => v.stats[field] === id).map(([k]) => k).sort()
const IMPORTED = { BUG_BUZZ: "BugBuzzStrategy", FOUL_PLAY: "FoulPlayStrategy", LEAF_BLADE: "LeafBladeStrategy", SOAK: "SoakStrategy", TORMENT: "TormentStrategy", IRON_DEFENSE: "IronDefenseStrategy", MACH_PUNCH: "MachPunchStrategy", ROCK_SLIDE: "RockSlideStrategy", SLASH: "SlashStrategy", VENOSHOCK: "VenoshockStrategy", AERIAL_ACE: "AerialAceStrategy", AQUA_TAIL: "AquaTailStrategy", CLANGOROUS_SOUL: "ClangorousSoulStrategy", CRABHAMMER: "CrabHammerStrategy", DISCHARGE: "DischargeStrategy", DIVE: "DiveStrategy", DOUBLE_SHOCK: "DoubleShockStrategy", DRAGON_TAIL: "DragonTailStrategy", FAKE_TEARS: "FakeTearsStrategy", FIRE_LASH: "FireLashStrategy", KING_SHIELD: "KingShieldStrategy", LEECH_SEED: "LeechSeedStrategy", FLAME_CHARGE: "FlameChargeStrategy", SLUDGE: "SludgeStrategy", VOLT_SWITCH: "VoltSwitchStrategy", FLOWER_TRICK: "FlowerTrickStrategy", DARKEST_LARIAT: "DarkestLariatStrategy", DRAGON_BREATH: "DragonBreathStrategy", DRUM_BEATING: "DrumBeatingStrategy", EXPANDING_FORCE: "ExpandingForceStrategy" } // imported from candidates after a source recheck
for (const id of ["NUZZLE", "DRAGON_RAGE", "THRASH", ...Object.keys(IMPORTED)]) eq(RA[id].appliesTo.map((u) => u.key).sort(), boundBy("skill", id), `${id} appliesTo vs catalog skill bindings`)
eq(RP.SURGE_SURFER.appliesTo.map((u) => u.key).sort(), boundBy("passive", "SURGE_SURFER"), "SURGE_SURFER appliesTo vs catalog")
eq(RP.PRIMEAPE.appliesTo.map((u) => u.key).sort(), boundBy("passive", "PRIMEAPE"), "PRIMEAPE appliesTo vs catalog")
eq(RG.PACHIRISU.appliesTo.map((u) => u.key).sort(), boundBy("passive", "PACHIRISU"), "PACHIRISU gap appliesTo vs catalog")
// registry bindings
for (const [id, cls] of [["NUZZLE", "NuzzleStrategy"], ["DRAGON_RAGE", "DragonRageStrategy"], ["THRASH", "ThrashStrategy"], ...Object.entries(IMPORTED)]) {
  if (!src("app/core/abilities/abilities.ts").some((l) => l.includes(`[Ability.${id}]: new ${cls}()`))) bad(`registry entry ${id} -> ${cls} not found`)
}
// imported records: the recheck is recorded, and the review metadata never claims owner review or gameplay testing
const reviewStatus = JSON.parse(readFileSync(resolve(HERE, "automation/review-status.json"), "utf8"))
for (const id of Object.keys(IMPORTED)) {
  if (!RA[id].importRecheck?.notes?.length || !RA[id].importRecheck.run) bad(`${id}: importRecheck (run + notes) missing`)
  const rs = reviewStatus.records[`data/07367c34/reusable-abilities.json#abilities.${id}`]
  if (!rs) { bad(`review-status.json has no entry for the imported record ${id}`); continue }
  if (rs.status !== "unreviewed") bad(`${id}: review status is ${rs.status}; an AI review must not make an imported record 'reviewed' (owner acceptance only)`)
  const ai = rs.aiReview
  if (!ai || ai.reviewer !== "Codex" || ai.kind !== "independent AI source review" || ai.projectOwnerReviewed !== false || ai.gameplayTested !== false) bad(`${id}: aiReview must name Codex as an independent AI source review with projectOwnerReviewed=false and gameplayTested=false`)
}
// declared tables equal the arrays in the source text
const tbl = (file, re) => table(file, re)
const nzDmg = tbl("app/core/abilities/nuzzle.ts", /const damage = \[([^\]]+)\]/)
const nzDur = tbl("app/core/abilities/nuzzle.ts", /const duration = \[([^\]]+)\]/)
const drInit = tbl("app/core/abilities/dragon-rage.ts", /const initialShield = \[([^\]]+)\]/)
const drShield = tbl("app/core/abilities/dragon-rage.ts", /const shield = \[([^\]]+)\]/)
const drDamage = tbl("app/core/abilities/dragon-rage.ts", /const damage = \[([^\]]+)\]/)
const thBuff = tbl("app/core/abilities/thrash.ts", /const atkBuff = \[([^\]]+)\]/)
eq(byStars(RA.NUZZLE.effects[0].declaredRaw.byStars), nzDmg, "NUZZLE damage table")
eq(byStars(RA.NUZZLE.statusEffects[0].declaredRaw.byStars), nzDur, "NUZZLE paralysis duration table")
eq(byStars(RA.DRAGON_RAGE.effects[0].declaredRaw.byStars), drDamage, "DRAGON_RAGE pulse damage table")
eq(byStars(RA.DRAGON_RAGE.effects[1].declaredRaw.byStars), drInit, "DRAGON_RAGE initial shield table")
eq(byStars(RA.DRAGON_RAGE.effects[1].declaredRaw.perPulseByStars), drShield, "DRAGON_RAGE per-pulse shield table")
eq(byStars(RA.THRASH.effects[0].declaredRaw.byStars), thBuff, "THRASH attack-percent table")
const srcFull = (f) => src(f).join("\n")
const dr = srcFull("app/core/abilities/dragon-rage.ts")
if (!/ticksRemaining = 6\b/.test(dr) || !/EffectEnum\.DRAGON_RAGE,\s*1000/.test(dr) || !/Math\.round\(shieldToConvert \* 0\.4\)/.test(dr)) bad("DRAGON_RAGE ticks / interval / 0.4 conversion not confirmed")
if (!/triggerConfusion\(3000, pokemon, pokemon\)/.test(srcFull("app/core/abilities/thrash.ts"))) bad("THRASH confusion 3000 ms not confirmed")
// per-unit values equal the table at the unit's catalog stars
const at = (arr, stars) => arr[stars - 1] ?? arr[arr.length - 1]
for (const u of RA.NUZZLE.appliesTo) {
  if (RA.NUZZLE.effects[0].perUnitRaw[u.key] !== at(nzDmg, u.stars)) bad(`NUZZLE perUnitRaw damage ${u.key}`)
  if (RA.NUZZLE.statusEffects[0].perUnitRaw[u.key] !== at(nzDur, u.stars)) bad(`NUZZLE perUnitRaw duration ${u.key}`)
}
if (RA.DRAGON_RAGE.effects[0].perUnitRaw.GYARADOS !== at(drDamage, 3) || RA.DRAGON_RAGE.effects[1].perUnitRaw.GYARADOS !== at(drInit, 3)) bad("DRAGON_RAGE perUnitRaw")
// the DRAGON_RAGE effect flag is used only in its own file (server code; git grep over the pinned tree)
const used = execFileSync("git", ["-C", REPO, "grep", "-l", "EffectEnum.DRAGON_RAGE", SHA, "--", "app"], { encoding: "utf8" }).trim().split("\n").map((l) => l.replace(`${SHA}:`, "")).sort()
eq(used, ["app/core/abilities/dragon-rage.ts"], "EffectEnum.DRAGON_RAGE uses")
// passive registry: PRIMEAPE has PassiveEffects entries, SURGE_SURFER has none (its logic is in status.ts)
const passivesSrc = srcFull("app/core/effects/passives.ts")
if (!/\[Passive\.PRIMEAPE\]:\s*\[/.test(passivesSrc)) bad("PassiveEffects[Passive.PRIMEAPE] not found")
if (/\[Passive\.SURGE_SURFER\]\s*:/.test(passivesSrc)) bad("PassiveEffects unexpectedly has a SURGE_SURFER entry")
const statusSrc = srcFull("app/models/colyseus-models/status.ts")
if ((statusSrc.match(/entity\.passive === Passive\.SURGE_SURFER/g) ?? []).length !== 4) bad("expected exactly 4 SURGE_SURFER passive checks in status.ts")
const surgeOther = execFileSync("git", ["-C", REPO, "grep", "-n", "Passive.SURGE_SURFER", SHA, "--", "app/core", "app/models"], { encoding: "utf8" }).trim().split("\n").filter((l) => !l.includes("colyseus-models/status.ts"))
if (surgeOther.length !== 1 || !surgeOther[0].includes("colyseus-models/pokemon.ts")) bad(`unexpected Passive.SURGE_SURFER uses outside status.ts: ${surgeOther.join(" | ")}`)
// numeric examples: recomputed from the source tables, with their stated conditions kept in the record
const examples = allRecs.flatMap(([n, r]) => (r.numericExamples ?? []).map((x) => [n, x]))
let nEx = 0
for (const [n, x] of examples) {
  nEx++
  if (!x.conditions || x.conditions.length < 20) bad(`example ${x.id}: no conditions`)
  let got
  if (x.kind === "specialAfterSpeDef") got = Math.max(1, Math.ceil((x.raw * (1 + x.ap / 100)) / (1 + 0.05 * x.speDef)))
  else if (x.kind === "thrashAtk") got = Math.round(Math.floor(((at(thBuff, x.stars)) / 100) * x.baseAtk) * (1 + x.ap / 100))
  else if (x.kind === "dragonRageTotals") {
    const init = at(drInit, x.stars), per = at(drShield, x.stars), tracked = init + 6 * per
    got = { initial: init, perPulse: per, pulses: 6, trackedShield: tracked, shieldRemovedIfAllPresent: tracked, baseHealRequest: Math.round(0.4 * tracked) }
  } else if (x.kind === "surgeSpeed") got = x.baseSpeed + 30 * x.fields
  else if (x.kind === "primeapeEvolution") {
    const stacks = x.stacksRequired
    if (stacks !== 10) bad("primeape stacksRequired example")
    got = x.annihilapeFactoryAtk + (x.primeapeAtk + stacks - x.primeapeAtk) - x.onAcquiredDelta
    if (x.primeapeAtk + stacks !== 30) bad("primeape example: atk after 10 stacks")
  } else { bad(`example ${x.id}: unknown kind ${x.kind}`); continue }
  const want = x.kind === "primeapeEvolution" ? x.expectedAnnihilapeAtk : x.expected
  if (JSON.stringify(got) !== JSON.stringify(want)) bad(`example ${x.id}: recomputed ${JSON.stringify(got)} vs record ${JSON.stringify(want)}`)
}
// the example arithmetic's constants are themselves tied to the source
if (!/ARMOR_FACTOR = 0\.05/.test(srcFull("app/config/game/battle.ts"))) bad("ARMOR_FACTOR 0.05 not confirmed")
const ssTier = /Status|status/.test(statusSrc) && (statusSrc.match(/entity\.addSpeed\(30, entity, 0, false\)/g) ?? []).length === 2 && (statusSrc.match(/entity\.addSpeed\(-30, entity, 0, false\)/g) ?? []).length === 2
if (!ssTier) bad("SURGE_SURFER +30/-30 speed calls not confirmed (expected 2 + 2)")
// Primeape: STACK rule, 10 stacks, exact-equality evolution trigger, atk revert on acquisition
const pk = srcFull("app/models/colyseus-models/pokemon.ts")
const pm = pk.match(/export class Primeape extends Pokemon \{([\s\S]*?)\n\}/)?.[1] ?? ""
if (!/EvolutionRuleType\.STACK/.test(pm) || !/stacksRequired = 10/.test(pm)) bad("Primeape STACK / stacksRequired 10 not confirmed")
if (!/this\.stacks === this\.stacksRequired/.test(srcFull("app/core/pokemon-entity.ts"))) bad("addStack exact-equality test not confirmed")
if (!/this\.atk -= 30 - 20/.test(pk)) bad("Annihilape.onAcquired atk revert not confirmed")
// the Markdown note agrees with the records
for (const n of [...Object.keys(RA)]) if (!reuseMd.includes(`abilities.${n}`)) bad(`reusable-abilities.md does not link record abilities.${n}`)
for (const n of Object.keys(RP)) if (!reuseMd.includes(`passives.${n}`)) bad(`reusable-abilities.md does not link record passives.${n}`)
if (!reuseMd.includes("passiveGaps.PACHIRISU")) bad("reusable-abilities.md does not mention the PACHIRISU gap")
const sl = (a) => a.join(" / ")
for (const [what, s] of [
  ["NUZZLE damage", sl(nzDmg)], ["NUZZLE duration", sl(nzDur)], ["DRAGON_RAGE initial shield", sl(drInit)], ["DRAGON_RAGE per-pulse shield", sl(drShield)],
  ["DRAGON_RAGE per-pulse damage", sl(drDamage)], ["THRASH percent", sl(thBuff)], ["SHA", SHA], ["label", "Production-branch reference; deployment unverified"],
  ["Gyarados total", "45 + 6 × 15 = 135"], ["Gyarados heal", "54"], ["Annihilape 36", "+36"], ["name collision", "EffectEnum.SURGE_SURFER"]
]) if (!reuseMd.includes(s)) bad(`reusable-abilities.md lacks ${what}: "${s}"`)

// ===== 7. shared record checks (automation/record-checks.mjs) applied to every existing record: revision, required fields, evidence, unit bindings, source tables =====
const shared = makeContext()
let nShared = 0
const runShared = (kind, name, rec) => { const r = checkRecord(kind, name, rec, shared, { profile: "common" }); nShared++; r.problems.forEach(bad) }
for (const [n, r] of Object.entries(A)) runShared("ability", n, r)
for (const [n, r] of Object.entries(RA)) runShared("ability", n, r)
for (const [n, r] of Object.entries(RP)) runShared("passive", n, r)
for (const [n, r] of Object.entries(RG)) runShared("gap", n, r)

const nEv = Object.values(A).reduce((n, r) => n + r.evidence.length, 0)
if (problems.length) { console.error(`FAILED (${problems.length}):\n- ${problems.join("\n- ")}`); process.exit(1) }
console.log(`OK: 3 pilot records (${nEv} evidence refs) + ${Object.keys(RA).length} reusable ability records, ${Object.keys(RP).length} passive records and ${Object.keys(RG).length} passive gap (${nEv2} evidence refs), ${nEx} numeric examples, ${nShared} records through the shared checks (automation/record-checks.mjs), verified against ${SHA.slice(0, 8)}; tables/bindings/units/Markdown agree`)
