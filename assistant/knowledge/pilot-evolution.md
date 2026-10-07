# Pilot evolution data: 20 units

- **Audited game-source commit:** `01a3e845e91ebe3144b3c43fa9cd261a5dadafd2` (all paths and line numbers below refer to it). Extracted with the game source verified identical to that commit; `--allow-source-mismatch` not used.
- **Data:** [`../data/01a3e845/pilot-evolution.json`](../data/01a3e845/pilot-evolution.json), produced by `assistant/extract-evolution.ts` (Node 24.21.0 / npm 11.19.0). Same 20 units as [`pilot-units.md`](pilot-units.md); the baseline JSON files are unchanged.
- **Live-game parity is unverified.** Nothing here was run in the game. Every statement is tagged as one of:
  - **Declared** — read from the bare factory instance (the JSON);
  - **By inspection** — behaviour read from handler/hook source, not executed in the game;
  - **Not tested / unresolved** — not run, or a path I stopped tracing.

## How to read the JSON
- `declaredEvolution`: the class's `evolution` (`"DEFAULT"` = none declared), `evolutions` array and `stacksRequired` (0 = not set).
- `evolutionRule.properties`: every property a rule may carry, each as `{present:false}` or `{present:true, kind, value}`. A missing property is therefore different from `0`, `false` or `[]`.
  Function-valued properties (`divergentEvolution`, `condition`) are **never** serialised as values: they are `{kind:"callback", arity, source:{file,symbol,line}}` (line found by text search in `pokemon.ts`). Presence says nothing about behaviour.
- `evolutionRule.matchesInheritedBaseDefault`: the rule equals the base `Pokemon` default (`COUNT`, `numberRequired: 3`; `pokemon.ts:112–115`). A class could redeclare an identical rule; that cannot be told apart at runtime.
- `evolutionEvidence`: separate from the rule. Whether a unit can evolve is evidenced only by `evolution !== DEFAULT` or a non-empty `evolutions` (the `hasEvolution` getter, `pokemon.ts:175–177`). A terminal unit keeps the inherited rule: e.g. CHARIZARD has `COUNT/3` but `CountEvolutionHandler.canEvolve` returns false for it at `count-evolution-handler.ts:22` (`!pokemon.hasEvolution`).
- `probes`: two callbacks called with stub arguments (TYPE_NULL, PIKACHU), because their bodies were read and use only the passed item / `player.regionalPokemons`. Probe results are not game behaviour.

## Declarations for the 20 units (generated from the JSON)
`node assistant/knowledge/make-pilot-table.mjs --evolution`

| Unit | `evolution` | `evolutions` | `stacksRequired` | Rule type | Rule parameters | Callbacks | Rule = inherited default | Evidence |
|---|---|---|---|---|---|---|---|---|
| CHARMANDER | CHARMELEON | [] | 0 | count | numberRequired=3 | — | yes | declares evolution |
| CHARMELEON | CHARIZARD | [] | 0 | count | numberRequired=3 | — | yes | declares evolution |
| CHARIZARD | DEFAULT | [] | 0 | count | numberRequired=3 | — | yes | none declared |
| PIKACHU | DEFAULT | RAICHU, ALOLAN_RAICHU | 0 | count | numberRequired=3 | divergentEvolution (pokemon.ts:3180) | no | declares evolution |
| RAICHU | DEFAULT | [] | 0 | count | numberRequired=3 | — | yes | none declared |
| ALOLAN_RAICHU | DEFAULT | [] | 0 | count | numberRequired=3 | — | yes | none declared |
| GALAR_MEOWTH | PERRSERKER | [] | 0 | count | numberRequired=3 | — | yes | declares evolution |
| VESPIQUEN | DEFAULT | [] | 0 | count | numberRequired=3 | — | yes | none declared |
| ARCEUS | DEFAULT | [] | 0 | count | numberRequired=3 | — | yes | none declared |
| MAGIKARP | GYARADOS | [] | 0 | count | numberRequired=8 | — | no | declares evolution |
| GYARADOS | DEFAULT | [] | 0 | count | numberRequired=3 | — | yes | none declared |
| TYPE_NULL | SILVALLY | [] | 0 | item | itemsTriggeringEvolution=[55 items] | divergentEvolution (pokemon.ts:10096) | no | declares evolution |
| PRIMEAPE | ANNIHILAPE | [] | 10 | stack | — | — | no | declares evolution |
| TEPIG | PIGNITE | [] | 0 | hatch | — | — | no | declares evolution |
| DITTO | DEFAULT | [] | 0 | count | numberRequired=3 | — | yes | none declared |
| UNOWN_D | DEFAULT | [] | 0 | count | numberRequired=3 | — | yes | none declared |
| FARFETCH_D | DEFAULT | [] | 0 | count | numberRequired=3 | — | yes | none declared |
| TOTODILE | CROCONAW | [] | 0 | count | numberRequired=3 | — | yes | declares evolution |
| COSMOEM | DEFAULT | SOLGALEO, LUNALA | 10 | stack | — | divergentEvolution (pokemon.ts:14819) | no | declares evolution |
| SUBSTITUTE | DEFAULT | [] | 0 | count | numberRequired=3 | — | yes | none declared |

`evolutions` is non-empty only for PIKACHU and COSMOEM, and `evolution` is a single default target; neither is a complete evolution map (TYPE_NULL declares `evolution = SILVALLY` yet its rule can yield 17 other `SILVALLY_*` targets).
TEPIG's `HATCH` rule is listed but not interpreted here.

## Common machinery (by inspection)
- Rule shapes: `app/types/EvolutionRules.ts:8–62` (`EvolutionRuleType`, `CountEvolutionRule`, `ItemEvolutionRule`, `StackEvolutionRule`, …).
- `EvolutionManager.getHandler` (`app/core/evolution-logic/evolution-manager.ts:29–49`) picks the handler by `rule.type` (default → `CountEvolutionHandler`). `tryEvolve` (`:51–61`) = `handler.canEvolve` then `evolve` (`:63–72`) → `handler.evolve` + `afterEvolve` (`:74–87`: `updateSynergies`, on-evolution hooks, then `tryEvolve` again for chained evolutions).
- `EvolutionHandler` (`evolution-handler.ts:15–43`): the constructor copies `rule.divergentEvolution`; `getEvolution(pokemon, player, ...args)` returns `divergentEvolution(pokemon, player, ...args)` if present, else `pokemon.evolution`.
- `carryOverPermanentStats` (`evolution-handler.ts:45–93`): for `maxHP, atk, def, speDef, speed, ap, luck`, adds `Σ(old − bare base of the old unit)` to the evolved unit via `applyStat`; carries a TM if any.

## MAGIKARP — the eight-copy rule
- **Declared:** `COUNT`, `numberRequired = 8` (not the inherited 3), `evolution = GYARADOS`, no callbacks (`pokemon.ts:5169–5187`).
- **By inspection:** `CountEvolutionHandler.canEvolve` (`count-evolution-handler.ts:21–38`) requires `pokemon.hasEvolution`, then counts the units in `player.board` with the same `name` that do not hold `Item.EVIOLITE`, and returns `copies.length >= numberRequired`. Units on the bench are in `player.board` too (`evolve` calls `isOnBench` on its members, `:92`).
  It is triggered by `GameRoom.checkEvolutionsAfterPokemonAcquired` (`app/rooms/game-room.ts:1295–1311`), which calls `tryEvolve` for every board unit that `hasEvolution` with a `COUNT` rule; callers include `game-room.ts:1290, 1358, 1660`.
  `evolve` (`:59–183`) removes the first `numberRequired` matching units in board iteration order (`:69–108`, bounded by `pokemonsBeforeEvolution.length < this.numberRequired`), creates `GYARADOS` through the factory (`:110–113`; no divergent callback, so `getEvolution` returns `pokemon.evolution`), carries over summed permanent stats, redistributes items (max 3) and dishes, places it at the position of the removed copy with the largest `positionY` (`coord`, `:76–88`, `:172–176`), then calls `pokemonEvolved.onAcquired(player)` (`:181`); `Gyarados.onAcquired` adds `Title.FISHERMAN` (`pokemon.ts:5205–5207`).
- **Not tested:** any runtime run; Eviolite interactions; behaviour with more than eight copies beyond what the code reading above shows.

## PIKACHU — how the Raichu branch is selected
- **Declared:** `COUNT`, `numberRequired = 3`, a `divergentEvolution` callback (`pokemon.ts:3177–3185`, callback at line 3180), `evolution = DEFAULT`, `evolutions = [RAICHU, ALOLAN_RAICHU]` (`:3176`). It `hasEvolution` only through the `evolutions` array.
- **By inspection:** three copies trigger it as for MAGIKARP; `CountEvolutionHandler.evolve` calls `getEvolution(pokemon, player)` (`count-evolution-handler.ts:60`) → the callback: `player.regionalPokemons.includes(Pkm.ALOLAN_RAICHU)` → `ALOLAN_RAICHU`, otherwise `RAICHU` (`pokemon.ts:3180–3184`).
  **Probe (stub players, not the game):** `regionalPokemons: []` → `RAICHU`; `regionalPokemons: [ALOLAN_RAICHU]` → `ALOLAN_RAICHU`.
- **Unresolved (stopped tracing):** what puts `ALOLAN_RAICHU` in `Player.regionalPokemons` (`player.ts:161`). Two writers seen: `game-room.ts:1437` (player picks a regional variant in an add-pick) and a recomputation that resets the array from a computed list (`player.ts:954–`, how that list is built was not traced).

## TYPE_NULL — items, variants and trigger
- **Declared:** `ITEM` rule; `itemsTriggeringEvolution = [...SynergyItems]` (55 items in this revision; `app/types/enum/Item.ts:824–827` = `SynergyItemsNoSpecial` + `MemoryDiscs`); a `divergentEvolution` callback (`pokemon.ts:10096–10144`); `evolution = SILVALLY`; `stars = 2`.
- **Item → synergy → variant (complete).** The callback does `switch (SynergyGivenByItem[item])` (`Item.ts:829–`) and returns a variant, with `default`/`FIELD` returning plain `SILVALLY` (`pokemon.ts:10140–10142`). The table below is **probe output**: the real callback called once per item in `itemsTriggeringEvolution` (stub `{}` arguments; the body uses only `item`). All 55 calls succeeded and every item has a synergy.
  `node assistant/knowledge/make-pilot-table.mjs --type-null-map`

| Result of `divergentEvolution` | # items | Items (synergy given by item) |
|---|---|---|
| SILVALLY_DRAGON | 4 | OLD_AMBER (FOSSIL), DRAGON_SCALE (DRAGON), FOSSIL_MEMORY (FOSSIL), DRAGON_MEMORY (DRAGON) |
| SILVALLY_PSYCHIC | 2 | DAWN_STONE (PSYCHIC), PSYCHIC_MEMORY (PSYCHIC) |
| SILVALLY_WATER | 4 | WATER_STONE (WATER), SURFBOARD (AQUATIC), WATER_MEMORY (WATER), AQUATIC_MEMORY (AQUATIC) |
| SILVALLY_ELECTRIC | 3 | THUNDER_STONE (ELECTRIC), ELECTIRIZER (ELECTRIC), ELECTRIC_MEMORY (ELECTRIC) |
| SILVALLY_FIRE | 5 | FIRE_STONE (FIRE), MAGMARIZER (FIRE), COOKING_POT (GOURMET), FIRE_MEMORY (FIRE), GOURMET_MEMORY (GOURMET) |
| SILVALLY_FAIRY | 2 | MOON_STONE (FAIRY), FAIRY_MEMORY (FAIRY) |
| SILVALLY_DARK | 2 | DUSK_STONE (DARK), DARK_MEMORY (DARK) |
| SILVALLY_GRASS | 4 | LEAF_STONE (GRASS), INCENSE (FLORA), GRASS_MEMORY (GRASS), FLORA_MEMORY (FLORA) |
| SILVALLY_ICE | 2 | ICE_STONE (ICE), ICE_MEMORY (ICE) |
| SILVALLY_FIGHTING | 2 | MACHO_BRACE (FIGHTING), FIGHTING_MEMORY (FIGHTING) |
| SILVALLY | 9 | LIGHT_BALL (LIGHT), METRONOME (SOUND), SHINY_STONE (LIGHT), RUNNING_SHOES (FIELD), FRIEND_BOW (NORMAL), SOUND_MEMORY (SOUND), FIELD_MEMORY (FIELD), LIGHT_MEMORY (LIGHT), NORMAL_MEMORY (NORMAL) |
| SILVALLY_POISON | 4 | POKERUS_VIAL (POISON), BERSERK_GENE (MONSTER), POISON_MEMORY (POISON), MONSTER_MEMORY (MONSTER) |
| SILVALLY_STEEL | 2 | METAL_COAT (STEEL), STEEL_MEMORY (STEEL) |
| SILVALLY_FLYING | 2 | AIR_BALLOON (FLYING), FLYING_MEMORY (FLYING) |
| SILVALLY_ROCK | 2 | PROTECTOR (ROCK), ROCK_MEMORY (ROCK) |
| SILVALLY_GROUND | 2 | EXPLORER_KIT (GROUND), GROUND_MEMORY (GROUND) |
| SILVALLY_GHOST | 2 | SPELL_TAG (GHOST), GHOST_MEMORY (GHOST) |
| SILVALLY_BUG | 2 | SHED_SHELL (BUG), BUG_MEMORY (BUG) |

Total: 55 items probed, 18 distinct results.

- **Trigger, by inspection:** `GameRoom.checkEvolutionsAfterItemAcquired` (`game-room.ts:1316–1335`) calls `EvolutionManager.tryEvolve(pokemon, player, itemAcquired)` for units with an `ITEM` rule; it is called from `app/rooms/commands/game-commands.ts:820, 940` and `app/core/effects/items.ts:1656`. `ItemEvolutionHandler.canEvolve` (`item-evolution-handler.ts:16–31`): false if the unit holds `EVIOLITE`; otherwise it needs one of the unit's held items **or dishes** to be in `itemsTriggeringEvolution`, and `getEvolution(pokemon, player, itemGiven) !== pokemon.name` (always true here, the callback never returns `TYPE_NULL`).
  `evolve` (`:33–47`) uses the first held trigger item, else the item just given, and calls `player.transformPokemon(pokemon, target)`. All `SILVALLY_*` map to family root `TYPE_NULL` (`app/types/enum/Pokemon.ts:3103–`).
- **Not tested / unresolved:** any runtime run; the contexts of the three `checkEvolutionsAfterItemAcquired` callers; a separate forced-transform path at `items.ts:1612–1640` (not read beyond its header).

## PRIMEAPE — what supplies the stacks, and the threshold check
- **Declared:** `STACK` rule (no parameters), `stacksRequired = 10`, `evolution = ANNIHILAPE`, passive `PRIMEAPE`, no callbacks (`pokemon.ts:7722–7738`).
- **By inspection (supply):** `PassiveEffects[Passive.PRIMEAPE]` (`app/core/effects/passives.ts:1561–1564`) registers `addPrimeapeStack` as both an `OnDeathEffect` and an `OnResurrectingEffect`. `addPrimeapeStack` (`passives.ts:1195–1198`) does `pokemon.addAttack(1, …)` and `pokemon.addStack()`: +1 attack on the in-fight entity and +1 stack.
- **By inspection (threshold):** `PokemonEntity.addStack` (`app/core/pokemon-entity.ts:1823–1845`) returns if the entity has no `player`; adds to `refToBoardPokemon.stacks` and mirrors it on the entity; and, if the board unit's rule type is `STACK`, `stacksRequired > 0` and **`this.stacks === this.stacksRequired`** (strict equality; the entity copies `stacksRequired` at `pokemon-entity.ts:202`), calls `EvolutionManager.tryEvolve`. `StackEvolutionHandler.canEvolve` (`stack-evolution-handler.ts:7–11`) then requires no `EVIOLITE`, the unit to be on `player.board`, and `stacks >= stacksRequired`; `evolve` (`:13–20`) calls `player.transformPokemon`. A mid-fight evolution updates the entity's `index`/`name`/`refToBoardPokemon` but not its stats until the fight ends (comment at `pokemon-entity.ts:1838`).
- **Unresolved / not tested:** which events dispatch `OnDeathEffect`/`OnResurrectingEffect`; what happens if stacks jump past 10 (the `===` check here vs `>=` in the handler; other callers of `tryEvolve` for stack units exist, e.g. `game-commands.ts:1801`, `synergies.ts:991`, not read); any runtime run.

## COSMOEM — branch condition and the Cosmog → Cosmoem path
- **Declared (COSMOEM):** `STACK` rule with a `divergentEvolution` callback (`pokemon.ts:14819`), `stacksRequired = 10`, `evolutions = [SOLGALEO, LUNALA]`, `evolution = DEFAULT`, class HP 200 (`:14812–14845`; `onAcquired` at `:14830`). **Declared (COSMOG, not in the pilot but on the path):** `STACK`, `stacksRequired = 10`, `evolution = COSMOEM`, HP 100, no callback (`:14794–`).
- **Branch condition, by inspection:** the callback returns `SOLGALEO` if `pokemon.positionX === player.lightX && pokemon.positionY === player.lightY` **and** some Light-synergy tier effect is in `player.effects` (`SynergyTiers[Synergy.LIGHT].some(e => player.effects.has(e))`); otherwise `LUNALA`. `player.lightX/lightY` are copied from `state.lightX/lightY` in the `Player` constructor (`player.ts:198–199, 256–257`). Not probed (it needs real player/effects state); what sets `state.lightX/lightY` was not traced.
- **Is `onAcquired` called on Cosmog → Cosmoem? Yes, by inspection.** Cosmog's rule is `STACK` → `StackEvolutionHandler.evolve` (`stack-evolution-handler.ts:13–20`) → `player.transformPokemon(pokemon, COSMOEM)` (`player.ts:341–360`) → `newPokemon.onAcquired(this)` at **`player.ts:356`** (target = `pokemon.evolution = COSMOEM`, no callback on Cosmog).
- **Sequence in `transformPokemon`:** (1) factory builds a bare Cosmoem, `hp = maxHP = 200`; (2) `carryOverPermanentStats(new, [cosmog])`: bare base is a bare Cosmog (`maxHP` 100), so `applyStat(Stat.HP, cosmog.maxHP − 100)` → `addMaxHP` (`pokemon.ts:276, 336`: `hp = max(1, hp + Δ); maxHP = hp`), likewise atk/def/speDef/speed/ap/luck; (3) position, dishes, board swap, items equipped through `equipItem` (`player.ts:351`); (4) `Cosmoem.onAcquired`: `stacks = -1`, `hp -= 10`, `hp -= 100`, `maxHP = hp` (comment in code: "revert hp buffs of cosmog"); (5) `updateSynergies`. Afterwards `afterEvolve` runs the on-evolution hooks; the COSMOG/COSMOEM hook (`passives.ts:1929–1942`) skips when the evolved unit itself has the COSMOG/COSMOEM passive.
  Cosmog's stacks come, by inspection, from that same hook: whenever **another** unit evolves, each COSMOG/COSMOEM on the board gets `addMaxHP(10)`, `stacks++` and a `tryEvolve` (`passives.ts:1929–1942`). No `PassiveEffects` entry for `Passive.COSMOG` was found; other stack sources were not searched.
- **HP — what is and is not established:** reading the sequence above, the Cosmoem produced is `max(1, 200 + (cosmog.maxHP − 100)) − 110`, i.e. `cosmog.maxHP − 10` when the clamp does not apply, **provided** `equipItem` and nothing else changes HP in between (not traced). `cosmog.maxHP` at evolution time depends on how many +10 buffs it received and on any other HP changes, which the code read does not fix. **No universal acquired HP value is claimed**, and the bare `200` in the table is only the class value. This formula was derived by reading, not executed.
- **Not tested / unresolved:** any runtime run; `equipItem` HP effects; Cosmoem → Solgaleo/Lunala flow; the audited commit's own subject ("revert cosmog and cosmoem passive buffs") was not diffed.

## Unresolved list (explicitly not traced further)
1. How `Player.regionalPokemons` is computed (`player.ts:954–`) and when `ALOLAN_RAICHU` qualifies.
2. What sets `state.lightX/lightY` (COSMOEM branch).
3. Which events dispatch `OnDeathEffect`/`OnResurrectingEffect` (PRIMEAPE) and how stack overshoot past 10 is handled.
4. HP effects of `equipItem` during `transformPokemon`; other stack sources for COSMOG.
5. The forced-transform path at `items.ts:1612–1640` and the contexts of the `checkEvolutionsAfterItemAcquired` callers.
6. Everything about runtime behaviour: no code here was executed in the game, in a server, or in combat.
