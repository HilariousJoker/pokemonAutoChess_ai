# Automation trial 1 — ability/POWDER

Production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1`; deployment unverified. Run `run-20261021T170007Z`, manual, one record, no schedule.

## Record processed
`ability/POWDER` (`PowderStrategy`, `app/core/abilities/powder.ts`), 22 units: Scatterbug, Spewpa, 20 Vivillon forms. Candidate: `assistant/candidates/07367c34/ability-POWDER.json`. No other record was started.

## Procedure and results
- Started from the pushed head `076ff0a72` (local branch was behind; fast-forwarded only). Pinned commit was missing; `ensure-source.mjs` fetched exactly that commit.
- Baseline before work: `validate-abilities`, `inventory --check`, `queue check`, `test-lookup-production`, `test-automation` all passed.
- Lock taken, committed and pushed through the branch guard. Record started, candidate registered, validated.
- Validation: **passed on the first attempt** (0 repairs of 2 allowed): 59 evidence refs, 22 unit bindings, 2 source tables (damage, speed factor), 4 numeric examples; 3 categories of semantic claims remain unchecked.
- Candidate content (source reading only): picks the highest-SPEED enemy within the caster's range (cast target if none), hits every enemy on the supercover line to it with special damage 10/20/30 (1/2/3 stars) and lowers its SPEED by the same table scaled by AP and crit, capped at its current speed, restored after 5000 ms.
- Test adjustment: in `test-automation.mjs` the pristine-state assertion moved to a freshly generated temporary queue (right after the sync test). The real-queue check is now structural only (pinned revision, known work/validation/review states, unique ids, lock null or well-formed, covered identifiers absent, selected known records present). Other tests unchanged. The suite passed with the real queue holding saved progress.
- After unlock the same five checks passed again.

## Review / validation status
work `candidate_ready`, validation `passed` (mechanical only), review `pending`. Nothing was promoted into `data/`, `knowledge/` or `match-reference.md`; `review-status.json` untouched.

## Blockers and open points (also in the candidate's `unresolved`)
- Bodies of `applyBigEaterBeltStatBuff` / `applyTwistBandBuff` (called in `addSpeed`) could not be located by searching the pinned tree, so item effects on the speed change are unstated.
- Scatterbug (HATCH) and Spewpa (SPEWPA) passives not investigated.
- No isTargettableBy filter in the strategy was noted but not explored; tie order and diagonal cells derived from loop text, not executed; restore timing units not traced; no gameplay evidence.
- No routing uncertainties were listed for this record.

## Final state
Queue: 726 records, queued 725, candidate_ready 1; validation passed 1; review pending 1. Lock: none (released normally).
