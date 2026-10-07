# Checkpoint status — baseline extraction (3 Pokémon)

Audited source commit (full SHA): `01a3e845e91ebe3144b3c43fa9cd261a5dadafd2`
("revert cosmog and cosmoem passive buffs"). Extraction ran in a detached worktree at that commit,
`/home/user/pac_worktree`, created from `/home/user/pokemonAutoChess_ai`. This `assistant/` folder was then
copied into the checkout on branch `claude/great-volta-v6znve` and committed there (only `assistant/` files).

## Environment actually used
- Node `v22.22.0`, npm `10.9.4` (Linux).
- `package.json` declares `engines`: node `>=24.19.0`, npm `>=10.8.1`. Node 22 does **not** satisfy this.

## What ran (in order)
1. `git worktree add --detach ../pac_worktree 01a3e845e91ebe3144b3c43fa9cd261a5dadafd2` — OK.
2. `npm ci --ignore-scripts --no-audit --no-fund` — **FAILED** (EUSAGE): committed `package-lock.json` is not in
   sync with `package.json`; missing from lock: `gcp-metadata@7.0.1`, `gaxios@7.3.1`, `node-fetch@3.3.2`,
   `data-uri-to-buffer@4.0.1`. (An earlier attempt with `--engine-strict=false` failed identically.)
3. Fallback: `npm install --ignore-scripts --no-audit --no-fund` (822 packages, ~34 s), then
   `git checkout package-lock.json` so no tracked file in the worktree changed. The lockfile changes npm
   wanted are saved in `assistant/lockfile-drift.patch` (+83/−60 lines). Roughly: 20 `libc` metadata
   removals (likely npm-version noise), 4 added nested `mongoose` dependencies (the missing packages above),
   and other small edits. Not analysed further.
4. Factory load probe (script deleted afterwards): `PokemonFactory.createPokemonFromName(Pkm.CHARMANDER)`
   returned `CHARMANDER hp 60 atk 4` under `tsx`.
5. **Exact successful extraction command**, run from the worktree root (`/home/user/pac_worktree`):
   ```bash
   node_modules/.bin/tsx assistant/extract-baseline.ts
   ```
   (defaults to CHARMANDER, FARFETCH_D, VESPIQUEN; wrote `assistant/data/baseline.json`).

## Results (`assistant/data/baseline.json`)
Each record has `key`/`name` = the extracted unit's own identity. The separate `baseline` field is the
evolution-family root returned by `getPokemonBaseline()` and is **not** the unit's identity.

| Pkm (`name`) | `baseline` | rarity | stars | hp | atk | def/speDef | speed | range | maxPP | skill | passive | types |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CHARMANDER | CHARMANDER | COMMON | 1 | 60 | 4 | 3/3 | 57 | 1 | 100 | BLAST_BURN | NONE | DRAGON, FIRE |
| FARFETCH_D | FARFETCH_D | UNIQUE | 3 | 200 | 20 | 8/8 | 50 | 1 | 60 | RAZOR_WIND | NONE | FLYING, GOURMET, NORMAL |
| VESPIQUEN | **COMBEE** | UNIQUE | 3 | 190 | 16 | 8/8 | 38 | 3 | 90 | VESPIQUEN_ORDERS | VESPIQUEN | BUG, FLORA, GOURMET |

Values agree with the class definitions in `app/models/colyseus-models/pokemon.ts`.
`evolutions` is `[]` on a bare factory instance (filled elsewhere), so use `evolution` (CHARMANDER → CHARMELEON).

## Compatibility is UNVERIFIED
- **Runtime**: only Node 22.22.0 was tried; the project requires Node >=24.19.0. The three extractions
  worked on 22, but behaviour on the required Node version was not tested.
- **Dependencies**: installed via the `npm install` fallback, not from an in-sync lockfile, so resolved
  versions may differ from what upstream CI uses. Not compared against upstream or a clean-lock install.
- Nothing beyond three units was extracted; the game server, tests and typecheck were not run.

## Deferred (out of scope for this checkpoint)
Full catalog, upstream parity, schemas, comprehensive validation, stale-data checker, combat work.

## Continuation commands
```bash
cd /home/user/pac_worktree            # or recreate: git worktree add --detach ../pac_worktree 01a3e845e91ebe3144b3c43fa9cd261a5dadafd2
npm install --ignore-scripts --no-audit --no-fund && git checkout package-lock.json   # only if node_modules is missing
node_modules/.bin/tsx assistant/extract-baseline.ts                       # the 3 default units
node_modules/.bin/tsx assistant/extract-baseline.ts CHARMELEON CHARIZARD  # other Pkm enum keys
```
The raw npm install log was kept out of version control (untracked).

## Credit tracking
No remaining-credit information is available in this session, so no dollar limit could be enforced.
