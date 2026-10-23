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
r = run("--list")
check("--list: imported abilities listed as source-traced with the Codex AI review recorded and owner review pending", r.code === 0 && has(r, "Ability record BUG_BUZZ (source-traced, Codex AI review recorded, owner review pending) applies to: BEEDRILL, KAKUNA, VENOMOTH, VENONAT, WEEDLE", "Ability record FOUL_PLAY (source-traced, Codex AI review recorded, owner review pending) applies to: HONCHKROW, KROKOROK, KROOKODILE, MURKROW, SANDILE", "Ability record LEAF_BLADE (source-traced, Codex AI review recorded, owner review pending) applies to: GALARIAN_FARFETCH_D, GROVYLE, KARTANA, SCEPTILE, TREECKO", "Ability record SOAK (source-traced, Codex AI review recorded, owner review pending) applies to: POLITOED, POLIWAG, POLIWHIRL, TATSUGIRI_CURLY, TATSUGIRI_DROOPY, TATSUGIRI_STRETCHY", "Ability record TORMENT (source-traced, Codex AI review recorded, owner review pending) applies to: CHIMCHAR, INFERNAPE, LOMBRE, LOTAD, LUDICOLO, MONFERNO") && lacks(r, "BUG_BUZZ (reviewed)"), r.err)
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
r = run("ABRA")
check("ABRA (catalog only): baseline shown, evolution + ability coverage explicitly missing", r.code === 0 && has(r, "Bare baseline", "**Not covered:**", "missing coverage", "No ability record", "No production-reference note is linked") && lacks(r, "Terminal in the declarations"), r.err)
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
  const five = ["BUG_BUZZ", "FOUL_PLAY", "LEAF_BLADE", "SOAK", "TORMENT"]
  check("shipped review-status.json: the five imported records are unreviewed with Codex's AI review, projectOwnerReviewed=false, gameplayTested=false", five.every((n) => { const v = shipped.records[`data/07367c34/reusable-abilities.json#abilities.${n}`]; return v?.status === "unreviewed" && v.aiReview?.reviewer === "Codex" && v.aiReview.kind === "independent AI source review" && v.aiReview.projectOwnerReviewed === false && v.aiReview.gameplayTested === false && !("by" in v) }))
}
r = run("CHARIZARD", "--catalog", join(dir, "missing.json"))
check("missing file -> exit 2", r.code === 2)

check("no writes: assistant/ tree byte-identical before and after all lookups", snapshot() === before)
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed")
process.exit(failures ? 1 : 0)
