// Prints a concise Markdown card for one pilot unit from the committed pilot snapshots.
// Reads JSON + Markdown headings only: it does not import or execute game code.
// Default dataset: the DEVELOPMENT snapshot (data/01a3e845, development-branch commit). It does NOT read the separate
// production-branch reference snapshot (data/07367c34); see analysis/pilot-baseline-comparison.md for that comparison.
//
// Usage: node assistant/lookup-unit.mjs <PKM_KEY>
//        node assistant/lookup-unit.mjs --list
//   optional (mainly for testing): --baseline <pilot-units.json> --evolution <pilot-evolution.json>
// Exit codes: 0 ok · 1 unit not covered by the pilot · 2 usage / unreadable or malformed input · 3 snapshots refused
//             (different audited commits, failed game-source match, or inconsistent unit sets / identities).
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const KNOWLEDGE = resolve(HERE, "knowledge")
const NOTES = {
  units: { file: "pilot-units.md", label: "pilot-units.md" },
  evolution: { file: "pilot-evolution.md", label: "pilot-evolution.md" }
}

class Refusal extends Error {
  constructor(code, msg) {
    super(msg)
    this.code = code
  }
}
const fail = (code, msg) => {
  throw new Refusal(code, msg)
}

function parseArgs(argv) {
  const o = { key: undefined, list: false, baseline: resolve(HERE, "data/01a3e845/pilot-units.json"), evolution: resolve(HERE, "data/01a3e845/pilot-evolution.json") }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--list") o.list = true
    else if (a === "--baseline" || a === "--evolution") {
      const v = argv[++i]
      if (!v || v.startsWith("--")) fail(2, `${a} requires a file path`)
      o[a.slice(2)] = resolve(process.cwd(), v)
    } else if (a.startsWith("--")) fail(2, `unknown option ${a}`)
    else if (o.key === undefined) o.key = a
    else fail(2, `unexpected extra argument ${a}`)
  }
  return o
}

function readJson(file, what) {
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch (e) {
    return fail(2, `cannot read ${what} ${file}: ${e.message}`)
  }
}

// Both snapshots must describe the same audited source, with a verified game-source match, and the same units.
function loadSnapshots(o) {
  const b = readJson(o.baseline, "baseline snapshot")
  const e = readJson(o.evolution, "evolution snapshot")
  if (!b || typeof b.pokemon !== "object" || b.pokemon === null) fail(2, `${o.baseline} has no "pokemon" section`)
  if (!e || typeof e.units !== "object" || e.units === null) fail(2, `${o.evolution} has no "units" section`)
  const pb = b.provenance
  const pe = e.provenance
  if (!pb || !pe) fail(3, "a snapshot has no provenance block; cannot verify the audited source")
  const sha = (p) => (typeof p.auditedSourceCommit === "string" && /^[0-9a-f]{40}$/.test(p.auditedSourceCommit) ? p.auditedSourceCommit : null)
  if (!sha(pb) || !sha(pe)) fail(3, "a snapshot lacks a full 40-hex auditedSourceCommit")
  if (pb.auditedSourceCommit !== pe.auditedSourceCommit) {
    fail(3, `snapshots describe different audited source commits (baseline ${pb.auditedSourceCommit} vs evolution ${pe.auditedSourceCommit}); refusing to combine them`)
  }
  if (pb.gameSourceMatchesAudited !== true || pe.gameSourceMatchesAudited !== true) {
    fail(3, `a snapshot was not produced from game source matching the audited commit (baseline gameSourceMatchesAudited=${pb.gameSourceMatchesAudited}, evolution gameSourceMatchesAudited=${pe.gameSourceMatchesAudited}); refusing to use it`)
  }
  const kb = Object.keys(b.pokemon)
  const ke = Object.keys(e.units)
  if (kb.length !== ke.length || !kb.every((k) => Object.hasOwn(e.units, k))) {
    fail(3, `snapshots cover different unit sets (baseline ${kb.length} units, evolution ${ke.length} units); refusing to combine them`)
  }
  return { b, e, keys: kb, audited: pb.auditedSourceCommit }
}

// ---- links into the knowledge notes (anchors are taken from headings that really exist) ----------------------
// GitHub-style anchor: lowercase, drop everything except letters, digits, spaces, "_" and "-", spaces become "-".
const slug = (h) => h.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-")

function headings(file) {
  let text
  try {
    text = readFileSync(resolve(KNOWLEDGE, file), "utf8")
  } catch {
    return { lines: [], heads: [] }
  }
  const lines = text.split("\n")
  const heads = []
  lines.forEach((l, i) => {
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(l)
    if (m) heads.push({ level: m[1].length, text: m[2], line: i })
  })
  return { lines, heads }
}

function noteLinks(key) {
  const out = []
  const link = (docKey, head) => `[${NOTES[docKey].label} § ${head.text.replace(/`/g, "")}](assistant/knowledge/${NOTES[docKey].file}#${slug(head.text)})`
  const keyRe = new RegExp(`^${key}(?![A-Z0-9_])`)
  for (const docKey of ["units", "evolution"]) {
    const { lines, heads } = headings(NOTES[docKey].file)
    const own = heads.filter((h) => keyRe.test(h.text.replace(/`/g, "")))
    own.forEach((h) => out.push(`${link(docKey, h)} (unit-specific section)`))
    const find = (prefix) => heads.find((h) => h.text.replace(/`/g, "").startsWith(prefix))
    if (docKey === "units") {
      const t = find("Table")
      if (t) out.push(`${link(docKey, t)} (all 20 units)`)
      const cc = find("Independent cross-check")
      if (cc) {
        const next = heads.find((h) => h.line > cc.line)
        const slice = lines.slice(cc.line, next ? next.line : lines.length)
        if (slice.some((l) => l.startsWith(`| ${key} |`))) out.push(`${link(docKey, cc)} (source cross-check row for this unit)`)
      }
      const w = find("What these numbers are")
      if (w) out.push(`${link(docKey, w)} (what "bare instance" means)`)
    } else {
      const r = find("How to read the JSON")
      if (r) out.push(`${link(docKey, r)}`)
      const t = find("Declarations for the 20 units")
      if (t) out.push(`${link(docKey, t)} (all 20 units)`)
      const u = find("Unresolved list")
      if (u) out.push(`${link(docKey, u)} (paths not traced)`)
    }
  }
  return out
}

// ---- rendering --------------------------------------------------------------------------------------------------
const code = (v) => `\`${v}\``
const list = (arr) => (arr.length ? arr.map(code).join(", ") : "none")

function ruleParams(props) {
  const out = []
  if (props.numberRequired?.present) out.push(`numberRequired=${props.numberRequired.value}`)
  if (props.itemsTriggeringEvolution?.present) out.push(`itemsTriggeringEvolution=[${props.itemsTriggeringEvolution.value.length} items]`)
  if (props.moneyRequired?.present) out.push(`moneyRequired=${props.moneyRequired.value}`)
  return out.length ? out.join(", ") : "none"
}

function render(key, snap) {
  const bu = snap.b.pokemon[key]
  const eu = snap.e.units[key]
  if (bu.identity.key !== eu.identity.key || bu.identity.name !== eu.identity.name || bu.identity.index !== eu.identity.index) {
    fail(3, `identity of ${key} differs between the two snapshots; refusing to combine them`)
  }
  const s = bu.stats
  const d = eu.declaredEvolution
  const r = eu.evolutionRule
  const ev = eu.evolutionEvidence
  const probe = snap.e.probes?.[key]
  const callbacks = Object.entries(r.properties).filter(([, v]) => v.present && v.kind === "callback")
  const L = []
  L.push(`# ${key} — pilot lookup`)
  L.push("")
  L.push(`> **Dataset: development snapshot** (not the production-branch reference). **Audited game source:** ${code(snap.audited)} (both snapshots record \`gameSourceMatchesAudited=true\`).`)
  L.push("> **Live-game parity is UNVERIFIED.** This card shows bare-instance data read through the game's factory and stub-argument callback probes — not observed gameplay. No acquisition stats, ability explanations or strategy advice are included.")
  L.push("")
  L.push("## Identity")
  L.push(`- Key / name / index: ${code(bu.identity.key)} / ${code(bu.identity.name)} / ${code(bu.identity.index)}`)
  L.push(`- Evolution-family root (\`getPokemonBaseline\`; a separate field, not this unit's identity): ${code(bu.evolutionFamilyRoot)}`)
  L.push("")
  L.push("## Bare-instance values")
  L.push("Class definition plus inherited defaults, before any player, item, board, synergy, hook or combat effect.")
  L.push("")
  L.push("| Rarity | Stars | HP | Attack | Def | SpeDef | Speed | Range | Max PP |")
  L.push("|---|---|---|---|---|---|---|---|---|")
  L.push(`| ${s.rarity} | ${s.stars} | ${s.hp} | ${s.atk} | ${s.def} | ${s.speDef} | ${s.speed} | ${s.range} | ${s.maxPP} |`)
  L.push("")
  L.push(`- Types: ${bu.types.length ? list(bu.types) : "none on the bare instance"}`)
  L.push(`- Ability identifier (\`skill\`): ${code(s.skill)} · passive identifier: ${code(s.passive)} (identifiers only; \`DEFAULT\`/\`NONE\` are the enum values, and this data holds no descriptions)`)
  L.push("")
  L.push("## Declared evolution data")
  L.push(`- \`evolution\`: ${code(d.evolution)}${d.evolution === "DEFAULT" ? " (\`DEFAULT\` = no single target declared)" : ""} · \`evolutions\`: ${list(d.evolutions)} · \`stacksRequired\`: ${d.stacksRequired}`)
  const reasons = []
  if (ev.declaresEvolutionTarget) reasons.push("`evolution` is set")
  if (ev.declaresEvolutionsArray) reasons.push("`evolutions` is non-empty")
  L.push(`- **Evidence the unit can evolve:** ${ev.hasEvolutionGetter ? `yes — declared in the class (${reasons.join(" and ")})` : "**none declared** (`evolution` is `DEFAULT` and `evolutions` is empty)"}`)
  L.push(`- **Rule shape** (what the class carries): type ${code(r.type)}, handler ${code(r.handler.class)}, parameters: ${ruleParams(r.properties)}, callbacks: ${callbacks.length ? callbacks.map(([n, v]) => `${code(n)} at ${code(`${v.source.file}:${v.source.line ?? "?"}`)}`).join(", ") : "none"} (callback presence only; this data does not capture their behaviour)`)
  if (r.matchesInheritedBaseDefault && !ev.hasEvolutionGetter) {
    L.push("- **Inherited default, not evidence:** this rule equals the base `Pokemon` default (`count`, `numberRequired=3`). With no declared evolution it is just an inherited rule shape and does **not** show that this unit can evolve.")
  } else if (r.matchesInheritedBaseDefault) {
    L.push("- **Rule vs. evidence:** the rule equals the inherited base default (`count`, `numberRequired=3`); that shape is not itself the evidence. The evidence of evolvability is the declared `evolution`/`evolutions` fields above.")
  } else if (ev.hasEvolutionGetter) {
    L.push("- **Class-specific rule:** it differs from the inherited base default, and evolution targets are declared. The full target map is not in this data when it depends on a callback.")
  } else {
    L.push("- **Class-specific rule without a declared target:** this data does not show what it triggers.")
  }
  L.push("")
  L.push("## Callback probes")
  if (probe) {
    L.push("_Stub-argument calls of the real callback (not full gameplay behaviour: when and whether an evolution fires, and the state the callback sees in a game, are in the notes, read from source and not executed)._")
    L.push(`- Probe: ${probe.kind}`)
    if (probe.itemToVariant) {
      const by = new Map()
      for (const x of probe.itemToVariant) {
        if (!by.has(x.result)) by.set(x.result, [])
        by.get(x.result).push(`${x.item} (${x.synergyGivenByItem})`)
      }
      L.push(`- ${probe.itemToVariant.length} items probed → ${by.size} distinct results:`)
      for (const [v, items] of by) L.push(`  - ${code(v)} (${items.length}): ${items.join(", ")}`)
    } else {
      for (const [name, v] of Object.entries(probe)) {
        if (name !== "kind" && v && typeof v === "object" && "result" in v) L.push(`  - ${name}: → ${code(v.result)}`)
      }
    }
  } else if (callbacks.length) {
    L.push(`No probe was run for this unit: its callback${callbacks.length > 1 ? "s are" : " is"} present (${callbacks.map(([n]) => code(n)).join(", ")}) but **not probed** (it needs real game state). See the notes for the source reading.`)
  } else {
    L.push("No callback probes exist for this unit (it has no callback).")
  }
  L.push("")
  L.push("## Knowledge notes")
  const links = noteLinks(key)
  if (links.length) links.forEach((l) => L.push(`- ${l}`))
  else L.push("- (no matching sections found in the notes)")
  L.push("- Full limitations and unresolved paths: [STATUS.md](assistant/STATUS.md) · overview: [README.md](assistant/README.md)")
  return L.join("\n")
}

function main() {
  const o = parseArgs(process.argv.slice(2))
  if (!o.list && o.key === undefined) fail(2, "usage: node assistant/lookup-unit.mjs <PKM_KEY> | --list")
  const snap = loadSnapshots(o)
  if (o.list) {
    console.log(`Pilot units covered (${snap.keys.length}), development snapshot, audited source ${snap.audited}:\n${snap.keys.join(", ")}`)
    return 0
  }
  if (!Object.hasOwn(snap.b.pokemon, o.key)) {
    console.error(`${o.key}: not covered by the 20-unit pilot. No data is shown for it; this tool does not guess or fall back to other sources.\nCovered keys (exact, case-sensitive): ${snap.keys.join(", ")}`)
    return 1
  }
  console.log(render(o.key, snap))
  return 0
}

try {
  process.exitCode = main()
} catch (e) {
  if (e instanceof Refusal) {
    console.error(`lookup-unit: ${e.code === 3 ? "REFUSED — " : ""}${e.message}`)
    process.exitCode = e.code
  } else throw e
}
