# Item effects — all 55 craftable recipe outputs

**Production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1`; deployment unverified.** The record for every ItemRecipe output (55 keys) is generated from [`item-effects.json`](../../data/07367c34/item-effects.json) (records and evidence ranges checked by `node assistant/validate-items.mjs`); recipes and declared bonuses come from [`item-recipes-stats.json`](../../data/07367c34/item-recipes-stats.json). **Source inspection only: no probe, no gameplay evidence.** Not the development snapshot.

**How to read.** *Declared* = values in `ItemRecipe`/`ItemStats`. *Traced* = handler and caller read. *Arithmetic* = a formula applied by hand, **not a combat simulation**. *Conditional deduction* = inference from the traced rules, not a ranking and not tested. *Unresolved* = not traced (this is different from *absent*). Shared rules (damage order, ability crit, PP, item path): [core-mechanics.md](core-mechanics.md) §H–I. Scarf items: [silk-scarf-items.md](silk-scarf-items.md).

## Summary

| Item | Recipe | Declared bonuses | Effect in one line |
|---|---|---|---|
| OLD_AMBER | Fossil Stone + Fossil Stone | none (empty entry) | Grants the Fossil type (no stat bonus) |
| DAWN_STONE | Fossil Stone + Twisted Spoon | AP 20 | Grants the Psychic type; +20 AP |
| WATER_STONE | Fossil Stone + Mystic Water | PP 30 | Grants the Water type; +30 current PP |
| THUNDER_STONE | Fossil Stone + Magnet | SPEED 20 | Grants the Electric type; +20 speed |
| FIRE_STONE | Fossil Stone + Charcoal | ATK 6 | Grants the Fire type; +6 ATK |
| MOON_STONE | Fossil Stone + Heart Scale | DEF 6 | Grants the Fairy type; +6 DEF |
| DUSK_STONE | Fossil Stone + Black Glasses | CRIT_CHANCE 20 | Grants the Dark type; +20 crit chance |
| LEAF_STONE | Fossil Stone + Miracle Seed | HP 30 | Grants the Grass type; +30 HP |
| ICE_STONE | Fossil Stone + Never Melt Ice | SPE_DEF 6 | Grants the Ice type; +6 SPE_DEF |
| CHOICE_SPECS | Twisted Spoon + Twisted Spoon | AP 100 | No behavior beyond +100 AP |
| SOUL_DEW | Twisted Spoon + Mystic Water | none (empty entry) | +5 AP and +5 PP every 1000 ms |
| UPGRADE | Twisted Spoon + Magnet | AP 10, SPEED 10 | +5 speed per basic attack |
| REAPER_CLOTH | Twisted Spoon + Black Glasses | AP 10, CRIT_CHANCE 20 | Lets casts crit (+50 crit power if the ability crits by default) |
| ABILITY_SHIELD | Twisted Spoon + Miracle Seed | AP 10 | Setup: shield 20 % max HP and 5 s Rune Protect to allies on its cell and left/right |
| POWER_LENS | Twisted Spoon + Never Melt Ice | SPE_DEF 10, AP 10 | Reflects the SPE_DEF-mitigated part of special damage taken |
| POKEMONOMICON | Twisted Spoon + Charcoal | AP 30, ATK 3 | Special damage burns (3 s) and -1 SPE_DEF |
| HEAVY_DUTY_BOOTS | Twisted Spoon + Heart Scale | AP 50, DEF 12 | Immune to Locked, forced moves and listed board effects |
| AQUA_EGG | Mystic Water + Mystic Water | PP 30 | PP back after each cast; Manaphy spawns Phione |
| BLUE_ORB | Mystic Water + Magnet | PP 15, SPEED 10 | Every 3rd attack: 10 dmg and -15 PP to 2 nearest enemies |
| SCOPE_LENS | Mystic Water + Black Glasses | PP 15, CRIT_CHANCE 25 | Crit attack steals up to 10 PP |
| STAR_DUST | Mystic Water + Never Melt Ice | SPE_DEF 10, PP 15 | Shield of 50 % maxPP after each cast |
| GREEN_ORB | Mystic Water + Miracle Seed | HP 15 | Every 2 s heals 5 % max HP to allies in its 3x3; overheal becomes PP |
| DEEP_SEA_TOOTH | Mystic Water + Charcoal | ATK 7, PP 15 | +5 PP per basic attack, +15 more on a kill |
| SHINY_CHARM | Mystic Water + Heart Scale | DEF 3 | Cancels the first hit leaving HP < 30 % (+50 PP, 1.5 s protect) |
| XRAY_VISION | Magnet + Magnet | SPEED 50 | Sleep immunity; its basic attacks ignore dodge |
| RAZOR_FANG | Magnet + Black Glasses | SPEED 10, CRIT_CHANCE 10, CRIT_POWER 50 | Successful basic attacks halve target DEF/SPE_DEF for 2 s |
| GRACIDEA_FLOWER | Magnet + Miracle Seed | none (no entry) | Setup: +20 speed to units on its cell and left/right (no team check seen) |
| LOADED_DICE | Magnet + Never Melt Ice | SPEED 10, SPE_DEF 3, LUCK 20 | ~50 % (luck-adjusted) second hit at 75 % on a neighbor of the target |
| PUNCHING_GLOVE | Magnet + Charcoal | SPEED 10, ATK 3 | +8 % target max HP physical damage per basic attack |
| MUSCLE_BAND | Magnet + Heart Scale | SPEED 10, DEF 3 | Per 2 hits taken: +1 ATK, +2 DEF, +5 speed (max 10 stacks) |
| WONDER_BOX | Black Glasses + Black Glasses | none (no entry) | Opens at fight setup into two random recipe-output items |
| SMOKE_BALL | Black Glasses + Miracle Seed | CRIT_CHANCE 10 | Surviving a hit that leaves it below 40 % HP: paralyze+blind neighbors, +50 shield, fly away (once; no save from a lethal hit) |
| WIDE_LENS | Black Glasses + Never Melt Ice | RANGE 2, CRIT_CHANCE 15, SPE_DEF 3 | +2 range (kept after Locked ends); does not enlarge caster-centered areas |
| RAZOR_CLAW | Black Glasses + Charcoal | CRIT_CHANCE 50, ATK 3 | No behavior beyond +50 crit chance and +3 ATK |
| SAFETY_GOGGLES | Black Glasses + Heart Scale | CRIT_CHANCE 10, DEF 3 | 60 s Rune Protect; no sandstorm or bench-lava damage |
| KINGS_ROCK | Miracle Seed + Miracle Seed | HP 100 | Start-of-fight shield of 20 % max HP |
| STICKY_BARB | Miracle Seed + Heart Scale | DEF 6, HP 15 | Melee attackers take true damage 3 + 0.15 DEF and Wound |
| PROTECTIVE_PADS | Miracle Seed + Charcoal | SHIELD 60, ATK 6 | Skips retaliation/recoil at the sites found; doubles damage assigned to shields (excess passes to HP when the shield breaks) |
| MAX_REVIVE | Miracle Seed + Never Melt Ice | none (no entry) | One revival at full HP after 2 s |
| ASSAULT_VEST | Never Melt Ice + Never Melt Ice | SPE_DEF 40 | Burn and poison damage x0.5 (and bench lava burn) |
| SHELL_BELL | Never Melt Ice + Charcoal | ATK 5, SPE_DEF 5 | Heals ceil(33 %) of damage dealt |
| POKE_DOLL | Never Melt Ice + Heart Scale | DEF 3, SPE_DEF 3 | Non-true damage x0.7; preferred among nearest targets |
| RED_ORB | Charcoal + Charcoal | ATK 10 | 25 % of basic-attack damage becomes true damage |
| FLAME_ORB | Charcoal + Heart Scale | ATK 5, DEF 3 | Adds base ATK again and attempts a lasting self-burn (5 % max HP/s) that Rune Protect, burn immunity or Water Bubble can block |
| ROCKY_HELMET | Heart Scale + Heart Scale | DEF 25 | Cancels the crit damage bonus against the holder |
| FRIEND_BOW | Silk Scarf + Fossil Stone | SHIELD 30 | Grants the Normal type (refused/popped if already Normal); shield 30 |
| BLACK_BELT | Silk Scarf + Black Glasses | SHIELD 15, CRIT_CHANCE 30 | Crit basic attack: shield of 33 % of pre-defense attack damage |
| MACH_RIBBON | Silk Scarf + Magnet | SHIELD 15, SPEED 10 | +20 speed every 3000 ms |
| EXPLOSIVE_BAND | Silk Scarf + Charcoal | SHIELD 50, ATK 3 | Once, when its shield first depletes: 50 % of shield granted so far as special damage to adjacent enemies |
| TWIST_BAND | Silk Scarf + Never Melt Ice | SPE_DEF 20, SHIELD 50 | Enemy/environment stat reductions to 11 stats become gains |
| LUCKY_RIBBON | Silk Scarf + Twisted Spoon | SHIELD 15, AP 50, LUCK 20 | +15 % dodge at fight start |
| BIG_EATER_BELT | Silk Scarf + Miracle Seed | HP 50, SHIELD 15 | Gains (and same-team reductions) to 11 stats x1.25 (not PP); can eat a second dish |
| COVER_BAND | Silk Scarf + Heart Scale | DEF 12, SHIELD 50 | Lethal hit on an adjacent ally is redirected to the holder |
| EFFICIENT_BANDANNA | Silk Scarf + Mystic Water | SHIELD 15, PP 15 | Max PP x0.85 for units on its cell and left/right (no team check) |
| NULLIFY_BANDANNA | Silk Scarf + Silk Scarf | SHIELD 30 | Cannot cast; basic attacks spend all PP as extra special damage; AP gains become 0.2x ATK |

### OLD_AMBER

**Recipe** (declared): Fossil Stone + Fossil Stone. **Declared bonuses:** none — ItemStats entry exists but is empty: no stat bonus. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `old_amber-type` (traced)** — *Trigger:* When the stone is held by a board unit (computeSynergies adds item-granted types to every board unit; only units not on the bench count) and, in the fight, when the fight entity is built from that unit. *Targets:* holder. *Effect:* Grants the Fossil type (SynergyGivenByItem). In ordinary base counting each evolution family adds at most 1 to the Fossil count (Dragon doubling and special game rules can change the final count, see core-mechanics section E); the tier effect switches on only when the final count reaches the first threshold [2, 4, 6]. Granting the type is not the same as activating a tier. *Duration:* While held. *Scaling:* No AP/crit. *Limits:* Equip is refused if the holder already has the type: the OnItemDropped effect (stones), the drop command and PokemonEntity.addItem all check it; in the combine path the finished stone pops back to the inventory instead. Removal paths differ. Board unit (Pokemon.removeItems): the type is removed unless it is native to the unit or another held item still grants it. Fight entity (PokemonEntity.removeItemEffect): the type is removed when it is not among the species' default types, together with that type's tier effects for the entity, without checking other held type-granting items. *Consumption/reset:* Not consumed.
- **Effect `old_amber-stats` (declared)** — *Trigger:* Item applied at fight start. *Targets:* holder. *Effect:* Declared bonus: none (empty ItemStats entry). *Duration:* Whole fight. *Scaling:* Generic stat helpers (see core-mechanics section I). *Limits:* -. *Consumption/reset:* Not consumed.
- **Effect `old_amber-evo` (declared)** — *Trigger:* Item evolution rule on Type Null. *Targets:* Type Null. *Effect:* Type Null's ITEM rule accepts every synergy item; the granted Fossil type maps to SILVALLY_DRAGON (the Fossil type maps to the Dragon Silvally in Type Null's switch). Eevee's rule does not list Old Amber. Handler paths not traced. *Duration:* -. *Scaling:* -. *Limits:* Silvally's RKS_SYSTEM passive removes synergy items when the unit is moved to the bench (read at the guard only). *Consumption/reset:* -.

*Note:* Exchange tickets can swap a stone for another random stone (game-commands.ts:627-628); stones can also come from other sources not traced here.

*Arithmetic:* One stone adds 1 to the Fossil count for its unit's family; with thresholds [2, 4, 6] a single stone cannot reach the first threshold unless the team already has enough other Fossil units (ordinary base counting; Dragon doubling and special rules can change counts). Formula only.

*Unresolved / untested:* Handler paths of the evolution rules (Eevee, Type Null) were not traced; How the team reaches the tier (other units of the type, bonus synergies) is outside this record; Interaction of the granted type with that synergy's own tier effects is not audited.

*Conditional deduction (inference, not a ranking):* Granting Fossil adds one to the Fossil count (once per family) but a tier needs 2/4/6 Fossil units, so by itself it does not activate Fossil effects.

*Sources:* `types/enum/Item.ts:815`; `config/game/synergies.ts:203`; `types/enum/Item.ts:699–709`; `core/effects/items.ts:524–536`; `rooms/commands/game-commands.ts:935–945`; `rooms/commands/game-commands.ts:799–822`; `rooms/commands/game-commands.ts:923–931`; `core/pokemon-entity.ts:782–792`; `core/pokemon-entity.ts:807–814`; `core/pokemon-entity.ts:853–864`; `models/colyseus-models/pokemon.ts:268–285`; `core/pokemon-entity.ts:212–214`; `models/colyseus-models/synergies.ts:110–125`; `models/colyseus-models/synergies.ts:287–297`; `models/effects.ts:14–25`; `config/game/items.ts:13`; `core/pokemon-entity.ts:1399–1437`; `models/colyseus-models/pokemon.ts:10139`; `core/effects/passives.ts:1700–1713`; `models/colyseus-models/pokemon.ts:10148`

### DAWN_STONE

**Recipe** (declared): Fossil Stone + Twisted Spoon. **Declared bonuses:** AP 20. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `dawn_stone-type` (traced)** — *Trigger:* When the stone is held by a board unit (computeSynergies adds item-granted types to every board unit; only units not on the bench count) and, in the fight, when the fight entity is built from that unit. *Targets:* holder. *Effect:* Grants the Psychic type (SynergyGivenByItem). In ordinary base counting each evolution family adds at most 1 to the Psychic count (Dragon doubling and special game rules can change the final count, see core-mechanics section E); the tier effect switches on only when the final count reaches the first threshold [3, 5, 7]. Granting the type is not the same as activating a tier. *Duration:* While held. *Scaling:* No AP/crit. *Limits:* Equip is refused if the holder already has the type: the OnItemDropped effect (stones), the drop command and PokemonEntity.addItem all check it; in the combine path the finished stone pops back to the inventory instead. Removal paths differ. Board unit (Pokemon.removeItems): the type is removed unless it is native to the unit or another held item still grants it. Fight entity (PokemonEntity.removeItemEffect): the type is removed when it is not among the species' default types, together with that type's tier effects for the entity, without checking other held type-granting items. *Consumption/reset:* Not consumed.
- **Effect `dawn_stone-stats` (declared)** — *Trigger:* Item applied at fight start. *Targets:* holder. *Effect:* Declared bonus: AP 20. *Duration:* Whole fight. *Scaling:* Generic stat helpers (see core-mechanics section I). *Limits:* -. *Consumption/reset:* Not consumed.
- **Effect `dawn_stone-evo` (declared)** — *Trigger:* Item evolution rules that list this item. *Targets:* Eevee, Type Null. *Effect:* Eevee: holding this stone makes it evolve to Espeon (Eevee's ITEM rule lists eight stones; divergentEvolution maps each). Type Null: its ITEM rule accepts every synergy item and divergentEvolution picks Silvally form by the synergy the item grants: SILVALLY_PSYCHIC. Handler paths not traced; only these declarations. *Duration:* -. *Scaling:* -. *Limits:* Silvally's RKS_SYSTEM passive removes synergy items when the unit is moved to the bench (passives.ts, read at the guard only). *Consumption/reset:* -.

*Note:* Exchange tickets can swap a stone for another random stone (game-commands.ts:627-628); stones can also come from other sources not traced here.

*Arithmetic:* One stone adds 1 to the Psychic count for its unit's family; with thresholds [3, 5, 7] a single stone cannot reach the first threshold unless the team already has enough other Psychic units (ordinary base counting; Dragon doubling and special rules can change counts). Formula only.

*Unresolved / untested:* Handler paths of the evolution rules (Eevee, Type Null) were not traced; How the team reaches the tier (other units of the type, bonus synergies) is outside this record; Interaction of the granted type with that synergy's own tier effects is not audited.

*Conditional deduction (inference, not a ranking):* Adds one to the Psychic count; Psychic's first tier needs 3 (3/5/7). The +20 AP only helps AP-scaled effects.

*Sources:* `types/enum/Item.ts:816`; `config/game/synergies.ts:186`; `types/enum/Item.ts:699–709`; `core/effects/items.ts:524–536`; `rooms/commands/game-commands.ts:935–945`; `rooms/commands/game-commands.ts:799–822`; `rooms/commands/game-commands.ts:923–931`; `core/pokemon-entity.ts:782–792`; `core/pokemon-entity.ts:807–814`; `core/pokemon-entity.ts:853–864`; `models/colyseus-models/pokemon.ts:268–285`; `core/pokemon-entity.ts:212–214`; `models/colyseus-models/synergies.ts:110–125`; `models/colyseus-models/synergies.ts:287–297`; `models/effects.ts:14–25`; `config/game/items.ts:14`; `core/pokemon-entity.ts:1399–1437`; `models/colyseus-models/pokemon.ts:6130–6141`; `models/colyseus-models/pokemon.ts:6142–6163`; `models/colyseus-models/pokemon.ts:10139`; `core/effects/passives.ts:1700–1713`; `models/colyseus-models/pokemon.ts:10175`

### WATER_STONE

**Recipe** (declared): Fossil Stone + Mystic Water. **Declared bonuses:** PP 30. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `water_stone-type` (traced)** — *Trigger:* When the stone is held by a board unit (computeSynergies adds item-granted types to every board unit; only units not on the bench count) and, in the fight, when the fight entity is built from that unit. *Targets:* holder. *Effect:* Grants the Water type (SynergyGivenByItem). In ordinary base counting each evolution family adds at most 1 to the Water count (Dragon doubling and special game rules can change the final count, see core-mechanics section E); the tier effect switches on only when the final count reaches the first threshold [3, 6, 9]. Granting the type is not the same as activating a tier. *Duration:* While held. *Scaling:* No AP/crit. *Limits:* Equip is refused if the holder already has the type: the OnItemDropped effect (stones), the drop command and PokemonEntity.addItem all check it; in the combine path the finished stone pops back to the inventory instead. Removal paths differ. Board unit (Pokemon.removeItems): the type is removed unless it is native to the unit or another held item still grants it. Fight entity (PokemonEntity.removeItemEffect): the type is removed when it is not among the species' default types, together with that type's tier effects for the entity, without checking other held type-granting items. *Consumption/reset:* Not consumed.
- **Effect `water_stone-stats` (declared)** — *Trigger:* Item applied at fight start. *Targets:* holder. *Effect:* Declared bonus: PP 30 (added to current PP, never maxPP). *Duration:* Whole fight. *Scaling:* Generic stat helpers (see core-mechanics section I). *Limits:* -. *Consumption/reset:* Not consumed.
- **Effect `water_stone-evo` (declared)** — *Trigger:* Item evolution rules that list this item. *Targets:* Eevee, Type Null. *Effect:* Eevee: holding this stone makes it evolve to Vaporeon (Eevee's ITEM rule lists eight stones; divergentEvolution maps each). Type Null: its ITEM rule accepts every synergy item and divergentEvolution picks Silvally form by the synergy the item grants: SILVALLY_WATER. Handler paths not traced; only these declarations. *Duration:* -. *Scaling:* -. *Limits:* Silvally's RKS_SYSTEM passive removes synergy items when the unit is moved to the bench (passives.ts, read at the guard only). *Consumption/reset:* -.

*Note:* Exchange tickets can swap a stone for another random stone (game-commands.ts:627-628); stones can also come from other sources not traced here.

*Arithmetic:* One stone adds 1 to the Water count for its unit's family; with thresholds [3, 6, 9] a single stone cannot reach the first threshold unless the team already has enough other Water units (ordinary base counting; Dragon doubling and special rules can change counts). Formula only.

*Unresolved / untested:* Handler paths of the evolution rules (Eevee, Type Null) were not traced; How the team reaches the tier (other units of the type, bonus synergies) is outside this record; Interaction of the granted type with that synergy's own tier effects is not audited.

*Conditional deduction (inference, not a ranking):* Adds one to the Water count (3/6/9). Its PP goes to current PP, so a caster starts closer to its threshold.

*Sources:* `types/enum/Item.ts:817`; `config/game/synergies.ts:183`; `types/enum/Item.ts:699–709`; `core/effects/items.ts:524–536`; `rooms/commands/game-commands.ts:935–945`; `rooms/commands/game-commands.ts:799–822`; `rooms/commands/game-commands.ts:923–931`; `core/pokemon-entity.ts:782–792`; `core/pokemon-entity.ts:807–814`; `core/pokemon-entity.ts:853–864`; `models/colyseus-models/pokemon.ts:268–285`; `core/pokemon-entity.ts:212–214`; `models/colyseus-models/synergies.ts:110–125`; `models/colyseus-models/synergies.ts:287–297`; `models/effects.ts:14–25`; `config/game/items.ts:15`; `core/pokemon-entity.ts:1399–1437`; `models/colyseus-models/pokemon.ts:6130–6141`; `models/colyseus-models/pokemon.ts:6142–6163`; `models/colyseus-models/pokemon.ts:10139`; `core/effects/passives.ts:1700–1713`; `models/colyseus-models/pokemon.ts:10183`

### THUNDER_STONE

**Recipe** (declared): Fossil Stone + Magnet. **Declared bonuses:** SPEED 20. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `thunder_stone-type` (traced)** — *Trigger:* When the stone is held by a board unit (computeSynergies adds item-granted types to every board unit; only units not on the bench count) and, in the fight, when the fight entity is built from that unit. *Targets:* holder. *Effect:* Grants the Electric type (SynergyGivenByItem). In ordinary base counting each evolution family adds at most 1 to the Electric count (Dragon doubling and special game rules can change the final count, see core-mechanics section E); the tier effect switches on only when the final count reaches the first threshold [3, 5, 7]. Granting the type is not the same as activating a tier. *Duration:* While held. *Scaling:* No AP/crit. *Limits:* Equip is refused if the holder already has the type: the OnItemDropped effect (stones), the drop command and PokemonEntity.addItem all check it; in the combine path the finished stone pops back to the inventory instead. Removal paths differ. Board unit (Pokemon.removeItems): the type is removed unless it is native to the unit or another held item still grants it. Fight entity (PokemonEntity.removeItemEffect): the type is removed when it is not among the species' default types, together with that type's tier effects for the entity, without checking other held type-granting items. *Consumption/reset:* Not consumed.
- **Effect `thunder_stone-stats` (declared)** — *Trigger:* Item applied at fight start. *Targets:* holder. *Effect:* Declared bonus: SPEED 20. *Duration:* Whole fight. *Scaling:* Generic stat helpers (see core-mechanics section I). *Limits:* -. *Consumption/reset:* Not consumed.
- **Effect `thunder_stone-evo` (declared)** — *Trigger:* Item evolution rules that list this item. *Targets:* Eevee, Type Null. *Effect:* Eevee: holding this stone makes it evolve to Jolteon (Eevee's ITEM rule lists eight stones; divergentEvolution maps each). Type Null: its ITEM rule accepts every synergy item and divergentEvolution picks Silvally form by the synergy the item grants: SILVALLY_ELECTRIC. Handler paths not traced; only these declarations. *Duration:* -. *Scaling:* -. *Limits:* Silvally's RKS_SYSTEM passive removes synergy items when the unit is moved to the bench (passives.ts, read at the guard only). *Consumption/reset:* -.

*Note:* Exchange tickets can swap a stone for another random stone (game-commands.ts:627-628); stones can also come from other sources not traced here.

*Arithmetic:* One stone adds 1 to the Electric count for its unit's family; with thresholds [3, 5, 7] a single stone cannot reach the first threshold unless the team already has enough other Electric units (ordinary base counting; Dragon doubling and special rules can change counts). Formula only.

*Unresolved / untested:* Handler paths of the evolution rules (Eevee, Type Null) were not traced; How the team reaches the tier (other units of the type, bonus synergies) is outside this record; Interaction of the granted type with that synergy's own tier effects is not audited.

*Conditional deduction (inference, not a ranking):* Adds one to the Electric count (3/5/7); +20 speed shortens attack waits.

*Sources:* `types/enum/Item.ts:818`; `config/game/synergies.ts:184`; `types/enum/Item.ts:699–709`; `core/effects/items.ts:524–536`; `rooms/commands/game-commands.ts:935–945`; `rooms/commands/game-commands.ts:799–822`; `rooms/commands/game-commands.ts:923–931`; `core/pokemon-entity.ts:782–792`; `core/pokemon-entity.ts:807–814`; `core/pokemon-entity.ts:853–864`; `models/colyseus-models/pokemon.ts:268–285`; `core/pokemon-entity.ts:212–214`; `models/colyseus-models/synergies.ts:110–125`; `models/colyseus-models/synergies.ts:287–297`; `models/effects.ts:14–25`; `config/game/items.ts:16`; `core/pokemon-entity.ts:1399–1437`; `models/colyseus-models/pokemon.ts:6130–6141`; `models/colyseus-models/pokemon.ts:6142–6163`; `models/colyseus-models/pokemon.ts:10139`; `core/effects/passives.ts:1700–1713`; `models/colyseus-models/pokemon.ts:10150`

### FIRE_STONE

**Recipe** (declared): Fossil Stone + Charcoal. **Declared bonuses:** ATK 6. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `fire_stone-type` (traced)** — *Trigger:* When the stone is held by a board unit (computeSynergies adds item-granted types to every board unit; only units not on the bench count) and, in the fight, when the fight entity is built from that unit. *Targets:* holder. *Effect:* Grants the Fire type (SynergyGivenByItem). In ordinary base counting each evolution family adds at most 1 to the Fire count (Dragon doubling and special game rules can change the final count, see core-mechanics section E); the tier effect switches on only when the final count reaches the first threshold [2, 4, 6, 8]. Granting the type is not the same as activating a tier. *Duration:* While held. *Scaling:* No AP/crit. *Limits:* Equip is refused if the holder already has the type: the OnItemDropped effect (stones), the drop command and PokemonEntity.addItem all check it; in the combine path the finished stone pops back to the inventory instead. Removal paths differ. Board unit (Pokemon.removeItems): the type is removed unless it is native to the unit or another held item still grants it. Fight entity (PokemonEntity.removeItemEffect): the type is removed when it is not among the species' default types, together with that type's tier effects for the entity, without checking other held type-granting items. *Consumption/reset:* Not consumed.
- **Effect `fire_stone-stats` (declared)** — *Trigger:* Item applied at fight start. *Targets:* holder. *Effect:* Declared bonus: ATK 6. *Duration:* Whole fight. *Scaling:* Generic stat helpers (see core-mechanics section I). *Limits:* -. *Consumption/reset:* Not consumed.
- **Effect `fire_stone-evo` (declared)** — *Trigger:* Item evolution rules that list this item. *Targets:* Eevee, Type Null. *Effect:* Eevee: holding this stone makes it evolve to Flareon (Eevee's ITEM rule lists eight stones; divergentEvolution maps each). Type Null: its ITEM rule accepts every synergy item and divergentEvolution picks Silvally form by the synergy the item grants: SILVALLY_FIRE. Handler paths not traced; only these declarations. *Duration:* -. *Scaling:* -. *Limits:* Silvally's RKS_SYSTEM passive removes synergy items when the unit is moved to the bench (passives.ts, read at the guard only). *Consumption/reset:* -.

*Note:* Exchange tickets can swap a stone for another random stone (game-commands.ts:627-628); stones can also come from other sources not traced here.

*Arithmetic:* One stone adds 1 to the Fire count for its unit's family; with thresholds [2, 4, 6, 8] a single stone cannot reach the first threshold unless the team already has enough other Fire units (ordinary base counting; Dragon doubling and special rules can change counts). Formula only.

*Unresolved / untested:* Handler paths of the evolution rules (Eevee, Type Null) were not traced; How the team reaches the tier (other units of the type, bonus synergies) is outside this record; Interaction of the granted type with that synergy's own tier effects is not audited.

*Conditional deduction (inference, not a ranking):* Adds one to the Fire count (2/4/6/8); the +6 ATK helps basic attacks.

*Sources:* `types/enum/Item.ts:819`; `config/game/synergies.ts:182`; `types/enum/Item.ts:699–709`; `core/effects/items.ts:524–536`; `rooms/commands/game-commands.ts:935–945`; `rooms/commands/game-commands.ts:799–822`; `rooms/commands/game-commands.ts:923–931`; `core/pokemon-entity.ts:782–792`; `core/pokemon-entity.ts:807–814`; `core/pokemon-entity.ts:853–864`; `models/colyseus-models/pokemon.ts:268–285`; `core/pokemon-entity.ts:212–214`; `models/colyseus-models/synergies.ts:110–125`; `models/colyseus-models/synergies.ts:287–297`; `models/effects.ts:14–25`; `config/game/items.ts:17`; `core/pokemon-entity.ts:1399–1437`; `models/colyseus-models/pokemon.ts:6130–6141`; `models/colyseus-models/pokemon.ts:6142–6163`; `models/colyseus-models/pokemon.ts:10139`; `core/effects/passives.ts:1700–1713`; `models/colyseus-models/pokemon.ts:10159`

### MOON_STONE

**Recipe** (declared): Fossil Stone + Heart Scale. **Declared bonuses:** DEF 6. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `moon_stone-type` (traced)** — *Trigger:* When the stone is held by a board unit (computeSynergies adds item-granted types to every board unit; only units not on the bench count) and, in the fight, when the fight entity is built from that unit. *Targets:* holder. *Effect:* Grants the Fairy type (SynergyGivenByItem). In ordinary base counting each evolution family adds at most 1 to the Fairy count (Dragon doubling and special game rules can change the final count, see core-mechanics section E); the tier effect switches on only when the final count reaches the first threshold [2, 4, 6, 8]. Granting the type is not the same as activating a tier. *Duration:* While held. *Scaling:* No AP/crit. *Limits:* Equip is refused if the holder already has the type: the OnItemDropped effect (stones), the drop command and PokemonEntity.addItem all check it; in the combine path the finished stone pops back to the inventory instead. Removal paths differ. Board unit (Pokemon.removeItems): the type is removed unless it is native to the unit or another held item still grants it. Fight entity (PokemonEntity.removeItemEffect): the type is removed when it is not among the species' default types, together with that type's tier effects for the entity, without checking other held type-granting items. *Consumption/reset:* Not consumed.
- **Effect `moon_stone-stats` (declared)** — *Trigger:* Item applied at fight start. *Targets:* holder. *Effect:* Declared bonus: DEF 6. *Duration:* Whole fight. *Scaling:* Generic stat helpers (see core-mechanics section I). *Limits:* -. *Consumption/reset:* Not consumed.
- **Effect `moon_stone-evo` (declared)** — *Trigger:* Item evolution rules that list this item. *Targets:* Eevee, Type Null. *Effect:* Eevee: holding this stone makes it evolve to Sylveon (Eevee's ITEM rule lists eight stones; divergentEvolution maps each). Type Null: its ITEM rule accepts every synergy item and divergentEvolution picks Silvally form by the synergy the item grants: SILVALLY_FAIRY. Handler paths not traced; only these declarations. *Duration:* -. *Scaling:* -. *Limits:* Silvally's RKS_SYSTEM passive removes synergy items when the unit is moved to the bench (passives.ts, read at the guard only). *Consumption/reset:* -.

*Note:* Exchange tickets can swap a stone for another random stone (game-commands.ts:627-628); stones can also come from other sources not traced here.

*Arithmetic:* One stone adds 1 to the Fairy count for its unit's family; with thresholds [2, 4, 6, 8] a single stone cannot reach the first threshold unless the team already has enough other Fairy units (ordinary base counting; Dragon doubling and special rules can change counts). Formula only.

*Unresolved / untested:* Handler paths of the evolution rules (Eevee, Type Null) were not traced; How the team reaches the tier (other units of the type, bonus synergies) is outside this record; Interaction of the granted type with that synergy's own tier effects is not audited.

*Conditional deduction (inference, not a ranking):* Adds one to the Fairy count (2/4/6/8); +6 DEF.

*Sources:* `types/enum/Item.ts:820`; `config/game/synergies.ts:201`; `types/enum/Item.ts:699–709`; `core/effects/items.ts:524–536`; `rooms/commands/game-commands.ts:935–945`; `rooms/commands/game-commands.ts:799–822`; `rooms/commands/game-commands.ts:923–931`; `core/pokemon-entity.ts:782–792`; `core/pokemon-entity.ts:807–814`; `core/pokemon-entity.ts:853–864`; `models/colyseus-models/pokemon.ts:268–285`; `core/pokemon-entity.ts:212–214`; `models/colyseus-models/synergies.ts:110–125`; `models/colyseus-models/synergies.ts:287–297`; `models/effects.ts:14–25`; `config/game/items.ts:18`; `core/pokemon-entity.ts:1399–1437`; `models/colyseus-models/pokemon.ts:6130–6141`; `models/colyseus-models/pokemon.ts:6142–6163`; `models/colyseus-models/pokemon.ts:10139`; `core/effects/passives.ts:1700–1713`; `models/colyseus-models/pokemon.ts:10153`

### DUSK_STONE

**Recipe** (declared): Fossil Stone + Black Glasses. **Declared bonuses:** CRIT_CHANCE 20. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `dusk_stone-type` (traced)** — *Trigger:* When the stone is held by a board unit (computeSynergies adds item-granted types to every board unit; only units not on the bench count) and, in the fight, when the fight entity is built from that unit. *Targets:* holder. *Effect:* Grants the Dark type (SynergyGivenByItem). In ordinary base counting each evolution family adds at most 1 to the Dark count (Dragon doubling and special game rules can change the final count, see core-mechanics section E); the tier effect switches on only when the final count reaches the first threshold [3, 5, 7]. Granting the type is not the same as activating a tier. *Duration:* While held. *Scaling:* No AP/crit. *Limits:* Equip is refused if the holder already has the type: the OnItemDropped effect (stones), the drop command and PokemonEntity.addItem all check it; in the combine path the finished stone pops back to the inventory instead. Removal paths differ. Board unit (Pokemon.removeItems): the type is removed unless it is native to the unit or another held item still grants it. Fight entity (PokemonEntity.removeItemEffect): the type is removed when it is not among the species' default types, together with that type's tier effects for the entity, without checking other held type-granting items. *Consumption/reset:* Not consumed.
- **Effect `dusk_stone-stats` (declared)** — *Trigger:* Item applied at fight start. *Targets:* holder. *Effect:* Declared bonus: CRIT_CHANCE 20 (percentage points). *Duration:* Whole fight. *Scaling:* Generic stat helpers (see core-mechanics section I). *Limits:* -. *Consumption/reset:* Not consumed.
- **Effect `dusk_stone-evo` (declared)** — *Trigger:* Item evolution rules that list this item. *Targets:* Eevee, Type Null. *Effect:* Eevee: holding this stone makes it evolve to Umbreon (Eevee's ITEM rule lists eight stones; divergentEvolution maps each). Type Null: its ITEM rule accepts every synergy item and divergentEvolution picks Silvally form by the synergy the item grants: SILVALLY_DARK. Handler paths not traced; only these declarations. *Duration:* -. *Scaling:* -. *Limits:* Silvally's RKS_SYSTEM passive removes synergy items when the unit is moved to the bench (passives.ts, read at the guard only). *Consumption/reset:* -.
- **Effect `dusk-stone-cd` (traced)** — *Trigger:* Fight entity construction. *Targets:* holder (Dark-type with range 1). *Effect:* A Dark-type unit with range 1 (melee) gets a fixed initial cooldown of 300 instead of resetCooldown(500) (about 667 at speed 50, nominal). The entity starts in MovingState, so this is not a guaranteed first attack, and it does not guarantee acting before every other unit (other units' cooldowns, speed, movement and targeting also apply). It follows from the Dark TYPE that Dusk Stone grants, not from the item itself. *Duration:* Start of fight. *Scaling:* None. *Limits:* Only for range 1 Dark units. *Consumption/reset:* -.

*Note:* Exchange tickets can swap a stone for another random stone (game-commands.ts:627-628); stones can also come from other sources not traced here.

*Arithmetic:* One stone adds 1 to the Dark count for its unit's family; with thresholds [3, 5, 7] a single stone cannot reach the first threshold unless the team already has enough other Dark units (ordinary base counting; Dragon doubling and special rules can change counts). Formula only.

*Unresolved / untested:* Handler paths of the evolution rules (Eevee, Type Null) were not traced; How the team reaches the tier (other units of the type, bonus synergies) is outside this record; Interaction of the granted type with that synergy's own tier effects is not audited.

*Conditional deduction (inference, not a ranking):* Adds one to the Dark count in ordinary counting (3/5/7); as a Dark type a melee holder gets a shorter initial cooldown (300, nominal) but starts in MovingState, so a first attack is not guaranteed.

*Sources:* `types/enum/Item.ts:821`; `config/game/synergies.ts:187`; `types/enum/Item.ts:699–709`; `core/effects/items.ts:524–536`; `rooms/commands/game-commands.ts:935–945`; `rooms/commands/game-commands.ts:799–822`; `rooms/commands/game-commands.ts:923–931`; `core/pokemon-entity.ts:782–792`; `core/pokemon-entity.ts:807–814`; `core/pokemon-entity.ts:853–864`; `models/colyseus-models/pokemon.ts:268–285`; `core/pokemon-entity.ts:212–214`; `models/colyseus-models/synergies.ts:110–125`; `models/colyseus-models/synergies.ts:287–297`; `models/effects.ts:14–25`; `config/game/items.ts:19`; `core/pokemon-entity.ts:1399–1437`; `models/colyseus-models/pokemon.ts:6130–6141`; `models/colyseus-models/pokemon.ts:6142–6163`; `models/colyseus-models/pokemon.ts:10139`; `core/effects/passives.ts:1700–1713`; `models/colyseus-models/pokemon.ts:10145`; `core/pokemon-entity.ts:216–220`; `core/pokemon-entity.ts:160–162`

### LEAF_STONE

**Recipe** (declared): Fossil Stone + Miracle Seed. **Declared bonuses:** HP 30. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `leaf_stone-type` (traced)** — *Trigger:* When the stone is held by a board unit (computeSynergies adds item-granted types to every board unit; only units not on the bench count) and, in the fight, when the fight entity is built from that unit. *Targets:* holder. *Effect:* Grants the Grass type (SynergyGivenByItem). In ordinary base counting each evolution family adds at most 1 to the Grass count (Dragon doubling and special game rules can change the final count, see core-mechanics section E); the tier effect switches on only when the final count reaches the first threshold [3, 5, 7, 9]. Granting the type is not the same as activating a tier. *Duration:* While held. *Scaling:* No AP/crit. *Limits:* Equip is refused if the holder already has the type: the OnItemDropped effect (stones), the drop command and PokemonEntity.addItem all check it; in the combine path the finished stone pops back to the inventory instead. Removal paths differ. Board unit (Pokemon.removeItems): the type is removed unless it is native to the unit or another held item still grants it. Fight entity (PokemonEntity.removeItemEffect): the type is removed when it is not among the species' default types, together with that type's tier effects for the entity, without checking other held type-granting items. *Consumption/reset:* Not consumed.
- **Effect `leaf_stone-stats` (declared)** — *Trigger:* Item applied at fight start. *Targets:* holder. *Effect:* Declared bonus: HP 30. *Duration:* Whole fight. *Scaling:* Generic stat helpers (see core-mechanics section I). *Limits:* -. *Consumption/reset:* Not consumed.
- **Effect `leaf_stone-evo` (declared)** — *Trigger:* Item evolution rules that list this item. *Targets:* Eevee, Type Null. *Effect:* Eevee: holding this stone makes it evolve to Leafeon (Eevee's ITEM rule lists eight stones; divergentEvolution maps each). Type Null: its ITEM rule accepts every synergy item and divergentEvolution picks Silvally form by the synergy the item grants: SILVALLY_GRASS. Handler paths not traced; only these declarations. *Duration:* -. *Scaling:* -. *Limits:* Silvally's RKS_SYSTEM passive removes synergy items when the unit is moved to the bench (passives.ts, read at the guard only). *Consumption/reset:* -.

*Note:* Exchange tickets can swap a stone for another random stone (game-commands.ts:627-628); stones can also come from other sources not traced here.

*Arithmetic:* One stone adds 1 to the Grass count for its unit's family; with thresholds [3, 5, 7, 9] a single stone cannot reach the first threshold unless the team already has enough other Grass units (ordinary base counting; Dragon doubling and special rules can change counts). Formula only.

*Unresolved / untested:* Handler paths of the evolution rules (Eevee, Type Null) were not traced; How the team reaches the tier (other units of the type, bonus synergies) is outside this record; Interaction of the granted type with that synergy's own tier effects is not audited.

*Conditional deduction (inference, not a ranking):* Adds one to the Grass count (3/5/7/9); +30 HP.

*Sources:* `types/enum/Item.ts:822`; `config/game/synergies.ts:181`; `types/enum/Item.ts:699–709`; `core/effects/items.ts:524–536`; `rooms/commands/game-commands.ts:935–945`; `rooms/commands/game-commands.ts:799–822`; `rooms/commands/game-commands.ts:923–931`; `core/pokemon-entity.ts:782–792`; `core/pokemon-entity.ts:807–814`; `core/pokemon-entity.ts:853–864`; `models/colyseus-models/pokemon.ts:268–285`; `core/pokemon-entity.ts:212–214`; `models/colyseus-models/synergies.ts:110–125`; `models/colyseus-models/synergies.ts:287–297`; `models/effects.ts:14–25`; `config/game/items.ts:20`; `core/pokemon-entity.ts:1399–1437`; `models/colyseus-models/pokemon.ts:6130–6141`; `models/colyseus-models/pokemon.ts:6142–6163`; `models/colyseus-models/pokemon.ts:10139`; `core/effects/passives.ts:1700–1713`; `models/colyseus-models/pokemon.ts:10166`

### ICE_STONE

**Recipe** (declared): Fossil Stone + Never Melt Ice. **Declared bonuses:** SPE_DEF 6. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `ice_stone-type` (traced)** — *Trigger:* When the stone is held by a board unit (computeSynergies adds item-granted types to every board unit; only units not on the bench count) and, in the fight, when the fight entity is built from that unit. *Targets:* holder. *Effect:* Grants the Ice type (SynergyGivenByItem). In ordinary base counting each evolution family adds at most 1 to the Ice count (Dragon doubling and special game rules can change the final count, see core-mechanics section E); the tier effect switches on only when the final count reaches the first threshold [2, 4, 6, 8]. Granting the type is not the same as activating a tier. *Duration:* While held. *Scaling:* No AP/crit. *Limits:* Equip is refused if the holder already has the type: the OnItemDropped effect (stones), the drop command and PokemonEntity.addItem all check it; in the combine path the finished stone pops back to the inventory instead. Removal paths differ. Board unit (Pokemon.removeItems): the type is removed unless it is native to the unit or another held item still grants it. Fight entity (PokemonEntity.removeItemEffect): the type is removed when it is not among the species' default types, together with that type's tier effects for the entity, without checking other held type-granting items. *Consumption/reset:* Not consumed.
- **Effect `ice_stone-stats` (declared)** — *Trigger:* Item applied at fight start. *Targets:* holder. *Effect:* Declared bonus: SPE_DEF 6. *Duration:* Whole fight. *Scaling:* Generic stat helpers (see core-mechanics section I). *Limits:* -. *Consumption/reset:* Not consumed.
- **Effect `ice_stone-evo` (declared)** — *Trigger:* Item evolution rules that list this item. *Targets:* Eevee, Type Null. *Effect:* Eevee: holding this stone makes it evolve to Glaceon (Eevee's ITEM rule lists eight stones; divergentEvolution maps each). Type Null: its ITEM rule accepts every synergy item and divergentEvolution picks Silvally form by the synergy the item grants: SILVALLY_ICE. Handler paths not traced; only these declarations. *Duration:* -. *Scaling:* -. *Limits:* Silvally's RKS_SYSTEM passive removes synergy items when the unit is moved to the bench (passives.ts, read at the guard only). *Consumption/reset:* -.

*Note:* Exchange tickets can swap a stone for another random stone (game-commands.ts:627-628); stones can also come from other sources not traced here.

*Arithmetic:* One stone adds 1 to the Ice count for its unit's family; with thresholds [2, 4, 6, 8] a single stone cannot reach the first threshold unless the team already has enough other Ice units (ordinary base counting; Dragon doubling and special rules can change counts). Formula only.

*Unresolved / untested:* Handler paths of the evolution rules (Eevee, Type Null) were not traced; How the team reaches the tier (other units of the type, bonus synergies) is outside this record; Interaction of the granted type with that synergy's own tier effects is not audited.

*Conditional deduction (inference, not a ranking):* Adds one to the Ice count (2/4/6/8); +6 SPE_DEF.

*Sources:* `types/enum/Item.ts:823`; `config/game/synergies.ts:202`; `types/enum/Item.ts:699–709`; `core/effects/items.ts:524–536`; `rooms/commands/game-commands.ts:935–945`; `rooms/commands/game-commands.ts:799–822`; `rooms/commands/game-commands.ts:923–931`; `core/pokemon-entity.ts:782–792`; `core/pokemon-entity.ts:807–814`; `core/pokemon-entity.ts:853–864`; `models/colyseus-models/pokemon.ts:268–285`; `core/pokemon-entity.ts:212–214`; `models/colyseus-models/synergies.ts:110–125`; `models/colyseus-models/synergies.ts:287–297`; `models/effects.ts:14–25`; `config/game/items.ts:21`; `core/pokemon-entity.ts:1399–1437`; `models/colyseus-models/pokemon.ts:6130–6141`; `models/colyseus-models/pokemon.ts:6142–6163`; `models/colyseus-models/pokemon.ts:10139`; `core/effects/passives.ts:1700–1713`; `models/colyseus-models/pokemon.ts:10170`

### CHOICE_SPECS

**Recipe** (declared): Twisted Spoon + Twisted Spoon. **Declared bonuses:** AP 100. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

**Stat effect (traced):** Declared AP 100 becomes a flat +100 to the entity's AP at fight start (applyStat -> addAbilityPower). AP is used wherever a caller applies it: AP-scaled ability damage (handleSpecialDamage with apBoost), basic attacks converted to special (ceil(ATK x (1 + AP/100))), some attack effects (e.g. Spot Panda, Shadow Punch / Attack Order next-attack bonuses), and AP-scaled healing and shields (handleHeal / addShield with apBoost > 0). Ordinary physical basic attacks do not use AP.

**Absent (traced):** No ItemEffects entry and no other game-code reference: the only references in app/**/*.ts(x) are the enum/recipe (Item.ts), the declared stats (config/game/items.ts) and a PvE reward list (models/pve-stages.ts:251). Its only gameplay content is the declared +100 AP.

*Arithmetic:* Starting from 0 AP, +100 AP changes the AP multiplier from 1 to 2, i.e. doubles raw AP-scaled damage (before crit, defense and other modifiers). If the holder already has A AP the multiplier goes from (1 + A/100) to (2 + A/100): at A = 50, 1.5 to 2.5 (about x1.67), not x2. Not a combat simulation.

*Unresolved / untested:* Nullify Bandanna turns AP gains into Attack; Big Eater/Twist Band modify the stat call (see silk-scarf-items.md); Whether a given ability or attack effect uses AP depends on that caller (apBoost flag); only the callers cited were read.

*Conditional deduction (inference, not a ranking):* AP is used by AP-scaled ability damage, special-converted basic attacks, some attack effects and AP-scaled healing and shields, but not by ordinary physical basic attacks. So how much +100 AP matters depends on which of those the holder actually uses and on its starting AP (arithmetic above); each caller decides whether it applies AP.

*Sources:* `types/enum/Item.ts:516`; `config/game/items.ts:22`; `models/pve-stages.ts:251`; `core/pokemon-entity.ts:1399–1437`; `core/pokemon-entity.ts:621–648`; `core/pokemon-entity.ts:163–165`; `core/simulation.ts:498–534`; `core/pokemon-state.ts:85–91`; `core/pokemon-state.ts:136–138`; `core/pokemon-state.ts:188–206`; `core/pokemon-state.ts:334–336`; `core/pokemon-state.ts:390`

### SOUL_DEW

**Recipe** (declared): Twisted Spoon + Mystic Water. **Declared bonuses:** none — ItemStats entry exists but is empty: no stat bonus. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `sd-periodic` (traced)** — *Trigger:* Every 1000 ms of fight time while the holder is updated (first tick after 1000 ms). *Targets:* holder. *Effect:* +5 AP (addAbilityPower(5, self, 0, false)) and +5 PP (addPP(5, self, 0, false)); tick counter incremented. *Duration:* Whole fight; removal (OnItemRemovedEffect) subtracts 5 x tick count AP. *Scaling:* No AP/crit scaling (apBoost 0). The AP call is subject to Nullify Bandanna (becomes Attack) and Big Eater/Twist Band; the PP call is subject to addPP rules (blocked while silenced/protected/resurrecting/NO_PP_GAIN, halved by fatigue) and Twist Band. *Limits:* No cap seen in the handler (AP floor -100 only). The interval is nominal: the periodic timer is reset to the full interval each time it fires (no catch-up of missed intervals), so ticks per unit of fight time can fall slightly below one per interval.. *Consumption/reset:* Not consumed. Resurrection resets count.soulDewCount but recomputes stats from a fresh clone; whether the periodic effect's own tick counter persists after resurrect is not traced..

*Arithmetic:* After 10 s of fight (ms assumed) = 10 ticks: +50 AP and up to +50 PP before PP is spent on casts and ignoring blocked gains. Not a simulation.

*Unresolved / untested:* Time unit of dt (assumed ms, see core-mechanics section C); Periodic tick counter after resurrection; Declared stats: the ItemStats entry exists but is empty ({}): no stat bonus.

*Conditional deduction (inference, not a ranking):* Its AP and PP grow with fight time, so it helps most in long fights and for holders that cast and can use the extra AP; in a short fight it contributes little beyond what the tick count allows. Silence/protect/fatigue reduce the PP part.

*Sources:* `core/effects/items.ts:227–238`; `core/effects/items.ts:585–599`; `core/effects/effect.ts:261–285`; `core/pokemon-state.ts:893–899`; `core/pokemon-entity.ts:621–648`; `core/pokemon-entity.ts:508–532`; `core/pokemon-entity.ts:1466–1471`

### UPGRADE

**Recipe** (declared): Twisted Spoon + Magnet. **Declared bonuses:** AP 10, SPEED 10. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `up-speed` (traced)** — *Trigger:* Every basic attack by the holder (PokemonEntity.onAttack, called from the basic-attack routine only, successful or not). *Targets:* holder. *Effect:* +5 speed (addSpeed(5, self, 0, false)); upgradeCount++. *Duration:* Whole fight; removal subtracts 5 x upgradeCount. *Scaling:* None (apBoost 0). addSpeed is subject to Big Eater Belt (x1.25 rounded down) and Twist Band. *Limits:* No cap in the handler, but addSpeed clamps speed to 0..MAX_SPEED (300). *Consumption/reset:* Not consumed; resurrection resets upgradeCount while stats are recomputed from a clone.

*Arithmetic:* 10 basic attacks = +50 speed on top of the declared +10: from the default speed 50, speed 110 gives an attack wait of round(1000/(0.4+0.007*110)) = 855 versus 1333 at speed 50 (nominal, formula from core-mechanics section C). Not a simulation.

*Unresolved / untested:* With Big Eater Belt the per-attack gain is 6 (floor(5*1.25)) but removal subtracts 5 each (inference from the code, untested).

*Conditional deduction (inference, not a ranking):* Its speed grows only from basic attacks, so a holder that spends its time casting (or cannot attack) gains less. It raises the attack rate, which also raises PP gained from attacking (+5 per basic attack).

*Sources:* `core/effects/items.ts:753–762`; `core/pokemon-entity.ts:911–950`; `core/pokemon-state.ts:284–296`; `core/pokemon-entity.ts:752–770`; `core/pokemon-entity.ts:752–775`; `config/game/game.ts:5`

### REAPER_CLOTH

**Recipe** (declared): Twisted Spoon + Black Glasses. **Declared bonuses:** AP 10, CRIT_CHANCE 20. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `rc-abilitycrit` (traced)** — *Trigger:* When the item is applied to the fight entity (OnItemGainedEffect). *Targets:* holder. *Effect:* Adds the ABILITY_CRIT effect, which allows the holder's ability casts to roll a crit (chance = critChance/100, one roll per cast). If the holder's ability has canCritByDefault, also addCritPower(50), which adds 50/100 = +0.5 to the crit-power multiplier (default 2 becomes 2.5; crit chance is in percentage points, crit power is a multiplier) (addCritPower(50) adds 50/100 = 0.5 to the crit-power multiplier, e.g. 2 to 2.5; crit chance is in percentage points, crit power is a multiplier). *Duration:* Whole fight (removed again on item removal, reversing the +0.5 crit-power multiplier). *Scaling:* Crit multiplier on ability damage is 1 + (critPower - 1) x reduction (reduction 0 vs Rocky Helmet for non-true damage). Default critPower 2 and critChance 10 plus the declared +20 crit chance. *Limits:* Abilities cast through castAbility with canCrit=false cannot crit; other crit paths not audited. *Consumption/reset:* Not consumed.

*Arithmetic:* Default crit chance 10 + declared 20 = 30 % per cast (nothing else); crit damage factor 2 at default crit power (2.5 for a canCritByDefault ability, from the +0.5). Not a simulation.

*Unresolved / untested:* Which abilities pass canCrit=false (not catalogued); Leek / Large Leek dishes also add ABILITY_CRIT (dishes.ts:128-145); removing the cloth deletes the flag from the effect set whether or not another source added it (untraced interplay).

*Conditional deduction (inference, not a ranking):* It matters for a holder whose casts deal crit-scalable damage: casts gain a crit chance (the declared +20 crit chance helps) with the normal crit factor. A holder that never casts keeps only the declared AP and crit chance (crit chance still affects its basic attacks).

*Sources:* `core/effects/items.ts:946–959`; `core/abilities/cast.ts:18–25`; `core/abilities/cast.ts:16–31`; `core/pokemon-entity.ts:559–575`

### ABILITY_SHIELD

**Recipe** (declared): Twisted Spoon + Miracle Seed. **Declared bonuses:** AP 10. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `as-shield` (traced)** — *Trigger:* At simulation setup (Simulation.applyPostEffects, called from the constructor), once per holder. *Targets:* every same-team unit standing on the holder's cell or the cell directly left or right on the same row (holder included). *Effect:* Each such unit gets a shield of ceil(0.2 x its own max HP) (addShield with the unit as its own caster, apBoost 0) and a Rune Protect status (triggerRuneProtect(5000 ms)), which first clears negative statuses. *Duration:* Rune Protect lasts 5000 ms (a longer existing timer is kept); the shield lasts until depleted. *Scaling:* No AP/crit scaling. The shield is subject to addShield rules (enraged halves it, rounded; Big Eater Belt scales it). While Rune Protect is active, status triggers that check runeProtect are refused. *Limits:* Only the three cells on the holder's row; same team only; units must be present at setup. *Consumption/reset:* Applied once at setup; the item is not consumed. Several holders covering the same unit apply their shields separately (they add).

*Arithmetic:* Ally with max HP 200: shield ceil(0.2 x 200) = 40. Formula only.

*Unresolved / untested:* Which individual statuses Rune Protect blocks: many triggers check runeProtect (about a dozen sites in status.ts) and were not each listed; Because the shield is added with the ally as its own caster, it counts in that ally's shieldDone (the counter Explosive Band reads); the consequence for an Explosive Band holder is an inference from the shared path, untested; Units added after setup (summons) are not covered by this setup code.

*Conditional deduction (inference, not a ranking):* A one-time setup shield and 5-second status protection for up to three units in a row (itself included); it matters most when those units sit on that row and the opponent applies statuses early. It does not recur during the fight.

*Sources:* `core/simulation.ts:692–709`; `core/simulation.ts:223`; `models/colyseus-models/status.ts:956–966`; `models/colyseus-models/status.ts:968–974`; `core/pokemon-state.ts:382–418`

### POWER_LENS

**Recipe** (declared): Twisted Spoon + Never Melt Ice. **Declared bonuses:** SPE_DEF 10, AP 10. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `pl-reflect` (traced)** — *Trigger:* Ordinary path: when the holder is hit through handleSpecialDamage (ability damage and the special parts of basic attacks), after state.handleDamage returns, if the pre-defense special amount is >= 1, the attack type is SPECIAL and the attacker does not hold Protective Pads. *Targets:* the attacker. *Effect:* Reflects the amount the holder's SPE_DEF mitigated: round(S - S / (1 + 0.05 x speDef)), where S is the special damage after AP, crit and the other pre-defense multipliers and speDef is halved (rounded) while the holder has armor reduction. The reflection is special damage dealt by the holder with handleDamage, flagged as retaliation. *Duration:* Instant, per qualifying hit. *Scaling:* Uses the incoming amount S, not the damage actually taken (shield absorption does not reduce it). The reflected damage is not scaled by the holder's AP or crit and goes through the attacker's own SPE_DEF and shield. *Limits:* In this path hits that handleSpecialDamage refuses before reaching the reflection code (protect, skydiving, magic bounce) do not reflect; physical and true damage do not reflect. *Consumption/reset:* Not consumed.
- **Effect `pl-dice` (traced)** — *Trigger:* Loaded Dice path (a separate, manual branch in the Loaded Dice handler, items.ts:152-181): after the second-hit special damage has been dealt with handleDamage, if the second target holds Power Lens and the dice holder does not hold Protective Pads. *Targets:* the Loaded Dice holder. *Effect:* The same mitigated-amount formula is computed from the second hit's special damage (secondHitSpecialDamage, speDef halved under armor reduction) and dealt back with handleDamage as retaliation. *Duration:* Instant. *Scaling:* This branch is entered whenever secondHitSpecialDamage > 0; it does not check that the second hit actually dealt damage, so the usual protect/skydiving/magic-bounce exclusions of handleSpecialDamage do not gate it (handleDamage itself still refuses damage to a protected target, so a protected second target is a case where the reflection is dealt without damage having been taken - source-traced, not gameplay-tested). *Limits:* Only special second hits. *Consumption/reset:* Not consumed.

*Arithmetic:* Incoming special damage 100 on SPE_DEF 10: 100 / 1.5 = 66.67, mitigated 33.33, reflected round(33.33) = 33 (before the attacker's own defenses). Formula only.

*Unresolved / untested:* Self-inflicted special damage (attacker == holder) is not excluded in the ordinary path; Declared AP 10 only matters through the generic AP uses; The Loaded Dice branch was read, not run: whether a protected second target really reflects is a source reading, untested.

*Conditional deduction (inference, not a ranking):* The reflection scales with how much special damage the holder's SPE_DEF mitigates, so it grows with incoming special damage and with SPE_DEF; physical and true damage are unaffected.

*Sources:* `core/pokemon-entity.ts:444–463`; `core/pokemon-state.ts:509–514`; `core/effects/items.ts:152–181`

### POKEMONOMICON

**Recipe** (declared): Twisted Spoon + Charcoal. **Declared bonuses:** AP 30, ATK 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `pk-burn` (traced)** — *Trigger:* Whenever the holder deals special-type damage and the target actually takes damage (callback runs when takenDamage > 0, shield absorption included; basic-attack special parts and ability damage). *Targets:* the damaged enemy. *Effect:* Burn for 3000 ms (triggerBurn) and -1 SPE_DEF (addSpecialDefense(-1, holder, 0, false)). *Duration:* Burn 3000 ms (reduced by duration reductions, refreshed if longer); SPE_DEF loss lasts the fight. *Scaling:* No AP/crit scaling. Burn is blocked by IMMUNITY_BURN, rune protect and the Water Bubble passive; Twist Band on the target flips the debuff; the callback also runs for retaliation damage (isRetaliation is not checked). *Limits:* -1 SPE_DEF per qualifying hit, but addSpecialDefense clamps SPE_DEF at 0 (speDef = max(0, speDef + value)), so the reduction cannot go below 0 and has no further effect there. *Consumption/reset:* Not consumed.

*Arithmetic:* Each qualifying hit lowers the target's SPE_DEF by 1: at SPE_DEF 3 to 2, the special damage multiplier goes from 1/1.15 = 0.870 to 1/1.10 = 0.909 (about +4.5 % damage from that point on). Formula only.

*Unresolved / untested:* Burn's per-tick damage and other burn effects (not traced in this batch); Physical basic attacks do not trigger it; true damage does not trigger it (attackType must be SPECIAL); Self-damage case (target == holder) not checked.

*Conditional deduction (inference, not a ranking):* Only special-type damage triggers it, so a purely physical attacker gets nothing; a caster with several hits or an area ability triggers burn and the SPE_DEF reduction per hit target.

*Sources:* `core/effects/items.ts:218–225`; `core/effects/items.ts:963`; `core/pokemon-entity.ts:1151–1171`; `core/pokemon-state.ts:734–750`; `models/colyseus-models/status.ts:397–411`; `core/pokemon-entity.ts:700–724`; `utils/number.ts:1–4`

### HEAVY_DUTY_BOOTS

**Recipe** (declared): Twisted Spoon + Heart Scale. **Declared bonuses:** AP 50, DEF 12. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `hb-immune` (traced)** — *Trigger:* Item applied at fight start; checked wherever the listed effects occur. *Targets:* holder. *Effect:* Adds IMMUNITY_LOCKED (the Locked status cannot be applied); canBeMoved is false (forced displacement is refused); board effects are not added to its effect set; ignores the poison-gas, smoke, sticky-web and cotton-ball statuses and the stealth-rocks, spikes, toxic-spikes, hail and ember tick effects. *Duration:* Whole fight. *Scaling:* None. *Limits:* Only the effect checks listed; other displacement or control effects not routed through these checks are untraced. *Consumption/reset:* Not consumed.

*Unresolved / untested:* Other crowd-control or displacement effects that bypass canBeMoved or the listed checks; Interaction with abilities that move the holder voluntarily (the holder's own movement is not blocked by canBeMoved; only forced displacement).

*Conditional deduction (inference, not a ranking):* Only relevant against the listed board effects and Locked/forced displacement; it does nothing about other statuses or damage. Against opponents or maps without those effects the declared AP 50 and DEF 12 are its measurable content.

*Sources:* `core/effects/items.ts:652–656`; `core/pokemon-entity.ts:258–264`; `models/colyseus-models/status.ts:1142–1150`; `models/colyseus-models/status.ts:193–221`; `models/colyseus-models/status.ts:660–664`; `core/board.ts:640`; `core/pokemon-state.ts:1031–1095`; `core/pokemon-entity.ts:890–895`

### AQUA_EGG

**Recipe** (declared): Mystic Water + Mystic Water. **Declared bonuses:** PP 30. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `ae-cast` (traced)** — *Trigger:* After each ability cast by the holder (OnAbilityCastEffect; runs after the cast's PP spend and cast counter). *Targets:* holder. *Effect:* +PP: min(maxPP - 10, round(0.2 x maxPP + 2 x number of casts so far, including this one)). *Duration:* Every cast, whole fight. *Scaling:* No AP/crit scaling (apBoost 0). addPP rules apply (blocked while silenced/protected/resurrecting/NO_PP_GAIN; fatigue halves; Twist Band). *Limits:* Capped at maxPP - 10 per cast. *Consumption/reset:* Not consumed by casting.
- **Effect `ae-manaphy` (traced)** — *Trigger:* Fight start, only when the holder has the MANAPHY passive. *Targets:* holder and its team's board. *Effect:* Removes the item from the holder and spawns a Phione on the closest free cell of the holder's team. *Duration:* Once per fight (the item is removed from the fight entity). *Scaling:* None. *Limits:* Requires a free cell. *Consumption/reset:* Item removed from the fight entity only.

*Arithmetic:* maxPP 100: 1st cast +22, 2nd +24, 3rd +26 (round(20 + 2n)), capped at +90. Formula applied by hand, not a simulation.

*Unresolved / untested:* Phione's stats and behavior; Uxie's Hidden Power gives itself an Aqua Egg in code (hidden-power.ts:368); that context was not traced; Declared PP 30 is added to current PP only (never maxPP).

*Conditional deduction (inference, not a ranking):* It shortens the gap between casts for holders that cast repeatedly; the gain per cast is larger for higher maxPP and for later casts, but is capped at maxPP - 10. With Efficient Bandanna's lower maxPP the same formula gives a smaller absolute amount (maxPP is the input).

*Sources:* `core/effects/items.ts:992–999`; `core/abilities/cast.ts:16–31`; `core/abilities/ability-strategy.ts:15–17`; `core/pokemon-entity.ts:508–532`; `utils/number.ts:1–8`; `core/effects/passives.ts:976–992`; `core/effects/passives.ts:1421`; `core/simulation.ts:239–262`

### BLUE_ORB

**Recipe** (declared): Mystic Water + Magnet. **Declared bonuses:** PP 15, SPEED 10. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `bo-chain` (traced)** — *Trigger:* Every 3rd basic attack by the holder (counter staticHolderCount incremented in the OnAttack hook, i.e. each basic attack, successful or not). *Targets:* the up-to-two living enemies closest to the holder (distance sort, may include the attacked target). *Effect:* 10 raw special damage to each (crit=false, apBoost=false, so no AP or crit scaling; then the normal defense step), and an attempted -15 PP on each (addPP(-15, holder, 0, false); floored at 0); manaBurnCount++ is counted regardless. *Duration:* Instant, every 3rd attack (counter reset to 0 each time). *Scaling:* Fixed 10 raw, no AP/crit; defense division by (1 + 0.05 x SPE_DEF) then ceil/min 1 applies (arithmetic from the shared damage path). The PP loss goes through addPP, so it is blocked while the target is resurrecting or in the tree status and is reversed into a gain by Twist Band on the target; it is not unconditional. *Limits:* Fewer than two living enemies: fewer hits. *Consumption/reset:* Not consumed.

*Arithmetic:* 10 raw vs SPE_DEF 3: 10 / 1.15 = 8.70 -> 9 each (formula by hand).

*Also declared:* Kyogre's evolution rule is an item rule on BLUE_ORB (evolves to PRIMAL_KYOGRE): declared at pokemon.ts:6047-6054; acquisition and handler path not traced here.

*Unresolved / untested:* Whether the counter persists across a Max Revive resurrection (not in the reset list read); Kyogre evolution path; The 10-damage hits go through handleDamage and so can trigger other on-damage-dealt items (Shell Bell, Pokemonomicon) by the shared call path (inference from structure, untested).

*Conditional deduction (inference, not a ranking):* The chain damage is small (10 raw, no AP scaling) and arrives every 3rd basic attack; the attempted 15 PP drain on up to two enemies can be blocked or reversed (see limits). A holder that casts instead of attacking advances the counter more slowly.

*Sources:* `core/effects/items.ts:73–115`; `core/effects/items.ts:961`; `core/board.ts:792–807`; `core/pokemon-entity.ts:911–950`; `core/pokemon-state.ts:284–296`; `core/pokemon-entity.ts:508–532`; `core/pokemon-entity.ts:508–532`; `models/colyseus-models/pokemon.ts:6047–6054`

### SCOPE_LENS

**Recipe** (declared): Mystic Water + Black Glasses. **Declared bonuses:** PP 15, CRIT_CHANCE 25. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `sl-steal` (traced)** — *Trigger:* On a basic attack whose crit roll succeeded (OnAttack hook; also runs on dodged/protected attacks because it keys on the roll, not on damage). *Targets:* holder and the attacked target. *Effect:* Attempts a PP transfer of x = min(target PP, 10) as two independent addPP calls: holder addPP(+x) and target addPP(-x); manaBurnCount++ is counted whether or not either call takes effect. *Duration:* Instant per crit attack. *Scaling:* No AP/crit scaling. Both calls go through addPP, which has its own conditions: a positive gain is blocked while the receiver is silenced, protected, resurrecting or under NO_PP_GAIN and is halved by fatigue; a negative change is blocked while the target is resurrecting or in the tree status; the result is floored at 0; and Twist Band on the target turns the -x into +x (enemy caster), so the target gains PP. The transfer is therefore not guaranteed and its two halves can succeed or fail independently. *Limits:* Max 10 PP per crit; x = 0 if the target has 0 PP. *Consumption/reset:* Not consumed.

*Arithmetic:* Declared +25 crit chance: 10 default + 25 = 35 % per basic attack; each crit moves up to 10 PP. Not a simulation.

*Unresolved / untested:* Rocky Helmet does not stop it (the hook uses the roll); Ability casts never trigger it (only the basic attack calls the hook).

*Conditional deduction (inference, not a ranking):* It needs crits on basic attacks; each crit attempts to move up to 10 PP from the target to the holder, subject to the addPP conditions. Extra crit chance from other sources increases how often.

*Sources:* `core/effects/items.ts:1001–1010`; `core/pokemon-entity.ts:911–950`; `core/pokemon-state.ts:284–296`; `core/pokemon-entity.ts:508–532`; `core/pokemon-entity.ts:508–532`

### STAR_DUST

**Recipe** (declared): Mystic Water + Never Melt Ice. **Declared bonuses:** SPE_DEF 10, PP 15. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `sd2-shield` (traced)** — *Trigger:* After each ability cast by the holder (OnAbilityCastEffect). *Targets:* holder. *Effect:* Gains a shield of round(0.5 x maxPP) (addShield, apBoost 0); starDustCount++. *Duration:* Shield lasts until depleted. *Scaling:* No AP/crit scaling. addShield rules: enraged halves the amount, Big Eater Belt scales it. *Limits:* No cap; stacks with existing shield. *Consumption/reset:* Not consumed.

*Arithmetic:* maxPP 100: a 50 shield per cast; with Efficient Bandanna's maxPP 85: round(42.5) = 43 (JavaScript Math.round, .5 rounds up). Formula only.

*Unresolved / untested:* Declared PP 15 adds to current PP only; Casts that bypass castAbility were not enumerated.

*Conditional deduction (inference, not a ranking):* Each cast adds a shield proportional to maxPP, so it favors holders that cast repeatedly and have a high maxPP (Efficient Bandanna lowers maxPP and therefore the shield).

*Sources:* `core/effects/items.ts:1012–1017`; `core/abilities/cast.ts:16–31`; `core/pokemon-state.ts:382–418`

### GREEN_ORB

**Recipe** (declared): Mystic Water + Miracle Seed. **Declared bonuses:** HP 15. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `go-heal` (traced)** — *Trigger:* Every 2000 ms of fight time (periodic effect on the holder; first tick after 2000 ms). *Targets:* every same-team unit on the holder's cell and the 8 cells around it (holder included). *Effect:* Each is healed 5 % of its own max HP through handleHeal (apBoost 0, no crit); any overheal is converted into PP for that unit: addPP(0.3 x overheal). *Duration:* Whole fight; the periodic effect is deleted when the item is removed. *Scaling:* No AP/crit scaling. handleHeal then applies its own conditions: 0 if the unit is wounded or protected (and then no overheal PP), x1.3 BUFF_HEAL_RECEIVED, x0.5 burning, x0.5 enraged, x1.2 Zenith weather, rounded and capped at missing HP. The PP conversion goes through addPP rules. *Limits:* Only living same-team units in the 3x3 block; no cap on ticks. The interval is nominal: the periodic timer is reset to the full interval each time it fires (no catch-up of missed intervals), so ticks per unit of fight time can fall slightly below one per interval.. *Consumption/reset:* Not consumed.
- **Effect `go-evo` (declared)** — *Trigger:* Item evolution rule declared on Rayquaza. *Targets:* Rayquaza. *Effect:* Evolves to Mega Rayquaza when the Green Orb is held (declared rule); the evolution handler path was not traced here. *Duration:* -. *Scaling:* -. *Limits:* -. *Consumption/reset:* -.

*Arithmetic:* Ally max HP 200: 10 HP per tick before modifiers. If that ally is missing 4 HP: healReceived 4, overheal 6, PP request 0.3 x 6 = 1.8 (addPP rounds it). Formula only.

*Unresolved / untested:* Evolution handler path for the Rayquaza rule; Unit time units assumed ms (see core-mechanics section C).

*Conditional deduction (inference, not a ranking):* It heals allies in the 3x3 block by a percentage of their own max HP, so it scales with how many allies are adjacent and how large their HP is; a unit at full HP converts the heal into PP at 30 %, which helps casters that stay healthy. Wound, protect, burn and enrage change the heal.

*Sources:* `core/effects/items.ts:261–284`; `core/effects/items.ts:800–812`; `core/effects/effect.ts:261–285`; `core/pokemon-state.ts:893–899`; `core/pokemon-state.ts:308–360`; `core/pokemon-state.ts:308–382`; `core/pokemon-entity.ts:508–532`; `models/colyseus-models/pokemon.ts:6094`

### DEEP_SEA_TOOTH

**Recipe** (declared): Mystic Water + Charcoal. **Declared bonuses:** ATK 7, PP 15. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `dst-pp` (traced)** — *Trigger:* After each basic attack by the holder (OnAttack hook), successful or not. *Targets:* holder. *Effect:* +5 PP, and +15 more if the attack killed its target (hasAttackKilled), i.e. +20 in total on a kill. This is in addition to the ordinary +5 PP per basic attack (ON_ATTACK_MANA). *Duration:* Instant, per basic attack. *Scaling:* No AP/crit scaling. Both gains go through addPP (blocked while silenced/protected/resurrecting/NO_PP_GAIN, halved by fatigue). *Limits:* hasAttackKilled is set by kills from the physical, special or true part of the attack (and fairy wand effects); casts do not trigger it. *Consumption/reset:* Not consumed.

*Arithmetic:* Without kill: 5 (ordinary) + 5 (item) = 10 PP per basic attack, i.e. 10 attacks for 100 PP versus 20 without the item; formula only, ignoring PP from damage taken.

*Unresolved / untested:* Whether kills by abilities count (they do not call this hook).

*Conditional deduction (inference, not a ranking):* It doubles the PP from basic attacks and adds more on kills, so it speeds casting for holders that spend time basic-attacking; holders that already cast constantly gain less.

*Sources:* `core/effects/items.ts:814–821`; `core/pokemon-entity.ts:911–950`; `core/pokemon-state.ts:284–296`; `core/pokemon-state.ts:119–123`; `config/game/battle.ts:3`; `core/pokemon-entity.ts:508–532`; `core/pokemon-entity.ts:508–532`

### SHINY_CHARM

**Recipe** (declared): Mystic Water + Heart Scale. **Declared bonuses:** DEF 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `shc-save` (traced)** — *Trigger:* Inside handleDamage, when the damage that gets past the shield would leave the holder below 30 % of max HP (hp - residualDamage < 0.3 x maxHP); the check does not require a lethal hit or residual damage > 0. *Targets:* holder. *Effect:* That hit's HP loss is cancelled (takenDamage and residualDamage set to 0, death false), the holder gains +50 PP, gains Protect for 1500 ms, and the item is removed from the fight entity. *Duration:* Protect 1500 ms (not applied if the holder is already protected or enraged). *Scaling:* PP gain via addPP (rules apply); shield was already reduced for this hit before the check. *Limits:* Once per fight. *Consumption/reset:* Consumed for the fight (removeItem, not permanent): the board unit keeps the item for later fights.
- **Effect `shc-shiny` (traced)** — *Trigger:* When the item is equipped, or carried through evolution. *Targets:* holder (board unit). *Effect:* Sets the unit's shiny flag. *Duration:* Persistent. *Scaling:* None. *Limits:* None. *Consumption/reset:* Not consumed.

*Arithmetic:* maxHP 200: a hit leaving HP below 60 triggers it. E.g. HP 70 and 30 residual damage -> 40 < 60 -> the 30 is cancelled. Formula by hand.

*Unresolved / untested:* Because the condition has no 'residual damage > 0' check, a holder already below 30 % whose hit is fully absorbed by shield also triggers it (source reading, untested); Interaction order with Fossil synergy and resurrection checks that follow; Any gameplay effect of the shiny flag (not traced).

*Conditional deduction (inference, not a ranking):* A one-time protection against the first hit that would drop the holder under 30 % HP (plus 50 PP); it does not heal. The shield is spent first, so a shielded holder reaches the check later.

*Sources:* `core/pokemon-state.ts:649–661`; `core/pokemon-state.ts:620–649`; `models/colyseus-models/status.ts:744–750`; `core/pokemon-entity.ts:508–532`; `rooms/commands/game-commands.ts:947–949`; `models/colyseus-models/player.ts:344–346`

### XRAY_VISION

**Recipe** (declared): Magnet + Magnet. **Declared bonuses:** SPEED 50. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `xv-sleep` (traced)** — *Trigger:* When the item is applied at fight start (and by Hidden Power X, which calls addItem on allies mid-fight). *Targets:* holder. *Effect:* Adds the IMMUNITY_SLEEP effect, which makes triggerSleep refuse to put the holder to sleep (abilities such as Dream Eater and Uproar also check it). *Duration:* Whole fight; the item entry has no removal handler, so the effect flag is not removed when the item is removed (traced absence of an OnItemRemovedEffect). *Scaling:* None. *Limits:* Only sleep. *Consumption/reset:* Not consumed.
- **Effect `xv-dodge` (traced)** — *Trigger:* Each of the holder's basic attacks. *Targets:* the attacked enemy. *Effect:* The holder's basic attack skips the target's dodge roll (the dodge condition requires the attacker NOT to hold X-Ray Vision). *Duration:* Whole fight. *Scaling:* Other conditions that already prevent dodging (lock-on, paralysis, sleep, freeze, locked) are separate. *Limits:* Only the basic-attack dodge check was read; whether anything else rolls dodge was not checked. *Consumption/reset:* Not consumed.

*Arithmetic:* Declared SPEED 50: attack wait at speed 50 -> 100 is round(1000/(0.4+0.35)) = 1333 -> 909 (nominal; formula from core-mechanics section C).

*Unresolved / untested:* Other dodge-like mechanics outside the basic-attack check were not enumerated; Interaction of a lingering IMMUNITY_SLEEP flag after the item is removed mid-fight (untested).

*Conditional deduction (inference, not a ranking):* Useful against high-dodge targets for basic-attack users, and against sleep; it does not change ability damage in the paths read.

*Sources:* `core/effects/items.ts:658–662`; `models/colyseus-models/status.ts:759–767`; `core/abilities/hidden-power.ts:440–446`; `core/pokemon-state.ts:99–113`

### RAZOR_FANG

**Recipe** (declared): Magnet + Black Glasses. **Declared bonuses:** SPEED 10, CRIT_CHANCE 10, CRIT_POWER 50. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `rf-armor` (traced)** — *Trigger:* Ordinary basic attack by the holder that is successful (not dodged or protected); the check runs just before the attack's damage is applied (pokemon-state.ts:240-242). *Targets:* the attacked enemy. *Effect:* Armor reduction for 2000 ms: the target's DEF and SPE_DEF are halved (rounded) in the defense step. Because it is set before handleDamage is called for that attack, it applies to the same attack's damage. *Duration:* 2000 ms (reduced by duration reductions; a longer existing timer is kept). *Scaling:* None; blocked by Rune Protect on the target. *Limits:* Also affects every other source of damage against the target while active. *Consumption/reset:* Not consumed.
- **Effect `rf-dice` (traced)** — *Trigger:* Loaded Dice second hit, if the holder also holds Razor Fang. *Targets:* the second target. *Effect:* Armor reduction (2000 ms) is applied AFTER the bounce damage and after the holder's onHit effects (items.ts:210-212), so it does not benefit that bounce's own damage; it affects later damage. *Duration:* 2000 ms. *Scaling:* None; blocked by Rune Protect. *Limits:* Needs the Loaded Dice bounce to occur. *Consumption/reset:* Not consumed.
- **Effect `rf-stats` (declared)** — *Trigger:* Item applied at fight start. *Targets:* holder. *Effect:* Declared CRIT_CHANCE 10 (percentage points), SPEED 10, and CRIT_POWER 50 applied through addCritPower as +0.5 to the crit-power multiplier (default 2 becomes 2.5). *Duration:* Whole fight. *Scaling:* Generic stat paths. *Limits:* None found beyond the stat helpers. *Consumption/reset:* Not consumed.

*Arithmetic:* Ordinary attack, target DEF 10 halved to 5: the physical multiplier goes from 1/1.5 = 0.667 to 1/1.25 = 0.8 (about +20 % of that hit). Formula only.

*Unresolved / untested:* Abilities that bypass the basic-attack routine do not trigger the armor reduction; Whether the same armor-reduction flag is reapplied or extended by repeated hits follows triggerArmorReduction (longer duration wins); not otherwise tested.

*Conditional deduction (inference, not a ranking):* The armor reduction lifts damage from every source against the target for 2 s, and its first application lands on the same hit that applies it; it needs successful basic attacks.

*Sources:* `core/pokemon-state.ts:240–242`; `models/colyseus-models/status.ts:342–352`; `core/pokemon-state.ts:509–514`; `core/effects/items.ts:210–212`; `core/pokemon-entity.ts:559–575`

### GRACIDEA_FLOWER

**Recipe** (declared): Magnet + Miracle Seed. **Declared bonuses:** none — No ItemStats entry exists for GRACIDEA_FLOWER: it declares no stat bonus (entry absent, not zero).. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `gf-speed` (traced)** — *Trigger:* At simulation setup (Simulation.applyPostEffects, same loop as Ability Shield). *Targets:* every unit found on the holder's cell and the cells directly left and right on the same row; the code checks only that a unit exists, with no team test. *Effect:* +20 speed to each (addSpeed(20, holder, 0, false)); the holder is included. *Duration:* Whole fight (no removal in this code). *Scaling:* No AP/crit scaling; addSpeed clamps speed to 0 to 300 and is subject to Big Eater Belt / Twist Band on the receiver. *Limits:* Three cells on one row; units placed after setup are not covered. *Consumption/reset:* Applied once; item not consumed.
- **Effect `gf-evo` (declared)** — *Trigger:* Item evolution rule declared on Shaymin. *Targets:* Shaymin. *Effect:* Evolves to Shaymin (Sky form) when Gracidea Flower is held (declared rule); handler path not traced here. *Duration:* -. *Scaling:* -. *Limits:* -. *Consumption/reset:* -.

*Arithmetic:* Three allies in the row segment: +20 speed each; from default speed 50, 70 gives an attack wait of round(1000/(0.4+0.49)) = 1124 versus 1333 (nominal; core-mechanics section C). Formula only.

*Unresolved / untested:* Whether an enemy can stand on those cells at setup was not examined (no team check in the code read); Evolution handler path for the Shaymin rule.

*Conditional deduction (inference, not a ranking):* A flat speed bonus for the units in the row segment around the holder; its value depends on where units are placed. The code read has no team check, so the surroundings at setup matter.

*Sources:* `core/simulation.ts:711–721`; `core/simulation.ts:223`; `core/pokemon-entity.ts:752–775`; `config/game/game.ts:5`; `models/colyseus-models/pokemon.ts:7396`

### LOADED_DICE

**Recipe** (declared): Magnet + Never Melt Ice. **Declared bonuses:** SPEED 10, SPE_DEF 3, LUCK 20. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `ld-bounce` (traced)** — *Trigger:* On each basic attack by the holder (OnAttack hook, successful or not) whose pre-defense total damage is > 0, with probability chance(0.5, holder). *Targets:* one enemy standing in the 8 cells around the attacked target (the one with the lowest current HP). *Effect:* A second hit: each component (physical, special, true) of the original attack, rounded after x0.75, is dealt to that enemy through handleDamage (so the enemy's defenses and shields apply); the holder's on-hit effects run for it; afterwards, if the holder also holds Razor Fang, armor reduction is applied to that enemy (after the bounce damage and onHit, so not benefiting the bounce); and if that enemy holds Power Lens a manual special-damage reflection to the holder is computed from the second hit (see Power Lens). *Duration:* Instant; one bounce. *Scaling:* chance(p, holder) = Math.random() < p^(1 - luck/100), so luck 0 gives 50 % and the declared luck 20 gives 0.5^0.8 = 57.4 %. The components are the original attack's pre-defense amounts (crit already included), not re-rolled. *Limits:* Needs at least one enemy adjacent to the target; the original target itself is not eligible. *Consumption/reset:* Not consumed.

*Arithmetic:* Original attack 40 physical pre-defense: second hit 30 physical pre-defense. Chance at luck 20: 0.5^0.8 = 0.574. Formulas only.

*Unresolved / untested:* Whether kills on the second hit count for kill-based effects; The second hit calls the on-damage-dealt path (Shell Bell etc.) by the shared route (inference, untested).

*Conditional deduction (inference, not a ranking):* It adds damage only when an enemy stands next to the target, and scales with the size of the original hit; luck raises its chance.

*Sources:* `core/effects/items.ts:117–215`; `core/effects/items.ts:965`; `utils/random.ts:3–13`; `core/pokemon-entity.ts:649–672`; `core/pokemon-state.ts:284–300`; `core/pokemon-entity.ts:911–950`; `core/effects/items.ts:210–212`; `core/effects/items.ts:152–181`

### PUNCHING_GLOVE

**Recipe** (declared): Magnet + Charcoal. **Declared bonuses:** SPEED 10, ATK 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `pg-extra` (traced)** — *Trigger:* Each basic attack by the holder. *Targets:* the attacked enemy. *Effect:* Adds 0.08 x the target's max HP to the attack's physical damage (added after the crit factor, so it is not multiplied by crit, and before rounding); it is physical, so the target's DEF and shield apply. *Duration:* Per basic attack. *Scaling:* No AP/crit scaling. The glove term is added after dodge/protect have set the base damage to 0, so by source reading a dodged attack still carries the glove term (untested). *Limits:* Added even when the attack was converted to special (the glove term is physical). *Consumption/reset:* Not consumed.

*Arithmetic:* Target max HP 500: +40 raw physical per basic attack, before DEF (DEF 10 -> 40/1.5 = 26.7 -> ceil 27). Formula only.

*Unresolved / untested:* Dodged/protected attacks: the source reading suggests the glove damage still resolves (a protected target is stopped inside handleDamage); untested; Declared SPEED 10 and ATK 3 follow the generic stat paths.

*Conditional deduction (inference, not a ranking):* The bonus scales with the target's max HP rather than the holder's stats, so it is relatively larger against high-HP targets; it is applied per basic attack, so faster attackers apply it more often, and the target's DEF reduces it.

*Sources:* `core/pokemon-state.ts:230–232`; `core/pokemon-state.ts:208–238`; `core/pokemon-state.ts:734–742`

### MUSCLE_BAND

**Recipe** (declared): Magnet + Heart Scale. **Declared bonuses:** SPEED 10, DEF 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `mb-stacks` (traced)** — *Trigger:* Whenever the holder receives damage > 0 and survives (OnDamageReceived hook; counter muscleBandCount, up to 20 hits). *Targets:* holder. *Effect:* Every 2nd counted hit: +1 ATK, +2 DEF, +5 speed (apBoost 0). *Duration:* Whole fight; removal subtracts floor(count/2) of each bonus. *Scaling:* At most 20 counted hits = 10 stacks = +10 ATK, +20 DEF, +50 speed (speed is clamped to 0 to 300; ATK has a floor of 1, DEF of 0). *Limits:* The callback needs takenDamage > 0 and the holder still alive; counting stops at 20. *Consumption/reset:* Counter reset on removal and on resurrection (stats recomputed from a clone).

*Arithmetic:* Fully stacked: +10 ATK, +20 DEF, +50 speed on top of the declared DEF 3 and SPEED 10. Formula only.

*Unresolved / untested:* Which damage sources reach the callback was not enumerated beyond handleDamage (status ticks and retaliation are not separately checked); Big Eater Belt / Twist Band interactions with the stat calls (removal subtracts unscaled amounts; inference).

*Conditional deduction (inference, not a ranking):* Its stacks come only from being hit, so it needs the holder to survive hits; the maximum is reached after 20 counted hits.

*Sources:* `core/effects/items.ts:764–779`; `core/pokemon-state.ts:734–742`; `core/pokemon-entity.ts:1185–1232`; `core/pokemon-entity.ts:1466–1471`; `core/pokemon-entity.ts:674–699`; `core/pokemon-entity.ts:726–750`; `core/pokemon-entity.ts:752–775`; `config/game/game.ts:5`

### WONDER_BOX

**Recipe** (declared): Black Glasses + Black Glasses. **Declared bonuses:** none — No ItemStats entry exists for WONDER_BOX: it declares no stat bonus (entry absent, not zero).. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `wb-open` (traced)** — *Trigger:* When the fight entity's items are set up (Simulation.applyItemsEffects), before any item effects are applied (after the Pickup passive handling). *Targets:* the holder's fight entity (the board unit's own item list is not changed). *Effect:* The Wonder Box is removed from the fight entity and two different random items are drawn from the recipe outputs excluding Silk Scarf items, synergy stones, Wonder Box itself and anything the entity already holds; each drawn item is added if the entity then holds fewer than 3 items, and then all items' effects are applied as for ordinary held items. *Duration:* Whole fight; a fresh draw each fight. *Scaling:* The draw is random (pickRandomIn); no AP/crit. *Limits:* If the holder already had 3 items including the box, only the first drawn item fits; the pool of possible items was not enumerated. *Consumption/reset:* The box is consumed for the fight entity only; the board unit keeps it, so it opens again next fight.
- **Effect `wb-art` (traced)** — *Trigger:* Artificial synergy item counting. *Targets:* holder. *Effect:* The Artificial-synergy effect counts the Wonder Box as one extra item (items.size + 1 when it holds one, capped at 3). *Duration:* Setup. *Scaling:* -. *Limits:* -. *Consumption/reset:* -.

*Unresolved / untested:* The generated items can be any of the other recipe outputs, so their effects are those documented (or not yet documented) for each; no outcome audit is attempted; Whether the Artificial counting happens before the box is opened was inferred from the ordering of the two functions (synergy effects are applied before items in addPokemon).

*Conditional deduction (inference, not a ranking):* The outcome is random each fight and the pool is wide, so its value cannot be stated from one outcome; the item's own effects are those of whatever it opens into.

*Sources:* `core/simulation.ts:502–531`; `core/simulation.ts:519–531`; `core/simulation.ts:526–529`; `types/enum/Item.ts:694–697`; `core/simulation.ts:1105–1108`

### SMOKE_BALL

**Recipe** (declared): Black Glasses + Miracle Seed. **Declared bonuses:** CRIT_CHANCE 10. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `sb2-escape` (traced)** — *Trigger:* When the holder SURVIVES a damaging hit (OnDamageReceived callback: takenDamage > 0 and the holder's HP still above 0) and its HP is then below 40 % of max HP; a hit that kills the holder never reaches the callback, so the item does not save a lethal hit. *Targets:* adjacent enemies (8 cells) and the holder. *Effect:* In order: each adjacent enemy gets paralysis 4000 ms and blind 4000 ms; the item is removed from the fight entity; the holder gains a 50 shield; the holder flies away (flyAway without skydive or protect): it is moved to a fly-away cell and enemies that were targeting it lose their target. *Duration:* Paralysis and blind 4000 ms (subject to status immunities and duration reductions); the move is instant. *Scaling:* Shield 50 flat, no AP/crit; the status triggers are refused by their own conditions (Rune Protect, immunities, CC cooldown). *Limits:* Once per fight (the item is removed from the fight entity); needs the holder to survive a damaging hit that leaves HP below 40 %. *Consumption/reset:* Consumed for the fight entity only; the board unit keeps the item.

*Arithmetic:* Max HP 300: triggers when HP < 120 after a damaging hit. Formula only.

*Unresolved / untested:* Which individual status immunities refuse the paralysis/blind; The fly-away destination rules (board.getFlyAwayCell and its fallback) were only skimmed.

*Conditional deduction (inference, not a ranking):* A one-time escape for a holder that gets low: it disables adjacent enemies for 4 s, shields and relocates it. It only triggers if the holder survives a damaging hit that leaves HP below 40 %; it does not save a lethal hit.

*Sources:* `core/effects/items.ts:296–311`; `core/effects/items.ts:834`; `core/pokemon-entity.ts:1185–1232`; `core/pokemon-state.ts:734–742`; `core/pokemon-entity.ts:1323–1330`; `core/pokemon-entity.ts:1384–1386`

### WIDE_LENS

**Recipe** (declared): Black Glasses + Never Melt Ice. **Declared bonuses:** RANGE 2, CRIT_CHANCE 15, SPE_DEF 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `wl-range` (traced)** — *Trigger:* Item applied at fight start; re-applied when the Locked status ends. *Targets:* holder. *Effect:* Declared RANGE 2 is added to the entity's range (range = max(1, range + 2)); declared CRIT_CHANCE 15 (percentage points) and SPE_DEF 3 follow the generic stat paths. The Locked status forces range to 1, and when Locked ends the range is rebuilt as base range + 2 (+1 for a Fairy holder with Long Wand). *Duration:* Whole fight. *Scaling:* None. *Limits:* No ItemEffects entry: the range bonus is the only special handling found; effects of range on targeting and casting are the shared ones (a cast needs a target in range). *Consumption/reset:* Not consumed.

*Arithmetic:* Charmander range 1 + 2 = 3: it can start casting with the target up to 3 cells away instead of adjacent. Blast Burn, however, hits only enemies in the 8 cells around the CASTER (blast-burn.ts: getAdjacentCells of the caster), so range does not enlarge that area. Inference: casting at a distant target can hit nothing if no enemy is adjacent to the caster at that moment. Formula and code reading only; positions and targeting dynamics were not simulated.

*Unresolved / untested:* How range changes interact with movement and target choice in fights (targeting paths not audited); Other effects that reset or overwrite range; Area abilities centered on the caster (e.g. Blast Burn) are not enlarged by range; other ability shapes were not checked.

*Conditional deduction (inference, not a ranking):* More range lets a holder attack and start casting from farther away, but it does not enlarge caster-centered areas such as Blast Burn's adjacent cells, so for such abilities a distant cast may hit nothing (inference); it also adds crit chance and a little SPE_DEF.

*Sources:* `core/pokemon-entity.ts:1433–1436`; `models/colyseus-models/status.ts:1164–1176`; `models/colyseus-models/status.ts:1156–1163`; `core/pokemon-entity.ts:1399–1437`; `core/abilities/blast-burn.ts:14–16`

### RAZOR_CLAW

**Recipe** (declared): Black Glasses + Charcoal. **Declared bonuses:** CRIT_CHANCE 50, ATK 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

**Stat effect (traced):** Declared CRIT_CHANCE 50 raises the crit chance by 50 percentage points (default 10 becomes 60 %) and ATK 3 adds flat attack through the generic stat helpers; crit chance applies to every basic attack roll; for ability casts the crit roll happens only when the cast is eligible: the caster has ABILITY_CRIT or the ability crits by default (canCritByDefault), and the cast is made through castAbility with its canCrit flag true.

**Absent (traced):** No ItemEffects entry and no other behavioral reference: the only references in app/**/*.ts(x) are the enum/recipe (Item.ts), the declared stats (config/game/items.ts) and Hidden Power code that gives a Sharpedo a Razor Claw (abilities/hidden-power.ts:181). Its gameplay content is the declared CRIT_CHANCE 50 (percentage points) and ATK 3.

*Arithmetic:* Default crit chance 10 + 50 = 60 % per basic attack. Formula only.

*Unresolved / untested:* Hidden Power context for the Sharpedo grant.

*Conditional deduction (inference, not a ranking):* The item is only stats: a high crit chance helps units whose damage comes from crit-scalable attacks; nothing else is implemented for it.

*Sources:* `core/abilities/hidden-power.ts:181`; `core/pokemon-entity.ts:1399–1437`; `core/pokemon-entity.ts:621–648`; `core/abilities/cast.ts:18–25`

### SAFETY_GOGGLES

**Recipe** (declared): Black Glasses + Heart Scale. **Declared bonuses:** CRIT_CHANCE 10, DEF 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `sg-rune` (traced)** — *Trigger:* When the item is applied at fight start. *Targets:* holder. *Effect:* Triggers Rune Protect for 60000 ms (clears negative statuses and makes status triggers that check runeProtect refuse); also the holder takes no sandstorm damage and, when benched, no lava-weather burn damage. *Duration:* 60000 ms of Rune Protect (timer counts down in fight time); on item removal the cooldown is set to 0 so it ends at the next status update. *Scaling:* None. *Limits:* Rune Protect blocks only the status triggers that check it (about a dozen sites, not individually listed); sandstorm and lava immunities are separate checks. Resurrection copies the Rune Protect state and cooldown from a freshly built clone. *Consumption/reset:* Not consumed.

*Arithmetic:* 60000 ms is 60 s if one time unit is a millisecond (assumed, see core-mechanics section C).

*Unresolved / untested:* Which statuses Rune Protect blocks were not enumerated; Whether the 60 s timer outlasts typical fights was not measured.

*Conditional deduction (inference, not a ranking):* A long Rune Protect against status effects early in the fight, plus immunity to sandstorm and lava weather damage; against opponents without statuses or those weathers its measurable content is the declared stats.

*Sources:* `core/effects/items.ts:671–678`; `core/pokemon-state.ts:936–941`; `core/simulation.ts:281–286`; `core/pokemon-entity.ts:1556–1559`; `models/colyseus-models/status.ts:956–966`; `models/colyseus-models/status.ts:968–974`

### KINGS_ROCK

**Recipe** (declared): Miracle Seed + Miracle Seed. **Declared bonuses:** HP 100. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `kr-shield` (traced)** — *Trigger:* At simulation start, after all units are set up (OnSimulationStart hook). *Targets:* holder. *Effect:* Gains a shield of 0.2 x its max HP at that moment (addShield, apBoost 0; rounded). *Duration:* Shield lasts until depleted. *Scaling:* No AP/crit scaling; addShield rules apply (enraged halves, Big Eater Belt scales). *Limits:* Once per fight; uses max HP including the declared HP 100 and other start bonuses already applied. *Consumption/reset:* Not consumed (the item also appears on a PvE enemy: pve-stages.ts:101).

*Arithmetic:* Max HP 300 (declared +100 included): shield 60. Formula only.

*Unresolved / untested:* Which hooks run after it and could change max HP afterwards (not enumerated).

*Conditional deduction (inference, not a ranking):* A start-of-fight shield proportional to the holder's max HP, on top of 100 declared HP.

*Sources:* `core/effects/items.ts:680–684`; `models/pve-stages.ts:101`; `core/simulation.ts:239–262`; `core/pokemon-state.ts:382–418`

### STICKY_BARB

**Recipe** (declared): Miracle Seed + Heart Scale. **Declared bonuses:** DEF 6, HP 15. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `stb-thorns` (traced)** — *Trigger:* When the holder is the target of a basic attack (the OnAttackReceived hooks run inside the attacker's onAttack, so also for dodged or protected attacks) and the attacker is within distance 1 and does not hold Protective Pads. *Targets:* the attacker. *Effect:* True damage round(3 + 0.15 x holder DEF) dealt by the holder with handleDamage, then Wound for 3000 ms on the attacker. *Duration:* Instant damage; Wound 3000 ms (heals received become 0 while wounded). *Scaling:* True damage skips the defense division but gets the shared ceil/min-1 and goes through shields; uses the holder's current DEF; no AP/crit scaling. *Limits:* Melee distance only (Chebyshev distance 1); does not trigger on ability damage. *Consumption/reset:* Not consumed.

*Arithmetic:* Declared DEF 6: 3 + 0.15 x 6 = 3.9, round 4 true damage per melee basic attack. Formula only.

*Unresolved / untested:* Whether the true damage also triggers on-damage-dealt effects for the holder (shared handleDamage path; not checked); Wound status details beyond the heal block.

*Conditional deduction (inference, not a ranking):* It punishes melee attackers (and wounds them), not ranged attackers or ability damage, and scales with the holder's DEF.

*Sources:* `core/effects/items.ts:967–987`; `core/pokemon-entity.ts:953–968`; `core/pokemon-entity.ts:911–950`

### PROTECTIVE_PADS

**Recipe** (declared): Miracle Seed + Charcoal. **Declared bonuses:** SHIELD 60, ATK 6. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `pp-noretaliation` (traced)** — *Trigger:* When an effect would deal retaliation, reflection or recoil damage to a unit holding Protective Pads. *Targets:* the holder, as the unit that would be hit by a retaliation. *Effect:* The retaliation is skipped for the sites found by searching for the item name: reflect status (physical reflection), magic bounce, Power Lens (including the Loaded Dice branch), Sticky Barb, spike armor, two synergy effects (a contact-displacement/damage effect and an adjacent-enemy shock effect) and the Qwilfish passive. *Duration:* Whole fight. *Scaling:* None. *Limits:* Only the listed sites were read; other retaliation effects may exist or may ignore the item. *Consumption/reset:* Not consumed.
- **Effect `pp-norecoil` (traced)** — *Trigger:* When one of the holder's own abilities would deal recoil or self-damage. *Targets:* the holder. *Effect:* The self-damage is skipped in Wood Hammer, Explosion, Double-Edge, Chloroblast, Grudge Dive and Head Smash (only these six ability files mention the item) and in the Two-Edged Wand's self-inflicted damage (synergies.ts, wand effect). *Duration:* Whole fight. *Scaling:* None. *Limits:* Other recoil abilities not listed here may not check the item. *Consumption/reset:* Not consumed.
- **Effect `pp-shield` (traced)** — *Trigger:* When the holder's attack reaches a target that has a shield (shield > 0) in handleDamage, and the holder is not the target. *Targets:* the shielded target. *Effect:* The damage assigned to the shield (damageOnShield) is doubled. If the doubled amount reaches or exceeds the current shield, the shield is depleted and the excess (doubled amount minus shield) becomes residual damage that goes to HP; so when the shield breaks, the doubling can cost the target more HP than without the pads. Against a target with no shield the branch is not entered and nothing is doubled. *Duration:* Per hit, whole fight. *Scaling:* Applies inside handleDamage after the defense step and after the flinch split. *Limits:* Only hits against a shielded target; flinch (which splits the hit between shield and HP) was not combined with this. *Consumption/reset:* Not consumed.
- **Effect `pp-stats` (declared)** — *Trigger:* Item applied at fight start. *Targets:* holder. *Effect:* Declared SHIELD 60 as a starting shield (addShield) and ATK 6. *Duration:* Shield until depleted. *Scaling:* Generic stat paths. *Limits:* -. *Consumption/reset:* -.

*Arithmetic:* Ordinary path, no flinch or other hooks: reduced hit 30 against shield 20. Without pads: damageOnShield 30 >= 20, the shield loses 20 and residual 10 goes to HP (HP -10). With pads: damageOnShield 60 >= 20, the shield loses 20 and residual 60 - 20 = 40 goes to HP (HP -40). Hand arithmetic from the source, not an execution.

*Unresolved / untested:* The list of ignored retaliation effects is the list of sites that mention the item, not an audit of every retaliation in the game; Interaction with Explosive Band-style counters is inference only.

*Conditional deduction (inference, not a ranking):* Mostly relevant when the holder's own abilities have recoil or when the opponent has reflection-type effects; against shielded targets the doubled shield damage can push the excess into HP when the shield breaks, but it does nothing against unshielded targets.

*Sources:* `core/pokemon-state.ts:522–527`; `core/pokemon-entity.ts:360–366`; `core/pokemon-entity.ts:444–463`; `core/effects/items.ts:152–181`; `core/effects/items.ts:967–987`; `core/pokemon-entity.ts:1098–1106`; `core/effects/synergies.ts:360–364`; `core/effects/synergies.ts:811–815`; `core/effects/passives.ts:305–309`; `core/abilities/wood-hammer.ts:30`; `core/abilities/explosion.ts:29`; `core/abilities/double-edge.ts:25`; `core/abilities/chloroblast.ts:30`; `core/abilities/grudge-dive.ts:43`; `core/abilities/head-smash.ts:30`; `core/effects/synergies.ts:660–664`; `core/pokemon-state.ts:628–634`; `core/pokemon-state.ts:618–649`; `core/pokemon-entity.ts:1399–1437`

### MAX_REVIVE

**Recipe** (declared): Miracle Seed + Never Melt Ice. **Declared bonuses:** none — No ItemStats entry exists for MAX_REVIVE: it declares no stat bonus (entry absent, not zero).. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `mr-revive` (traced)** — *Trigger:* Fight start (item applied), then when the holder's HP reaches 0 or below in handleDamage. *Targets:* holder. *Effect:* Grants the resurrection flag at fight start; on HP <= 0 it consumes the flag: holder becomes untargettable and resurrecting for 2000 ms and clears negative statuses; after that resurrect() recomputes stats from a fresh clone (max HP, ATK, DEF, SPE_DEF, AP, speed, crit, dodge, range, luck), sets HP = max HP, PP = 0, shield = 0, resets stack counters (Mach Ribbon, Muscle Band, Soul Dew, Upgrade, Sound Cry), removes MAX_REVIVE from the fight entity, and returns to the moving state with cooldown 0. *Duration:* 2000 ms downtime, then full HP. *Scaling:* No AP/crit scaling. *Limits:* Not applied to INANIMATE passive units; one revive per item. *Consumption/reset:* Consumed for the fight (removed from the entity, board unit keeps it).

*Unresolved / untested:* Death paths that do not go through handleDamage's HP<=0 check (not enumerated); Exactly which stats the clone restores beyond the ones listed, and which in-fight buffs are therefore lost; Behavior of ally targeting while the holder is untargettable (only noted: enemies targeting it switch to moving).

*Conditional deduction (inference, not a ranking):* A second life with full HP and a 2-second downtime, but buffs gained during the fight are lost on revival and PP restarts at 0. Whether the downtime is acceptable depends on the fight; nothing here measures it.

*Sources:* `core/effects/items.ts:616–623`; `models/colyseus-models/status.ts:1041–1052`; `core/pokemon-state.ts:783–797`; `models/colyseus-models/status.ts:1054–1063`; `models/colyseus-models/status.ts:311–313`; `core/pokemon-entity.ts:1439–1448`; `core/pokemon-entity.ts:1563–1565`; `core/pokemon-entity.ts:1533–1539`

### ASSAULT_VEST

**Recipe** (declared): Never Melt Ice + Never Melt Ice. **Declared bonuses:** SPE_DEF 40. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `av-status` (traced)** — *Trigger:* Whenever burn or poison damage is computed for the holder, and during lava weather for the holder on the bench. *Targets:* holder. *Effect:* Burn damage x0.5 and poison damage x0.5 (each multiplier sits among the other modifiers of the same computation); in lava weather the bench burn is floor(x0.5) of round(5 % max HP). *Duration:* Whole fight / while on the bench. *Scaling:* Multiplicative with the other modifiers in those computations. *Limits:* Only burn, poison and the lava bench burn were found; other status damage is not covered. *Consumption/reset:* Not consumed.

*Unresolved / untested:* Declared SPE_DEF 40 is the main measurable effect: special damage is divided by 1 + 0.05 x SPE_DEF (e.g. 40 more SPE_DEF -> divisor +2.0); Whether other damage-over-time sources use the same multiplier was not enumerated.

*Conditional deduction (inference, not a ranking):* Beyond its large declared SPE_DEF, it only reduces burn and poison damage, so its extra value depends on the opponent applying those statuses.

*Sources:* `models/colyseus-models/status.ts:455–457`; `models/colyseus-models/status.ts:629–631`; `core/simulation.ts:274–296`

### SHELL_BELL

**Recipe** (declared): Never Melt Ice + Charcoal. **Declared bonuses:** ATK 5, SPE_DEF 5. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `sb-heal` (traced)** — *Trigger:* Whenever the holder deals damage (basic attack parts or ability, any damage type; callback runs when the target took damage). *Targets:* holder. *Effect:* Heals ceil(0.33 x damage actually taken by the target) (shield damage plus HP lost, overkill excluded); skipped when the target is the holder itself. *Duration:* Instant, every qualifying hit. *Scaling:* handleHeal with apBoost 0 and no crit: no AP or crit scaling. handleHeal then gives 0 under wound or protect, x1.3 with BUFF_HEAL_RECEIVED, x0.5 burning, x0.5 enraged, x1.2 Zenith weather, rounds, and caps at missing HP. *Limits:* Capped by missing HP; isRetaliation is not checked. *Consumption/reset:* Not consumed.

*Arithmetic:* Target takes 100: ceil(0.33 x 100) = 33 heal before the handleHeal modifiers. Formula only.

*Unresolved / untested:* Whether every multi-hit/area ability hit calls the callback exactly once per target (shared path; not enumerated).

*Conditional deduction (inference, not a ranking):* Healing follows damage dealt (not AP), so units that deal more damage (more hits, area abilities) heal more; wound/burn/enrage on the holder reduce or cancel the heal.

*Sources:* `core/effects/items.ts:601–605`; `core/pokemon-state.ts:308–360`; `core/pokemon-state.ts:308–318`; `core/pokemon-entity.ts:1151–1171`; `core/pokemon-state.ts:734–750`; `core/pokemon-state.ts:620–649`

### POKE_DOLL

**Recipe** (declared): Never Melt Ice + Heart Scale. **Declared bonuses:** DEF 3, SPE_DEF 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `pd-reduce` (traced)** — *Trigger:* When the holder takes non-true damage in handleDamage. *Targets:* holder. *Effect:* Damage after the defense division is multiplied by 0.7 (before flat reductions such as Guts and before the ceil/min-1 step). *Duration:* Whole fight. *Scaling:* Not applied to true damage. *Limits:* Rounding afterwards is ceil with a minimum of 1. *Consumption/reset:* Not consumed.
- **Effect `pd-taunt` (traced)** — *Trigger:* When an enemy picks its basic-attack target among units in range (getNearestTargetAtRange). *Targets:* enemy targeting. *Effect:* Among the enemies at the minimum distance, units holding Poke Doll are chosen before others (random among holders). *Duration:* Whole fight. *Scaling:* Only breaks ties at the nearest distance. *Limits:* Other targeting routines (sight-based movement targeting, abilities with their own targeting) were not checked. *Consumption/reset:* Not consumed.

*Arithmetic:* Physical 20 vs DEF 10: 20/1.5 = 13.33, x0.7 = 9.33, ceil 10 (versus 14 without the doll). Formula only.

*Unresolved / untested:* Targeting outside getNearestTargetAtRange; Declared DEF 3 and SPE_DEF 3 follow the generic paths.

*Conditional deduction (inference, not a ranking):* It reduces non-true damage by 30 % after the defense step and draws basic attacks among equally near enemies, which is relevant when the holder stands among nearest targets.

*Sources:* `core/pokemon-state.ts:566–572`; `core/pokemon-state.ts:1131–1160`

### RED_ORB

**Recipe** (declared): Charcoal + Charcoal. **Declared bonuses:** ATK 10. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `ro-true` (traced)** — *Trigger:* Each basic attack by the holder. *Targets:* the attacked enemy. *Effect:* 25 % of the attack's damage becomes true damage (trueDamagePart += 0.25, added to any other true-damage share); the true part is damage x share x (crit power if the attack crit) and the rest of the damage is multiplied by (1 - share). *Duration:* Per basic attack. *Scaling:* The true part skips the defense division but gets the shared ceil/min-1; Rocky Helmet's crit reduction does not apply to the true part of a basic attack. *Limits:* Basic attacks only; abilities are unaffected. *Consumption/reset:* Not consumed.
- **Effect `ro-evo` (declared)** — *Trigger:* Item evolution rules declared on Groudon and Sableye. *Targets:* Groudon, Sableye. *Effect:* Groudon evolves to Primal Groudon and Sableye to Mega Sableye when Red Orb is held (declared rules); handler paths not traced here; Hidden Power code also gives a Hitmonlee a Red Orb. *Duration:* -. *Scaling:* -. *Limits:* -. *Consumption/reset:* -.

*Arithmetic:* Attack 40, no crit, target DEF 10: without the orb 40/1.5 = 26.67 -> 27; with it 30 physical (30/1.5 = 20) + 10 true = 30, about +3 here (the effect favors high-DEF targets). Formula only.

*Unresolved / untested:* Evolution handler paths; Hidden Power context for Hitmonlee.

*Conditional deduction (inference, not a ranking):* Converting part of each basic attack to true damage helps most against high-DEF targets and does little against low-DEF ones; only basic attacks are affected.

*Sources:* `core/pokemon-state.ts:151–153`; `core/pokemon-state.ts:208–212`; `core/pokemon-state.ts:64–72`; `models/colyseus-models/pokemon.ts:6074`; `models/colyseus-models/pokemon.ts:12497`

### FLAME_ORB

**Recipe** (declared): Charcoal + Heart Scale. **Declared bonuses:** ATK 5, DEF 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `fo-burn` (traced)** — *Trigger:* When the item is applied at fight start. *Targets:* holder. *Effect:* Adds freeze immunity, adds the unit's base ATK again (+baseAtk), and ATTEMPTS to set the holder on fire for 300000 ms with itself as the origin (triggerBurn); the attempt is refused if the holder has burn immunity (IMMUNITY_BURN), Rune Protect or the Water Bubble passive. While the item is held and the holder is not burning, the attempt is repeated (60000 ms) on later status updates until the fight ends. Burn deals 5 % of the holder's max HP as true damage every 1000 ms (modified by weather, Assault Vest x0.5, some passives; 0 for Magmarizer / Well Baked), and burning halves healing the holder receives. *Duration:* Whole fight; on removal ATK is reduced by baseAtk and the burn cooldown is set to 0. *Scaling:* No AP/crit scaling. The burn damage is handleDamage true damage with the holder as its own attacker (Shell Bell skips self-inflicted damage). *Limits:* The self-burn damage per tick scales with max HP; healing received is halved while burning (Shell Bell, Green Orb and similar heals). *Consumption/reset:* Not consumed.

*Arithmetic:* Max HP 400: 20 true damage per second-tick before modifiers; base ATK 8 becomes 16 plus the declared 5. Formula only.

*Unresolved / untested:* Self-burn is not guaranteed in every setup: Rune Protect (e.g. Ability Shield, Safety Goggles on the same unit), burn immunity and Water Bubble can block it; the +baseAtk still applies (inference for the specific item combinations, untested); Burn damage modifiers beyond the ones shown (weather and passives were read, not all tested); Interaction with healing sources other than the ones named is by the shared handleHeal path.

*Conditional deduction (inference, not a ranking):* It trades an attempted lasting self-burn (and halved healing while burning; the burn can be blocked by Rune Protect, burn immunity or Water Bubble) for a large ATK increase; whether that is acceptable depends on the holder's max HP, healing and fight length, which this note does not evaluate.

*Sources:* `core/effects/items.ts:636–649`; `core/pokemon-state.ts:963–969`; `models/colyseus-models/status.ts:397–411`; `models/colyseus-models/status.ts:440–500`; `core/pokemon-state.ts:336–350`; `core/pokemon-state.ts:308–360`

### ROCKY_HELMET

**Recipe** (declared): Heart Scale + Heart Scale. **Declared bonuses:** DEF 25. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `rh-crit` (traced)** — *Trigger:* When an enemy's attack against the holder crits. *Targets:* holder as target. *Effect:* Cancels the crit damage bonus: in basic attacks the crit reduction factor becomes 0 (and target.count.crit is not incremented); in handleSpecialDamage the factor is 0 only for non-true damage. The attacker's crit roll still counts as a crit for its own on-crit effects (Black Belt, Scope Lens). *Duration:* Whole fight. *Scaling:* Reduces the crit multiplier 1 + (critPower - 1) x factor to 1 for the cases above. *Limits:* The true-damage part of a basic attack multiplies by the attacker's full critPower and is not reduced by the factor (pokemon-state.ts:208-212). *Consumption/reset:* Not consumed.

*Arithmetic:* Attacker crit power 2, no helmet: x2 on the physical/special part; with the helmet: x1. Formula only.

*Unresolved / untested:* Other crit paths (reflection, abilities that compute crit themselves) were not enumerated; Declared DEF 25 is the main numeric effect: physical damage divisor +1.25 (1 + 0.05 x 25).

*Conditional deduction (inference, not a ranking):* It removes the crit bonus on hits against the holder (with 25 DEF), so it matters against crit-heavy attackers; true-damage parts of basic attacks keep their crit multiplier.

*Sources:* `core/pokemon-state.ts:64–72`; `core/pokemon-entity.ts:412–433`; `core/pokemon-state.ts:208–212`

### FRIEND_BOW

**Recipe** (declared): Silk Scarf + Fossil Stone. **Declared bonuses:** SHIELD 30. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `fb-type` (traced)** — *Trigger:* When equipped on a unit (the board unit's types gain Normal through computeSynergies) and when combined onto a unit. *Targets:* holder. *Effect:* Grants the Normal type (SynergyGivenByItem), counted once per evolution family on the board like other item-granted types; when the combine result would be a Friend Bow on a holder that already has Normal, the item pops back to the inventory instead of being equipped. *Duration:* Whole time held. *Scaling:* No AP/crit; declared SHIELD 30 is a starting shield. *Limits:* Granting the type does not by itself activate a Normal tier (thresholds 3/5/7/9). *Consumption/reset:* Not consumed.

*Note:* Crafting and allowance (see silk-scarf-items.md): the Normal synergy tier (thresholds 3/5/7/9) sets how many scarf items the player's allowance supports (Nullify Bandanna counts 2). Crafting a scarf item does not depend on a free slot: the craft always proceeds, and the result is only added to scarvesItems (tracked) while scarvesItems.length is below the Normal tier. Tracking matters when the Normal tier later drops: tracked scarves are then removed (from a holder first, otherwise the inventory); untracked ones are not.

*Note:* Detailed specialist guide: silk-scarf-items.md; scarf allowance evidence: sc-allow-tier, sc-allow-player, sc-allow-craft-a, sc-allow-craft-b, sc-allow-lost

*Unresolved / untested:* Equip-by-drag refusal for Friend Bow outside the combine path was not separately traced (the stone refusal list covers only SynergyStones); Dev-snapshot differences not checked.

*Conditional deduction (inference, not a ranking):* Useful as a Normal-type source (counts once per evolution family) and for the Normal tier thresholds, and its shield is a starting shield; the Normal type is only worth something if the team can reach a Normal tier.

*Sources:* `types/enum/Item.ts:552–561`; `types/enum/Item.ts:837`; `rooms/commands/game-commands.ts:925–931`

### BLACK_BELT

**Recipe** (declared): Silk Scarf + Black Glasses. **Declared bonuses:** SHIELD 15, CRIT_CHANCE 30. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `bb-shield` (traced)** — *Trigger:* On each basic attack by the holder whose crit roll succeeded (onAttack runs for every basic attack, successful or not). *Targets:* holder. *Effect:* Gains a shield of ceil(0.33 x totalDamage); totalDamage is physical+special+true after rounding and the crit factor but BEFORE the target's defense and shields (and includes e.g. Nullify PP damage). *Duration:* Shield until depleted. *Scaling:* No AP; the shield passes through addShield (Big Eater Belt scales it; enraged halves it). *Limits:* A dodged or protected attack has damage 0, so the shield is usually 0; Rocky Helmet on the target removes the crit bonus but the crit roll still counts. *Consumption/reset:* Not consumed.

*Note:* Crafting and allowance (see silk-scarf-items.md): the Normal synergy tier (thresholds 3/5/7/9) sets how many scarf items the player's allowance supports (Nullify Bandanna counts 2). Crafting a scarf item does not depend on a free slot: the craft always proceeds, and the result is only added to scarvesItems (tracked) while scarvesItems.length is below the Normal tier. Tracking matters when the Normal tier later drops: tracked scarves are then removed (from a holder first, otherwise the inventory); untracked ones are not.

*Note:* Detailed specialist guide: silk-scarf-items.md; scarf allowance evidence: sc-allow-tier, sc-allow-player, sc-allow-craft-a, sc-allow-craft-b, sc-allow-lost

*Unresolved / untested:* Declared CRIT_CHANCE 30 and SHIELD 15 follow the generic stat paths.

*Conditional deduction (inference, not a ranking):* Most relevant for holders with high crit chance and large basic attacks; it does nothing for casts.

*Sources:* `core/effects/items.ts:608–614`; `core/pokemon-state.ts:236–238`; `core/pokemon-entity.ts:938–950`; `core/pokemon-state.ts:64–72`

### MACH_RIBBON

**Recipe** (declared): Silk Scarf + Magnet. **Declared bonuses:** SHIELD 15, SPEED 10. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `mr2-speed` (traced)** — *Trigger:* Every 3000 ms of fight time (periodic effect). *Targets:* holder. *Effect:* +20 speed per tick (addSpeed); machRibbonCount++ (10 ticks gives a title). *Duration:* Whole fight; on removal speed is reduced by 15 x tick count (code observation: gain +20 vs removal -15). *Scaling:* No AP/crit; speed is clamped to 0 to 300. *Limits:* None beyond the speed clamp. The interval is nominal: the periodic timer is reset to the full interval each time it fires (no catch-up of missed intervals), so ticks per unit of fight time can fall slightly below one per interval.. *Consumption/reset:* Counter reset on removal and resurrection.

*Note:* Crafting and allowance (see silk-scarf-items.md): the Normal synergy tier (thresholds 3/5/7/9) sets how many scarf items the player's allowance supports (Nullify Bandanna counts 2). Crafting a scarf item does not depend on a free slot: the craft always proceeds, and the result is only added to scarvesItems (tracked) while scarvesItems.length is below the Normal tier. Tracking matters when the Normal tier later drops: tracked scarves are then removed (from a holder first, otherwise the inventory); untracked ones are not.

*Note:* Detailed specialist guide: silk-scarf-items.md; scarf allowance evidence: sc-allow-tier, sc-allow-player, sc-allow-craft-a, sc-allow-craft-b, sc-allow-lost

*Unresolved / untested:* The gain/removal mismatch (+20 vs -15 per tick) is a code observation, not fixed and not tested.

*Conditional deduction (inference, not a ranking):* A steady speed ramp for long fights; short fights get fewer ticks. Removal arithmetic differs from the gain (code observation).

*Sources:* `core/effects/items.ts:241–253`; `core/effects/items.ts:784–798`; `core/pokemon-entity.ts:752–775`

### EXPLOSIVE_BAND

**Recipe** (declared): Silk Scarf + Charcoal. **Declared bonuses:** SHIELD 50, ATK 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `eb-boom` (traced)** — *Trigger:* The first time the holder's shield is depleted (fired from damage that reaches the shield, and from a negative addShield taking it to <= 0). *Targets:* adjacent enemies (8 cells). *Effect:* Removes the item (once), then deals round(0.5 x dps.shield) special damage to each adjacent enemy; dps.shield is the holder's entry in the team DPS meter, copied each tick from shieldDone = shield the holder has GRANTED (to itself or others), not shield received. *Duration:* Instant. *Scaling:* No AP/crit; special damage goes through the targets' SPE_DEF and shields; the counter lags up to one tick; a missing meter entry gives 0. *Limits:* In the damage path the shield must be > 0 before the hit. *Consumption/reset:* Consumed for the fight (removed from the entity).

*Note:* Crafting and allowance (see silk-scarf-items.md): the Normal synergy tier (thresholds 3/5/7/9) sets how many scarf items the player's allowance supports (Nullify Bandanna counts 2). Crafting a scarf item does not depend on a free slot: the craft always proceeds, and the result is only added to scarvesItems (tracked) while scarvesItems.length is below the Normal tier. Tracking matters when the Normal tier later drops: tracked scarves are then removed (from a holder first, otherwise the inventory); untracked ones are not.

*Note:* Detailed specialist guide: silk-scarf-items.md; scarf allowance evidence: sc-allow-tier, sc-allow-player, sc-allow-craft-a, sc-allow-craft-b, sc-allow-lost

*Unresolved / untested:* Shield granted by Ability Shield counts for the ally as its own caster (inference); Dev-snapshot differences not checked.

*Conditional deduction (inference, not a ranking):* Its damage depends on shield the holder has granted (not received) and happens once; a holder that shields others (or itself) builds the counter.

*Sources:* `core/effects/items.ts:1500–1534`; `core/pokemon-state.ts:620–643`; `core/pokemon-state.ts:408–417`; `core/simulation.ts:1345–1384`; `core/dps.ts:1–40`; `core/pokemon-state.ts:407`

### TWIST_BAND

**Recipe** (declared): Silk Scarf + Never Melt Ice. **Declared bonuses:** SPE_DEF 20, SHIELD 50. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `tb-flip` (traced)** — *Trigger:* Whenever a stat helper receives a negative value from the environment or an enemy caster (applyTwistBandBuff). *Targets:* holder. *Effect:* Flips the value to positive in 11 PokemonEntity methods: addPP, addCritChance, addCritPower, addMaxHP, addDodgeChance, addAbilityPower, addLuck, addDefense, addSpecialDefense, addAttack, addSpeed; several stat-stealing abilities also skip stealing from a Twist Band holder (guard checks read, bodies not fully read). *Duration:* Whole fight. *Scaling:* Not applied in addShield; not applied to damage, healing, statuses or range. *Limits:* Where Big Eater Belt also applies, the Belt runs first. *Consumption/reset:* Not consumed.

*Note:* Crafting and allowance (see silk-scarf-items.md): the Normal synergy tier (thresholds 3/5/7/9) sets how many scarf items the player's allowance supports (Nullify Bandanna counts 2). Crafting a scarf item does not depend on a free slot: the craft always proceeds, and the result is only added to scarvesItems (tracked) while scarvesItems.length is below the Normal tier. Tracking matters when the Normal tier later drops: tracked scarves are then removed (from a holder first, otherwise the inventory); untracked ones are not.

*Note:* Detailed specialist guide: silk-scarf-items.md; scarf allowance evidence: sc-allow-tier, sc-allow-player, sc-allow-craft-a, sc-allow-craft-b, sc-allow-lost

*Unresolved / untested:* Line-level list of the 11 methods is in silk-scarf-items.md and validated by validate-items.mjs; Ability guards: spectral-thief, bared-fangs, high-jump-kick, heart-swap, steel-wing, electro-web were checked at the guard lines only.

*Conditional deduction (inference, not a ranking):* Only matters against opponents that reduce the listed stats; it does not protect against damage, statuses or shield reduction.

*Sources:* `core/pokemon-entity.ts:1839–1868`; `core/abilities/spectral-thief.ts:38`

### LUCKY_RIBBON

**Recipe** (declared): Silk Scarf + Twisted Spoon. **Declared bonuses:** SHIELD 15, AP 50, LUCK 20. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `lr-dodge` (traced)** — *Trigger:* At simulation start (OnSimulationStart). *Targets:* holder. *Effect:* +15 % dodge chance (addDodgeChance 0.15; dodge capped at 0.9). *Duration:* Whole fight. *Scaling:* None. *Limits:* Dodge applies to the basic-attack dodge roll (X-Ray Vision, lock-on and CC states bypass it). *Consumption/reset:* Not consumed.

*Note:* Crafting and allowance (see silk-scarf-items.md): the Normal synergy tier (thresholds 3/5/7/9) sets how many scarf items the player's allowance supports (Nullify Bandanna counts 2). Crafting a scarf item does not depend on a free slot: the craft always proceeds, and the result is only added to scarvesItems (tracked) while scarvesItems.length is below the Normal tier. Tracking matters when the Normal tier later drops: tracked scarves are then removed (from a holder first, otherwise the inventory); untracked ones are not.

*Note:* Detailed specialist guide: silk-scarf-items.md; scarf allowance evidence: sc-allow-tier, sc-allow-player, sc-allow-craft-a, sc-allow-craft-b, sc-allow-lost

*Unresolved / untested:* Declared AP 50, LUCK 20 and SHIELD 15 follow the generic stat paths.

*Conditional deduction (inference, not a ranking):* A small fixed dodge chance plus declared AP 50 and luck 20, so its measurable content is mostly those stats.

*Sources:* `core/effects/items.ts:1550–1554`

### BIG_EATER_BELT

**Recipe** (declared): Silk Scarf + Miracle Seed. **Declared bonuses:** HP 50, SHIELD 15. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `be-buff` (traced)** — *Trigger:* Whenever a stat helper receives a positive value (or a negative value from a same-team caster, i.e. a buff being lost). *Targets:* holder. *Effect:* Multiplies it by 1.25 rounded down (applyBigEaterBeltStatBuff): positive values, and also negative values from same-team casters (a buff being lost, so a same-team debuff is scaled too); negative values from enemies or the environment are not scaled. Applied in 11 methods: addShield, addCritChance, addCritPower (2 digits), addMaxHP, addDodgeChance (3 digits), addAbilityPower, addLuck, addDefense, addSpecialDefense, addAttack, addSpeed (not addPP); also lets the unit eat a second dish. *Duration:* Whole fight. *Scaling:* The belt's own HP 50 and SHIELD 15 are scaled too (items are copied before effects are applied): 62 and 18 (inference, not executed). *Limits:* Not applied to PP, damage, healing, statuses. *Consumption/reset:* Not consumed.

*Note:* Crafting and allowance (see silk-scarf-items.md): the Normal synergy tier (thresholds 3/5/7/9) sets how many scarf items the player's allowance supports (Nullify Bandanna counts 2). Crafting a scarf item does not depend on a free slot: the craft always proceeds, and the result is only added to scarvesItems (tracked) while scarvesItems.length is below the Normal tier. Tracking matters when the Normal tier later drops: tracked scarves are then removed (from a holder first, otherwise the inventory); untracked ones are not.

*Note:* Detailed specialist guide: silk-scarf-items.md; scarf allowance evidence: sc-allow-tier, sc-allow-player, sc-allow-craft-a, sc-allow-craft-b, sc-allow-lost

*Unresolved / untested:* With Upgrade/Muscle Band/Soul Dew the per-tick gain is scaled but their removal subtracts unscaled amounts (inference).

*Conditional deduction (inference, not a ranking):* Amplifies buffs the holder receives for the listed stats, and also scales negative changes from same-team sources; with no such changes its content is the declared HP and shield.

*Sources:* `core/pokemon-entity.ts:1839–1868`; `models/colyseus-models/pokemon.ts:164–168`

### COVER_BAND

**Recipe** (declared): Silk Scarf + Heart Scale. **Declared bonuses:** DEF 12, SHIELD 50. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `cb-redirect` (traced)** — *Trigger:* In handleDamage, after reduction and shield absorption, when the target would reach HP <= 0 and does not itself hold Cover Band. *Targets:* an adjacent same-team Cover Band holder with HP > 0 (first match). *Effect:* Returns holder.handleDamage with the ORIGINAL incoming damage (full pipeline with the holder's defenses and shield); the original target keeps the shield loss already applied but loses no HP and gains no damage PP. *Duration:* Instant. *Scaling:* Only lethal hits; adjacency is checked at the moment of the hit. *Limits:* The cover ally can die from the redirected hit. *Consumption/reset:* Not consumed.

*Note:* Crafting and allowance (see silk-scarf-items.md): the Normal synergy tier (thresholds 3/5/7/9) sets how many scarf items the player's allowance supports (Nullify Bandanna counts 2). Crafting a scarf item does not depend on a free slot: the craft always proceeds, and the result is only added to scarvesItems (tracked) while scarvesItems.length is below the Normal tier. Tracking matters when the Normal tier later drops: tracked scarves are then removed (from a holder first, otherwise the inventory); untracked ones are not.

*Note:* Detailed specialist guide: silk-scarf-items.md; scarf allowance evidence: sc-allow-tier, sc-allow-player, sc-allow-craft-a, sc-allow-craft-b, sc-allow-lost

*Unresolved / untested:* Explosive Band can fire on the original target before the redirect (shield step precedes it).

*Conditional deduction (inference, not a ranking):* It protects adjacent allies only from lethal hits and puts the full original damage on the holder, so the holder's defenses and shield decide whether that is sustainable.

*Sources:* `core/pokemon-state.ts:698–725`

### EFFICIENT_BANDANNA

**Recipe** (declared): Silk Scarf + Mystic Water. **Declared bonuses:** SHIELD 15, PP 15. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `ebn-maxpp` (traced)** — *Trigger:* At simulation start (OnSimulationStart). *Targets:* any unit found on the holder's cell or the cells directly left/right on the same row (no team check; off-board cells ignored; holder included). *Effect:* maxPP = round(0.85 x maxPP) for each; the holder's declared PP 15 adds to current PP only. *Duration:* Whole fight. *Scaling:* Two holders covering one unit multiply (each rounds). *Limits:* Whether an enemy can stand on those cells at start was not examined. *Consumption/reset:* Not consumed.

*Note:* Crafting and allowance (see silk-scarf-items.md): the Normal synergy tier (thresholds 3/5/7/9) sets how many scarf items the player's allowance supports (Nullify Bandanna counts 2). Crafting a scarf item does not depend on a free slot: the craft always proceeds, and the result is only added to scarvesItems (tracked) while scarvesItems.length is below the Normal tier. Tracking matters when the Normal tier later drops: tracked scarves are then removed (from a holder first, otherwise the inventory); untracked ones are not.

*Note:* Detailed specialist guide: silk-scarf-items.md; scarf allowance evidence: sc-allow-tier, sc-allow-player, sc-allow-craft-a, sc-allow-craft-b, sc-allow-lost

*Unresolved / untested:* Enemy-cell question above; Dev-snapshot differences not checked.

*Conditional deduction (inference, not a ranking):* It lowers max PP for a row segment, which speeds casting for casters there; units that do not cast gain nothing.

*Sources:* `core/effects/items.ts:1536–1548`; `core/simulation.ts:239–262`; `core/board.ts:33–37`

### NULLIFY_BANDANNA

**Recipe** (declared): Silk Scarf + Silk Scarf. **Declared bonuses:** SHIELD 30. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `nb-null` (traced)** — *Trigger:* Held by the unit. *Targets:* holder. *Effect:* (1) canCast is false, so the unit never casts; (2) on each basic attack specialDamage += current PP and PP is set to 0 (then the attack's own +5 PP is added afterwards); (3) addAbilityPower is replaced by addAttack(round(0.2 x value)) ignoring AP boost and crit factors. *Duration:* Whole fight. *Scaling:* The PP damage is special: reduced by the target's SPE_DEF and shield; it adds to totalDamage. *Limits:* Applies to any addAbilityPower call, positive or negative; uses 2 scarf slots of the allowance. *Consumption/reset:* Not consumed.

*Note:* Crafting and allowance (see silk-scarf-items.md): the Normal synergy tier (thresholds 3/5/7/9) sets how many scarf items the player's allowance supports (Nullify Bandanna counts 2). Crafting a scarf item does not depend on a free slot: the craft always proceeds, and the result is only added to scarvesItems (tracked) while scarvesItems.length is below the Normal tier. Tracking matters when the Normal tier later drops: tracked scarves are then removed (from a holder first, otherwise the inventory); untracked ones are not.

*Note:* Detailed specialist guide: silk-scarf-items.md; scarf allowance evidence: sc-allow-tier, sc-allow-player, sc-allow-craft-a, sc-allow-craft-b, sc-allow-lost

*Unresolved / untested:* Declared SHIELD 30 only.

*Conditional deduction (inference, not a ranking):* It turns a caster into a basic-attacker that converts PP into damage; casting-dependent plans do not combine with it.

*Sources:* `core/pokemon-entity.ts:250–256`; `core/attacking-state.ts:92`; `core/pokemon-state.ts:132–135`; `core/pokemon-entity.ts:621–631`

## Not covered
Eviolite and Shiny Stone (not recipe outputs; documented in [core-mechanics.md](core-mechanics.md) §G, outside the 55); consumables, tools, memory discs, special and held-by-code items; interactions between these items and specific abilities; Phione and Kyogre/Rayquaza/Groudon/Shaymin/Sableye/Eevee/Type Null evolution handler paths; burn damage details; dev-snapshot differences; gameplay validation of any item. The Silk Scarf items keep their detailed specialist guide in [silk-scarf-items.md](silk-scarf-items.md).
