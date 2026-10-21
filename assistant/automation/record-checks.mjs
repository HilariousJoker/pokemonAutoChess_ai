// Reusable record checks for ability / passive / passive-gap records of the production-branch reference
// (07367c34; deployment unverified). One set of generic checks instead of bespoke code per ability:
//   revision + label · required fields · unit bindings against the saved catalog and the pinned class block ·
//   evidence references (line range exists, `expect` text present, ids resolve, no orphan ids) ·
//   declarative source tables (`sourceTables`) · numeric examples of registered kinds.
// Source text is read with `git show <sha>:<path>` (the pinned commit object must exist locally; no checkout, no install).
// What these checks do NOT establish is returned in `unchecked` and documented in AUTOMATION.md ("Semantic claims").
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const HERE = dirname(fileURLToPath(import.meta.url))
export const ASSISTANT = resolve(HERE, "..")
export const REPO = resolve(ASSISTANT, "..")
export const SHA = "07367c341fe928763da2b565c2eee010433e4fc1"
export const LABEL = "production-branch reference; deployment unverified"

export const norm = (s) => s.replace(/\s+/g, " ").trim()
const own = (o, k) => Object.hasOwn(o, k)

// ---- context: catalog + pinned source reader --------------------------------------------------------------
export function makeContext({ catalogPath = resolve(ASSISTANT, "data/07367c34/catalog-units.json"), repo = REPO, sha = SHA } = {}) {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"))
  const cache = new Map()
  const src = (file) => {
    if (!cache.has(file)) cache.set(file, execFileSync("git", ["-C", repo, "show", `${sha}:${file}`], { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] }).split("\n"))
    return cache.get(file)
  }
  return { catalog, src, sha, repo }
}

// ---- required fields ---------------------------------------------------------------------------------------
// "common" fits every existing record (pilot included); "candidate" adds what a new ability record must state.
export const REQUIRED = {
  ability: {
    common: ["ability", "appliesTo", "dispatch", "summary", "positionalConditions", "repeatedCastsAndModes", "rawVsResolved", "dependsOnUnverifiedGenericCombat", "unresolved", "evidence", "sourceSha", "label"],
    candidate: ["targeting", "effects", "starBehavior", "geometry"]
  },
  passive: {
    common: ["passive", "appliesTo", "summary", "kind", "resetBehaviour", "dependsOnUnverifiedGenericCombat", "unresolved", "evidence", "sourceSha", "label"],
    candidate: ["effects", "conditions"]
  },
  gap: { common: ["passive", "appliesTo", "status", "unitEvidence", "evidence", "sourceSha", "label"], candidate: [] }
}

const nonEmpty = (v) => v !== undefined && v !== null && !(typeof v === "string" && !v.trim()) && !(Array.isArray(v) && v.length === 0)

function evidenceIdsUsed(o, acc = new Set()) {
  if (Array.isArray(o)) o.forEach((x) => evidenceIdsUsed(x, acc))
  else if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      if ((k === "evidence") && Array.isArray(v) && v.length && typeof v[0] === "string") v.forEach((i) => acc.add(i))
      else if (k !== "evidence") evidenceIdsUsed(v, acc)
    }
  }
  return acc
}

const getPath = (o, path) => path.split(".").reduce((a, k) => (a === undefined || a === null ? undefined : a[k]), o)
export const expandByStars = (o) => [1, 2, 3, 4].map((i) => o[i] ?? o.fallback)

// ---- the checks ----------------------------------------------------------------------------------------------
// kind: "ability" | "passive" | "gap"; profile: "common" | "candidate"
export function checkRecord(kind, name, rec, ctx, { profile = "common" } = {}) {
  const problems = [], unchecked = [], stats = { evidence: 0, tables: 0, examples: 0, units: 0 }
  const bad = (m) => problems.push(`${kind} ${name}: ${m}`)
  if (!own(REQUIRED, kind)) return { problems: [`unknown record kind ${kind}`], unchecked, stats }

  // 1. revision + label
  if (rec.sourceSha !== ctx.sha) bad(`sourceSha is ${rec.sourceSha}, not the pinned ${ctx.sha}`)
  if (!/deployment unverified/.test(rec.label ?? "")) bad("label lacks 'deployment unverified'")
  const idField = kind === "ability" ? "ability" : "passive"
  if (rec[idField] !== name) bad(`${idField} field is ${rec[idField]}`)

  // 2. required fields
  const need = [...REQUIRED[kind].common, ...(profile === "candidate" ? REQUIRED[kind].candidate : [])]
  for (const f of need) if (!nonEmpty(rec[f])) bad(`required field ${f} missing or empty`)
  if (kind !== "gap") {
    if (Array.isArray(rec.unresolved) && !rec.unresolved.length) bad("unresolved list is empty (state what is unresolved)")
  }

  // 3. evidence references
  const ids = new Set()
  for (const e of rec.evidence ?? []) {
    stats.evidence++
    if (ids.has(e.id)) bad(`duplicate evidence id ${e.id}`)
    ids.add(e.id)
    for (const f of ["id", "file", "lines", "symbol", "expect"]) if (!nonEmpty(e[f])) bad(`evidence ${e.id ?? "?"}: field ${f} missing`)
    let L
    try { L = ctx.src(e.file) } catch { bad(`evidence ${e.id}: file ${e.file} not readable at the pinned revision`); continue }
    const [a, b] = e.lines ?? []
    if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b >= a && b <= L.length)) { bad(`evidence ${e.id}: bad line range ${a}-${b} in ${e.file}`); continue }
    if (!norm(L.slice(a - 1, b).join(" ")).includes(norm(e.expect))) bad(`evidence ${e.id}: "${e.expect}" not found in ${e.file}:${a}-${b}`)
  }
  const used = evidenceIdsUsed({ ...rec, evidence: undefined })
  for (const id of used) if (!ids.has(id)) bad(`unknown evidence id ${id}`)
  for (const id of ids) if (!used.has(id)) (profile === "candidate" ? bad : (m) => unchecked.push(`${kind} ${name}: ${m}`))(`evidence ${id} is never referenced by the record`)
  if (profile === "candidate" && kind !== "gap" && !used.size) bad("no claim references any evidence id")

  // 4. unit bindings against the saved catalog and the pinned class block
  const units = rec.appliesTo ?? []
  const seen = new Set()
  for (const u of units) {
    stats.units++
    if (seen.has(u.key)) bad(`unit ${u.key} listed twice`)
    seen.add(u.key)
    const c = own(ctx.catalog.pokemon, u.key) ? ctx.catalog.pokemon[u.key] : null
    if (!c) { bad(`unit ${u.key} is not a catalog identifier`); continue }
    const s = c.stats
    if (s.stars !== u.stars || s.maxPP !== u.maxPP || s.range !== u.range) bad(`unit ${u.key}: stars/maxPP/range disagree with the catalog`)
    if (u.declaredSkill !== undefined && s.skill !== u.declaredSkill) bad(`unit ${u.key}: skill ${u.declaredSkill} vs catalog ${s.skill}`)
    if (u.declaredPassive !== undefined && s.passive !== u.declaredPassive) bad(`unit ${u.key}: passive ${u.declaredPassive} vs catalog ${s.passive}`)
    if (profile === "candidate" && (u.declaredSkill === undefined || u.declaredPassive === undefined)) bad(`unit ${u.key}: candidates must state declaredSkill and declaredPassive`)
    if (kind === "ability" && s.skill !== name) bad(`unit ${u.key} declares skill ${s.skill}, not ${name}`)
    if (kind !== "ability" && s.passive !== name) bad(`unit ${u.key} declares passive ${s.passive}, not ${name}`)
    const cls = ctx.catalog.registry?.[u.key]?.registeredClass
    try {
      const text = ctx.src("app/models/colyseus-models/pokemon.ts").join("\n")
      const m = cls && text.match(new RegExp(`export class ${cls} extends Pokemon \\{([\\s\\S]*?)\\n\\}`))
      if (!m) bad(`unit ${u.key}: class ${cls} not found in pokemon.ts`)
      else {
        if (!m[1].includes(`stars = ${u.stars}`)) bad(`unit ${u.key}: class ${cls} does not declare stars = ${u.stars}`)
        if (kind === "ability" && !m[1].includes(`skill = Ability.${name}`)) bad(`unit ${u.key}: class ${cls} does not declare skill ${name}`)
        if (kind !== "ability" && !m[1].includes(`passive = Passive.${name}`)) bad(`unit ${u.key}: class ${cls} does not declare passive ${name}`)
      }
    } catch (e) { bad(`unit ${u.key}: pokemon.ts unreadable (${e.message.split("\n")[0]})`) }
  }
  if (kind !== "gap" && !units.length) bad("appliesTo is empty")

  // 5. declarative source tables: {id, file, pattern, recordPath, unitValuesPath?}
  for (const t of rec.sourceTables ?? []) {
    stats.tables++
    let text
    try { text = ctx.src(t.file).join("\n") } catch { bad(`table ${t.id}: ${t.file} not readable`); continue }
    const m = text.match(new RegExp(t.pattern))
    if (!m || m[1] === undefined) { bad(`table ${t.id}: pattern not found in ${t.file}`); continue }
    const fromSource = m[1].split(",").map((x) => Number(x.trim()))
    if (fromSource.some((n) => Number.isNaN(n))) { bad(`table ${t.id}: non-numeric entries`); continue }
    let got = getPath(rec, t.recordPath)
    if (got && !Array.isArray(got) && typeof got === "object") got = expandByStars(got)
    if (JSON.stringify(got) !== JSON.stringify(fromSource) && JSON.stringify(got) !== JSON.stringify(expandToFour(fromSource))) bad(`table ${t.id}: record ${JSON.stringify(got)} vs source ${JSON.stringify(fromSource)}`)
    if (t.unitValuesPath) {
      const pu = getPath(rec, t.unitValuesPath) ?? {}
      for (const u of units) {
        const want = fromSource[u.stars - 1] ?? fromSource[fromSource.length - 1]
        if (pu[u.key] !== want) bad(`table ${t.id}: per-unit value for ${u.key} is ${pu[u.key]}, table says ${want}`)
      }
    }
  }
  if (profile === "candidate" && kind === "ability" && !(rec.sourceTables ?? []).length) unchecked.push("no sourceTables declared: numeric tables written in the record were not compared with the source")

  // 6. numeric examples of registered kinds
  for (const x of rec.numericExamples ?? []) {
    stats.examples++
    if (!nonEmpty(x.conditions) || x.conditions.length < 20) bad(`example ${x.id}: conditions missing or too short`)
    const f = own(EXAMPLE_KINDS, x.kind) ? EXAMPLE_KINDS[x.kind] : null
    if (!f) { unchecked.push(`example ${x.id}: kind ${x.kind} has no registered formula (value not recomputed)`); continue }
    const got = f(x)
    if (JSON.stringify(got) !== JSON.stringify(x.expected)) bad(`example ${x.id}: recomputed ${JSON.stringify(got)} vs record ${JSON.stringify(x.expected)}`)
  }
  if (kind !== "gap") {
    const armor = (() => { try { return /ARMOR_FACTOR = 0\.05/.test(ctx.src("app/config/game/battle.ts").join("\n")) } catch { return false } })()
    if ((rec.numericExamples ?? []).some((x) => x.kind === "specialAfterSpeDef") && !armor) bad("ARMOR_FACTOR 0.05 (used by specialAfterSpeDef examples) not confirmed")
  }

  unchecked.push(...UNCHECKED_ALWAYS)
  return { problems, unchecked, stats }
}

const expandToFour = (a) => (a.length === 4 ? a : [1, 2, 3, 4].map((i) => a[i - 1] ?? a[a.length - 1]))

// Registered example formulas (generic, shared; add here once, not per ability).
export const EXAMPLE_KINDS = {
  // special damage after the AP boost and the SPE_DEF division (ceil, min 1): the generic step read in pokemon-entity/pokemon-state
  specialAfterSpeDef: (x) => Math.max(1, Math.ceil((x.raw * (1 + x.ap / 100)) / (1 + 0.05 * x.speDef))),
  // a value looked up in a source table at the unit's stars
  tableAtStars: (x) => x.table[x.stars - 1] ?? x.table[x.table.length - 1],
  // arithmetic sum of listed terms
  sum: (x) => x.terms.reduce((a, b) => a + b, 0)
}

export const UNCHECKED_ALWAYS = [
  "free-text claims (summary, targeting, geometry, scaling, conditions, resetBehaviour, unresolved) are not machine-verified: an evidence `expect` proves the text exists at that range, not that it supports the claim",
  "completeness: that no other code path (callers, helpers, items, synergies, statuses) changes the described behaviour",
  "behaviour in a real fight; there is no gameplay evidence and no executed probe for candidates"
]
