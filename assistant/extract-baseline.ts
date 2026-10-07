// Extracts baseline data for a small set of Pokémon through the real PokemonFactory.
// Run from the worktree root: node_modules/.bin/tsx assistant/extract-baseline.ts [PKM_KEY ...]
import { writeFileSync } from "node:fs"
import { execSync } from "node:child_process"
import PokemonFactory, { getPokemonBaseline } from "../app/models/pokemon-factory"
import { Pkm } from "../app/types/enum/Pokemon"

const DEFAULTS = ["CHARMANDER", "FARFETCH_D", "VESPIQUEN"]
const keys = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS

const FIELDS = [
  "name", "index", "rarity", "stars", "evolution", "hp", "maxHP", "atk", "def",
  "speDef", "speed", "range", "maxPP", "ap", "luck", "critChance", "critPower",
  "skill", "tm", "passive", "additional", "regional", "canHoldItems",
  "canBeBenched", "canBeSold", "baseSkill", "baseMaxPP", "baseAtk"
] as const

const out: Record<string, unknown> = {}
for (const key of keys) {
  const name = (Pkm as Record<string, Pkm>)[key]
  if (!name) throw new Error(`Unknown Pkm key: ${key}`)
  const p: any = PokemonFactory.createPokemonFromName(name)
  const rec: Record<string, unknown> = { key }
  for (const f of FIELDS) rec[f] = p[f]
  rec.types = [...p.types]
  rec.evolutions = [...(p.evolutions ?? [])]
  rec.baseline = getPokemonBaseline(name)
  out[key] = rec
}

const commit = execSync("git rev-parse HEAD").toString().trim()
const result = { sourceCommit: commit, node: process.version, pokemon: out }
writeFileSync("assistant/data/baseline.json", JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result, null, 2))
