// Representative checks for lookup-production.mjs. Writes ONLY fixture files under the OS temp dir (never under assistant/).
// Usage: node assistant/test-lookup-production.mjs   (exit 0 = all pass)
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const LOOKUP = resolve(HERE, "lookup-production.mjs")
const run = (...a) => { const r = spawnSync(process.execPath, [LOOKUP, ...a], { encoding: "utf8" }); return { code: r.status, out: r.stdout, err: r.stderr } }
let failures = 0
const check = (name, ok, detail = "") => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`) }
const has = (r, ...s) => s.every((x) => r.out.includes(x))
const lacks = (r, ...s) => s.every((x) => !r.out.includes(x))
const tree = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tree(join(d, e.name)) : [join(d, e.name)]))
const snapshot = () => tree(HERE).filter((f) => !f.includes("node_modules")).sort().map((f) => `${f}:${createHash("sha256").update(readFileSync(f)).digest("hex")}`).join("\n")
const before = snapshot()

const common = (r) => has(r, "Production-branch reference; deployment unverified", "07367c341fe928763da2b565c2eee010433e4fc1")
let r = run("CHARIZARD")
check("CHARIZARD: header + reviewed BLAST_BURN, raw 120", r.code === 0 && common(r) && has(r, "Reviewed: BLAST_BURN", "this unit (3★): **raw 120**", "RAW declared values", "adjacent to the CASTER") , r.err)
check("CHARIZARD: terminal wording, inherited default rule", has(r, "Terminal in the declarations", "inherited base default"))
r = run("TOTODILE")
check("TOTODILE: production CRUNCH (not BITE as its skill), raw 40", r.code === 0 && has(r, "Skill `CRUNCH`", "Reviewed: CRUNCH", "**raw 40**") && lacks(r, "Skill `BITE`"), r.err)
r = run("CROCONAW")
check("CROCONAW: CRUNCH record NOT applied (covers only TOTODILE)", r.code === 0 && has(r, "No ability record", "covers only TOTODILE", "not** applied") && lacks(r, "Reviewed: CRUNCH") , r.out.slice(0, 200))
r = run("VESPIQUEN")
check("VESPIQUEN: placeholder + conditional modes + acquisition uncertainty", r.code === 0 && has(r, "is a placeholder", "ATTACK_ORDER", "HEAL_ORDER", "DEFEND_ORDER", "moved to row 1", "Acquisition caveat", "Which skill a Vespiquen has when it was never moved"), r.err)
r = run("PIKACHU")
check("PIKACHU: evolution record, callback, probe, context-note link; NUZZLE now reviewed", r.code === 0 && has(r, "Covered** (pilot)", "divergentEvolution", "pokemon.ts:3226", "evolution-context.md#pikachu--raichu-or-alolan-raichu", "Executed stub probe", "Source-traced: NUZZLE", "this unit (2★): **raw 50**") && lacks(r, "No ability record"), r.err)
r = run("COSMOEM")
check("COSMOEM: stacksRequired 8, both context links, unresolved quoted", r.code === 0 && has(r, "`stacksRequired` = 8", "evolution-context.md#cosmoem--solgaleo-or-lunala", "evolution-context.md#cosmog--cosmoem-hp-and-stacks", "Unresolved", "pokemon.ts:14870"), r.err)
// ---- reusable ability / passive coverage (NUZZLE, DRAGON_RAGE, THRASH, SURGE_SURFER, PRIMEAPE; PACHIRISU gap) ----
r = run("PICHU")
check("PICHU: NUZZLE reviewed, 1 star raw 25, paralysis 3000 ms, shared-record notice, evolution coverage missing", r.code === 0 && has(r, "Coverage at a glance", "record `abilities.NUZZLE` (source-traced, independent review pending)", "**raw 25**", "**raw 3000 ms**", "Shared record", "not in the evolution pilot", "Passive identifier `NONE`") , r.err)
r = run("RAICHU")
check("RAICHU: NUZZLE 3 stars raw 100, example 67 with conditions, no passive", r.code === 0 && has(r, "this unit (3★): **raw 100**", "nz-raichu-ap0: 67", "target SPE_DEF 10", "none declared"), r.err)
r = run("ALOLAN_RAICHU")
check("ALOLAN_RAICHU: ability + structured SURGE_SURFER passive, name collision, direct-set exception, reset", r.code === 0 && has(r, "record `abilities.NUZZLE` (source-traced, independent review pending)", "structured record `passives.SURGE_SURFER` (source-traced, independent review pending)", "Name collision", "EffectEnum.SURGE_SURFER", "+30", "Volt Surge", "NOT the +30 speed", "Reset behaviour", "ss-two-fields: 114", "Unresolved"), r.err)
r = run("PACHIRISU")
check("PACHIRISU: NUZZLE reviewed (90 maxPP), passive reported as a GAP, nothing invented", r.code === 0 && has(r, "maxPP 90", "record `abilities.NUZZLE` (source-traced, independent review pending)", "**gap** — not covered", "NOT COVERED in this batch", "passiveGaps.PACHIRISU") && lacks(r, "Structured passive record:** yes"), r.err)
r = run("GYARADOS")
check("GYARADOS: DRAGON_RAGE raw 45 shield / 15 pulse, 6 pulses, conversion 0.4, recast rule, totals 135 / 54", r.code === 0 && has(r, "Source-traced: DRAGON_RAGE", "**raw 45**", "**raw 15**", "requests healing round(0.4 x C)", "base healing request", "ticksRemaining", "\"trackedShield\":135", "\"baseHealRequest\":54", "no new initial shield"), r.err)
r = run("MANKEY")
check("MANKEY: THRASH 100 % of baseAtk, self-confusion 3000 ms, no passive, not covered by PRIMEAPE", r.code === 0 && has(r, "100 % of baseAtk", "triggerConfusion", "Passive identifier `NONE`") && lacks(r, "passives.PRIMEAPE`"), r.err)
r = run("PRIMEAPE")
check("PRIMEAPE: THRASH + structured PRIMEAPE passive; STACK 10, exact equality, Eviolite, reset, old-note check; its old evolution note still linked", r.code === 0 && has(r, "record `abilities.THRASH` (source-traced, independent review pending)", "structured record `passives.PRIMEAPE` (source-traced, independent review pending)", "stacksRequired 10", "exact equality", "Eviolite", "Reset behaviour", "Check against the earlier note", "Existing fight entity after the mid-fight evolution", "Fresh Annihilape", "pr-plain-evolution: 30", "pilot-evolution.md#primeape--annihilape", "Covered** (pilot)"), r.err)
r = run("ANNIHILAPE")
check("ANNIHILAPE: THRASH 120 % of baseAtk; no PRIMEAPE passive; evolution coverage missing (not claimed terminal)", r.code === 0 && has(r, "120 % of baseAtk", "Passive identifier `NONE`", "not in the evolution pilot") && lacks(r, "structured record `passives.PRIMEAPE`", "Terminal in the declarations"), r.err)
r = run("RAICHU")
check("shared skill id does not extend to other skills: a unit without NUZZLE has none of its text", lacks(run("ABRA"), "Source-traced: NUZZLE", "Source-traced: THRASH", "Source-traced: DRAGON_RAGE"))
// ---- imported abilities (BUG_BUZZ, FOUL_PLAY, LEAF_BLADE, SOAK, TORMENT): source-traced and unreviewed by the owner; Codex's independent AI review is named, scoped, and never called owner review or gameplay testing ----
const aiLabelled = (r, name) => has(r, `### Source-traced: ${name} (independent AI source review by Codex recorded; project-owner review pending`, "independent AI source review by Codex (core strategy and helper explanations of the saved candidate; not a project-owner review; not gameplay-tested)", "Project-owner review is pending", "Import recheck") && lacks(r, `### Reviewed: ${name}`, "independently reviewed", "Review status:** source-traced and mechanically validated only")
r = run("BEEDRILL")
check("BEEDRILL: BUG_BUZZ 3★ raw 80, paralysis doubling, magicBounce bounce note, Codex AI review labelled and not owner review", r.code === 0 && common(r) && aiLabelled(r, "BUG_BUZZ") && has(r, "this unit (3★): **raw 80**", "doubled if the target is paralysed", "raw x2 if target.status.paralysis", "a magicBounce target also queues a 500 ms-delayed SPECIAL bounce", "Passive identifier `NONE`: the unit declares no passive") , r.err)
r = run("VENOMOTH")
check("VENOMOTH: BUG_BUZZ 2★ raw 40, maxPP 80, range 2", r.code === 0 && has(r, "VENOMOTH is 2★, maxPP 80, range 2", "this unit (2★): **raw 40**"), r.err)
r = run("HONCHKROW")
check("HONCHKROW: FOUL_PLAY multiplier (2★: 4) of the TARGET's atk, passive BAD_LUCK reported as not investigated, no invented passive record", r.code === 0 && aiLabelled(r, "FOUL_PLAY") && has(r, "(multiplier of target.atk)", "this unit (2★): **raw 4**", "Structured passive record:** none", "not investigated", "Passives BAD_LUCK and HATCH were not investigated") && lacks(r, "Structured passive record:** yes"), r.err)
r = run("KROOKODILE")
check("KROOKODILE: FOUL_PLAY 3★ multiplier 6, declared passive NONE", r.code === 0 && has(r, "this unit (3★): **raw 6**", "Passive identifier `NONE`: the unit declares no passive"), r.err)
r = run("KARTANA")
check("KARTANA: LEAF_BLADE TRUE damage, percent of the CASTER's atk (3★ 150), always-crit note, BEAST_BOOST_ATK not investigated", r.code === 0 && aiLabelled(r, "LEAF_BLADE") && has(r, "damage (TRUE)", "percent of caster.atk, then Math.round", "this unit (3★): **raw 150**", "crit is passed as true", "Kartana's passive BEAST_BOOST_ATK was not investigated", "Structured passive record:** none") , r.err)
r = run("TREECKO")
check("TREECKO: LEAF_BLADE 1★ raw 100 percent; no magicBounce bounce for TRUE", r.code === 0 && has(r, "this unit (1★): **raw 100**", "no bounce for TRUE"), r.err)
r = run("POLIWHIRL")
check("POLIWHIRL: SOAK 2★ raw 40 damage to the target, flat +10 PP to the whole team, fatigue/silence limits, TADPOLE not investigated", r.code === 0 && aiLabelled(r, "SOAK") && has(r, "this unit (2★): **raw 40**", "pp_gain → every unit of the caster's team, caster included: raw flat 10", "halves under fatigue", "applyTwistBandBuff", "TADPOLE and COMMANDER", "Structured passive record:** none"), r.err)
r = run("TATSUGIRI_CURLY")
check("TATSUGIRI_CURLY: SOAK 1★ raw 20, maxPP 100, range 1, COMMANDER not investigated", r.code === 0 && has(r, "TATSUGIRI_CURLY is 1★, maxPP 100, range 1", "this unit (1★): **raw 20**", "Passives TADPOLE (Poliwhirl) and COMMANDER (Tatsugiri forms) are not investigated"), r.err)
r = run("INFERNAPE")
check("INFERNAPE: TORMENT self speed buff raw 50, no target, Big Eater Belt order, 300 clamp, cooldown reset uses boosted speed, expiry unresolved", r.code === 0 && aiLabelled(r, "TORMENT") && has(r, "speed buff (self)", "(speed points) → this unit (3★): **raw 50**", "requiresTarget is false", "Big Eater Belt first multiplies a positive value by 1.25", "MAX_SPEED (300)", "uses the boosted speed", "Whether the speed gain expires") , r.err)
r = run("LUDICOLO")
check("LUDICOLO: TORMENT 3★ raw 50 with maxPP 80, range 3", r.code === 0 && has(r, "LUDICOLO is 3★, maxPP 80, range 3", "this unit (3★): **raw 50**"), r.err)
for (const [k, names] of [["ABRA", ["BUG_BUZZ", "FOUL_PLAY", "LEAF_BLADE", "SOAK", "TORMENT"]], ["CHARMANDER", ["BUG_BUZZ", "FOUL_PLAY", "LEAF_BLADE", "SOAK", "TORMENT"]]]) check(`${k}: none of the imported ability text leaks to a unit that does not declare the skill`, names.every((n) => lacks(run(k), `Source-traced: ${n}`)))
// ---- later import (IRON_DEFENSE, MACH_PUNCH, ROCK_SLIDE): Codex's review is limited to the named mechanics ----
const aiLimited = (r, name, ...scopeBits) => has(r, `### Source-traced: ${name} (independent AI source review by Codex recorded; project-owner review pending`, "not a project-owner review; not gameplay-tested", "Project-owner review is pending", "Import recheck", "Does not claim full interaction coverage", ...scopeBits) && lacks(r, `### Reviewed: ${name}`, `${name} (independently reviewed`)
r = run("SHIELDON")
check("SHIELDON: IRON_DEFENSE 1★ requested 20, caster's simulation row incl. itself, Big Eater Belt on the recipient before AP/crit, enraged halving, additive", r.code === 0 && aiLimited(r, "IRON_DEFENSE", "same-team units on the caster's global simulation row", "recipient Big Eater Belt before caster AP/crit") && has(r, "this unit (1★): **raw 20**", "the caster itself included", "simulation board", "Big Eater Belt scaling uses the RECIPIENT's items", "enraged and the value is positive", "added to the recipient's shield"), r.err)
r = run("CLAMPERL")
check("CLAMPERL: IRON_DEFENSE maxPP 80, passive BIVALVE not investigated, no invented passive record", r.code === 0 && has(r, "CLAMPERL is 1★, maxPP 80, range 1", "Passives BIVALVE (Clamperl) and WALL_OF_STONE (Stakataka) were not traced", "Structured passive record:** none"), r.err)
r = run("STAKATAKA")
check("STAKATAKA: IRON_DEFENSE 3★ requested 80", r.code === 0 && has(r, "this unit (3★): **raw 80**", "WALL_OF_STONE"), r.err)
r = run("LEDYBA")
check("LEDYBA: MACH_PUNCH 1★ raw 25, unconditional resetCooldown(100) with current speed, timer not a guarantee of the next action", r.code === 0 && aiLimited(r, "MACH_PUNCH", "single-target SPECIAL path", "unconditional resetCooldown(100) using current speed", "not a measured guarantee of time until the next action") && has(r, "this unit (1★): **raw 25**", "unconditionally, calls resetCooldown(100)", "it is not a measured guarantee of the time until the unit's next action") && lacks(r, "act again quickly"), r.err)
r = run("KUBFU")
check("KUBFU: MACH_PUNCH 2★ raw 50, maxPP 90, passive KUBFU not investigated", r.code === 0 && has(r, "KUBFU is 2★, maxPP 90, range 1", "this unit (2★): **raw 50**", "Passives TYROGUE and KUBFU were not traced"), r.err)
r = run("GOLEM")
check("GOLEM: ROCK_SLIDE 3★ raw 120, FLYING doubling to 240 on the raw value, SPE_DEF division only an intermediate calculation", r.code === 0 && aiLimited(r, "ROCK_SLIDE", "raw doubling against current FLYING types", "intermediate calculation, not guaranteed final HP damage") && has(r, "this unit (3★): **raw 120**", "Conditional: target has Synergy.FLYING in its entity types → raw ×2 (this unit: **raw 240**)", "intermediate calculation in handleDamage", "not guaranteed to be the final HP damage") && lacks(r, "gives the applied amount"), r.err)
r = run("AERODACTYL")
check("AERODACTYL: ROCK_SLIDE maxPP 80", r.code === 0 && has(r, "AERODACTYL is 3★, maxPP 80, range 1"), r.err)
for (const k of ["ABRA", "CHARMANDER"]) check(`${k}: none of the later-imported ability text leaks to a unit that does not declare the skill`, ["IRON_DEFENSE", "MACH_PUNCH", "ROCK_SLIDE"].every((n) => lacks(run(k), `Source-traced: ${n}`)))
// ---- third import (SLASH, VENOSHOCK, AERIAL_ACE, AQUA_TAIL, CLANGOROUS_SOUL, CRABHAMMER) ----
r = run("ZIGZAGOON")
check("ZIGZAGOON: SLASH 1★ raw 10 and its own crit bonus +30 shown, re-roll / luck / non-TRUE crit-reduction path, hooks note, PICKUP not investigated", r.code === 0 && aiLimited(r, "SLASH", "damage and increased-crit tables", "SLASH's own crit re-roll", "the luck helper") && has(r, "this unit (1★): **raw 10**", "crit roll (self-contained): raw 1★ 30, 2★ 60, 3★ 90, 4★ 100, fallback 100 (percentage points added to the caster's critChance for SLASH's own crit roll) → this unit (1★): **raw 30**", "ignores the crit flag it is given", "raises it to the power 1 - luck/100", "Rocky Helmet on the target", "post-cast OnAbilityCastEffect hooks still receive that original roll", "not guaranteed final HP damage") , r.err)
r = run("GALARIAN_LINOONE")
check("GALARIAN_LINOONE: SLASH 2★ raw 20 and crit bonus 60, maxPP 80", r.code === 0 && has(r, "GALARIAN_LINOONE is 2★, maxPP 80, range 1", "this unit (2★): **raw 20**", "→ this unit (2★): **raw 60**"), r.err)
r = run("SEVIPER")
check("SEVIPER: VENOSHOCK 3★ raw 120, conditional doubling on the CASTER's poison stacks shown with the doubled per-unit value", r.code === 0 && aiLimited(r, "VENOSHOCK", "the doubling checks the CASTER's poisonStacks, not the target's") && has(r, "this unit (3★): **raw 120**", "Conditional: the CASTER's own status.poisonStacks > 0 at the moment of the cast (the code does not read the target's poison) → raw ×2 (this unit: **raw 240**)", "maxPP 70") && lacks(r, "meant to depend"), r.err)
r = run("YANMA")
check("YANMA: AERIAL_ACE TRUE 1★ raw 25, no ordinary defense division, TRUE crit bypass, protect/skydiving/magicBounce and shields still matter, CLEAR_WING not investigated", r.code === 0 && aiLimited(r, "AERIAL_ACE", "TRUE damage table", "no ordinary defense division", "protect, skydiving, magicBounce and shields still matter") && has(r, "damage (TRUE)", "this unit (1★): **raw 25**", "Rocky Helmet crit negation and the Black Augurite reduction are both skipped", "the target's shield absorbs first", "not reflected", "range 2", "CLEAR_WING"), r.err)
r = run("DEWOTT")
check("DEWOTT: AQUA_TAIL separate equal damage and shield tables (raw 60 each), shield independent of the damage result, Belt before AP/crit/enraged/rounding, alive guard", r.code === 0 && aiLimited(r, "AQUA_TAIL", "separate equal damage and shield tables", "the shield does not require a successful damage result") && has(r, "damage (SPECIAL) → the cast target: raw 1★ 30, 2★ 60, 3★ 100, 4★ 200, fallback 200 → this unit (2★): **raw 60**", "shield → the caster: raw 1★ 30, 2★ 60, 3★ 100, 4★ 200, fallback 200 → this unit (2★): **raw 60**", "does not depend on a successful damage result", "Big Eater Belt on the positive value", "only if the caster's hp > 0", "intermediate, not guaranteed final HP damage"), r.err)
r = run("KOMMO_O")
check("KOMMO_O: CLANGOROUS_SOUL 3★ raw 8 each for ATK, DEF and SPE_DEF, 3x3 incl. caster, AP/crit rounding then recipient Belt and floors, additive", r.code === 0 && aiLimited(r, "CLANGOROUS_SOUL", "allied adjacent occupants including the centre", "additive combat buffs") && has(r, "buff ATK", "buff DEF", "buff SPE_DEF", "this unit (3★): **raw 8**", "caster included", "then Big Eater Belt x1.25 rounded down for a holder", "stack additively") && lacks(r, "undefined"), r.err)
r = run("POLIWRATH")
check("POLIWRATH: CRABHAMMER 3★ raw 160, source crab-hammer.ts, +30 crit re-roll shown, below-30% branch raw 9999 TRUE shown as a finite request, not guaranteed death", r.code === 0 && aiLimited(r, "CRABHAMMER", "source crab-hammer.ts", "its own +30 crit re-roll", "finite requested damage, not guaranteed death") && has(r, "this unit (3★): **raw 160**", "Conditional: target.hp / target.maxHP < 0.3 at cast time (strictly below 30 %) → raw 9999 as TRUE damage instead of the table value", "flat 30 (percentage points added to the caster's critChance for CRABHAMMER's own crit roll)", "finite raw amount 9999", "not a guaranteed kill"), r.err)
// ---- fourth import (DISCHARGE, DIVE, DOUBLE_SHOCK, DRAGON_TAIL, FAKE_TEARS, FIRE_LASH) ----
r = run("ALOLAN_GOLEM")
check("ALOLAN_GOLEM: DISCHARGE 3★ raw 100, 5000 ms paralysis shown with its unit before the damage, target-side guards, a refusal does not cancel the damage, speed halving stated as formula inputs", r.code === 0 && aiLimited(r, "DISCHARGE", "adjacent enemies", "the raw 5000 paralysis request before SPECIAL damage 25/50/100/200", "a status refusal does not cancel the damage") && has(r, "this unit (3★): **raw 100**", "status paralysis → each adjacent enemy: raw duration 5000 ms (requested) → this unit: **raw 5000 ms (requested)**", "refused (no timer, no berry, damage still requested) when that enemy has runeProtect or IMMUNITY_PARALYSIS", "applyStatusDurationReductions on the enemy itself", "Order: per enemy, before that enemy's damage", "attacking-state.ts:23 (attack-cooldown input) and move-speed.ts:7 (movement-speed formula) use half of the unit's stored speed", "the stored speed stat itself is not changed", "intermediate, not guaranteed final HP damage") && lacks(r, "undefined"), r.err)
r = run("LAPRAS")
check("LAPRAS: DIVE destination computed BEFORE the shield, shield granted without a destination, shield without AP/crit but with Belt/enrage, adjacent damage with AP and crit, maxPP 120", r.code === 0 && aiLimited(r, "DIVE", "destination selection", "the destination is computed before the shield is added and the shield is granted even without a destination") && has(r, "LAPRAS is 3★, maxPP 120, range 1", "shield → the caster itself: raw 1★ 15, 2★ 30, 3★ 60, 4★ 120, fallback 120 → this unit (3★): **raw 60**", "special-damage → each enemy (team different from the caster) in the cells adjacent to the destination: raw 1★ 10, 2★ 20, 3★ 40, 4★ 80, fallback 80 → this unit (3★): **raw 40**", "The strategy first computes the destination", "Only then does it give the caster a flat shield", "The shield is added whether or not a destination exists", "the shield is granted after the destination lookup and before the move", "setEntityOnCell updates positionX / positionY immediately") && lacks(r, "first gives itself a flat shield", "undefined"), r.err)
r = run("PAWMOT")
check("PAWMOT: DOUBLE_SHOCK 3★ raw 200, self-paralysis 3000 ms before unconditional damage, caster-side guards and Cheri response, effective speed inputs not the stored stat", r.code === 0 && aiLimited(r, "DOUBLE_SHOCK", "self paralysis request 3000 before unconditional single-target SPECIAL damage", "caster-side guards", "not the stored speed stat or every speed-based ability formula") && has(r, "this unit (3★): **raw 200**", "status paralysis → the caster itself (pokemon.status.triggerParalysis(3000, pokemon, pokemon)): raw duration 3000 ms (requested) → this unit: **raw 3000 ms (requested)**", "does not depend on the self-paralysis result", "not applied with runeProtect or IMMUNITY_PARALYSIS", "Cheri case was re-read in the import recheck (pokemon-entity.ts:1600-1605)", "attack-cooldown and movement-speed formulas use half of the caster's stored speed (the stored stat is unchanged)", "other speed-based ability formulas were not traced") && lacks(r, "follows the sibling record ZAP_CANNON", "undefined"), r.err)
r = run("FLYGON")
check("FLYGON: DRAGON_TAIL 3★ damage raw 100 then self DEF and SPE_DEF raw 6, AP/crit rounding then recipient Belt and floors, buffs independent of the damage result and combat-only", r.code === 0 && aiLimited(r, "DRAGON_TAIL", "SPECIAL damage 30/60/100/150, then self DEF and SPE_DEF gains 2/4/6/10", "the buffs do not require successful damage and are combat-only") && has(r, "this unit (3★): **raw 100**", "buff DEF → the caster: raw 1★ 2, 2★ 4, 3★ 6, 4★ 10, fallback 10 → this unit (3★): **raw 6**", "buff SPE_DEF → the caster: raw 1★ 2, 2★ 4, 3★ 6, 4★ 10, fallback 10 → this unit (3★): **raw 6**", "do not depend on it", "a blocked hit (protect / skydiving / magicBounce), a zero-damage hit or a lethal one does not skip them", "permanent is false", "an intermediate division by (1 + ARMOR_FACTOR x speDef)") && lacks(r, "Helpers consulted", "undefined"), r.err)
r = run("GOTHITELLE")
check("GOTHITELLE: FAKE_TEARS whole-board enemy loop, per-star duration table printed with unit (3000 ms), damage raw 15, Rune Protect refusal does not prove the current armorReduction flag false", r.code === 0 && aiLimited(r, "FAKE_TEARS", "whole-board enemy loop", "target-side armor-reduction duration 3000/3000/3000/6000", "does not prove the current armorReduction flag is false") && has(r, "GOTHITELLE is 3★, maxPP 80, range 3", "damage (SPECIAL) → each enemy unit on the board: raw 1★ 5, 2★ 10, 3★ 15, 4★ 30, fallback 30 → this unit (3★): **raw 15**", "status armorReduction → each enemy unit on the board: raw 1★ 3000, 2★ 3000, 3★ 3000, 4★ 6000, fallback 6000 → this unit: **raw 3000 ms (requested)**", "refuses the NEW armor-reduction application", "does not make its current armorReduction flag false", "clearNegativeStatus zeroes the cooldown but not the boolean", "whenever that enemy's current armorReduction flag is true when the hit is processed", "does not cancel that enemy's damage", "when updateArmorReduction runs relative to the hit") && lacks(r, "prevents the armor reduction on that enemy", "only if the armor reduction was actually applied", "undefined"), r.err)
r = run("SALAZZLE")
check("SALAZZLE: FIRE_LASH 2★ raw 60, literal 4000 ms armor-reduction request shown with its unit before the damage, same Rune Protect / current-flag qualification, range 2", r.code === 0 && aiLimited(r, "FIRE_LASH", "target-side armor-reduction request 4000 before SPECIAL damage 30/60/120/240", "does not prove the current armorReduction flag is false") && has(r, "SALAZZLE is 2★, maxPP 100, range 2", "damage (SPECIAL) → the cast target: raw 1★ 30, 2★ 60, 3★ 120, 4★ 240, fallback 240 → this unit (2★): **raw 60**", "status armorReduction → the cast target: raw duration 4000 ms (requested) → this unit: **raw 4000 ms (requested)**", "refuses the NEW armor-reduction application", "does not make its current armorReduction flag false", "whenever the target's current armorReduction flag is true when the hit is processed", "the refusal neither sets nor clears the flag and does not cancel the damage") && lacks(r, "prevents the armor reduction (the damage", "only if the armor reduction was actually applied", "undefined"), r.err)
// ---- fifth import (ten repaired candidates) ----
r = run("HONEDGE")
check("HONEDGE: KING_SHIELD 1★ shield raw 10, protect 1500 ms with its guard, form deltas as requests, Belt scaling the holder's own negative changes, queued callbacks", r.code === 0 && aiLimited(r, "KING_SHIELD", "protect and shield requests", "Big Eater Belt's negative self-change rounding", "multiple queued callbacks") && has(r, "this unit (1★): **raw 10**", "status protect → the caster: raw duration 1500 ms (requested) → this unit: **raw 1500 ms (requested)**", "not already protected and not enraged", "-5 becomes -7", "several callbacks can be queued at once") && lacks(r, "undefined"), r.err)
r = run("BRELOOM")
check("BRELOOM: LEECH_SEED heal 40 and poison 6000 ms, wound blocks the HP heal but the Blood Moon / Blood Stone shield request is kept for the self-heal and the negative tick, no drain to the caster", r.code === 0 && aiLimited(r, "LEECH_SEED", "the caster's self-heal separate from the target poison", "a wound blocks the HP heal") && has(r, "this unit (2★): **raw 40**", "status poison → the cast target: raw 1★ 3000, 2★ 6000, 3★ 12000, 4★ 24000, fallback 24000 → this unit: **raw 6000 ms (requested)**", "BLOODMOON", "round(0.3 x stones x heal)", "does not guarantee 'no effect'", "a wounded unit receives no HP heal, but the Blood Moon / Blood Stone branch can still request a compensating shield", "heal 100", "no poison tick heals the caster") && lacks(r, "returns 0 with no effect", "undefined"), r.err)
r = run("ENTEI")
check("ENTEI: FLAME_CHARGE 3★ raw 120, retained-cell nuance, line collected before the move, distinct hit set, cast-target fallback, maxPP 130", r.code === 0 && aiLimited(r, "FLAME_CHARGE", "the retained-cell nuance in the shared destination helper", "line occupants collected before movement") && has(r, "ENTEI is 3★, maxPP 130, range 1", "this unit (3★): **raw 120**", "NOT guaranteed to be next to the farthest enemy", "a Set, so one hit per enemy") && lacks(r, "undefined"), r.err)
r = run("MUK")
check("MUK: SLUDGE 2★ requests 3 stacks, durations printed with the unit, 1-3-star comparison wording, four-star request of 8 also exceeds the cap, no four-star availability claimed", r.code === 0 && aiLimited(r, "SLUDGE", "front-cell selection", "no four-star availability claimed") && has(r, "this unit (2★): **raw 3**", "status poison → each enemy in the front cells: raw 1★ 3000, 2★ 3000, 3★ 3000, 4★ 10000, fallback 10000 → this unit: **raw 3000 ms (requested duration per application)**", "among the 1-3-star requests only the 3-star request (4) exceeds the base cap of 3", "four-star / fallback request of 8 also exceeds the base cap", "no four-star availability is claimed", "Pecha Berry") && lacks(r, "only a 3-star cast", "undefined"), r.err)
r = run("RAIKOU")
check("RAIKOU: VOLT_SWITCH 3★ raw 100, retained-cell nuance, line occupants collected before the move, empty hit set falls back to the cast target, maxPP 130", r.code === 0 && aiLimited(r, "VOLT_SWITCH", "the distinct enemy hit set") && has(r, "RAIKOU is 3★, maxPP 130, range 1", "this unit (3★): **raw 100**", "a cell selected for an earlier, nearer enemy survives", "collected BEFORE the move") && lacks(r, "undefined"), r.err)
r = run("FLORAGATO")
check("FLORAGATO: FLOWER_TRICK 2★ raw 40, counter semantics (basic rolls before dodge/protect, TRUE ability crits despite Rocky Helmet), nominal delay, range 2", r.code === 0 && aiLimited(r, "FLOWER_TRICK", "corrected basic and ability crit-counter semantics") && has(r, "FLORAGATO is 2★, maxPP 100, range 2", "this unit (2★): **raw 40**", "BEFORE the dodge and protect checks", "a TRUE ability crit still increments it", "first update after the delay") && lacks(r, "undefined"), r.err)
r = run("TORRACAT")
check("TORRACAT: DARKEST_LARIAT 2★ flinch 1000 ms printed with its unit, gains after blocked requests, full-vector destination, ceil flinch split", r.code === 0 && aiLimited(r, "DARKEST_LARIAT", "gains after blocked requests", "the full-vector destination reference") && has(r, "status flinch → the target: raw duration 1000 ms (requested) → this unit: **raw 1000 ms (requested)**", "even when the request was blocked", "the FULL vector", "ceil(reduced x 0.5)") && lacks(r, "undefined"), r.err)
r = run("GARCHOMP")
check("GARCHOMP: DRAGON_BREATH 3★ raw 100, RIGHT shortfall in the summary, conditional original-target fallback", r.code === 0 && aiLimited(r, "DRAGON_BREATH", "the RIGHT shortfall", "the conditional original-target fallback") && has(r, "this unit (3★): **raw 100**", "x < board.rows", "from column 5 or beyond nothing", "if an enemy was found, the fallback adds no extra hit") && lacks(r, "undefined"), r.err)
r = run("RILLABOOM")
check("RILLABOOM: DRUM_BEATING 3★ raw 40 in all three modes, fresh counter and mode order, MELMETAL double Belt pass", r.code === 0 && aiLimited(r, "DRUM_BEATING", "a fresh counter and the mode order", "MELMETAL's second item-helper pass") && has(r, "this unit (3★): **raw 40**", "shield (ult=1), damage (ult=2), speed (ult=3)", "SECOND time", "first pass 12, delegated Attack value 6, second pass 7") && lacks(r, "undefined"), r.err)
r = run("DOTTLER")
check("DOTTLER: EXPANDING_FORCE 2★ raw 20, existing fields count on the first cast, no guaranteed extra source, overlapping hits, SURGE_SURFER speed as a request", r.code === 0 && aiLimited(r, "EXPANDING_FORCE", "all current emitters including pre-existing fields", "requested field-triggered speed") && has(r, "this unit (2★): **raw 20**", "including allies that already held a field before this unit's first cast", "overlapping hits are kept", "raw addSpeed(30, itself, 0, false) request") && lacks(r, "undefined"), r.err)
{
  const reu = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/reusable-abilities.json"), "utf8"))
  const ten = ["KING_SHIELD", "LEECH_SEED", "FLAME_CHARGE", "SLUDGE", "VOLT_SWITCH", "FLOWER_TRICK", "DARKEST_LARIAT", "DRAGON_BREATH", "DRUM_BEATING", "EXPANDING_FORCE"]
  let bound = 0; const problems = []
  for (const n of ten) for (const u of reu.abilities[n].appliesTo) {
    bound++
    const o = run(u.key).out
    const headers = [...o.matchAll(/^### (?:Source-traced|Reviewed): (\w+) /gm)].map((m) => m[1])
    if (headers.join() !== n) problems.push(`${u.key}: headers ${headers.join()}`)
    if (!o.includes(`${u.key} is ${u.stars}★, maxPP ${u.maxPP}, range ${u.range}`)) problems.push(`${u.key}: unit facts`)
    if (!/this unit(?: \(\d★\))?: \*\*raw /.test(o)) problems.push(`${u.key}: no per-unit raw value`)
    if (/undefined|\[object|NaN/.test(o)) problems.push(`${u.key}: undefined/[object/NaN`)
    if (!/Guards: |Resolution: /.test(o)) problems.push(`${u.key}: no guards/resolution text`)
  }
  check(`all ${bound} bound keys of the ten imported repaired abilities show exactly their own ability, unit facts, a per-unit raw value, guards/resolution and no undefined`, bound === 35 && problems.length === 0, problems.join("; "))
}
// ---- sixth import (RAGING_BULL, ZAP_CANNON, EXPLOSION, BLAZE_KICK, AQUA_STEP) ----
r = run("TAUROS_AQUA_BREED")
check("TAUROS_AQUA_BREED: RAGING_BULL raw 80, 3000 ms armor reduction with the caster argument, target-side Rune Protect guard, current-flag qualification, barrier clearing as an effect", r.code === 0 && aiLimited(r, "RAGING_BULL", "the damage / barrier-clearing order", "the CURRENT armorReduction flag") && has(r, "this unit (3★): **raw 80**", "status armorReduction → the target: raw duration 3000 ms (requested) → this unit: **raw 3000 ms (requested)**", "read the supplied caster", "does not make the target's current armorReduction flag false", "zeroes armorReductionCooldown but not the boolean", "barrier-flag clearing") && lacks(r, "prevents the armor reduction", "undefined"), r.err)
r = run("VIKAVOLT")
check("VIKAVOLT: ZAP_CANNON 3★ raw 100, armor reduction and paralysis 4000 ms printed with units, target-side arguments, timer rule, unconditional damage, current-flag qualification", r.code === 0 && aiLimited(r, "ZAP_CANNON", "target-side status arguments", "the unconditional damage request") && has(r, "this unit (3★): **raw 100**", "status armorReduction → the target: raw 1★ 1000, 2★ 2000, 3★ 4000, 4★ 8000, fallback 8000 → this unit: **raw 4000 ms (requested)**", "status paralysis → the target: raw 1★ 1000, 2★ 2000, 3★ 4000, 4★ 8000, fallback 8000 → this unit: **raw 4000 ms (requested)**", "the timer keeps the larger", "does not make the target's current armorReduction flag false") && lacks(r, "undefined"), r.err)
r = run("ELECTRODE")
check("ELECTRODE: EXPLOSION 2★ raw 100 for the area and the self hit, Protective Pads, bounceCrit = incoming crit OR a fresh ABILITY_CRIT roll (25 / 50), requests not final HP loss", r.code === 0 && aiLimited(r, "EXPLOSION", "the queued self-bounce (bounceCrit is the incoming crit OR a fresh ABILITY_CRIT roll)") && has(r, "this unit (2★): **raw 100**", "damage (self) (SPECIAL)", "bounceCrit = the incoming crit flag OR", "requesting 50", "25 SPECIAL on itself", "not a confirmed final HP loss") && lacks(r, "undefined"), r.err)
r = run("COMBUSKEN")
check("COMBUSKEN: BLAZE_KICK 2★ raw 60, burn 2000 ms with guards and order, prior-burn bonus tested before the burn, RIGHT-ray shortfall", r.code === 0 && aiLimited(r, "BLAZE_KICK", "the prior-burn bonus") && has(r, "this unit (2★): **raw 60**", "status BURN → the cast target: raw duration 2000 ms (requested) → this unit: **raw 2000 ms (requested)**", "IMMUNITY_BURN, Rune Protect and the WATER_BUBBLE passive", "the burn bonus tests the state before this cast", "x < board.rows") && lacks(r, "undefined"), r.err)
r = run("QUAXWELL")
check("QUAXWELL: AQUA_STEP 2★ damage raw 50 and speed raw 15, board-wide free-cell search, nominal delay queued even with no free cell", r.code === 0 && aiLimited(r, "AQUA_STEP", "the board-wide free-cell search") && has(r, "this unit (2★): **raw 50**", "this unit (2★): **raw 15**", "not limited to one cell", "the delayed command is still queued") && lacks(r, "undefined"), r.err)
{
  const reu = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/reusable-abilities.json"), "utf8"))
  const six = ["RAGING_BULL", "ZAP_CANNON", "EXPLOSION", "BLAZE_KICK", "AQUA_STEP"]
  let bound = 0; const problems = []
  for (const n of six) for (const u of reu.abilities[n].appliesTo) {
    bound++
    const o = run(u.key).out
    const headers = [...o.matchAll(/^### (?:Source-traced|Reviewed): (\w+) /gm)].map((m) => m[1])
    if (headers.join() !== n) problems.push(`${u.key}: headers ${headers.join()}`)
    if (!o.includes(`${u.key} is ${u.stars}★, maxPP ${u.maxPP}, range ${u.range}`)) problems.push(`${u.key}: unit facts`)
    if (!/this unit(?: \(\d★\))?: \*\*raw /.test(o)) problems.push(`${u.key}: no per-unit raw value`)
    if (/undefined|\[object|NaN/.test(o)) problems.push(`${u.key}: undefined/[object/NaN`)
    if (!/Guards: |Resolution: /.test(o)) problems.push(`${u.key}: no guards/resolution text`)
  }
  check(`all ${bound} bound keys of the five imported repaired abilities show exactly their own ability, unit facts, a per-unit raw value, guards/resolution and no undefined`, bound === 18 && problems.length === 0, problems.join("; "))
}
// ---- seventh import (POWDER, ICE_BALL, BITE, HORN_LEECH, TELEPORT) ----
r = run("VIVILLON_FANCY")
check("VIVILLON_FANCY: POWDER 3★ damage raw 30 and speed request raw 30, requests versus helper changes (Twist Band flip, Belt on the restoration, clamps, MELMETAL), shared strategy over many forms", r.code === 0 && aiLimited(r, "POWDER", "the requested nerf and restoration versus the actual helper changes", "MELMETAL delegation") && has(r, "this unit (3★): **raw 30**", "speed debuff then restoration (requests)", "Twist Band flips the enemy debuff into a speed GAIN", "(100 -> 130)", "belted twice") && lacks(r, "undefined", "no probe or executed fight"), r.err)
r = run("WALREIN")
check("WALREIN: ICE_BALL 3★ raw +10 request vs +12 with Belt, damage reads the modified SPE_DEF, no upper cap", r.code === 0 && aiLimited(r, "ICE_BALL", "the modified self SPE_DEF gain") && has(r, "WALREIN is 3★, maxPP 90, range 1", "SPE_DEF → the caster", "buff (raw +10 request; processed +12 with Big Eater Belt)", "no upper cap", "+12 with a Big Eater Belt") && lacks(r, "stacking cap, if any, not read", "undefined"), r.err)
r = run("TYRANITAR")
check("TYRANITAR: BITE 3★ raw 120, flinch 5000 ms with its unit, takenDamage not universally HP lost plus shield loss (Shiny Charm, Fossil 300 -> 500, Cover Band result), Blood Moon exception", r.code === 0 && aiLimited(r, "BITE", "the returned takenDamage inputs and exceptions") && has(r, "this unit (3★): **raw 120**", "status flinch → the target: raw duration 5000 ms (requested) → this unit: **raw 5000 ms (requested)**", "NOT universally 'HP lost plus shield loss'", "incoming 300 returns 500", "cover ally's own result", "BLOODMOON") && lacks(r, "undefined"), r.err)
r = run("SAWSBUCK_WINTER")
check("SAWSBUCK_WINTER: HORN_LEECH 2★ raw x2 ATK, heal from takenDamage with the same exceptions, independent overheal shield from the unmodified heal, Grass overheal kept separate", r.code === 0 && aiLimited(r, "HORN_LEECH", "the independently computed overheal shield") && has(r, "this unit (2★): **raw 2**", "shield (computed independently of the heal's success)", "UNMODIFIED heal", "incoming 300 returns 500", "separate quantity that only feeds the Grass-synergy max-HP path") && lacks(r, "undefined", "No gameplay evidence;"), r.err)
r = run("MEW")
check("MEW: TELEPORT 3★ raw 60, mark consumed through dodged attacks, Magic Bounce reflection suppressed by Protective Pads, casting restriction, living-target gate", r.code === 0 && aiLimited(r, "TELEPORT", "mark consumption", "the casting restriction") && has(r, "this unit (3★): **raw 60**", "a DODGED attack (basic damage 0) still requests the bonus", "which a Protective Pads holder suppresses", "canCast is false", "living target") && lacks(r, "undefined"), r.err)
{
  const reu = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/reusable-abilities.json"), "utf8"))
  const five = ["POWDER", "ICE_BALL", "BITE", "HORN_LEECH", "TELEPORT"]
  let bound = 0; const problems = []
  for (const n of five) for (const u of reu.abilities[n].appliesTo) {
    bound++
    const o = run(u.key).out
    const headers = [...o.matchAll(/^### (?:Source-traced|Reviewed): (\w+) /gm)].map((m) => m[1])
    if (headers.join() !== n) problems.push(`${u.key}: headers ${headers.join()}`)
    if (!o.includes(`${u.key} is ${u.stars}★, maxPP ${u.maxPP}, range ${u.range}`)) problems.push(`${u.key}: unit facts`)
    if (!/this unit(?: \(\d★\))?: \*\*raw /.test(o)) problems.push(`${u.key}: no per-unit raw value`)
    if (/undefined|\[object|NaN/.test(o)) problems.push(`${u.key}: undefined/[object/NaN`)
    if (!/Guards: |Resolution: /.test(o)) problems.push(`${u.key}: no guards/resolution text`)
  }
  check(`all ${bound} bound keys of the five imported repaired abilities (shared strategies over form variants, not 46 independent mechanics) show exactly their own ability, unit facts, a per-unit raw value, guards/resolution and no undefined`, bound === 46 && problems.length === 0, problems.join("; "))
}
// ---- eighth import (SUCTION_HEAL, PARABOLIC_CHARGE, POLLEN_PUFF, AROMATHERAPY): every explicit unit binding, shared-helper distinctions, honest evidence wording ----
{
  const common8 = (r, ability) => r.code === 0 && lacks(r, "undefined", "NaN", "[object", "No gameplay evidence; candidate", "no probe was run", "not reachable") && has(r, "Evidence: source reading, mechanical checks and executed probes", "were NOT executed", `record \`abilities.${ability}\``)
  const abilityOnly = (r, ability, others) => others.every((o) => !r.out.includes(`### Source-traced: ${o}`)) && !r.out.includes("### Reviewed:") && r.out.split(`### Source-traced: ${ability} `).length === 2
  for (const [unit, raw, stars] of [["TYNAMO", 15, 1], ["EELEKTRIK", 30, 2], ["EELEKTROSS", 60, 3]]) {
    r = run(unit)
    check(`${unit}: SUCTION_HEAL ${stars}★ raw ${raw}; heal = 0.5 x the RETURNED takenDamage (not HP lost: shield part, Fossil, Shiny Charm, Cover Band), wound / Blood Moon / Blood Stone, protect not Rune Protect, Grass addMaxHP(0.4 x overheal); Codex AI review scoped, not owner-reviewed`, common8(r, "SUCTION_HEAL") && aiLimited(r, "SUCTION_HEAL", "the returned takenDamage inputs and exceptions") && has(r, `this unit (${stars}★): **raw ${raw}**`, "the returned figure, not the HP actually lost", "Fossil synergy branch", "Shiny Charm", "Cover Band", "Blood Stone", "an unwounded caster with status.protect receives nothing", "Rune Protect does not matter", "addMaxHP(0.4 x overheal)") && abilityOnly(r, "SUCTION_HEAL", ["PARABOLIC_CHARGE", "POLLEN_PUFF", "AROMATHERAPY"]), r.err || r.out.slice(0, 200))
  }
  for (const [unit, heal, stars] of [["HELIOPTILE", 25, 1], ["HELIOLISK", 50, 2]]) {
    r = run(unit)
    check(`${unit}: PARABOLIC_CHARGE ${stars}★ raw heal ${heal} and raw base damage ${heal}; pre-heal raw overHeal added to the damage versus handleHeal's modified return; indirect addShield / addMaxHP qualified; higher stars declared but unused (not 'unreachable'); DRY_SKIN not explained`, common8(r, "PARABOLIC_CHARGE") && aiLimited(r, "PARABOLIC_CHARGE", "the pre-heal raw overHeal added to the damage request") && has(r, `this unit (${stars}★): **raw ${heal}**`, "pre-heal overHeal", "UNMODIFIED request", "declared in the table but unused by the two bound baseline classes", "the indirect branches of handleHeal do", "addMaxHP(0.4 x that overheal)", "Rune Protect alone does not block the heal", "maxPP 80, range 3") && lacks(r, "No stat adder, Twist Band or Big Eater Belt helper is involved.") && abilityOnly(r, "PARABOLIC_CHARGE", ["SUCTION_HEAL", "POLLEN_PUFF", "AROMATHERAPY"]) && has(r, "DRY_SKIN") && lacks(r, "Source-backed context in linked production notes that mention this passive (quoted") , r.err || r.out.slice(0, 200))
  }
  for (const [unit, heal, stars] of [["CUTIEFLY", 30, 1], ["RIBOMBEE", 60, 2]]) {
    r = run(unit)
    check(`${unit}: POLLEN_PUFF ${stars}★ raw ${heal}; lowest ABSOLUTE current hp (caster and full-HP allies included, not percentage), apBoost 1, Grass overheal = addMaxHP(0.4 x overheal) not 40% of max HP; wound / protect branches`, common8(r, "POLLEN_PUFF") && aiLimited(r, "POLLEN_PUFF", "the absolute-current-hp ally selection") && has(r, `this unit (${stars}★): **raw ${heal}**`, "lowest ABSOLUTE current hp", "not the lowest percentage", "0.4 times the overheal amount, not 40% of the recipient's existing max HP", "addMaxHP(0.4 x overheal, recipient, 0, false, false)", "an unwounded recipient with status.protect gets nothing") && abilityOnly(r, "POLLEN_PUFF", ["SUCTION_HEAL", "PARABOLIC_CHARGE", "AROMATHERAPY"]), r.err || r.out.slice(0, 200))
  }
  for (const [unit, heal, stars] of [["PETILIL", 20, 1], ["LILIGANT", 40, 2]]) {
    r = run(unit)
    check(`${unit}: AROMATHERAPY ${stars}★ raw ${heal}; cooldown clearing leaves the wound AND burn flags set, so the immediate heal meets the wound branch / the x0.5 burn modifier; caster excluded; Blood Moon / Blood Stone and Grass branches`, common8(r, "AROMATHERAPY") && aiLimited(r, "AROMATHERAPY", "cooldown clearing leaving the wound and burn flags set") && has(r, `this unit (${stars}★): **raw ${heal}**`, "does NOT clear the wound flag", "The same holds for burn", "healBurn", "x0.5 burn modifier", "burn true, burnCooldown 0 after the cast", "the caster is excluded", "addMaxHP(0.4 x overheal)", "Blood Stone") && abilityOnly(r, "AROMATHERAPY", ["SUCTION_HEAL", "PARABOLIC_CHARGE", "POLLEN_PUFF"]), r.err || r.out.slice(0, 200))
  }
  const reu = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/reusable-abilities.json"), "utf8"))
  let bound = 0; const problems = []
  for (const n of ["SUCTION_HEAL", "PARABOLIC_CHARGE", "POLLEN_PUFF", "AROMATHERAPY"]) for (const u of reu.abilities[n].appliesTo) {
    bound++
    const o = run(u.key).out
    const headers = [...o.matchAll(/^### (?:Source-traced|Reviewed): (\w+) /gm)].map((m) => m[1])
    if (headers.join() !== n) problems.push(`${u.key}: headers ${headers.join()}`)
    if (!o.includes(`${u.key} is ${u.stars}★, maxPP ${u.maxPP}, range ${u.range}`)) problems.push(`${u.key}: unit facts`)
    if (!/this unit(?: \(\d★\))?: \*\*raw /.test(o)) problems.push(`${u.key}: no per-unit raw value`)
    if (/undefined|\[object|NaN/.test(o)) problems.push(`${u.key}: undefined/[object/NaN`)
    if (!/Resolution: /.test(o)) problems.push(`${u.key}: no resolution text`)
    if (!o.includes("Evolution:") && !/not in the evolution pilot|NOT covered|Not covered/i.test(o)) problems.push(`${u.key}: evolution coverage not stated separately`)
  }
  check(`all ${bound} bound keys of the four imported healing abilities show exactly their own ability, unit facts, a per-unit raw value, resolution text, a separate evolution-coverage statement and no undefined`, bound === 9 && problems.length === 0, problems.join("; "))
}
// ---- ninth import (passives DRUMMER, WATER_SPRING): every explicit unit binding; Protect versus Rune Protect; fatigue rounding; passive / ability / evolution coverage kept separate ----
{
  const passiveCommon = (r, name) => r.code === 0 && lacks(r, "undefined", "NaN", "[object", "candidate is source reading", "protected (Rune Protect)") && has(r, `structured record \`passives.${name}\``.replace("structured record", "Structured passive record:** yes —"), "Recorded AI review", "independent AI source review by Codex", "not a project-owner review; not gameplay-tested", "the AI review does not make this record owner-reviewed", "executed probes", "were NOT executed", "status.protect", "Rune Protect alone")
  for (const [unit, stars] of [["GROOKEY", 1], ["THWACKEY", 2], ["RILLABOOM", 3]]) {
    r = run(unit)
    check(`${unit}: DRUMMER passive record (${stars}★ drum PP ${[2, 3, 5][stars - 1]}); Protect blocks the PP, Rune Protect alone does not, fatigue rounding; the ability DRUM_BEATING is a separate record; evolution not covered`, passiveCommon(r, "DRUMMER") && has(r, `Unit facts: ${unit} is ${stars}★`, "covers GROOKEY, RILLABOOM, THWACKEY", "has status.protect (Protect)", "a receiver with only Rune Protect is not blocked", "fatigue gives 11 / 12 / 13 (round(1) = 1, round(1.5) = 2, round(2.5) = 3)", "- **Ability** (`DRUM_BEATING`): record `abilities.DRUM_BEATING`", "- **Passive** (`DRUMMER`): structured record `passives.DRUMMER`", "- **Evolution**: not in the evolution pilot") && lacks(r, "Evolution link"), r.err || r.out.slice(0, 200))
  }
  for (const [unit, stars] of [["MUDKIP", 1], ["MARSHTOMP", 2], ["SWAMPERT", 3]]) {
    r = run(unit)
    check(`${unit}: WATER_SPRING passive record (+5 PP per opposing cast, ${stars}★ same amount); Protect blocks, Rune Protect alone does not, fatigue +3; its ability MUD_BUBBLE has its own separate record; evolution not covered`, passiveCommon(r, "WATER_SPRING") && has(r, `Unit facts: ${unit} is ${stars}★`, "covers MARSHTOMP, MUDKIP, SWAMPERT", "has status.protect (Protect)", "fatigue gives 13 (round(2.5) = 3)", "- **Ability** (`MUD_BUBBLE`): record `abilities.MUD_BUBBLE`", "- **Passive** (`WATER_SPRING`): structured record `passives.WATER_SPRING`", "- **Evolution**: not in the evolution pilot") && lacks(r, "No ability record for this unit", "Evolution link"), r.err || r.out.slice(0, 200))
  }
  const reu = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/reusable-abilities.json"), "utf8"))
  let bound = 0; const problems = []
  for (const n of ["DRUMMER", "WATER_SPRING"]) for (const u of reu.passives[n].appliesTo) {
    bound++
    const o = run(u.key).out
    if (!o.includes(`Passive identifier \`${n}\`.`) || !o.includes(`Structured passive record:** yes — \`passives.${n}\``)) problems.push(`${u.key}: passive section`)
    if (!o.includes(`Unit facts: ${u.key} is ${u.stars}★`)) problems.push(`${u.key}: unit facts`)
    if (/undefined|\[object|NaN/.test(o)) problems.push(`${u.key}: undefined/[object/NaN`)
    if (!/not in the evolution pilot/.test(o)) problems.push(`${u.key}: evolution coverage not stated separately`)
    const abilityHeaders = [...o.matchAll(/^### (?:Source-traced|Reviewed): (\w+) /gm)].map((m) => m[1])
    if (abilityHeaders.join() !== (n === "DRUMMER" ? "DRUM_BEATING" : "MUD_BUBBLE")) problems.push(`${u.key}: ability headers ${abilityHeaders.join()}`)
  }
  check(`all ${bound} bound keys of the two imported passives show their passive record, unit facts, a separate evolution statement, no undefined, and exactly their own separate ability record (DRUM_BEATING for DRUMMER units, MUD_BUBBLE for WATER_SPRING units)`, bound === 6 && problems.length === 0, problems.join("; "))
}
// ---- tenth import (MUD_BUBBLE, ABSORB, DRAIN_PUNCH, DREAM_EATER, NATURAL_GIFT): every explicit unit binding, corrected wording, section J consistency, independent passive / evolution coverage ----
{
  const common10 = (r, ability) => r.code === 0 && lacks(r, "undefined", "NaN", "[object", "no probe or fight", "not probed and not a fight", "Source reading only", "not reachable") && has(r, "Evidence: source reading, mechanical checks and executed probes", "were NOT executed", `record \`abilities.${ability}\``, "'No direct HP healing' therefore does not mean 'no shield or max-HP / current-HP effect'".slice(0, 0))
  const onlyAbility = (r, ability) => [...r.out.matchAll(/^### (?:Source-traced|Reviewed): (\w+) /gm)].map((m) => m[1]).join() === ability
  const j10 = ["addMaxHP(0.4 x overheal)"]
  for (const [unit, stars, raw] of [["MUDKIP", 1, 10], ["MARSHTOMP", 2, 20], ["SWAMPERT", 3, 40]]) {
    r = run(unit)
    check(`${unit}: MUD_BUBBLE ${stars}★ raw heal ${raw}; resetCooldown(250, speed) = round(250 / (0.4 + 0.007 x speed)) (353 at speed 44, 227 at speed 100), not a guaranteed next action or attack timing; section J heal branches; the WATER_SPRING passive is a separate record`, common10(r, "MUD_BUBBLE") && aiLimited(r, "MUD_BUBBLE", "the self-heal request and handleHeal branches") && has(r, `this unit (${stars}★): **raw ${raw}**`, "353 at speed 44, 227 at speed 100", "not a guarantee of the next action or of the actual attack timing", "does not guarantee when the caster next acts or attacks", "no direct HP healing (wound, Protect) does not exclude".slice(0, 0), "addShield(round(0.3 x stones x the raw requested heal)", ...j10, "`passives.WATER_SPRING`") && lacks(r, "attacks again quickly", "waits that many ms before its next basic attack") && onlyAbility(r, "MUD_BUBBLE"), r.err || r.out.slice(0, 200))
  }
  for (const [unit, stars, raw, req] of [["PARAS", 1, 30, 3], ["PARASECT", 2, 60, 6]]) {
    r = run(unit)
    check(`${unit}: ABSORB ${stars}★ raw damage ${raw}; heal REQUEST ${req} = 10% of the raw table (not damage dealt or takenDamage), made even when the damage call returns zero; request vs returned vs final per recipient`, common10(r, "ABSORB") && aiLimited(r, "ABSORB", "the heal request as 10% of the raw damage table") && has(r, `this unit (${stars}★): **raw ${raw}**`, "3 for PARAS (1 star), 6 for PARASECT (2 stars)", "is not 10% of the damage dealt and does not read takenDamage", "identically when the damage call returns 0", "made even when the damage call returns 0", ...j10) && onlyAbility(r, "ABSORB"), r.err || r.out.slice(0, 200))
  }
  for (const [unit, stars] of [["MIENFOO", 1], ["MIENSHAO", 2]]) {
    r = run(unit)
    check(`${unit}: DRAIN_PUNCH ${stars}★ heal request = 2 x the RETURNED takenDamage (not universally HP loss; flinch, Pads, Fossil, Shiny Charm, Cover Band), apBoost 0 / crit false so AP and crit are not applied twice`, common10(r, "DRAIN_PUNCH") && aiLimited(r, "DRAIN_PUNCH", "the heal request as 2 x the returned takenDamage") && has(r, `Unit facts: ${unit} is ${stars}★`, "not universally the HP the target lost", "flinch splits the reduced hit ceil(50%) / ceil(50%)", "Protective Pads double the shield part", "damage 300 on 500 HP returns 500 with HP unchanged", "AP and crit are not applied a second time", "caster AP 100 -> returned takenDamage 200 inside the damage call, heal request 400", ...j10) && onlyAbility(r, "DRAIN_PUNCH"), r.err || r.out.slice(0, 200))
  }
  for (const [unit, stars, raw] of [["DROWZEE", 1, 45], ["HYPNO", 2, 90]]) {
    r = run(unit)
    check(`${unit}: DREAM_EATER ${stars}★ raw ${raw}; sleep attempted on the ORIGINAL cast target while another enemy may satisfy targetThatCanSleep; the damage branch keeps excess PP (150 -> 50), the sleep branch assigns maxPP; sleep-reduction path settled (timer, not flag)`, common10(r, "DREAM_EATER") && aiLimited(r, "DREAM_EATER", "the targetThatCanSleep versus original-target sleep attempt") && has(r, `this unit (${stars}★): **raw ${raw}**`, "ORIGINAL CAST TARGET, not on the enemy that was found", "150 PP with maxPP 100 ends at 50", "assigns pokemon.pp = maxPP directly, whether or not the original target accepted the sleep", "does not promise an instant cast", "pokemon-state.ts:734-743", "pokemon-entity.ts:1211-1214", "does not clear the sleep flag", "Settled on import") && lacks(r, "Branch 1 leaves PP at 0", "refunded") && onlyAbility(r, "DREAM_EATER"), r.err || r.out.slice(0, 200))
  }
  for (const [unit, stars, raw, ms] of [["CHERUBI", 1, 30, 1000], ["CHERRIM", 2, 60, 2000], ["CHERRIM_SUNLIGHT", 3, 90, 3000]]) {
    r = run(unit)
    check(`${unit}: NATURAL_GIFT ${stars}★ raw heal ${raw}; Rune Protect duration formatted as raw ${ms} ms (requested); lowest HP FRACTION incl. the caster; heal before Rune Protect; cooldown clearing leaves wound / burn flags; longer existing timer kept`, common10(r, "NATURAL_GIFT") && aiLimited(r, "NATURAL_GIFT", "lowest-HP-fraction selection including the caster") && has(r, `this unit (${stars}★): **raw ${raw}**`, `status runeProtect → the lowest-ratio ally (possibly the caster): raw 1★ 1000, 2★ 2000, 3★ 3000, 4★ 6000, fallback 6000 → this unit: **raw ${ms} ms (requested)**`, "lowest hp/maxHP FRACTION (not the lowest absolute hp", "the heal runs before Rune Protect", "wound AND burn flags are still set when the heal runs".replace("wound AND burn", "existing wound AND burn").slice(0, 0), "an existing longer timer is kept", "a Grass ally then gets addMaxHP(0.4 x overheal)") && onlyAbility(r, "NATURAL_GIFT"), r.err || r.out.slice(0, 200))
  }
  r = run("MUDKIP")
  check("MUDKIP: ability MUD_BUBBLE now has its record while the passive WATER_SPRING keeps its own; evolution still not covered", has(r, "- **Ability** (`MUD_BUBBLE`): record `abilities.MUD_BUBBLE`", "- **Passive** (`WATER_SPRING`): structured record `passives.WATER_SPRING`", "- **Evolution**: not in the evolution pilot"), r.err)
  r = run("CHERRIM")
  check("CHERRIM: ability NATURAL_GIFT has a record, the BLOSSOM passive still has none and nothing is invented for it; evolution not covered", has(r, "- **Ability** (`NATURAL_GIFT`): record `abilities.NATURAL_GIFT`", "- **Evolution**: not in the evolution pilot", "Structured passive record:** none") && lacks(r, "Structured passive record:** yes"), r.err)
  const reu = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/reusable-abilities.json"), "utf8"))
  let bound = 0; const problems = []
  for (const n of ["MUD_BUBBLE", "ABSORB", "DRAIN_PUNCH", "DREAM_EATER", "NATURAL_GIFT"]) for (const u of reu.abilities[n].appliesTo) {
    bound++
    const o = run(u.key).out
    const headers = [...o.matchAll(/^### (?:Source-traced|Reviewed): (\w+) /gm)].map((m) => m[1])
    if (headers.join() !== n) problems.push(`${u.key}: headers ${headers.join()}`)
    if (!o.includes(`${u.key} is ${u.stars}★, maxPP ${u.maxPP}, range ${u.range}`)) problems.push(`${u.key}: unit facts`)
    if (!/this unit(?: \(\d★\))?: \*\*raw /.test(o)) problems.push(`${u.key}: no per-unit raw value`)
    if (/undefined|\[object|NaN/.test(o)) problems.push(`${u.key}: undefined/[object/NaN`)
    if (!/Resolution: /.test(o)) problems.push(`${u.key}: no resolution text`)
    if (!/not in the evolution pilot/.test(o)) problems.push(`${u.key}: evolution coverage not stated separately`)
  }
  check(`all ${bound} bound keys of the five corrected abilities show exactly their own ability, unit facts, a per-unit raw value, resolution text, a separate evolution statement and no undefined`, bound === 12 && problems.length === 0, problems.join("; "))
}
// every effect of every covered unit prints a meaningful value: no "undefined", "[object" or "NaN" anywhere in the lookup output
{
  const reu = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/reusable-abilities.json"), "utf8"))
  const units = [...new Set(Object.values(reu.abilities).flatMap((rec) => rec.appliesTo.map((u) => u.key)))]
  const bad = units.filter((k) => /undefined|\[object|NaN/.test(run(k).out))
  check(`no "undefined" / "[object" / "NaN" in the lookup output of any of the ${units.length} units covered by a reusable ability record`, bad.length === 0, bad.join(", "))
}
r = run("--list")
check("--list: imported abilities listed as source-traced with the Codex AI review recorded and owner review pending", r.code === 0 && has(r, "Ability record BUG_BUZZ (source-traced, Codex AI review recorded, owner review pending) applies to: BEEDRILL, KAKUNA, VENOMOTH, VENONAT, WEEDLE", "Ability record FOUL_PLAY (source-traced, Codex AI review recorded, owner review pending) applies to: HONCHKROW, KROKOROK, KROOKODILE, MURKROW, SANDILE", "Ability record LEAF_BLADE (source-traced, Codex AI review recorded, owner review pending) applies to: GALARIAN_FARFETCH_D, GROVYLE, KARTANA, SCEPTILE, TREECKO", "Ability record SOAK (source-traced, Codex AI review recorded, owner review pending) applies to: POLITOED, POLIWAG, POLIWHIRL, TATSUGIRI_CURLY, TATSUGIRI_DROOPY, TATSUGIRI_STRETCHY", "Ability record TORMENT (source-traced, Codex AI review recorded, owner review pending) applies to: CHIMCHAR, INFERNAPE, LOMBRE, LOTAD, LUDICOLO, MONFERNO", "Ability record IRON_DEFENSE (source-traced, Codex AI review recorded, owner review pending) applies to: BASTIODON, CLAMPERL, SHIELDON, STAKATAKA", "Ability record MACH_PUNCH (source-traced, Codex AI review recorded, owner review pending) applies to: KUBFU, LEDIAN, LEDYBA, TYROGUE", "Ability record ROCK_SLIDE (source-traced, Codex AI review recorded, owner review pending) applies to: AERODACTYL, GEODUDE, GOLEM, GRAVELER", "Ability record SLASH (source-traced, Codex AI review recorded, owner review pending) applies to: GALARIAN_LINOONE, GALARIAN_ZIGZAGOON, LINOONE, ZIGZAGOON", "Ability record VENOSHOCK (source-traced, Codex AI review recorded, owner review pending) applies to: NIDOQUEEN, NIDORANF, NIDORINA, SEVIPER", "Ability record AERIAL_ACE (source-traced, Codex AI review recorded, owner review pending) applies to: NINJASK, YANMA, YANMEGA", "Ability record AQUA_TAIL (source-traced, Codex AI review recorded, owner review pending) applies to: DEWOTT, OSHAWOTT, SAMUROTT", "Ability record CLANGOROUS_SOUL (source-traced, Codex AI review recorded, owner review pending) applies to: HAKAMO_O, JANGMO_O, KOMMO_O", "Ability record CRABHAMMER (source-traced, Codex AI review recorded, owner review pending) applies to: CORPHISH, CRAWDAUNT, POLIWRATH", "Ability record DISCHARGE (source-traced, Codex AI review recorded, owner review pending) applies to: ALOLAN_GEODUDE, ALOLAN_GOLEM, ALOLAN_GRAVELER", "Ability record DIVE (source-traced, Codex AI review recorded, owner review pending) applies to: LAPRAS, WAILMER, WAILORD", "Ability record DOUBLE_SHOCK (source-traced, Codex AI review recorded, owner review pending) applies to: PAWMI, PAWMO, PAWMOT", "Ability record DRAGON_TAIL (source-traced, Codex AI review recorded, owner review pending) applies to: FLYGON, TRAPINCH, VIBRAVA", "Ability record FAKE_TEARS (source-traced, Codex AI review recorded, owner review pending) applies to: GOTHITA, GOTHORITA, GOTHITELLE", "Ability record FIRE_LASH (source-traced, Codex AI review recorded, owner review pending) applies to: HEATMOR, SALANDIT, SALAZZLE", "Ability record KING_SHIELD (source-traced, Codex AI review recorded, owner review pending) applies to: AEGISLASH, AEGISLASH_BLADE, DOUBLADE, HONEDGE", "Ability record LEECH_SEED (source-traced, Codex AI review recorded, owner review pending) applies to: BRELOOM, CRADILY, LILEEP, SHROOMISH", "Ability record FLAME_CHARGE (source-traced, Codex AI review recorded, owner review pending) applies to: CHARCADET, ENTEI, PONYTA, RAPIDASH", "Ability record SLUDGE (source-traced, Codex AI review recorded, owner review pending) applies to: ALOLAN_GRIMER, ALOLAN_MUK, GRIMER, MUK", "Ability record VOLT_SWITCH (source-traced, Codex AI review recorded, owner review pending) applies to: LUXIO, LUXRAY, RAIKOU, SHINX", "Ability record FLOWER_TRICK (source-traced, Codex AI review recorded, owner review pending) applies to: SPRIGATITO, FLORAGATO, MEOWSCARADA", "Ability record DARKEST_LARIAT (source-traced, Codex AI review recorded, owner review pending) applies to: INCINEROAR, LITTEN, TORRACAT", "Ability record DRAGON_BREATH (source-traced, Codex AI review recorded, owner review pending) applies to: GIBLE, GABITE, GARCHOMP", "Ability record DRUM_BEATING (source-traced, Codex AI review recorded, owner review pending) applies to: GROOKEY, RILLABOOM, THWACKEY", "Ability record EXPANDING_FORCE (source-traced, Codex AI review recorded, owner review pending) applies to: BLIPBUG, DOTTLER, ORBEETLE", "Ability record RAGING_BULL (source-traced, Codex AI review recorded, owner review pending) applies to: TAUROS, TAUROS_AQUA_BREED, TAUROS_BLAZE_BREED, TAUROS_COMBAT_BREED", "Ability record ZAP_CANNON (source-traced, Codex AI review recorded, owner review pending) applies to: CHARJABUG, DEOXYS_ATTACK, GRUBBIN, VIKAVOLT", "Ability record EXPLOSION (source-traced, Codex AI review recorded, owner review pending) applies to: ELECTRODE, FORRETRESS, PINECO, VOLTORB", "Ability record BLAZE_KICK (source-traced, Codex AI review recorded, owner review pending) applies to: BLAZIKEN, COMBUSKEN, TORCHIC", "Ability record AQUA_STEP (source-traced, Codex AI review recorded, owner review pending) applies to: QUAQUAVAL, QUAXLY, QUAXWELL", "Ability record ICE_BALL (source-traced, Codex AI review recorded, owner review pending) applies to: ALOLAN_SANDSHREW, ALOLAN_SANDSLASH, SEALEO, SPHEAL, WALREIN", "Ability record BITE (source-traced, Codex AI review recorded, owner review pending) applies to: CARVANHA, LARVITAR, PUPITAR, SHARPEDO, TYRANITAR", "Ability record TELEPORT (source-traced, Codex AI review recorded, owner review pending) applies to: ABRA, ALAKAZAM, COSMOEM, COSMOG, KADABRA, MEW") && lacks(r, "BUG_BUZZ (reviewed)", "IRON_DEFENSE (reviewed)"), r.err)
// ---- review labels follow review-status.json, not mechanical validation ----
r = run("RAICHU")
check("unreviewed records are labelled source-traced with review pending, never 'Reviewed'", has(r, "### Source-traced: NUZZLE", "independent review pending", "does not mean the claims were independently reviewed") && lacks(r, "### Reviewed: NUZZLE"))
r = run("CHARIZARD")
check("records marked reviewed in review-status.json keep the 'Reviewed' label", has(r, "### Reviewed: BLAST_BURN", "independently reviewed") && lacks(r, "Review status:** source-traced"))
r = run("PRIMEAPE")
check("PRIMEAPE passive shows its review status", has(r, "Review status:** source-traced, independent review pending"))
r = run("MAGIKARP")
check("MAGIKARP passive: no structured record, but linked-note context incl. its unresolved line (no blanket 'no reviewed explanation')", r.code === 0 && has(r, "Structured passive record:** none", "Source-backed context in linked production notes that mention this passive", "has no entry in `PassiveEffects`") && lacks(r, "has no reviewed explanation"), r.out.slice(0, 100))
r = run("COSMOEM")
check("COSMOEM passive: context from notes", has(r, "Structured passive record:** none", "Source-backed context in linked production notes"))
r = run("ARCEUS")
check("ARCEUS passive PROTEAN3: no note mentions it -> says so, nothing invented", r.code === 0 && has(r, "Structured passive record:** none", "none found. The passive's effect has not been investigated") && lacks(r, "has no reviewed explanation"))
r = run("VESPIQUEN")
check("VESPIQUEN passive: described via the ability record, not as a passive record", has(r, "described inside the reviewed ability record `abilities.VESPIQUEN_ORDERS`"))
r = run("MAGNEMITE")
check("MAGNEMITE (catalog only): baseline shown, evolution + ability coverage explicitly missing", r.code === 0 && has(r, "Bare baseline", "**Not covered:**", "missing coverage", "No ability record", "No production-reference note is linked") && lacks(r, "Terminal in the declarations"), r.err)
for (const k of ["toString", "__proto__", "constructor", "hasOwnProperty", "charizard", "NOTAPOKEMON", ""]) {
  r = run(k)
  check(`rejects ${JSON.stringify(k)}`, r.code === (k === "" ? 1 : 1) && r.out === "" && /unknown identifier/.test(r.err), `${r.code} ${r.err}`)
}
r = run("DEFAULT")
check("DEFAULT (excluded placeholder): clear error, no record", r.code === 1 && r.out === "" && /excluded/.test(r.err) && /MissingNo/.test(r.err), r.err)
r = run("--list")
check("--list: counts, coverage lists, no dev data", r.code === 0 && common(r) && has(r, "1184", "Ability record CRUNCH (reviewed) applies to: TOTODILE", "Ability record NUZZLE (source-traced, review pending) applies to: PICHU, PIKACHU, RAICHU, ALOLAN_RAICHU, PACHIRISU", "Ability record DRAGON_RAGE (source-traced, review pending) applies to: GYARADOS", "Ability record THRASH (source-traced, review pending) applies to: MANKEY, PRIMEAPE, ANNIHILAPE", "Passive record SURGE_SURFER (source-traced, review pending) applies to: ALOLAN_RAICHU", "Passive record PRIMEAPE (source-traced, review pending) applies to: PRIMEAPE", "Passive gap PACHIRISU (not covered) for: PACHIRISU", "Evolution records (pilot subset, 20)") && lacks(r, "01a3e845"), r.err)
check("usage errors", run().code === 2 && run("--bogus").code === 2 && run("A", "B").code === 2 && run("--list", "CHARIZARD").code === 2)
for (const k of ["CHARIZARD", "VESPIQUEN", "COSMOEM", "ABRA", "TOTODILE", "PICHU", "PRIMEAPE", "GYARADOS", "ALOLAN_RAICHU"]) {
  const o = run(k).out
  check(`no development reference in ${k} output`, !/01a3e845|knowledge\/pilot-|data\/01a3e845/.test(o))
}

// fixtures (temp dir only): mismatched revision / provenance / identity must be refused with exit 3
const dir = mkdtempSync(join(tmpdir(), "lookup-prod-"))
const rd = (f) => JSON.parse(readFileSync(resolve(HERE, "data/07367c34", f), "utf8"))
const rd2 = (f) => JSON.parse(readFileSync(resolve(HERE, "automation", f), "utf8"))
const put = (name, o) => { const p = join(dir, name); writeFileSync(p, JSON.stringify(o)); return p }
const sha2 = "01a3e845e91ebe3144b3c43fa9cd261a5dadafd2"
let c = rd("catalog-units.json"); c.provenance.auditedSourceCommit = sha2
r = run("CHARIZARD", "--catalog", put("cat-rev.json", c))
check("fixture: catalog with another revision refused", r.code === 3 && r.out === "" && /REFUSED/.test(r.err) && r.err.includes(sha2), r.err)
c = rd("catalog-units.json"); c.provenance.gameSourceMatchesAudited = false
r = run("CHARIZARD", "--catalog", put("cat-src.json", c))
check("fixture: failed source-match provenance refused", r.code === 3 && /gameSourceMatchesAudited=false/.test(r.err), r.err)
c = rd("catalog-units.json"); c.pokemon.CHARIZARD.identity.name = "CHARMANDER"
r = run("ABRA", "--catalog", put("cat-id.json", c))
check("fixture: inconsistent catalog identity refused (even for another key)", r.code === 3 && /identity inconsistent/.test(r.err), r.err)
let e = rd("pilot-evolution.json"); e.provenance.auditedSourceCommit = sha2
r = run("PIKACHU", "--evolution", put("evo-rev.json", e))
check("fixture: evolution data with another revision refused", r.code === 3 && /evolution data describes revision/.test(r.err), r.err)
e = rd("pilot-evolution.json"); e.units.PIKACHU.evolutionRule.properties.divergentEvolution.source.revision = sha2
r = run("PIKACHU", "--evolution", put("evo-ref.json", e))
check("fixture: source reference to another revision refused", r.code === 3 && /another revision/.test(r.err), r.err)
e = rd("pilot-evolution.json"); e.units.PIKACHU.identity.index = "9999"
r = run("PIKACHU", "--evolution", put("evo-id.json", e))
check("fixture: evolution identity differing from catalog refused", r.code === 3 && /identity of PIKACHU differs/.test(r.err), r.err)
let a = rd("pilot-abilities.json"); a.sourceSha = sha2
r = run("CHARIZARD", "--abilities", put("abi-rev.json", a))
check("fixture: ability records with another revision refused", r.code === 3 && /ability records describe/.test(r.err), r.err)
a = rd("pilot-abilities.json"); a.abilities.CRUNCH.appliesTo[0].declaredSkill = "BITE"
r = run("TOTODILE", "--abilities", put("abi-skill.json", a))
check("fixture: ability record disagreeing with catalog skill refused", r.code === 3 && /disagrees with the catalog/.test(r.err), r.err)
let ru = rd("reusable-abilities.json"); ru.sourceSha = sha2
r = run("PICHU", "--reusable", put("reu-rev.json", ru))
check("fixture: reusable records with another revision refused", r.code === 3 && r.out === "" && /reusable records describe/.test(r.err), r.err)
ru = rd("reusable-abilities.json"); ru.abilities.NUZZLE.appliesTo[0].stars = 2
r = run("PICHU", "--reusable", put("reu-stars.json", ru))
check("fixture: reusable record disagreeing with catalog stars refused", r.code === 3 && /disagrees with the catalog/.test(r.err), r.err)
ru = rd("reusable-abilities.json"); ru.passives.PRIMEAPE.appliesTo[0].declaredPassive = "NONE"
r = run("PRIMEAPE", "--reusable", put("reu-passive.json", ru))
check("fixture: passive record disagreeing with catalog passive refused", r.code === 3 && /passive disagrees with the catalog/.test(r.err), r.err)
ru = rd("reusable-abilities.json"); ru.passives.DRUMMER.appliesTo[0].declaredPassive = "NONE"
r = run("GROOKEY", "--reusable", put("reu-passive2.json", ru))
check("fixture: imported DRUMMER record disagreeing with the catalog passive refused", r.code === 3 && /passive disagrees with the catalog/.test(r.err), r.err)
ru = rd("reusable-abilities.json"); ru.abilities.CRUNCH = ru.abilities.NUZZLE
r = run("PICHU", "--reusable", put("reu-collide.json", ru))
check("fixture: reusable record colliding with a pilot record refused", r.code === 3 && /collides with a pilot/.test(r.err), r.err)
ru = rd("reusable-abilities.json"); delete ru.passiveGaps
r = run("PICHU", "--reusable", put("reu-nogap.json", ru))
check("fixture: reusable file without passiveGaps -> exit 2", r.code === 2, r.err)
let rvs = rd2("review-status.json"); rvs.records["data/07367c34/reusable-abilities.json#abilities.NUZZLE"].status = "reviewed"
r = run("RAICHU", "--review", put("rev-ok.json", rvs))
check("fixture: when review-status.json marks NUZZLE reviewed the label changes (labels are driven by that file only)", r.code === 0 && has(r, "### Reviewed: NUZZLE") && lacks(r, "### Source-traced: NUZZLE"), r.err)
rvs = rd2("review-status.json"); rvs.records["data/07367c34/reusable-abilities.json#abilities.NOPE"] = { status: "reviewed" }
r = run("RAICHU", "--review", put("rev-bad.json", rvs))
check("fixture: review status naming a record that does not exist is refused (exit 3)", r.code === 3 && /not a saved record/.test(r.err), r.err)
rvs = rd2("review-status.json"); rvs.records["data/07367c34/reusable-abilities.json#abilities.NUZZLE"].status = "maybe"
r = run("RAICHU", "--review", put("rev-bad2.json", rvs))
check("fixture: unknown review status value refused (exit 3)", r.code === 3 && /expected reviewed or unreviewed/.test(r.err), r.err)
// AI review metadata: attributed, scoped, and unable to turn an unreviewed record into an owner-reviewed one
const BB = "data/07367c34/reusable-abilities.json#abilities.BUG_BUZZ"
rvs = rd2("review-status.json"); delete rvs.records[BB].aiReview
r = run("BEEDRILL", "--review", put("rev-noai.json", rvs))
check("fixture: without the aiReview block the label falls back to plain 'independent review pending' (labels are driven by review-status.json only)", r.code === 0 && has(r, "### Source-traced: BUG_BUZZ (independent review pending", "Review status:** source-traced and mechanically validated only") && lacks(r, "Codex"), r.err)
rvs = rd2("review-status.json"); rvs.records[BB].status = "reviewed"
r = run("BEEDRILL", "--review", put("rev-owner.json", rvs))
check("fixture: status 'reviewed' (set by the owner) switches the label to Reviewed; the AI review block alone never does", r.code === 0 && has(r, "### Reviewed: BUG_BUZZ (independently reviewed"), r.err)
rvs = rd2("review-status.json"); rvs.records[BB].aiReview.projectOwnerReviewed = true
r = run("BEEDRILL", "--review", put("rev-ownerclaim.json", rvs))
check("fixture: an aiReview claiming project-owner review on an unreviewed record is refused (exit 3)", r.code === 3 && r.out === "" && /claims project-owner review/.test(r.err), r.err)
rvs = rd2("review-status.json"); delete rvs.records[BB].aiReview.gameplayTested
r = run("BEEDRILL", "--review", put("rev-malformed.json", rvs))
check("fixture: a malformed aiReview (missing gameplayTested) is refused (exit 3)", r.code === 3 && /malformed aiReview/.test(r.err), r.err)
rvs = rd2("review-status.json"); rvs.records[BB].aiReview.gameplayTested = true
r = run("BEEDRILL", "--review", put("rev-gameplay.json", rvs))
check("fixture: gameplayTested is shown exactly as recorded (a true flag would be displayed, so the checked-in file must keep it false)", r.code === 0 && has(r, "gameplay-tested") && lacks(r, "not gameplay-tested"), r.err)
{
  const shipped = rd2("review-status.json")
  const five = ["BUG_BUZZ", "FOUL_PLAY", "LEAF_BLADE", "SOAK", "TORMENT", "IRON_DEFENSE", "MACH_PUNCH", "ROCK_SLIDE", "SLASH", "VENOSHOCK", "AERIAL_ACE", "AQUA_TAIL", "CLANGOROUS_SOUL", "CRABHAMMER", "DISCHARGE", "DIVE", "DOUBLE_SHOCK", "DRAGON_TAIL", "FAKE_TEARS", "FIRE_LASH", "KING_SHIELD", "LEECH_SEED", "FLAME_CHARGE", "SLUDGE", "VOLT_SWITCH", "FLOWER_TRICK", "DARKEST_LARIAT", "DRAGON_BREATH", "DRUM_BEATING", "EXPANDING_FORCE", "RAGING_BULL", "ZAP_CANNON", "EXPLOSION", "BLAZE_KICK", "AQUA_STEP", "POWDER", "ICE_BALL", "BITE", "HORN_LEECH", "TELEPORT", "SUCTION_HEAL", "PARABOLIC_CHARGE", "POLLEN_PUFF", "AROMATHERAPY", "MUD_BUBBLE", "ABSORB", "DRAIN_PUNCH", "DREAM_EATER", "NATURAL_GIFT"]
  check("shipped review-status.json: the imported passives DRUMMER and WATER_SPRING are unreviewed with Codex's scoped AI review, projectOwnerReviewed=false, gameplayTested=false", ["DRUMMER", "WATER_SPRING"].every((n) => { const v = shipped.records[`data/07367c34/reusable-abilities.json#passives.${n}`]; return v?.status === "unreviewed" && v.aiReview?.reviewer === "Codex" && v.aiReview.projectOwnerReviewed === false && v.aiReview.gameplayTested === false && !("by" in v) }))
  check("shipped review-status.json: the forty-nine imported records are unreviewed with Codex's AI review, projectOwnerReviewed=false, gameplayTested=false", five.every((n) => { const v = shipped.records[`data/07367c34/reusable-abilities.json#abilities.${n}`]; return v?.status === "unreviewed" && v.aiReview?.reviewer === "Codex" && v.aiReview.kind === "independent AI source review" && v.aiReview.projectOwnerReviewed === false && v.aiReview.gameplayTested === false && !("by" in v) }))
}
r = run("CHARIZARD", "--catalog", join(dir, "missing.json"))
check("missing file -> exit 2", r.code === 2)

check("no writes: assistant/ tree byte-identical before and after all lookups", snapshot() === before)
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed")
process.exit(failures ? 1 : 0)
