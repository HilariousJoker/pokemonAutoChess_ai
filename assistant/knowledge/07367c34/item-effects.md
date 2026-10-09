# Item effects — batch 1 (12 items)

**Production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1`; deployment unverified.** Generated from [`item-effects.json`](../../data/07367c34/item-effects.json) (records and evidence ranges checked by `node assistant/validate-items.mjs`); recipes and declared bonuses come from [`item-recipes-stats.json`](../../data/07367c34/item-recipes-stats.json). **Source inspection only: no probe, no gameplay evidence.** Not the development snapshot.

**How to read.** *Declared* = values in `ItemRecipe`/`ItemStats`. *Traced* = handler and caller read. *Arithmetic* = a formula applied by hand, **not a combat simulation**. *Conditional deduction* = inference from the traced rules, not a ranking and not tested. *Unresolved* = not traced (this is different from *absent*). Shared rules (damage order, ability crit, PP, item path): [core-mechanics.md](core-mechanics.md) §H–I. Scarf items: [silk-scarf-items.md](silk-scarf-items.md).

## Summary

| Item | Recipe | Declared bonuses | Effect in one line |
|---|---|---|---|
| CHOICE_SPECS | Twisted Spoon + Twisted Spoon | AP 100 | No behavior beyond +100 AP |
| SOUL_DEW | Twisted Spoon + Mystic Water | none (empty entry) | +5 AP and +5 PP every 1000 ms |
| UPGRADE | Twisted Spoon + Magnet | AP 10, SPEED 10 | +5 speed per basic attack |
| REAPER_CLOTH | Twisted Spoon + Black Glasses | AP 10, CRIT_CHANCE 20 | Lets casts crit (+50 crit power if the ability crits by default) |
| AQUA_EGG | Mystic Water + Mystic Water | PP 30 | PP back after each cast; Manaphy spawns Phione |
| BLUE_ORB | Mystic Water + Magnet | PP 15, SPEED 10 | Every 3rd attack: 10 dmg and -15 PP to 2 nearest enemies |
| SCOPE_LENS | Mystic Water + Black Glasses | PP 15, CRIT_CHANCE 25 | Crit attack steals up to 10 PP |
| POKEMONOMICON | Twisted Spoon + Charcoal | AP 30, ATK 3 | Special damage burns (3 s) and -1 SPE_DEF |
| SHINY_CHARM | Mystic Water + Heart Scale | DEF 3 | Cancels the first hit leaving HP < 30 % (+50 PP, 1.5 s protect) |
| MAX_REVIVE | Miracle Seed + Never Melt Ice | none (no entry) | One revival at full HP after 2 s |
| SHELL_BELL | Never Melt Ice + Charcoal | ATK 5, SPE_DEF 5 | Heals ceil(33 %) of damage dealt |
| HEAVY_DUTY_BOOTS | Twisted Spoon + Heart Scale | AP 50, DEF 12 | Immune to Locked, forced moves and listed board effects |

### CHOICE_SPECS

**Recipe** (declared): Twisted Spoon + Twisted Spoon. **Declared bonuses:** AP 100. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

**Stat effect (traced):** Declared AP 100 becomes a flat +100 to the entity's AP at fight start (applyStat -> addAbilityPower); ability damage then scales by (1 + AP/100).

**Absent (traced):** No ItemEffects entry and no other game-code reference: the only references in app/**/*.ts(x) are the enum/recipe (Item.ts), the declared stats (config/game/items.ts) and a PvE reward list (models/pve-stages.ts:251). Its only gameplay content is the declared +100 AP.

*Arithmetic:* Raw ability damage x (1 + 100/100) = x2 from the item's AP alone (before other AP, crit, defense). Not a combat simulation.

*Unresolved / untested:* Nullify Bandanna turns AP gains into Attack; Big Eater/Twist Band modify the stat call (see silk-scarf-items.md).

*Conditional deduction (inference, not a ranking):* A flat +100 AP doubles the raw amount of ability damage that scales with AP (arithmetic above) and does nothing for basic attacks (basic attacks do not use AP). So it only matters for a holder whose damage comes from AP-scaled casts, and what the AP does depends on that ability's own call (apBoost).

*Sources:* `types/enum/Item.ts:516`; `config/game/items.ts:22`; `models/pve-stages.ts:251`; `core/pokemon-entity.ts:1399–1437`; `core/pokemon-entity.ts:621–648`; `core/pokemon-entity.ts:163–165`; `core/simulation.ts:498–534`

### SOUL_DEW

**Recipe** (declared): Twisted Spoon + Mystic Water. **Declared bonuses:** none — ItemStats entry exists but is empty: no stat bonus. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `sd-periodic` (traced)** — *Trigger:* Every 1000 ms of fight time while the holder is updated (first tick after 1000 ms). *Targets:* holder. *Effect:* +5 AP (addAbilityPower(5, self, 0, false)) and +5 PP (addPP(5, self, 0, false)); tick counter incremented. *Duration:* Whole fight; removal (OnItemRemovedEffect) subtracts 5 x tick count AP. *Scaling:* No AP/crit scaling (apBoost 0). The AP call is subject to Nullify Bandanna (becomes Attack) and Big Eater/Twist Band; the PP call is subject to addPP rules (blocked while silenced/protected/resurrecting/NO_PP_GAIN, halved by fatigue) and Twist Band. *Limits:* No cap seen in the handler (AP floor -100 only). *Consumption/reset:* Not consumed. Resurrection resets count.soulDewCount but recomputes stats from a fresh clone; whether the periodic effect's own tick counter persists after resurrect is not traced..

*Arithmetic:* After 10 s of fight (ms assumed) = 10 ticks: +50 AP and up to +50 PP before PP is spent on casts and ignoring blocked gains. Not a simulation.

*Unresolved / untested:* Time unit of dt (assumed ms, see core-mechanics section C); Periodic tick counter after resurrection; Declared stats: the ItemStats entry exists but is empty ({}): no stat bonus.

*Conditional deduction (inference, not a ranking):* Its AP and PP grow with fight time, so it helps most in long fights and for holders that cast and can use the extra AP; in a short fight it contributes little beyond what the tick count allows. Silence/protect/fatigue reduce the PP part.

*Sources:* `core/effects/items.ts:227–238`; `core/effects/items.ts:585–599`; `core/effects/effect.ts:261–285`; `core/pokemon-state.ts:893–899`; `core/pokemon-entity.ts:621–648`; `core/pokemon-entity.ts:508–532`; `core/pokemon-entity.ts:1466–1471`

### UPGRADE

**Recipe** (declared): Twisted Spoon + Magnet. **Declared bonuses:** AP 10, SPEED 10. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `up-speed` (traced)** — *Trigger:* Every basic attack by the holder (PokemonEntity.onAttack, called from the basic-attack routine only, successful or not). *Targets:* holder. *Effect:* +5 speed (addSpeed(5, self, 0, false)); upgradeCount++. *Duration:* Whole fight; removal subtracts 5 x upgradeCount. *Scaling:* None (apBoost 0). addSpeed is subject to Big Eater Belt (x1.25 rounded down) and Twist Band. *Limits:* No cap seen in the handler. *Consumption/reset:* Not consumed; resurrection resets upgradeCount while stats are recomputed from a clone.

*Arithmetic:* 10 basic attacks = +50 speed on top of the declared +10: from the default speed 50, speed 110 gives an attack wait of round(1000/(0.4+0.007*110)) = 855 versus 1333 at speed 50 (nominal, formula from core-mechanics section C). Not a simulation.

*Unresolved / untested:* With Big Eater Belt the per-attack gain is 6 (floor(5*1.25)) but removal subtracts 5 each (inference from the code, untested).

*Conditional deduction (inference, not a ranking):* Its speed grows only from basic attacks, so a holder that spends its time casting (or cannot attack) gains less. It raises the attack rate, which also raises PP gained from attacking (+5 per basic attack).

*Sources:* `core/effects/items.ts:753–762`; `core/pokemon-entity.ts:911–950`; `core/pokemon-state.ts:284–296`; `core/pokemon-entity.ts:752–770`

### REAPER_CLOTH

**Recipe** (declared): Twisted Spoon + Black Glasses. **Declared bonuses:** AP 10, CRIT_CHANCE 20. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `rc-abilitycrit` (traced)** — *Trigger:* When the item is applied to the fight entity (OnItemGainedEffect). *Targets:* holder. *Effect:* Adds the ABILITY_CRIT effect, which allows the holder's ability casts to roll a crit (chance = critChance/100, one roll per cast). If the holder's ability has canCritByDefault, also +50 crit power. *Duration:* Whole fight (removed again on item removal, reversing the +50 crit power). *Scaling:* Crit multiplier on ability damage is 1 + (critPower - 1) x reduction (reduction 0 vs Rocky Helmet for non-true damage). Default critPower 2 and critChance 10 plus the declared +20 crit chance. *Limits:* Abilities cast through castAbility with canCrit=false cannot crit; other crit paths not audited. *Consumption/reset:* Not consumed.

*Arithmetic:* Default crit chance 10 + declared 20 = 30 % per cast (nothing else); crit damage factor 2 at default crit power. Not a simulation.

*Unresolved / untested:* Which abilities pass canCrit=false (not catalogued); Leek / Large Leek dishes also add ABILITY_CRIT (dishes.ts:128-145); removing the cloth deletes the flag from the effect set whether or not another source added it (untraced interplay).

*Conditional deduction (inference, not a ranking):* Useful only when the holder's damage comes from casts: it gives casts a crit chance (declared +20 crit chance helps) and a crit damage factor. A holder that never casts gets only the declared AP/crit chance (the crit chance still affects its basic attacks).

*Sources:* `core/effects/items.ts:946–959`; `core/abilities/cast.ts:18–25`; `core/abilities/cast.ts:16–31`

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

- **Effect `bo-chain` (traced)** — *Trigger:* Every 3rd basic attack by the holder (counter staticHolderCount incremented in the OnAttack hook, i.e. each basic attack, successful or not). *Targets:* the up-to-two living enemies closest to the holder (distance sort, may include the attacked target). *Effect:* 10 raw special damage to each (crit=false, apBoost=false, so no AP or crit scaling; then the normal defense step), and -15 PP each (clamped at 0); manaBurnCount++. *Duration:* Instant, every 3rd attack (counter reset to 0 each time). *Scaling:* Fixed 10 raw, no AP/crit; defense division by (1 + 0.05 x SPE_DEF) then ceil/min 1 applies (arithmetic from the shared damage path). *Limits:* Fewer than two living enemies: fewer hits. *Consumption/reset:* Not consumed.

*Arithmetic:* 10 raw vs SPE_DEF 3: 10 / 1.15 = 8.70 -> 9 each (formula by hand).

*Also declared:* Kyogre's evolution rule is an item rule on BLUE_ORB (evolves to PRIMAL_KYOGRE): declared at pokemon.ts:6047-6054; acquisition and handler path not traced here.

*Unresolved / untested:* Whether the counter persists across a Max Revive resurrection (not in the reset list read); Kyogre evolution path; The 10-damage hits go through handleDamage and so can trigger other on-damage-dealt items (Shell Bell, Pokemonomicon) by the shared call path (inference from structure, untested).

*Conditional deduction (inference, not a ranking):* The chain damage is small (10 raw, no AP scaling) and arrives every 3rd basic attack, so its main effect is the 15 PP drain on up to two enemies; a holder that casts instead of attacking advances the counter more slowly.

*Sources:* `core/effects/items.ts:73–115`; `core/effects/items.ts:961`; `core/board.ts:792–807`; `core/pokemon-entity.ts:911–950`; `core/pokemon-state.ts:284–296`; `models/colyseus-models/pokemon.ts:6047–6054`

### SCOPE_LENS

**Recipe** (declared): Mystic Water + Black Glasses. **Declared bonuses:** PP 15, CRIT_CHANCE 25. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `sl-steal` (traced)** — *Trigger:* On a basic attack whose crit roll succeeded (OnAttack hook; also runs on dodged/protected attacks because it keys on the roll, not on damage). *Targets:* holder and the attacked target. *Effect:* Steals min(target PP, 10): holder addPP(+x), target addPP(-x); manaBurnCount++. *Duration:* Instant per crit attack. *Scaling:* No AP/crit scaling; the holder's gain is subject to addPP rules while the target's loss is applied regardless; Twist Band flips a negative PP change on a Twist Band target. *Limits:* Max 10 PP per crit; none if target has 0 PP. *Consumption/reset:* Not consumed.

*Arithmetic:* Declared +25 crit chance: 10 default + 25 = 35 % per basic attack; each crit moves up to 10 PP. Not a simulation.

*Unresolved / untested:* Rocky Helmet does not stop it (the hook uses the roll); Ability casts never trigger it (only the basic attack calls the hook).

*Conditional deduction (inference, not a ranking):* It needs crits on basic attacks; each crit moves up to 10 PP from the target to the holder. Extra crit chance from other sources increases how often.

*Sources:* `core/effects/items.ts:1001–1010`; `core/pokemon-entity.ts:911–950`; `core/pokemon-state.ts:284–296`; `core/pokemon-entity.ts:508–532`

### POKEMONOMICON

**Recipe** (declared): Twisted Spoon + Charcoal. **Declared bonuses:** AP 30, ATK 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `pk-burn` (traced)** — *Trigger:* Whenever the holder deals special-type damage and the target actually takes damage (callback runs when takenDamage > 0, shield absorption included; basic-attack special parts and ability damage). *Targets:* the damaged enemy. *Effect:* Burn for 3000 ms (triggerBurn) and -1 SPE_DEF (addSpecialDefense(-1, holder, 0, false)). *Duration:* Burn 3000 ms (reduced by duration reductions, refreshed if longer); SPE_DEF loss is permanent for the fight. *Scaling:* No AP/crit scaling. Burn is blocked by IMMUNITY_BURN, rune protect and the Water Bubble passive; Twist Band on the target flips the debuff; the callback also runs for retaliation damage (isRetaliation is not checked). *Limits:* SPE_DEF -1 per qualifying hit, no cap seen. *Consumption/reset:* Not consumed.

*Arithmetic:* Each qualifying hit lowers the target's SPE_DEF by 1: at SPE_DEF 3 to 2, the special damage multiplier goes from 1/1.15 = 0.870 to 1/1.10 = 0.909 (about +4.5 % damage from that point on). Formula only.

*Unresolved / untested:* Burn's per-tick damage and other burn effects (not traced in this batch); Physical basic attacks do not trigger it; true damage does not trigger it (attackType must be SPECIAL); Self-damage case (target == holder) not checked.

*Conditional deduction (inference, not a ranking):* Only special-type damage triggers it, so a purely physical attacker gets nothing; a caster with several hits or an area ability triggers burn and the SPE_DEF reduction per hit target.

*Sources:* `core/effects/items.ts:218–225`; `core/effects/items.ts:963`; `core/pokemon-entity.ts:1151–1171`; `core/pokemon-state.ts:734–750`; `models/colyseus-models/status.ts:397–411`; `core/pokemon-entity.ts:700–724`

### SHINY_CHARM

**Recipe** (declared): Mystic Water + Heart Scale. **Declared bonuses:** DEF 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `shc-save` (traced)** — *Trigger:* Inside handleDamage, when the damage that gets past the shield would leave the holder below 30 % of max HP (hp - residualDamage < 0.3 x maxHP); the check does not require a lethal hit or residual damage > 0. *Targets:* holder. *Effect:* That hit's HP loss is cancelled (takenDamage and residualDamage set to 0, death false), the holder gains +50 PP, gains Protect for 1500 ms, and the item is removed from the fight entity. *Duration:* Protect 1500 ms (not applied if the holder is already protected or enraged). *Scaling:* PP gain via addPP (rules apply); shield was already reduced for this hit before the check. *Limits:* Once per fight. *Consumption/reset:* Consumed for the fight (removeItem, not permanent): the board unit keeps the item for later fights.
- **Effect `shc-shiny` (traced)** — *Trigger:* When the item is equipped, or carried through evolution. *Targets:* holder (board unit). *Effect:* Sets the unit's shiny flag. *Duration:* Persistent. *Scaling:* None. *Limits:* None. *Consumption/reset:* Not consumed.

*Arithmetic:* maxHP 200: a hit leaving HP below 60 triggers it. E.g. HP 70 and 30 residual damage -> 40 < 60 -> the 30 is cancelled. Formula by hand.

*Unresolved / untested:* Because the condition has no 'residual damage > 0' check, a holder already below 30 % whose hit is fully absorbed by shield also triggers it (source reading, untested); Interaction order with Fossil synergy and resurrection checks that follow; Any gameplay effect of the shiny flag (not traced).

*Conditional deduction (inference, not a ranking):* A one-time protection against the first hit that would drop the holder under 30 % HP (plus 50 PP); it does not heal. The shield is spent first, so a shielded holder reaches the check later.

*Sources:* `core/pokemon-state.ts:649–661`; `core/pokemon-state.ts:620–649`; `models/colyseus-models/status.ts:744–750`; `core/pokemon-entity.ts:508–532`; `rooms/commands/game-commands.ts:947–949`; `models/colyseus-models/player.ts:344–346`

### MAX_REVIVE

**Recipe** (declared): Miracle Seed + Never Melt Ice. **Declared bonuses:** none — No ItemStats entry exists for MAX_REVIVE: it declares no stat bonus (entry absent, not zero).. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `mr-revive` (traced)** — *Trigger:* Fight start (item applied), then when the holder's HP reaches 0 or below in handleDamage. *Targets:* holder. *Effect:* Grants the resurrection flag at fight start; on HP <= 0 it consumes the flag: holder becomes untargettable and resurrecting for 2000 ms and clears negative statuses; after that resurrect() recomputes stats from a fresh clone (max HP, ATK, DEF, SPE_DEF, AP, speed, crit, dodge, range, luck), sets HP = max HP, PP = 0, shield = 0, resets stack counters (Mach Ribbon, Muscle Band, Soul Dew, Upgrade, Sound Cry), removes MAX_REVIVE from the fight entity, and returns to the moving state with cooldown 0. *Duration:* 2000 ms downtime, then full HP. *Scaling:* No AP/crit scaling. *Limits:* Not applied to INANIMATE passive units; one revive per item. *Consumption/reset:* Consumed for the fight (removed from the entity, board unit keeps it).

*Unresolved / untested:* Death paths that do not go through handleDamage's HP<=0 check (not enumerated); Exactly which stats the clone restores beyond the ones listed, and which in-fight buffs are therefore lost; Behavior of ally targeting while the holder is untargettable (only noted: enemies targeting it switch to moving).

*Conditional deduction (inference, not a ranking):* A second life with full HP and a 2-second downtime, but buffs gained during the fight are lost on revival and PP restarts at 0. Whether the downtime is acceptable depends on the fight; nothing here measures it.

*Sources:* `core/effects/items.ts:616–623`; `models/colyseus-models/status.ts:1041–1052`; `core/pokemon-state.ts:783–797`; `models/colyseus-models/status.ts:1054–1063`; `models/colyseus-models/status.ts:311–313`; `core/pokemon-entity.ts:1439–1448`; `core/pokemon-entity.ts:1563–1565`; `core/pokemon-entity.ts:1533–1539`

### SHELL_BELL

**Recipe** (declared): Never Melt Ice + Charcoal. **Declared bonuses:** ATK 5, SPE_DEF 5. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `sb-heal` (traced)** — *Trigger:* Whenever the holder deals damage (basic attack parts or ability, any damage type; callback runs when the target took damage). *Targets:* holder. *Effect:* Heals ceil(0.33 x damage actually taken by the target) (shield damage plus HP lost, overkill excluded); skipped when the target is the holder itself. *Duration:* Instant, every qualifying hit. *Scaling:* handleHeal with apBoost 0 and no crit: no AP or crit scaling. handleHeal then gives 0 under wound or protect, x1.3 with BUFF_HEAL_RECEIVED, x0.5 burning, x0.5 enraged, x1.2 Zenith weather, rounds, and caps at missing HP. *Limits:* Capped by missing HP; isRetaliation is not checked. *Consumption/reset:* Not consumed.

*Arithmetic:* Target takes 100: ceil(0.33 x 100) = 33 heal before the handleHeal modifiers. Formula only.

*Unresolved / untested:* Whether every multi-hit/area ability hit calls the callback exactly once per target (shared path; not enumerated).

*Conditional deduction (inference, not a ranking):* Healing follows damage dealt (not AP), so units that deal more damage (more hits, area abilities) heal more; wound/burn/enrage on the holder reduce or cancel the heal.

*Sources:* `core/effects/items.ts:601–605`; `core/pokemon-state.ts:308–360`; `core/pokemon-state.ts:308–318`; `core/pokemon-entity.ts:1151–1171`; `core/pokemon-state.ts:734–750`; `core/pokemon-state.ts:620–649`

### HEAVY_DUTY_BOOTS

**Recipe** (declared): Twisted Spoon + Heart Scale. **Declared bonuses:** AP 50, DEF 12. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `hb-immune` (traced)** — *Trigger:* Item applied at fight start; checked wherever the listed effects occur. *Targets:* holder. *Effect:* Adds IMMUNITY_LOCKED (the Locked status cannot be applied); canBeMoved is false (forced displacement is refused); board effects are not added to its effect set; ignores the poison-gas, smoke, sticky-web and cotton-ball statuses and the stealth-rocks, spikes, toxic-spikes, hail and ember tick effects. *Duration:* Whole fight. *Scaling:* None. *Limits:* Only the effect checks listed; other displacement or control effects not routed through these checks are untraced. *Consumption/reset:* Not consumed.

*Unresolved / untested:* Other crowd-control or displacement effects that bypass canBeMoved or the listed checks; Interaction with abilities that move the holder voluntarily (the holder's own movement is not blocked by canBeMoved; only forced displacement).

*Conditional deduction (inference, not a ranking):* Only relevant against the listed board effects and Locked/forced displacement; it does nothing about other statuses or damage. Against opponents or maps without those effects the declared AP 50 and DEF 12 are its measurable content.

*Sources:* `core/effects/items.ts:652–656`; `core/pokemon-entity.ts:258–264`; `models/colyseus-models/status.ts:1142–1150`; `models/colyseus-models/status.ts:193–221`; `models/colyseus-models/status.ts:660–664`; `core/board.ts:640`; `core/pokemon-state.ts:1031–1095`; `core/pokemon-entity.ts:890–895`

## Not covered
The other craftable items (next batches, see [ROADMAP.md](../../ROADMAP.md)); consumables, tools and special items; interactions between these items and specific abilities; burn damage details; Phione; gameplay validation of any item.
