// Extracts baseline data for a small set of Pokémon through the real PokemonFactory.
//
// Usage (from any directory, inside a checkout that contains this file and installed node_modules):
//   node_modules/.bin/tsx assistant/extract-baseline.ts                       # default 3 units -> assistant/data/baseline.json
//   node_modules/.bin/tsx assistant/extract-baseline.ts --out <file> KEY ...  # any units, explicit output
//   flags: --out <file> | --out=<file>   output path (relative paths resolve against the current directory)
//          --allow-source-mismatch      record, instead of failing on, game-source drift from the audited commit
//
// Alternate unit sets MUST pass --out; they never write to the default checkpoint path.
import { execFileSync } from "node:child_process"
import { mkdirSync, renameSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import PokemonFactory, { getPokemonBaseline } from "../app/models/pokemon-factory"
import { Pkm, PkmIndex } from "../app/types/enum/Pokemon"

const AUDITED_SOURCE_COMMIT = "01a3e845e91ebe3144b3c43fa9cd261a5dadafd2"
const DEFAULT_KEYS = ["CHARMANDER", "FARFETCH_D", "VESPIQUEN"]

const SCRIPT_DIR = dirname(resolve(process.argv[1]))
const REPO_ROOT = resolve(SCRIPT_DIR, "..")
const DEFAULT_OUT = resolve(SCRIPT_DIR, "data", "baseline.json")

const NUMERIC_FIELDS = [
  "stars", "hp", "maxHP", "atk", "def", "speDef", "speed", "range", "maxPP",
  "ap", "luck", "critChance", "critPower", "baseMaxPP", "baseAtk"
] as const
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
function collectProvenance(allowMismatch: boolean) {
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
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--out") {
      const v = argv[++i]
      if (!v || v.startsWith("--")) fail("--out requires a file path")
      out = v
    } else if (a.startsWith("--out=")) {
      out = a.slice("--out=".length)
      if (!out) fail("--out requires a file path")
    } else if (a === "--allow-source-mismatch") {
      allowMismatch = true
    } else if (a.startsWith("--")) {
      fail(`unknown option ${a}`)
    } else {
      keys.push(a)
    }
  }
  return { keys, out, allowMismatch }
}

function checkFinite(key: string, field: string, v: unknown) {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    fail(`${key}.${field} must be a finite number, got ${String(v)}`)
  }
}

function extractUnit(key: string) {
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
  for (const f of NUMERIC_FIELDS) {
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
  if (!p.types || typeof p.types[Symbol.iterator] !== "function") fail(`${key}.types missing`)
  const types = [...p.types]
  if (types.some((t) => typeof t !== "string")) fail(`${key}.types contains a non-string`)
  if (typeof p.evolution !== "string") fail(`${key}.evolution must be a string`)
  if (!Array.isArray(p.evolutions)) fail(`${key}.evolutions must be an array`)

  const evolutionFamilyRoot = getPokemonBaseline(name)
  if (typeof evolutionFamilyRoot !== "string" || !Object.hasOwn(Pkm, evolutionFamilyRoot)) {
    fail(`${key}: getPokemonBaseline returned unknown value ${String(evolutionFamilyRoot)}`)
  }

  return {
    // who this unit is — the key used for lookup, as returned by the factory
    identity: { key, name: p.name as string, index: p.index as string },
    // root of the unit's evolution family (getPokemonBaseline). NOT the unit's identity.
    evolutionFamilyRoot: evolutionFamilyRoot as string,
    // raw fields of a bare factory instance. NOT a complete evolution map: `evolution` is only the
    // next stage set by the class, and `evolutions` is populated elsewhere (empty on a bare instance).
    bareInstanceEvolution: { evolution: p.evolution as string, evolutions: [...p.evolutions] as string[] },
    types,
    stats
  }
}

function main() {
  const { keys: argKeys, out, allowMismatch } = parseArgs(process.argv.slice(2))
  const keys = argKeys.length ? argKeys : DEFAULT_KEYS
  if (new Set(keys).size !== keys.length) fail(`duplicate keys requested: ${keys.join(", ")}`)

  const isDefaultSet = keys.length === DEFAULT_KEYS.length && DEFAULT_KEYS.every((k) => keys.includes(k))
  const outPath = out ? resolve(process.cwd(), out) : DEFAULT_OUT
  if (!isDefaultSet && outPath === DEFAULT_OUT) {
    fail(`refusing to write non-default unit set to the default checkpoint ${DEFAULT_OUT}; pass --out <other file>`)
  }

  const provenance = collectProvenance(allowMismatch)
  const pokemon: Record<string, ReturnType<typeof extractUnit>> = {}
  for (const key of keys) pokemon[key] = extractUnit(key) // throws before anything is written

  const result = {
    note:
      "pokemon[*].identity is the unit; evolutionFamilyRoot is its family root; bareInstanceEvolution holds " +
      "raw bare-instance fields and is not a complete evolution map. `provenance` varies by environment; compare `pokemon` only.",
    provenance,
    pokemon
  }
  mkdirSync(dirname(outPath), { recursive: true })
  const tmp = `${outPath}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify(result, null, 2) + "\n")
  renameSync(tmp, outPath)
  console.log(`wrote ${outPath} (${keys.join(", ")}); node ${provenance.node}, npm ${provenance.npm}; gameSourceMatchesAudited=${provenance.gameSourceMatchesAudited}`)
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
