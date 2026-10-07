# Pilot baseline comparison: development snapshot vs production-branch reference

**Scope.** This compares *bare factory values* of the same 20 pilot units on two source revisions. It is **not** a comparison of full gameplay behavior (abilities, passives, hooks, items, shops, combat), and it is **not** verified live-game parity. The production-branch reference is only the head of the upstream `prod` branch; **which commit the live game actually runs is unverified** (see [version-alignment.md](version-alignment.md)).

| | SHA | Meaning |
|---|---|---|
| Development snapshot | `01a3e845e91ebe3144b3c43fa9cd261a5dadafd2` | upstream `master` head when audited; `package.json` 6.11. Data: [`../data/01a3e845/pilot-units.json`](../data/01a3e845/pilot-units.json) |
| Production-branch reference; deployment unverified | `07367c341fe928763da2b565c2eee010433e4fc1` | upstream `prod` head; `package.json` 6.11.1. Data: [`../data/07367c34/pilot-units.json`](../data/07367c34/pilot-units.json) |

## Result
- Same 20 keys, same order; identity (`name`, `index`), evolution-family root, bare-instance `evolution`/`evolutions` and types are **identical** for all 20.
- **600** field values exist on both revisions: **594 equal, 6 changed** (three units, each changing a stat and its mirrored `base*` field).
- **20** values are **unavailable on the production side**: the legacy `baseAtk`. It is not defined on that revision's factory instances (`'baseAtk' in instance` is false; the extractor fails if a profile declares it absent but it is present). It is recorded as `fieldAvailability.baseAtk = {present:false}` — not `0`, not `null`, and not copied from `atk`. Every other field is validated as before.

### Changed values
| Unit | Field | Development 01a3e845 | Production-reference 07367c34 |
|---|---|---|---|
| UNOWN_D | `stats.maxPP` | `50` | `100` |
| UNOWN_D | `stats.baseMaxPP` | `50` | `100` |
| TOTODILE | `stats.skill` | `"BITE"` | `"CRUNCH"` |
| TOTODILE | `stats.baseSkill` | `"BITE"` | `"CRUNCH"` |
| COSMOEM | `stats.hp` | `200` | `220` |
| COSMOEM | `stats.maxHP` | `200` | `220` |

The three differences flagged in [version-alignment.md](version-alignment.md) are all reproduced by the factory: **UNOWN_D Max PP** 50 → 100, **TOTODILE skill** `BITE` → `CRUNCH`, **COSMOEM bare HP** 200 → 220. That report also noted COSMOEM `stacksRequired` (10 vs 8) differs in the class source; `stacksRequired` is not a field of this baseline, so it is not part of this comparison.

### Fields unavailable on one revision (not a value change)
`stats.baseAtk` for all 20 units: present on the development snapshot (e.g. CHARMANDER `4`, ARCEUS `21`), unavailable on the production reference. The full list is in the output of `compare-snapshots.mjs` below.

## What this does and does not show
- Shows: what `PokemonFactory.createPokemonFromName` returns for each unit's class on each revision, read by the same extractor code (profile switch only changes the pinned SHA and the declared-absent field).
- Does not show: whether these values apply in a running match, whether the changed skill's behavior differs beyond its identifier, how a field is used on either revision, or what the deployed server runs.
- The extraction compares the tooling with itself (two runs identical); agreement with the class definitions was checked only for the five units noted in the development notes.

## Runs and checks
- Production worktree: disposable `git worktree add --detach /home/user/pac_prod 07367c34…` (commit objects fetched read-only from upstream). `git diff 07367c34… -- . ':(exclude)assistant'` empty and `git status` showing only the untracked, copied `assistant/` tooling; recorded in the JSON as `gameSourceMatchesAudited=true`, `checkoutIsAuditedCommit=true`. `--allow-source-mismatch` was not used.
- Toolchain: Node `v24.21.0` (official tarball, SHA-256 checked against `SHASUMS256.txt`), npm `11.19.0`, linux-x64. The production `package.json` pins `engines.node` to exactly `24.19.0`, so `npm ci` printed an `EBADENGINE` warning; it did not fail.
- `npm ci --ignore-scripts --no-audit --no-fund` against the committed production lockfile: **exit 0, 813 packages**, lockfile unmodified.
- Two extractions: `compare-payloads.mjs` → `IDENTICAL payloads (20 units)`. Key set: exactly the 20 development pilot keys, same order, no duplicates; each `identity.key == identity.name`.
- Protections exercised (each refused, nothing written): output at the development snapshot's checkpoint, a file under `app/`, the default 3-unit checkpoint with a 20-key set, the production checkpoint with a different key set, missing `--out`/keys, unknown key, unknown profile; a development-profile run in the production worktree refused (297 files differ from 01a3e845). A temporary edit giving the factory a `baseAtk` made the production profile fail ("declared absent … but the factory instance defines it"); the edit was reverted.

## Exact commands
```bash
# toolchain: Node 24.21.0 / npm 11.19.0 first on PATH
git fetch --depth=1 https://github.com/keldaanCommunity/pokemonAutoChess.git 07367c341fe928763da2b565c2eee010433e4fc1
git worktree add --detach /home/user/pac_prod 07367c341fe928763da2b565c2eee010433e4fc1
cd /home/user/pac_prod && npm ci --ignore-scripts --no-audit --no-fund
mkdir -p assistant && cp <primary>/assistant/{extract-baseline.ts,extract-evolution.ts,output-guard.ts,compare-payloads.mjs} assistant/
KEYS=$(node -e 'console.log(Object.keys(JSON.parse(require("fs").readFileSync("<primary>/assistant/data/01a3e845/pilot-units.json")).pokemon).join(" "))')
node_modules/.bin/tsx assistant/extract-baseline.ts --profile production-reference --out assistant/data/07367c34/pilot-units.json $KEYS
node_modules/.bin/tsx assistant/extract-baseline.ts --profile production-reference --out <scratch>/prod-run2.json $KEYS
node assistant/compare-payloads.mjs assistant/data/07367c34/pilot-units.json <scratch>/prod-run2.json
# in the primary checkout (no game code executed):
node assistant/compare-snapshots.mjs assistant/data/01a3e845/pilot-units.json assistant/data/07367c34/pilot-units.json
```
