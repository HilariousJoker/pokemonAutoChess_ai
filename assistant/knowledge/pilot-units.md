# Pilot knowledge: 20 units (bare-instance baseline)

- **Audited game-source commit:** `01a3e845e91ebe3144b3c43fa9cd261a5dadafd2`. File paths and line numbers below refer to that revision.
- **Data:** [`../data/01a3e845/pilot-units.json`](../data/01a3e845/pilot-units.json), extracted by `assistant/extract-baseline.ts` (Node 24.21.0 / npm 11.19.0, game source verified identical to the audited commit; two runs identical).
- **Live-game parity is unverified.** Nothing here was compared with the running game, upstream data, the wiki, or patch notes.

## What these numbers are
Every value comes from `PokemonFactory.createPokemonFromName(name)` with no player, shiny or emotion argument: a **bare instance**
(`app/models/pokemon-factory.ts:42`). They are the class definition plus inherited defaults *before* any player, item, board position,
synergy/weather/stage effect, evolution/acquisition hook, or combat effect is applied. They are **not** what a unit has on a board in a match.
Mechanics: the factory looks the class up in `PokemonClasses` (`pokemon.ts:20900`), calls `new PokemonClass(name, shiny, emotion)`, then
`postConstructor()` (`pokemon.ts:135`), which copies `hp→maxHP`, `maxPP→baseMaxPP`, `atk→baseAtk`, `skill→baseSkill`.
Subclass field initialisers override the base-class defaults (`Pokemon`, `pokemon.ts:73`): hp 10, atk 1, def 1, speDef 1, range 1, maxPP 100, speed `DEFAULT_SPEED`.

## Table (generated from the JSON)
Generated with `node assistant/knowledge/make-pilot-table.mjs`. "Ability" is the `skill` identifier. Stars are the unit's own star level in the class definition.

| Unit | Rarity | Stars | HP | Attack | Types | Ability |
|---|---|---|---|---|---|---|
| CHARMANDER | COMMON | 1 | 60 | 4 | DRAGON, FIRE | BLAST_BURN |
| CHARMELEON | COMMON | 2 | 120 | 8 | DRAGON, FIRE | BLAST_BURN |
| CHARIZARD | COMMON | 3 | 220 | 18 | DRAGON, FIRE, FLYING | BLAST_BURN |
| PIKACHU | COMMON | 2 | 120 | 8 | ELECTRIC, FAIRY | NUZZLE |
| RAICHU | COMMON | 3 | 220 | 17 | ELECTRIC, FAIRY | NUZZLE |
| ALOLAN_RAICHU | COMMON | 3 | 220 | 17 | ELECTRIC, FAIRY, PSYCHIC | NUZZLE |
| GALAR_MEOWTH | RARE | 1 | 90 | 9 | STEEL, WILD | METAL_CLAW |
| VESPIQUEN | UNIQUE | 3 | 190 | 16 | BUG, FLORA, GOURMET | VESPIQUEN_ORDERS |
| ARCEUS | LEGENDARY | 3 | 300 | 21 | — (none on bare instance) | JUDGEMENT |
| MAGIKARP | SPECIAL | 1 | 30 | 1 | WATER | SPLASH |
| GYARADOS | SPECIAL | 3 | 300 | 28 | DRAGON, WATER, FLYING | DRAGON_RAGE |
| TYPE_NULL | LEGENDARY | 2 | 260 | 20 | NORMAL, ARTIFICIAL | HEAD_SMASH |
| PRIMEAPE | EPIC | 2 | 240 | 20 | WILD, FIGHTING | THRASH |
| TEPIG | HATCH | 1 | 75 | 7 | WILD, FIRE, FIGHTING | HEAT_CRASH |
| DITTO | SPECIAL | 1 | 50 | 5 | AMORPHOUS | TRANSFORM |
| UNOWN_D | SPECIAL | 1 | 100 | 1 | PSYCHIC | HIDDEN_POWER_D |
| FARFETCH_D | UNIQUE | 3 | 200 | 20 | FLYING, GOURMET, NORMAL | RAZOR_WIND |
| TOTODILE | RARE | 1 | 75 | 7 | WATER, MONSTER, AQUATIC | BITE |
| COSMOEM | UNIQUE | 2 | 200 | 5 | PSYCHIC, LIGHT | TELEPORT |
| SUBSTITUTE | SPECIAL | 1 | 80 | 1 | — (none on bare instance) | DEFAULT |

Identity vs. family: `identity` is the unit; `evolutionFamilyRoot` (from `getPokemonBaseline`) is a separate field, e.g. PIKACHU/RAICHU/ALOLAN_RAICHU → `PICHU`,
VESPIQUEN → `COMBEE`, COSMOEM → `COSMOG`, PRIMEAPE → `MANKEY`. `bareInstanceEvolution` holds the raw `evolution` / `evolutions` fields of the instance.
**These do not form a complete evolution map** (see TYPE_NULL and PIKACHU below). Evolution rules/conditions are not extracted at all.

## Independent cross-check of five units (constructor/base class vs. extracted JSON)
Read directly from `app/models/colyseus-models/pokemon.ts`; the base-class speed default is `DEFAULT_SPEED = 50` (`app/config/game/battle.ts:7`).

| Unit | Class (lines) | HP | Atk | Speed | Types | Skill | Match |
|---|---|---|---|---|---|---|---|
| CHARMANDER | `Charmander` 5125–5138 | 60 | 4 | 57 (explicit) | DRAGON, FIRE | BLAST_BURN | ✔ all |
| FARFETCH_D | `Farfetchd` 6308–6323 | 200 | 20 | **50 (inherited default; not set in class)** | FLYING, GOURMET, NORMAL | RAZOR_WIND | ✔ all |
| VESPIQUEN | `Vespiquen` 12100–12113 | 190 | 16 | 38 | BUG, FLORA, GOURMET | VESPIQUEN_ORDERS | ✔ all |
| ARCEUS | `Arceus` 7219–7232 | 300 | 21 | 63 | **none** (`new SetSchema<Synergy>([])`) | JUDGEMENT | ✔ all |
| COSMOEM | `Cosmoem` 14812–14845 | 200 | 5 | 37 | PSYCHIC, LIGHT | TELEPORT | ✔ all |

Factory mapping lines in `PokemonClasses`: CHARMANDER 20913, ARCEUS 21168, FARFETCH_D 21439, VESPIQUEN 21521, COSMOEM 21723
(MAGIKARP 21077, TYPE_NULL 21696). **No discrepancies found** in HP, attack, speed, types or skill for these five.
Uncertainties: (a) this confirms the extractor matches the class definitions, not that the game applies them unmodified; (b) COSMOEM, see below, has an `onAcquired` hook that changes HP in play.

## Context notes (what the code establishes vs. what is untested)

### VESPIQUEN — position-dependent skill and range
- **Code establishes:** bare instance is range 3, skill `VESPIQUEN_ORDERS`, passive `VESPIQUEN` (`pokemon.ts:12100–12113`). The passive (`app/core/effects/passives.ts:1780–1793`)
  is an `OnChangePositionEffect`: row `newY === 1` → range 3 + `ATTACK_ORDER`; `2` → range 2 + `HEAL_ORDER`; `3` → range 1 + `DEFEND_ORDER`.
  `VESPIQUEN_ORDERS` itself is a plain `new AbilityStrategy()` (`app/core/abilities/abilities.ts:1272`). In the Bug-synergy clone effect (`app/core/effects/synergies.ts:887`) a Vespiquen produces **2 clones of COMBEE** rather than copies of itself.
- **Untested:** the behaviour of the three `*_ORDER` abilities (not read), what happens on other rows/bench, and whether the in-game stats shown to players differ.

### ARCEUS — no types on a bare instance
- **Code establishes:** `types` is empty, passive `PROTEAN3` (`pokemon.ts:7219–7232`). `app/models/colyseus-models/synergies.ts:104` clears the types of PROTEAN2/PROTEAN3 units on each recomputation,
  and `:160–` gives units not on the bench (`positionY !== 0`) up to 3 types (`PROTEAN3`) chosen from the board's top synergies, with Dragon forced first if it is among them. Shop spawn chance constant: `ARCEUS_RATE = 1/400` (`app/config/game/shop.ts:75`, used `app/models/shop.ts:528`).
- **Untested:** the resulting types in an actual game; the tie-breaking in `sortSynergies`; the exact shop conditions.

### COSMOEM — extracted HP is not the in-play HP after acquisition
- **Code establishes:** class (`pokemon.ts:14812–14845`) has HP 200, atk 5, def/speDef 16, range 4, stack-based evolution (`stacksRequired = 10`); `evolutions = [SOLGALEO, LUNALA]` and a `divergentEvolution` function
  picks SOLGALEO if the unit stands on the player's light cell and a Light synergy tier is active, otherwise LUNALA. Its `onAcquired(player)` does `stacks = -1`, `hp -= 10`, `hp -= 100`, `maxHP = hp`
  ("revert hp buffs of cosmog"). `onAcquired` has callers in `app/rooms/game-room.ts` (e.g. 1357, 1363, 1654) and `app/services/gift-shop.ts`. An on-evolution hook (`passives.ts:1929–1942`)
  gives COSMOG/COSMOEM on the board `+10 max HP` and `+1 stack` when another unit evolves. The audited commit's own subject is "revert cosmog and cosmoem passive buffs" (not diffed here).
- **Update:** [`pilot-evolution.md`](pilot-evolution.md) traces this: by code inspection `onAcquired` **is** called on the Cosmog→Cosmoem path (`app/models/colyseus-models/player.ts:356`, via `transformPokemon`). **Still unestablished:** a universal HP for a player-owned Cosmoem (it depends on the Cosmog's `maxHP` at evolution time and untraced item effects); treat 200 as the bare-class value only.

### TYPE_NULL — stars 2, item-triggered, many evolution targets
- **Code establishes:** LEGENDARY, **stars = 2**, HP 260, atk 20, def/speDef 12, passive `TYPE_NULL` (`pokemon.ts:10088–10155`). `evolution = SILVALLY`, but `evolutionRule` is `EvolutionRuleType.ITEM`
  with `itemsTriggeringEvolution = [...SynergyItems]` and a `divergentEvolution` switch that maps the item's synergy to a `SILVALLY_<TYPE>` variant (BUG, DARK, DRAGON, ELECTRIC, FAIRY, FIGHTING, FIRE, FLYING, GHOST, GRASS, GROUND, ICE, … — only the cases I read, through ICE).
  All `SILVALLY_*` map to family root `TYPE_NULL` in `PkmFamily` (`app/types/enum/Pokemon.ts:3103–`). Memory discs have an `OnItemDroppedEffect` predicate on the TYPE_NULL family (`app/core/effects/items.ts:1716`).
- **Therefore** `bareInstanceEvolution.evolution = SILVALLY` is only the default target; it is not the evolution map.
- **Untested:** the full variant list, the effect body for memory discs, and any behaviour of `Passive.TYPE_NULL` (no `PassiveEffects` entry for it was found in `passives.ts`; it may be display-only or handled elsewhere).

### MAGIKARP — evolves differently from the default rule
- **Code establishes:** SPECIAL, 1 star, HP 30, atk 1, maxPP 50, skill `SPLASH`, passive `MAGIKARP`, `evolution = GYARADOS` (3 stars, HP 300, atk 28) with
  `evolutionRule = { type: COUNT, numberRequired: 8 }` (`pokemon.ts:5169–5187`) versus the base default of 3 (`pokemon.ts:112–115`). Sell price entry `SellPrices.MAGIKARP` = 0 (`app/config/game/shop.ts:101–108`, used `app/models/shop.ts:125`).
  `Pkm.MAGIKARP` is returned as a fallback by the shop when, e.g., no Water Pokémon remain (`app/models/shop.ts:583–589`). A **shiny** Magikarp that dies on stage 1 gives its killer's player 10 gold (`app/core/pokemon-entity.ts:1286`).
- **Untested:** how the evolution manager applies `numberRequired: 8`, the other fallback returns in `shop.ts`, and `Passive.MAGIKARP` (no `PassiveEffects` entry found; may be display-only or handled elsewhere).

## Other observations from the JSON (not investigated)
- PIKACHU has `evolution = DEFAULT` yet `evolutions = [RAICHU, ALOLAN_RAICHU]`; COSMOEM likewise; most other units use `evolution` only. So the two fields are class-specific and neither is complete on its own.
- ALOLAN_RAICHU has passive `SURGE_SURFER` and an extra PSYCHIC type vs RAICHU with otherwise identical stats; TEPIG, PRIMEAPE, DITTO, UNOWN_D, SUBSTITUTE carry their own passives.
  SUBSTITUTE has `maxPP` 0 and its skill identifier is `DEFAULT` (the `Ability.DEFAULT` value; what that means in play was not investigated); UNOWN_D has range 9. Not verified beyond the extracted values.

## Not covered
Items, synergy effects, ability behaviour, combat, shop odds, live-game values. No team-composition or strategy advice is given.
