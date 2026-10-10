# Roadmap — Pokémon Auto Chess assistant

**Goal.** Comprehensive, fast knowledge and strategy support for a player: look up mechanics, items and units, explain them with sources, and reason about options from verified mechanics. **Not** automated gameplay, not a bot, not a live-game connection.

**Authoritative source:** production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1`; deployment unverified. The development snapshot (`01a3e845…`) stays separate.

## Stages
1. **Source/version foundation** — pinned revisions, extractors with provenance, output guards. *Done for the pilot scope.*
2. **Structured knowledge and explanations** — data records plus reviewed notes with `file:lines`. *Partial (below).*
3. **Fast retrieval** — `match-reference.md` for QUICK answers, `ASK.md` modes, lookup tool. *In place: QUICK (no tools), FAST (one batched `lookup-item.mjs` call), unit lookups and item-choice guidance for three unit groups; no measured Claude response times.*
4. **Strategic reasoning and community evidence** — deductions from verified mechanics; later, clearly labelled community/tier data. *Mechanics-based reasoning allowed; no community evidence collected.*
5. **Practical validation** — compare answers with real matches. *Not started; no gameplay evidence exists.*
6. **Obsidian integration and updates** — notes in the user's vault, procedure for new revisions. *Not started; no Obsidian connection.*

## Honest current coverage and gaps
- **Covered:** 1183 unit baselines; evolution for 20 units; 3 reviewed abilities (Blast Burn, Crunch, Vespiquen Orders); normal-path economy, leveling and shop; the shared damage/PP/cast foundation ([core-mechanics.md](knowledge/07367c34/core-mechanics.md) §A–C, §H–I); all 55 recipes and 90 declared item stat entries; source-traced effect records for all 55 craftable recipe outputs (`item-effects.json`, unified with the Silk Scarf items), plus Eviolite and Shiny Stone separately.
- **Gaps:** nearly all other abilities; no structured passive records (a few passives are explained in notes, e.g. Vespiquen's row passive, Manaphy's Aqua Egg spawn); effects of consumables, tools, memory discs and other special items; status effects, targeting and movement; special rules/modes; no probe or gameplay evidence for items; no community data (tier lists, win rates); build comparisons only for three unit groups; dev-snapshot differences mostly unchecked.

## Completed milestone — craftable recipe-output catalog (all 55 `ItemRecipe` outputs)
Shared combat foundation: complete (core-mechanics §H–I). **Recipe-output coverage: complete** — [item-effects.json](data/07367c34/item-effects.json) has exactly the 55 `ItemRecipe` output keys (checked by `validate-items.mjs` against the pinned source), each with recipe, declared-stat availability, traced effects or verified absence, evidence ranges and unresolved details; [item-effects.md](knowledge/07367c34/item-effects.md) explains all 55 and is generated from the records. The ten Silk Scarf outputs were unified into the catalog reusing their evidence; [silk-scarf-items.md](knowledge/07367c34/silk-scarf-items.md) remains the detailed specialist guide. Eviolite and Shiny Stone are not recipe outputs (core-mechanics §G) and are not counted. All of it is source-traced: no probes, no gameplay evidence, no build comparison.
Outside this milestone (not scheduled): consumables, tools, memory discs and other special items; evolution-handler paths named in the records; dev-snapshot item differences.

## Completed milestone — targeted item retrieval and representative build comparisons
`lookup-item.mjs` (read-only, saved data only) answers item questions with compact cards; ASK.md has QUICK (zero tools), FAST (one batched item lookup) and RESEARCH. [representative-builds.md](knowledge/07367c34/representative-builds.md) compares covered items for the Charmander line (Blast Burn), the Totodile line (Crunch) and Vespiquen's three row modes, with seven worked comparisons expressed as PP requirements, basic-attack counts, periodic-tick counts and damage per cast (immediate vs periodic AP/PP, starting PP vs smaller max PP vs PP return, survival options, burn vs flat AP, Shell Bell on an AoE, AP vs ATK for Crunch, Vespiquen casting engine vs AP), default suggestions with stated assumptions, when another option wins, and anti-synergies. The calculations are re-computed by `check-build-arithmetic.mjs` under the note's stated assumptions (not an engine-parity check; no cast times are claimed); `match-reference.md` carries a ≤450-word decision section so FAST/QUICK can answer "what items for X?" without the user naming candidates; six saved answer checks are in [analysis/representative-answer-checks.md](analysis/representative-answer-checks.md). Compact card text for Smoke Ball, Shell Bell and Big Eater Belt was corrected with their records. All of it is reasoned from source-traced mechanics: no gameplay evidence, no measured DPS, no win rates, no meta, no claim of an absolute best build.
**Remaining gaps:** real combat timing (movement start, delayed attack commands, periodic-timer reset) is not modelled, so no cast times are given; only three unit groups are covered (other units: not covered); most abilities and all passives beyond the reviewed ones are uncovered, so item interactions with them are unknown; damage-taken PP, statuses, targeting, ring occupancy and fight length are not modelled; synergy effects of the units' types are not audited; Vespiquen's acquisition and evolution-created mode are untraced; community or tested evidence is absent; no real-match validation.

## Next tasks (not started)
1. Extend builds to more units as their abilities are reviewed (each needs ability + positioning review first).
2. Real-match validation of the recommendations (user-supplied results), then a revision-update procedure and the Obsidian integration stage.

## Rules for future updates
- Keep revisions separate: new revision → new `data/<sha8>/` and `knowledge/<sha8>/`; never overwrite or silently mix the pinned production-reference files with another revision.
- Before regenerating any data, **review the extraction assumptions that the source change may have invalidated** (cited files/lines, enum and table shapes, parsing rules), compare against the previous pinned revision, then re-run validators.
- Keep QUICK mode read-only and loaded-reference-only; keep evidence labels (declared / traced / executed / inference) on every claim.
