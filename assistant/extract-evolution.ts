// Extracts declared evolution data (evolutionRule shape + evolution fields) for a small set of Pokémon
// through the real PokemonFactory. Companion to extract-baseline.ts (same provenance/validation approach).
//
// Usage (inside a checkout that contains this file and installed node_modules):
//   node_modules/.bin/tsx assistant/extract-evolution.ts                          # pilot units -> assistant/data/01a3e845/pilot-evolution.json
//   node_modules/.bin/tsx assistant/extract-evolution.ts --out <file> KEY ...     # other units: --out mandatory
//   flags: --out <file> | --out=<file>   output path (relative paths resolve against the current directory)
//          --allow-source-mismatch      record, instead of failing on, game-source drift from the audited commit
//
// Default unit set = the keys of assistant/data/01a3e845/pilot-units.json (so both files cover the same units).
//
// What is and is not captured:
//  * Scalars, enums and arrays are preserved. Every known rule property is reported as {present: boolean, ...} so a
//    missing property is distinguishable from 0 / false / [].
//  * Function-valued rule properties (divergentEvolution, condition) are NEVER serialised as values: they become
//    {kind:"callback"} records with arity and a source path/symbol/line found by text search. Their presence does not
//    explain their behaviour; behaviour is documented separately by inspection (knowledge/pilot-evolution.md).
//  * `probes` call two callbacks (TYPE_NULL, PIKACHU) with stub arguments, only because their bodies were read and
//    use nothing but the passed item / player.regionalPokemons. They are labelled as probes, not runtime game behaviour.
//    Any probe exception, or a result that is not an actual Pkm identifier, fails the whole extraction.
//  * Output paths are checked before anything is written (output-guard.ts): game files, root config and the other
//    extractor's checkpoints are refused; own checkpoint reruns and scratch .json outputs are allowed.
//  * The inherited default rule (COUNT, numberRequired 3, from the base `Pokemon` class) is reported separately from
//    evidence that a unit can evolve (`evolutionEvidence`): a terminal unit keeps the inherited rule.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { EvolutionManager } from "../app/core/evolution-logic/evolution-manager"
import PokemonFactory from "../app/models/pokemon-factory"
import { EvolutionRuleType } from "../app/types/EvolutionRules"
import { SynergyGivenByItem } from "../app/types/enum/Item"
import { Pkm, PkmIndex } from "../app/types/enum/Pokemon"
import { checkOutputPath, OutputGuardError } from "./output-guard"

const AUDITED_SOURCE_COMMIT = "01a3e845e91ebe3144b3c43fa9cd261a5dadafd2"

const SCRIPT_DIR = dirname(resolve(process.argv[1]))
const REPO_ROOT = resolve(SCRIPT_DIR, "..")
const PILOT_UNITS_JSON = resolve(SCRIPT_DIR, "data", "01a3e845", "pilot-units.json")
const DEFAULT_OUT = resolve(SCRIPT_DIR, "data", "01a3e845", "pilot-evolution.json")
// Checkpoints this extractor may regenerate / that belong to extract-baseline.ts (see output-guard.ts).
const OWN_CHECKPOINTS = [DEFAULT_OUT]
const OTHER_CHECKPOINTS = [
  resolve(SCRIPT_DIR, "data", "baseline.json"),
  PILOT_UNITS_JSON,
  resolve(SCRIPT_DIR, "data", "07367c34", "catalog-units.json"),
  resolve(SCRIPT_DIR, "data", "07367c34", "pilot-units.json") // production-reference snapshot (extract-baseline.ts --profile production-reference)
]
const POKEMON_SOURCE = "app/models/colyseus-models/pokemon.ts"

// Every property any EvolutionRule variant may carry (app/types/EvolutionRules.ts).
const KNOWN_RULE_PROPS = [
  "type", "numberRequired", "itemsTriggeringEvolution", "moneyRequired", "condition", "divergentEvolution"
] as const
const HANDLER_FILES: Record<string, string> = {
  CountEvolutionHandler: "app/core/evolution-logic/count-evolution-handler.ts",
  ItemEvolutionHandler: "app/core/evolution-logic/item-evolution-handler.ts",
  StateEvolutionHandler: "app/core/evolution-logic/state-evolution-handler.ts",
  MoneyEvolutionHandler: "app/core/evolution-logic/money-evolution-handler.ts",
  PlacementEvolutionHandler: "app/core/evolution-logic/placement-evolution-handler.ts",
  HatchEvolutionHandler: "app/core/evolution-logic/hatch-evolution-handler.ts",
  StackEvolutionHandler: "app/core/evolution-logic/stack-evolution-handler.ts"
}

class ExtractError extends Error {}
function fail(msg: string): never {
  throw new ExtractError(msg)
}

// ---- provenance (mirrors extract-baseline.ts) -------------------------------------------------------------
function git(...args: string[]): string {
  try {
    return execFileSync("git", ["-C", REPO_ROOT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  } catch (e: any) {
    return fail(`git ${args.join(" ")} failed: ${String(e.stderr ?? e.message).trim()}`)
  }
}
const lines = (s: string) => (s ? s.split("\n") : [])

function collectProvenance(allowMismatch: boolean) {
  const checkoutCommit = git("rev-parse", "HEAD")
  try {
    execFileSync("git", ["-C", REPO_ROOT, "cat-file", "-e", `${AUDITED_SOURCE_COMMIT}^{commit}`], { stdio: "ignore" })
  } catch {
    fail(`audited commit ${AUDITED_SOURCE_COMMIT} is not available in this repository (shallow clone?)`)
  }
  const notAssistant = ["--", ".", ":(exclude)assistant"]
  const differingTrackedFiles = lines(git("diff", "--name-only", AUDITED_SOURCE_COMMIT, ...notAssistant))
  const untrackedOutsideAssistant = lines(git("ls-files", "--others", "--exclude-standard", ...notAssistant))
  const dirtyOutsideAssistant = lines(git("status", "--porcelain", ...notAssistant))
  const gameSourceMatchesAudited = differingTrackedFiles.length === 0 && untrackedOutsideAssistant.length === 0
  if (!gameSourceMatchesAudited && !allowMismatch) {
    fail(
      `game source differs from audited commit ${AUDITED_SOURCE_COMMIT}: ${differingTrackedFiles.length} tracked file(s) differ ` +
        `(${differingTrackedFiles.slice(0, 5).join(", ")}), ${untrackedOutsideAssistant.length} untracked outside assistant/. ` +
        `Use --allow-source-mismatch to record instead.`
    )
  }
  let npm = "unavailable"
  try {
    npm = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim()
  } catch {}
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
    npm,
    platform: `${process.platform}-${process.arch}`
  }
}

// ---- args ----------------------------------------------------------------------------------------------
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
    } else if (a === "--allow-source-mismatch") allowMismatch = true
    else if (a.startsWith("--")) fail(`unknown option ${a}`)
    else keys.push(a)
  }
  return { keys, out, allowMismatch }
}

// ---- source lookup for callbacks (plain text search; not a parser) --------------------------------------------
let pokemonSourceLines: string[] | undefined
function locateCallback(className: string, prop: string) {
  pokemonSourceLines ??= readFileSync(resolve(REPO_ROOT, POKEMON_SOURCE), "utf8").split("\n")
  const L = pokemonSourceLines
  const start = L.findIndex((l) => l.startsWith(`export class ${className} extends`))
  if (start < 0) return { file: POKEMON_SOURCE, symbol: `${className}.evolutionRule.${prop}`, line: null, lookup: "class-not-found" }
  let end = start
  while (end < L.length && !L[end].startsWith("}")) end++
  for (let i = start; i <= end; i++) {
    if (new RegExp(`^\\s*${prop}\\s*[:=(]`).test(L[i])) {
      return { file: POKEMON_SOURCE, symbol: `${className}.evolutionRule.${prop}`, line: i + 1, lookup: "text-search-in-class-body" }
    }
  }
  return { file: POKEMON_SOURCE, symbol: `${className}.evolutionRule.${prop}`, line: null, lookup: "property-not-found-in-class-body" }
}

// ---- helpers -----------------------------------------------------------------------------------------------
function assertJsonSafe(path: string, v: unknown) {
  if (v === undefined) fail(`${path} is undefined (would be silently dropped by JSON)`)
  if (typeof v === "function") fail(`${path} is a function (would be silently dropped by JSON)`)
  if (typeof v === "number" && !Number.isFinite(v)) fail(`${path} is a non-finite number`)
  if (Array.isArray(v)) v.forEach((x, i) => assertJsonSafe(`${path}[${i}]`, x))
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) assertJsonSafe(`${path}.${k}`, x)
}
const isPkmValue = (v: unknown): v is Pkm => typeof v === "string" && Object.values(Pkm).includes(v as Pkm)

function sameRule(a: any, b: any) {
  const ka = Object.keys(a).sort()
  const kb = Object.keys(b).sort()
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && typeof a[k] !== "function" && JSON.stringify(a[k]) === JSON.stringify(b[k]))
}

function extractUnit(key: string, baseDefaultRule: any) {
  if (!Object.hasOwn(Pkm, key)) fail(`unknown Pkm key "${key}"`)
  const name = Pkm[key as keyof typeof Pkm]
  const p: any = PokemonFactory.createPokemonFromName(name)
  if (p.name !== name) fail(`${key}: unexpected identity, factory returned name "${p.name}" (expected "${name}")`)
  if (p.index !== PkmIndex[name]) fail(`${key}: unexpected index "${p.index}" (expected "${PkmIndex[name]}")`)

  // declared evolution fields
  if (!isPkmValue(p.evolution)) fail(`${key}.evolution must be a Pkm value, got ${String(p.evolution)}`)
  if (!Array.isArray(p.evolutions) || !p.evolutions.every(isPkmValue)) fail(`${key}.evolutions must be an array of Pkm values`)
  if (typeof p.stacksRequired !== "number" || !Number.isFinite(p.stacksRequired)) fail(`${key}.stacksRequired must be a finite number`)
  if (typeof p.hasEvolution !== "boolean") fail(`${key}.hasEvolution must be a boolean`)

  // rule
  const rule = p.evolutionRule
  if (!rule || typeof rule !== "object") fail(`${key}.evolutionRule missing`)
  if (!Object.values(EvolutionRuleType).includes(rule.type)) fail(`${key}.evolutionRule.type invalid: ${String(rule.type)}`)
  const className: string = p.constructor.name
  const properties: Record<string, unknown> = {}
  for (const prop of KNOWN_RULE_PROPS) {
    if (!Object.hasOwn(rule, prop)) {
      properties[prop] = { present: false }
      continue
    }
    const v = rule[prop]
    if (typeof v === "function") {
      properties[prop] = { present: true, kind: "callback", arity: v.length, source: locateCallback(className, prop) }
    } else {
      properties[prop] = { present: true, kind: Array.isArray(v) ? "array" : typeof v, value: v }
    }
  }
  const extraOwnKeys = Object.keys(rule).filter((k) => !(KNOWN_RULE_PROPS as readonly string[]).includes(k))
  if (extraOwnKeys.length) fail(`${key}.evolutionRule has unexpected properties: ${extraOwnKeys.join(", ")}`)

  // type-specific required properties
  const prop = (n: string) => properties[n] as any
  switch (rule.type) {
    case EvolutionRuleType.COUNT:
      if (!(prop("numberRequired").present && Number.isFinite(rule.numberRequired) && rule.numberRequired >= 1))
        fail(`${key}: COUNT rule needs finite numberRequired >= 1`)
      break
    case EvolutionRuleType.ITEM:
      if (!(Array.isArray(rule.itemsTriggeringEvolution) && rule.itemsTriggeringEvolution.every((i: unknown) => typeof i === "string")))
        fail(`${key}: ITEM rule needs itemsTriggeringEvolution array of strings`)
      break
    case EvolutionRuleType.MONEY:
      if (!Number.isFinite(rule.moneyRequired)) fail(`${key}: MONEY rule needs finite moneyRequired`)
      break
    case EvolutionRuleType.STATE:
    case EvolutionRuleType.PLACEMENT:
      if (typeof rule.condition !== "function") fail(`${key}: ${rule.type} rule needs a condition callback`)
      break
    case EvolutionRuleType.STACK:
      if (!(p.stacksRequired > 0)) fail(`${key}: STACK rule needs stacksRequired > 0`)
      break
    default:
      break // HATCH: no extra properties required by the type definition
  }
  if (Object.hasOwn(rule, "divergentEvolution") && typeof rule.divergentEvolution !== "function")
    fail(`${key}.evolutionRule.divergentEvolution must be a function when present`)

  const handlerClass: string = EvolutionManager.getHandler(rule).constructor.name
  if (!Object.hasOwn(HANDLER_FILES, handlerClass)) fail(`${key}: unexpected handler class ${handlerClass}`)
  for (const f of Object.values(HANDLER_FILES)) if (!existsSync(resolve(REPO_ROOT, f))) fail(`handler file missing: ${f}`)

  const ruleIsInheritedDefault = sameRule(rule, baseDefaultRule)
  const declaresEvolution = p.evolution !== Pkm.DEFAULT || p.evolutions.length > 0
  if (declaresEvolution !== p.hasEvolution) fail(`${key}: hasEvolution getter (${p.hasEvolution}) disagrees with declared fields`)

  return {
    identity: { key, name: p.name as string, index: p.index as string },
    declaredEvolution: {
      evolution: p.evolution as string, // "DEFAULT" means none declared in the class
      evolutions: [...p.evolutions] as string[],
      stacksRequired: p.stacksRequired as number
    },
    evolutionRule: {
      type: rule.type as string,
      handler: { class: handlerClass, file: HANDLER_FILES[handlerClass] },
      properties,
      // true when the rule is structurally equal to the base `Pokemon` default (COUNT, numberRequired 3, no callbacks).
      // A class could redeclare an identical rule; that is not distinguishable at runtime.
      matchesInheritedBaseDefault: ruleIsInheritedDefault
    },
    // Separate from the rule: does the class declare anything that says the unit can evolve?
    evolutionEvidence: {
      hasEvolutionGetter: p.hasEvolution as boolean,
      declaresEvolutionTarget: p.evolution !== Pkm.DEFAULT,
      declaresEvolutionsArray: p.evolutions.length > 0,
      status: declaresEvolution
        ? "declares-evolution"
        : "no-declared-evolution (any rule present is inherited/unused: not evidence of evolution)"
    },
    _rule: rule // stripped before writing; used for probes
  }
}

// Probes: callbacks invoked with stub arguments (bodies were read and use only these inputs). A probe shows what the
// callback returns for the stub input; it is NOT full gameplay behaviour. Any exception, or a result that is not an actual
// Pkm identifier, fails the whole extraction. A requested unit whose callback is missing also fails (the probe's assumption broke).
function runProbes(units: Record<string, ReturnType<typeof extractUnit>>) {
  const probes: Record<string, unknown> = {}
  const call = (label: string, fn: any, ...args: unknown[]): Pkm => {
    let result: unknown
    try {
      result = fn(...args)
    } catch (e: any) {
      fail(`probe ${label} threw: ${String(e?.message ?? e)}`)
    }
    if (!isPkmValue(result)) fail(`probe ${label} returned ${JSON.stringify(result)}, which is not a Pkm identifier`)
    return result
  }
  const tn = units.TYPE_NULL?._rule
  if (units.TYPE_NULL) {
    if (!tn?.divergentEvolution || !Array.isArray(tn.itemsTriggeringEvolution)) {
      fail("probe TYPE_NULL: expected an ITEM rule with itemsTriggeringEvolution and a divergentEvolution callback")
    }
    probes.TYPE_NULL = {
      kind: "divergentEvolution called once per item in itemsTriggeringEvolution, stub pokemon/player ({})",
      itemCount: tn.itemsTriggeringEvolution.length,
      itemToVariant: tn.itemsTriggeringEvolution.map((item: string) => ({
        item,
        synergyGivenByItem: Object.hasOwn(SynergyGivenByItem, item) ? (SynergyGivenByItem as any)[item] : null,
        ok: true,
        result: call(`TYPE_NULL item ${item}`, tn.divergentEvolution, {}, {}, item)
      }))
    }
  }
  const pk = units.PIKACHU?._rule
  if (units.PIKACHU) {
    if (!pk?.divergentEvolution) fail("probe PIKACHU: expected a divergentEvolution callback")
    probes.PIKACHU = {
      kind: "divergentEvolution called with stub player objects differing only in regionalPokemons",
      withoutAlolanRaichuInRegionalPokemons: {
        ok: true,
        result: call("PIKACHU (regionalPokemons: [])", pk.divergentEvolution, {}, { regionalPokemons: [] })
      },
      withAlolanRaichuInRegionalPokemons: {
        ok: true,
        result: call("PIKACHU (regionalPokemons: [ALOLAN_RAICHU])", pk.divergentEvolution, {}, { regionalPokemons: [Pkm.ALOLAN_RAICHU] })
      }
    }
  }
  return probes
}

function main() {
  const { keys: argKeys, out, allowMismatch } = parseArgs(process.argv.slice(2))
  let keys = argKeys
  if (!keys.length) {
    if (!existsSync(PILOT_UNITS_JSON)) fail(`default unit set needs ${PILOT_UNITS_JSON}`)
    keys = Object.keys(JSON.parse(readFileSync(PILOT_UNITS_JSON, "utf8")).pokemon)
  }
  if (new Set(keys).size !== keys.length) fail(`duplicate keys requested: ${keys.join(", ")}`)
  const outPath = out ? resolve(process.cwd(), out) : DEFAULT_OUT
  if (argKeys.length && outPath === DEFAULT_OUT) fail(`refusing to write an explicit unit list to the default output ${DEFAULT_OUT}; pass --out <other file>`)

  // Output checks come first: nothing is extracted, created or written if the target is not acceptable.
  try {
    checkOutputPath({ outPath, repoRoot: REPO_ROOT, ownCheckpoints: OWN_CHECKPOINTS, otherCheckpoints: OTHER_CHECKPOINTS })
  } catch (e) {
    if (e instanceof OutputGuardError) fail(e.message)
    throw e
  }

  const provenance = collectProvenance(allowMismatch)
  const baseDefaultRule = PokemonFactory.createPokemonFromName(Pkm.DEFAULT).evolutionRule
  const raw: Record<string, ReturnType<typeof extractUnit>> = {}
  for (const key of keys) raw[key] = extractUnit(key, baseDefaultRule)
  const probes = runProbes(raw)

  const units: Record<string, unknown> = {}
  for (const [k, u] of Object.entries(raw)) {
    const { _rule, ...rest } = u
    units[k] = rest
  }
  const result = {
    note:
      "Declared data read from bare factory instances at the audited commit. Callback properties are recorded as presence + " +
      "source reference only; their behaviour is NOT captured here. `probes` are stub-argument calls, not game behaviour. " +
      "Inherited default rules are not evidence that a unit can evolve (see evolutionEvidence). `provenance` varies by environment; compare `units` and `probes` only.",
    provenance,
    baseDefaultRule: {
      type: baseDefaultRule.type,
      properties: Object.fromEntries(KNOWN_RULE_PROPS.map((p) => [p, Object.hasOwn(baseDefaultRule, p) ? { present: true, value: (baseDefaultRule as any)[p] } : { present: false }])),
      source: `${POKEMON_SOURCE} class Pokemon, field evolutionRule`
    },
    units,
    probes
  }
  assertJsonSafe("result", result)
  mkdirSync(dirname(outPath), { recursive: true })
  const tmp = `${outPath}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify(result, null, 2) + "\n")
  renameSync(tmp, outPath)
  console.log(`wrote ${relative(process.cwd(), outPath) || outPath} (${keys.length} units); node ${provenance.node}, npm ${provenance.npm}; gameSourceMatchesAudited=${provenance.gameSourceMatchesAudited}`)
}

try {
  main()
} catch (e) {
  if (e instanceof ExtractError) {
    console.error(`extract-evolution: ${e.message}`)
    process.exit(1)
  }
  throw e
}
