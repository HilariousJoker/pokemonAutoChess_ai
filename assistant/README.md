# assistant/ — Pokémon Auto Chess source-backed knowledge

Everything here is read from the game's own source at a pinned revision and kept in two **separate** snapshots. **Live-game parity is unverified** for both: nothing was compared with the running game, upstream data, a wiki or patch notes. Values are **bare-instance** values (class definition + inherited defaults) unless a note says otherwise.

| | Development snapshot | Production-branch reference (*deployment unverified*) |
|---|---|---|
| Source | `01a3e845e91ebe3144b3c43fa9cd261a5dadafd2` (upstream `master`) | `07367c341fe928763da2b565c2eee010433e4fc1` (upstream `prod` head; what the live game runs is not established) |
| Lookup | `node assistant/lookup-unit.mjs` — 20 pilot units | `node assistant/lookup-production.mjs` — any of 1183 catalog identifiers |
| Bare baseline | 20 units (`data/01a3e845/pilot-units.json`, plus the 3-unit `data/baseline.json`) | **1183 identifiers** (`data/07367c34/catalog-units.json`; `DEFAULT` excluded, 0 failed) and the 20-unit `pilot-units.json` |
| Evolution declarations | 20 units + notes (`knowledge/pilot-evolution.md`) | the same 20 units + notes + acquisition context (`pilot-evolution.json`, `knowledge/07367c34/pilot-evolution.md`, `evolution-context.md`) |
| Reviewed abilities | none | 3 records: BLAST_BURN, CRUNCH (Totodile), VESPIQUEN_ORDERS (`pilot-abilities.json`, `knowledge/07367c34/pilot-abilities.md`) |
| Other mechanics | — | base economy and leveling (`economy-leveling.json`, `knowledge/07367c34/economy-leveling.md`); normal shop odds and pools (`shop-rules.json`, `knowledge/07367c34/shop-rules.md`) |
| Reads the other's data? | never | never (each lookup refuses the other's SHA) |

- A catalog identifier is **not** evidence of shop availability or playability. Evolution (20 units) and ability (3 records) coverage are deliberate subsets of the catalog; the production lookup says "not covered" instead of guessing, and applies an ability record only to the units it lists.
- Passives have no structured records yet; the production lookup shows source-backed context from linked notes where a note discusses the passive, and says so when none does.

## What exists
| Path | What it is |
|---|---|
| [`lookup-unit.mjs`](lookup-unit.mjs) | Prints a Markdown card for one pilot unit from the JSON snapshots (no game code, no install needed). |
| [`data/01a3e845/pilot-units.json`](data/01a3e845/pilot-units.json) | Bare-instance baseline for the 20 units (identity, family root, types, stats, skill/passive identifiers). |
| [`data/01a3e845/pilot-evolution.json`](data/01a3e845/pilot-evolution.json) | Declared evolution data for the same 20 units: rule shape, callback presence + source references, evidence flags, callback probes. |
| [`data/07367c34/pilot-units.json`](data/07367c34/pilot-units.json) | Bare-instance baseline of the same 20 keys at the production-branch reference (`baseAtk` is absent on that revision and recorded as such). Separate from the development data; no evolution data. |
| [`data/07367c34/catalog-units.json`](data/07367c34/catalog-units.json) | Production-reference bare baseline for **all 1184 `Pkm` identifiers**: 1183 extracted, 1 excluded (`DEFAULT`, the factory's MissingNo fallback), 0 failed. Availability/playability unverified. Report: [`analysis/catalog-coverage.md`](analysis/catalog-coverage.md). Read by `lookup-production.mjs`. |
| [`data/07367c34/pilot-evolution.json`](data/07367c34/pilot-evolution.json) · [`knowledge/07367c34/pilot-evolution.md`](knowledge/07367c34/pilot-evolution.md) | Declared evolution data and source-backed notes for the 20 pilot units at the production-branch reference (`07367c34…`; deployment unverified). Separate from the development evolution files; read by `lookup-production.mjs`. `compare-evolution.mjs` compares the two evolution files. |
| [`knowledge/07367c34/evolution-context.md`](knowledge/07367c34/evolution-context.md) · [`probes/`](probes/) | Acquisition context for PIKACHU (regional list) and COSMOG/COSMOEM (light cell, evolution loop) at the production-branch reference, with two small isolated probes and their results (probes require `--out`, verify the pinned source and reuse the output guard). |
| [`data/07367c34/economy-leveling.json`](data/07367c34/economy-leveling.json) · [`knowledge/07367c34/economy-leveling.md`](knowledge/07367c34/economy-leveling.md) · `validate-economy.mjs` · `probes/economy-probe.ts` | Base economy and leveling at the production-branch reference (starting gold, income, interest, streaks, XP, level thresholds, rerolls) for the normal path; modifiers recorded as unresolved. The real functions were executed with stub players (probe results in `probes/results/`). Not used by either lookup. |
| [`data/07367c34/shop-rules.json`](data/07367c34/shop-rules.json) · [`knowledge/07367c34/shop-rules.md`](knowledge/07367c34/shop-rules.md) · `validate-shop.mjs` · `probes/shop-probe.ts` | Normal shop at the production-branch reference: size, rarity odds per level (rows verified to sum to 1), unit pick, shared pool initialization and copy flow (display, refresh, buy, sell, death), empty-pool fallback (MAGIKARP), stage/additional/regional restrictions, lock/refresh, and whether CHARMANDER, TOTODILE, VESPIQUEN, ARCEUS, TYPE_NULL can appear. Real code executed with a stub player and scripted randomness; no hit-chance formulas. Not used by either lookup. |
| [`lookup-production.mjs`](lookup-production.mjs) · `test-lookup-production.mjs` | **Production-reference** lookup (separate from `lookup-unit.mjs`, which stays development-only): baseline for any of the 1183 catalog identifiers, plus evolution records for the 20 pilot units and reviewed ability information only for units a record explicitly covers. Reads committed `data/07367c34` and `knowledge/07367c34` files only; no game code, no install, no writes. |
| [`data/07367c34/pilot-abilities.json`](data/07367c34/pilot-abilities.json) · [`knowledge/07367c34/pilot-abilities.md`](knowledge/07367c34/pilot-abilities.md) · `validate-abilities.mjs` | Source-read ability pilot (BLAST_BURN, CRUNCH, VESPIQUEN_ORDERS) at the production-branch reference: structured records with evidence references, player-facing notes, and a validator for both. Raw declared amounts only; read by `lookup-production.mjs` (only for the units each record covers). |
| [`analysis/pilot-baseline-comparison.md`](analysis/pilot-baseline-comparison.md) | Field-by-field comparison of the two baselines (bare factory values only). |
| [`data/baseline.json`](data/baseline.json) | The earlier 3-unit checkpoint (CHARMANDER, FARFETCH_D, VESPIQUEN), kept unchanged. |
| [`knowledge/pilot-units.md`](knowledge/pilot-units.md) | Notes on the baseline: what the numbers mean, a source cross-check of five units, context notes for five units. |
| [`knowledge/pilot-evolution.md`](knowledge/pilot-evolution.md) | Source-backed evolution notes (MAGIKARP, PIKACHU, TYPE_NULL, PRIMEAPE, COSMOEM) and the list of paths not traced. |
| [`STATUS.md`](STATUS.md) | What ran, exact commands, checks, limitations, next step. |
| `extract-baseline.ts`, `extract-evolution.ts`, `output-guard.ts` | Extractors (run the game's factory) and their output-path guard. |
| `compare-payloads.mjs`, `compare-snapshots.mjs`, `knowledge/make-pilot-table.mjs` | Payload comparison and table generation helpers. |
| `repro/`, `lockfile-drift.patch` | Install evidence and a historical record of an old-toolchain install failure. |

## Look a unit up — production-branch reference (`lookup-production.mjs`)
```bash
node assistant/lookup-production.mjs CHARIZARD   # baseline + evolution declarations + reviewed BLAST_BURN (raw amounts)
node assistant/lookup-production.mjs VESPIQUEN   # placeholder skill + position-dependent modes + unresolved acquisition paths
node assistant/lookup-production.mjs ABRA        # catalog baseline only; evolution/ability coverage explicitly "not covered"
node assistant/lookup-production.mjs --list      # counts, coverage and all catalog identifiers
node assistant/test-lookup-production.mjs        # representative checks, incl. rejection fixtures in the OS temp dir
```
Every card is labelled **Production-branch reference; deployment unverified** with the pinned SHA `07367c34…`. A catalog identifier is **not** evidence of shop availability or playability. Evolution coverage (20 units) and ability coverage (3 records) are subsets of the catalog; an ability explanation is shown only for units listed in that record's `appliesTo` (CRUNCH covers TOTODILE only, not CROCONAW). Unknown, prototype-property (`toString`, `__proto__`) and excluded (`DEFAULT`) identifiers exit 1 with an error; data with another revision, failed source-match provenance or inconsistent identities is refused (exit 3). It never reads development data or notes.

## Look a unit up — development snapshot (`lookup-unit.mjs`)
```bash
node assistant/lookup-unit.mjs PIKACHU      # one unit (exact, case-sensitive Pkm key)
node assistant/lookup-unit.mjs --list       # the 20 covered keys
```
The card shows bare-instance stats, types, ability/passive **identifiers**, declared evolution fields, callback probe results if any, the audited SHA, the parity warning, and links into the notes.
It **refuses** (exit 3) any snapshot whose audited commit is not the development SHA `01a3e845…` (the production snapshot has its own lookup, `lookup-production.mjs`), and to combine snapshots with different audited commits, a failed game-source match, or inconsistent unit sets. A key outside the pilot is reported as not covered (exit 1); it is never guessed.
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
- **Development snapshot (20 keys):** CHARMANDER, CHARMELEON, CHARIZARD, PIKACHU, RAICHU, ALOLAN_RAICHU, GALAR_MEOWTH, VESPIQUEN, ARCEUS, MAGIKARP, GYARADOS, TYPE_NULL, PRIMEAPE, TEPIG, DITTO, UNOWN_D, FARFETCH_D, TOTODILE, COSMOEM, SUBSTITUTE — baseline and evolution; stats are in the JSON and in `lookup-unit.mjs` output.
- **Production-branch reference:** baseline for all 1183 extracted catalog identifiers; evolution records for the same 20 keys; ability records for CHARMANDER/CHARMELEON/CHARIZARD (BLAST_BURN), TOTODILE (CRUNCH) and VESPIQUEN (VESPIQUEN_ORDERS); economy/leveling rules and shop odds/pool rules for the normal path (neither is surfaced by the lookup yet).

## How strong is each kind of information?
| Kind | What it is | What it can and cannot tell you |
|---|---|---|
| **Source-backed data** | Fields read through the game's own factory/classes at the audited commit; reproducible (repeated runs identical). | What the class declares for a bare instance. Not what happens in a match. |
| **Inspected interpretations** | Handler/hook source read and explained in the notes with file, symbol and line. **Not executed.** | How the code appears to work; reading errors are possible. Each note says what is established vs. untested, and lists unresolved paths. |
| **Callback probes** | A real rule callback executed with **stub** arguments (TYPE_NULL item → variant over all 55 items; PIKACHU's two branches). | Only what that function returns for those inputs, not when it fires or the game state it would see. |
| **Live gameplay evidence** | None exists. | Parity with the running game is **unverified**. |

## Known gaps
- **Development snapshot:** only the 20 pilot units; no ability or passive explanations, no catalog.
- **Production-branch reference:** abilities beyond the 3 reviewed records, structured passive records, items, synergies, unit prices, shop modifiers (items, synergy effects, special rules), combat, special game rules and modes other than the normal path (SCRIBBLE, DOUBLE_UP), and every item/rule modifier of the economy (recorded as unresolved, not traced). Acquisition paths still untraced are listed in the notes' unresolved sections (for example how a Vespiquen made by evolution gets its mode, Primeape's in-fight timing, and Cosmoem HP with items).
- **Both:** the generic combat pipeline (final damage, healing, shields) is unverified, so ability amounts are *raw declared* values; one toolchain only (Node 24.21.0, linux-x64); no comparison with the live game.
- Details, exact commands and every check run: [STATUS.md](STATUS.md).
