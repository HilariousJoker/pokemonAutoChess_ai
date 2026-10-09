# Item effects — batches 1–2 (24 items)

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
| ABILITY_SHIELD | Twisted Spoon + Miracle Seed | AP 10 | Setup: shield 20 % max HP and 5 s Rune Protect to allies on its cell and left/right |
| POWER_LENS | Twisted Spoon + Never Melt Ice | SPE_DEF 10, AP 10 | Reflects the SPE_DEF-mitigated part of special damage taken |
| STAR_DUST | Mystic Water + Never Melt Ice | SPE_DEF 10, PP 15 | Shield of 50 % maxPP after each cast |
| DEEP_SEA_TOOTH | Mystic Water + Charcoal | ATK 7, PP 15 | +5 PP per basic attack, +15 more on a kill |
| XRAY_VISION | Magnet + Magnet | SPEED 50 | Sleep immunity; its basic attacks ignore dodge |
| RAZOR_FANG | Magnet + Black Glasses | SPEED 10, CRIT_CHANCE 10, CRIT_POWER 50 | Successful basic attacks halve target DEF/SPE_DEF for 2 s |
| LOADED_DICE | Magnet + Never Melt Ice | SPEED 10, SPE_DEF 3, LUCK 20 | ~50 % (luck-adjusted) second hit at 75 % on a neighbor of the target |
| PUNCHING_GLOVE | Magnet + Charcoal | SPEED 10, ATK 3 | +8 % target max HP physical damage per basic attack |
| MUSCLE_BAND | Magnet + Heart Scale | SPEED 10, DEF 3 | Per 2 hits taken: +1 ATK, +2 DEF, +5 speed (max 10 stacks) |
| ASSAULT_VEST | Never Melt Ice + Never Melt Ice | SPE_DEF 40 | Burn and poison damage x0.5 (and bench lava burn) |
| POKE_DOLL | Never Melt Ice + Heart Scale | DEF 3, SPE_DEF 3 | Non-true damage x0.7; preferred among nearest targets |
| ROCKY_HELMET | Heart Scale + Heart Scale | DEF 25 | Cancels the crit damage bonus against the holder |

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

- **Effect `sd-periodic` (traced)** — *Trigger:* Every 1000 ms of fight time while the holder is updated (first tick after 1000 ms). *Targets:* holder. *Effect:* +5 AP (addAbilityPower(5, self, 0, false)) and +5 PP (addPP(5, self, 0, false)); tick counter incremented. *Duration:* Whole fight; removal (OnItemRemovedEffect) subtracts 5 x tick count AP. *Scaling:* No AP/crit scaling (apBoost 0). The AP call is subject to Nullify Bandanna (becomes Attack) and Big Eater/Twist Band; the PP call is subject to addPP rules (blocked while silenced/protected/resurrecting/NO_PP_GAIN, halved by fatigue) and Twist Band. *Limits:* No cap seen in the handler (AP floor -100 only). *Consumption/reset:* Not consumed. Resurrection resets count.soulDewCount but recomputes stats from a fresh clone; whether the periodic effect's own tick counter persists after resurrect is not traced..

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

### POKEMONOMICON

**Recipe** (declared): Twisted Spoon + Charcoal. **Declared bonuses:** AP 30, ATK 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `pk-burn` (traced)** — *Trigger:* Whenever the holder deals special-type damage and the target actually takes damage (callback runs when takenDamage > 0, shield absorption included; basic-attack special parts and ability damage). *Targets:* the damaged enemy. *Effect:* Burn for 3000 ms (triggerBurn) and -1 SPE_DEF (addSpecialDefense(-1, holder, 0, false)). *Duration:* Burn 3000 ms (reduced by duration reductions, refreshed if longer); SPE_DEF loss lasts the fight. *Scaling:* No AP/crit scaling. Burn is blocked by IMMUNITY_BURN, rune protect and the Water Bubble passive; Twist Band on the target flips the debuff; the callback also runs for retaliation damage (isRetaliation is not checked). *Limits:* -1 SPE_DEF per qualifying hit, but addSpecialDefense clamps SPE_DEF at 0 (speDef = max(0, speDef + value)), so the reduction cannot go below 0 and has no further effect there. *Consumption/reset:* Not consumed.

*Arithmetic:* Each qualifying hit lowers the target's SPE_DEF by 1: at SPE_DEF 3 to 2, the special damage multiplier goes from 1/1.15 = 0.870 to 1/1.10 = 0.909 (about +4.5 % damage from that point on). Formula only.

*Unresolved / untested:* Burn's per-tick damage and other burn effects (not traced in this batch); Physical basic attacks do not trigger it; true damage does not trigger it (attackType must be SPECIAL); Self-damage case (target == holder) not checked.

*Conditional deduction (inference, not a ranking):* Only special-type damage triggers it, so a purely physical attacker gets nothing; a caster with several hits or an area ability triggers burn and the SPE_DEF reduction per hit target.

*Sources:* `core/effects/items.ts:218–225`; `core/effects/items.ts:963`; `core/pokemon-entity.ts:1151–1171`; `core/pokemon-state.ts:734–750`; `models/colyseus-models/status.ts:397–411`; `core/pokemon-entity.ts:700–724`; `utils/number.ts:1–4`

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

### ABILITY_SHIELD

**Recipe** (declared): Twisted Spoon + Miracle Seed. **Declared bonuses:** AP 10. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `as-shield` (traced)** — *Trigger:* At simulation setup (Simulation.applyPostEffects, called from the constructor), once per holder. *Targets:* every same-team unit standing on the holder's cell or the cell directly left or right on the same row (holder included). *Effect:* Each such unit gets a shield of ceil(0.2 x its own max HP) (addShield with the unit as its own caster, apBoost 0) and a Rune Protect status (triggerRuneProtect(5000 ms)), which first clears negative statuses. *Duration:* Rune Protect lasts 5000 ms (a longer existing timer is kept); the shield lasts until depleted. *Scaling:* No AP/crit scaling. The shield is subject to addShield rules (enraged halves it, rounded; Big Eater Belt scales it). While Rune Protect is active, status triggers that check runeProtect are refused. *Limits:* Only the three cells on the holder's row; same team only; units must be present at setup. *Consumption/reset:* Applied once at setup; the item is not consumed. Several holders covering the same unit apply their shields separately (they add).

*Arithmetic:* Ally with max HP 200: shield ceil(0.2 x 200) = 40. Formula only.

*Unresolved / untested:* Which individual statuses Rune Protect blocks: many triggers check runeProtect (about a dozen sites in status.ts) and were not each listed; Because the shield is added with the ally as its own caster, it counts in that ally's shieldDone (the counter Explosive Band reads); the consequence for an Explosive Band holder is an inference from the shared path, untested; Units added after setup (summons) are not covered by this setup code.

*Conditional deduction (inference, not a ranking):* A one-time setup shield and 5-second status protection for up to three units in a row (itself included); it matters most when those units sit on that row and the opponent applies statuses early. It does not recur during the fight.

*Sources:* `core/simulation.ts:692–709`; `core/simulation.ts:223`; `models/colyseus-models/status.ts:956–966`; `models/colyseus-models/status.ts:968–974`; `core/pokemon-state.ts:382–418`

### POWER_LENS

**Recipe** (declared): Twisted Spoon + Never Melt Ice. **Declared bonuses:** SPE_DEF 10, AP 10. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `pl-reflect` (traced)** — *Trigger:* When the holder takes special-type damage through handleSpecialDamage (ability damage and the special parts of basic attacks; also the second hit of Loaded Dice), after that damage is resolved, if the pre-defense amount is >= 1 and the attacker does not hold Protective Pads. *Targets:* the attacker. *Effect:* Reflects the amount the holder's SPE_DEF mitigated: round(S - S / (1 + 0.05 x speDef)), where S is the special damage after AP, crit and the other pre-defense multipliers and speDef is halved (rounded) while the holder has armor reduction. The reflection is special damage dealt by the holder with handleDamage, flagged as retaliation. *Duration:* Instant, per qualifying hit. *Scaling:* Uses the incoming amount, not the damage actually taken (shield absorption does not reduce it). The reflected damage is not scaled by the holder's AP or crit and goes through the attacker's own SPE_DEF and shield. *Limits:* Not triggered by physical or true damage, by hits blocked by protect/skydiving/magic bounce, or when the attacker holds Protective Pads. *Consumption/reset:* Not consumed.

*Arithmetic:* Incoming special damage 100 on SPE_DEF 10: 100 / 1.5 = 66.67, mitigated 33.33, reflected round(33.33) = 33 (before the attacker's own defenses). Formula only.

*Unresolved / untested:* Self-inflicted special damage (attacker == holder) is not excluded in the code read; Declared AP 10 only matters through the generic AP uses.

*Conditional deduction (inference, not a ranking):* The reflection scales with how much special damage the holder's SPE_DEF mitigates, so it grows with incoming special damage and with SPE_DEF; physical and true damage are unaffected.

*Sources:* `core/pokemon-entity.ts:444–463`; `core/effects/items.ts:158–175`; `core/pokemon-state.ts:509–514`

### STAR_DUST

**Recipe** (declared): Mystic Water + Never Melt Ice. **Declared bonuses:** SPE_DEF 10, PP 15. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `sd2-shield` (traced)** — *Trigger:* After each ability cast by the holder (OnAbilityCastEffect). *Targets:* holder. *Effect:* Gains a shield of round(0.5 x maxPP) (addShield, apBoost 0); starDustCount++. *Duration:* Shield lasts until depleted. *Scaling:* No AP/crit scaling. addShield rules: enraged halves the amount, Big Eater Belt scales it. *Limits:* No cap; stacks with existing shield. *Consumption/reset:* Not consumed.

*Arithmetic:* maxPP 100: a 50 shield per cast; with Efficient Bandanna's maxPP 85: round(42.5) = 43 (JavaScript Math.round, .5 rounds up). Formula only.

*Unresolved / untested:* Declared PP 15 adds to current PP only; Casts that bypass castAbility were not enumerated.

*Conditional deduction (inference, not a ranking):* Each cast adds a shield proportional to maxPP, so it favors holders that cast repeatedly and have a high maxPP (Efficient Bandanna lowers maxPP and therefore the shield).

*Sources:* `core/effects/items.ts:1012–1017`; `core/abilities/cast.ts:16–31`; `core/pokemon-state.ts:382–418`

### DEEP_SEA_TOOTH

**Recipe** (declared): Mystic Water + Charcoal. **Declared bonuses:** ATK 7, PP 15. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `dst-pp` (traced)** — *Trigger:* After each basic attack by the holder (OnAttack hook), successful or not. *Targets:* holder. *Effect:* +5 PP, and +15 more if the attack killed its target (hasAttackKilled), i.e. +20 in total on a kill. This is in addition to the ordinary +5 PP per basic attack (ON_ATTACK_MANA). *Duration:* Instant, per basic attack. *Scaling:* No AP/crit scaling. Both gains go through addPP (blocked while silenced/protected/resurrecting/NO_PP_GAIN, halved by fatigue). *Limits:* hasAttackKilled is set by kills from the physical, special or true part of the attack (and fairy wand effects); casts do not trigger it. *Consumption/reset:* Not consumed.

*Arithmetic:* Without kill: 5 (ordinary) + 5 (item) = 10 PP per basic attack, i.e. 10 attacks for 100 PP versus 20 without the item; formula only, ignoring PP from damage taken.

*Unresolved / untested:* Whether kills by abilities count (they do not call this hook).

*Conditional deduction (inference, not a ranking):* It doubles the PP from basic attacks and adds more on kills, so it speeds casting for holders that spend time basic-attacking; holders that already cast constantly gain less.

*Sources:* `core/effects/items.ts:814–821`; `core/pokemon-entity.ts:911–950`; `core/pokemon-state.ts:284–296`; `core/pokemon-state.ts:119–123`; `config/game/battle.ts:3`; `core/pokemon-entity.ts:508–532`; `core/pokemon-entity.ts:508–532`

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

- **Effect `rf-armor` (traced)** — *Trigger:* On each successful basic attack by the holder (not dodged or protected; checked just before the damage is applied) and on the second target of a Loaded Dice hit. *Targets:* the attacked enemy. *Effect:* Armor reduction for 2000 ms: the target's DEF and SPE_DEF are halved (rounded) in the defense step; the declared CRIT_POWER 50 is applied through addCritPower as +0.5 to the crit-power multiplier (default 2 -> 2.5). *Duration:* 2000 ms (reduced by duration reductions; a longer existing timer is kept). *Scaling:* None; blocked by Rune Protect on the target. *Limits:* Applies to the damage step of the same attack because it is set before the damage is applied; also affects every other source of damage while active. *Consumption/reset:* Not consumed.

*Arithmetic:* Target DEF 10 halved to 5: the physical multiplier goes from 1/1.5 = 0.667 to 1/1.25 = 0.8 (about +20 % of that hit). Formula only.

*Unresolved / untested:* Declared CRIT_CHANCE 10 (percentage points) and SPEED 10 follow the generic stat paths; Abilities that bypass the basic-attack routine do not trigger the armor reduction.

*Conditional deduction (inference, not a ranking):* The armor reduction lifts damage from every source against the target for 2 s, and its first application lands on the same hit that applies it; it needs successful basic attacks.

*Sources:* `core/pokemon-state.ts:240–242`; `models/colyseus-models/status.ts:342–352`; `core/pokemon-state.ts:509–514`; `core/effects/items.ts:117–215`; `core/pokemon-entity.ts:559–575`

### LOADED_DICE

**Recipe** (declared): Magnet + Never Melt Ice. **Declared bonuses:** SPEED 10, SPE_DEF 3, LUCK 20. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `ld-bounce` (traced)** — *Trigger:* On each basic attack by the holder (OnAttack hook, successful or not) whose pre-defense total damage is > 0, with probability chance(0.5, holder). *Targets:* one enemy standing in the 8 cells around the attacked target (the one with the lowest current HP). *Effect:* A second hit: each component (physical, special, true) of the original attack, rounded after x0.75, is dealt to that enemy through handleDamage (so the enemy's defenses and shields apply); the holder's on-hit effects run for it, Razor Fang's armor reduction is applied if held, and Power Lens reflection happens if that enemy holds one. *Duration:* Instant; one bounce. *Scaling:* chance(p, holder) = Math.random() < p^(1 - luck/100), so luck 0 gives 50 % and the declared luck 20 gives 0.5^0.8 = 57.4 %. The components are the original attack's pre-defense amounts (crit already included), not re-rolled. *Limits:* Needs at least one enemy adjacent to the target; the original target itself is not eligible. *Consumption/reset:* Not consumed.

*Arithmetic:* Original attack 40 physical pre-defense: second hit 30 physical pre-defense. Chance at luck 20: 0.5^0.8 = 0.574. Formulas only.

*Unresolved / untested:* Whether kills on the second hit count for kill-based effects; The second hit calls the on-damage-dealt path (Shell Bell etc.) by the shared route (inference, untested).

*Conditional deduction (inference, not a ranking):* It adds damage only when an enemy stands next to the target, and scales with the size of the original hit; luck raises its chance.

*Sources:* `core/effects/items.ts:117–215`; `core/effects/items.ts:965`; `utils/random.ts:3–13`; `core/pokemon-entity.ts:649–672`; `core/pokemon-state.ts:284–300`; `core/pokemon-entity.ts:911–950`

### PUNCHING_GLOVE

**Recipe** (declared): Magnet + Charcoal. **Declared bonuses:** SPEED 10, ATK 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `pg-extra` (traced)** — *Trigger:* Each basic attack by the holder. *Targets:* the attacked enemy. *Effect:* Adds 0.08 x the target's max HP to the attack's physical damage (added after the crit factor, so it is not multiplied by crit, and before rounding); it is physical, so the target's DEF and shield apply. *Duration:* Per basic attack. *Scaling:* No AP/crit scaling. The glove term is added after dodge/protect have set the base damage to 0, so by source reading a dodged attack still carries the glove term (untested). *Limits:* Added even when the attack was converted to special (the glove term is physical). *Consumption/reset:* Not consumed.

*Arithmetic:* Target max HP 500: +40 raw physical per basic attack, before DEF (DEF 10 -> 40/1.5 = 26.7 -> ceil 27). Formula only.

*Unresolved / untested:* Dodged/protected attacks: the source reading suggests the glove damage still resolves (a protected target is stopped inside handleDamage); untested; Declared SPEED 10 and ATK 3 follow the generic stat paths.

*Conditional deduction (inference, not a ranking):* The bonus scales with the target's max HP rather than the holder's stats, so it is relatively larger against high-HP targets; it is applied per basic attack, so faster attackers apply it more often, and the target's DEF reduces it.

*Sources:* `core/pokemon-state.ts:230–232`; `core/pokemon-state.ts:208–238`; `core/pokemon-state.ts:734–742`

### MUSCLE_BAND

**Recipe** (declared): Magnet + Heart Scale. **Declared bonuses:** SPEED 10, DEF 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `mb-stacks` (traced)** — *Trigger:* Whenever the holder receives damage > 0 and survives (OnDamageReceived hook; counter muscleBandCount, up to 20 hits). *Targets:* holder. *Effect:* Every 2nd counted hit: +1 ATK, +2 DEF, +5 speed (apBoost 0). *Duration:* Whole fight; removal subtracts floor(count/2) of each bonus. *Scaling:* At most 20 counted hits = 10 stacks = +10 ATK, +20 DEF, +50 speed (speed is clamped to 0..300; ATK has a floor of 1, DEF of 0). *Limits:* The callback needs takenDamage > 0 and the holder still alive; counting stops at 20. *Consumption/reset:* Counter reset on removal and on resurrection (stats recomputed from a clone).

*Arithmetic:* Fully stacked: +10 ATK, +20 DEF, +50 speed on top of the declared DEF 3 and SPEED 10. Formula only.

*Unresolved / untested:* Which damage sources reach the callback was not enumerated beyond handleDamage (status ticks and retaliation are not separately checked); Big Eater Belt / Twist Band interactions with the stat calls (removal subtracts unscaled amounts; inference).

*Conditional deduction (inference, not a ranking):* Its stacks come only from being hit, so it needs the holder to survive hits; the maximum is reached after 20 counted hits.

*Sources:* `core/effects/items.ts:764–779`; `core/pokemon-state.ts:734–742`; `core/pokemon-entity.ts:1185–1232`; `core/pokemon-entity.ts:1466–1471`; `core/pokemon-entity.ts:674–699`; `core/pokemon-entity.ts:726–750`; `core/pokemon-entity.ts:752–775`; `config/game/game.ts:5`

### ASSAULT_VEST

**Recipe** (declared): Never Melt Ice + Never Melt Ice. **Declared bonuses:** SPE_DEF 40. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `av-status` (traced)** — *Trigger:* Whenever burn or poison damage is computed for the holder, and during lava weather for the holder on the bench. *Targets:* holder. *Effect:* Burn damage x0.5 and poison damage x0.5 (each multiplier sits among the other modifiers of the same computation); in lava weather the bench burn is floor(x0.5) of round(5 % max HP). *Duration:* Whole fight / while on the bench. *Scaling:* Multiplicative with the other modifiers in those computations. *Limits:* Only burn, poison and the lava bench burn were found; other status damage is not covered. *Consumption/reset:* Not consumed.

*Unresolved / untested:* Declared SPE_DEF 40 is the main measurable effect: special damage is divided by 1 + 0.05 x SPE_DEF (e.g. 40 more SPE_DEF -> divisor +2.0); Whether other damage-over-time sources use the same multiplier was not enumerated.

*Conditional deduction (inference, not a ranking):* Beyond its large declared SPE_DEF, it only reduces burn and poison damage, so its extra value depends on the opponent applying those statuses.

*Sources:* `models/colyseus-models/status.ts:455–457`; `models/colyseus-models/status.ts:629–631`; `core/simulation.ts:274–296`

### POKE_DOLL

**Recipe** (declared): Never Melt Ice + Heart Scale. **Declared bonuses:** DEF 3, SPE_DEF 3. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `pd-reduce` (traced)** — *Trigger:* When the holder takes non-true damage in handleDamage. *Targets:* holder. *Effect:* Damage after the defense division is multiplied by 0.7 (before flat reductions such as Guts and before the ceil/min-1 step). *Duration:* Whole fight. *Scaling:* Not applied to true damage. *Limits:* Rounding afterwards is ceil with a minimum of 1. *Consumption/reset:* Not consumed.
- **Effect `pd-taunt` (traced)** — *Trigger:* When an enemy picks its basic-attack target among units in range (getNearestTargetAtRange). *Targets:* enemy targeting. *Effect:* Among the enemies at the minimum distance, units holding Poke Doll are chosen before others (random among holders). *Duration:* Whole fight. *Scaling:* Only breaks ties at the nearest distance. *Limits:* Other targeting routines (sight-based movement targeting, abilities with their own targeting) were not checked. *Consumption/reset:* Not consumed.

*Arithmetic:* Physical 20 vs DEF 10: 20/1.5 = 13.33, x0.7 = 9.33, ceil 10 (versus 14 without the doll). Formula only.

*Unresolved / untested:* Targeting outside getNearestTargetAtRange; Declared DEF 3 and SPE_DEF 3 follow the generic paths.

*Conditional deduction (inference, not a ranking):* It reduces non-true damage by 30 % after the defense step and draws basic attacks among equally near enemies, which is relevant when the holder stands among nearest targets.

*Sources:* `core/pokemon-state.ts:566–572`; `core/pokemon-state.ts:1131–1160`

### ROCKY_HELMET

**Recipe** (declared): Heart Scale + Heart Scale. **Declared bonuses:** DEF 25. Declared stats become fight stats as in core-mechanics §I (PP adds to current PP, never maxPP).

- **Effect `rh-crit` (traced)** — *Trigger:* When an enemy's attack against the holder crits. *Targets:* holder as target. *Effect:* Cancels the crit damage bonus: in basic attacks the crit reduction factor becomes 0 (and target.count.crit is not incremented); in handleSpecialDamage the factor is 0 only for non-true damage. The attacker's crit roll still counts as a crit for its own on-crit effects (Black Belt, Scope Lens). *Duration:* Whole fight. *Scaling:* Reduces the crit multiplier 1 + (critPower - 1) x factor to 1 for the cases above. *Limits:* The true-damage part of a basic attack multiplies by the attacker's full critPower and is not reduced by the factor (pokemon-state.ts:208-212). *Consumption/reset:* Not consumed.

*Arithmetic:* Attacker crit power 2, no helmet: x2 on the physical/special part; with the helmet: x1. Formula only.

*Unresolved / untested:* Other crit paths (reflection, abilities that compute crit themselves) were not enumerated; Declared DEF 25 is the main numeric effect: physical damage divisor +1.25 (1 + 0.05 x 25).

*Conditional deduction (inference, not a ranking):* It removes the crit bonus on hits against the holder (with 25 DEF), so it matters against crit-heavy attackers; true-damage parts of basic attacks keep their crit multiplier.

*Sources:* `core/pokemon-state.ts:64–72`; `core/pokemon-entity.ts:412–433`; `core/pokemon-state.ts:208–212`

## Not covered
The other craftable items (next batches, see [ROADMAP.md](../../ROADMAP.md)); consumables, tools and special items; interactions between these items and specific abilities; burn damage details; Phione; gameplay validation of any item.
