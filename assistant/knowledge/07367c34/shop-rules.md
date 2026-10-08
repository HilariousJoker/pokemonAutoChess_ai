# Normal shop: odds, pools and what rerolls can find

**Production-branch reference; deployment unverified.** Source `07367c341fe928763da2b565c2eee010433e4fc1` (upstream `prod` head). Structured rules, evidence references and unresolved items: [`../../data/07367c34/shop-rules.json`](../../data/07367c34/shop-rules.json) (checked by [`../../validate-shop.mjs`](../../validate-shop.mjs)). Executed checks: [`../../probes/shop-probe.ts`](../../probes/shop-probe.ts) → [`results`](../../probes/results/shop-probe.json). Related: [economy-leveling.md](economy-leveling.md) (XP, rerolls' gold cost).

**Scope.** The normal human-player path, levels 2–9: no special game rule, no shop-modifying item, dish or synergy effect. Those are recorded as dependencies, not traced. Unit prices and fishing/gift/carousel offers are out of scope. This note gives mechanics only — no team or reroll strategy.

Evidence labels: **Declared** (a value in config/code) · **Traced** (callers and conditions read) · **Executed** (the real functions run with a stub player and scripted randomness; stubs in the probe) · **Arithmetic** (calculated from declared values).

## What leveling changes
- **Shop size** is always **6** slots *(Declared, `config/game/shop.ts:3`)*. Level does not change it.
- **Only the rarity odds change.** Each slot first rolls a rarity from the row of your current level, *then* a unit of that rarity *(Traced, `shop.ts:695–709`, `:752`)*. Rows are `COMMON / UNCOMMON / RARE / EPIC / ULTRA` *(Declared, `config/game/shop.ts:56–67`)*:

| Level | COMMON | UNCOMMON | RARE | EPIC | ULTRA |
|---|---|---|---|---|---|
| 2 | 1 | 0 | 0 | 0 | 0 |
| 3 | 0.7 | 0.3 | 0 | 0 | 0 |
| 4 | 0.5 | 0.4 | 0.1 | 0 | 0 |
| 5 | 0.36 | 0.42 | 0.2 | 0.02 | 0 |
| 6 | 0.25 | 0.4 | 0.3 | 0.05 | 0 |
| 7 | 0.16 | 0.33 | 0.35 | 0.15 | 0.01 |
| 8 | 0.11 | 0.27 | 0.35 | 0.22 | 0.05 |
| 9 | 0.05 | 0.2 | 0.35 | 0.3 | 0.1 |

  Each row sums to 1 *(Arithmetic)*; in 64-bit floating point the level-9 row sums to 0.9999999999999999, which is exactly the largest `Math.random()` value (1 − 2⁻⁵³), so no seed can exceed a row sum and the loop cannot run past the row. The table also has rows for levels 1 and 10, which a player cannot reach (start level 2, cap 9). Levels 2–9 were each driven through the real `pickPokemon` with a seed in every non-zero band and returned the expected rarity; at level 3, seeds 0.69 and 0.7 gave COMMON and 0.700001 gave UNCOMMON, so **a seed exactly on a boundary belongs to the lower rarity** *(Executed)*. **Edge seeds (inspection of `shop.ts:695–709`, then executed):** the loop is `while (seed > threshold)`, so the largest possible seed 0.9999999999999999 stops at the last band (executed: level 9 → ULTRA, level 3 → UNCOMMON), while a seed of exactly **0** never enters the loop, leaves `i = 0`, and the rarity lookup `[…][i − 1]` is `undefined`: the code logs an error and the slot becomes **MAGIKARP** (executed at levels 2 and 9 with a scripted `Math.random`; how often the runtime RNG returns exactly 0 is not established here).
- The level used is the one you have **when the shop is drawn**. After a fight, income and its +2 XP are applied before the automatic refresh, so a level-up from that XP already affects the new shop *(Traced, `game-commands.ts:1929–1931`, `:1979–1992`)*; buying XP affects your next reroll immediately.

## What decides whether a reroll can find a unit
The configured odds only give the chance of a **rarity** per slot. A specific unit's chance is **not configured anywhere**; the unit is picked like this *(Traced, `shop.ts:548–600`)*:
1. Candidates = every remaining copy of that rarity in the **shared pool** plus your own **regional pool** of that rarity.
2. Removed from the candidates: WILD-type units (unless a Wild draw was requested), alt forms that are not yours, and any line you have already **finalized** (a final-form unit of that line on your board or bench — `getFinalizedLines`, `player.ts:952–970`).
3. One entry is chosen **uniformly**, so the chance of a unit within its rarity is *its remaining eligible copies ÷ all remaining eligible copies*. In the ordinary non-regional shared-pool path the code then removes one copy of the chosen unit's family-root entry from that pool (if the entry is found; `shop.ts:589–598`), and the six slots are drawn one after another.

So whether a unit can appear depends on: (a) its rarity having a non-zero chance at your level, (b) it being in the pool (see below), (c) copies remaining — which depends on what every player has bought, sold and currently has on display — and (d) your own finalized lines. Because (c) is game state, **no hit-chance formula is given here**.

Other slot-level branches that can precede or replace this *(Declared/Traced; Executed for the first two)*: **Ditto** with 0.5 % per slot from stage 6 (returns DITTO without taking a pool copy); a **Wild-only** draw with 6 % per slot at stage 0 and PvE stages (the shop for a PvE round is built after the stage counter increases). Unown/Falinks effects, type items and dishes, Repeat Ball and special rules are modifiers and were not traced.

## Pools
- **Start:** tier-1 units (1-star, implemented, not additional, not regional) of COMMON…ULTRA, each with **27 / 22 / 18 / 14 / 10 copies** (COMMON / UNCOMMON / RARE / EPIC / ULTRA) *(Declared `config/game/pools.ts:4–14`; Executed: 594 / 506 / 324 / 238 / 140 copies = 1802 total, over 22 / 23 / 18 / 17 / 14 units)*. One shared set per game, used by all players; regional pools are per player.
- **Additional units** join the shared pools only at stages **5 / 8 / 11** (uncommon / rare / epic), added once with `PoolSize[rarity][stages − 1]` copies. **Regional units** are in your own regional pool only while your map's synergies include them.
- **How a drawn unit is reserved.** After a unit is chosen, the code tries to remove one entry equal to the unit's **family-root name** (`getPokemonBaseline`) from the destination pool — the player's regional pool if the unit is flagged regional, otherwise the shared pool of its rarity — and removes it only if such an entry is found (`indexOf`, `shop.ts:589–598`). Everything below about reserved offers and copy counts is **demonstrated only for the tested ordinary, non-regional shared-pool path** (executed accounting; stub player); regional-variant accounting is unresolved.
- **In that ordinary path, a displayed offer is already out of the pool.** It returns when you refresh (all current offers are released first), when you remove it from the shop (this also locks the shop), or if you die. A **locked** shop keeps its offers across the automatic refresh; only bought/removed (and MAGIKARP) slots are redrawn, and the lock is then cleared *(Traced + Executed)*.
- **Buying** keeps the copy out of the pool: executed accounting went 1802 → 1796 (first shop) → 1796 (manual refresh) → 1795 (one buy, then refresh). **Selling** returns 1 / 3 / 9 copies for a 1-/2-/3-star (executed on the CHARMANDER line: 27 → 28 → 31 → 40). Dying releases your offers and units.
- **Empty pool:** if no candidate remains for the rolled rarity (pool empty or all remaining lines filtered out) the slot becomes **MAGIKARP** — there is no re-roll of the rarity and no fall back to another rarity *(Executed: an emptied COMMON pool at level 2 gave six MAGIKARP)*. A requested type retries once without the type (water → MAGIKARP).

## Can these units appear in the normal shop? (production-branch reference; deployment unverified)
| Unit | Rarity / stars | Normal shop? | Conditions (code) |
|---|---|---|---|
| CHARMANDER | COMMON, 1★ | **Yes** | In the shared COMMON pool from the start (27 copies); eligible at every level 2–9 while copies remain and you have not finalized the Charmander line (e.g. a Charizard) — `tier1-filter`, `finalized-lines`. |
| TOTODILE | RARE, 1★ | **Yes, from level 4** | In the shared RARE pool (18 copies); only a RARE roll can offer it, and RARE is 0 at levels 2–3 (0.10 at level 4) — `rare-level`. |
| VESPIQUEN | UNIQUE, 3★ | **No** | UNIQUE has no shop pool and it is a 3★ (outside the tier-1 filter); it is in `UniquePool` (stage-10 portal choice) — `pool-getters`, `unique-legendary-paths`. |
| ARCEUS | LEGENDARY, 3★ | **No** | No LEGENDARY shop pool; in `LegendaryPool` (stage-20 choice, 1/400 replacement chance for ARCEUS) — `arceus-choice`. |
| TYPE_NULL | LEGENDARY, 2★ | **No** | Same: `LegendaryPool` only. |

"No" refers only to this normal shop path; modifier paths (Repeat Ball, High Roller) can draw UNIQUE/LEGENDARY special picks (`pickSpecialPokemon`) and were not traced. Nothing here says a unit is unobtainable elsewhere.

## Unresolved
Modifier interactions (items, dishes, synergies, special rules); how variant copies are accounted for in regional pools (read, not verified); evolution/transform effects on pool copies; Double Up and gift-shop paths; the exact WILD-unit set and the wild branch with a nearly empty pool. See `unresolved` in the JSON.
