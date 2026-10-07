# Ability pilot: BLAST_BURN, CRUNCH, VESPIQUEN_ORDERS

**Production-branch reference; deployment unverified.** Source `07367c341fe928763da2b565c2eee010433e4fc1` (upstream `prod` head). Structured records with every source reference (file, lines, symbol, checked text): [`../../data/07367c34/pilot-abilities.json`](../../data/07367c34/pilot-abilities.json) — each section below names its record. Checked by [`../../validate-abilities.mjs`](../../validate-abilities.mjs).

**How to read the numbers.** "Raw" = the amount written in the ability code. It is **not** the damage or healing a player sees: the generic combat code then applies AP, crits, defense, shields, statuses and items. Only the pieces of that pipeline that were read are listed; the rest is flagged as unverified. Nothing here was executed or checked in a live game, and no description or UI text was used.

Common to all three (record `dispatch`): abilities are looked up in `AbilityStrategies` (`app/core/abilities/abilities.ts:728`); a cast spends the unit's `maxPP`, counts the cast and plays the animation (`ability-strategy.ts:6–33`). A cast can only crit if the unit has the `ABILITY_CRIT` effect (`cast.ts:18–25`; none of these abilities crit by default).

## BLAST_BURN — Charmander / Charmeleon / Charizard
*Record:* `abilities.BLAST_BURN`. Strategy `BlastBurnStrategy` (`blast-burn.ts:6–28`, registry `abilities.ts:767`).
- **What it does:** special damage to **every enemy in the cells around the caster** — the 8 adjacent cells, caster's cell excluded, off-board cells skipped (`board.ts:152–163`). Allies are never hit. The area is centered on the caster, not on its target (the cast still requires a target).
- **Raw damage by stars:** 30 / 60 / 120 / 240 (index = stars − 1; 240 is also the fallback). Charmander (1★) 30, Charmeleon (2★) 60, Charizard (3★) 120. All three have maxPP 100 and range 1.
- **Scaling:** AP raises it by `1 + ap/100` (`pokemon-entity.ts:399–400`); a crit multiplies it (only with ABILITY_CRIT). Special damage is then divided by `1 + 0.05 × target speDef` (`pokemon-state.ts:559–566`) before further modifiers that were not traced.
- **No status, buff, heal or shield.** Repeated casts are identical and keep no state; there are no modes.
- **Unverified:** final resolved damage after the generic pipeline; when a fight actually triggers the cast; whether any 4★ unit uses it.

## CRUNCH — Totodile (production reference)
*Record:* `abilities.CRUNCH`. Strategy `CrunchStrategy` (`crunch.ts:6–27`, registry `abilities.ts:812`). In the development snapshot TOTODILE has BITE instead; here `Totodile` declares CRUNCH (`pokemon.ts:4608`). The same strategy is declared by Croconaw, Feraligatr and Guzzlord (outside this pilot).
- **What it does:** special damage to the **current target** (single target). **If that hit kills the target, the caster heals** for `ceil(0.5 × the victim's max HP)`.
- **Raw damage by stars:** 40 / 80 / 160 / 320 (Totodile is 1★ → 40; maxPP 100, range 1).
- **Scaling:** damage uses AP and crit as above and the same speDef division. The **heal is not scaled by AP or crit** (`handleHeal(…, apBoost 0, crit false)`); when it resolves, the heal received is capped by the caster's missing HP and is zero under wound, halved under burn or enrage (`pokemon-state.ts:308–357`).
- **No status or buff.** No state between casts; the heal can happen on any killing cast.
- **Unverified:** what counts as a kill (death-cancelling effects such as Shiny Charm and resurrection were only sampled; a blocked hit returns "no death"); final resolved damage and heal.

## VESPIQUEN_ORDERS — Vespiquen
*Record:* `abilities.VESPIQUEN_ORDERS`. **The identifier itself does almost nothing:** it is registered as the plain base `AbilityStrategy` (`abilities.ts:1269`), so a cast only does the bookkeeping above. Vespiquen (3★, maxPP 90, range 3) has a passive that **rewrites its skill and range when the player moves it** (`passives.ts:1751–1764`, applied from `onPokemonChangePosition`, `game-commands.ts:2449–2512`):

| Moved to row | Skill | Range |
|---|---|---|
| 1 | ATTACK_ORDER | 3 |
| 2 | HEAL_ORDER | 2 |
| 3 | DEFEND_ORDER | 1 |

Other rows change nothing. The fight entity copies skill and range when the fight starts (`pokemon-entity.ts:187–194`). All three modes need no target (`requiresTarget = false`), and each cast **spawns one Combee ally** on the nearest free cell (random among ties; no Combee if no free cell).

- **ATTACK_ORDER** (`attack-order.ts`): every allied Combee (new one included) is enraged for 3000 ms (+80 speed, protect cleared, healing/shields it receives halved); the caster's **next basic attack** gets extra special damage `(base + N × per-Combee) × (1 + ap/100)`, with base 20 / 40 / 60 / 120 and per-Combee 10 / 20 / 30 / 60 (`pokemon-state.ts:188–206`, delivered `:257–269`). For Vespiquen (3★) that is **60 + 30 × N**, N = allied Combee on the board at that attack. Casting again before the attack does not stack the bonus.
- **HEAL_ORDER** (`heal-order.ts`): the caster and every allied Combee each heal the allies in their 8 adjacent cells and clear their negative statuses. Heal 10 / 20 / 30 / 60 raw (Vespiquen: **30**), scaled by AP and crit. An ally next to several healers is healed several times; a healer is healed only if adjacent to another healer.
- **DEFEND_ORDER** (`defend-order.ts`): every allied Combee gets a shield of 10 / 20 / 30 / 50 raw (Vespiquen: **30**); the caster gets `(1 + N) ×` that (30 + 30 × N), N = allied Combee counted. Scaled by AP and crit, halved on enraged recipients.
- **Repeated casts:** each cast adds a Combee (if there is room), so N and the number of healers grow. The mode is fixed by the row chosen before the fight.
- **Unresolved:** what skill a Vespiquen has if it was never moved to rows 1–3 (it keeps VESPIQUEN_ORDERS, i.e. nothing specific), including Vespiquen made by evolution; what happens when it returns to the bench; which row is the front line; exact Combee placement; Combee's own behavior; the separate Bug-synergy clone code that mentions the Vespiquen passive.

## What stays unverified for all three
Target selection and cast timing in real fights; the full damage/heal/shield pipeline beyond the lines cited; crit chance resolution; item and synergy interactions. These were recorded as dependencies in each record and not traced further.
