# Production-reference knowledge index

**Production-branch reference; deployment unverified.** Source: `07367c341fe928763da2b565c2eee010433e4fc1` (upstream `prod` head). Everything under `data/07367c34/` and `knowledge/07367c34/` describes only this revision. The development snapshot (`01a3e845…`: `data/01a3e845/`, `knowledge/pilot-*.md`, `lookup-unit.mjs`) is a **different revision — never mix it into an answer** unless the user explicitly asks for a comparison (see [pilot-baseline-comparison](../../analysis/pilot-baseline-comparison.md)).

How to answer from this index: [ASK.md](../../ASK.md). How to start a session: [START-HERE.md](../../START-HERE.md).

## Which source answers which question
| Question type | Start with | Then (as needed) |
|---|---|---|
| A unit's **bare** stats, types, skill/passive identifiers, family root | `node assistant/lookup-production.mjs KEY` · [`catalog-units.json`](../../data/07367c34/catalog-units.json) (1183 identifiers) | [catalog-coverage](../../analysis/catalog-coverage.md) |
| How/when a unit **evolves** | lookup (20 covered units) · [pilot-evolution.md](pilot-evolution.md) · [`pilot-evolution.json`](../../data/07367c34/pilot-evolution.json) | [evolution-context.md](evolution-context.md) (Pikachu's regional branch, Cosmog/Cosmoem, light cell) |
| What an **ability** does | lookup (reviewed only) · [pilot-abilities.md](pilot-abilities.md) · [`pilot-abilities.json`](../../data/07367c34/pilot-abilities.json) | [core-mechanics.md](core-mechanics.md) for PP/cast rules |
| **Gold, interest, streaks, XP, levels, reroll cost** | [economy-leveling.md](economy-leveling.md) · [`economy-leveling.json`](../../data/07367c34/economy-leveling.json) | [shop-rules.md](shop-rules.md) |
| **Shop**: rarity odds per level, can unit X appear, pools, refresh/lock | [shop-rules.md](shop-rules.md) · [`shop-rules.json`](../../data/07367c34/shop-rules.json) | lookup (rarity/stars) |
| **Damage**, defenses, PP/mana, attack speed, **AP/crit scaling, casting, item bonuses → combat stats** | [core-mechanics.md](core-mechanics.md) §A–C, §H–I | [probes/results/core-mechanics-probe.json](../../probes/results/core-mechanics-probe.json) |
| **Positioning**, rows, Vespiquen modes | [core-mechanics.md](core-mechanics.md) §D | [pilot-abilities.md](pilot-abilities.md) |
| **Synergy** counting and thresholds | [core-mechanics.md](core-mechanics.md) §E | — |
| **Items**: slots, combining, Eviolite, Shiny Stone | [core-mechanics.md](core-mechanics.md) §F–G | [evolution-context.md](evolution-context.md) |
| **Silk Scarf** recipes and the ten scarf items (bonuses, effects, allowance) | [silk-scarf-items.md](silk-scarf-items.md) | [`item-recipes-stats.json`](../../data/07367c34/item-recipes-stats.json) |
| **Item effects — any of the 55 craftable recipe outputs** (all scarf items, synergy stones and the rest; Eviolite/Shiny Stone are separate, see core-mechanics §G) | [item-effects.md](item-effects.md) | [`item-effects.json`](../../data/07367c34/item-effects.json); scarf detail: [silk-scarf-items.md](silk-scarf-items.md) |
| **Any item's recipe / declared stats** (55 recipes, 90 stat entries) | [`item-recipes-stats.json`](../../data/07367c34/item-recipes-stats.json) | effects: only the notes above — otherwise not covered |
| Facts to have loaded **before play** (QUICK mode) | [match-reference.md](match-reference.md) | linked notes for evidence |
| "Is this the **live** version?" / differences between revisions | [version-alignment](../../analysis/version-alignment.md) · [pilot-baseline-comparison](../../analysis/pilot-baseline-comparison.md) | — |
| Current **meta**, win rates, best comps | *not in this knowledge* — say so | mechanics notes only for explaining individual effects |

Evidence each answer can cite: the note section, its source `file:lines` at the pinned SHA, and (where it exists) the executed probe result in `probes/results/` (shop, economy, core mechanics, regional Pikachu, Cosmog). Probes run real game functions with stub objects; they are **not** gameplay evidence.

## Coverage at a glance
| Area | Covered | Not covered |
|---|---|---|
| Unit baseline | all 1183 catalog identifiers (bare factory instance) | acquired/in-match values; availability and playability of any identifier |
| Evolution declarations | 20 units: CHARMANDER, CHARMELEON, CHARIZARD, PIKACHU, RAICHU, ALOLAN_RAICHU, GALAR_MEOWTH, VESPIQUEN, ARCEUS, MAGIKARP, GYARADOS, TYPE_NULL, PRIMEAPE, TEPIG, DITTO, UNOWN_D, FARFETCH_D, TOTODILE, COSMOEM, SUBSTITUTE | every other unit's evolution rule (only raw `evolution`/`evolutions` fields are in the catalog) |
| Abilities | BLAST_BURN (CHARMANDER/CHARMELEON/CHARIZARD), CRUNCH (TOTODILE only), VESPIQUEN_ORDERS (VESPIQUEN) | all other abilities (NUZZLE, TELEPORT, …); no structured passive records — a few passives are explained in notes (Vespiquen's row passive in pilot-abilities.md, Manaphy in item-effects.md), the rest only have identifiers |
| Economy and leveling | normal path | SCRIBBLE/DOUBLE_UP, special rules, income/XP items |
| Shop | normal path, levels 2–9 | shop-modifying items/synergies/rules, regional-variant pool accounting |
| Core mechanics | damage defense step, PP/cast, attack interval, rows, synergy counting, item slots/combining, two item examples | the full damage pipeline, status effects, movement/targeting detail, per-item rules, synergy exceptions beyond Dragon/FAMILY_OUTING/dynamic types |
| Items | all 55 recipes and 90 declared stat entries (data); traced behavior of all 55 craftable recipe outputs (no probe) plus Eviolite and Shiny Stone | behavior of consumables, tools, memory discs and other special items, evolution-handler paths,  item interactions with abilities, dev-snapshot item differences |

## Boundaries to state when relevant
- **Bare-instance ≠ acquired ≠ combat.** Catalog stats are a freshly created unit; in-match values include evolution carry-over, items, synergies, buffs and combat effects (e.g. Cosmoem HP: [evolution-context.md](evolution-context.md) §Cosmog → Cosmoem).
- **Identifiers do not explain abilities or passives, and do not prove shop availability.**
- **Probes are isolated executions, not gameplay.** No live-game testing of any kind exists.
- **Unresolved items** live at the end of each note (and in the JSON `unresolved` fields): e.g. Vespiquen made by evolution keeps its placeholder skill until moved (untraced), Primeape fight timing, regional-variant pool accounting, item/rule modifiers of income and shop, most per-item behavior (other than the ten scarf items).
- **Nothing here establishes the current meta.** See [first-version-question-checks](../../analysis/first-version-question-checks.md) for worked examples of answering within these limits.
