# Roadmap — Pokémon Auto Chess assistant

**Goal.** Comprehensive, fast knowledge and strategy support for a player: look up mechanics, items and units, explain them with sources, and reason about options from verified mechanics. **Not** automated gameplay, not a bot, not a live-game connection.

**Authoritative source:** production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1`; deployment unverified. The development snapshot (`01a3e845…`) stays separate.

## Stages
1. **Source/version foundation** — pinned revisions, extractors with provenance, output guards. *Done for the pilot scope.*
2. **Structured knowledge and explanations** — data records plus reviewed notes with `file:lines`. *Partial (below).*
3. **Fast retrieval** — `match-reference.md` for QUICK answers, `ASK.md` modes, lookup tool. *First version in place; no measured response times.*
4. **Strategic reasoning and community evidence** — deductions from verified mechanics; later, clearly labelled community/tier data. *Mechanics-based reasoning allowed; no community evidence collected.*
5. **Practical validation** — compare answers with real matches. *Not started; no gameplay evidence exists.*
6. **Obsidian integration and updates** — notes in the user's vault, procedure for new revisions. *Not started; no Obsidian connection.*

## Honest current coverage and gaps
- **Covered:** 1183 unit baselines; evolution for 20 units; 3 reviewed abilities (Blast Burn, Crunch, Vespiquen Orders); normal-path economy, leveling and shop; the shared damage/PP/cast foundation ([core-mechanics.md](knowledge/07367c34/core-mechanics.md) §A–C, §H–I); all 55 recipes and 90 declared item stat entries; effects of Eviolite, Shiny Stone and the ten Silk Scarf items.
- **Gaps:** nearly all other abilities and every passive; effects of ~all other items; status effects, targeting and movement; special rules/modes; no probe or gameplay evidence for items; no community data (tier lists, win rates); no build comparison; dev-snapshot differences mostly unchecked.

## Current milestone — shared combat foundation + roadmap
Complete when: this roadmap exists; core-mechanics §H–I explain basic-attack vs ability scaling, AP opt-out, ability crits, rounding/shield order, PP/cast/attack-slot and how declared item bonuses become combat stats, with source lines checked by `validate-items.mjs`; `match-reference.md` carries the essentials (Charmander-family facts included); `ASK.md` allows labelled strategic deductions; the quick-reference checks are recorded ([analysis/quick-reference-checks.md](analysis/quick-reference-checks.md)). No best Charmander build is declared.

## Next three tasks
1. **Shared combat foundation** — *this milestone* (finish, then stop).
2. **Broader item-effect coverage** — trace effects of the remaining craftable items (and consumables as needed) into notes/records with checked line ranges; reuse `item-recipes-stats.json`; no new framework.
3. **Representative build recommendations + fast retrieval tests** — compare item options for a few representative units from the covered mechanics (labelled "reasonable option", not "best"), and add a small set of QUICK-mode retrieval tests.

## Rules for future updates
- Keep revisions separate: new revision → new `data/<sha8>/` and `knowledge/<sha8>/`; never overwrite or silently mix the pinned production-reference files with another revision.
- Before regenerating any data, **review the extraction assumptions that the source change may have invalidated** (cited files/lines, enum and table shapes, parsing rules), compare against the previous pinned revision, then re-run validators.
- Keep QUICK mode read-only and loaded-reference-only; keep evidence labels (declared / traced / executed / inference) on every claim.
