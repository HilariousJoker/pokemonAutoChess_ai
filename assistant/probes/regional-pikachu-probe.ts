// Probe: for every map, does ALOLAN_RAICHU end up in Player.regionalPokemons, and which branch does PIKACHU's real
// divergentEvolution callback then take? Production-branch reference; deployment unverified (pinned 07367c34).
//
// Runs the REAL `Player.prototype.updateRegionalPool` (mapChanged = false, so no shop is touched) and the REAL
// PokemonFactory Pikachu `divergentEvolution`. STUBS: `this` is a plain object {map, regionalPokemons: ArraySchema} instead of a
// constructed Player; `state` is {additionalPokemons: [], stageLevel: 0}. Establishes only the pure function of map -> list;
// it does NOT establish how `player.map` is chosen in a game, nor shop/pool effects (mapChanged = true path).
// Usage (inside a checkout of the pinned SHA with node_modules): node_modules/.bin/tsx assistant/probes/regional-pikachu-probe.ts --out <file.json>
import { ArraySchema } from "@colyseus/schema"
import { writeFileSync } from "node:fs"
import { RegionDetails } from "../../app/config/maps/regions"
import Player from "../../app/models/colyseus-models/player"
import PokemonFactory from "../../app/models/pokemon-factory"
import { Pkm } from "../../app/types/enum/Pokemon"

const out = process.argv[process.argv.indexOf("--out") + 1]
if (!out || out.startsWith("--")) throw new Error("--out <file.json> required")
const pikachu: any = PokemonFactory.createPokemonFromName(Pkm.PIKACHU)
const rows: any[] = []
for (const map of Object.keys(RegionDetails)) {
  const fake: any = { map, regionalPokemons: new ArraySchema<Pkm>() }
  ;(Player.prototype as any).updateRegionalPool.call(fake, { additionalPokemons: [], stageLevel: 0, specialGameRule: null }, false)
  const list = [...fake.regionalPokemons] as string[]
  const has = list.includes(Pkm.ALOLAN_RAICHU)
  const synergies = RegionDetails[map as keyof typeof RegionDetails].synergies
  rows.push({
    map, synergies, regionalCount: list.length, alolanRaichuInRegionalPokemons: has,
    pikachuEvolvesInto: pikachu.evolutionRule.divergentEvolution({}, { regionalPokemons: list })
  })
}
const alolan = rows.filter((r) => r.alolanRaichuInRegionalPokemons).map((r) => r.map)
const psychic = rows.filter((r) => r.synergies.includes("PSYCHIC")).map((r) => r.map)
const result = {
  label: "production-branch reference; deployment unverified", sourceSha: "07367c341fe928763da2b565c2eee010433e4fc1",
  stubs: "this={map,regionalPokemons}; state={additionalPokemons:[],stageLevel:0,specialGameRule:null}; mapChanged=false",
  mapsChecked: rows.length, mapsWithAlolanRaichu: alolan, mapsWithPsychicSynergy: psychic,
  setsEqual: JSON.stringify(alolan.sort()) === JSON.stringify(psychic.sort()),
  townRow: (() => { const f: any = { map: "town", regionalPokemons: new ArraySchema<Pkm>([Pkm.ALOLAN_RAICHU]) }
    ;(Player.prototype as any).updateRegionalPool.call(f, { additionalPokemons: [], stageLevel: 0 }, false); return [...f.regionalPokemons] })(),
  rows: rows.map(({ map, regionalCount, alolanRaichuInRegionalPokemons, pikachuEvolvesInto }) => ({ map, regionalCount, alolanRaichuInRegionalPokemons, pikachuEvolvesInto }))
}
writeFileSync(out, JSON.stringify(result, null, 2) + "\n")
console.log(`maps=${rows.length} withAlolanRaichu=${alolan.length} psychicMaps=${psychic.length} setsEqual=${result.setsEqual} townList=${JSON.stringify(result.townRow)}`)
