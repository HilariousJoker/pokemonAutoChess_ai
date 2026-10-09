# START HERE — asking game questions

**What this is.** A read-only knowledge base about Pokémon Auto Chess, built from the game's source at one pinned revision: **production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1` — deployment unverified** (the live game may differ). It is used by letting Claude read these files and answer your questions with citations. There is no website, API or service, and your Obsidian vault is **not** connected.

## Steps (Claude Code session connected to your fork)
1. Open a Claude Code session on the fork **HilariousJoker/pokemonAutoChess_ai**, branch **`claude/great-volta-v6znve`** (the folder `assistant/` must be present).
2. Paste the **session-start instruction** below as your first message. Claude should reply with one line confirming it loaded the two files.
3. Ask your questions. Answers come with the note and source reference they rely on, and say plainly when something is outside what has been investigated.
4. (Optional) For unit lookups Claude may run `node assistant/lookup-production.mjs CHARIZARD` — read-only, needs only Node, no install.

## Copy-paste session-start instruction
```text
Read assistant/ASK.md and assistant/knowledge/07367c34/index.md in this repository (branch claude/great-volta-v6znve) and follow ASK.md for every question I ask from now on. Answer read-only: no edits, installs, extraction or game actions unless I ask. Use only the production-branch reference 07367c34 (deployment unverified), never mix in the development snapshot, and tell me plainly when something is not covered. Confirm in one line that you loaded both files, then wait for my first question.
```

## Match session (fresh, question-only) — load before play
Use a **new** Claude Code session on the same fork and branch (do not continue an audit/build conversation: carrying it over wastes context and mixes review work into answers). Paste this as the first message, then wait for its one-line confirmation before the match:
```text
Read assistant/ASK.md and assistant/knowledge/07367c34/match-reference.md in this repository (branch claude/great-volta-v6znve). Follow ASK.md. Read-only; production-branch reference 07367c34 only (deployment unverified). Default to QUICK mode: answer from these two files without searching the repository or inspecting source; answer first, essential uncertainty only. When I ask "research:" or ask a direct mechanics question after the match, use RESEARCH mode. Confirm in one line that both files are loaded, then wait.
```
- **QUICK** answers come only from `match-reference.md` (economy, shop odds, damage/PP/speed, rows, the ten Silk Scarf items, …). If something is not in it, the answer says so and offers to investigate after the match.
- **RESEARCH** (a direct mechanics question, or "research: …") allows bounded read-only source inspection at the pinned revision without asking permission to read files; what it newly reads is labelled unreviewed. See ASK.md → Answering modes.
- No response-time guarantee is made for either mode. If you want full detail from the first session type (index first), use the longer instruction above instead.

## Questions you can ask now
- "What are Charizard's base stats, and what does its ability do?" *(covered: baseline + reviewed Blast Burn, raw amounts)*
- "How does Pikachu decide between Raichu and Alolan Raichu?"
- "Can Totodile or Vespiquen show up in my shop at level 5?"
- "I have 37 gold after a round and I'm on my third win in a row — how much income do I get, and what does buying XP do?"
- "How much damage does a 20-ATK physical hit do to a unit with 10 DEF?"
- "When does a unit cast, and how fast does it attack with speed 57?"
- "Which row gives Vespiquen which mode?" and "Do bench units count for synergies?"
- "Does a Shiny Stone on my Cosmoem help it become Solgaleo?"
- Limits are part of the design — you can also ask "what does Pikachu's Nuzzle do?" (answer: not covered), "what's the best comp right now?" (answer: not something the source can tell), or "is this the live version?" (answer: unverified).

Worked examples with sources: [analysis/first-version-question-checks.md](analysis/first-version-question-checks.md) (a curated check by the same author as the notes — not independent proof of accuracy).

## What is covered / not covered
See the index: [knowledge/07367c34/index.md](knowledge/07367c34/index.md). In short: 1183 unit baselines; evolution for 20 units; 3 reviewed ability records; normal-path economy, leveling and shop; a primer on damage, PP, attack speed, rows, synergies and items; all item recipes and declared item stats, and traced effects of all 55 craftable recipe outputs ([item-effects.md](knowledge/07367c34/item-effects.md); Silk Scarf [guide](knowledge/07367c34/silk-scarf-items.md)); a condensed [match-reference](knowledge/07367c34/match-reference.md). Not covered: most abilities and all passives, special rules/modes, effects of consumables/tools/special items (all 55 craftable recipe outputs, Eviolite and Shiny Stone are covered), live-game behavior, meta or win rates.

## Updating later (do not do this as part of asking questions)
Syncing your fork with upstream **does not regenerate** any of this knowledge — the data and notes are frozen at the pinned revision.
1. **Keep** the existing `data/07367c34/` and `knowledge/07367c34/` as a pinned historical snapshot; never overwrite it.
2. **Identify the intended new revision** (a specific commit, e.g. the new head of upstream `prod`, or a commit the host operator confirms is deployed). Deployment cannot be read from the repository.
3. **Compare the relevant source changes** between the pinned SHA and the new one (the files cited in the notes/records are the checklist); see `analysis/version-alignment.md` and `analysis/pilot-baseline-comparison.md` for the earlier approach.
4. **Regenerate the affected data** with the extractors/probes in `assistant/` in a disposable worktree of the new SHA (see README), into a new `data/<sha8>/` and `knowledge/<sha8>/`.
5. **Review the affected explanations** (anything whose cited lines moved or changed), re-run the validators, and only then point `ASK.md`/the index at the new revision.
