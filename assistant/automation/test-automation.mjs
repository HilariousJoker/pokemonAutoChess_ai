// Checks and demonstration for the automation workflow. Writes ONLY under the OS temp dir (never under assistant/).
// Usage: node assistant/automation/test-automation.mjs [--verbose]   (--verbose prints the demonstration transcript)
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const ASSISTANT = resolve(HERE, "..")
const verbose = process.argv.includes("--verbose")
const node = (script, ...a) => { const r = spawnSync(process.execPath, [resolve(HERE, script), ...a], { encoding: "utf8" }); return { code: r.status, out: r.stdout, err: r.stderr } }
let failures = 0
const check = (name, ok, detail = "") => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${String(detail).slice(0, 300)}`}`) }
const tree = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tree(join(d, e.name)) : [join(d, e.name)]))
const snapshot = () => tree(ASSISTANT).sort().map((f) => `${f}:${createHash("sha256").update(readFileSync(f)).digest("hex")}`).join("\n")
const before = snapshot()
const tmp = mkdtempSync(join(tmpdir(), "automation-"))
const rj = (f) => JSON.parse(readFileSync(f, "utf8"))
const wj = (f, o) => writeFileSync(f, JSON.stringify(o))
const transcript = []
const step = (title) => transcript.push(`\n### ${title}`)

// ---------- fixtures: copy data + review status, then edit the COPY ----------
const fx = join(tmp, "data"); mkdirSync(fx)
for (const f of ["catalog-units.json", "pilot-abilities.json", "reusable-abilities.json"]) cpSync(resolve(ASSISTANT, "data/07367c34", f), join(fx, f))
cpSync(resolve(ASSISTANT, "automation/review-status.json"), join(fx, "review-status.json"))
const candDir = join(tmp, "candidates"); mkdirSync(candDir)

// =========== 1. inventory ===========
let r = node("inventory.mjs", "--check")
check("saved inventory.json equals a fresh derivation", r.code === 0, r.err)
const inv = rj(resolve(ASSISTANT, "automation/inventory.json"))
const cat = rj(resolve(ASSISTANT, "data/07367c34/catalog-units.json"))
const skills = new Set(Object.values(cat.pokemon).map((p) => p.stats.skill)), passives = new Set(Object.values(cat.pokemon).map((p) => p.stats.passive))
check("every catalog skill and every non-NONE passive appears exactly once", Object.keys(inv.abilities).length === skills.size && Object.keys(inv.passives).length === passives.size - 1 && !inv.passives.NONE && [...skills].every((s) => inv.abilities[s]), `${Object.keys(inv.abilities).length}/${skills.size}`)
check("units per identifier match the catalog", Object.entries(inv.abilities).every(([id, e]) => JSON.stringify(e.units) === JSON.stringify(Object.keys(cat.pokemon).filter((k) => cat.pokemon[k].stats.skill === id).sort())))
const cv = (k, id) => inv[k][id].coverage
check("existing coverage is preserved: pilot + reusable records recognised, partial/gap/notes-only distinguished",
  cv("abilities", "BLAST_BURN").status === "structured_full" && cv("abilities", "NUZZLE").status === "structured_full" && cv("abilities", "THRASH").units === undefined &&
  cv("abilities", "CRUNCH").status === "structured_partial" && JSON.stringify(cv("abilities", "CRUNCH").uncoveredUnits) === JSON.stringify(["CROCONAW", "FERALIGATR", "GUZZLORD"]) &&
  cv("passives", "PRIMEAPE").status === "structured_full" && cv("passives", "SURGE_SURFER").status === "structured_full" && cv("passives", "PACHIRISU").status === "explicit_gap" &&
  cv("passives", "MANAPHY").status === "notes_only" && cv("passives", "VESPIQUEN").status === "notes_only")
check("review status is separate from coverage (pilot reviewed, new batch unreviewed)", cv("abilities", "CRUNCH").records[0].review === "reviewed" && cv("abilities", "NUZZLE").records[0].review === "unreviewed")
check("shared implementations grouped (Hidden Power family; shared passive effect)", inv.abilityFamilies.shared["class:HiddenPowerStrategy"]?.length === 28 && inv.sharedImplementationGroups["passive|effects:[PoipoleOnKillEffect]"]?.identifiers.join() === "NAGANADEL,POIPOLE")
const codes = new Set([...Object.values(inv.abilities), ...Object.values(inv.passives)].flatMap((e) => e.routingUncertainties.map((u) => u.code)))
check("routing uncertainties recorded explicitly", ["RUNTIME_ABILITY_DISPATCH", "EXTENDS_OTHER_STRATEGY", "NO_PASSIVE_EFFECTS_ENTRY", "NAME_SHARED_WITH_EFFECT", "CONSTANT_STRATEGY", "PLACEHOLDER_STRATEGY"].every((c) => codes.has(c)) && inv.routing.global.some((g) => g.code === "TM_AND_SKILL_SWAP") && inv.passives.SURGE_SURFER.routingUncertainties.some((u) => u.code === "NAME_SHARED_WITH_EFFECT"), [...codes].join())
// fixture inventory: THRASH and the SURGE_SURFER passive removed from the covered set
let ru = rj(join(fx, "reusable-abilities.json")); delete ru.abilities.THRASH; delete ru.passives.SURGE_SURFER; wj(join(fx, "reusable-abilities.json"), ru)
const fxInv = join(tmp, "inv-fixture.json")
step("inventory from a fixture data directory (THRASH ability record and SURGE_SURFER passive record removed)")
r = node("inventory.mjs", "--data-dir", fx, "--out", fxInv); transcript.push("$ inventory.mjs --data-dir <fixture> --out <tmp>\n" + r.out.trim())
const fi = rj(fxInv)
check("fixture inventory: removed records show as uncovered, others unchanged", r.code === 0 && fi.abilities.THRASH.coverage.status === "none" && fi.passives.SURGE_SURFER.coverage.status === "none" && fi.abilities.NUZZLE.coverage.status === "structured_full", r.err)
const fxInv2 = join(tmp, "inv-fixture2.json"); node("inventory.mjs", "--data-dir", fx, "--out", fxInv2)
check("inventory output is deterministic", readFileSync(fxInv, "utf8") === readFileSync(fxInv2, "utf8"))

// =========== 2. queue: committed state, sync, selection ===========
const qc = rj(resolve(ASSISTANT, "automation/queue.json"))
check("committed queue: pinned revision, nothing started, no lock, no reviewed state, covered identifiers absent",
  qc.revision === inv.sourceSha && qc.lock === null && qc.items.every((i) => i.progress.work === "queued" && i.progress.review.status === "none" && i.progress.validation.status === "not_run") && !qc.items.some((i) => i.id === "ability/NUZZLE") && qc.items.some((i) => i.id === "passive/PACHIRISU") && qc.items.some((i) => i.id === "ability/CRUNCH" && i.units.join() === "CROCONAW,FERALIGATR,GUZZLORD"))
const Q = join(tmp, "queue.json")
step("queue: sync, lock, select, start (all on a temporary copy)")
const Qa = (c, ...a) => { const r = node("queue.mjs", c, "--queue", Q, "--inventory", join(ASSISTANT, "automation/inventory.json"), "--candidates-dir", candDir, ...a); transcript.push(`$ queue.mjs ${c} ${a.join(" ")}\n${(r.out + r.err).trim().split("\n").slice(0, 7).join("\n")}`); return r }
r = Qa("sync")
check("sync builds the queue from the inventory", r.code === 0 && /added/.test(r.out) && rj(Q).items.length === qc.items.length)
check("sync is idempotent and matches the committed queue's record set", (() => { const r2 = Qa("sync"); return r2.code === 0 && /0 added/.test(r2.out) && JSON.stringify(rj(Q).items.map((i) => i.id)) === JSON.stringify(qc.items.map((i) => i.id)) })())
r = Qa("start", "ability/CRUNCH", "--run", "R1")
check("mutations without the lock are refused (exit 4)", r.code === 4, r.err)
r = Qa("lock", "--run", "R1", "--head", "abc")
check("run R1 takes the single-writer lock", r.code === 0 && rj(Q).lock.runId === "R1")
r = Qa("lock", "--run", "R2", "--now", new Date(Date.now() + 60_000).toISOString())
check("a second run cannot take a fresh lock (exit 4)", r.code === 4)
r = node("queue.mjs", "lock", "--queue", Q, "--inventory", join(ASSISTANT, "automation/inventory.json"), "--run", "R2", "--now", new Date(Date.now() + 4 * 3600_000).toISOString())
check("a stale lock (older than the TTL) can be taken over and the takeover is logged", r.code === 0 && rj(Q).lock.runId === "R2" && rj(Q).events.some((e) => e.event === "lock_takeover"), r.err)
Qa("unlock", "--run", "R2"); Qa("lock", "--run", "R3")
r = Qa("next", "--run", "R3", "--json")
const nx = JSON.parse(r.out)
check("next returns at most five ready records, highest unit count first", nx.length === 5 && nx.every((x, i) => i === 0 || nx[i - 1].priority >= x.priority), r.out.slice(0, 120))
for (const x of nx) Qa("start", x.id, "--run", "R3")
r = Qa("start", "ability/CRUNCH", "--run", "R3")
check("the sixth record in one run is refused (record budget)", r.code === 1 && /limit per run/.test(r.err), r.err)
r = Qa("next", "--run", "R3", "--json")
check("budget exhausted: next returns nothing for the same run", JSON.parse(r.out).length === 0)
Qa("unlock", "--run", "R3"); Qa("lock", "--run", "R4")
r = Qa("next", "--run", "R4", "--json")
const resumed = JSON.parse(r.out)
check("RESUMPTION: a fresh run sees the unfinished in-progress records first, from the saved file alone", resumed.slice(0, 5).every((x, i) => x.why === "resume (in progress)" && x.id === nx.map((n) => n.id).sort((a, b) => nx.find((n) => n.id === b).priority - nx.find((n) => n.id === a).priority || a.localeCompare(b))[i]), JSON.stringify(resumed.map((x) => x.id)))
Qa("unlock", "--run", "R4")

// =========== 3. candidate flow with an already-covered record (THRASH removed from the fixture inventory) ===========
step("candidate flow using the already-covered THRASH record as fixture material")
const Q2 = join(tmp, "queue2.json")
const Qb = (c, ...a) => { const r = node("queue.mjs", c, "--queue", Q2, "--inventory", fxInv, "--candidates-dir", candDir, "--catalog", join(fx, "catalog-units.json"), ...a); transcript.push(`$ queue.mjs ${c} ${a.join(" ")}\n${(r.out + r.err).trim().split("\n").slice(0, 6).join("\n")}`); return r }
Qb("sync"); Qb("lock", "--run", "R10")
check("fixture queue contains the records whose coverage was removed", rj(Q2).items.some((i) => i.id === "ability/THRASH" && i.units.join() === "ANNIHILAPE,MANKEY,PRIMEAPE") && rj(Q2).items.some((i) => i.id === "passive/SURGE_SURFER"))
const realReusable = rj(resolve(ASSISTANT, "data/07367c34/reusable-abilities.json"))
const wrapper = (kind, ident, rec, over = {}) => ({ schema: 1, label: "production-branch reference; deployment unverified", sourceSha: inv.sourceSha, itemId: `${kind}/${ident}`, kind, identifier: ident, reviewStatus: "candidate", generatedBy: { runId: "R10" }, record: rec, ...over })
const cf = join(candDir, "ability-THRASH.json")
wj(cf, wrapper("ability", "THRASH", realReusable.abilities.THRASH))
check("candidate paths outside the candidates directory are refused", (Qb("start", "ability/THRASH", "--run", "R10"), Qb("candidate", "ability/THRASH", "--file", join(tmp, "elsewhere.json"), "--run", "R10").code === 1))
Qb("candidate", "ability/THRASH", "--file", cf, "--run", "R10")
r = Qb("validate", "ability/THRASH", "--run", "R10")
let it = rj(Q2).items.find((i) => i.id === "ability/THRASH")
check("a correct candidate passes the shared checks: work candidate_ready, validation passed, review only 'pending' (never reviewed)", r.code === 0 && it.progress.work === "candidate_ready" && it.progress.validation.status === "passed" && it.progress.review.status === "pending", r.err + r.out)
check("the passed candidate leaves data/ and knowledge/ untouched (candidate stays in the candidates directory)", it.progress.candidate.path.endsWith("ability-THRASH.json"))
// failing candidates: mutate a copy of a SURGE_SURFER passive candidate
const bad = (mut) => { const rec = JSON.parse(JSON.stringify(realReusable.passives.SURGE_SURFER)); mut(rec); return wrapper("passive", "SURGE_SURFER", rec) }
Qb("start", "passive/SURGE_SURFER", "--run", "R10")
const pf = join(candDir, "passive-SURGE_SURFER.json")
const attempt = (doc) => { wj(pf, doc); Qb("candidate", "passive/SURGE_SURFER", "--file", pf, "--run", "R10"); return Qb("validate", "passive/SURGE_SURFER", "--run", "R10") }
r = attempt(bad((x) => { x.evidence[0].expect = "text that is not in the source" }))
check("validation failure 1 (bad evidence text) is reported and the record stays in progress", r.code === 1 && /not found in/.test(r.out) && rj(Q2).items.find((i) => i.id === "passive/SURGE_SURFER").progress.work === "in_progress", r.out)
r = attempt(bad((x) => { x.appliesTo[0].stars = 2 }))
check("validation failure 2 (unit binding disagrees with the catalog)", r.code === 1 && /disagree with the catalog/.test(r.out), r.out)
r = attempt(bad((x) => { delete x.resetBehaviour }))
it = rj(Q2).items.find((i) => i.id === "passive/SURGE_SURFER")
check("after two unsuccessful repairs (third failure) the record is BLOCKED with a recorded blocker", r.code === 1 && it.progress.work === "blocked" && it.blockers.length === 1 && /unsuccessful attempts/.test(it.blockers[0]), JSON.stringify(it.progress))
r = Qb("next", "--run", "R10", "--json")
check("blocked records are skipped and independent work continues", JSON.parse(r.out).every((x) => x.id !== "passive/SURGE_SURFER") && JSON.parse(r.out).length > 0)
Qb("unlock", "--run", "R10")
Qb("lock", "--run", "R11")
r = node("queue.mjs", "sync", "--queue", Q2, "--inventory", fxInv)
check("sync is refused while another run holds the lock (exit 4)", r.code === 4, r.err)
Qb("sync", "--run", "R11")
check("sync keeps progress of blocked and candidate_ready records", ["passive/SURGE_SURFER|blocked", "ability/THRASH|candidate_ready"].every((s) => { const [id, w] = s.split("|"); return rj(Q2).items.find((i) => i.id === id).progress.work === w }))
const wrong = (name, doc, re) => { Qb("start", "passive/PACHIRISU", "--run", "R11"); wj(pf, doc); Qb("candidate", "passive/PACHIRISU", "--file", pf, "--run", "R11"); return Qb("validate", "passive/PACHIRISU", "--run", "R11") }
r = wrong("claims reviewed", wrapper("passive", "PACHIRISU", realReusable.passiveGaps.PACHIRISU, { reviewStatus: "reviewed", itemId: "passive/PACHIRISU" }))
check("a candidate that claims reviewStatus 'reviewed' is rejected", r.code === 1 && /reviewStatus must be "candidate"/.test(r.out), r.out)
const qtxt = readFileSync(Q2, "utf8")
check("the tool never sets review to 'reviewed' during the whole flow", !/"status":"reviewed"/.test(qtxt))
r = Qb("unblock", "passive/SURGE_SURFER")
check("unblock (human action) resets a blocked record", r.code === 0 && rj(Q2).items.find((i) => i.id === "passive/SURGE_SURFER").progress.failedAttempts === 0)
r = Qb("report", "--run", "R10")
check("batch report is concise and names validation and review states", r.code === 0 && r.out.split("\n").length <= 12 && /none is reviewed or promoted/.test(r.out), r.out)

// dependencies
step("dependency ordering (fixture)")
const Q3 = join(tmp, "queue3.json")
{
  const q = rj(Q2); q.lock = null
  const a = q.items.find((i) => i.id === "ability/CRUNCH"), b = q.items.find((i) => i.id === "ability/DRAGON_RAGE") ?? q.items.find((i) => i.kind === "ability" && i.id !== a.id && i.progress.work === "queued")
  b.dependencies = [a.id]; a.priority = 1; b.priority = 999
  wj(Q3, q)
  const r3 = node("queue.mjs", "next", "--queue", Q3, "--json", "--limit", "5")
  const ids = JSON.parse(r3.out).map((x) => x.id)
  check("a record whose dependency is not ready is not offered, even with higher priority", !ids.includes(b.id), ids.join())
}

// =========== 4. common record checks (generic, no per-ability code) ===========
step("common checks against mutated copies of covered records")
const { checkRecord, makeContext } = await import("./record-checks.mjs")
const ctx = makeContext()
const clone = (o) => JSON.parse(JSON.stringify(o))
const base = clone(realReusable.abilities.NUZZLE)
const ok = checkRecord("ability", "NUZZLE", base, ctx, { profile: "candidate" })
check("shared checker: the NUZZLE record passes in the strict candidate profile", ok.problems.length === 0 && ok.stats.tables === 2 && ok.stats.evidence > 20, ok.problems.join("; "))
const mut = (f) => { const x = clone(base); f(x); return checkRecord("ability", "NUZZLE", x, ctx, { profile: "candidate" }).problems.join(" | ") }
check("shared checker: wrong revision", /sourceSha/.test(mut((x) => { x.sourceSha = "0".repeat(40) })))
check("shared checker: wrong unit binding (stars)", /disagree with the catalog/.test(mut((x) => { x.appliesTo[0].stars = 3 })))
check("shared checker: unit that does not declare the ability", /declares skill/.test(mut((x) => { x.appliesTo[0] = { ...x.appliesTo[0], key: "CHARMANDER", stars: 1 } })))
check("shared checker: evidence text missing from the cited lines", /not found in/.test(mut((x) => { x.evidence[2].expect = "nonsense" })))
check("shared checker: evidence line range out of bounds", /bad line range/.test(mut((x) => { x.evidence[2].lines = [99999, 100000] })))
check("shared checker: unreferenced evidence rejected for candidates", /never referenced/.test(mut((x) => { x.evidence.push({ ...x.evidence[0], id: "orphan" }) })))
check("shared checker: numeric table disagrees with the source", /table damage/.test(mut((x) => { x.effects[0].declaredRaw.byStars["3"] = 101 })))
check("shared checker: per-unit value disagrees with the table at the unit's stars", /per-unit value/.test(mut((x) => { x.effects[0].perUnitRaw.RAICHU = 50 })))
check("shared checker: numeric example recomputed", /recomputed/.test(mut((x) => { x.numericExamples[0].expected = 66 })))
check("shared checker: required field missing", /required field summary/.test(mut((x) => { delete x.summary })))
check("shared checker lists what it cannot check", ok.unchecked.some((u) => /free-text claims/.test(u)) && ok.unchecked.some((u) => /completeness/.test(u)))

// =========== 5. branch guard (local bare remote + two clones) ===========
step("branch guard with temporary git repositories")
const sh = (cwd, ...a) => spawnSync("git", a, { cwd, encoding: "utf8" })
const bare = join(tmp, "remote.git"), A = join(tmp, "A"), B = join(tmp, "B")
sh(tmp, "init", "-q", "--bare", "-b", "main", bare)
sh(tmp, "clone", "-q", bare, A)
for (const d of [A]) { sh(d, "config", "user.email", "t@t"); sh(d, "config", "user.name", "t") }
mkdirSync(join(A, "assistant")); writeFileSync(join(A, "assistant/x.txt"), "1"); writeFileSync(join(A, "readme.md"), "r")
sh(A, "add", "."); sh(A, "commit", "-qm", "init"); sh(A, "push", "-q", "origin", "HEAD:main")
sh(A, "checkout", "-qb", "work"); sh(A, "push", "-q", "origin", "work")
sh(tmp, "clone", "-q", "-b", "work", bare, B); sh(B, "config", "user.email", "t@t"); sh(B, "config", "user.name", "t")
const start = sh(A, "rev-parse", "HEAD").stdout.trim()
const G = (repo, c, ...a) => { const r = node("branch-guard.mjs", c, "--repo", repo, ...a); transcript.push(`$ branch-guard.mjs ${c} ${a.join(" ")}\n${(r.out + r.err).trim()}`); return r }
check("guard: head and verify succeed on an unchanged branch", G(A, "head", "--branch", "work").out.trim() === start && G(A, "verify", "--branch", "work", "--expect", start).code === 0)
check("guard: default branch refused (exit 6)", G(A, "verify", "--branch", "main", "--expect", start).code === 6)
writeFileSync(join(A, "readme.md"), "changed")
check("guard: a change outside assistant/ is detected (exit 5)", G(A, "scope", "--expect", start).code === 5)
sh(A, "checkout", "--", "readme.md"); writeFileSync(join(A, "assistant/y.txt"), "2"); sh(A, "add", "."); sh(A, "commit", "-qm", "work")
check("guard: assistant-only changes pass the scope check", G(A, "scope", "--expect", start).code === 0)
writeFileSync(join(B, "assistant/other.txt"), "x"); sh(B, "add", "."); sh(B, "commit", "-qm", "other writer"); sh(B, "push", "-q", "origin", "work")
const moved = sh(bare, "rev-parse", "work").stdout.trim()
r = G(A, "push", "--branch", "work", "--expect", start)
check("guard: when another writer moved the branch, verify/push stop (exit 3) and the remote is untouched", r.code === 3 && /changed unexpectedly/.test(r.err) && sh(bare, "rev-parse", "work").stdout.trim() === moved, r.err)
const startB = sh(B, "rev-parse", "HEAD").stdout.trim()
sh(B, "fetch", "-q"); writeFileSync(join(B, "assistant/z.txt"), "z"); sh(B, "add", "."); sh(B, "commit", "-qm", "z")
r = G(B, "push", "--branch", "work", "--expect", startB)
check("guard: an unchanged branch is pushed with a plain push", r.code === 0 && sh(bare, "rev-parse", "work").stdout.trim() === sh(B, "rev-parse", "HEAD").stdout.trim(), r.err)
check("guard source contains no force-push option", !/--force|-f\b|force-with-lease/.test(readFileSync(resolve(HERE, "branch-guard.mjs"), "utf8").replace(/never force-pushes|no force|force-push|merge or force/gi, "")))

// ---- scope detection: porcelain parsing, renames (both sides), committed changes, spaces in names ----
step("scope detection in a temporary repository")
{
  const S = join(tmp, "scope"); mkdirSync(S); sh(S, "init", "-q", "-b", "work"); sh(S, "config", "user.email", "t@t"); sh(S, "config", "user.name", "t")
  mkdirSync(join(S, "assistant")); writeFileSync(join(S, "assistant/x.txt"), "1"); writeFileSync(join(S, "readme.md"), "r"); writeFileSync(join(S, "assistant/in side.txt"), "s"); writeFileSync(join(S, "my file.txt"), "m")
  sh(S, "add", "."); sh(S, "commit", "-qm", "base")
  const base = sh(S, "rev-parse", "HEAD").stdout.trim()
  const reset = () => { sh(S, "reset", "-q", "--hard", base); sh(S, "clean", "-qfd") }
  const SC = (...a) => node("branch-guard.mjs", "scope", "--repo", S, "--expect", base, ...a)
  check("scope: clean tree passes", SC().code === 0)
  writeFileSync(join(S, "assistant/x.txt"), "changed")
  r = SC(); check("scope: an uncommitted modification of assistant/x.txt is allowed (no mangled 'ssistant/' path)", r.code === 0 && !/ssistant/.test(r.err.replace(/assistant/g, "")), r.err)
  reset(); writeFileSync(join(S, "assistant/new file with spaces.txt"), "n")
  check("scope: an untracked file with spaces inside assistant/ is allowed", SC().code === 0)
  reset(); writeFileSync(join(S, "my file.txt"), "edited")
  r = SC(); check("scope: an outside edit of a file whose name contains a space is rejected and printed exactly", r.code === 5 && r.err.includes('"my file.txt"'), r.err)
  reset(); sh(S, "mv", "readme.md", "assistant/readme.md")
  r = SC(); check("scope: a STAGED rename readme.md -> assistant/readme.md is rejected (old side is outside)", r.code === 5 && r.err.includes('"readme.md"'), r.err)
  sh(S, "commit", "-qm", "rename")
  r = SC(); check("scope: the same rename COMMITTED is still rejected", r.code === 5 && r.err.includes('"readme.md"'), r.err)
  reset(); sh(S, "mv", "assistant/x.txt", "x-moved.txt")
  r = SC(); check("scope: a rename from assistant/ to outside is rejected (new side is outside)", r.code === 5 && r.err.includes('"x-moved.txt"'), r.err)
  reset(); sh(S, "mv", "assistant/in side.txt", "assistant/in side 2.txt"); sh(S, "commit", "-qam", "inner rename")
  check("scope: a committed rename inside assistant/ (with spaces) is allowed", SC().code === 0)
  reset(); writeFileSync(join(S, "assistant/ok.txt"), "o"); sh(S, "add", "."); sh(S, "commit", "-qm", "ok"); writeFileSync(join(S, "readme.md"), "again"); sh(S, "commit", "-qam", "outside later")
  check("scope: an outside change in a later commit of the range is rejected", SC().code === 5)
  reset(); writeFileSync(join(S, "tmp-outside.txt"), "t"); sh(S, "add", "."); sh(S, "commit", "-qm", "add outside"); sh(S, "rm", "-q", "tmp-outside.txt"); sh(S, "commit", "-qm", "remove it again")
  check("scope: a file added and removed outside assistant/ within the range is still detected", SC().code === 5)
  reset(); sh(S, "checkout", "-qb", "side"); writeFileSync(join(S, "assistant/s.txt"), "s"); sh(S, "add", "."); sh(S, "commit", "-qm", "s"); sh(S, "checkout", "-q", "work"); writeFileSync(join(S, "assistant/w.txt"), "w"); sh(S, "add", "."); sh(S, "commit", "-qm", "w"); sh(S, "merge", "-q", "--no-ff", "-m", "merge", "side")
  check("scope: merge commits in the range are rejected", SC().code === 5)
}
// ---- ensure-source: missing pinned commit is reported (no network in --check) ----
step("ensure-source --check in a repository without the pinned commit")
{
  const E = join(tmp, "nosrc"); mkdirSync(join(E, "assistant/automation"), { recursive: true }); sh(E, "init", "-q"); sh(E, "config", "user.email", "t@t"); sh(E, "config", "user.name", "t")
  for (const f of ["ensure-source.mjs", "record-checks.mjs"]) cpSync(resolve(HERE, f), join(E, "assistant/automation", f))
  sh(E, "add", "."); sh(E, "commit", "-qm", "x")
  const rr = spawnSync(process.execPath, [join(E, "assistant/automation/ensure-source.mjs"), "--check"], { encoding: "utf8" })
  check("ensure-source --check exits 3 and names the exact commit when it is missing", rr.status === 3 && rr.stderr.includes("07367c341fe928763da2b565c2eee010433e4fc1") && /missing/.test(rr.stderr), rr.stderr)
  const src = readFileSync(resolve(HERE, "ensure-source.mjs"), "utf8")
  check("ensure-source fetches only the exact pinned commit from the official upstream (no branch names, no other revision)", /keldaanCommunity\/pokemonAutoChess\.git/.test(src) && /"fetch", "--no-tags", "--depth=1", "--no-write-fetch-head", UPSTREAM, SHA/.test(src) && !/\b(prod|master|main)\b[^\n]*fetch/.test(src.replace(/\/\/.*/g, "")))
}

// =========== 6. nothing outside the temp dir changed ===========
check("no writes: assistant/ tree byte-identical before and after all tests", snapshot() === before)
if (verbose) console.log("\n# Demonstration transcript (temporary fixtures; commands abbreviated)\n" + transcript.join("\n"))
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed")
process.exit(failures ? 1 : 0)
