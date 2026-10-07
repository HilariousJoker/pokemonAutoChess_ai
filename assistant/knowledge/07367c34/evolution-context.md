# Evolution context: Pikachu's regional branch and Cosmog/Cosmoem

**Production-branch reference; deployment unverified.** Source `07367c341fe928763da2b565c2eee010433e4fc1` (upstream `prod` head). All paths/line numbers refer to that revision; the live game's behavior is not verified. Companion to [`pilot-evolution.md`](pilot-evolution.md).

**Evidence labels:** **Read** = source read, not executed · **Probe** = executed against the real pinned code with the stubs listed in the probe file · **Unresolved** = not established.
Probes (isolated, no server/Room/Simulation): [`../../probes/regional-pikachu-probe.ts`](../../probes/regional-pikachu-probe.ts) → [`results`](../../probes/results/regional-pikachu-probe.json); [`../../probes/cosmog-evolution-probe.ts`](../../probes/cosmog-evolution-probe.ts) → [`results`](../../probes/results/cosmog-evolution-probe.json). Run in a worktree of the pinned SHA with Node 24.21.0 / npm 11.19.0 and its own `npm ci --ignore-scripts` install.

## Short answers
- **Pikachu → Alolan Raichu** happens when the player's *current map* has the **Psychic** synergy at the moment the evolution is evaluated; otherwise it evolves into Raichu. Nothing about where or when the Pikachu was bought matters, and the town (before any portal choice) never gives the Alolan form.
- **Cosmoem → Solgaleo** happens only if the Cosmoem stands exactly on the player's **light cell** (a random deployed-side cell fixed for the whole game) **and** the player has an active **Light** synergy tier; otherwise → **Lunala**. A Cosmoem on the bench is never on the light cell, so it becomes Lunala.
- **Cosmog → Cosmoem** counts a bench Cosmog as much as a deployed one (the bench is part of `player.board`). In the no-item case with eight +10 HP triggers, Cosmoem is 300 HP right after transformation, **210 right after `onAcquired` (an intermediate)**, and **220 HP / 220 maxHP / 0 stacks once the surrounding evolution loop finishes**, because that same loop visits the new Cosmoem.

## Pikachu → Raichu or Alolan Raichu
**Declaration (Read).** `Pikachu.evolutionRule.divergentEvolution` returns `ALOLAN_RAICHU` if `player.regionalPokemons.includes(Pkm.ALOLAN_RAICHU)`, else `RAICHU` — `app/models/colyseus-models/pokemon.ts:3226–3230`. It is called when the 3-copy count rule evolves the unit: `count-evolution-handler.ts:60` (`getEvolution(pokemon, player)`).

**How `regionalPokemons` is filled (Read).** `Player.regionalPokemons` (`player.ts:154`) is only ever rewritten by `Player.updateRegionalPool(state, mapChanged, previousMap)` (`player.ts:781–900`):
1. If `player.map === "town"` (initial value, `player.ts:250`) it is emptied and the function returns (`:786–789`).
2. Otherwise candidates are `PRECOMPUTED_REGIONAL_MONS` (every unit with `regional = true` and a skill or passive — `models/precomputed/precomputed-pokemon-data.ts:45–50`) filtered by each unit's `isInRegion(map, state)` (`player.ts:791–793`).
3. `AlolanRaichu` is `regional = true` with `isInRegion(map) = RegionDetails[map].synergies.includes(Synergy.PSYCHIC)` (`pokemon.ts:3273–3277`). `RegionDetails` is `app/config/maps/regions.ts:13–`.
4. The list is sorted by stars and filtered (`player.ts:860–899`): no UNIQUE/LEGENDARY, one entry per evolution family, and units that are plain evolutions of their family root's chain are dropped. `ALOLAN_RAICHU` (COMMON; family `PICHU`; not an entry of `PkmRegionalVariants`, so the add-pick base-variant check at `:869–887` does not apply) passes these filters.
5. The array is replaced (`resetArraySchema`, `:864`).

**Probe.** The real `updateRegionalPool` (mapChanged = false; `this` and `state` stubbed) was run for all 144 `RegionDetails` entries, then Pikachu's real callback on each resulting list. **14 maps** put `ALOLAN_RAICHU` in the list and make Pikachu evolve into `ALOLAN_RAICHU`; these are exactly the 14 maps whose synergies include PSYCHIC: CrystalCave1, CrystalCave2, CrystalCrossing, FutureTemporalSpire, FutureTemporalTower, MeteorCave, PoisonMaze, SolarCave1, SpacialRift2, TemporalSpire, TestDungeon, TheNightmare, ZeroIsleEast3, ZeroIsleEast4. All 130 other maps → `RAICHU`; `town` → empty list → `RAICHU`. Establishes the pure map→list rule only; not how a map is chosen, nor shop effects of a map change.

**When the map changes (Read).** `player.map` is set (a) at portal-carousel stages `[0, 10, 20]` (`config/game/stages.ts:22`) when a player enters a portal whose map differs (`core/mini-game.ts:896–903`; portal maps are assigned by synergy overlap with the portal's symbols, random among ties, no map reused: `:768–789`), and (b) by dropping a **Lapras Passport** on a unit (`core/effects/items.ts:1297–1331`, map chosen by overlap with that unit's types, applied after a 10 s timeout). Both call `updateRegionalPool(..., true, previousMap)`. `updateRegionalPool(state, false)` is also re-run for all players after additional picks (`rooms/game-room.ts:1403–1405`; `rooms/commands/game-commands.ts:1571`).

**What this means for Pikachu.** The branch is decided by the list *at evaluation time*. Nothing in `updateRegionalPool` re-evaluates an existing Pikachu, so a Pikachu already on the board keeps its identity until a 3-copy evolution is attempted. Bought before or after the map change makes no difference by itself.

**Unresolved.** Which map a given player ends up with (portal symbol draw, Lapras Passport use); whether other code paths call the callback; `game-room.ts:1374` pushes a picked regional variant into `regionalPokemons` for `addPick` choices — by reading, the call at `:1403–1405` right after rebuilds the list and would overwrite that push (not executed); `ALOLAN_RAICHU` is not an additional-pick variant, so this does not affect Pikachu. Special game rules were not traced for this branch.

## Cosmoem → Solgaleo or Lunala
**Declaration (Read).** `Cosmoem.evolutionRule.divergentEvolution` (`pokemon.ts:14870–14878`): `SOLGALEO` iff `pokemon.positionX === player.lightX && pokemon.positionY === player.lightY && SynergyTiers[Synergy.LIGHT].some(e => player.effects.has(e))`, else `LUNALA`. It reads nothing else (no Shiny Stone check, though `Player.onLightChange` / `PokemonEntity` use Shiny Stone for the spotlight: `player.ts:902–915`).

**Light cell (Read).** `GameState.lightX = randomBetween(0, BOARD_WIDTH - 1)`, `lightY = randomBetween(1, BOARD_HEIGHT / 2)` (`rooms/states/game-state.ts:49–50`; `randomBetween` is inclusive, `utils/random.ts:39–41`; `BOARD_WIDTH = 8`, `BOARD_HEIGHT = 6`, `config/game/board.ts:1–2`) → **X ∈ 0..7, Y ∈ 1..3**. Each `Player` copies it on construction (`player.ts:248–249`); bots use fixed (3, 2) (`:252–257`). No other writes to `lightX/lightY` exist in the source tree searched (`grep`), so within a game it is a per-game constant shared by all non-bot players.

**Coordinates (Read).** `positionX` is the column; `positionY === 0` means **bench** (`app/utils/board.ts:8–10`, `getFirstAvailablePositionInBench` uses row 0, `:23–31`), rows ≥ 1 are board rows. Because `lightY ≥ 1`, **a bench Cosmoem can never match the light cell → LUNALA**.

**Light effect (Read).** The decisive condition is an **active Light tier**: `player.effects` contains one of the four Light effects. `player.effects` is rebuilt by `Effects.update(synergies, board)` (`models/effects.ts:14–25`, called from `Player.updateSynergies`, `player.ts:435`), which adds the highest reached tier of each synergy. Light tiers are `[SHINING_RAY, LIGHT_PULSE, ETERNAL_LIGHT, MAX_ILLUMINATION]` (`config/game/synergies.ts:152–157`) with thresholds `[2, 3, 4, 5]` (`:207`), so a Light effect exists iff the **final Light synergy value is ≥ 2**.
How that value is reached is *ordinary counting plus modifiers*, and only the ordinary part was read: `computeSynergies` (`models/colyseus-models/synergies.ts:97–`) starts from `bonusSynergies`, then counts each unit with `positionY != 0` (bench excluded) once per evolution family (`:109–131`) — so, in the ordinary case, a deployed Cosmoem adds one Light. This is **not** the whole rule: the same function switches the family key to a per-unit key under the `FAMILY_OUTING` special rule (`:118–120`), has a Dragon double-type step (`applyDragonDoubleTypes`, `:133–`), resets/recomputes dynamic types for PROTEAN units (`:111–113`) and adds item-given synergies (`addSynergiesGivenByItems`, `:115`). Those paths were not audited and can change the final count; "Light ≥ 2" is therefore the test, and "one per family" is only the usual way to get there.

**So:** SOLGALEO needs (1) Cosmoem deployed on the light cell and (2) an active Light tier (final Light value ≥ 2) when the evolution is evaluated; anything else, including bench, → LUNALA.

**Unresolved.** How a player sees the light cell in the client (not read); synergy bonuses from items/regions that change the Light count; whether the evolution moment (when stacks reach 8) can occur mid-fight with a different board than the player expects (`PokemonEntity.addStack` calls `tryEvolve` mid-fight, `core/pokemon-entity.ts:1803–1825`); Solgaleo/Lunala themselves.

## Cosmog → Cosmoem: HP and stacks
**Does `player.board` include the bench? (Read + Probe).** Yes. Units are added to `player.board` with `positionY = 0` for bench slots (`rooms/game-room.ts:1412–1423`), and "on the bench" is defined as `positionY === 0` (`utils/board.ts:8–10`). The probe confirms a bench Cosmog is a normal `MapSchema` member that the evolution loop touches.

**Collection membership vs deployed placement (Read + Probe).** `EvolutionManager.afterEvolve` loops over `player.board` (`evolution-manager.ts:92–103`) and gives every Cosmog/Cosmoem there `addMaxHP(10)`, `stacks++` and `tryEvolve`. `StackEvolutionHandler.canEvolve` checks `player.board.has(pokemon.id)` (`stack-evolution-handler.ts:9`) — **collection membership, not placement** — and `stacks >= stacksRequired` (8). Hence a **bench Cosmog collects stacks and evolves** (probe: same result as deployed, positionY stays 0). Placement matters only later, for the Solgaleo/Lunala branch and for synergies. (Evolution is blocked by Eviolite, `:8`.)

**Does the loop visit the new Cosmoem? (Probe).** Yes. In the real `MapSchema.forEach`, an entry inserted while iterating (after the current one is deleted) **is visited**: a control with `[COSMOG, CHARMANDER]` visited `COSMOG, CHARMANDER, COSMOEM`. In the full scenario the Cosmoem received the loop's `addMaxHP(10)` and `stacks++` (the `addMaxHP` log shows 8 Cosmog hits and 1 Cosmoem hit). The nested `afterEvolve(Cosmoem…)` that the evolution itself triggers does not add anything, because the evolved unit's passive is COSMOEM (`evolution-manager.ts:94–98`).

**No-item case, eight +10 HP evolution triggers (Probe; deployed Cosmog at positionY 1; bench identical except `positionY 0`).**
| Moment | Unit | hp | maxHP | stacks |
|---|---|---|---|---|
| start | COSMOG | 140 | 140 | 0 |
| immediately before transformation (8th trigger, after its +10/+1) | COSMOG | 220 | 220 | 8 |
| inside `transformPokemon`, before `onAcquired` | COSMOEM | 300 | 300 | 0 |
| **after `onAcquired`** | COSMOEM | **210** | **210** | **−1** |
| **after the surrounding loop completes** | COSMOEM | **220** | **220** | **0** |
Control with 7 triggers: still COSMOG, 210/210, 7 stacks.

**The earlier 210 figure** (pilot notes) is therefore only the **intermediate** value right after `Cosmoem.onAcquired` (`pokemon.ts:14881–14886`: `stacks = -1`, `hp -= 90`, `maxHP = hp`). In this plain case the end state of the evolving trigger is 220/220 with 0 stacks (coincidentally the bare factory HP), and the Cosmoem then needs 8 further triggers (stacks 0 → 8) to reach `stacksRequired`.

**Probe stubs (precisely).** Player = plain object `{board: real MapSchema, pokemonsPlayed: Set, updateSynergies: no-op, transformPokemon: spy delegating to the real Player.prototype.transformPokemon}`. The "evolution triggers" are real `EvolutionManager.afterEvolve` calls with a real CHARMELEON as the evolved unit (not on the board). Spies on `Cosmoem.onAcquired` and `Pokemon.addMaxHP` delegate to the originals. It establishes loop-visit behavior, bench eligibility and the no-item numbers above. It does **not** establish item effects, synergy-driven effects (updateSynergies is a no-op), other acquisition paths, or live-game behavior. Pinned dependency's `MapSchema` semantics are what was exercised.

**Unresolved (not generalized).** HP with items (`transformPokemon` re-adds items before `onAcquired`, `player.ts:342–347`), other permanent HP modifiers, a Cosmog with ≠ 8 buffs, and other `onAcquired` callers (`game-room.ts:1418,1424,1609,1613`; `services/gift-shop.ts:75,105,178`). Combat-side stacking (`PokemonEntity.addStack`) for Cosmog/Cosmoem was not traced.
