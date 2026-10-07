# Version alignment: audited snapshot vs. production reference

- **Audited snapshot commit:** `01a3e845e91ebe3144b3c43fa9cd261a5dadafd2` ("revert cosmog and cosmoem passive buffs", 2026-10-05 01:08 +02:00).
- **Checked:** 2026-10-07 ~05:40 UTC, from this sandbox. Upstream refs were fetched read-only into temporary refs (since deleted), nothing merged, no tracked game file changed, no login, no server, no match, no regeneration of knowledge files.
- **Labels used below:** **CONFIRMED** (read directly from a ref or file, reproducible with the commands in the appendix) · **INFERENCE** (reasoned from confirmed facts) · **UNKNOWN** (could not be established from the sources I was allowed to check).

## Inspected SHAs
| Role | Ref (upstream `https://github.com/keldaanCommunity/pokemonAutoChess.git`) | SHA | Date | `package.json` version |
|---|---|---|---|---|
| Audited snapshot | `refs/heads/master` at check time | `01a3e845e91ebe3144b3c43fa9cd261a5dadafd2` | 2026-10-05 | `6.11` |
| Production-deployment ref | `refs/heads/prod` | `07367c341fe928763da2b565c2eee010433e4fc1` ("Merge pull request #4151 … fix-synergy-items-and-transform") | 2026-10-05 00:14 +02:00 | `6.11.1` |
| prod's first parent | (ancestor of both) | `1fa03649463e16015f4049f8250c2a60c95ff8b5` ("Revert 'fix black belt …'") | 2026-09-26 | `6.11.1` |
| Merged hotfix (second parent of prod head) | (ancestor of both) | `9d3353a63…` ("hotfix synergy items and transform") | 2026-10-05 | — |
| Release tag | `refs/tags/6.11` | `5f1cbadc11d59aad9ba9e6b3b8b6300a19b3d77d` ("add double up to patch notes") | 2026-08-16 | `6.11` |
| Older refs seen | tag `6.10` `f0b68d4b3…`; branch `v6.10.2` `56e4d322d…`; branch `v7` `ee5ea64a1…` (not inspected further) | | | |

## Answers

### 1. Which branch/tag/revision is configured for production deployment?
- **CONFIRMED:** the pm2 deploy configuration sets `ref: "origin/prod"` and `repo: "https://github.com/keldaanCommunity/pokemonAutoChess.git"` (`ecosystem.config.js:8–9`, identical at the audited commit and at `prod`); post-deploy runs `npm run build-prod` on Node 24.19.0 (`:11–12`). Deployment is invoked per host with `pm2 deploy production-N update` via `npm run deploy-live-1…4` / `deploy-live` (`package.json:54–58`); the hosts come from the `DEPLOY_HOSTS` environment variable (`ecosystem.config.js:5`), which is not public.
- **CONFIRMED:** the repository's own deployment guide says `master` "is the development branch … including those for next release" and `prod` "contains the actual state of production branch of pokemon-auto-chess.com" (`deployment/README.md:47–50`).
- **CONFIRMED:** the GitHub workflows do **not** deploy: `main.yaml` only builds on `push` to `master` (`.github/workflows/main.yaml:3–6`), `build-pr.yml` builds PRs to `master`; the `prod` branch carries the same workflows.
- **UNKNOWN:** which hosts are configured and how often/when `deploy-live` is run.

### 2. Is the exact deployed source commit publicly identifiable?
**No, not from the sources I could check. UNKNOWN.**
- **CONFIRMED:** the web client shows only the `package.json` version (`app/public/src/pages/auth.tsx:104` `V{pkg.version}`; `main-sidebar.tsx:165` `v{version}`); the client build injects only Firebase/Discord/player-count env values via `define` (`esbuild.js:46–`), no commit or build id; no commit/sha variable appears in `esbuild.js`, `app/index.ts`, `package.json`, `ecosystem.config.js` or `Dockerfile` at `prod`. The same version-display code exists on `prod`.
- **CONFIRMED:** deployment is a manual `pm2 deploy` of whatever `origin/prod` points to at that moment, on each host; a push to `prod` does not itself deploy (no workflow does), so **the `prod` head is not proof of what is running.**
- **UNKNOWN (not checkable here):** GitHub Releases/Deployments metadata for the upstream repo (the GitHub API for that repository is not enabled in this session; I did not work around it) and the production site itself (`https://pokemon-auto-chess.com/` returned a proxy 403 from this sandbox; I did not work around it). Even if reachable, the client exposes only the version string, so these would not obviously yield a SHA.
- Per instructions, I stopped looking for the deployed SHA after these official sources.

### 3. How does the audited commit relate to the production/release reference?
- **CONFIRMED (graph facts):**
  - At check time upstream `master` **is** the audited commit (`git ls-remote … HEAD` and `refs/heads/master` both `01a3e845…`).
  - `prod` (`07367c34…`) is a **merge** of `1fa03649…` and `9d3353a63…`; **both parents are ancestors of the audited commit**, but `prod` itself is **not** an ancestor of it, and the audited commit is not an ancestor of `prod`. Merge-base = `9d3353a63…`.
  - The audited commit has **269 commits `prod` lacks**; `prod` has **1** commit the audited one lacks (the merge commit `07367c34` itself). Overall diff `prod → audited`: 297 files, +10 152/−6 386 lines.
  - Tag `6.11` is an ancestor of the audited commit (290 commits behind) but **not** of `prod` (`prod` lacks 30 commits of the tag's history and has 52 beyond it): `prod` is a curated lineage (selected fixes merged), not a linear chain of `master`.
  - `master` is 54 minutes newer than `prod` (the audited commit came after the hotfix merge into `prod`); the only thing the audited commit adds on top of the hotfix merge into `master` (`a4412af7a`) is the Cosmog/Cosmoem revert.
- **CONFIRMED (version strings are not informative):** `prod` says `6.11.1`, the audited commit and tag `6.11` say `6.11`. The value `6.11.1` was introduced by `76bcd8dde` (2026-08-19, "nerf porygon and add 6.11.1 patchnotes", in both histories) and the version line was changed back to `6.11` on `master` by merge `42be7125d` (2026-08-30; `git log -G'"version":'`; cause not investigated). So `master` contains 6.11.1 content under a lower version number.
- **INFERENCE:** the audited commit is a **development (`master`) snapshot that includes unreleased post-6.11.1 work**, not the production branch. Supporting facts: the audited tree already contains a draft changelog `app/public/dist/client/changelog/patch-6.12.md` that `prod` lacks (`prod` has `patch-6.11.1.md` as its newest), and `master`'s own deployment guide calls `master` the development branch.

### 4. Does the pilot contain development changes absent from the production reference?
**Yes — CONFIRMED for three of the 20 units, plus shared code.** Comparison is `prod` head `07367c34` vs. the audited commit, by textual comparison of the class blocks and code blocks my data and notes depend on (method in the appendix). It compares text, not behaviour, and it does not show what the deployed server runs (see 2).

**Unit data (`pilot-units.json` / `pilot-evolution.json`):**
| Unit | `prod` head | Audited snapshot (our data) | Source (audited tree) |
|---|---|---|---|
| UNOWN_D | `maxPP = 100` | `maxPP = 50` | `patch-6.12.md:30` "Rework Unown-D … PP 100 → 50"; commit `92ebe801c` "rework unowns" (not in `prod`) |
| TOTODILE | `skill = Ability.CRUNCH` | `skill = Ability.BITE` | `patch-6.12.md:27` "Change ability of Totodile line to Bite instead of Crunch"; commit `8e732191c` "rework bite and pursuit" (not in `prod`) |
| COSMOEM | `hp = 220`, `stacksRequired = 8`, `onAcquired`: `hp -= 80` | `hp = 200`, `stacksRequired = 10`, `hp -= 100` | `patch-6.12.md:37` (Cosmog/Cosmoem revert, stacks `8 → 10`; its HP wording lists the numbers in the opposite direction to the code, so use the code); commit `01a3e845e` itself (not in `prod`) |

- COSMOG (not a pilot unit, but on COSMOEM's evolution path) also differs: `prod` `hp = 140`, `stacksRequired = 8`; audited `hp = 100`, `stacksRequired = 10`. This affects the COSMOEM acquired-HP discussion in `knowledge/pilot-evolution.md` (the `−100`/`100` numbers are audited-snapshot values; `prod` has `−80`/`140`).
- **CONFIRMED identical (class text, `PokemonClasses` registry line and `PkmIndex`/family enum lines) on both sides for the other 17 units:** CHARMANDER, CHARMELEON, CHARIZARD, PIKACHU, RAICHU, ALOLAN_RAICHU, GALAR_MEOWTH, VESPIQUEN, ARCEUS, MAGIKARP, GYARADOS, TYPE_NULL, PRIMEAPE, TEPIG, DITTO, FARFETCH_D, SUBSTITUTE (+ MANKEY, the PRIMEAPE family root). The base `Pokemon` class changed, but **no `@type` stat default or stat-like field** (hp, atk, def, speDef, speed, range, maxPP, crit*, ap, luck, stars, rarity, skill, passive, evolution, evolutionRule) differs; the differences are added `baseAtk`/`cook` fields, `postConstructor` copying `baseAtk`, `canEat` excluding Tatsugiris, and item add/remove methods removed from the class. `app/models/pokemon-factory.ts`, `app/config/game/battle.ts` (`DEFAULT_SPEED`/crit defaults), `Synergy.ts` and `Rarity.ts` are identical.
- **INFERENCE:** the extractor requires `baseAtk` (`stats.baseAtk`), a field that exists only on the audited side, so the current extractor would fail validation if pointed at a `prod` checkout; a prod snapshot would need the extractor to tolerate that. Not tested.

**Code paths behind the evolution/context notes (what the notes interpret):**
| Block | Result |
|---|---|
| `count-/item-/stack-/state-/money-/placement-/hatch-evolution-handler.ts`, `evolution-handler.ts`, `hatch-time.ts` | identical |
| `Item.ts` `SynergyItemsNoSpecial`, `MemoryDiscs`, `SynergyItems`, `SynergyGivenByItem` (TYPE_NULL's 55-item table input) | identical |
| `pokemon-entity.ts` `addStack`; `passives.ts` `addPrimeapeStack`, `[Passive.PRIMEAPE]`, `[Passive.VESPIQUEN]`; `effects/synergies.ts` Vespiquen clone; `game-room.ts` `checkEvolutionsAfterPokemonAcquired` / `…AfterItemAcquired` | identical |
| `evolution-manager.ts` `afterEvolve` | **differs in structure:** on `prod` the Cosmog/Cosmoem "+10 max HP, +1 stack, tryEvolve" logic is inline in `afterEvolve`; at the audited commit it moved to a registered on-evolution hook (`evolution-hooks.ts`, new; `passives.ts` hook cited in my notes). The logic text matches, so the notes' behavioural reading looks applicable, but their file/line citations are audited-only. |
| `player.ts` `transformPokemon` | **differs in one line:** `prod` re-adds items with `newPokemon.addItem(item, this)`, audited with `equipItem(newPokemon, item, this)`; the `onAcquired` call is unchanged, so "onAcquired is called on Cosmog→Cosmoem" holds for both by reading. The `equipItem` vs `addItem` HP effects (an unresolved path in my notes) are therefore different code on each side. |
| `models/colyseus-models/synergies.ts` Arceus dynamic-synergy block | **differs:** audited orders synergies with `sortSynergies(...)` (the changelog notes the ordering rule changed, `patch-6.12.md:42`); `prod` sorts inline by count. Arceus's *bare* values are identical; its in-play types may differ. |
| `models/shop.ts`, `config/game/shop.ts` | **differ** (e.g. generic sell-price formula, Ditto shop rate `0.5% + 0.01%/reroll`, `patch-6.12.md:62`); the shop-related context notes for MAGIKARP/DITTO/ARCEUS are audited-snapshot statements. |
| `Player` constructor `lightX/lightY` assignment | same assignments on both sides (line numbers shifted) |

**Consistency check (not parity):** Gyarados's class values (`def 6`, `speDef 5`) match the 6.11.1 changelog on `prod` ("DEF 9 → 6; SPE_DEF 2 → 5"), i.e. the snapshot includes that midpatch for this unit. That says nothing about the deployed commit.

## What is and is not established
- **Established:** the production deploy ref is `prod`; the audited commit is `master`'s head, a development snapshot ahead of `prod` by 269 commits (and not containing `prod`'s merge commit); 17 of 20 pilot unit classes and the evolution handlers/tables match `prod` head textually; UNOWN_D, TOTODILE and COSMOEM do not.
- **Not established:** the SHA of the deployed server; whether `prod` head `07367c34` is what is currently deployed; behaviour in the live game. A matching version number, `prod` head, or matching stats would not prove any of these, and none is claimed.
- **Limits of this check:** textual comparison of selected paths only; no extraction was run against `prod`; non-pilot units and shared mechanics (items, combat) were not compared; GitHub Releases/Deployments and the production site were inaccessible.

## Recommendation
**Continue using the current snapshot, explicitly labelled as the development (`master`) snapshot at `01a3e845…`, and do not extract a "release" snapshot yet.** Reasons: there is no verifiable release SHA to extract (the deployed commit is unknown), `prod` head is only a *candidate* production reference, and 17/20 pilot units already match it. When the lookup is used for questions about the live game, treat the three known divergent units (UNOWN_D, TOTODILE, COSMOEM) and the notes' COSMOEM/Arceus/shop statements as development-only.

If production relevance becomes the goal, the **one specific missing piece of evidence** to obtain is the **deployed commit hash** from whoever runs `pm2 deploy` (e.g. `git rev-parse HEAD` in the deploy checkout on a host, or the deploy log). Only then extract a separate snapshot of that exact commit (which needs the extractor to tolerate the `baseAtk` difference), kept apart from this one. Until then, a snapshot of `prod` head `07367c34…` could be extracted as a *candidate* snapshot labelled "branch head, deployment unverified", but that is optional and not needed to keep using this pilot.

## Appendix: how this was checked
```bash
U=https://github.com/keldaanCommunity/pokemonAutoChess.git
git ls-remote --heads $U ; git ls-remote --tags --refs $U ; git ls-remote $U HEAD
git fetch --no-tags $U +refs/heads/master:refs/tmp/upstream-inspect/master +refs/heads/prod:refs/tmp/upstream-inspect/prod \
  +refs/heads/v6.10.2:refs/tmp/upstream-inspect/v6.10.2 +refs/tags/6.11:refs/tmp/upstream-inspect/tag-6.11 +refs/tags/6.10:refs/tmp/upstream-inspect/tag-6.10
A=01a3e845e91ebe3144b3c43fa9cd261a5dadafd2; P=refs/tmp/upstream-inspect/prod
git merge-base $A $P; git merge-base --is-ancestor $P $A; git rev-list --count $P..$A; git rev-list --count $A..$P
git diff --numstat $P $A -- <pilot-relevant paths>      # pokemon.ts, pokemon-factory.ts, enums, evolution-logic/, player.ts, passives.ts, items.ts, …
git diff $P $A -- app/core/evolution-logic/evolution-manager.ts ecosystem.config.js
git log -L'/^export class Cosmoem extends/,/^}/:app/models/colyseus-models/pokemon.ts' -s $P..$A      # also Cosmog, Totodile, UnownD
# class/registry/enum-line comparison for the 20 keys and block comparisons for the functions listed above were done with two one-off
# scripts that extract `export class X extends … }` / named blocks from `git show <rev>:<file>` and compare the text.
git for-each-ref --format='%(refname)' refs/tmp/upstream-inspect | xargs -n1 git update-ref -d   # temporary refs removed afterwards
```
