// Coverage inventory for the production-branch reference (07367c34; deployment unverified).
// Derives the unique ability and passive identifiers from the saved catalog, resolves how the pinned source routes each one to an
// implementation (registry entry, class/file, shared helpers), groups identifiers that share an implementation, compares with the
// existing structured coverage, and records routing uncertainties explicitly. Read-only against the repository: the pinned source is
// read with `git cat-file` / `git grep` (no checkout, no install, no network). Output is deterministic (no timestamps).
//
// Usage: node assistant/automation/inventory.mjs [--out <file>] [--check] [--data-dir <dir>] [--summary]
//   (default)  write assistant/automation/inventory.json
//   --check    regenerate in memory and compare with the saved file (exit 1 if different)
//   --summary  print counts only
//   --data-dir test option: read catalog/pilot/reusable/review-status JSON from another directory
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, renameSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { ASSISTANT, REPO, SHA, LABEL } from "./lib/records.mjs"

const argv = process.argv.slice(2)
const opt = (n) => { const i = argv.indexOf(n); return i === -1 ? undefined : argv[i + 1] }
const dataDir = resolve(opt("--data-dir") ?? resolve(ASSISTANT, "data/07367c34"))
const reviewPath = resolve(opt("--data-dir") ?? resolve(ASSISTANT, "automation"), "review-status.json")
const outPath = resolve(opt("--out") ?? resolve(ASSISTANT, "automation/inventory.json"))
const die = (m, c = 2) => { process.stderr.write(m + "\n"); process.exit(c) }
const rj = (f) => JSON.parse(readFileSync(f, "utf8"))

// ---- pinned-source reader ----------------------------------------------------------------------------------
const git = (args, input) => {
  try { return execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8", maxBuffer: 1 << 28, input, stdio: ["pipe", "pipe", "pipe"] }) } catch (e) { if (args[0] === "grep" && e.status === 1) return ""; throw e }
}
try { git(["cat-file", "-e", `${SHA}^{commit}`]) } catch { die(`pinned commit ${SHA} is not available in this repository (fetch it first)`, 3) }
const fileCache = new Map()
function readMany(paths) {
  const need = paths.filter((p) => !fileCache.has(p))
  if (need.length) {
    const out = execFileSync("git", ["-C", REPO, "cat-file", "--batch"], { input: need.map((p) => `${SHA}:${p}`).join("\n") + "\n", maxBuffer: 1 << 29 })
    let off = 0
    for (const p of need) {
      const nl = out.indexOf(10, off)
      const header = out.toString("utf8", off, nl)
      if (header.endsWith(" missing")) { fileCache.set(p, null); off = nl + 1; continue }
      const size = Number(header.split(" ")[2])
      fileCache.set(p, out.toString("utf8", nl + 1, nl + 1 + size).split("\n"))
      off = nl + 1 + size + 1
    }
  }
  return paths.map((p) => fileCache.get(p))
}
const read = (p) => readMany([p])[0]

// ---- inputs ---------------------------------------------------------------------------------------------------
const catalog = rj(resolve(dataDir, "catalog-units.json"))
if (catalog.provenance?.auditedSourceCommit !== SHA) die("catalog is not for the pinned revision", 3)
const pilot = rj(resolve(dataDir, "pilot-abilities.json"))
const reusable = rj(resolve(dataDir, "reusable-abilities.json"))
const review = rj(reviewPath)
for (const [n, d] of [["pilot", pilot], ["reusable", reusable]]) if (d.sourceSha !== SHA) die(`${n} records are not for the pinned revision`, 3)

const P = catalog.pokemon
const bySkill = new Map(), byPassive = new Map()
for (const k of Object.keys(P).sort()) {
  const s = P[k].stats
  if (!bySkill.has(s.skill)) bySkill.set(s.skill, [])
  bySkill.get(s.skill).push(k)
  if (!byPassive.has(s.passive)) byPassive.set(s.passive, [])
  byPassive.get(s.passive).push(k)
}

// ---- ability routing: registry -> class -> file -----------------------------------------------------------------
const ABIL_DIR = "app/core/abilities/"
const abilTs = read(ABIL_DIR + "abilities.ts")
const registry = new Map() // ability -> {expr, line}
abilTs.forEach((l, i) => { const m = l.match(/^\s*\[Ability\.([A-Z0-9_]+)\]:\s*(.+?),?\s*$/); if (m) registry.set(m[1], { expr: m[2], line: i + 1 }) })
const imports = new Map() // imported name -> file
{
  const text = abilTs.join("\n")
  for (const m of text.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+"(\.[^"]+)"/g)) {
    const file = resolve("/", ABIL_DIR, m[2]).slice(1) + ".ts"
    for (const nm of m[1].split(",").map((x) => x.trim().replace(/^type\s+/, "")).filter(Boolean)) imports.set(nm, file)
  }
}
const constDefs = new Map()
abilTs.forEach((l, i) => { const m = l.match(/^(?:export )?const ([A-Za-z0-9_]+)\s*=/); if (m) constDefs.set(m[1], i + 1) })

const classOf = (expr) => expr.match(/^new ([A-Za-z0-9_]+)\(/)?.[1] ?? null
const identOf = (expr) => (/^[A-Za-z0-9_]+$/.test(expr) ? expr : null)

// files of the strategy classes (one batched read)
const implFiles = [...new Set([...registry.values()].map((r) => imports.get(classOf(r.expr) ?? identOf(r.expr) ?? "")).filter(Boolean))].sort()
readMany(implFiles)
const classIndex = new Map() // class name -> {file, line, extends}
for (const f of [ABIL_DIR + "abilities.ts", ...implFiles]) {
  const L = f === ABIL_DIR + "abilities.ts" ? abilTs : fileCache.get(f)
  if (!L) continue
  L.forEach((l, i) => {
    const m = l.match(/^(?:export )?class ([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+))?/)
    if (m) classIndex.set(m[1], { file: f, line: i + 1, extends: m[2] ?? null })
  })
}
const usersOfClass = new Map()
for (const [a, r] of registry) { const c = classOf(r.expr) ?? identOf(r.expr); if (c) { if (!usersOfClass.has(c)) usersOfClass.set(c, []); usersOfClass.get(c).push(a) } }

// ---- passive routing --------------------------------------------------------------------------------------------
const PASS = "app/core/effects/passives.ts"
const passTs = read(PASS)
const passEntries = new Map() // passive -> {line, rhs|null}
passTs.forEach((l, i) => { const m = l.match(/^  \[Passive\.([A-Z0-9_]+)\]:\s*(.*)$/); if (m) passEntries.set(m[1], { line: i + 1, rhs: m[2].trim().replace(/,$/, "") || null }) })
// every textual reference to Passive.X outside the client, the enum itself and the unit class declarations
const grep = git(["grep", "-n", "-o", "-E", "Passive\\.[A-Z0-9_]+", SHA, "--", "app", ":!app/public", ":!app/types/enum/Passive.ts"])
const passiveRefs = new Map() // passive -> Map(file -> [lines])
const declarations = new Map() // passive -> count of unit class declarations
for (const row of grep.split("\n")) {
  const m = row.match(/^[0-9a-f]{40}:([^:]+):(\d+):Passive\.([A-Z0-9_]+)$/)
  if (!m) continue
  const [, file, line, id] = m
  if (file === "app/models/colyseus-models/pokemon.ts") { declarations.set(id, (declarations.get(id) ?? 0) + 1); continue }
  if (file === PASS && passEntries.get(id)?.line === Number(line)) continue
  if (!passiveRefs.has(id)) passiveRefs.set(id, new Map())
  const fm = passiveRefs.get(id)
  if (!fm.has(file)) fm.set(file, [])
  fm.get(file).push(Number(line))
}
const enumNames = (file) => new Set((read(file) ?? []).map((l) => l.match(/^\s+([A-Z0-9_]+)\s*=/)?.[1]).filter(Boolean))
const effectNames = enumNames("app/types/enum/Effect.ts"), abilityNames = enumNames("app/types/enum/Ability.ts"), itemNames = enumNames("app/types/enum/Item.ts")

// helper: does any code change skills or passives at run time? (global routing uncertainty)
const runtimeSkill = git(["grep", "-l", "-F", ".skill = ", SHA, "--", "app/core", "app/models"]).split("\n").filter(Boolean).map((l) => l.replace(`${SHA}:`, "")).sort()
const runtimePassive = git(["grep", "-l", "-F", "changePassive(", SHA, "--", "app/core", "app/models"]).split("\n").filter(Boolean).map((l) => l.replace(`${SHA}:`, "")).sort()

// ---- existing structured coverage -----------------------------------------------------------------------------------
const abilityCover = new Map(), passiveCover = new Map(), gaps = new Map()
const addCover = (m, id, ref, units) => { const e = m.get(id) ?? { records: [], units: new Set() }; e.records.push(ref); units.forEach((u) => e.units.add(u)); m.set(id, e) }
for (const [n, r] of Object.entries(pilot.abilities)) addCover(abilityCover, n, `data/07367c34/pilot-abilities.json#abilities.${n}`, r.appliesTo.map((u) => u.key))
for (const [n, r] of Object.entries(reusable.abilities)) addCover(abilityCover, n, `data/07367c34/reusable-abilities.json#abilities.${n}`, r.appliesTo.map((u) => u.key))
for (const [n, r] of Object.entries(reusable.passives)) addCover(passiveCover, n, `data/07367c34/reusable-abilities.json#passives.${n}`, r.appliesTo.map((u) => u.key))
for (const [n, r] of Object.entries(reusable.passiveGaps)) gaps.set(n, { ref: `data/07367c34/reusable-abilities.json#passiveGaps.${n}`, units: r.appliesTo.map((u) => u.key) })
const reviewOf = (ref) => review.records?.[ref]?.status ?? "unreviewed"

function coverage(id, units, cover, gapMap) {
  const e = cover.get(id)
  const covered = e ? units.filter((u) => e.units.has(u)) : []
  const uncovered = units.filter((u) => !covered.includes(u))
  const gap = gapMap?.get(id)
  const notes = review.notesOnly?.[id]
  let status = covered.length === units.length ? "structured_full" : covered.length ? "structured_partial" : gap ? "explicit_gap" : notes ? "notes_only" : "none"
  if (covered.length && covered.length < units.length && gap) status = "structured_partial"
  return {
    status, coveredUnits: covered, uncoveredUnits: uncovered,
    records: e ? e.records.map((ref) => ({ ref, review: reviewOf(ref) })) : [],
    ...(gap ? { gap: gap.ref } : {}), ...(notes ? { notesOnly: notes } : {})
  }
}

// ---- build ability entries -------------------------------------------------------------------------------------------
const abilities = {}
for (const id of [...bySkill.keys()].sort()) {
  const units = bySkill.get(id)
  const reg = registry.get(id)
  const unc = []
  const entry = { identifier: id, units, impl: null }
  if (!reg) unc.push({ code: "NOT_IN_REGISTRY", note: "no [Ability.X] entry found in abilities.ts; routing unknown" })
  else {
    const cls = classOf(reg.expr), ident = identOf(reg.expr)
    entry.impl = { registryLine: reg.line, expression: reg.expr }
    if (cls === "AbilityStrategy") { unc.push({ code: "PLACEHOLDER_STRATEGY", note: "registry uses the bare AbilityStrategy; behaviour comes from elsewhere (modes, passive) or is intentionally empty" }) }
    else if (cls) {
      const ci = classIndex.get(cls)
      entry.impl.class = cls
      if (!ci) unc.push({ code: "CLASS_FILE_UNRESOLVED", note: `class ${cls} not found in the imported file ${imports.get(cls) ?? "(no import found)"}` })
      else {
        entry.impl.file = ci.file; entry.impl.line = ci.line
        const fl = fileCache.get(ci.file) ?? []
        let text
        if (ci.file === ABIL_DIR + "abilities.ts") { // classes defined inside the registry file: only their own body
          let end = ci.line; while (end < fl.length && fl[end] !== "}") end++
          text = fl.slice(ci.line - 1, end + 1).join("\n")
        } else text = fl.join("\n")
        if (ci.extends && ci.extends !== "AbilityStrategy") {
          entry.impl.extends = ci.extends
          const bases = usersOfClass.get(ci.extends) ?? []
          unc.push({ code: "EXTENDS_OTHER_STRATEGY", note: `extends ${ci.extends}${bases.length ? ` (used by ${bases.join(", ")})` : " (not directly registered)"}` })
          entry.impl.dependsOnAbilities = bases.filter((b) => b !== id)
        }
        const refs = [...new Set([...text.matchAll(/\bAbility\.([A-Z0-9_]+)/g)].map((m) => m[1]))].filter((a) => a !== id && abilityNames.has(a)).sort()
        if (refs.length) unc.push({ code: "REFERENCES_OTHER_ABILITIES", note: `strategy file mentions Ability.${refs.join(", Ability.")}` })
        if (/AbilityStrategies\[/.test(text)) unc.push({ code: "RUNTIME_ABILITY_DISPATCH", note: "strategy dispatches to other abilities at run time (AbilityStrategies[...] in its file)" })
        if (/\.skill\s*=[^=]/.test(text)) unc.push({ code: "RUNTIME_SKILL_CHANGE", note: "strategy file assigns a skill at run time" })
        const sharers = (usersOfClass.get(cls) ?? []).filter((a) => a !== id)
        if (sharers.length) unc.push({ code: "SHARED_STRATEGY_CLASS", note: `class ${cls} is also registered for ${sharers.join(", ")}` })
      }
    } else if (ident) {
      entry.impl.constant = ident
      const cf = imports.get(ident)
      entry.impl.file = cf ?? ABIL_DIR + "abilities.ts"
      entry.impl.line = cf ? (fileCache.get(cf) ?? []).findIndex((l) => new RegExp(`^export const ${ident}\\b`).test(l)) + 1 || null : constDefs.get(ident) ?? null
      unc.push({ code: "CONSTANT_STRATEGY", note: `registered through the constant ${ident} (a shared object/factory, not a strategy class), defined in ${entry.impl.file}` })
      const sharers = (usersOfClass.get(ident) ?? []).filter((a) => a !== id)
      if (sharers.length) unc.push({ code: "SHARED_STRATEGY_CLASS", note: `${ident} is also registered for ${sharers.join(", ")}` })
    } else unc.push({ code: "REGISTRY_EXPRESSION_UNPARSED", note: `registry expression ${reg.expr} not understood` })
  }
  if (byPassive.has(id)) unc.push({ code: "NAME_SHARED_WITH_PASSIVE", note: `a passive named ${id} exists` })
  if (effectNames.has(id)) unc.push({ code: "NAME_SHARED_WITH_EFFECT", note: `EffectEnum.${id} exists (a separate identifier)` })
  if (itemNames.has(id)) unc.push({ code: "NAME_SHARED_WITH_ITEM", note: `Item.${id} exists (a separate identifier)` })
  if (entry.impl?.class) {
    let root = entry.impl.class, guard = 0
    while (classIndex.get(root)?.extends && classIndex.get(root).extends !== "AbilityStrategy" && classIndex.has(classIndex.get(root).extends) && guard++ < 10) root = classIndex.get(root).extends
    entry.familyKey = `class:${root}`
  }
  entry.groupKey = entry.impl?.class ? `class:${entry.impl.class}` : entry.impl?.constant ? `const:${entry.impl.constant}` : `ability:${id}`
  entry.routingUncertainties = unc
  entry.coverage = coverage(id, units, abilityCover, null)
  abilities[id] = entry
}

// ---- build passive entries ---------------------------------------------------------------------------------------------
const passives = {}
for (const id of [...byPassive.keys()].filter((p) => p !== "NONE").sort()) {
  const units = byPassive.get(id)
  const unc = []
  const pe = passEntries.get(id)
  const refs = passiveRefs.get(id) ?? new Map()
  const refFiles = [...refs.entries()].map(([file, lines]) => ({ file, lines: [...new Set(lines)].sort((a, b) => a - b) })).sort((a, b) => a.file.localeCompare(b.file))
  if (!pe) unc.push({ code: "NO_PASSIVE_EFFECTS_ENTRY", note: refFiles.length ? "no PassiveEffects entry; logic is in the files listed under references" : "no PassiveEffects entry and no other reference found; behaviour location unknown" })
  if (pe && refFiles.length) unc.push({ code: "ALSO_REFERENCED_ELSEWHERE", note: `besides its PassiveEffects entry the passive is checked in ${refFiles.map((r) => r.file).join(", ")}` })
  if (pe && pe.rhs === null) unc.push({ code: "MULTI_LINE_ENTRY", note: "PassiveEffects entry spans several lines; effect list not parsed" })
  if (effectNames.has(id)) unc.push({ code: "NAME_SHARED_WITH_EFFECT", note: `EffectEnum.${id} exists (a separate identifier)` })
  if (abilityNames.has(id)) unc.push({ code: "NAME_SHARED_WITH_ABILITY", note: `Ability.${id} exists (a separate identifier)` })
  if (itemNames.has(id)) unc.push({ code: "NAME_SHARED_WITH_ITEM", note: `Item.${id} exists (a separate identifier)` })
  if (runtimePassive.length) { /* global note recorded once in routing.global */ }
  passives[id] = {
    identifier: id, units,
    impl: { passiveEffectsEntry: pe ? { file: PASS, line: pe.line, expression: pe.rhs } : null, references: refFiles, unitDeclarations: declarations.get(id) ?? 0 },
    groupKey: pe && pe.rhs && /^\[[A-Za-z0-9_, ]+\]$/.test(pe.rhs) ? `effects:${pe.rhs}` : `passive:${id}`,
    routingUncertainties: unc,
    coverage: coverage(id, units, passiveCover, gaps)
  }
}

// ---- implementation groups -------------------------------------------------------------------------------------------------
const groups = {}
for (const [kind, set] of [["ability", abilities], ["passive", passives]]) {
  for (const [id, e] of Object.entries(set)) {
    const k = `${kind}|${e.groupKey}`
    if (!groups[k]) groups[k] = { kind, key: e.groupKey, identifiers: [], units: [] }
    groups[k].identifiers.push(id)
    groups[k].units.push(...e.units)
  }
}
const sharedGroups = Object.fromEntries(Object.entries(groups).filter(([, g]) => g.identifiers.length > 1).map(([k, g]) => [k, { ...g, units: [...new Set(g.units)].sort() }]))

const families = {}
for (const [id, e] of Object.entries(abilities)) if (e.familyKey) (families[e.familyKey] ??= []).push(id)
const sharedFamilies = Object.fromEntries(Object.entries(families).filter(([, v]) => v.length > 1).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.sort()]))
const count = (set, st) => Object.values(set).filter((e) => e.coverage.status === st).length
const inv = {
  schema: 1, label: LABEL, sourceSha: SHA,
  note: "Derived by assistant/automation/inventory.mjs from data/07367c34/catalog-units.json, the pinned source (git object reads only) and the saved record files. Do not edit by hand; regenerate. Coverage compares unit lists only: it says an existing record covers a unit, not that the record is correct or independently reviewed (see review-status.json).",
  routing: {
    global: [
      { code: "TM_AND_SKILL_SWAP", note: `catalog skills are bare-instance values; ${runtimeSkill.length} source file(s) in app/core and app/models assign a skill at run time (${runtimeSkill.join(", ") || "none"}), so a unit's cast ability can differ from its catalog skill` },
      { code: "RUNTIME_PASSIVE_CHANGE", note: `changePassive( is called from ${runtimePassive.join(", ") || "no file"}; a unit's passive can differ from its catalog passive` },
      { code: "GROUPING_IS_SYNTACTIC", note: "implementation groups are derived from registry/class/PassiveEffects text, not from behavioural equivalence; a shared class does not prove identical behaviour for every unit (stars, stats and passives differ)" }
    ]
  },
  summary: {
    catalogUnits: Object.keys(P).length,
    abilities: { identifiers: Object.keys(abilities).length, structured_full: count(abilities, "structured_full"), structured_partial: count(abilities, "structured_partial"), none: count(abilities, "none"), withRoutingUncertainty: Object.values(abilities).filter((e) => e.routingUncertainties.length).length, implementationGroups: new Set(Object.values(abilities).map((e) => e.groupKey)).size },
    passives: { identifiers: Object.keys(passives).length, structured_full: count(passives, "structured_full"), structured_partial: count(passives, "structured_partial"), explicit_gap: count(passives, "explicit_gap"), notes_only: count(passives, "notes_only"), none: count(passives, "none"), withRoutingUncertainty: Object.values(passives).filter((e) => e.routingUncertainties.length).length },
    sharedImplementationGroups: Object.keys(sharedGroups).length,
    sharedAbilityFamilies: Object.keys(sharedFamilies).length
  },
  sharedImplementationGroups: sharedGroups,
  abilityFamilies: { note: "abilities whose strategy classes share a base class other than AbilityStrategy (the base is analysed once, subclasses reuse it); a family is a syntactic grouping, not proof of identical behaviour", shared: sharedFamilies },
  abilities, passives
}

const text = JSON.stringify(inv, null, 1) + "\n"
if (argv.includes("--summary")) { console.log(JSON.stringify(inv.summary, null, 1)); process.exit(0) }
if (argv.includes("--check")) {
  let saved = ""
  try { saved = readFileSync(outPath, "utf8") } catch { die(`${outPath} does not exist; generate it first`, 1) }
  if (saved !== text) die(`inventory is out of date: regenerate with node assistant/automation/inventory.mjs`, 1)
  console.log(`inventory up to date (${inv.summary.abilities.identifiers} abilities, ${inv.summary.passives.identifiers} passives)`)
} else {
  const tmp = outPath + ".tmp"
  writeFileSync(tmp, text); renameSync(tmp, outPath)
  console.log(`wrote ${outPath}: ${inv.summary.abilities.identifiers} abilities, ${inv.summary.passives.identifiers} passives, ${inv.summary.sharedImplementationGroups} shared implementation groups`)
}
