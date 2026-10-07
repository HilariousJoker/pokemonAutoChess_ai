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
check("CROCONAW: CRUNCH record NOT applied (covers only TOTODILE)", r.code === 0 && has(r, "No reviewed ability information", "covers only TOTODILE", "not** applied") && lacks(r, "Reviewed: CRUNCH") , r.out.slice(0, 200))
r = run("VESPIQUEN")
check("VESPIQUEN: placeholder + conditional modes + acquisition uncertainty", r.code === 0 && has(r, "is a placeholder", "ATTACK_ORDER", "HEAL_ORDER", "DEFEND_ORDER", "moved to row 1", "Acquisition caveat", "Which skill a Vespiquen has when it was never moved"), r.err)
r = run("PIKACHU")
check("PIKACHU: evolution record, callback, probe, context-note link", r.code === 0 && has(r, "Covered** (pilot)", "divergentEvolution", "pokemon.ts:3226", "evolution-context.md#pikachu--raichu-or-alolan-raichu", "Executed stub probe", "No reviewed ability information"), r.err)
r = run("COSMOEM")
check("COSMOEM: stacksRequired 8, both context links, unresolved quoted", r.code === 0 && has(r, "`stacksRequired` = 8", "evolution-context.md#cosmoem--solgaleo-or-lunala", "evolution-context.md#cosmog--cosmoem-hp-and-stacks", "Unresolved", "pokemon.ts:14870"), r.err)
r = run("ABRA")
check("ABRA (catalog only): baseline shown, evolution + ability coverage explicitly missing", r.code === 0 && has(r, "Bare baseline", "**Not covered:**", "missing coverage", "No reviewed ability information", "No production-reference note is linked") && lacks(r, "Terminal in the declarations"), r.err)
for (const k of ["toString", "__proto__", "constructor", "hasOwnProperty", "charizard", "NOTAPOKEMON", ""]) {
  r = run(k)
  check(`rejects ${JSON.stringify(k)}`, r.code === (k === "" ? 1 : 1) && r.out === "" && /unknown identifier/.test(r.err), `${r.code} ${r.err}`)
}
r = run("DEFAULT")
check("DEFAULT (excluded placeholder): clear error, no record", r.code === 1 && r.out === "" && /excluded/.test(r.err) && /MissingNo/.test(r.err), r.err)
r = run("--list")
check("--list: counts, coverage lists, no dev data", r.code === 0 && common(r) && has(r, "1184", "Reviewed ability CRUNCH applies to: TOTODILE", "Evolution records (pilot subset, 20)") && lacks(r, "01a3e845"), r.err)
check("usage errors", run().code === 2 && run("--bogus").code === 2 && run("A", "B").code === 2 && run("--list", "CHARIZARD").code === 2)
for (const k of ["CHARIZARD", "VESPIQUEN", "COSMOEM", "ABRA", "TOTODILE"]) {
  const o = run(k).out
  check(`no development reference in ${k} output`, !/01a3e845|knowledge\/pilot-|data\/01a3e845/.test(o))
}

// fixtures (temp dir only): mismatched revision / provenance / identity must be refused with exit 3
const dir = mkdtempSync(join(tmpdir(), "lookup-prod-"))
const rd = (f) => JSON.parse(readFileSync(resolve(HERE, "data/07367c34", f), "utf8"))
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
r = run("CHARIZARD", "--catalog", join(dir, "missing.json"))
check("missing file -> exit 2", r.code === 2)

check("no writes: assistant/ tree byte-identical before and after all lookups", snapshot() === before)
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed")
process.exit(failures ? 1 : 0)
