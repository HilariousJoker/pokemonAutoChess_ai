// Work queue for resumable knowledge-building runs (production-branch reference 07367c34; deployment unverified).
// State lives in assistant/automation/queue.json (machine-readable, committed). Everything a fresh session needs is in that file,
// inventory.json, review-status.json and AUTOMATION.md; no chat context is required.
//
//   node assistant/automation/queue.mjs sync                       merge inventory.json into queue.json (keeps all progress)
//   node assistant/automation/queue.mjs status [--json]            counts by work / validation / review state
//   node assistant/automation/queue.mjs next [--run R] [--limit N] items to work on: resumable in-progress first, then ready queued (<= 5)
//   node assistant/automation/queue.mjs lock --run R [--head SHA]  take the single-writer lock (stale locks may be taken over)
//   node assistant/automation/queue.mjs unlock --run R
//   node assistant/automation/queue.mjs start <ID> --run R         queued -> in_progress (counts against the per-run record budget)
//   node assistant/automation/queue.mjs candidate <ID> --file <path-under-candidates-dir> --run R
//   node assistant/automation/queue.mjs validate <ID> --run R      run the shared record checks on the candidate; records the result
//   node assistant/automation/queue.mjs attempt-failed <ID> --reason "..." --run R   a failed attempt/repair that is not a validation failure
//   node assistant/automation/queue.mjs block <ID> --reason "..." --run R
//   node assistant/automation/queue.mjs unblock <ID>               HUMAN ONLY: reset a blocked record to queued
//   node assistant/automation/queue.mjs report --run R             concise batch report
//   node assistant/automation/queue.mjs check                      structural consistency of queue.json
// Common options (mainly for tests): --queue <f> --inventory <f> --candidates-dir <d> --catalog <f> --now <ISO time>
// Exit codes: 0 ok · 1 usage / unknown id / refused transition · 2 data unreadable or inconsistent · 4 lock held by another run.
//
// Three states are tracked separately per record: work (queued / in_progress / candidate_ready / blocked / superseded),
// validation (not_run / passed / failed — the shared mechanical checks) and review (none / pending / reviewed — human only).
// This tool never sets review to "reviewed" and never moves a candidate into data/ or knowledge/.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve, sep } from "node:path"
import { ASSISTANT, SHA, LABEL, checkRecord, makeContext } from "./record-checks.mjs"

const argv = process.argv.slice(2)
const cmd = argv[0]
const rest = argv.slice(1)
const flags = new Map()
const pos = []
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const k = rest[i]
    const v = rest[i + 1] !== undefined && !rest[i + 1].startsWith("--") ? rest[++i] : true
    flags.set(k, v)
  } else pos.push(rest[i])
}
const opt = (k, d) => (flags.has(k) ? flags.get(k) : d)
const paths = {
  queue: resolve(opt("--queue", resolve(ASSISTANT, "automation/queue.json"))),
  inventory: resolve(opt("--inventory", resolve(ASSISTANT, "automation/inventory.json"))),
  candidates: resolve(opt("--candidates-dir", resolve(ASSISTANT, "candidates/07367c34"))),
  catalog: opt("--catalog", undefined)
}
const now = () => (flags.has("--now") ? new Date(opt("--now")) : new Date())
const fail = (code, msg) => { process.stderr.write(String(msg).trimEnd() + "\n"); process.exit(code) }
const readJson = (f, what) => { try { return JSON.parse(readFileSync(f, "utf8")) } catch (e) { return fail(2, `cannot read ${what} ${f}: ${e.message}`) } }
// one record per line: small, reviewable diffs when a single record changes
const serialize = (o) => {
  if (!Array.isArray(o.items)) return JSON.stringify(o, null, 1) + "\n"
  const head = JSON.stringify({ ...o, items: "@@ITEMS@@" }, null, 1)
  return head.replace('"@@ITEMS@@"', o.items.length ? "[\n" + o.items.map((i) => " " + JSON.stringify(i)).join(",\n") + "\n ]" : "[]") + "\n"
}
const writeJson = (f, o) => { const tmp = f + ".tmp"; writeFileSync(tmp, serialize(o)); renameSync(tmp, f) }

const LIMITS = { maxItemsPerRun: 5, maxRepairAttempts: 2, lockTtlMinutes: 180 }
const WORK = ["queued", "in_progress", "candidate_ready", "blocked", "superseded"]
const VALIDATION = ["not_run", "passed", "failed"]
const REVIEW = ["none", "pending", "reviewed"]
const itemId = (kind, ident) => `${kind}/${ident}`

// ---- queue construction from the inventory --------------------------------------------------------------------
function freshProgress() {
  return { work: "queued", failedAttempts: 0, runs: [], candidate: null, validation: { status: "not_run", failureCount: 0, failures: [], uncheckedCount: 0 }, review: { status: "none" }, log: [] }
}
function derive(inv, kind, e) {
  const units = e.coverage.uncoveredUnits
  const deps = kind === "ability" ? (e.impl?.dependsOnAbilities ?? []).filter((a) => inv.abilities[a] && inv.abilities[a].coverage.status !== "structured_full").map((a) => itemId("ability", a)) : []
  return {
    id: itemId(kind, e.identifier), kind, identifier: e.identifier, revision: inv.sourceSha,
    units, extendsRecords: e.coverage.records.map((r) => r.ref),
    coverageAtSync: e.coverage.status, groupKey: e.groupKey, familyKey: e.familyKey ?? null,
    implementation: kind === "ability" ? (e.impl ? { file: e.impl.file ?? null, line: e.impl.line ?? null, class: e.impl.class ?? e.impl.constant ?? null } : null) : (e.impl.passiveEffectsEntry ? { file: e.impl.passiveEffectsEntry.file, line: e.impl.passiveEffectsEntry.line, class: null } : { file: null, line: null, class: null, referencedIn: e.impl.references.map((r) => r.file) }),
    priority: units.length + (e.coverage.status === "explicit_gap" ? 0 : 0),
    dependencies: deps, routingUncertainties: e.routingUncertainties.map((u) => u.code),
    notes: e.coverage.gap ? `explicit coverage gap: ${e.coverage.gap}` : e.coverage.notesOnly ? `explained in notes only: ${e.coverage.notesOnly}` : undefined,
    blockers: []
  }
}
function wanted(inv) {
  const out = []
  for (const kind of ["ability", "passive"]) for (const e of Object.values(kind === "ability" ? inv.abilities : inv.passives)) {
    if (e.coverage.status !== "structured_full") out.push(derive(inv, kind, e))
  }
  return out
}
function loadInventory() {
  const inv = readJson(paths.inventory, "inventory")
  if (inv.sourceSha !== SHA) fail(2, `inventory describes ${inv.sourceSha}, not the pinned ${SHA}`)
  if (!inv.abilities || !inv.passives) fail(2, "inventory lacks abilities / passives")
  return inv
}
function loadQueue() {
  const q = readJson(paths.queue, "queue")
  const problems = validateQueue(q)
  if (problems.length) fail(2, `queue.json is inconsistent:\n- ${problems.join("\n- ")}`)
  return q
}
function validateQueue(q) {
  const p = []
  if (q.schema !== 1) p.push("schema must be 1")
  if (q.revision !== SHA) p.push(`revision ${q.revision} is not the pinned ${SHA}`)
  if (!/deployment unverified/.test(q.label ?? "")) p.push("label lacks 'deployment unverified'")
  if (!Array.isArray(q.items)) return [...p, "items missing"]
  const ids = new Set()
  for (const it of q.items) {
    if (ids.has(it.id)) p.push(`duplicate id ${it.id}`)
    ids.add(it.id)
    if (it.id !== itemId(it.kind, it.identifier)) p.push(`${it.id}: id does not match kind/identifier`)
    if (it.revision !== SHA) p.push(`${it.id}: revision ${it.revision}`)
    const pr = it.progress
    if (!pr || !WORK.includes(pr.work)) p.push(`${it.id}: bad work state`)
    else {
      if (!VALIDATION.includes(pr.validation?.status)) p.push(`${it.id}: bad validation state`)
      if (!REVIEW.includes(pr.review?.status)) p.push(`${it.id}: bad review state`)
      if (pr.review.status === "reviewed" && !(pr.review.by && pr.review.at)) p.push(`${it.id}: reviewed without 'by' and 'at'`)
      if (pr.work === "candidate_ready" && pr.validation.status !== "passed") p.push(`${it.id}: candidate_ready requires validation passed`)
      if (pr.work === "candidate_ready" && !pr.candidate) p.push(`${it.id}: candidate_ready without a candidate file`)
      if (pr.work === "blocked" && !(it.blockers ?? []).length) p.push(`${it.id}: blocked without a blocker text`)
      if (pr.failedAttempts > 1 + LIMITS.maxRepairAttempts) p.push(`${it.id}: ${pr.failedAttempts} failed attempts exceed the limit without being blocked`)
      if (pr.failedAttempts >= 1 + LIMITS.maxRepairAttempts && pr.work !== "blocked") p.push(`${it.id}: ${pr.failedAttempts} failed attempts but not blocked`)
    }
  }
  for (const it of q.items) for (const d of it.dependencies ?? []) if (!ids.has(d)) p.push(`${it.id}: dependency ${d} is not in the queue`)
  if (q.lock && !(q.lock.runId && q.lock.acquiredAt)) p.push("lock needs runId and acquiredAt")
  return p
}

// ---- helpers ---------------------------------------------------------------------------------------------------
const byId = (q, id) => q.items.find((i) => i.id === id)
const touched = (q, run) => q.items.filter((i) => i.progress.runs.includes(run))
const depsReady = (q, it) => it.dependencies.every((d) => { const x = byId(q, d); return x && x.progress.work === "candidate_ready" })
const order = (a, b) => b.priority - a.priority || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)
const addLog = (q, it, run, event, note) => {
  const e = { run, event, ...(note ? { note } : {}) }
  it.progress.log = [...it.progress.log, e].slice(-12)
  q.events = [...(q.events ?? []), { run, id: it.id, event, ...(note ? { note } : {}) }].slice(-60)
}
function needItem(q, id) { const it = id && byId(q, id); if (!it) fail(1, `unknown queue id ${JSON.stringify(id)} (ids look like ability/NUZZLE or passive/PRIMEAPE)`); return it }
function needLock(q, run) {
  if (!run || run === true) fail(1, "--run <runId> is required")
  if (!q.lock || q.lock.runId !== run) fail(4, `the single-writer lock is ${q.lock ? `held by run ${q.lock.runId}` : "not held"}; take it with: queue.mjs lock --run ${run}`)
}
function save(q) {
  const p = validateQueue(q)
  if (p.length) fail(2, `refusing to write an inconsistent queue:\n- ${p.join("\n- ")}`)
  writeJson(paths.queue, q)
}
function countBudget(q, run, it) {
  if (it.progress.runs.includes(run)) return
  if (touched(q, run).length >= q.limits.maxItemsPerRun) fail(1, `run ${run} already handled ${q.limits.maxItemsPerRun} records (limit per run); stop and report`)
  it.progress.runs = [...it.progress.runs, run].slice(-20)
}
function failedAttempt(q, it, run, why) {
  it.progress.failedAttempts += 1
  if (it.progress.failedAttempts >= 1 + q.limits.maxRepairAttempts) {
    it.progress.work = "blocked"
    it.blockers = [...(it.blockers ?? []), `blocked after ${it.progress.failedAttempts} unsuccessful attempts (initial + ${q.limits.maxRepairAttempts} repairs): ${why}`].slice(-5)
    addLog(q, it, run, "blocked", why)
    return "blocked"
  }
  addLog(q, it, run, "attempt_failed", why)
  return "retry"
}

// ---- commands --------------------------------------------------------------------------------------------------------
function sync() {
  const inv = loadInventory()
  let q
  if (existsSync(paths.queue)) { q = readJson(paths.queue, "queue"); const pr = validateQueue(q); if (pr.length) fail(2, `queue.json is inconsistent:\n- ${pr.join("\n- ")}`) }
  else q = { schema: 1, revision: SHA, label: LABEL, branch: "claude/great-volta-v6znve", limits: { ...LIMITS }, lock: null, events: [], items: [] }
  if (q.lock && flags.has("--run") && q.lock.runId !== opt("--run")) fail(4, `lock held by run ${q.lock.runId}`)
  if (q.lock && !flags.has("--run")) fail(4, `lock held by run ${q.lock.runId}; pass --run ${q.lock.runId} (the holder) to sync`)
  const want = wanted(inv)
  const wantIds = new Set(want.map((w) => w.id))
  let added = 0, refreshed = 0, removed = 0, superseded = 0
  for (const w of want) {
    const cur = byId(q, w.id)
    if (!cur) { q.items.push({ ...w, progress: freshProgress() }); added++ }
    else {
      const keep = { progress: cur.progress, blockers: cur.blockers }
      Object.assign(cur, w, keep); refreshed++
    }
  }
  q.items = q.items.filter((it) => {
    if (wantIds.has(it.id)) return true
    // identifier is now structurally covered by an existing record
    if (it.progress.work === "queued") { removed++; return false }
    if (it.progress.work !== "superseded") { it.progress.work = "superseded"; it.blockers = [...(it.blockers ?? []), "inventory now reports full structured coverage; compare with the existing record before using this candidate"].slice(-5); superseded++ }
    return true
  })
  q.items.sort((a, b) => a.id.localeCompare(b.id))
  q.limits = { ...LIMITS, ...(q.limits ?? {}) }
  save(q)
  console.log(`sync: ${added} added, ${refreshed} refreshed, ${removed} removed (now covered, untouched), ${superseded} superseded; ${q.items.length} records in the queue`)
}

function summary(q) {
  const c = (f) => q.items.reduce((m, i) => { const k = f(i); m[k] = (m[k] ?? 0) + 1; return m }, {})
  return { total: q.items.length, work: c((i) => i.progress.work), validation: c((i) => i.progress.validation.status), review: c((i) => i.progress.review.status), kinds: c((i) => i.kind), lock: q.lock }
}

function selectNext(q, run, limit) {
  const used = run && run !== true ? touched(q, run).length : 0
  let budget = Math.min(limit, q.limits.maxItemsPerRun - used)
  const out = []
  const resume = q.items.filter((i) => i.progress.work === "in_progress").sort(order)
  for (const it of resume) { if (out.length < Math.max(0, budget)) out.push({ it, why: "resume (in progress)" }) }
  const ready = q.items.filter((i) => i.progress.work === "queued" && depsReady(q, i)).sort(order)
  for (const it of ready) { if (out.length < Math.max(0, budget)) out.push({ it, why: "queued" }) }
  return { out, budget: Math.max(0, budget), used }
}

try {
  switch (cmd) {
    case "sync": sync(); break
    case "status": {
      const q = loadQueue(), s = summary(q)
      if (flags.has("--json")) console.log(JSON.stringify(s, null, 1))
      else console.log(`records ${s.total} (${Object.entries(s.kinds).map(([k, v]) => `${k} ${v}`).join(", ")})\nwork: ${Object.entries(s.work).map(([k, v]) => `${k} ${v}`).join(", ")}\nvalidation: ${Object.entries(s.validation).map(([k, v]) => `${k} ${v}`).join(", ")}\nreview: ${Object.entries(s.review).map(([k, v]) => `${k} ${v}`).join(", ")}\nlock: ${s.lock ? `run ${s.lock.runId} since ${s.lock.acquiredAt}` : "none"}`)
      break
    }
    case "check": { const q = readJson(paths.queue, "queue"); const p = validateQueue(q); if (p.length) fail(2, `queue.json is inconsistent:\n- ${p.join("\n- ")}`); console.log(`queue ok: ${q.items.length} records`); break }
    case "next": {
      const q = loadQueue()
      const limit = Math.min(Number(opt("--limit", q.limits.maxItemsPerRun)) || q.limits.maxItemsPerRun, q.limits.maxItemsPerRun)
      const { out, budget, used } = selectNext(q, opt("--run", undefined), limit)
      if (flags.has("--json")) console.log(JSON.stringify(out.map(({ it, why }) => ({ id: it.id, why, units: it.units, priority: it.priority, dependencies: it.dependencies, routingUncertainties: it.routingUncertainties, implementation: it.implementation, extendsRecords: it.extendsRecords })), null, 1))
      else {
        console.log(`budget this run: ${budget} (already handled in this run: ${used}; max ${q.limits.maxItemsPerRun})`)
        for (const { it, why } of out) console.log(`${it.id}  [${why}]  priority ${it.priority}  units: ${it.units.join(", ")}${it.dependencies.length ? `  depends: ${it.dependencies.join(", ")}` : ""}${it.routingUncertainties.length ? `  uncertain: ${it.routingUncertainties.join(", ")}` : ""}`)
        if (!out.length) console.log("(nothing ready: queue empty, all blocked, or dependencies not ready)")
      }
      break
    }
    case "lock": {
      const q = loadQueue(), run = opt("--run")
      if (!run || run === true) fail(1, "--run <runId> is required")
      if (q.lock && q.lock.runId !== run) {
        const ageMin = (now() - new Date(q.lock.acquiredAt)) / 60000
        if (ageMin < q.limits.lockTtlMinutes) fail(4, `lock held by run ${q.lock.runId} for ${Math.round(ageMin)} min (< ${q.limits.lockTtlMinutes} min); another writer may be active — stop`)
        q.events = [...(q.events ?? []), { run, event: "lock_takeover", note: `stale lock of run ${q.lock.runId} (${Math.round(ageMin)} min) replaced` }].slice(-60)
      }
      q.lock = { runId: run, acquiredAt: now().toISOString(), ...(typeof opt("--head") === "string" ? { headAtStart: opt("--head") } : {}) }
      save(q); console.log(`lock held by run ${run}`); break
    }
    case "unlock": {
      const q = loadQueue(), run = opt("--run")
      if (!q.lock) { console.log("no lock held"); break }
      if (q.lock.runId !== run) fail(4, `lock is held by run ${q.lock.runId}, not ${run}`)
      q.lock = null; save(q); console.log("lock released"); break
    }
    case "start": {
      const q = loadQueue(), run = opt("--run"); needLock(q, run)
      const it = needItem(q, pos[0])
      if (it.progress.work === "blocked" || it.progress.work === "superseded") fail(1, `${it.id} is ${it.progress.work}; not startable`)
      if (it.progress.work === "candidate_ready") fail(1, `${it.id} already has a validated candidate`)
      if (!depsReady(q, it)) fail(1, `${it.id}: dependencies not ready (${it.dependencies.join(", ")})`)
      countBudget(q, run, it)
      it.progress.work = "in_progress"; addLog(q, it, run, "started"); save(q); console.log(`${it.id} in progress`); break
    }
    case "candidate": {
      const q = loadQueue(), run = opt("--run"); needLock(q, run)
      const it = needItem(q, pos[0])
      if (it.progress.work !== "in_progress") fail(1, `${it.id} is ${it.progress.work}; start it first`)
      const f = resolve(String(opt("--file", "")))
      if (relative(paths.candidates, f).startsWith("..") || !f.endsWith(".json")) fail(1, `candidate files must be .json files under ${paths.candidates} (generated candidates stay separate from data/ and knowledge/)`)
      if (!existsSync(f)) fail(1, `${f} does not exist`)
      try { JSON.parse(readFileSync(f, "utf8")) } catch (e) { fail(1, `candidate is not valid JSON: ${e.message}`) }
      it.progress.candidate = { path: relative(ASSISTANT, f).split(sep).join("/") }
      it.progress.validation = { status: "not_run", failureCount: it.progress.validation.failureCount, failures: [], uncheckedCount: 0 }
      addLog(q, it, run, "candidate_registered", it.progress.candidate.path); save(q); console.log(`candidate registered: ${it.progress.candidate.path}`); break
    }
    case "validate": {
      const q = loadQueue(), run = opt("--run"); needLock(q, run)
      const it = needItem(q, pos[0])
      if (it.progress.work !== "in_progress" || !it.progress.candidate) fail(1, `${it.id}: needs state in_progress with a registered candidate`)
      const file = resolve(ASSISTANT, it.progress.candidate.path)
      const res = validateCandidate(it, file)
      it.progress.validation = { status: res.problems.length ? "failed" : "passed", failureCount: it.progress.validation.failureCount + (res.problems.length ? 1 : 0), failures: res.problems.slice(0, 12), uncheckedCount: res.unchecked.length, stats: res.stats }
      if (res.problems.length) {
        const r = failedAttempt(q, it, run, `validation failed (${res.problems.length} problem(s)): ${res.problems[0]}`)
        save(q)
        console.log(`validation FAILED for ${it.id} (${res.problems.length} problem(s)); ${r === "blocked" ? "record is now BLOCKED" : `failed attempts ${it.progress.failedAttempts}; the record is blocked at ${1 + q.limits.maxRepairAttempts} (initial attempt + ${q.limits.maxRepairAttempts} repairs)`}`)
        res.problems.slice(0, 12).forEach((m) => console.log(`- ${m}`))
        process.exit(1)
      }
      it.progress.work = "candidate_ready"
      it.progress.review = { status: it.progress.review.status === "none" ? "pending" : it.progress.review.status }
      addLog(q, it, run, "validated", `${res.stats.evidence} evidence refs, ${res.stats.tables} tables, ${res.stats.examples} examples`)
      save(q)
      console.log(`validation passed for ${it.id}: ${res.stats.evidence} evidence refs, ${res.stats.units} unit bindings, ${res.stats.tables} source tables, ${res.stats.examples} examples; review: ${it.progress.review.status} (mechanical checks only; unchecked claims: ${res.unchecked.length} kinds)`)
      break
    }
    case "attempt-failed": {
      const q = loadQueue(), run = opt("--run"); needLock(q, run)
      const it = needItem(q, pos[0])
      if (it.progress.work !== "in_progress") fail(1, `${it.id} is ${it.progress.work}`)
      const r = failedAttempt(q, it, run, String(opt("--reason", "unspecified"))); save(q); console.log(`${it.id}: ${r === "blocked" ? "BLOCKED after repeated unsuccessful attempts" : `attempt recorded (${it.progress.failedAttempts})`}`); break
    }
    case "block": {
      const q = loadQueue(), run = opt("--run"); needLock(q, run)
      const it = needItem(q, pos[0])
      const why = opt("--reason", undefined)
      if (!why || why === true) fail(1, "--reason is required")
      if (it.progress.work === "candidate_ready") fail(1, `${it.id} has a validated candidate; blocking would hide it`)
      countBudget(q, run, it)
      it.progress.work = "blocked"; it.blockers = [...(it.blockers ?? []), String(why)].slice(-5); addLog(q, it, run, "blocked", String(why)); save(q); console.log(`${it.id} blocked`); break
    }
    case "unblock": {
      const q = loadQueue(); const it = needItem(q, pos[0])
      if (it.progress.work !== "blocked") fail(1, `${it.id} is not blocked`)
      it.progress.work = "queued"; it.progress.failedAttempts = 0; it.blockers = []; addLog(q, it, "human", "unblocked"); save(q); console.log(`${it.id} queued again`); break
    }
    case "report": {
      const q = loadQueue(), run = opt("--run")
      if (!run || run === true) fail(1, "--run <runId> is required")
      const mine = touched(q, run)
      const lines = [`Batch report for run ${run} (${LABEL}; ${SHA.slice(0, 8)})`, `records handled: ${mine.length} of max ${q.limits.maxItemsPerRun}`]
      for (const it of mine) lines.push(`- ${it.id}: work ${it.progress.work}; validation ${it.progress.validation.status}${it.progress.validation.status === "failed" ? ` (${it.progress.validation.failureCount} failures)` : ""}; review ${it.progress.review.status}${it.blockers.length ? `; blocker: ${it.blockers[it.blockers.length - 1]}` : ""}`)
      const s = summary(q)
      lines.push(`queue now: ${Object.entries(s.work).map(([k, v]) => `${k} ${v}`).join(", ")}`)
      lines.push("candidates are mechanically validated only and none is reviewed or promoted into data/ or knowledge/")
      console.log(lines.join("\n"))
      break
    }
    default: fail(1, "usage: queue.mjs sync|status|next|lock|unlock|start|candidate|validate|attempt-failed|block|unblock|report|check (see the header of this file)")
  }
} catch (e) { throw e }

// ---- candidate validation (shared checks + queue-specific wrapper checks) ---------------------------------------------------------
function validateCandidate(it, file) {
  const problems = []
  let doc
  try { doc = JSON.parse(readFileSync(file, "utf8")) } catch (e) { return { problems: [`candidate unreadable: ${e.message}`], unchecked: [], stats: {} } }
  if (doc.sourceSha !== SHA) problems.push(`candidate sourceSha is ${doc.sourceSha}`)
  if (!/deployment unverified/.test(doc.label ?? "")) problems.push("candidate label lacks 'deployment unverified'")
  if (doc.itemId !== it.id) problems.push(`candidate itemId ${doc.itemId} is not ${it.id}`)
  if (doc.kind !== it.kind || doc.identifier !== it.identifier) problems.push("candidate kind/identifier differ from the queue record")
  if (doc.reviewStatus !== "candidate") problems.push(`candidate reviewStatus must be "candidate" (was ${JSON.stringify(doc.reviewStatus)}); review is a human decision recorded elsewhere`)
  if (!doc.record || typeof doc.record !== "object") return { problems: [...problems, "candidate has no `record` object"], unchecked: [], stats: {} }
  const ctx = makeContext(paths.catalog ? { catalogPath: resolve(paths.catalog) } : {})
  const have = (doc.record.appliesTo ?? []).map((u) => u.key).sort()
  const want = [...it.units].sort()
  if (JSON.stringify(have) !== JSON.stringify(want)) problems.push(`record.appliesTo units [${have.join(", ")}] differ from the queued units [${want.join(", ")}]`)
  const res = checkRecord(it.kind, it.identifier, doc.record, ctx, { profile: "candidate" })
  return { problems: [...problems, ...res.problems], unchecked: res.unchecked, stats: res.stats }
}
