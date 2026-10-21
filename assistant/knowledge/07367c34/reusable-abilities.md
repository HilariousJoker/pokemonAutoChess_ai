# Reusable abilities and passives: NUZZLE, DRAGON_RAGE, THRASH, SURGE_SURFER, PRIMEAPE

**Production-branch reference; deployment unverified.** Source `07367c341fe928763da2b565c2eee010433e4fc1` (upstream `prod` head). Structured records with every source reference (file, lines, symbol, checked text): [`../../data/07367c34/reusable-abilities.json`](../../data/07367c34/reusable-abilities.json); the three earlier reviewed records stay in [`pilot-abilities.md`](pilot-abilities.md). Checked by [`../../validate-abilities.mjs`](../../validate-abilities.mjs) (`node assistant/validate-abilities.mjs`). Per-unit view: `node assistant/lookup-production.mjs <KEY>`.

**How to read the numbers.** "Raw" = the amount written in the ability or passive code, not what a player sees. AP, crit, defenses, shields, statuses and items change it afterwards, and most of that generic pipeline is unverified. Nothing here was executed or observed in a live game; the numeric examples are arithmetic on the cited formulas with their stated conditions, not gameplay validation.

**Review status.** These records are *source-traced and mechanically validated* by `validate-abilities.mjs`; **independent review is pending** (`automation/review-status.json` marks them unreviewed). Mechanical validation checks that cited text exists and tables match; it does not mean the claims were independently reviewed. Lookups label them "Source-traced" until that file changes.

**Coverage is per unit, in three separate kinds.** *Ability* coverage = what the skill does. *Passive* coverage = what the unit's passive does. *Evolution* coverage = the rule that produces the unit (pilot subset, see [`pilot-evolution.md`](pilot-evolution.md)). A shared skill identifier does not prove every unit behaves identically: the shared strategy reads stars and (for THRASH) the unit's `baseAtk`, and some units add a passive.

| Kind | Units | Record |
|---|---|---|
| NUZZLE | PICHU 1★, PIKACHU 2★, RAICHU 3★, ALOLAN_RAICHU 3★, PACHIRISU 3★ | `abilities.NUZZLE` |
| DRAGON_RAGE | GYARADOS 3★ | `abilities.DRAGON_RAGE` |
| THRASH | MANKEY 1★, PRIMEAPE 2★, ANNIHILAPE 3★ | `abilities.THRASH` |
| Passive SURGE_SURFER | ALOLAN_RAICHU | `passives.SURGE_SURFER` |
| Passive PRIMEAPE | PRIMEAPE only (Mankey, Annihilape declare `NONE`) | `passives.PRIMEAPE` |
| Passive PACHIRISU | PACHIRISU — **not covered (gap)** | `passiveGaps.PACHIRISU` |

Common to all three abilities: looked up in `AbilityStrategies` (`abilities.ts:728`; NUZZLE `:1058`, DRAGON_RAGE `:844`, THRASH `:1240`); a cast spends the unit's `maxPP`; it can only crit with the `ABILITY_CRIT` effect (`cast.ts:18–25`; `canCritByDefault` is false for all three). A cast needs `pp >= maxPP` and `canCast` (`attacking-state.ts:92`).

## NUZZLE — Pichu / Pikachu / Raichu / Alolan Raichu / Pachirisu
*Record:* `abilities.NUZZLE`. Strategy `NuzzleStrategy` (`nuzzle.ts:6–35`).
- **Targeting and movement (read from the helper, not executed):** the cast target is replaced by the enemy attached to the helper's selected cell (`board.ts:568–630`). Enemies are scanned in board order; one whose distance is **strictly greater** than the running maximum raises the maximum *before* it is known whether it has a free adjacent cell, and only if it has one does it replace the selected destination (the free adjacent cell farthest from the caster, first on ties). So the result is **not guaranteed to be the farthest enemy**: (a) if a farther enemy has no free adjacent cell, the earlier, nearer selection is **retained** (it is never cleared) and its enemy becomes the target; (b) enemies scanned later at a distance up to the raised maximum are then **skipped**, even if nearer than the farthest and with free cells; (c) the fallback to the free cell closest to the last-recorded farthest enemy is used **only if no enemy produced a selected cell**; (d) if that fails too, or no enemy is targettable, the caster stays and hits its current target. The scan order and the distance metric (`distanceM`) were not read. The caster retargets and moves to the destination (`nuzzle.ts:20–23`).
- **Effects, in source order:** **paralysis first**, then special damage.
- **Damage (raw), by stars:** 25 / 50 / 100 / 200 (index = stars − 1; 200 is also the fallback). Pichu (1★) 25, Pikachu (2★) 50, Raichu / Alolan Raichu / Pachirisu (3★) 100. Scales with AP (apBoost is passed true), crit only with `ABILITY_CRIT`; then SPE_DEF division and later modifiers.
- **Paralysis (raw), by stars:** 3000 / 3000 / 3000 / 6000 ms; every unit above gets 3000. Not AP-scaled. Combat effect: the target's speed counts as half for attack interval and movement, and it cannot dodge basic attacks. It is not applied through rune protection or paralysis immunity; storm weather lengthens it, aquatic / Odd Keystone effects shorten it; a new paralysis only replaces the remaining time if longer.
- **Example (arithmetic, not measured):** Raichu, AP 0, no crit, target SPE_DEF 10, no shield: 100 / 1.5 = 66.7 → **67**; with caster AP 50: 150 / 1.5 = **100**. Pikachu 50 / 1.5 → 34; Pichu 25 / 1.5 → 17.
- **Unit differences:** stars and stats only for Pichu, Pikachu, Raichu. Alolan Raichu adds the SURGE_SURFER passive (below). Pachirisu has 90 maxPP and its own passive, which is **not investigated**.
- **Unresolved:** Pachirisu's passive; the scan order and distance metric of the helper; whether `moveTo` can be blocked (not read); the generic damage pipeline after SPE_DEF; exact timing of a cast in a fight.

## DRAGON_RAGE — Gyarados
*Record:* `abilities.DRAGON_RAGE`. Strategy `DragonRageStrategy` and `DragonRageEffect` (`dragon-rage.ts:11–90`). No target needed.
- **First cast:** shield to the caster (raw 15 / 30 / 45 / 60 by stars → **45** for Gyarados) and a periodic effect with 6 pulses. Each pulse (interval 1000 timer units): shield to the caster (raw 5 / 10 / 15 / 20 → **15**) and special damage (raw 5 / 10 / 15 / 20 → **15**) to every enemy on the 8 cells adjacent to the caster **at that pulse**. After the 6th pulse the next timer fire ends the effect and converts shield to healing.
- **Conversion:** let **C = min(current shield, shieldGiven)**. The conversion **removes C shield** and **requests `round(0.4 × C)` healing** (`dragon-rage.ts:64–69`) — different amounts. `shieldGiven` counts **raw** values only (45 + 6 × 15 = 135 for Gyarados), not AP-boosted shield actually received, so C never exceeds the raw counter. The healing request is not AP-scaled; `handleHeal` then applies its own modifiers (wound → 0, burn and enrage ×0.5, healing-received buff ×1.3, zenith ×1.2) and caps at missing HP. For C = 135 the **base** request is round(0.4 × 135) = **54**, before those modifiers; it is not a universal maximum (C and the modifiers vary).
- **Recast while active:** no new initial shield; the effect converts its tracked shield into healing immediately and resets `ticksRemaining` to 6 (the 1000 timer is not reset). A recast still spends maxPP.
- **Damage example:** one pulse vs an adjacent enemy with SPE_DEF 10, AP 0, no crit, no shield: ceil(15 / 1.5) = **10**; six pulses = 60 only if that enemy stays adjacent, alive and unshielded for all pulses. AP scales the pulse damage and the shield received (crit only with `ABILITY_CRIT`, flag fixed at cast time).
- **Server-code scope:** `EffectEnum.DRAGON_RAGE` is used only in this file (checked by the validator).
- **Unresolved:** what happens to the running effect if the caster dies or resurrects; how a timer unit maps to real time; the Big Eater Belt hook on the negative `addShield` used by the conversion; Explosive Band-style shield-depleted interaction (a negative `addShield` can run `OnShieldDepletedEffect`).

## THRASH — Mankey / Primeape / Annihilape
*Record:* `abilities.THRASH`. Strategy `ThrashStrategy` (`thrash.ts:5–13`). No target; no damage.
- **Effect:** `addAttack(floor(percent / 100 × baseAtk), self, apBoost 1, crit)` with percent by stars **100 / 100 / 120 / 150**: Mankey 100 %, Primeape 100 %, Annihilape 120 %. `baseAtk` is the entity's ATK at creation (it includes earlier permanent attack, not stacks gained mid-fight). The buff is not permanent and has no expiry in the ability; repeated casts stack, each from the same `baseAtk`.
- **Self-confusion:** `triggerConfusion(3000, self, self)` (no AP scaling). It is not applied (and not extended) while the unit is already confused, nor through rune protection or confusion immunity (Persim Berry). While confused, each basic attack's target is chosen by `getTargetWhenConfused`: a luck-adjusted 50 % keeps normal enemy targeting, otherwise allies are eligible and the unit itself is added as a candidate; ending confusion clears the target. Only the attacking state has this branch in the lines searched.
- **Examples (arithmetic):** Mankey baseAtk 7 → **+7**; bare Primeape baseAtk 20 → **+20** (a Primeape with k permanent attack points from earlier fights starts with baseAtk 20 + k); Annihilape baseAtk 30 → **+36** (floor(1.2 × 30)); with caster AP 50, Annihilape round(36 × 1.5) = **54**.
- **Unresolved:** moving-state and other confusion paths beyond those read; the lifecycle of the entity-only ATK buff in every path; no gameplay evidence on how self-confusion feels in a fight.

## SURGE_SURFER (passive) — Alolan Raichu
*Record:* `passives.SURGE_SURFER`. **Not** `EffectEnum.SURGE_SURFER`, the aquatic-synergy tier effect (status durations ×0.3); the two share only a name.
- **Trigger and effect:** `Status.addElectricField` / `addPsychicField` on a holder with `Passive.SURGE_SURFER` gives **+30 speed** the first time that field flag turns on; the matching remove method gives −30 (`status.ts:1307–1337`). Both fields: +60. No AP or crit scaling. No `PassiveEffects` entry exists: the logic lives only in `status.ts`.
- **Conditions:** each field counts once (early return when the flag is already set). Field sources that go through the add methods include the ELECTRIC_TERRAIN / PSYCHIC_TERRAIN synergy effects (the unit needs the type; Alolan Raichu has Electric and Psychic), units flagged supercharged at simulation start, storm-weather lightning on an Electric-type unit, Terrain Extender (it picks the unit's first type among Electric/Grass/Psychic/Fairy, so Electric for Alolan Raichu), Herba Mystica dishes, Terrain Pulse, Electrify and Expanding Force. **Volt Surge, the Tadbulb-supercharge passive and the Pincurchin passive set the flag directly and do not give the speed.**
- **Reset:** per-fight status; the speed is removed when the field is removed (death of a terrain-passive unit removes the field from its team). No timer or counter.
- **Example:** bare Alolan Raichu speed 54: one field → 84; both → 114 (arithmetic only).
- **Separate field effect:** an attacker with an electric field deals ×1.2 and a psychic field another ×1.2 (`pokemon-state.ts:463–469`); that belongs to the fields, not to the passive.
- **Unresolved:** an exhaustive list of field sources (grep covered `app/core` and `app/models`); behaviour of a later field removal after a direct set.

## PRIMEAPE (passive) — Primeape
*Record:* `passives.PRIMEAPE`. Applies to Primeape only.
- **Triggers:** `OnDeathEffect` (a real death) and `OnResurrectingEffect` (the resurrection start); the death effect does not proc on a resurrection, so one event gives one stack (`effect.ts:216–243`, `pokemon-state.ts:783–803`, `passives.ts:1537–1540`).
- **Effect:** `addAttack(1, self, 0, false, permanent)` (+1 ATK, written to the board unit) and `addStack()`. `addStack` returns early if the entity has no player.
- **Evolution (re-checked against the source):** Primeape is `STACK`, `stacksRequired = 10`. `addStack` calls `tryEvolve` only when `stacks === stacksRequired` (exact); `StackEvolutionHandler.canEvolve` needs no Eviolite, the unit on the board and `stacks >= stacksRequired`. Evolution carries permanent stat deltas to Annihilape, and `Annihilape.onAcquired` subtracts 10 attack ("revert permanent atk buff stacked for evolution"): plain case 30 + 10 − 10 = **30** (arithmetic, assuming exactly 10 permanent points and no stack after the 10th).
- **Fresh Annihilape vs the fight entity that evolved:** a newly created Annihilape declares passive `NONE` and gains no stacks. The *existing* fight entity that evolved mid-fight only gets a new name, index and board reference in `addStack` (`pokemon-entity.ts:1817–1822`); that code does not change its passive, and the `changePassive` callers found do not include this path. Read from the code, that entity keeps `Passive.PRIMEAPE` and its death/resurrection effects for the rest of the fight, so a later death or resurrection would again add +1 permanent ATK and +1 stack to the (now Annihilape) board unit, and the rule re-check reads the Annihilape's non-STACK rule, so no further evolution is attempted. This is a reading, not an observation: other code that rebuilds the entity after evolution was not searched exhaustively (**unresolved**).
- **Eviolite and equality (inspected `addStack` path only):** with Eviolite held at the 10th stack `canEvolve` is false, and because `addStack` tests `===`, stacks 11, 12, … do not call `tryEvolve` again on that path. `canEvolve` itself uses `>=`, and other `tryEvolve` callers were not exhaustively listed, so this is not a claim about every path.
- **Reset:** stacks and permanent ATK live on the board unit and persist across fights in the code read; no reset of Primeape stacks was found (pattern search, not an exhaustive proof).
- **Unresolved:** an exhaustive list of `tryEvolve` callers for STACK rules; the stack reset between rounds or on selling; stacks beyond 10; sources of resurrection in real play.

## PACHIRISU (passive) — gap
*Record:* `passiveGaps.PACHIRISU`. Pachirisu declares `Passive.PACHIRISU`; its trigger and effect have **not been read**. Its NUZZLE coverage above is independent of that passive.

## What stays unverified
Gameplay behaviour, shop availability and balance; the live game's code parity; the generic combat pipeline beyond the pieces named; every timing in real seconds; item and synergy interactions that were not named.
