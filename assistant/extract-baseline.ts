// Extracts baseline data for a small set of Pokémon through the real PokemonFactory.
//
// Usage (from any directory, inside a checkout that contains this file and installed node_modules):
//   node_modules/.bin/tsx assistant/extract-baseline.ts                       # default 3 units -> assistant/data/baseline.json
//   node_modules/.bin/tsx assistant/extract-baseline.ts --out <file> KEY ...  # any units, explicit output
//   flags: --out <file> | --out=<file>   output path (relative paths resolve against the current directory)
//          --allow-source-mismatch      record, instead of failing on, game-source drift from the audited commit
//          --profile production-reference   use the pinned production-branch reference (07367c34) instead of the
//                                       development snapshot (01a3e845); requires --out and explicit keys, and
//                                       declares which legacy fields are absent on that revision (see PROFILES)
//          --catalog                    (production-reference only, no explicit keys) every Pkm identifier is accounted for as
//                                       extracted / excluded (source-supported reason) / failed; writes the catalog checkpoint,
//                                       or - if any identifier fails - only a diagnostic file and exit 1
//
// Alternate unit sets MUST pass --out; they never write to the default checkpoint path.
// Output paths are checked before anything is written (output-guard.ts): game files, root config and the other
// extractor's checkpoints are refused; own checkpoint reruns (baseline.json, data/01a3e845/pilot-units.json with the same
// unit set) and scratch .json outputs are allowed.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { PokemonClasses } from "../app/models/colyseus-models/pokemon"
import PokemonFactory, { getPokemonBaseline } from "../app/models/pokemon-factory"
import { Ability } from "../app/types/enum/Ability"
import { Rarity } from "../app/types/enum/Game"
import { Passive } from "../app/types/enum/Passive"
import { Pkm, PkmIndex } from "../app/types/enum/Pokemon"
import { Synergy } from "../app/types/enum/Synergy"
import { checkOutputPath, OutputGuardError, realTarget } from "./output-guard"

const DEFAULT_KEYS = ["CHARMANDER", "FARFETCH_D", "VESPIQUEN"]

// A profile pins the source revision an extraction describes. `absentFields` are NUMERIC_FIELDS that the revision does
// not define at all: they must be genuinely absent from the factory instance (checked), are left out of `stats` and are
// recorded explicitly under `fieldAvailability`. Every other field is validated exactly as before.
const PROFILES = {
  development: {
    sourceCommit: "01a3e845e91ebe3144b3c43fa9cd261a5dadafd2",
    label: "development snapshot",
    checkpointDir: "01a3e845",
    absentFields: [] as string[]
  },
  "production-reference": {
    sourceCommit: "07367c341fe928763da2b565c2eee010433e4fc1",
    label: "production-branch reference; deployment unverified",
    checkpointDir: "07367c34",
    absentFields: ["baseAtk"]
  }
} as const
type ProfileName = keyof typeof PROFILES

const SCRIPT_DIR = dirname(resolve(process.argv[1]))
const REPO_ROOT = resolve(SCRIPT_DIR, "..")
const DEFAULT_OUT = resolve(SCRIPT_DIR, "data", "baseline.json")
// Checkpoints this extractor may regenerate / that belong to extract-evolution.ts or to the other profile (see output-guard.ts).
// Each profile may regenerate only its own pilot-units.json; the other profile's checkpoints are protected.
const dataPath = (dir: string, file: string) => resolve(SCRIPT_DIR, "data", dir, file)
function checkpointsFor(profile: ProfileName) {
  const mine = PROFILES[profile].checkpointDir
  const theirs = (Object.keys(PROFILES) as ProfileName[]).filter((n) => n !== profile).map((n) => PROFILES[n].checkpointDir)
  return {
    own:
      profile === "development"
        ? [DEFAULT_OUT, dataPath(mine, "pilot-units.json")]
        : [dataPath(mine, "pilot-units.json"), dataPath(mine, "catalog-units.json")],
    other: [
      dataPath(mine, "pilot-evolution.json"),
      ...(profile === "development" ? [dataPath("07367c34", "catalog-units.json")] : []),
      ...theirs.flatMap((d) => [dataPath(d, "pilot-units.json"), dataPath(d, "pilot-evolution.json")]),
      ...(profile === "development" ? [] : [DEFAULT_OUT])
    ]
  }
}

const NUMERIC_FIELDS = [
  "stars", "hp", "maxHP", "atk", "def", "speDef", "speed", "range", "maxPP",
  "ap", "luck", "critChance", "critPower", "baseMaxPP", "baseAtk"
] as readonly string[]
const STRING_FIELDS = ["rarity", "skill", "tm", "passive", "baseSkill"] as const
const BOOLEAN_FIELDS = [
  "additional", "regional", "canHoldItems", "canBeBenched", "canBeSold"
] as const

class ExtractError extends Error {}

function fail(msg: string): never {
  throw new ExtractError(msg)
}

function git(...args: string[]): string {
  try {
    return execFileSync("git", ["-C", REPO_ROOT, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim()
  } catch (e: any) {
    return fail(`git ${args.join(" ")} failed: ${String(e.stderr ?? e.message).trim()}`)
  }
}

function lines(s: string): string[] {
  return s ? s.split("\n") : []
}

function npmVersion(): string {
  try {
    return execFileSync("npm", ["--version"], { encoding: "utf8" }).trim()
  } catch {
    return "unavailable"
  }
}

// Provenance is measured, not asserted: the checkout commit is read from git, and the game
// source (everything outside assistant/) is compared with the audited commit.
function collectProvenance(profile: ProfileName, allowMismatch: boolean) {
  const AUDITED_SOURCE_COMMIT = PROFILES[profile].sourceCommit
  const checkoutCommit = git("rev-parse", "HEAD")
  try {
    execFileSync("git", ["-C", REPO_ROOT, "cat-file", "-e", `${AUDITED_SOURCE_COMMIT}^{commit}`], {
      stdio: "ignore"
    })
  } catch {
    fail(`audited commit ${AUDITED_SOURCE_COMMIT} is not available in this repository (shallow clone?)`)
  }

  const notAssistant = ["--", ".", ":(exclude)assistant"]
  // tracked files (working tree vs audited commit, staged or not) that differ from the audited revision
  const differingTrackedFiles = lines(git("diff", "--name-only", AUDITED_SOURCE_COMMIT, ...notAssistant))
  const untrackedOutsideAssistant = lines(git("ls-files", "--others", "--exclude-standard", ...notAssistant))
  const dirtyOutsideAssistant = lines(git("status", "--porcelain", ...notAssistant))
  const gameSourceMatchesAudited =
    differingTrackedFiles.length === 0 && untrackedOutsideAssistant.length === 0
  if (!gameSourceMatchesAudited && !allowMismatch) {
    fail(
      `game source differs from audited commit ${AUDITED_SOURCE_COMMIT}: ` +
        `${differingTrackedFiles.length} tracked file(s) differ (${differingTrackedFiles.slice(0, 5).join(", ")}), ` +
        `${untrackedOutsideAssistant.length} untracked outside assistant/. Use --allow-source-mismatch to record instead.`
    )
  }
  return {
    profile,
    snapshotLabel: PROFILES[profile].label,
    auditedSourceCommit: AUDITED_SOURCE_COMMIT,
    checkoutCommit,
    checkoutIsAuditedCommit: checkoutCommit === AUDITED_SOURCE_COMMIT,
    gameSourceMatchesAudited,
    differingTrackedFiles,
    untrackedOutsideAssistant,
    dirtyOutsideAssistant,
    dirtyInsideAssistant: lines(git("status", "--porcelain", "--", "assistant")),
    node: process.version,
    npm: npmVersion(),
    platform: `${process.platform}-${process.arch}`
  }
}

function parseArgs(argv: string[]) {
  const keys: string[] = []
  let out: string | undefined
  let allowMismatch = false
  let profile: ProfileName = "development"
  let catalog = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--out") {
      const v = argv[++i]
      if (!v || v.startsWith("--")) fail("--out requires a file path")
      out = v
    } else if (a.startsWith("--out=")) {
      out = a.slice("--out=".length)
      if (!out) fail("--out requires a file path")
    } else if (a === "--profile" || a.startsWith("--profile=")) {
      const v = a === "--profile" ? argv[++i] : a.slice("--profile=".length)
      if (!v || !Object.hasOwn(PROFILES, v)) fail(`--profile must be one of: ${Object.keys(PROFILES).join(", ")}`)
      profile = v as ProfileName
    } else if (a === "--catalog") {
      catalog = true
    } else if (a === "--allow-source-mismatch") {
      allowMismatch = true
    } else if (a.startsWith("--")) {
      fail(`unknown option ${a}`)
    } else {
      keys.push(a)
    }
  }
  return { keys, out, allowMismatch, profile, catalog }
}

function checkFinite(key: string, field: string, v: unknown) {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    fail(`${key}.${field} must be a finite number, got ${String(v)}`)
  }
}

function checkEnum(key: string, field: string, v: unknown, allowed: readonly string[], enumName: string) {
  if (typeof v !== "string" || !allowed.includes(v)) fail(`${key}.${field} = ${JSON.stringify(v)} is not a member of ${enumName}`)
}
const ENUMS = {
  Pkm: Object.values(Pkm) as string[],
  Rarity: Object.values(Rarity) as string[],
  Ability: Object.values(Ability) as string[],
  Passive: Object.values(Passive) as string[],
  Synergy: Object.values(Synergy) as string[]
}
const ENUM_FIELDS: Record<string, [string[], string]> = {
  rarity: [ENUMS.Rarity, "Rarity"], skill: [ENUMS.Ability, "Ability"], tm: [ENUMS.Ability, "Ability"],
  baseSkill: [ENUMS.Ability, "Ability"], passive: [ENUMS.Passive, "Passive"]
}

function extractUnit(key: string, profile: ProfileName) {
  const absent: readonly string[] = PROFILES[profile].absentFields
  // own-property check: "toString", "__proto__", "constructor" etc. are not Pkm members
  if (!Object.hasOwn(Pkm, key)) fail(`unknown Pkm key "${key}"`)
  const name = Pkm[key as keyof typeof Pkm]
  const p: any = PokemonFactory.createPokemonFromName(name)

  if (p.name !== name) {
    fail(`${key}: unexpected identity, factory returned name "${p.name}" (expected "${name}")`)
  }
  if (p.index !== PkmIndex[name]) {
    fail(`${key}: unexpected index "${p.index}" (expected "${PkmIndex[name]}")`)
  }

  const stats: Record<string, unknown> = {}
  const fieldAvailability: Record<string, { present: false; note: string }> = {}
  for (const f of NUMERIC_FIELDS) {
    if (absent.includes(f)) {
      // declared absent on this revision: it must really be absent (no property, even undefined), not just unset
      if (f in p) fail(`${key}.${f} is declared absent for profile ${profile} but the factory instance defines it (${String(p[f])})`)
      fieldAvailability[f] = { present: false, note: `not defined on ${profile} (${PROFILES[profile].sourceCommit.slice(0, 8)}); no value invented` }
      continue
    }
    checkFinite(key, f, p[f])
    stats[f] = p[f]
  }
  for (const f of STRING_FIELDS) {
    if (typeof p[f] !== "string" || p[f] === "") fail(`${key}.${f} must be a non-empty string, got ${String(p[f])}`)
    stats[f] = p[f]
  }
  for (const f of BOOLEAN_FIELDS) {
    if (typeof p[f] !== "boolean") fail(`${key}.${f} must be a boolean, got ${String(p[f])}`)
    stats[f] = p[f]
  }
  for (const [f, [allowed, enumName]] of Object.entries(ENUM_FIELDS)) checkEnum(key, f, stats[f], allowed, enumName)
  if (!p.types || typeof p.types[Symbol.iterator] !== "function") fail(`${key}.types missing`)
  const types = [...p.types]
  if (types.some((t) => typeof t !== "string")) fail(`${key}.types contains a non-string`)
  for (const t of types) checkEnum(key, "types[]", t, ENUMS.Synergy, "Synergy")
  if (typeof p.evolution !== "string") fail(`${key}.evolution must be a string`)
  checkEnum(key, "evolution", p.evolution, ENUMS.Pkm, "Pkm")
  if (!Array.isArray(p.evolutions)) fail(`${key}.evolutions must be an array`)
  for (const t of p.evolutions) checkEnum(key, "evolutions[]", t, ENUMS.Pkm, "Pkm")

  const evolutionFamilyRoot = getPokemonBaseline(name)
  if (typeof evolutionFamilyRoot !== "string" || !Object.hasOwn(Pkm, evolutionFamilyRoot)) {
    fail(`${key}: getPokemonBaseline returned unknown value ${String(evolutionFamilyRoot)}`)
  }

  return {
    // who this unit is — the key used for lookup, as returned by the factory
    identity: { key, name: p.name as string, index: p.index as string },
    // root of the unit's evolution family (getPokemonBaseline). NOT the unit's identity.
    evolutionFamilyRoot: evolutionFamilyRoot as string,
    // raw fields of a bare factory instance. NOT a complete evolution map: `evolution` is only the single default
    // next stage declared by the class, and `evolutions` is non-empty only for classes that declare branching targets
    // (e.g. PIKACHU, COSMOEM); neither includes evolutionRule (counts, items, divergentEvolution callbacks).
    // See extract-evolution.ts for the rule shape.
    bareInstanceEvolution: { evolution: p.evolution as string, evolutions: [...p.evolutions] as string[] },
    types,
    stats,
    ...(Object.keys(fieldAvailability).length ? { fieldAvailability } : {})
  }
}

// Identifiers excluded from the catalog, each with the inspected source that supports the reason. Nothing else is excluded.
const CATALOG_EXCLUSIONS: Record<string, { reason: string; source: string }> = {
  DEFAULT: {
    reason:
      "explicit placeholder: the factory's fallback for unregistered names is `new Pokemon(Pkm.DEFAULT)` logged as \"return MissingNo\", " +
      "so a DEFAULT result cannot distinguish a real unit from a fallback; PokemonClasses maps DEFAULT to the bare base Pokemon class",
    source: "app/models/pokemon-factory.ts:65-66; app/models/colyseus-models/pokemon.ts PokemonClasses[Pkm.DEFAULT]"
  }
}

// Registry facts for one key: constructor name and the other keys mapped to the same class (from PokemonClasses itself).
function registryFacts(keys: string[]) {
  const reg = PokemonClasses as Record<string, unknown>
  const byClass = new Map<unknown, string[]>()
  for (const k of keys) {
    if (!Object.hasOwn(reg, k)) continue
    if (!byClass.has(reg[k])) byClass.set(reg[k], [])
    byClass.get(reg[k])!.push(k)
  }
  return (k: string) => {
    const cls = reg[k] as { name: string }
    const group = byClass.get(reg[k]) ?? []
    return { registeredClass: cls.name, sharedClassWith: group.filter((x) => x !== k) }
  }
}

function main() {
  const { keys: argKeys, out, allowMismatch, profile, catalog } = parseArgs(process.argv.slice(2))
  if (catalog && (profile !== "production-reference" || argKeys.length || !out)) {
    fail("--catalog requires --profile production-reference, --out, and no explicit keys")
  }
  if (profile !== "development" && (!out || (!argKeys.length && !catalog))) fail(`profile ${profile} requires --out and explicit unit keys`)
  const { own: OWN_CHECKPOINTS, other: OTHER_CHECKPOINTS } = checkpointsFor(profile)
  const allKeys = Object.values(Pkm) as string[] // inventory = the Pkm enum values (all key === value, checked below)
  const keys = catalog ? allKeys : argKeys.length ? argKeys : DEFAULT_KEYS
  if (new Set(keys).size !== keys.length) fail(`duplicate keys requested: ${keys.join(", ")}`)

  const isDefaultSet = keys.length === DEFAULT_KEYS.length && DEFAULT_KEYS.every((k) => keys.includes(k))
  const outPath = out ? resolve(process.cwd(), out) : DEFAULT_OUT
  if (!isDefaultSet && outPath === DEFAULT_OUT) {
    fail(`refusing to write non-default unit set to the default checkpoint ${DEFAULT_OUT}; pass --out <other file>`)
  }

  // Output checks come first: nothing is extracted, created or written if the target is not acceptable.
  try {
    checkOutputPath({ outPath, repoRoot: REPO_ROOT, ownCheckpoints: OWN_CHECKPOINTS, otherCheckpoints: OTHER_CHECKPOINTS })
  } catch (e) {
    if (e instanceof OutputGuardError) fail(e.message)
    throw e
  }
  // Checkpoint roles are enforced whether or not the target exists (given path and symlink-resolved path alike):
  // the catalog checkpoint takes catalog output only, and no other checkpoint may receive catalog output.
  const CATALOG_OUT = dataPath(PROFILES["production-reference"].checkpointDir, "catalog-units.json")
  const isCatalogTarget = [outPath, realTarget(outPath)].some((p) => p === CATALOG_OUT || p === realTarget(CATALOG_OUT))
  if (isCatalogTarget && !catalog) {
    fail(`refusing to write ${outPath}: it is the catalog checkpoint and only --profile production-reference --catalog may write it. Nothing was written.`)
  }
  if (catalog && !isCatalogTarget && [...OWN_CHECKPOINTS, ...OTHER_CHECKPOINTS].some((c) => c === outPath || realTarget(c) === realTarget(outPath))) {
    fail(`refusing to write catalog output to checkpoint ${outPath}: only ${CATALOG_OUT} (or a scratch .json) may receive it. Nothing was written.`)
  }
  if (existsSync(outPath) && OWN_CHECKPOINTS.includes(outPath)) {
    // rerunning an existing checkpoint must keep its unit set (alternate sets go to a scratch --out).
    // Catalog mode is exclusion-aware: records exist for every requested identifier except the declared exclusions,
    // and the stored inventory must list exactly the requested identifiers.
    let doc: any
    try {
      doc = JSON.parse(readFileSync(outPath, "utf8"))
    } catch {}
    if (doc) {
      const have = Object.keys(doc.pokemon ?? {})
      const want = catalog ? keys.filter((k) => !Object.hasOwn(CATALOG_EXCLUSIONS, k)) : keys
      if (have.length !== want.length || !have.every((k) => want.includes(k))) {
        fail(`refusing to overwrite checkpoint ${outPath}: it holds ${have.length} unit record(s) but ${want.length} different one(s) would be written; use a scratch --out. Nothing was written.`)
      }
      if (catalog) {
        const inv: string[] | undefined = doc.inventory?.identifiers
        if (!Array.isArray(inv) || inv.length !== keys.length || !inv.every((k) => keys.includes(k))) {
          fail(`refusing to overwrite catalog checkpoint ${outPath}: its inventory section does not match the requested identifier inventory. Nothing was written.`)
        }
      }
    }
  }

  const provenance = collectProvenance(profile, allowMismatch)
  const pokemon: Record<string, ReturnType<typeof extractUnit>> = {}
  if (catalog) return runCatalog({ keys, outPath, provenance, profile })
  for (const key of keys) pokemon[key] = extractUnit(key, profile) // throws before anything is written

  const result = {
    note:
      "pokemon[*].identity is the unit; evolutionFamilyRoot is its family root; bareInstanceEvolution holds " +
      "raw bare-instance fields and is not a complete evolution map. `provenance` varies by environment; compare `pokemon` only." +
      (PROFILES[profile].absentFields.length
        ? ` Fields listed under fieldAvailability are ABSENT on this revision (not zero, not null). Snapshot: ${PROFILES[profile].label}.`
        : ""),
    provenance,
    pokemon
  }
  mkdirSync(dirname(outPath), { recursive: true })
  const tmp = `${outPath}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify(result, null, 2) + "\n")
  renameSync(tmp, outPath)
  console.log(`wrote ${outPath} (${keys.join(", ")}); node ${provenance.node}, npm ${provenance.npm}; gameSourceMatchesAudited=${provenance.gameSourceMatchesAudited}`)
}

function runCatalog(o: { keys: string[]; outPath: string; provenance: ReturnType<typeof collectProvenance>; profile: ProfileName }) {
  const { keys, outPath, provenance, profile } = o
  const enumKeys = Object.keys(Pkm)
  if (enumKeys.length !== keys.length || new Set(keys).size !== keys.length || !enumKeys.every((k) => (Pkm as any)[k] === k)) {
    fail("Pkm enum keys and values are not one-to-one identical; cannot use it as the identifier inventory")
  }
  const facts = registryFacts(keys)
  const pokemon: Record<string, ReturnType<typeof extractUnit>> = {}
  const registry: Record<string, ReturnType<ReturnType<typeof registryFacts>>> = {}
  const excluded: Record<string, { reason: string; source: string }> = {}
  const failed: Record<string, string> = {}
  for (const key of keys) {
    if (Object.hasOwn(CATALOG_EXCLUSIONS, key)) {
      excluded[key] = CATALOG_EXCLUSIONS[key]
      continue
    }
    try {
      if (!Object.hasOwn(PokemonClasses, key)) fail(`${key} is not registered in PokemonClasses (the factory would return the DEFAULT fallback)`)
      pokemon[key] = extractUnit(key, profile)
      registry[key] = facts(key)
    } catch (e: any) {
      failed[key] = String(e?.message ?? e)
    }
  }
  // every identifier must land in exactly one bucket
  const buckets = [Object.keys(pokemon), Object.keys(excluded), Object.keys(failed)]
  const seen = new Set(buckets.flat())
  if (buckets.flat().length !== keys.length || seen.size !== keys.length || !keys.every((k) => seen.has(k))) {
    fail("internal accounting error: extracted + excluded + failed does not partition the identifier inventory")
  }
  const counts = { inventory: keys.length, extracted: buckets[0].length, excluded: buckets[1].length, failed: buckets[2].length }
  if (counts.failed) {
    const diag = resolve(SCRIPT_DIR, "analysis", "catalog-failures.json")
    mkdirSync(dirname(diag), { recursive: true })
    writeFileSync(diag, JSON.stringify({ provenance, counts, failed }, null, 2) + "\n")
    fail(`${counts.failed} identifier(s) failed; catalog NOT written and NOT complete. Diagnostic: ${diag}`)
  }
  const result = {
    note:
      "Production-branch reference; deployment unverified. Complete identifier catalog of bare factory instances. " +
      "Identifiers are NOT proof of shop availability or playability (unverified). pokemon[*] records have the same shape as pilot-units.json; " +
      "registry[*] holds PokemonClasses facts (class name, other keys mapped to the same class). Fields under fieldAvailability are ABSENT on this revision. `provenance` varies by environment; compare `pokemon`/`inventory` only.",
    provenance,
    availabilityAndPlayability: "unverified",
    inventory: { source: "Object.values(Pkm) in app/types/enum/Pokemon.ts; registry: PokemonClasses in app/models/colyseus-models/pokemon.ts", counts, identifiers: keys, excluded },
    registry,
    pokemon
  }
  mkdirSync(dirname(outPath), { recursive: true })
  const tmp = `${outPath}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify(result, null, 2) + "\n")
  renameSync(tmp, outPath)
  console.log(`wrote ${outPath}: ${JSON.stringify(counts)}; node ${provenance.node}, npm ${provenance.npm}; gameSourceMatchesAudited=${provenance.gameSourceMatchesAudited}`)
}

try {
  main()
} catch (e) {
  if (e instanceof ExtractError) {
    console.error(`extract-baseline: ${e.message}`)
    process.exit(1)
  }
  throw e
}
