# Roadmap — Pokémon Auto Chess assistant

**Goal.** Comprehensive, fast knowledge and strategy support for a player: look up mechanics, items and units, explain them with sources, and reason about options from verified mechanics. **Not** automated gameplay, not a bot, not a live-game connection.

**Authoritative source:** production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1`; deployment unverified. The development snapshot (`01a3e845…`) stays separate.

## Stages
1. **Source/version foundation** — pinned revisions, extractors with provenance, output guards. *Done for the pilot scope.*
2. **Structured knowledge and explanations** — data records plus reviewed notes with `file:lines`. *Partial (below).*
3. **Fast retrieval** — `match-reference.md` for QUICK answers, `ASK.md` modes, lookup tool. *In place: QUICK (no tools), FAST (one batched `lookup-item.mjs` call) and unit lookups; no measured Claude response times.*
4. **Strategic reasoning and community evidence** — deductions from verified mechanics; later, clearly labelled community/tier data. *Mechanics-based reasoning allowed; no community evidence collected.*
5. **Practical validation** — compare answers with real matches. *Not started; no gameplay evidence exists.*
6. **Obsidian integration and updates** — notes in the user's vault, procedure for new revisions. *Not started; no Obsidian connection.*

## Honest current coverage and gaps
- **Covered:** 1183 unit baselines; evolution for 20 units; 3 reviewed abilities (Blast Burn, Crunch, Vespiquen Orders); normal-path economy, leveling and shop; the shared damage/PP/cast foundation ([core-mechanics.md](knowledge/07367c34/core-mechanics.md) §A–C, §H–I); all 55 recipes and 90 declared item stat entries; source-traced effect records for all 55 craftable recipe outputs (`item-effects.json`, unified with the Silk Scarf items), plus Eviolite and Shiny Stone separately.
- **Gaps:** nearly all other abilities; no structured passive records (a few passives are explained in notes, e.g. Vespiquen's row passive, Manaphy's Aqua Egg spawn); effects of consumables, tools, memory discs and other special items; status effects, targeting and movement; special rules/modes; no probe or gameplay evidence for items; no community data (tier lists, win rates); no build comparison; dev-snapshot differences mostly unchecked.

## Completed milestone — craftable recipe-output catalog (all 55 `ItemRecipe` outputs)
Shared combat foundation: complete (core-mechanics §H–I). **Recipe-output coverage: complete** — [item-effects.json](data/07367c34/item-effects.json) has exactly the 55 `ItemRecipe` output keys (checked by `validate-items.mjs` against the pinned source), each with recipe, declared-stat availability, traced effects or verified absence, evidence ranges and unresolved details; [item-effects.md](knowledge/07367c34/item-effects.md) explains all 55 and is generated from the records. The ten Silk Scarf outputs were unified into the catalog reusing their evidence; [silk-scarf-items.md](knowledge/07367c34/silk-scarf-items.md) remains the detailed specialist guide. Eviolite and Shiny Stone are not recipe outputs (core-mechanics §G) and are not counted. All of it is source-traced: no probes, no gameplay evidence, no build comparison.
Outside this milestone (not scheduled): consumables, tools, memory discs and other special items; evolution-handler paths named in the records; dev-snapshot item differences.

## Current milestone — targeted item retrieval (started)
`lookup-item.mjs` (read-only, saved data only) answers item questions with compact cards (single, batched, `--component`, `--list`); `test-lookup-item.mjs` checks it; ASK.md has a FAST mode (QUICK plus one batched item lookup) with exact startup instructions in START-HERE.md. Cards are summaries of the detailed records, checked by `validate-items.mjs`. No measured response-time claim: local command time is reported separately and is not evidence of fast Claude answers. Remaining in this milestone: nothing scheduled beyond the build comparisons below.

## Next tasks
1. Shared combat foundation — *done*. 2. Item-effect coverage of the 55 craftable recipe outputs — *done*. 3. Item retrieval tool and FAST mode — *done (this milestone's first part)*.
4. **Next: representative build comparisons** (not started; do not begin automatically) — compare item options for a few representative units from the covered mechanics (labelled "reasonable option", not "best"), with a small set of retrieval-answer tests.

## Rules for future updates
- Keep revisions separate: new revision → new `data/<sha8>/` and `knowledge/<sha8>/`; never overwrite or silently mix the pinned production-reference files with another revision.
- Before regenerating any data, **review the extraction assumptions that the source change may have invalidated** (cited files/lines, enum and table shapes, parsing rules), compare against the previous pinned revision, then re-run validators.
- Keep QUICK mode read-only and loaded-reference-only; keep evidence labels (declared / traced / executed / inference) on every claim.
