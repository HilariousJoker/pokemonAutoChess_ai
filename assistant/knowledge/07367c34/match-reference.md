# Match reference — facts to have loaded before play

**Production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1`; deployment unverified.** Condensed from the linked notes, which hold the evidence (source lines, probes, unresolved items). Nothing here is gameplay-tested, and nothing says what is strong. Not the development snapshot. A gap in this page is a gap in coverage: say "not covered" and offer a post-match check ([ASK.md](../../ASK.md) modes).

## Economy (normal path) — [economy-leveling.md](economy-leveling.md)
- Start 5 gold. After each fight round: `income = min(5, ⌊gold/10⌋) + 5 + min(5, streak)`; the streak bonus is paid **after PvP rounds only**. Interest uses the balance after the +1 PvP-win gold.
- Streak = consecutive **identical** non-draw PvP results (wins *or* losses; a draw keeps it; PvE rounds ignore it): 1st result 0, then +1 per repeat, bonus capped at 5.
- +2 XP every round. Buy XP: 4 gold → +4 XP (refused at level 9). Reroll: 1 gold.
- Levels 2–9; cumulative XP to reach level 3…9 = 2 / 8 / 18 / 40 / 74 / 126 / 198 (per-level steps 2/6/10/22/34/52/72 from level 2).
- Examples: 37 gold, streak 3, PvP → 3 + 5 + 3 = 11. 50+ gold → interest stays 5.
- Excluded: Scribble / Double Up modes, special rules, Amulet Coin / Gimmighoul Coin / Blood Money and similar modifiers.

## Shop (normal path) — [shop-rules.md](shop-rules.md)
6 offers; each rolls a rarity from your **current level's** row, then a unit uniformly over the remaining copies of that rarity.

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

- Copies per unit in the shared pool by rarity: COMMON 27 / UNCOMMON 22 / RARE 18 / EPIC 14 / ULTRA 10. Offered copies are out of the pool until refreshed away; sold units return 1/3/9 copies (1★/2★/3★). A specific unit's odds depend on pool state; there is no fixed per-unit percentage.
- Not in the normal shop: UNIQUE (e.g. Vespiquen) and LEGENDARY (Arceus, Type Null). Charmander: yes (COMMON). Totodile: yes, RARE, so only from level 4. Empty rarity pool → Magikarp.
- Not covered: shop-modifying items/synergies/rules; regional-variant pool accounting.

## Damage, PP, speed, casting — [core-mechanics.md](core-mechanics.md) §A–C, §H–I
- **Defense step:** `damage ÷ (1 + 0.05 × defense)` — physical uses DEF, special SPE_DEF; **true damage skips the division** — then every type gets `max(1, ceil())`, then shield before HP. Example (arithmetic): physical 20 vs DEF 10 → 14.
- **Basic attack:** ATK, physical; **AP does not scale it** (unless it is converted to special, then `ceil(ATK × (1 + AP/100))`). Crit rolls on every basic attack (10 % chance, ×2 default). The parts are rounded **before** the defense step.
- **Ability damage:** raw × `(1 + AP/100)` (unless the ability opts out of AP) → crit factor if the cast crit → defense step. **No rounding before the defense step.** Each +10 AP = +10 % of the raw amount.
- **Ability crit:** only if the caster has `ABILITY_CRIT` (e.g. Reaper Cloth, Leek dishes) or the ability crits by default; then one roll per cast at the caster's crit chance. Rocky Helmet on the target removes the crit bonus (ability damage: not for true damage).
- **PP:** +5 per basic attack; +⌈residual damage ÷ 10⌉ when hit; in the ordinary case a unit starts at 0 PP plus its items' PP bonuses (other start hooks, dishes, passives and synergies can also change it). Cast when `pp ≥ maxPP` and the unit can cast, **using that attack slot** (no basic attack that slot); then `pp −= maxPP` (extra carries over). Casting normally needs a target in range (some abilities do not require one).
- **Declared item bonuses → combat:** AP is added flat to current AP; **PP bonuses add to current PP, never to maxPP**; no item bonus raises maxPP. Efficient Bandanna's ×0.85 maxPP is a separate fight-start effect.
- Attack wait = `round(1000 / (0.4 + 0.007 × speed))`: speed 0/50/100/200/300 → 2500/1333/909/556/400 (nominal; time unit assumed ms).
- Exceptions not covered: statuses, shields/heals scaling, reflection, per-ability call patterns.

## Charmander family (Charmander → Charmeleon → Charizard) — [pilot-abilities.md](pilot-abilities.md)
- Blast Burn: range **1**, maxPP **100** (all three), raw special damage **30 / 60 / 120** (1★/2★/3★) to every enemy in the 8 cells around the caster; no status, heal or shield. **AP scales it** (`× (1 + AP/100)`), it **cannot crit** unless the caster has `ABILITY_CRIT`, then the defense step above. Example (arithmetic, SPE_DEF 3, nothing else): 30 raw → 27; with 50 AP → 40.
- Casting needs a target in range 1, so it is a melee caster; the cast uses the attack slot.
- **Efficient Bandanna for casting:** maxPP 100 → 85 for units on its cell and the cells left/right (holder included), and the holder starts with +15 PP: a holding Charmander needs 70 more PP (14 basic attacks at +5, vs 20), a neighbor of the holder needs 85. Two bandannas stack multiplicatively.
- **Best Charmander items: not determined.** Only mechanics are known (AP, crit-enabling, PP/maxPP effects, bonuses in the item data); no comparison across items, comps or opponents has been done, so any item can only be called a "reasonable option", not best.

## Board and synergies — [core-mechanics.md](core-mechanics.md) §D–E
- Row 0 bench; **row 1 back, row 3 front** for both teams. Placement is only the start position.
- Vespiquen: row 1 → range 3 + ATTACK ORDER; row 2 → range 2 + HEAL ORDER; row 3 → range 1 + DEFEND ORDER (set when moved there, fixed at fight start). How an evolved Vespiquen gets its mode is **untraced**.
- Synergies count **deployed** units only, once per evolution family; bench excluded. Exceptions not audited: Dragon doubling, Family Outing, dynamic types (Arceus-type), item-granted types, bonus synergies.
- Normal synergy tier (3/5/7/9 units → tier 1–4) determines the player's **scarf allowance** (see below).

## Items in general — [core-mechanics.md](core-mechanics.md) §F–G
- 3 item slots. A held basic component + another basic component combine through the recipe table; a full unit accepts a fourth item only if it combines. No phase check in the equip command (whether a mid-fight equip affects the running fight is untraced).
- Eviolite blocks every kind of evolution on its holder. Shiny Stone gives Light type and +50 AP; on a Cosmoem it does **not** satisfy the light-cell position test.
- Declared stats/recipes for **all** items: [item-recipes-stats.json](../../data/07367c34/item-recipes-stats.json). Traced effects exist for Eviolite, Shiny Stone, the ten scarf items below and 24 more items ([item-effects.md](item-effects.md): detail is not preloaded here — not covered in QUICK mode unless listed in this page); all other items: not covered.

## Silk Scarf — all ten recipes — [guide](silk-scarf-items.md)
Declared bonuses are applied as stat calls when the holder enters a fight (shield/PP are current values). **SHIELD** is a starting shield.

| Result | Silk Scarf + | Declared bonuses | Effect |
|---|---|---|---|
| FRIEND_BOW | Fossil Stone | SHIELD 30 | Holder gains the Normal type; popped back if it already has Normal. |
| BLACK_BELT | Black Glasses | SHIELD 15, CRIT_CHANCE 30 | On a crit basic attack, holder gains shield `⌈0.33 × pre-defense total attack damage⌉`. |
| MACH_RIBBON | Magnet | SHIELD 15, SPEED 10 | +20 speed every 3 s in a fight. |
| EXPLOSIVE_BAND | Charcoal | SHIELD 50, ATK 3 | Once, when its shield is first depleted: `½ ×` (shield the holder has **granted**, per the DPS meter) as special damage to adjacent enemies; item is consumed. |
| TWIST_BAND | Never-Melt Ice | SPE_DEF 20, SHIELD 50 | Negative changes from enemies/environment to 11 stats (PP, crit chance, crit power, max HP, dodge, AP, luck, DEF, SPE_DEF, ATK, speed) become positive; not shield, not damage/statuses. |
| LUCKY_RIBBON | Twisted Spoon | SHIELD 15, AP 50, LUCK 20 | +15 % dodge at fight start. |
| BIG_EATER_BELT | Miracle Seed | HP 50, SHIELD 15 | Positive changes ×1.25 (rounded down) to 11 stats (shield, crit chance, crit power, max HP, dodge, AP, luck, DEF, SPE_DEF, ATK, speed; **not** PP); holder can eat two dishes. |
| COVER_BAND | Heart Scale | DEF 12, SHIELD 50 | A lethal hit on an adjacent ally (not holding one) is redirected to the holder, full original damage through the holder's own defenses. |
| EFFICIENT_BANDANNA | Mystic Water | SHIELD 15, PP 15 | At fight start, max PP ×0.85 (rounded) for units on its cell and the cells left and right; no team check found. |
| NULLIFY_BANDANNA | Silk Scarf | SHIELD 30 | Holder never casts; each basic attack adds its current PP as special damage and resets PP to 0; AP gains become Attack (×0.2). |

- Silk Scarf itself: SHIELD 15. Components: Silk Scarf, Fossil Stone, Black Glasses, Magnet, Charcoal, Never-Melt Ice, Twisted Spoon, Miracle Seed, Heart Scale, Mystic Water.
- **Allowance vs crafting.** Normal tier N lets the player *track* N scarf slots (Nullify Bandanna uses 2). Crafting a scarf item **does not require** a free slot; the craft proceeds and is just not tracked if over the limit. When the Normal tier later drops, tracked scarves are removed (from a holder first, otherwise the inventory). Scarves are not in random item rewards.
- Caveats: effects are traced from the code, with no probe or gameplay test; Mach Ribbon gains +20 per tick but its removal code subtracts `15 × ticks` (observation).

## Evolution and abilities — [pilot-evolution.md](pilot-evolution.md), [evolution-context.md](evolution-context.md), [pilot-abilities.md](pilot-abilities.md)
- Evolution declarations exist for only 20 units (Charmander line, Pikachu, Raichu, Alolan Raichu, Galar Meowth, Vespiquen, Arceus, Magikarp, Gyarados, Type Null, Primeape, Tepig, Ditto, Unown D, Farfetch'd, Totodile, Cosmoem, Substitute): `node assistant/lookup-production.mjs KEY`.
- Pikachu → Alolan Raichu iff the player's current map has the Psychic synergy; otherwise Raichu.
- Cosmoem → Solgaleo iff on the game's light cell **and** a Light tier is active (Light ≥ 2); otherwise Lunala. In the plain no-item case a Cosmog that evolves after 8 triggers ends with 220 HP (other cases untraced).
- Reviewed abilities: Blast Burn (see Charmander family above), Crunch (Totodile: 40 raw special damage; heal on kill), Vespiquen Orders (row-dependent, above). Every other ability: not covered beyond the bare identifier in the unit baseline. No structured passive records exist; passives are explained only where a note does (e.g. Vespiquen's row passive above).

## Units — `node assistant/lookup-production.mjs KEY`
1183 identifiers with bare stats/types/skill identifier. Bare ≠ acquired ≠ combat values. Identifier ≠ availability.

## Not covered at all
Meta, win rates, best comps; patch/live-version equivalence; special game rules and modes; most abilities, most passives (no structured records; a few explained in notes), status effects, per-item effects other than those above; targeting and movement detail; the full damage pipeline.
