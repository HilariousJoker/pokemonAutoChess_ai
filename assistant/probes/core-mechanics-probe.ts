// Probe for knowledge/07367c34/core-mechanics.md (production-branch reference; deployment unverified, pinned 07367c34).
// REAL code executed: PokemonState.handleDamage (damage reduction), PokemonEntity.resetCooldown / getAttackTimings / getMoveSpeed (speed conversion),
// computeSynergies + Effects.update (deployed vs bench, family dedup, Dragon doubling, item-granted type), Cosmoem's divergentEvolution callback.
// STUBS: the damage target is a plain object (no statuses/items/effects/shield; hp 100) with a Proxy-free minimal surface and attacker = null; speed checks call
// the real methods on {speed, status} objects; synergy/callback checks use real Pokemon instances from PokemonFactory and plain-object players.
// NOT executed: full fights, item/status modifiers on damage, movement, anything needing a Simulation.
// Usage (inside a checkout of the pinned SHA with node_modules): node_modules/.bin/tsx assistant/probes/core-mechanics-probe.ts --out <file.json>
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { getAttackTimings } from "../../app/core/attacking-state"
import { getMoveSpeed } from "../../app/core/move-speed"
import { PokemonEntity } from "../../app/core/pokemon-entity"
import { IdleState } from "../../app/core/idle-state"
import { Effects } from "../../app/models/effects"
import { computeSynergies } from "../../app/models/colyseus-models/synergies"
import PokemonFactory from "../../app/models/pokemon-factory"
import { AttackType } from "../../app/types/enum/Game"
import { Item } from "../../app/types/enum/Item"
import { Pkm } from "../../app/types/enum/Pokemon"
import { Synergy } from "../../app/types/enum/Synergy"
import { probeStartup } from "./probe-guard"

const out = probeStartup(resolve(__dirname, "results", "core-mechanics-probe.json"))

// ---- A. damage reduction through the real handleDamage ---------------------------------------------------------------------------
const noStatus = new Proxy({}, { get: () => false, set: () => true })
const none = { has: () => false, add() {}, delete() {} }
function mkTarget(over: Record<string, unknown> = {}): any {
  return {
    hp: 1000, maxHP: 1000, shield: 0, def: 10, speDef: 20, passive: "NONE", id: "t", index: "0001", status: noStatus, items: none, effects: none,
    count: new Proxy({}, { get: (t: any, k) => t[k] ?? 0, set: (t: any, k, v) => ((t[k] = v), true) }), physicalDamageReduced: 0, specialDamageReduced: 0, shieldDamageTaken: 0,
    simulation: { weather: "NEUTRAL", room: { state: { time: 1e9 } }, broadcastToSpectators() {} }, player: undefined, pp: 0, maxPP: 100,
    addPP() {}, getEffects: () => [], hasSynergyEffect: () => false, addShield() {}, onDamageReceived() {}, ...over
  }
}
function hit(attackType: AttackType, damage: number, over: Record<string, unknown> = {}) {
  const t = mkTarget(over)
  const r = new IdleState().handleDamage({ target: t, damage, board: {} as any, attackType, attacker: null, shouldTargetGainMana: false })
  return { attackType: AttackType[attackType], incoming: damage, targetDef: t.def, targetSpeDef: t.speDef, hpLost: 1000 - t.hp, takenDamage: r.takenDamage, death: r.death }
}
let damageChecks: any
try {
  damageChecks = {
    ok: true,
    cases: [hit(AttackType.PHYSICAL, 30), hit(AttackType.SPECIAL, 30), hit(AttackType.TRUE, 30), hit(AttackType.PHYSICAL, 1, { def: 100 }), hit(AttackType.PHYSICAL, 30, { def: 0 }), hit(AttackType.PHYSICAL, 30, { shield: 10 })],
    shieldCase: (() => { const t = mkTarget({ shield: 10 }); const r = new IdleState().handleDamage({ target: t, damage: 30, board: {} as any, attackType: AttackType.PHYSICAL, attacker: null, shouldTargetGainMana: false }); return { shieldBefore: 10, shieldAfter: t.shield, hpLost: 1000 - t.hp, takenDamage: r.takenDamage } })()
  }
} catch (e: any) { damageChecks = { ok: false, error: String(e?.message ?? e) } }

// ---- C. speed -> timing (real methods) -------------------------------------------------------------------------------------------
const cooldown = (speed: number) => (PokemonEntity.prototype as any).resetCooldown.call({ speed, cooldown: 0 }, 1000)
const cd = (speed: number) => { const o: any = { speed, cooldown: 0 }; (PokemonEntity.prototype as any).resetCooldown.call(o, 1000); return o.cooldown }
const timing = (speed: number) => getAttackTimings({ speed, status: { paralysis: false }, index: "0001", targetX: 0, targetY: 0, positionX: 1, positionY: 0 } as any)
const speedChecks = [0, 50, 100, 200, 300].map((s) => ({ speed: s, cooldownMs: cd(s), attackDurationMs: Number(timing(s).attackDuration.toFixed(3)), attacksPerSecond: Number((1000 / cd(s)).toFixed(4)), moveFactor: getMoveSpeed({ speed: s, status: { paralysis: false } } as any) }))
const paralysed = { speed: 100, cooldownMsWhenParalysed: (() => { const o: any = { speed: 100 / 2, cooldown: 0 }; (PokemonEntity.prototype as any).resetCooldown.call(o, 1000); return o.cooldown })(), note: "attacking-state.ts:23-24 halves the speed passed to resetCooldown when paralysed" }

// ---- E/G. synergies, spotlight and Cosmoem callback ----------------------------------------------------------------------------------
const mk = (name: Pkm, y: number, items: Item[] = []) => { const p: any = PokemonFactory.createPokemonFromName(name); p.positionY = y; p.positionX = 0; items.forEach((i) => p.items.add(i)); return p }
const count = (board: any[], rule: any = null) => { const m = computeSynergies(board, undefined, rule); return Object.fromEntries([...m.entries()].filter(([, v]) => v > 0)) }
const synergyCases = {
  benchNotCounted: { board: "CHARMANDER y=0 (bench)", counts: count([mk(Pkm.CHARMANDER, 0)]) },
  deployedCounted: { board: "CHARMANDER y=1", counts: count([mk(Pkm.CHARMANDER, 1)]) },
  familyDedup: { board: "CHARMANDER y=1, CHARMELEON y=2, CHARIZARD y=3 (one family)", counts: count([mk(Pkm.CHARMANDER, 1), mk(Pkm.CHARMELEON, 2), mk(Pkm.CHARIZARD, 3)]) },
  familyOutingNoDedup: { board: "same three, rule FAMILY_OUTING", counts: count([mk(Pkm.CHARMANDER, 1), mk(Pkm.CHARMELEON, 2), mk(Pkm.CHARIZARD, 3)], "FAMILY_OUTING") },
  dragonBelow3: { board: "CHARMANDER, BAGON y=1", counts: count([mk(Pkm.CHARMANDER, 1), mk(Pkm.BAGON, 1)]) },
  dragonAt3Doubling: { board: "CHARMANDER, BAGON, DEINO y=1 (3 DRAGON families)", counts: count([mk(Pkm.CHARMANDER, 1), mk(Pkm.BAGON, 1), mk(Pkm.DEINO, 1)]) }
}
const lightTiers = (b: any[]) => { const syn = computeSynergies(b) as any; const e = new Effects(); e.update(syn, { forEach: (f: any) => b.forEach((p, i) => f(p, String(i))) } as any); return [...(e as any).values()].filter((x: string) => ["SHINING_RAY", "LIGHT_PULSE", "ETERNAL_LIGHT", "MAX_ILLUMINATION"].includes(x)) }
const cosmoemOnCell = mk(Pkm.COSMOEM, 2); cosmoemOnCell.positionX = 3
const cosmoemOffCell = mk(Pkm.COSMOEM, 2, [Item.SHINY_STONE]); cosmoemOffCell.positionX = 4
const callback = (pokemon: any, board: any[]) => {
  const effects = new Set(lightTiers(board))
  const player: any = { lightX: 3, lightY: 2, effects }
  return { callbackResult: pokemon.evolutionRule.divergentEvolution(pokemon, player), lightEffects: [...effects] }
}
const charWithStone = mk(Pkm.CHARMANDER, 1, [Item.SHINY_STONE]); const charPlain = mk(Pkm.CHARMANDER, 1)
const spotlightCases = {
  lightCounts: {
    cosmoemAlone: count([cosmoemOnCell]).LIGHT ?? 0,
    cosmoemPlusPlainCharmander: count([cosmoemOnCell, charPlain]).LIGHT ?? 0,
    cosmoemPlusCharmanderHoldingShinyStone: count([cosmoemOnCell, charWithStone]).LIGHT ?? 0
  },
  onLightCellNoLightTier: callback(cosmoemOnCell, [cosmoemOnCell]),
  onLightCellWithLightTierViaItemHolder: callback(cosmoemOnCell, [cosmoemOnCell, charWithStone]),
  offLightCellHoldingShinyStoneWithLightTier: callback(cosmoemOffCell, [cosmoemOffCell, charWithStone]),
  note: "light cell = (3,2). The callback result depends on exact coordinates plus an active Light tier; SHINY_STONE on the Cosmoem itself does not satisfy the coordinate test, while a SHINY_STONE holder can add a Light count (type granted by SynergyGivenByItem)."
}

const result = {
  label: "production-branch reference; deployment unverified", sourceSha: "07367c341fe928763da2b565c2eee010433e4fc1",
  stubs: "see the file header", damageChecks, speedChecks, paralysed, synergyCases, spotlightCases
}
writeFileSync(out, JSON.stringify(result, null, 2) + "\n")
console.log(`wrote core mechanics probe results (damage checks ok=${damageChecks.ok})`)
