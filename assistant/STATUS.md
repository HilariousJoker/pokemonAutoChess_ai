# Baseline extraction checkpoint — status (hardened)

Scope (cumulative): (1) the three-unit checkpoint (CHARMANDER, FARFETCH_D, VESPIQUEN; `data/baseline.json`),
(2) a 20-unit bare-instance pilot (`data/01a3e845/pilot-units.json`, `knowledge/pilot-units.md`), and
(3) evolution declarations for the same 20 units (`data/01a3e845/pilot-evolution.json`, `knowledge/pilot-evolution.md`).
(4) packaging for lookup (and, later, a guard correction + version-alignment report): `lookup-unit.mjs`, `README.md`, output-path guards and stricter evolution probes (section "Packaging step" below).
No catalog, upstream parity, schemas, items/synergies, server, combat, live-game interaction or Obsidian work.

## Two different commits — do not conflate
| | SHA | Meaning |
|---|---|---|
| **Audited game-source commit** | `01a3e845e91ebe3144b3c43fa9cd261a5dadafd2` | The upstream game revision the data describes. |
| **Checkout commit** | whatever `git rev-parse HEAD` is when the extractor runs (recorded in `provenance.checkoutCommit`) | A commit on `claude/great-volta-v6znve` that adds `assistant/` on top of the audited source. |

The extractor measures this instead of asserting it: it diffs the working tree against the audited commit for
everything **outside `assistant/`** (tracked differences and untracked files) and refuses to run if they differ,
unless `--allow-source-mismatch` is given (then the differences are recorded). `baseline.json` records
`checkoutCommit`, `checkoutIsAuditedCommit`, `gameSourceMatchesAudited`, `differingTrackedFiles`,
`untrackedOutsideAssistant`, `dirtyOutsideAssistant`, `dirtyInsideAssistant`, and the actual `node` / `npm` versions.
At generation time of the committed `baseline.json`, game source matched the audited commit (no differing or
untracked files outside `assistant/`); `dirtyInsideAssistant` lists the not-yet-committed hardening changes.

## Environment that produced the committed data
- Node `v24.21.0` (official tarball from nodejs.org, SHA-256 verified against `SHASUMS256.txt`), npm `11.19.0`, linux-x64.
  `package.json` requires Node `>=24.19.0` — satisfied.
- `npm ci --ignore-scripts --no-audit --no-fund` against the **committed, unmodified** `package-lock.json`:
  **succeeded** (818 packages, exit 0). Evidence: `repro/npm-ci.log`, `repro/install-provenance.json`.
  No `npm install` fallback was needed, so no resolved lockfile was produced or saved.

## Earlier failure (historical) and what it was
The first checkpoint ran on Node 22.22.0 / npm 10.9.4, where `npm ci` **failed** (EUSAGE: lock out of sync; missing
`gcp-metadata@7.0.1`, `gaxios@7.3.1`, `node-fetch@3.3.2`, `data-uri-to-buffer@4.0.1`) and an `npm install --ignore-scripts`
fallback was used; its lockfile diff is `lockfile-drift.patch`. Since the same lockfile installs cleanly with
`npm ci` under npm 11.19.0, that failure was specific to the old toolchain (npm 10.9.4 / Node 22). The patch is
kept only as a record of that fallback; it is **not** a defect of the committed lockfile as far as tested here.
The exact npm-10 error text was not saved at the time; the list above is from that session.

## Output layout (`data/baseline.json`)
Identity, family root and bare-instance evolution fields are kept separate:
- `pokemon[KEY].identity` — `{key, name, index}`: **the unit itself** (verified: factory `name` equals `Pkm[key]`, `index` equals `PkmIndex`).
- `pokemon[KEY].evolutionFamilyRoot` — result of `getPokemonBaseline()`; the root of the evolution family, **not** the unit's identity (VESPIQUEN → `COMBEE`).
- `pokemon[KEY].bareInstanceEvolution` — raw `evolution` / `evolutions` of a bare factory instance. **These do not form a complete evolution map.**
  `evolution` is the single default next stage declared on the class (`DEFAULT` for VESPIQUEN, FARFETCH_D and also PIKACHU); `evolutions` is non-empty only for classes that
  declare branching targets in the class body (PIKACHU → RAICHU, ALOLAN_RAICHU; COSMOEM → SOLGALEO, LUNALA), and is `[]` otherwise (e.g. CHARMANDER, TYPE_NULL).
  `evolutionRule` (counts, items, `divergentEvolution` callbacks, e.g. TYPE_NULL → many `SILVALLY_*`) is not extracted. Do not derive evolution trees from these fields.
  (Correction: the first checkpoint's wording "filled elsewhere" was inaccurate; the 20-unit pilot showed it is class-declared.)
- `pokemon[KEY].types`, `.stats` — types and numeric/string/boolean stat fields.
- `provenance` — environment-dependent; compare `pokemon` only.
(v1 layout, commit `1f9ee28`, was flat and called the family root `baseline`.)

## Checks actually run (all in a disposable worktree of `1f9ee28` + these changes, Node 24.21.0 / npm 11.19.0)
| Check | Result |
|---|---|
| `npm ci --ignore-scripts` with committed lockfile | OK, exit 0; `package-lock.json` unmodified |
| Extraction run twice (`--out` and `--out=` forms, `repro/run1.json`, `run2.json`) | `pokemon` payloads identical (byte-identical JSON) |
| New payload vs committed v1 checkpoint (`compare-payloads.mjs`, layout-normalised) | **No value differences**, incl. `evolution`/`evolutions`/family root |
| Unknown key `NOTAPOKEMON`; prototype keys `toString`, `__proto__`; duplicate key; unknown flag | each rejected, exit 1, nothing written |
| Alternate units without `--out`, and with `--out` = default checkpoint path | refused, default checkpoint untouched |
| Alternate units with `--out` into a not-yet-existing nested directory (`repro/new/nested/alt.json`) | OK, directory created |
| Tracked game file modified (temp edit, reverted) / untracked file outside `assistant/` | refused; with `--allow-source-mismatch` recorded as `gameSourceMatchesAudited:false` + file list |
| Non-finite value (temp edit `hp = NaN`, reverted) | rejected: `CHARMANDER.hp must be a finite number, got NaN` |
| Wrong identity (temp edit makes factory return MissingNo, reverted) | rejected: factory returned name `DEFAULT` |

Missing-required-field and non-finite checks cover the listed stat fields; they were exercised by the NaN case only
(other missing-field branches share the same code but were not each triggered).

## Results (unchanged from v1)
| Pkm | family root | rarity | stars | hp | atk | def/speDef | speed | range | maxPP | skill | passive | types |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CHARMANDER | CHARMANDER | COMMON | 1 | 60 | 4 | 3/3 | 57 | 1 | 100 | BLAST_BURN | NONE | DRAGON, FIRE |
| FARFETCH_D | FARFETCH_D | UNIQUE | 3 | 200 | 20 | 8/8 | 50 | 1 | 60 | RAZOR_WIND | NONE | FLYING, GOURMET, NORMAL |
| VESPIQUEN | **COMBEE** | UNIQUE | 3 | 190 | 16 | 8/8 | 38 | 3 | 90 | VESPIQUEN_ORDERS | VESPIQUEN | BUG, FLORA, GOURMET |

## 20-unit knowledge pilot (previous step)
Files: `data/01a3e845/pilot-units.json` (data), `knowledge/pilot-units.md` (notes, table, source cross-check), `knowledge/make-pilot-table.mjs` (table generator).
The three-unit checkpoint (`data/baseline.json`) is untouched. (Evolution data: see the next section.)

Exact commands, run in a disposable worktree `/home/user/pac_repro` at `fcba0b4` (Node 24.21.0 / npm 11.19.0, existing `node_modules`, no reinstall;
`PATH` had `/tmp/claude-0/node24/node-v24.21.0-linux-x64/bin` first):
```bash
KEYS="CHARMANDER CHARMELEON CHARIZARD PIKACHU RAICHU ALOLAN_RAICHU GALAR_MEOWTH VESPIQUEN ARCEUS MAGIKARP GYARADOS TYPE_NULL PRIMEAPE TEPIG DITTO UNOWN_D FARFETCH_D TOTODILE COSMOEM SUBSTITUTE"
node_modules/.bin/tsx assistant/extract-baseline.ts --out assistant/data/01a3e845/pilot-units.json $KEYS
node_modules/.bin/tsx assistant/extract-baseline.ts --out <scratch>/pilot-run2.json $KEYS
node assistant/compare-payloads.mjs assistant/data/01a3e845/pilot-units.json <scratch>/pilot-run2.json
node assistant/knowledge/make-pilot-table.mjs            # table pasted into knowledge/pilot-units.md
```
Outputs / checks:
| Check | Result |
|---|---|
| Both extraction runs | exit 0 for all 20 keys; no identity/validation failure; `--allow-source-mismatch` **not** used; provenance: `gameSourceMatchesAudited=true`, no dirty files outside or inside `assistant/` |
| Payload comparison | `IDENTICAL payloads (20 units)` |
| Key set | exactly the 20 requested keys, same order, no extras, no duplicates (checked with a one-off `node -e`) |
| Failures / partial file | none, so no partial-progress file exists |
| Table | regenerated from the JSON and diffed against the notes: identical |
| Source cross-check (CHARMANDER, FARFETCH_D, VESPIQUEN, ARCEUS, COSMOEM) | HP, attack, speed, types, skill all match the class definitions in `app/models/colyseus-models/pokemon.ts`; FARFETCH_D speed 50 is the inherited `DEFAULT_SPEED`; ARCEUS types are empty on a bare instance. No discrepancies. Details and line numbers in `knowledge/pilot-units.md` |

Limitations of this step:
- Bare-instance values only: not live-game values; **live-game parity is unverified** (no comparison with the game, upstream, wiki or patch notes).
- The cross-check is a manual read of five classes, the base class and the factory, not an automated test; the other 15 units were not independently read.
- Context notes (VESPIQUEN, ARCEUS, COSMOEM, TYPE_NULL, MAGIKARP) list what code establishes and what stays untested (ability implementations, passives with no `PassiveEffects` entry for TYPE_NULL/MAGIKARP). The evolution-manager and COSMOEM `onAcquired` questions were left open here and are answered in the next section.
- Items, synergies, abilities and combat were not extracted; only one toolchain was used (Node 24.21.0, linux-x64). (Evolution declarations: next section.)

(The "suggested next step" of this pilot step — extract the `evolutionRule` shape for the same 20 units — is what the next section does.)

## 20-unit evolution extension (previous step)
Files: `extract-evolution.ts` (extractor; same provenance/validation approach as `extract-baseline.ts`), `data/01a3e845/pilot-evolution.json` (data),
`knowledge/pilot-evolution.md` (source-backed notes; tables generated by `knowledge/make-pilot-table.mjs --evolution` / `--type-null-map`),
`compare-payloads.mjs` (now also compares `units`+`probes` payloads). Baseline JSONs (`baseline.json`, `pilot-units.json`) are unchanged.
Also in this step: `extract-baseline.ts` comment corrected (the "`evolutions` is populated elsewhere" wording was wrong: it is class-declared and non-empty only for branching classes such as PIKACHU/COSMOEM; no behaviour change),
`pilot-units.md` SUBSTITUTE wording corrected (skill identifier is `Ability.DEFAULT`; not assumed to mean "no ability"), and the stale "three units only" scope wording above.

What the extractor records: per unit `declaredEvolution` (`evolution`, `evolutions`, `stacksRequired`), `evolutionRule` (type, handler class/file, every possible rule property as `{present:false}` or `{present:true,kind,value}`, so missing ≠ 0/false/`[]`;
functions become `{kind:"callback", arity, source:{file,symbol,line}}` and are never silently dropped by JSON), `matchesInheritedBaseDefault`, and a separate `evolutionEvidence` (inherited default rules on terminal units are not evidence of evolution).
`probes` call two callbacks (TYPE_NULL over all 55 trigger items; PIKACHU with two stub players) because their bodies were read and use only those inputs. A final walk fails the run if anything undefined/function/non-finite would reach the JSON.

Exact commands, run in the disposable worktree `/home/user/pac_repro` at `c3f7c40` plus these uncommitted `assistant/` changes (Node 24.21.0 / npm 11.19.0, existing `node_modules`, no reinstall; `PATH` had `/tmp/claude-0/node24/node-v24.21.0-linux-x64/bin` first):
```bash
node_modules/.bin/tsx assistant/extract-evolution.ts --out assistant/data/01a3e845/pilot-evolution.json   # default set = keys of pilot-units.json
node_modules/.bin/tsx assistant/extract-evolution.ts --out <scratch>/evo-run2.json
node assistant/compare-payloads.mjs assistant/data/01a3e845/pilot-evolution.json <scratch>/evo-run2.json
node assistant/knowledge/make-pilot-table.mjs --evolution        # table -> pilot-evolution.md
node assistant/knowledge/make-pilot-table.mjs --type-null-map    # TYPE_NULL mapping -> pilot-evolution.md
```
Checks and outputs:
| Check | Result |
|---|---|
| Both runs | exit 0, 20 units, `gameSourceMatchesAudited=true`, `--allow-source-mismatch` **not** used; no tracked/untracked file outside `assistant/` differs from the audited commit |
| Payload comparison (`compare-payloads.mjs`) | `IDENTICAL evolution payloads (20 units + probes)` (the `provenance` blocks differ only because run 2 sees run 1's output as an untracked file) |
| Key set | exactly the 20 pilot keys, same order as `pilot-units.json`, no duplicates |
| Unknown key `NOTAPOKEMON`, `__proto__`; duplicate key | rejected, exit 1 |
| Explicit key list without `--out` / with `--out` = default path | refused, default output untouched |
| Alternate units (`MAGIKARP PIKACHU`) with `--out` into a new nested directory | OK; their unit records equal the pilot file's |
| Source drift (temp edit of a tracked game file; untracked file under `app/`), reverted | refused; message names the file |
| Rule validation (temp edits, reverted): MAGIKARP `numberRequired: 0`; TYPE_NULL `itemsTriggeringEvolution: 5` | each rejected with a specific message |
| Regression after the comment-only edit to `extract-baseline.ts` | 3-unit and 20-unit baseline payloads still `IDENTICAL` to the committed files |
| Game files / `package.json` / lockfile | no changes (`git status` on `app`, `package.json`, `package-lock.json` empty after temp edits were reverted) |

Findings (details and source lines in `knowledge/pilot-evolution.md`; each item is tagged declared / by inspection / not tested there):
- MAGIKARP: `COUNT` with `numberRequired: 8` (declared); `CountEvolutionHandler.canEvolve` counts same-name, non-Eviolite units in `player.board` (bench included) `>= 8`; `evolve` removes the first 8 and calls `onAcquired` on the Gyarados.
- PIKACHU: `COUNT/3` + `divergentEvolution` callback; Alolan Raichu iff `player.regionalPokemons` contains `ALOLAN_RAICHU` (probe confirms both branches); what fills `regionalPokemons` is **unresolved**.
- TYPE_NULL: `ITEM` rule over 55 `SynergyItems`; complete item → variant table from the real callback (18 outcomes, 9 items fall through to plain `SILVALLY`); trigger path `checkEvolutionsAfterItemAcquired` → `ItemEvolutionHandler`.
- PRIMEAPE: `STACK`, `stacksRequired 10`; stacks come from `OnDeathEffect`/`OnResurrectingEffect` → `addPrimeapeStack` → `PokemonEntity.addStack`, which calls `tryEvolve` only when `stacks === stacksRequired` (strict) and the handler checks `stacks >= stacksRequired`.
- COSMOEM: branch = on the player's light cell **and** a Light tier active → `SOLGALEO`, else `LUNALA`; **`onAcquired` is called on the Cosmog→Cosmoem path** (`player.ts:356` via `transformPokemon`); a universal acquired HP is **not** claimed (formula depends on the Cosmog's `maxHP` at evolution time and untraced `equipItem` effects).

Limitations of this step:
- Everything "by inspection" was read from source and **not executed in the game**; the only executed behaviour is the two stub-argument probes. Live-game parity is unverified.
- Unresolved paths (stopped tracing): how `Player.regionalPokemons` is computed; what sets `state.lightX/lightY`; which events dispatch the PRIMEAPE death/resurrect effects and stack overshoot past 10; `equipItem` HP effects; `items.ts:1612–1640` forced-transform path; other COSMOG stack sources.
- Only the 20 pilot units; TEPIG's `HATCH` rule is extracted but not interpreted; `evolutionRule` for non-pilot units, `Stat` effects of items and the rest of the catalog were not touched.
- `matchesInheritedBaseDefault` cannot distinguish an inherited rule from a class that redeclares an identical one; callback source lines are text-search results in `pokemon.ts`, not parsed.
- One toolchain only (Node 24.21.0, linux-x64). No remaining-credit information is available in this session, so no dollar limit was or could be enforced.

**Suggested next step:** pick one unresolved path that gates a pilot unit (PIKACHU's `regionalPokemons` computation or COSMOEM's `equipItem`/HP path) and settle it by a short, targeted read; then do a live-game spot-check of 2–3 units before widening beyond the pilot. Defer the full catalog until then.

## Packaging step: lookup tool, README, output guards, stricter probes (previous step)
Files: `lookup-unit.mjs`, `README.md` (overview; links to data/notes/this file, no duplicated stat tables), `output-guard.ts` (shared by both extractors), edits to `extract-baseline.ts` / `extract-evolution.ts`.
(The guard lives in `assistant/output-guard.ts`, not `assistant/lib/`, because the root `.gitignore` ignores any `lib` directory and `.gitignore` was not to be changed.)
Local housekeeping done as authorised: the exact line `assistant/data/npm-install.log` was added to `.git/info/exclude` (local only; the log is not committed, `.gitignore` unchanged).

What changed:
- **Output guard** (runs before anything is extracted, created or written): output must be `.json`; refused if it is inside the repository but outside `assistant/` (game source, precomputed data such as `app/models/precomputed/*.json`, root config such as `package.json`/`tsconfig.json`/`biome.json`), if it is the **other** extractor's checkpoint, if it is some other git-tracked file under `assistant/`, if it is a non-regular file, or if it reaches any of these through a symlink (real path checked too). Allowed: each extractor's own checkpoints (`baseline.json` + `pilot-units.json` for the baseline extractor; `pilot-evolution.json` for the evolution extractor) and scratch `.json` files (outside the repo, or new files under `assistant/`). Extra: the baseline extractor refuses to overwrite an existing own checkpoint with a different unit set.
- **Probes**: any exception while calling a callback fails the extraction (`probe TYPE_NULL item SHED_SHELL threw: …`); every successful result must be an actual `Pkm` identifier; a requested TYPE_NULL/PIKACHU whose callback is missing fails. The JSON shape is unchanged, so existing payloads are byte-compatible. Stub probes remain labelled as such in `kind`/`note`; they are not gameplay behaviour.
- **`lookup-unit.mjs`**: reads the two pilot JSONs and the notes' headings only (imports only `node:fs`/`node:path`/`node:url`; no game code). Refuses (exit 3) different audited commits, a non-40-hex SHA, `gameSourceMatchesAudited != true`, differing unit sets, or an identity mismatch; exit 1 for a key outside the pilot (no guessing); exit 2 for usage/unreadable input. Prints identifiers only, no ability descriptions, acquisition stats or advice.

Checks actually run (disposable worktree `/home/user/pac_repro` at `443335f` + these uncommitted `assistant/` changes; Node 24.21.0 / npm 11.19.0; real exit codes where stated):
| Check | Result |
|---|---|
| Rejected outputs: `package.json`, `tsconfig.json`, `biome.json`, `app/models/precomputed/tracker.json`, new dir under `app/`, a `.ts` game file, `assistant/STATUS.md`, other extractor's checkpoint (both directions, incl. `pilot-units.json` from the evolution extractor), tracked `assistant/repro/run1.json`, symlinks to `package.json`/`baseline.json`/`tracker.json`, a directory named `*.json`, `pilot-units.json` with a different unit set | each refused with a specific message, exit 1; repository snapshot (`git status --untracked-files=all`, `git ls-files -s`, directory tree hash, hashes of root config/game files) **identical before and after** |
| Allowed outputs: scratch `.json` outside the repo; a new untracked file under `assistant/`; each extractor rewriting its own checkpoint (`baseline.json`, `pilot-units.json` with the same 20 keys, `pilot-evolution.json`) | exit 0 |
| Payloads after those reruns vs the committed originals (`compare-payloads.mjs` + section-level JSON equality of `pokemon` / `units` / `probes` / `baseDefaultRule`) | all identical; the worktree data files were then restored with `git checkout`, and the files committed here are the unchanged originals |
| Probe failures (temp edits to game source, reverted): TYPE_NULL callback throws; TYPE_NULL returns `"NOT_A_PKM"`; PIKACHU returns `undefined`; PIKACHU throws | each fails with a specific message, exit 1, no output file |
| Probe-missing branch (TYPE_NULL callback property renamed) | failed earlier on the generic "unexpected properties" validation, so the dedicated "expected a divergentEvolution callback" message was **not** isolated |
| `lookup-unit.mjs` on PIKACHU, TYPE_NULL, COSMOEM, CHARIZARD (terminal); `--list` | exit 0; CHARIZARD says the `count`/3 rule is inherited and **not** evidence of evolution; COSMOEM says its callback is present but not probed |
| Lookup of `BULBASAUR`, `pikachu`, `__proto__` | exit 1 "not covered"; no data shown |
| Lookup refusals (scratch copies): other audited SHA, short SHA, either snapshot with `gameSourceMatchesAudited=false`, missing provenance, 3-unit vs 20-unit baseline, missing unit, identity mismatch | exit 3 each; malformed/missing JSON, unknown flag, extra argument: exit 2 |
| Game files, `package.json`, lockfile | no changes (`git status` on them empty after temp edits were reverted) |

Limitations of this step: the guard only knows this repository; it cannot recognise game data in another checkout or protect arbitrary `.json` files outside the repo (those count as scratch). `.json` is required, so a rejected extension never reaches the other checks. The lookup links are built from headings that exist in the notes, so renaming a note heading silently drops that link (no link is invented). Everything about evidence strength and gaps is in `README.md`.

**Suggested next step:** settle one unresolved path that gates a pilot unit (PIKACHU's `regionalPokemons` computation or COSMOEM's `equipItem`/HP path) with a short targeted read, then spot-check 2–3 units in the live game; defer the catalog until then.

## Output-guard correction and version-alignment check (this step)
- **Guard fix** (`output-guard.ts`): `isInside` used `rel.startsWith("..")`, so a repo-root file such as `..odd.json` was treated as *outside* the repository and was **written** (reproduced in the disposable worktree, file then deleted). It now treats only `rel === ".."` or `rel` starting with `".." + path.sep` as outside. Verified in the disposable repo: `--out ..odd.json` / `./..odd.json` rejected by both extractors (exit 1, nothing created); an external scratch path and a `..`-named directory outside the repo still pass; `assistant/..scratch.json` (new, under `assistant/`) still allowed; `assistant/../package.json` still rejected. The full protection matrix was not repeated.
- **Version alignment** (details: `analysis/version-alignment.md`): production deploy ref is `origin/prod` (`ecosystem.config.js:8`); the audited commit is upstream `master`'s head (a development snapshot, 269 commits ahead of `prod` head `07367c341…` and not containing it); `prod` is a curated lineage (`package.json` 6.11.1 vs audited 6.11). The deployed SHA is **not publicly identifiable** from the sources checked (client shows only the version; deploys are manual `pm2 deploy`; GitHub releases/deployments API and the production site were inaccessible here). Of the 20 pilot units, 17 class definitions match `prod` head textually; **UNOWN_D (maxPP 50 vs 100), TOTODILE (BITE vs CRUNCH) and COSMOEM (hp 200/stacks 10 vs 220/8; COSMOG also differs) differ**, and a few mechanics blocks behind the notes differ (Cosmog hook location, `equipItem` vs `addItem`, Arceus synergy ordering, shop code). No extraction was run against `prod`; no knowledge files were regenerated.
- **Recommendation:** keep using this snapshot, explicitly labelled as the development (`master`) snapshot; do not extract a "release" snapshot until the deployed commit hash is obtained from the operator.

## Remaining limitations
- Verified on one toolchain only (Node 24.21.0 / npm 11.19.0, linux-x64); the minimum Node 24.19.0 and other platforms were not tried.
- Extraction covers only the three-unit checkpoint and the 20-unit pilot (baseline + evolution declarations); no typecheck, test suite, server start, or comparison against upstream/another data source.
- The payload equality checks compare this tooling with itself (two runs, and v1 vs v2); they do not prove the values are
  "correct" beyond agreeing with the class definitions in `app/models/colyseus-models/pokemon.ts`.
- Cause of the old npm-10 `npm ci` failure was not investigated beyond showing npm 11 installs the same lockfile.
- `repro/` holds sample outputs (`run1.json`, `run2.json`, `new/nested/alt.json`) as evidence; they are not authoritative data.
- No remaining-credit information is available in this session, so no dollar limit was or could be enforced.

## Continuation (works from a fresh checkout of this branch — the extractor is committed in `assistant/`)
```bash
git clone --branch claude/great-volta-v6znve https://github.com/HilariousJoker/pokemonAutoChess_ai pac && cd pac
# the audited commit must be reachable for the provenance check (a full clone has it; if shallow: git fetch --unshallow)

# Node >=24.19 (example: official tarball; verify the checksum against SHASUMS256.txt first)
#   https://nodejs.org/dist/latest-v24.x/  -> put bin/ on PATH, then check: node -v && npm -v

npm ci --ignore-scripts --no-audit --no-fund       # must leave package-lock.json unmodified
node_modules/.bin/tsx assistant/extract-baseline.ts                                   # default 3 units -> assistant/data/baseline.json
node_modules/.bin/tsx assistant/extract-baseline.ts --out /tmp/alt.json CHARMELEON CHARIZARD   # other units: --out is mandatory
node_modules/.bin/tsx assistant/extract-baseline.ts --out /tmp/new.json            # re-extract the default 3 units elsewhere
node assistant/compare-payloads.mjs assistant/data/baseline.json /tmp/new.json         # compare payloads (provenance ignored)
node assistant/knowledge/make-pilot-table.mjs                                          # pilot table from data/01a3e845/pilot-units.json
node_modules/.bin/tsx assistant/extract-evolution.ts --out /tmp/evo.json                # 20 pilot units' evolution data (default set = pilot-units.json keys)
node assistant/compare-payloads.mjs assistant/data/01a3e845/pilot-evolution.json /tmp/evo.json
node assistant/knowledge/make-pilot-table.mjs --evolution                              # evolution tables (and --type-null-map)
node assistant/lookup-unit.mjs PIKACHU                                                 # lookup card (no install needed; also --list)
```
If `npm ci` fails on a different toolchain, keep the exact error text, and only then consider one
`npm install --ignore-scripts` in a disposable worktree; save the resulting lockfile under `assistant/repro/` and
restore tracked files. Disposable worktrees used here (`/home/user/pac_repro`, `/home/user/pac_worktree`) are not part of the repo.
