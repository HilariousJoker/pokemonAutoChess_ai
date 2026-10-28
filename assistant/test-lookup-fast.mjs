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
