// Probe: Cosmog -> Cosmoem through the REAL EvolutionManager.afterEvolve / StackEvolutionHandler /
// Player.prototype.transformPokemon / Cosmoem.onAcquired, on a REAL @colyseus/schema MapSchema.
// Production-branch reference; deployment unverified (pinned 07367c34).
//
// STUBS (nothing else): the player is a plain object {board: MapSchema, pokemonsPlayed: Set, updateSynergies(){} no-op} that
// borrows the real Player.prototype.transformPokemon. No server, no Room, no Simulation, no items, no shop.
// The "evolution triggers" are real calls of EvolutionManager.afterEvolve(evolvedUnit, ...) with a real CHARMELEON instance as the
// evolved unit (passive NONE, not on the board, so its own tryEvolve is a no-op); each call is exactly the +10 maxHP / +1 stack tick
// that a Cosmog on the player's board receives when some other unit evolves.
// A spy wraps Cosmoem.prototype.onAcquired (calls the original unchanged) to record values before/after it, and wraps
// Pokemon.prototype.addMaxHP to log which units the afterEvolve loop touched.
// Establishes: loop visiting behaviour, bench vs deployed eligibility, HP/maxHP/stacks at three points, for a no-item case.
// Does NOT establish: item effects, other acquisition paths, synergy effects (updateSynergies is a no-op), live-game behaviour.
// Usage (inside a checkout of the pinned SHA with node_modules): node_modules/.bin/tsx assistant/probes/cosmog-evolution-probe.ts --out <file.json>
// (--out is required; the checkout's game source must equal the pinned SHA; see probe-guard.ts)
import { MapSchema } from "@colyseus/schema"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { probeStartup } from "./probe-guard"
import { EvolutionManager } from "../../app/core/evolution-logic/evolution-manager"
import { Pokemon, Cosmoem } from "../../app/models/colyseus-models/pokemon"
import Player from "../../app/models/colyseus-models/player"
import PokemonFactory from "../../app/models/pokemon-factory"
import { Pkm } from "../../app/types/enum/Pokemon"

const out = probeStartup(resolve(__dirname, "results", "cosmog-evolution-probe.json")) // strict args + pinned-source check + output guard, before any scenario

const snap = (p: any) => (p ? { name: p.name, hp: p.hp, maxHP: p.maxHP, stacks: p.stacks, positionX: p.positionX, positionY: p.positionY } : null)
const log: any[] = []
const origOnAcquired = Cosmoem.prototype.onAcquired
Cosmoem.prototype.onAcquired = function (this: any, player: any) {
  const before = snap(this)
  origOnAcquired.call(this, player)
  log.push({ event: "Cosmoem.onAcquired", before, after: snap(this) })
}
const origAddMaxHP = Pokemon.prototype.addMaxHP
Pokemon.prototype.addMaxHP = function (this: any, amount: number) {
  origAddMaxHP.call(this, amount)
  if (amount === 10 && (this.name === Pkm.COSMOG || this.name === Pkm.COSMOEM)) log.push({ event: "addMaxHP(10) by afterEvolve loop", on: this.name, positionY: this.positionY })
}

function scenario(label: string, cosmogPositionY: number, triggers: number) {
  log.length = 0
  const board = new MapSchema<Pokemon>()
  const player: any = { board, pokemonsPlayed: new Set<string>(), updateSynergies() {}, transformPokemon(this: any, pokemon: any, name: Pkm) {
      log.push({ event: "transformPokemon called", pokemonBefore: snap(pokemon), into: name }) // spy; delegates to the real method
      return (Player.prototype as any).transformPokemon.call(this, pokemon, name)
    } }
  const cosmog = PokemonFactory.createPokemonFromName(Pkm.COSMOG, player)
  cosmog.positionX = 2
  cosmog.positionY = cosmogPositionY
  board.set(cosmog.id, cosmog)
  const before = snap(cosmog)
  const evolved = PokemonFactory.createPokemonFromName(Pkm.CHARMELEON, player) // stand-in "evolved unit" (passive NONE)
  const beforeEvolution = PokemonFactory.createPokemonFromName(Pkm.CHARMANDER, player)
  const perTrigger: any[] = []
  for (let i = 1; i <= triggers; i++) {
    EvolutionManager.afterEvolve(evolved, beforeEvolution, player)
    const units = [...board.values()].map((p: any) => snap(p))
    perTrigger.push({ trigger: i, units })
  }
  const final = [...board.values()].map((p: any) => snap(p))
  return {
    label, cosmogPositionY, triggers, beforeTransformation: before,
    boardAfterAllTriggers: final, boardSize: board.size, cosmogStillOnBoard: final.some((u) => u.name === Pkm.COSMOG),
    immediatelyBeforeTransformation: log.find((l) => l.event === "transformPokemon called")?.pokemonBefore ?? null,
    cosmoemOnAcquired: log.find((l) => l.event === "Cosmoem.onAcquired") ?? null,
    addMaxHPLog: log.filter((l) => l.event.startsWith("addMaxHP")),
    lastTwoTriggers: perTrigger.slice(-2)
  }
}

const result = {
  label: "production-branch reference; deployment unverified", sourceSha: "07367c341fe928763da2b565c2eee010433e4fc1",
  stubs: "player = {board: real MapSchema, pokemonsPlayed: Set, updateSynergies: no-op, transformPokemon: spy delegating to real Player.prototype.transformPokemon}; evolved unit = real CHARMELEON; spies wrap Cosmoem.onAcquired and Pokemon.addMaxHP (delegating)",
  mapSchemaForEach: (() => { // does the real MapSchema.forEach visit an entry inserted while iterating (after deleting the current one)?
    const m = new MapSchema<Pokemon>()
    const a = PokemonFactory.createPokemonFromName(Pkm.COSMOG), b = PokemonFactory.createPokemonFromName(Pkm.CHARMANDER)
    m.set(a.id, a); m.set(b.id, b)
    const visited: string[] = []
    m.forEach((p) => { visited.push(p.name); if (p.name === Pkm.COSMOG) { m.delete(p.id); m.set("late", PokemonFactory.createPokemonFromName(Pkm.COSMOEM)) } })
    return { visited }
  })(),
  deployed: scenario("Cosmog deployed (positionY 1), 8 triggers", 1, 8),
  bench: scenario("Cosmog on bench (positionY 0), 8 triggers", 0, 8),
  sevenTriggersControl: scenario("Cosmog deployed, 7 triggers (control: must not evolve)", 1, 7),
  benchPositionOfBoardMembership: "positionY === 0 is the bench (app/utils/board.ts isOnBench); bench units are members of player.board"
}
writeFileSync(out, JSON.stringify(result, null, 2) + "\n")
const d = result.deployed
console.log(JSON.stringify({ mapForEachVisited: result.mapSchemaForEach.visited, deployed: { before: d.beforeTransformation, onAcquired: d.cosmoemOnAcquired, final: d.boardAfterAllTriggers },
  bench: { final: result.bench.boardAfterAllTriggers }, control7: result.sevenTriggersControl.boardAfterAllTriggers }, null, 1))
