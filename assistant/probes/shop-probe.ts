// Probe: normal shop pools and selection, executed against the REAL pinned code (production-branch reference; deployment unverified, 07367c34).
// Real code: Shop (constructor pools, getRandomPokemonFromPool, pickPokemon, assignShop, refillShop, releasePokemon), getPokemonData,
// RarityProbabilityPerLevel, getWildChance. STUBS: the player is a plain object (empty MapSchema board, no items, no effects, no synergies,
// empty regional pools, empty flowerPotsSpawnOrder (alt-form filter), level set per case, `getFinalizedLines` configurable); `state` = {stageLevel, specialGameRule: null, additionalPokemons: []};
// Math.random is replaced by a scripted sequence in the "rarity band" checks so the REAL algorithm is driven deterministically.
// The buy step is NOT executed (OnBuyPokemonCommand is not run): it is reproduced by writing Pkm.DEFAULT into the slot, exactly as game-commands.ts:205 does.
// NOT executed: regional pools/variants, additional picks, Unown/Psychic effects, items, special rules, selling via commands, player death.
// Usage (inside a checkout of the pinned SHA with node_modules): node_modules/.bin/tsx assistant/probes/shop-probe.ts --out <file.json>
import { MapSchema } from "@colyseus/schema"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { LegendaryPool, PoolSize, RarityProbabilityPerLevel, SHOP_SIZE, UniquePool } from "../../app/config"
import Shop, { getPoolSize } from "../../app/models/shop"
import { getAdditionalsTier1, getPokemonData, PRECOMPUTED_REGIONAL_MONS } from "../../app/models/precomputed/precomputed-pokemon-data"
import { PRECOMPUTED_POKEMONS_PER_RARITY } from "../../app/models/precomputed/precomputed-rarity"
import { Rarity } from "../../app/types/enum/Game"
import { Pkm } from "../../app/types/enum/Pokemon"
import { probeStartup } from "./probe-guard"

const out = probeStartup(resolve(__dirname, "results", "shop-probe.json"))
const RARITIES = [Rarity.COMMON, Rarity.UNCOMMON, Rarity.RARE, Rarity.EPIC, Rarity.ULTRA] as const

function mkPlayer(level: number, finals: Set<Pkm> = new Set()): any {
  return {
    shop: [] as Pkm[], items: [], effects: { has: () => false }, board: new MapSchema(), synergies: new Map(), map: "town",
    regionalPokemons: [], commonRegionalPool: [], uncommonRegionalPool: [], rareRegionalPool: [], epicRegionalPool: [], ultraRegionalPool: [],
    experienceManager: { level }, gameStats: { rerollCount: 0 }, shopLocked: false, unownReminiscences: 0, shopsSinceLastUnownShop: 0, shopFreeRolls: 0,
    specialGameRule: null, flowerPotsSpawnOrder: [], getFinalizedLines: () => finals
  }
}
const state = (stageLevel: number): any => ({ stageLevel, specialGameRule: null, additionalPokemons: [] })
const total = (s: Shop) => RARITIES.reduce((n, r) => n + s.getPool(r)!.length, 0)
const byRarity = (s: Shop) => Object.fromEntries(RARITIES.map((r) => [r, s.getPool(r)!.length]))

// ---- 1. pool initialisation (real constructor) -------------------------------------------------------------------------
const shop0 = new Shop()
const poolInit = RARITIES.map((r) => {
  const pool = shop0.getPool(r)!
  const distinct = [...new Set(pool)]
  const copies = new Set(distinct.map((p) => pool.filter((x) => x === p).length))
  return { rarity: r, entries: pool.length, distinctUnits: distinct.length, copiesPerUnit: [...copies], declaredPoolSizeStars3: getPoolSize(r, 3), poolSizeRow: PoolSize[r] }
})

// ---- 2. the five requested units: eligibility facts from the real data/pools ---------------------------------------------------
const unitFacts = [Pkm.CHARMANDER, Pkm.TOTODILE, Pkm.VESPIQUEN, Pkm.ARCEUS, Pkm.TYPE_NULL].map((p) => {
  const d = getPokemonData(p)
  const inSharedPool = RARITIES.some((r) => shop0.getPool(r)!.includes(p))
  const inAdditionalTier1 = (["UNCOMMON", "RARE", "EPIC"] as const).some((r) => getAdditionalsTier1(PRECOMPUTED_POKEMONS_PER_RARITY[r]).includes(p))
  return {
    key: p, rarity: d.rarity, stars: d.stars, additional: d.additional, regional: d.regional, hasWildType: d.types.includes("WILD" as any), types: d.types,
    inSharedShopPoolAtGameStart: inSharedPool, copiesInSharedPool: RARITIES.map((r) => shop0.getPool(r)!.filter((x) => x === p).length).reduce((a, b) => a + b, 0),
    inAdditionalTier1List: inAdditionalTier1, inPrecomputedRegionalMons: PRECOMPUTED_REGIONAL_MONS.includes(p),
    inUniquePool: (UniquePool as string[]).includes(p), inLegendaryPool: (LegendaryPool as string[]).includes(p), hasShopPoolForItsRarity: (RARITIES as readonly string[]).includes(d.rarity)
  }
})

// ---- 3. probability rows (arithmetic) ----------------------------------------------------------------------------------------
const rows = Object.entries(RarityProbabilityPerLevel).map(([level, row]) => ({ level: Number(level), row, sum: row.reduce((a, b) => a + b, 0), sumIsExactlyOne: row.reduce((a, b) => a + b, 0) === 1 }))

// ---- 4. rarity band selection through the REAL pickPokemon with a scripted Math.random -----------------------------------------
// call order for a normal slot at stage 4 (not a PvE stage, no wild synergy): chance(DITTO_RATE) -> rarity seed -> pickRandomIn(candidates)
function pickWith(level: number, seed: number) {
  const shop = new Shop(), p = mkPlayer(level)
  const seq = [0.99, seed, 0]
  const orig = Math.random; let i = 0
  Math.random = () => seq[i++] ?? 0
  try { const pkm = shop.pickPokemon(p, state(4), 0); return { pkm, rarity: getPokemonData(pkm).rarity, randomCalls: i } } finally { Math.random = orig }
}
const bandChecks = rows.filter((r) => r.level >= 2 && r.level <= 9).map((r) => {
  let lo = 0
  const bands = RARITIES.map((rar, idx) => {
    const p = r.row[idx]; const start = lo; lo += p
    if (p === 0) return { rarity: rar, probability: 0, tested: false }
    const mid = start + p / 2
    const got = pickWith(r.level, mid).rarity
    return { rarity: rar, probability: p, testSeed: Number(mid.toFixed(6)), returnedRarity: got, ok: got === rar, tested: true }
  })
  return { level: r.level, bands, allOk: bands.every((b) => !b.tested || (b as any).ok) }
})
const boundary = [0.69, 0.7, 0.700001, 0.9999].map((seed) => ({ level: 3, seed, ...pickWith(3, seed) }))

// ---- 5. pool accounting: display / refresh / buy / sell (real Shop methods) ---------------------------------------------------
const shop = new Shop(); const pl = mkPlayer(2)
const T0 = total(shop)
shop.assignShop(pl, false, state(4))
const afterFirst = total(shop)
shop.assignShop(pl, true, state(4))            // manual refresh: offers released first, then 6 new ones drawn
const afterRefresh = total(shop)
const bought = pl.shop[0]
pl.shop[0] = Pkm.DEFAULT                        // what OnBuyPokemonCommand does to the slot (game-commands.ts:205); NOT the command itself
shop.assignShop(pl, true, state(4))
const afterBuyThenRefresh = total(shop)
const copiesBefore = shop.getPool(Rarity.COMMON)!.filter((x) => x === Pkm.CHARMANDER).length
shop.releasePokemon(Pkm.CHARMANDER, pl, state(4))
const afterSell1 = shop.getPool(Rarity.COMMON)!.filter((x) => x === Pkm.CHARMANDER).length
shop.releasePokemon(Pkm.CHARMELEON, pl, state(4)); const afterSell2 = shop.getPool(Rarity.COMMON)!.filter((x) => x === Pkm.CHARMANDER).length
shop.releasePokemon(Pkm.CHARIZARD, pl, state(4)); const afterSell3 = shop.getPool(Rarity.COMMON)!.filter((x) => x === Pkm.CHARMANDER).length
// locked-shop refill: only DEFAULT/MAGIKARP slots are replaced, other offers stay held out of the pool
const shop2 = new Shop(); const pl2 = mkPlayer(2)
shop2.assignShop(pl2, false, state(4))
const held = [...pl2.shop]; const tAfter = total(shop2)
pl2.shop[2] = Pkm.DEFAULT
shop2.refillShop(pl2, state(4))
const refill = { before: held, after: [...pl2.shop], sameExceptSlot2: held.every((p, i) => i === 2 || pl2.shop[i] === p), poolTotalBefore: tAfter, poolTotalAfter: total(shop2) }

// ---- 6. empty pool / filtered-out lines --------------------------------------------------------------------------------------------
const shop3 = new Shop(); shop3.commonPool.length = 0
const pl3 = mkPlayer(2); shop3.assignShop(pl3, false, state(4))
const allCommons = new Set(PRECOMPUTED_POKEMONS_PER_RARITY.COMMON)
const shop4 = new Shop(); const pl4 = mkPlayer(2, new Set([...shop4.getPool(Rarity.COMMON)!])); shop4.assignShop(pl4, false, state(4))
const shop5 = new Shop(); shop5.uncommonPool.length = 0
const pl5 = mkPlayer(3); const seqOrig = Math.random; Math.random = () => 0.9 // level 3 seed 0.9 -> UNCOMMON band (0.7..1.0), ditto roll 0.9 no
let emptyUncommon: any; try { emptyUncommon = shop5.pickPokemon(pl5, state(4), 0) } finally { Math.random = seqOrig }

// ---- 7. Ditto and wild branches seen before the rarity roll ------------------------------------------------------------------------
function pickScripted(stage: number, seq: number[], level = 2) {
  const shop = new Shop(), p = mkPlayer(level); const orig = Math.random; let i = 0
  Math.random = () => seq[i++] ?? 0
  try { return { pkm: shop.pickPokemon(p, state(stage), 0), randomCalls: i } } finally { Math.random = orig }
}
const specialBranches = {
  dittoRoll0_stage5: pickScripted(5, [0.0001, 0.5, 0]), dittoRoll0_stage6: pickScripted(6, [0.0001, 0.5, 0]), dittoRollNo_stage6: pickScripted(6, [0.99, 0.5, 0]),
  wildChanceStage1: (() => { const p = mkPlayer(2); return { stage1: Number(require("../../app/models/colyseus-models/synergies").getWildChance(p, 1)), stage4: Number(require("../../app/models/colyseus-models/synergies").getWildChance(p, 4)), stage0: Number(require("../../app/models/colyseus-models/synergies").getWildChance(p, 0)) } })()
}

const result = {
  label: "production-branch reference; deployment unverified", sourceSha: "07367c341fe928763da2b565c2eee010433e4fc1",
  stubs: "plain-object player (no items/effects/synergies/regional pools), state {stageLevel, specialGameRule:null}; scripted Math.random for band/branch checks; buy step reproduced by writing DEFAULT into the slot",
  shopSize: SHOP_SIZE, poolInit, unitFacts, probabilityRows: rows, bandChecks, boundaryLevel3: boundary,
  poolAccounting: { initialTotal: T0, afterFirstAssign: afterFirst, afterManualRefresh: afterRefresh, boughtThenRefreshed: { boughtUnit: bought, totalAfter: afterBuyThenRefresh }, byRarityNow: byRarity(shop),
    sellReturns: { unit: "CHARMANDER line, COMMON pool", copiesBefore, after1Star: afterSell1, after2Star: afterSell2, after3Star: afterSell3, returnedBy1Star: afterSell1 - copiesBefore, returnedBy2Star: afterSell2 - afterSell1, returnedBy3Star: afterSell3 - afterSell2 }, lockedRefill: refill },
  emptyPool: { commonPoolEmptiedLevel2Shop: pl3.shop, allCommonLinesFinalizedLevel2Shop: pl4.shop, uncommonPoolEmptiedLevel3SeedInUncommonBand: emptyUncommon, commonRaritySetSize: allCommons.size },
  specialBranches
}
writeFileSync(out, JSON.stringify(result, null, 2) + "\n")
console.log("wrote shop probe results")
