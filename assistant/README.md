# assistant/ — Pokémon Auto Chess knowledge pilot

A small, source-backed lookup for **20 units**, extracted from the game's own code at one audited revision:

- **Audited game-source commit:** `01a3e845e91ebe3144b3c43fa9cd261a5dadafd2` — the **development snapshot** (upstream `master`). `lookup-unit.mjs` and everything under `data/01a3e845/` and `knowledge/` describe this snapshot only.
- A separate bare-baseline snapshot of the **production-branch reference** (`07367c341fe928763da2b565c2eee010433e4fc1`; *deployment unverified*) is in `data/07367c34/pilot-units.json`. It is not used by the lookup tool, and the notes in `knowledge/` do not apply to it. Comparison: [`analysis/pilot-baseline-comparison.md`](analysis/pilot-baseline-comparison.md).
- **Live-game parity is unverified.** Everything here is read from source at that commit. Nothing was compared with the running game, upstream data, a wiki or patch notes.
- Values are **bare-instance** values (class definition + inherited defaults), *before* any player, item, board, synergy, hook or combat effect.

## What exists
| Path | What it is |
|---|---|
| [`lookup-unit.mjs`](lookup-unit.mjs) | Prints a Markdown card for one pilot unit from the JSON snapshots (no game code, no install needed). |
| [`data/01a3e845/pilot-units.json`](data/01a3e845/pilot-units.json) | Bare-instance baseline for the 20 units (identity, family root, types, stats, skill/passive identifiers). |
| [`data/01a3e845/pilot-evolution.json`](data/01a3e845/pilot-evolution.json) | Declared evolution data for the same 20 units: rule shape, callback presence + source references, evidence flags, callback probes. |
| [`data/07367c34/pilot-units.json`](data/07367c34/pilot-units.json) | Bare-instance baseline of the same 20 keys at the production-branch reference (`baseAtk` is absent on that revision and recorded as such). Separate from the development data; no evolution data. |
| [`data/07367c34/catalog-units.json`](data/07367c34/catalog-units.json) | Production-reference bare baseline for **all 1184 `Pkm` identifiers**: 1183 extracted, 1 excluded (`DEFAULT`, the factory's MissingNo fallback), 0 failed. Availability/playability unverified. Report: [`analysis/catalog-coverage.md`](analysis/catalog-coverage.md). Not used by the lookup. |
| [`data/07367c34/pilot-evolution.json`](data/07367c34/pilot-evolution.json) · [`knowledge/07367c34/pilot-evolution.md`](knowledge/07367c34/pilot-evolution.md) | Declared evolution data and source-backed notes for the 20 pilot units at the production-branch reference (`07367c34…`; deployment unverified). Separate from the development evolution files; not used by the lookup. `compare-evolution.mjs` compares the two evolution files. |
| [`knowledge/07367c34/evolution-context.md`](knowledge/07367c34/evolution-context.md) · [`probes/`](probes/) | Acquisition context for PIKACHU (regional list) and COSMOG/COSMOEM (light cell, evolution loop) at the production-branch reference, with two small isolated probes and their results (probes require `--out`, verify the pinned source and reuse the output guard). |
| [`data/07367c34/pilot-abilities.json`](data/07367c34/pilot-abilities.json) · [`knowledge/07367c34/pilot-abilities.md`](knowledge/07367c34/pilot-abilities.md) · `validate-abilities.mjs` | Source-read ability pilot (BLAST_BURN, CRUNCH, VESPIQUEN_ORDERS) at the production-branch reference: structured records with evidence references, player-facing notes, and a validator for both. Raw declared amounts only; not used by the lookup. |
| [`analysis/pilot-baseline-comparison.md`](analysis/pilot-baseline-comparison.md) | Field-by-field comparison of the two baselines (bare factory values only). |
| [`data/baseline.json`](data/baseline.json) | The earlier 3-unit checkpoint (CHARMANDER, FARFETCH_D, VESPIQUEN), kept unchanged. |
| [`knowledge/pilot-units.md`](knowledge/pilot-units.md) | Notes on the baseline: what the numbers mean, a source cross-check of five units, context notes for five units. |
| [`knowledge/pilot-evolution.md`](knowledge/pilot-evolution.md) | Source-backed evolution notes (MAGIKARP, PIKACHU, TYPE_NULL, PRIMEAPE, COSMOEM) and the list of paths not traced. |
| [`STATUS.md`](STATUS.md) | What ran, exact commands, checks, limitations, next step. |
| `extract-baseline.ts`, `extract-evolution.ts`, `output-guard.ts` | Extractors (run the game's factory) and their output-path guard. |
| `compare-payloads.mjs`, `compare-snapshots.mjs`, `knowledge/make-pilot-table.mjs` | Payload comparison and table generation helpers. |
| `repro/`, `lockfile-drift.patch` | Install evidence and a historical record of an old-toolchain install failure. |

## Look a unit up
```bash
node assistant/lookup-unit.mjs PIKACHU      # one unit (exact, case-sensitive Pkm key)
node assistant/lookup-unit.mjs --list       # the 20 covered keys
```
The card shows bare-instance stats, types, ability/passive **identifiers**, declared evolution fields, callback probe results if any, the audited SHA, the parity warning, and links into the notes.
It **refuses** (exit 3) any snapshot whose audited commit is not the development SHA `01a3e845…` (no production lookup yet), and to combine snapshots with different audited commits, a failed game-source match, or inconsistent unit sets. A key outside the pilot is reported as not covered (exit 1); it is never guessed.
It prints no ability descriptions, acquisition stats or strategy advice because the data holds none.

Evolution cards keep two things apart: the **rule shape** the class carries (many units simply inherit the base `count`/3 rule, including terminal units) and the **evidence a unit can evolve** (declared `evolution` / `evolutions`). An inherited rule alone is not evidence.

## Re-run an extraction
Needs a full checkout of this branch (the audited commit must be reachable), Node >= 24.19.0 (tested with 24.21.0 / npm 11.19.0) and `npm ci --ignore-scripts --no-audit --no-fund` that leaves `package-lock.json` unmodified.
```bash
node_modules/.bin/tsx assistant/extract-baseline.ts --out /tmp/b3.json                 # default 3 units
node_modules/.bin/tsx assistant/extract-evolution.ts --out /tmp/e20.json               # the 20 pilot units
node assistant/compare-payloads.mjs assistant/data/01a3e845/pilot-evolution.json /tmp/e20.json   # compare payloads (provenance ignored)
```
Rules enforced before anything is written:
- Extraction **fails** if game source (everything outside `assistant/`) differs from the audited commit, unless `--allow-source-mismatch` is passed (then the drift is recorded in `provenance`).
- Output must be a `.json` file. Allowed: an extractor's **own** checkpoint (an intentional rerun) and scratch `.json` files (outside the repo, or new files under `assistant/`).
  **Refused:** game files and root config (anything in the repository outside `assistant/`), the **other** extractor's checkpoints, other tracked files under `assistant/`, and paths that reach those through a symlink. A refusal modifies nothing.
- Evolution probes fail the run on any exception or a result that is not a real `Pkm` identifier.

Production-reference extraction (run in a disposable worktree of that SHA, never in this checkout; see the comparison report for the full command list):
```bash
node_modules/.bin/tsx assistant/extract-baseline.ts --profile production-reference --out assistant/data/07367c34/pilot-units.json <20 keys>
```
`--catalog` (with that profile, no keys) extracts the full identifier inventory to `data/07367c34/catalog-units.json`.
The `production-reference` profile pins the SHA, requires `--out` and explicit keys, protects the development checkpoints (and vice versa), and fails if a field declared absent (`baseAtk`) exists.

## Coverage
Exactly these 20 keys: CHARMANDER, CHARMELEON, CHARIZARD, PIKACHU, RAICHU, ALOLAN_RAICHU, GALAR_MEOWTH, VESPIQUEN, ARCEUS, MAGIKARP, GYARADOS, TYPE_NULL, PRIMEAPE, TEPIG, DITTO, UNOWN_D, FARFETCH_D, TOTODILE, COSMOEM, SUBSTITUTE. Stats are in the JSON and in `lookup-unit.mjs` output (not duplicated here).

## How strong is each kind of information?
| Kind | What it is | What it can and cannot tell you |
|---|---|---|
| **Source-backed data** | Fields read through the game's own factory/classes at the audited commit; reproducible (repeated runs identical). | What the class declares for a bare instance. Not what happens in a match. |
| **Inspected interpretations** | Handler/hook source read and explained in the notes with file, symbol and line. **Not executed.** | How the code appears to work; reading errors are possible. Each note says what is established vs. untested, and lists unresolved paths. |
| **Callback probes** | A real rule callback executed with **stub** arguments (TYPE_NULL item → variant over all 55 items; PIKACHU's two branches). | Only what that function returns for those inputs, not when it fires or the game state it would see. |
| **Live gameplay evidence** | None exists. | Parity with the running game is **unverified**. |

## Known gaps
- Units outside the 20; the full catalog, items, synergies, ability implementations/descriptions, passives' effects, shop odds, combat and any acquisition-time stats (e.g. the in-play HP of a player-owned COSMOEM).
- Paths deliberately not traced: how `Player.regionalPokemons` is computed (PIKACHU), what sets the light cell (COSMOEM), when PRIMEAPE's death/resurrect effects fire and stack overshoot, `equipItem` HP effects, a forced-transform item path — see [the unresolved list](knowledge/pilot-evolution.md#unresolved-list-explicitly-not-traced-further).
- One toolchain only (Node 24.21.0, linux-x64); no comparison with upstream or the live game.
- Details, exact commands and every check run: [STATUS.md](STATUS.md).
