# Production-reference catalog coverage

**Scope:** bare-baseline identifier catalog (1184 identifiers) of the production-branch reference; deployment unverified — upstream `prod` head `07367c341fe928763da2b565c2eee010433e4fc1`. Identifier inventory and bare factory values only; not availability, mechanics, behavior or live-game parity. Data: [`../data/07367c34/catalog-units.json`](../data/07367c34/catalog-units.json). Separate from the development snapshot (`01a3e845…`) and from [`pilot-units.json`](../data/07367c34/pilot-units.json), which are unchanged.

## Inventory and accounting
| | Count |
|---|---|
| Identifiers (`Object.values(Pkm)`, `app/types/enum/Pokemon.ts`) | **1184** (keys equal values; no duplicates) |
| Registered in `PokemonClasses` (`app/models/colyseus-models/pokemon.ts`) | 1184 — the enum and the registry have the same members; every identifier also has a `PkmIndex` and `PkmFamily` entry; indexes are unique |
| **Extracted** (real factory, identity/index validated) | **1183** |
| **Excluded** | **1** |
| **Failed** | **0** |

Each identifier is in exactly one bucket (checked by the extractor and again independently). On any failure the extractor writes only `analysis/catalog-failures.json`, does not write the catalog and exits 1; none occurred.

### Exclusion
| Identifier | Reason (source-supported) |
|---|---|
| `DEFAULT` | Explicit placeholder: the factory falls back to `new Pokemon(Pkm.DEFAULT)` and logs "return MissingNo" for unregistered names (`app/models/pokemon-factory.ts:65-66`); `PokemonClasses[Pkm.DEFAULT]` is the bare base `Pokemon` class. A `DEFAULT` result cannot tell a real unit from a fallback, so it is not accepted as a unit record. |

Nothing else is excluded or classified as a placeholder (e.g. `EGG`, `SUBSTITUTE`, `*_NEST`-style identifiers are extracted as ordinary records; whether they are playable is not established). Unregistered keys would be reported as failures, never accepted via the fallback.

### Shared-class mappings (from the registry itself)
`registry[KEY] = {registeredClass, sharedClassWith}`. 51 keys share a class with at least one other key: the Arceus forms (18 keys → `Arceus`), Silvally forms (18 → `Silvally`), and Flabebe / Floette / Florges colour variants (5 each). A bare instance of such a key is built by the shared class from the key name; no further interpretation is made.

## What each record is
Same shape as the pilot: `identity` (key/name/index), `evolutionFamilyRoot`, `bareInstanceEvolution`, `types`, `stats`, plus `fieldAvailability.baseAtk = {present:false}` on every record (the legacy field does not exist on this revision). Enum-valued fields are validated against their enums: `rarity` (Rarity), `skill`/`tm`/`baseSkill` (Ability), `passive` (Passive), `types` (Synergy), `evolution`/`evolutions` (Pkm); all evolution targets and family roots are inventory identifiers.

**Availability and playability are unverified** (`availabilityAndPlayability: "unverified"`): an identifier or a record is not proof that the unit appears in shops, can be obtained, or is playable. Values are bare factory values, not gameplay behavior or live-game parity.

## Verification
- Two catalog extractions: `pokemon` payloads identical (1183 units); `inventory` and `registry` identical.
- The 20 pilot keys in the catalog deep-equal `pilot-units.json` (`compare-payloads.mjs --subset`).
- Source match: original tracked files equal the pinned SHA (`gameSourceMatchesAudited=true`, `checkoutIsAuditedCommit=true`); `--allow-source-mismatch` not used.
- Guards (new catalog checkpoint registration): `--catalog` into `pilot-units.json` (set-size mismatch), into the development checkpoint, and into `app/` all refused; `--catalog` with explicit keys refused; a 1-key run into `catalog-units.json` refused; `extract-evolution.ts` refuses both production checkpoints. Nothing was written by any refused call.
- Lookup: default development lookup works; a baseline/evolution pair with any audited SHA other than `01a3e845…` (e.g. the production pilot) is refused with exit 3.
- Enum validation was exercised on the production profile only; the development profile shares the code but was not re-run.

## Checkpoint rerun and role checks (fix)
Reruns of the catalog checkpoint are exclusion-aware (records for every identifier except `DEFAULT`; stored inventory must equal the requested inventory), and roles are enforced even when the target does not exist: `catalog-units.json` accepts only `--profile production-reference --catalog`, and catalog output is refused for the pilot and all other checkpoints. Verified: in-place `--catalog` rerun succeeded with identical `pokemon`/`inventory`/`registry`; non-catalog output to the catalog path refused (exact extracted key set, one key, absent file); catalog output to the pilot path refused (existing and absent); no refusal changed a file; committed datasets unchanged.

## Toolchain and commands
Node `v24.21.0` (official tarball, SHA-256 verified), npm `11.19.0`, linux-x64. Disposable worktree `git worktree add --detach /home/user/pac_prod 07367c341fe928763da2b565c2eee010433e4fc1`; `npm ci --ignore-scripts --no-audit --no-fund` exit 0, 813 packages (EBADENGINE warning: production pins Node 24.19.0).
```bash
# in /home/user/pac_prod, tooling copied from assistant/ (extract-baseline.ts, extract-evolution.ts, output-guard.ts, compare-payloads.mjs)
node_modules/.bin/tsx assistant/extract-baseline.ts --profile production-reference --catalog --out assistant/data/07367c34/catalog-units.json
node_modules/.bin/tsx assistant/extract-baseline.ts --profile production-reference --catalog --out <scratch>/cat2.json
node assistant/compare-payloads.mjs assistant/data/07367c34/catalog-units.json <scratch>/cat2.json
node assistant/compare-payloads.mjs --subset assistant/data/07367c34/catalog-units.json assistant/data/07367c34/pilot-units.json
# in the primary checkout
node assistant/lookup-unit.mjs --list
node assistant/lookup-unit.mjs --baseline assistant/data/07367c34/pilot-units.json PIKACHU   # refused, exit 3
```

## Limitations
- Bare-instance fields only; no abilities, passives' effects, evolution rules, items, shop pool/availability, combat or live-game checks. Evolution declarations are the raw `evolution`/`evolutions` fields, not a complete evolution map.
- The deployed commit is unknown; this is the `prod` branch head, not proof of what runs.
- Records were validated structurally and against enums; their values were not independently cross-read against class source (beyond the earlier five-unit check on the development snapshot).
- No production lookup support yet (`lookup-unit.mjs` refuses non-development snapshots).
