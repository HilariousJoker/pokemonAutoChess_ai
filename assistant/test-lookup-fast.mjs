// Checks for lookup-fast.mjs. Writes ONLY fixture files under the OS temp dir; asserts the assistant/ tree is byte-identical afterwards.
// Usage: node assistant/test-lookup-fast.mjs   (exit 0 = all pass)
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const FAST = resolve(HERE, "lookup-fast.mjs")
const DATA = resolve(HERE, "data/07367c34")
const run = (...a) => { const t = Date.now(); const r = spawnSync(process.execPath, [FAST, ...a], { encoding: "utf8" }); return { code: r.status, out: r.stdout, err: r.stderr, ms: Date.now() - t } }
let failures = 0
const check = (name, ok, detail = "") => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`) }
const has = (r, ...s) => s.every((x) => r.out.includes(x))
const lacks = (r, ...s) => s.every((x) => !r.out.includes(x))
const tree = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tree(join(d, e.name)) : [join(d, e.name)]))
const snapshot = () => tree(HERE).filter((f) => !f.includes("node_modules")).sort().map((f) => `${f}:${createHash("sha256").update(readFileSync(f)).digest("hex")}`).join("\n")
const before = snapshot()

// ---- the requested practical cases ----
let r = run("--unit", "WALREIN")
check("WALREIN: ICE_BALL raw +10 / +12 with Big Eater Belt, 3★ base 30 + 1.5 x SPE_DEF, no cap, Codex AI review not owner review", r.code === 0 && has(r, "Ability ICE_BALL", "raw +10 request; processed +12 with Big Eater Belt", '{"base":30,"multiplier":1.5}', "no upper cap", "NOT a project-owner review", "NOT gameplay-tested", "Evolution: NOT covered", "Passive: none declared"), r.err)
r = run("--unit", "Tyranitar")
check("TYRANITAR (normalized name): BITE heal ceil(30 %) of takenDamage with shield/Cover Band/Shiny Charm/Fossil accounting, flinch, wound exception", r.code === 0 && has(r, "[UNIT] TYRANITAR", "Ability BITE", "ceil(0.3 x takenDamage)", "Cover Band", "Shiny Charm", "Fossil", "flinch", "BLOODMOON"), r.err)
// ---- eighth import (SUCTION_HEAL, PARABOLIC_CHARGE, POLLEN_PUFF, AROMATHERAPY): FAST finds the records and notes with no per-record wiring ----
for (const [unit, ab, stars, raw, bits] of [
  ["TYNAMO", "SUCTION_HEAL", 1, 15, ["returned figure, not the HP actually lost"]], ["EELEKTRIK", "SUCTION_HEAL", 2, 30, ["Fossil synergy branch"]], ["EELEKTROSS", "SUCTION_HEAL", 3, 60, ["Cover Band"]],
  ["HELIOPTILE", "PARABOLIC_CHARGE", 1, 25, ["pre-heal overHeal", "declared in the table but unused by the two bound baseline classes"]], ["HELIOLISK", "PARABOLIC_CHARGE", 2, 50, ["UNMODIFIED request", "the indirect branches of handleHeal do"]],
  ["CUTIEFLY", "POLLEN_PUFF", 1, 30, ["lowest ABSOLUTE current hp", "not 40% of the recipient's existing max HP"]], ["RIBOMBEE", "POLLEN_PUFF", 2, 60, ["addMaxHP(0.4 x overheal, recipient, 0, false, false)"]],
  ["PETILIL", "AROMATHERAPY", 1, 20, ["The same holds for burn", "does NOT clear the wound flag"]], ["LILIGANT", "AROMATHERAPY", 2, 40, ["x0.5 burn modifier"]]]) {
  r = run("--unit", unit)
  check(`${unit}: ${ab} found automatically (${stars}★ raw ${raw}), scoped Codex AI review, not owner-reviewed or gameplay-tested, executed-probe evidence wording, note linked by heading`, r.code === 0 && has(r, `[UNIT] ${unit}`, `Ability ${ab} — source-traced; independent review pending; independent AI source review by Codex recorded`, `${stars}★`, `this unit (${stars}★): raw ${raw}`, "NOT a project-owner review", "NOT gameplay-tested", "executed probes", "were NOT executed", `reusable-abilities.json#abilities.${ab}; note assistant/knowledge/07367c34/reusable-abilities.md#${ab.toLowerCase()}`, ...bits) && lacks(r, "undefined", "NaN", "[object", "no probe was run", "not reachable"), r.err || r.out.slice(0, 200))
}
r = run("--list")
check("--list: 60 ability records, the abilities of the eighth, tenth and eleventh imports with their own units only", r.code === 0 && has(r, "90 ability records", "Ability PROTECT: DEOXYS_DEFENSE, KABUTO", "Ability PSYBEAM: STARMIE, STARYU", "Ability PSYSHOCK: GOLDUCK, PSYDUCK", "Ability PSYSTRIKE: MEWTWO, SHADOW_MEWTWO", "Ability PSYSHIELD_BASH: STANTLER, WYRDEER", "Ability SUCTION_HEAL: TYNAMO, EELEKTRIK, EELEKTROSS", "Ability PARABOLIC_CHARGE: HELIOPTILE, HELIOLISK", "Ability POLLEN_PUFF: CUTIEFLY, RIBOMBEE", "Ability AROMATHERAPY: PETILIL, LILIGANT", "Ability MUD_BUBBLE: MARSHTOMP, MUDKIP, SWAMPERT", "Ability ABSORB: PARAS, PARASECT", "Ability DRAIN_PUNCH: MIENFOO, MIENSHAO", "Ability DREAM_EATER: DROWZEE, HYPNO", "Ability NATURAL_GIFT: CHERRIM, CHERRIM_SUNLIGHT, CHERUBI"), r.err)
// ---- ninth import (passives DRUMMER, WATER_SPRING): FAST finds the passive records and notes automatically; ability and evolution coverage stay separate ----
for (const [unit, passive, stars, abilityLine] of [
  ["GROOKEY", "DRUMMER", 1, "Ability DRUM_BEATING — source-traced"], ["THWACKEY", "DRUMMER", 2, "Ability DRUM_BEATING — source-traced"], ["RILLABOOM", "DRUMMER", 3, "Ability DRUM_BEATING — source-traced"],
  ["MUDKIP", "WATER_SPRING", 1, "Ability MUD_BUBBLE — source-traced"], ["MARSHTOMP", "WATER_SPRING", 2, "Ability MUD_BUBBLE — source-traced"], ["SWAMPERT", "WATER_SPRING", 3, "Ability MUD_BUBBLE — source-traced"]]) {
  r = run("--unit", unit)
  check(`${unit}: passive ${passive} found automatically with the scoped Codex AI review (not owner-reviewed, not gameplay-tested); Protect versus Rune Protect and fatigue rounding; ability and evolution coverage stated separately`, r.code === 0 && has(r, `[UNIT] ${unit}`, `${stars}★`, `Passive ${passive} — source-traced; independent review pending; independent AI source review by Codex recorded`, "NOT a project-owner review", "NOT gameplay-tested", "status.protect (Protect)", "Rune Protect", "round(2.5) = 3", abilityLine, "Evolution: NOT covered (outside the 20-unit evolution pilot)", `reusable-abilities.json#passives.${passive}; note assistant/knowledge/07367c34/reusable-abilities.md#${passive.toLowerCase()}-passive`) && lacks(r, "undefined", "NaN", "[object", "protected (Rune Protect)", "candidate is source reading", "Evolution link"), r.err || r.out.slice(0, 200))
}
r = run("--list")
check("--list: 4 passive records (DRUMMER and WATER_SPRING added, PACHIRISU still a labelled gap)", r.code === 0 && has(r, "4 passive records, 1 labelled passive gap(s)") && /Passive DRUMMER: GROOKEY, THWACKEY, RILLABOOM|Passive DRUMMER: GROOKEY, RILLABOOM, THWACKEY/.test(r.out) && /Passive WATER_SPRING: MARSHTOMP, MUDKIP, SWAMPERT|Passive WATER_SPRING: MUDKIP, MARSHTOMP, SWAMPERT/.test(r.out) && has(r, "90 ability records"), r.err)
// ---- tenth import (MUD_BUBBLE, ABSORB, DRAIN_PUNCH, DREAM_EATER, NATURAL_GIFT): FAST finds all twelve bindings and their notes with no per-record wiring ----
for (const [unit, ab, stars, raw, bits] of [
  ["MUDKIP", "MUD_BUBBLE", 1, 10, ["353 at speed 44, 227 at speed 100", "not a guarantee of the next action or of the actual attack timing"]], ["MARSHTOMP", "MUD_BUBBLE", 2, 20, ["addMaxHP(0.4 x overheal)"]], ["SWAMPERT", "MUD_BUBBLE", 3, 40, ["addShield(round(0.3 x stones x the raw requested heal)"]],
  ["PARAS", "ABSORB", 1, 30, ["3 for PARAS (1 star), 6 for PARASECT (2 stars)", "does not read takenDamage"]], ["PARASECT", "ABSORB", 2, 60, ["identically when the damage call returns 0"]],
  ["MIENFOO", "DRAIN_PUNCH", 1, "2 x ATK at cast time", ["not universally the HP the target lost", "AP and crit are not applied a second time"]], ["MIENSHAO", "DRAIN_PUNCH", 2, "2 x ATK at cast time", ["damage 300 on 500 HP returns 500 with HP unchanged"]],
  ["DROWZEE", "DREAM_EATER", 1, 45, ["ORIGINAL CAST TARGET, not on the enemy that was found", "150 PP with maxPP 100 ends at 50"]], ["HYPNO", "DREAM_EATER", 2, 90, ["pokemon-state.ts:734-743", "does not clear the sleep flag"]],
  ["CHERUBI", "NATURAL_GIFT", 1, 30, ["status runeProtect → the lowest-ratio ally (possibly the caster): raw 1★ 1000, 2★ 2000, 3★ 3000, 4★ 6000, fallback 6000 → this unit: raw 1000 ms (requested)", "lowest hp/maxHP FRACTION"]],
  ["CHERRIM", "NATURAL_GIFT", 2, 60, ["→ this unit: raw 2000 ms (requested)", "an existing longer timer is kept"]], ["CHERRIM_SUNLIGHT", "NATURAL_GIFT", 3, 90, ["→ this unit: raw 3000 ms (requested)", "the heal runs before Rune Protect"]]]) {
  r = run("--unit", unit)
  check(`${unit}: ${ab} found automatically (${stars}★ raw ${raw}), scoped Codex AI review, not owner-reviewed or gameplay-tested, executed-probe evidence wording, note linked by heading`, r.code === 0 && has(r, `[UNIT] ${unit}`, `Ability ${ab} — source-traced; independent review pending; independent AI source review by Codex recorded`, `${stars}★`, `this unit (${stars}★): raw ${raw}`, "NOT a project-owner review", "NOT gameplay-tested", "executed probes", "were NOT executed", `reusable-abilities.json#abilities.${ab}; note assistant/knowledge/07367c34/reusable-abilities.md#${ab.toLowerCase()}`, ...bits) && lacks(r, "undefined", "NaN", "[object", "no probe or fight", "not reachable", "attacks again quickly"), r.err || r.out.slice(0, 200))
}
// ---- eleventh import (PROTECT, PSYBEAM, PSYSHOCK, PSYSTRIKE, PSYSHIELD_BASH): FAST finds all ten bindings and their notes automatically; missing-value artifacts checked by pattern ----
const ARTIFACT_F = /(?:\braw|Guards:|Order:|Scaling:|Resolution:|duration|Combat effect \(traced\):)\s+undefined\b|: undefined\b|\bundefined\s*(?:ms|★)|\[object|\bNaN\b/
for (const [unit, ab, stars, raw, bits] of [
  ["KABUTO", "PROTECT", 1, 500, ["this unit: raw 500 ms (flat table value, before the AP factor 2 + AP/100 and the crit factor)", "requests round(500 x 3 x 1.5) = 2250 ms"]], ["DEOXYS_DEFENSE", "PROTECT", 3, 2500, ["1000 ms (Kabuto, 1 star) and 5000 ms (Deoxys Defense, 3 stars)", "Passive ALIEN_DNA: no canonical passive record"]],
  ["STARYU", "PSYBEAM", 1, 25, ["this unit: raw 2000 ms (requested)", "Protect does not itself block confusion"]], ["STARMIE", "PSYBEAM", 2, 50, ["this unit: raw 3000 ms (requested)", "all 2256 ordered pairs of distinct positions"]],
  ["PSYDUCK", "PSYSHOCK", 1, 20, ["both computed BEFORE any PP is removed and are never recomputed", "Passive PSYDUCK: no canonical passive record"]], ["GOLDUCK", "PSYSHOCK", 2, 40, ["11 enraged because 10.5 rounds up", "Protective Pads"]],
  ["MEWTWO", "PSYSTRIKE", 3, 80, ["the endpoint is not universally an enemy", "WITHOUT checking its team"]], ["SHADOW_MEWTWO", "PSYSTRIKE", 3, 80, ["with no check that the damage succeeded", "Protect does not block the movement primitive"]],
  ["STANTLER", "PSYSHIELD_BASH", 3, 50, ["this unit: raw 1000 ms (fixed request)", "retained-earlier-cell case"]], ["WYRDEER", "PSYSHIELD_BASH", 4, 60, ["unforced self-move that does not consult canBeMoved", "ORIGINAL CAST TARGET is added without another team check"]]]) {
  r = run("--unit", unit)
  check(`${unit}: ${ab} found automatically (${stars}★ raw ${raw}), scoped Codex AI review, not owner-reviewed or gameplay-tested, executed-probe evidence wording, note linked by heading, no missing-value artifact`, r.code === 0 && has(r, `[UNIT] ${unit}`, `Ability ${ab} — source-traced; independent review pending; independent AI source review by Codex recorded`, `${stars}★`, `this unit (${stars}★): raw ${raw}`, "NOT a project-owner review", "NOT gameplay-tested", "executed probes", "were NOT executed", `reusable-abilities.json#abilities.${ab}; note assistant/knowledge/07367c34/reusable-abilities.md#${ab.toLowerCase()}`, ...bits) && !ARTIFACT_F.test(r.out) && lacks(r, "candidate is source reading", "not stored by this strategy"), r.err || r.out.slice(0, 200))
}
// ---- catch-up cycle 1 (RAPID_SPIN, REFLECT, ROCK_HEAD, ROCK_SMASH, ROCK_WRECKER): FAST finds all ten bindings and notes automatically ----
const ARTIFACT_C1 = /(?:\braw|Guards:|Order:|Scaling:|Resolution:|duration|Combat effect \(traced\):)\s+undefined\b|: undefined\b|\bundefined\s*(?:ms|★)|\[object|\bNaN\b/
for (const [unit, ab, stars, raw, bits] of [
  ["PHANPY", "RAPID_SPIN", 1, 20, ["sampled BEFORE the damage call"]], ["DONPHAN", "RAPID_SPIN", 2, 50, ["unconditional"]], ["ESPURR", "REFLECT", 1, 0.5, ["through attacker.handleDamage (not handleSpecialDamage)"]], ["MEOWSTIC_MALE", "REFLECT", 2, 0.75, ["no-reflection cases"]],
  ["TYRUNT", "ROCK_HEAD", 1, 1.2, ["current atk + current def"]], ["TYRANTRUM", "ROCK_HEAD", 2, 1.2, ["not read by this ability"]], ["ARCHEN", "ROCK_SMASH", 1, 25, ["does not benefit from its own new armor reduction"]], ["ARCHEOPS", "ROCK_SMASH", 2, 50, ["this unit: raw 6000 ms (requested)"]],
  ["DWEBBLE", "ROCK_WRECKER", 1, 80, ["receives the CASTER as pkm"]], ["CRUSTLE", "ROCK_WRECKER", 2, 160, ["this unit: raw 2000 ms (requested)"]]]) {
  r = run("--unit", unit)
  check(`${unit}: ${ab} found automatically (${stars}★ raw ${raw}), scoped Codex AI review (original draft inspection), not owner-reviewed or gameplay-tested, note linked by heading, no missing-value artifact`, r.code === 0 && has(r, `[UNIT] ${unit}`, `Ability ${ab} — source-traced; independent review pending; independent AI source review by Codex recorded`, `this unit (${stars}★): raw ${raw}`, "NOT a project-owner review", "NOT gameplay-tested", "executed probes", `reusable-abilities.json#abilities.${ab}; note assistant/knowledge/07367c34/reusable-abilities.md#${ab.toLowerCase()}`, ...bits) && !ARTIFACT_C1.test(r.out) && lacks(r, "candidate is source reading"), r.err || r.out.slice(0, 200))
}
// ---- catch-up cycle 2 (SAND_TOMB, SCREECH, SEED_FLARE, SHADOW_SNEAK, SHEER_COLD): FAST finds all ten bindings and notes automatically ----
const ARTIFACT_C2 = /(?:\braw|Guards:|Order:|Scaling:|Resolution:|duration|Combat effect \(traced\):)\s+undefined\b|: undefined\b|\bundefined\s*(?:ms|★)|\[object|\bNaN\b/
for (const [unit, ab, stars, raw, bits] of [
  ["HIPPOPOTAS", "SAND_TOMB", 1, 3000, ["right after a successful paralysis application"]], ["HIPPODOWN", "SAND_TOMB", 2, 5000, ["not guaranteed to persist"]], ["KRICKETOT", "SCREECH", 1, -2, ["installs no timer and no restore step"]], ["KRICKETUNE", "SCREECH", 2, -4, ["Twist Band"]],
  ["SHAYMIN", "SEED_FLARE", 3, -3, ["not the whole board"]], ["SHAYMIN_SKY", "SEED_FLARE", 4, -3, ["not the whole board"]], ["MIMIKYU", "SHADOW_SNEAK", 3, 50, ["for TRUE as well"]], ["MIMIKYU_BUSTED", "SHADOW_SNEAK", 3, 50, ["for TRUE as well"]],
  ["SNOVER", "SHEER_COLD", 1, 50, ["Math.max(0, x)"]], ["ABOMASNOW", "SHEER_COLD", 2, 100, ["not a guaranteed kill"]]]) {
  r = run("--unit", unit)
  check(`${unit}: ${ab} found automatically (${stars}★ raw ${raw}), scoped Codex AI review (original draft inspection), not owner-reviewed or gameplay-tested, note linked by heading, no missing-value artifact`, r.code === 0 && has(r, `[UNIT] ${unit}`, `Ability ${ab} — source-traced; independent review pending; independent AI source review by Codex recorded`, `this unit (${stars}★): raw ${raw}`, "NOT a project-owner review", "NOT gameplay-tested", "executed probes", `reusable-abilities.json#abilities.${ab}; note assistant/knowledge/07367c34/reusable-abilities.md#${ab.toLowerCase()}`, ...bits) && !ARTIFACT_C2.test(r.out) && lacks(r, "candidate is source reading"), r.err || r.out.slice(0, 200))
}
// ---- catch-up cycle 3 (SHORE_UP, SOLAR_BEAM, SPLASH, SUPER_FANG, TAILWIND): FAST finds all ten bindings and notes automatically ----
const ARTIFACT_C3 = /(?:\braw|Guards:|Order:|Scaling:|Resolution:|duration|Combat effect \(traced\):)\s+undefined\b|: undefined\b|\bundefined\s*(?:ms|★)|\[object|\bNaN\b/
for (const [unit, ab, stars, raw, bits] of [
  ["SANDYGAST", "SHORE_UP", 1, 0.2, ["comes BEFORE the alive / protect guard"]], ["PALOSSAND", "SHORE_UP", 2, 0.25, ["not permanent"]], ["SUNKERN", "SOLAR_BEAM", 1, 25, ["Exactly diagonal steps visit ONLY the diagonal cells"]], ["SUNFLORA", "SOLAR_BEAM", 2, 50, ["weather is not always a reduction"]],
  ["MAGIKARP", "SPLASH", 1, "", ["ALWAYS runs the OnAbilityCastEffect hooks"]], ["FEEBAS", "SPLASH", 1, "", ["castAbility returns before anything when canCast is false"]], ["BIDOOF", "SUPER_FANG", 1, 0.1, ["ceil(308.5) = 309"]], ["BIBAREL", "SUPER_FANG", 2, 0.15, ["apBoost false"]],
  ["DRIFLOON", "TAILWIND", 1, 5, ["ROUNDS (Math.round)"]], ["DRIFBLIM", "TAILWIND", 2, 10, ["runs the Belt and Twist helpers AGAIN"]]]) {
  r = run("--unit", unit)
  check(`${unit}: ${ab} found automatically (${stars}★ raw ${raw}), scoped Codex AI review (original draft inspection), not owner-reviewed or gameplay-tested, note linked by heading, no missing-value artifact`, r.code === 0 && has(r, `[UNIT] ${unit}`, `Ability ${ab} — source-traced; independent review pending; independent AI source review by Codex recorded`, `this unit (${stars}★): raw ${raw}`, "NOT a project-owner review", "NOT gameplay-tested", "executed probes", `reusable-abilities.json#abilities.${ab}; note assistant/knowledge/07367c34/reusable-abilities.md#${ab.toLowerCase()}`, ...bits) && !ARTIFACT_C3.test(r.out) && lacks(r, "candidate is source reading"), r.err || r.out.slice(0, 200))
}
// ---- catch-up cycle 4 (TAIL_WHIP, TICKLE, TOXIC, WATERFALL, YAWN): FAST finds all ten bindings and notes automatically ----
const ARTIFACT_C4 = /(?:\braw|Guards:|Order:|Scaling:|Resolution:|duration|Combat effect \(traced\):)\s+undefined\b|: undefined\b|\bundefined\s*(?:ms|★)|\[object|\bNaN\b/
for (const [unit, ab, stars, raw, bits] of [
    ["ALOLAN_RATTATA", "TAIL_WHIP", 1, 20, ["30 % of DEF 5 is -1.5"]], ["ALOLAN_RATICATE", "TAIL_WHIP", 2, 30, ["with a Twist Band each cast instead GAINS"]],
    ["AIPOM", "TICKLE", 1, 1, ["target.team is the only thing read from the cast target"]], ["AMBIPOM", "TICKLE", 2, 2, ["among four enemies at distance 1 the first two in row-major cell order"]],
    ["TENTACOOL", "TOXIC", 1, "", ["EffectEnum.TOXIC is a separate synergy effect that this strategy reads only"]], ["TENTACRUEL", "TOXIC", 2, "", ["a GLISCOR uses stacks - 2"]],
    ["GOLDEEN", "WATERFALL", 1, 50, ["ANY active possession keeps its cooldown"]], ["SEAKING", "WATERFALL", 2, 100, ["removes EVERY board effect registered on the caster's own cell"]],
    ["SLOWPOKE", "YAWN", 1, 15, ["the AP change still happens when the fatigue is refused"]], ["SLOWBRO", "YAWN", 2, 30, ["a stored number only"]]]) {
  r = run("--unit", unit)
  check(`${unit}: ${ab} found automatically (${stars}★ raw ${raw}), scoped Codex AI review (original draft inspection), not owner-reviewed or gameplay-tested, note linked by heading, no missing-value artifact`, r.code === 0 && has(r, `[UNIT] ${unit}`, `Ability ${ab} — source-traced; independent review pending; independent AI source review by Codex recorded`, `this unit (${stars}★): raw ${raw}`, "NOT a project-owner review", "NOT gameplay-tested", "executed probes", `reusable-abilities.json#abilities.${ab}; note assistant/knowledge/07367c34/reusable-abilities.md#${ab.toLowerCase()}`, ...bits) && !ARTIFACT_C4.test(r.out) && lacks(r, "candidate is source reading"), r.err || r.out.slice(0, 200))
}
// ---- catch-up batch 2 cycle 1 (AGILITY, HARDEN, DEFENSE_CURL, MEDITATE, QUIVER_DANCE): FAST finds all ten bindings and notes automatically ----
const ARTIFACT_B1 = /(?:\braw|Guards:|Order:|Scaling:|Resolution:|duration|Combat effect \(traced\):)\s+undefined\b|: undefined\b|\bundefined\s*(?:ms|★)|\[object|\bNaN\b/
for (const [unit, ab, stars, raw, bits] of [
    ["RATTATA", "AGILITY", 1, 10, ["limited to the ordinary bound units"]], ["RATICATE", "AGILITY", 2, 20, ["preventDefaultAnim true"]],
    ["ANORITH", "HARDEN", 1, 4, ["the rounding precedes the Belt"]], ["ARMALDO", "HARDEN", 2, 8, ["SPE_DEF is untouched"]],
    ["BRONZOR", "DEFENSE_CURL", 1, 5, ["not a guaranteed 250 ms wait or next-action time"]], ["BRONZONG", "DEFENSE_CURL", 2, 10, ["addDefense, addSpecialDefense, resetCooldown"]],
    ["MEDITITE", "MEDITATE", 1, 9, ["not a field of the bare-unit data"]], ["MEDICHAM", "MEDITATE", 2, 16, ["the fixed snapshot is added each time"]],
    ["BURMY_PLANT", "QUIVER_DANCE", 1, 3, ["a Belt makes it 25"]], ["MOTHIM", "QUIVER_DANCE", 2, 4, ["being last, does not boost this cast's other gains"]]]) {
  r = run("--unit", unit)
  check(`${unit}: ${ab} found automatically (${stars}★ raw ${raw}), scoped Codex AI review (original draft inspection), not owner-reviewed or gameplay-tested, note linked by heading, no missing-value artifact`, r.code === 0 && has(r, `[UNIT] ${unit}`, `Ability ${ab} — source-traced; independent review pending; independent AI source review by Codex recorded`, `this unit (${stars}★): raw ${raw}`, "NOT a project-owner review", "NOT gameplay-tested", "executed probes", `reusable-abilities.json#abilities.${ab}; note assistant/knowledge/07367c34/reusable-abilities.md#${ab.toLowerCase()}`, ...bits) && !ARTIFACT_B1.test(r.out) && lacks(r, "candidate is source reading"), r.err || r.out.slice(0, 200))
}
// ---- catch-up batch 2 cycle 2 (HAPPY_HOUR, FAIRY_WIND, JET_PUNCH, PECK, RAZOR_WIND): FAST finds all ten bindings and notes automatically ----
const ARTIFACT_B2 = /(?:\braw|Guards:|Order:|Scaling:|Resolution:|duration|Combat effect \(traced\):)\s+undefined\b|: undefined\b|\bundefined\s*(?:ms|★)|\[object|\bNaN\b/
for (const [unit, ab, stars, raw, bits] of [
    ["EEVEE", "HAPPY_HOUR", 1, 2, ["no hp or targettability filter"]], ["VAPOREON", "HAPPY_HOUR", 2, 4, ["Executed (ATK 20)"]],
    ["FLABEBE", "FAIRY_WIND", 1, 2.5, ["the cast's crit flag is still passed to addPP"]], ["FLORGES_YELLOW", "FAIRY_WIND", 3, 10, ["no Big Eater Belt bonus and no maxPP increase"]],
    ["FINIZEN", "JET_PUNCH", 3, 1, ["STORED speed stat, not a paralysis-adjusted rate"]], ["PALAFIN_HERO", "JET_PUNCH", 4, 1.5, ["The request reads the STORED speed stat"]],
    ["SPEAROW", "PECK", 1, 10, ["can be below or above the table value"]], ["FEAROW", "PECK", 2, 30, ["No status is added"]],
    ["NOIBAT", "RAZOR_WIND", 1, 20, ["WITHOUT needing ABILITY_CRIT"]], ["FARFETCH_D", "RAZOR_WIND", 3, 80, ["selects no geometry or area"]]]) {
  r = run("--unit", unit)
  check(`${unit}: ${ab} found automatically (${stars}★ raw ${raw}), scoped Codex AI review (original draft inspection), not owner-reviewed or gameplay-tested, note linked by heading, no missing-value artifact`, r.code === 0 && has(r, `[UNIT] ${unit}`, `Ability ${ab} — source-traced; independent review pending; independent AI source review by Codex recorded`, `this unit (${stars}★): raw ${raw}`, "NOT a project-owner review", "NOT gameplay-tested", "executed probes", `reusable-abilities.json#abilities.${ab}; note assistant/knowledge/07367c34/reusable-abilities.md#${ab.toLowerCase()}`, ...bits) && !ARTIFACT_B2.test(r.out) && lacks(r, "candidate is source reading"), r.err || r.out.slice(0, 200))
}
r = run("--unit", "CHARIZARD", "--item", "Nullify Bandanna")
check("CHARIZARD + Nullify Bandanna in one lookup: reviewed BLAST_BURN raw 120 and the bandanna card (holder cannot cast)", r.code === 0 && has(r, "Ability BLAST_BURN — independently reviewed", "raw 120", "[ITEMS]", "NULLIFY BANDANNA", "Holder cannot cast"), r.err)
r = run("--unit", "WALREIN", "--item", "Big Eater Belt")
check("WALREIN + Big Eater Belt in one lookup", r.code === 0 && has(r, "[UNIT] WALREIN", "BIG EATER BELT", "x1.25 (rounded down)", "Silk Scarf + Miracle Seed"), r.err)
r = run("--component", "Silk Scarf")
const scarf = ["FRIEND_BOW", "BLACK_BELT", "MACH_RIBBON", "EXPLOSIVE_BAND", "TWIST_BAND", "LUCKY_RIBBON", "BIG_EATER_BELT", "COVER_BAND", "EFFICIENT_BANDANNA", "NULLIFY_BANDANNA"]
check("Silk Scarf component: all ten combinations listed with recipe and declared stats", r.code === 0 && has(r, "(10)", ...scarf.map((k) => `(${k})`)) && scarf.every((k) => new RegExp(`\\(${k}\\): Silk Scarf \\+ [A-Za-z ]+ \\|`).test(r.out)), r.err)
r = run("--unit", "POLIWAG", "--item", "Twist Band")
check("POLIWAG + Twist Band: SOAK record and the Twist Band card (negative changes from enemies become positive)", r.code === 0 && has(r, "Ability SOAK", "TWIST BAND", "Negative changes from enemies or the environment to 11 stats become positive"), r.err)
r = run("--item-list")
check("item recipe list is complete (55 recipes)", r.code === 0 && has(r, "55 craftable recipe outputs") && r.out.split("\n").filter((l) => /^[A-Z_]+ +.*\[.* \+ .*\]/.test(l)).length === 55, r.err)

// ---- coverage honesty: candidate-only ability, shared skill identifier, family membership ----
const cand = JSON.parse(readFileSync(join(HERE, "candidates/07367c34/ability-BULLDOZE.json"), "utf8"))
r = run("--unit", "TORTERRA")
check("TORTERRA (BULLDOZE exists only as a candidate): reported as not covered, no draft text leaked", r.code === 0 && has(r, "Ability BULLDOZE: NOT covered", "Evolution: NOT covered") && lacks(r, cand.record.summary.slice(0, 60), "candidate") && r.out.length < 1500, r.out)
r = run("--unit", "CROCONAW")
check("CROCONAW: the TOTODILE-only CRUNCH record is not applied to it", r.code === 0 && has(r, "NOT covered", "covers only TOTODILE", "not applied here") && lacks(r, "Ability CRUNCH —"), r.out.slice(0, 400))
r = run("--unit", "MAGNEMITE")
check("passive/evolution gaps are separate (MAGNEMITE-style unit with no records says so per kind)", r.code === 0 && has(r, "Ability", "Passive", "Evolution"), r.err)
r = run("--unit", "ALOLAN_RAICHU")
check("ALOLAN_RAICHU: structured SURGE_SURFER passive and evolution pilot, each its own line", r.code === 0 && has(r, "Passive SURGE_SURFER —", "Evolution (pilot record)"), r.err)
r = run("--unit", "PACHIRISU")
check("PACHIRISU: passive reported as a GAP", r.code === 0 && has(r, "Passive PACHIRISU: GAP — not covered"), r.err)
r = run("--unit", "VESPIQUEN")
check("VESPIQUEN: placeholder skill and conditional modes with the acquisition caveat", r.code === 0 && has(r, "is a placeholder", "ATTACK_ORDER", "Acquisition caveat"), r.err)
r = run("--unit", "PIKACHU", "--unit", "RAICHU")
check("several units in one command, de-duplicated", r.code === 0 && (r.out.match(/\[UNIT\]/g) ?? []).length === 2 && run("--unit", "PIKACHU", "--unit", "Pikachu").out.match(/\[UNIT\]/g).length === 1)
r = run("--unit", "WALREIN", "--detail")
check("--detail adds the review scope and the unverified dependencies", r.code === 0 && has(r, "modified self SPE_DEF gain", "Depends on generic combat processing that is unverified", "Shared record: declared by"), r.err)
r = run("--list")
check("--list shows per-unit coverage and the evolution pilot", r.code === 0 && has(r, "Unit coverage", "Ability ICE_BALL: ", "Passive gap PACHIRISU", "Evolution pilot:"), r.err)

// ---- identifiers: unknown, prototype keys, ambiguity, excluded, bad usage ----
for (const bad of ["MISSINGNO", "__proto__", "constructor", "toString", "hasOwnProperty", "prototype", "", "   ", "ARTICUNO_PROTO"]) {
  const x = run("--unit", bad)
  check(`unit ${JSON.stringify(bad)} refused without a guess`, x.code === 1 && x.out === "" && /Unknown unit|Empty unit/.test(x.err), `${x.code} ${x.err}`)
}
for (const bad of [["--item", "Banana"], ["--item", "__proto__"], ["--item", "Soul"], ["--item", "Eviolite"], ["--unit"], ["--bogus"], ["WALREIN"], ["--unit", "WALREIN", "--item", "Banana"], ["--item-list", "--item", "Soul Dew"], ["--component", "Silk Scarf", "--component", "Magnet"], []]) {
  const x = run(...bad)
  check(`bad request ${JSON.stringify(bad)} exits 1 with nothing on stdout`, x.code === 1 && x.out === "" && x.err.length > 0, `${x.code} ${x.out.slice(0, 80)}`)
}
const fxCat = JSON.parse(readFileSync(join(DATA, "catalog-units.json"), "utf8"))
const tmp = mkdtempSync(join(tmpdir(), "lookup-fast-test-"))
const put = (name, o) => { const p = join(tmp, name); writeFileSync(p, JSON.stringify(o)); return p }
// ambiguity: two keys that normalize to the same name (fixture catalog; the real catalog has no such pair)
const amb = structuredClone(fxCat)
amb.pokemon["WALREIN_"] = structuredClone(amb.pokemon.WALREIN); amb.pokemon["WALREIN_"].identity = { ...amb.pokemon.WALREIN.identity, key: "WALREIN_", name: "WALREIN_" }
amb.registry["WALREIN_"] = amb.registry.WALREIN; amb.inventory.identifiers.push("WALREIN_")
r = run("--catalog", put("amb.json", amb), "--unit", "walrein ")
check("ambiguous normalized name rejected, listing both identifiers", r.code === 1 && /Ambiguous unit/.test(r.err) && r.err.includes("WALREIN") && r.err.includes("WALREIN_"), `${r.code} ${r.err}`)
r = run("--catalog", put("amb2.json", amb), "--unit", "WALREIN")
check("an exact identifier stays unambiguous", r.code === 0 && has(r, "[UNIT] WALREIN —"), r.err)

// ---- incompatible snapshot / binding fixtures ----
const sha = structuredClone(fxCat); sha.provenance.auditedSourceCommit = "0".repeat(40)
r = run("--catalog", put("sha.json", sha), "--unit", "WALREIN", "--item", "Big Eater Belt")
check("catalog from another revision refused (exit 3), nothing on stdout", r.code === 3 && r.out === "" && /REFUSED/.test(r.err), `${r.code} ${r.err}`)
const dev = structuredClone(fxCat); dev.provenance.profile = "development"
r = run("--catalog", put("dev.json", dev), "--unit", "WALREIN")
check("development-profile catalog refused", r.code === 3 && /production-reference/.test(r.err), r.err)
const reu = JSON.parse(readFileSync(join(DATA, "reusable-abilities.json"), "utf8"))
const bind = structuredClone(reu); bind.abilities.ICE_BALL.appliesTo.find((u) => u.key === "WALREIN").maxPP = 1
r = run("--reusable", put("bind.json", bind), "--unit", "WALREIN")
check("explicit unit binding that disagrees with the catalog refused", r.code === 3 && /appliesTo WALREIN disagrees/.test(r.err), r.err)
const reuSha = structuredClone(reu); reuSha.sourceSha = "1".repeat(40)
r = run("--reusable", put("reusha.json", reuSha), "--unit", "WALREIN")
check("ability records from another revision refused", r.code === 3 && /not the pinned/.test(r.err), r.err)
const rv = JSON.parse(readFileSync(resolve(HERE, "automation/review-status.json"), "utf8"))
const rvBad = structuredClone(rv); rvBad.records["data/07367c34/reusable-abilities.json#abilities.NOT_A_RECORD"] = { status: "reviewed" }
r = run("--review", put("rvbad.json", rvBad), "--unit", "WALREIN")
check("review-status entry naming a non-saved record refused", r.code === 3 && /not a saved record/.test(r.err), r.err)
const rvOwner = structuredClone(rv); const k = "data/07367c34/reusable-abilities.json#abilities.ICE_BALL"; rvOwner.records[k] = { ...rvOwner.records[k], aiReview: { ...rvOwner.records[k].aiReview, projectOwnerReviewed: true } }
r = run("--review", put("rvowner.json", rvOwner), "--unit", "WALREIN")
check("AI review claiming owner review while unreviewed refused (AI review stays distinct from owner review)", r.code === 3 && /claims project-owner review/.test(r.err), r.err)
const itemDir = join(tmp, "items"); cpSync(DATA, itemDir, { recursive: true })
const ie = JSON.parse(readFileSync(join(itemDir, "item-effects.json"), "utf8")); ie.sourceSha = "2".repeat(40); writeFileSync(join(itemDir, "item-effects.json"), JSON.stringify(ie))
r = run("--data-dir", itemDir, "--unit", "WALREIN", "--item", "Big Eater Belt")
check("item data from another revision refused (exit 3), no partial unit output", r.code === 3 && r.out === "" && /pinned production-branch reference/.test(r.err), `${r.code} ${r.err}`)

// ---- read-only, no network, no candidate reads, size and runtime ----
const code = readFileSync(FAST, "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")
check("source does not name candidates/, data/01a3e845, git, fetch or write calls", !/candidates\/|01a3e845|"git"|fetch\(|writeFile|appendFile|mkdir|unlink|rmSync/.test(code))
check("assistant/ tree is byte-identical after every lookup above", snapshot() === before)
const t = [run("--unit", "WALREIN", "--item", "Big Eater Belt"), run("--unit", "TYRANITAR"), run("--unit", "CHARIZARD", "--item", "Nullify Bandanna")]
console.log(`INFO  local runtime ms: ${t.map((x) => x.ms).join(", ")}; output bytes: ${t.map((x) => x.out.length).join(", ")} (local command only; not a model response time)`)
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed")
process.exit(failures ? 1 : 0)
