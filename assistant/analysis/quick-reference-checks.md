# Check: foundation questions answered from the quick reference alone

Production-branch reference `07367c34…`; deployment unverified. **Same-author checks — not independent validation, and not response-time measurements.**

**Method.** A fresh subagent with no history read only `ASK.md` and `knowledge/07367c34/match-reference.md` (it reported 2 parallel reads and no other tool calls; the harness counted 3 uses, the third presumably the report hand-back — I could not inspect the transcript) and answered in QUICK mode. I then checked each factual answer against the pinned source.

| Question | Answer from the reference | Check against source |
|---|---|---|
| Does AP increase Blast Burn, and by how much? | Yes: raw × (1 + AP/100); +10 AP = +10 % of raw; raw 30/60/120; 30 → 27 (SPE_DEF 3), → 40 with 50 AP | Default `apBoost = true` and `damage + damage × ap / 100` (`pokemon-entity.ts:346–353, 399–400`); raw table `blast-burn.ts:14`; arithmetic re-done: 30 ÷ 1.15 = 26.09 → 27; 45 ÷ 1.15 = 39.13 → 40. Arithmetic, not a simulated fight. |
| Charmander family range and PP threshold? | Range 1, maxPP 100 (all three) | `pokemon.ts` Charmander/Charmeleon/Charizard classes (`range = 1`, `maxPP = 100`), confirmed via `lookup-production.mjs`. |
| How does Efficient Bandanna help casting? | maxPP ×0.85 (100 → 85) for units on its cell and left/right; holder starts with +15 PP → 70 more PP (14 basic attacks vs 20); neighbors need 85 | `effects/items.ts:1536–1548`; PP stat → `addPP` (adds to current PP; `applyStat` has no MAX_PP case, no `ItemStats` entry uses MAX_PP — checked by `validate-items.mjs`). Basic-attack count counts only the +5 per attack, not damage-taken PP. |
| Can Blast Burn crit normally? | No, only with `ABILITY_CRIT` (e.g. Reaper Cloth, Leek dishes) | `cast.ts:16–26`, `ability-strategy.ts:8` (`canCritByDefault = false`), Blast Burn does not override it. |
| Can we identify Charmander's best items confidently? | No: mechanics are known, but no comparison across items, comps or opponents has been done; any item is at most a "reasonable option" | Remaining gap: no item-by-item effect coverage beyond Eviolite, Shiny Stone and the scarf items, no build comparison, no community or gameplay evidence. |

Silk Scarf coverage preserved: `validate-items.mjs` still checks all ten recipes, bonuses and effects in `silk-scarf-items.md` and `match-reference.md` against the source.
