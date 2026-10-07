# Baseline extraction checkpoint — status (hardened)

Scope: three units only — CHARMANDER, FARFETCH_D, VESPIQUEN. No catalog, upstream parity, schemas,
server, combat or Obsidian work.

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

## 20-unit knowledge pilot (this step)
Files: `data/01a3e845/pilot-units.json` (data), `knowledge/pilot-units.md` (notes, table, source cross-check), `knowledge/make-pilot-table.mjs` (table generator).
The three-unit checkpoint (`data/baseline.json`) is untouched.

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
- Context notes (VESPIQUEN, ARCEUS, COSMOEM, TYPE_NULL, MAGIKARP) list what code establishes and what stays untested (ability implementations, evolution manager, whether COSMOEM `onAcquired` runs on evolution, passives with no `PassiveEffects` entry for TYPE_NULL/MAGIKARP).
- Evolution maps, items, synergies, abilities and combat were not extracted; only one toolchain was used (Node 24.21.0, linux-x64).

**Suggested next step:** pick one narrow, verifiable follow-up before scaling, e.g. extract `evolutionRule` shape (type, `numberRequired`, `itemsTriggeringEvolution`, whether `divergentEvolution` exists) for the same 20 units so evolution is represented honestly; leave the full catalog until that and a live-game spot-check of 2–3 units are done.

## Remaining limitations
- Verified on one toolchain only (Node 24.21.0 / npm 11.19.0, linux-x64); the minimum Node 24.19.0 and other platforms were not tried.
- Extraction of three units only; no typecheck, test suite, server start, or comparison against upstream/another data source.
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
```
If `npm ci` fails on a different toolchain, keep the exact error text, and only then consider one
`npm install --ignore-scripts` in a disposable worktree; save the resulting lockfile under `assistant/repro/` and
restore tracked files. Disposable worktrees used here (`/home/user/pac_repro`, `/home/user/pac_worktree`) are not part of the repo.
