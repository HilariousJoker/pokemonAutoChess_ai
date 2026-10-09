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
- **Gaps:** nearly all other abilities; no structured passive records (a few passives are explained in notes, e.g. Vespiquen's row passive, Manaphy's Aqua Egg spawn); effects of the 9 remaining craftable recipe outputs (below); status effects, targeting and movement; special rules/modes; no probe or gameplay evidence for items; no community data (tier lists, win rates); no build comparison; dev-snapshot differences mostly unchecked.

## Current milestone — broader item-effect coverage (in progress)
Shared combat foundation: **complete** (core-mechanics §H–I; checks in [analysis/quick-reference-checks.md](analysis/quick-reference-checks.md)).
Item coverage: Eviolite, Shiny Stone, the 10 Silk Scarf items, and the structured/explained records for **batches 1–3 (36 items)** in [item-effects.md](knowledge/07367c34/item-effects.md) / [item-effects.json](data/07367c34/item-effects.json):
- batch 1: Choice Specs, Soul Dew, Upgrade, Reaper Cloth, Aqua Egg, Blue Orb, Scope Lens, Pokemonomicon, Shiny Charm, Max Revive, Shell Bell, Heavy-Duty Boots;
- batch 2: Ability Shield, Power Lens, Star Dust, Deep Sea Tooth, X-Ray Vision, Razor Fang, Loaded Dice, Punching Glove, Muscle Band, Assault Vest, Poké Doll, Rocky Helmet;
- batch 3: Green Orb, Gracidea Flower, Wonder Box, Smoke Ball, Wide Lens, Razor Claw, Safety Goggles, King's Rock, Sticky Barb, Protective Pads, Red Orb, Flame Orb.
All source-traced and checked by `validate-items.mjs`; no probes or gameplay evidence.
**Remaining unreviewed recipe outputs (9):** Old Amber, Dawn Stone, Water Stone, Thunder Stone, Fire Stone, Moon Stone, Dusk Stone, Leaf Stone, Ice Stone. (Consumables, tools and special items are outside the craftable list and not yet scheduled.)
**Final recipe-coverage task:** after the nine stones, build the unified structured catalog of all 55 recipe outputs, incorporating the ten already-reviewed Silk Scarf items by reusing their existing evidence (`silk-scarf-items.md` and the `validate-items.mjs` citation list) rather than re-auditing them.
Milestone completes when all craftable items have records and notes; no best build is declared before that.

## Next three tasks
1. **Shared combat foundation** — *done*.
2. **Broader item-effect coverage** — *in progress*: batches 1–3 done (36 items); trace the 9 remaining recipe outputs (the synergy stones), then unify all 55 recipe outputs including the reviewed scarf items into one structured catalog into `item-effects.json` / `item-effects.md` with checked line ranges; reuse `item-recipes-stats.json`; no new framework.
3. **Representative build recommendations + fast retrieval tests** — compare item options for a few representative units from the covered mechanics (labelled "reasonable option", not "best"), and add a small set of QUICK-mode retrieval tests.

## Rules for future updates
- Keep revisions separate: new revision → new `data/<sha8>/` and `knowledge/<sha8>/`; never overwrite or silently mix the pinned production-reference files with another revision.
- Before regenerating any data, **review the extraction assumptions that the source change may have invalidated** (cited files/lines, enum and table shapes, parsing rules), compare against the previous pinned revision, then re-run validators.
- Keep QUICK mode read-only and loaded-reference-only; keep evidence labels (declared / traced / executed / inference) on every claim.
