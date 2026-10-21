# Automation demonstration (temporary fixtures)

Output of `node assistant/automation/test-automation.mjs --verbose` on the commit that added the workflow. All fixtures (copies of the data files, temporary queues, a local bare git remote with two clones) live in the OS temp directory; nothing under `assistant/` is written (the test checks the tree is byte-identical). It shows inventory generation from a fixture data directory, queue selection (five-record budget, priority, dependency order), resumption by a fresh run from the saved queue alone, the lock and stale-lock takeover, a candidate built from the already-covered THRASH record passing the shared checks, three validation failures ending in a blocked record while independent work continues, and the branch guard stopping when another writer moved the branch. Source reading and mechanical checks only: no gameplay evidence, no review.

```text
### inventory from a fixture data directory (THRASH ability record and SURGE_SURFER passive record removed)
$ inventory.mjs --data-dir <fixture> --out <tmp>
wrote /tmp/automation-CElaun/inv-fixture.json: 540 abilities, 193 passives, 1 shared implementation groups

### queue: sync, lock, select, start (all on a temporary copy)
$ queue.mjs sync 
sync: 726 added, 0 refreshed, 0 removed (now covered, untouched), 0 superseded; 726 records in the queue
$ queue.mjs sync 
sync: 0 added, 726 refreshed, 0 removed (now covered, untouched), 0 superseded; 726 records in the queue
$ queue.mjs start ability/CRUNCH --run R1
the single-writer lock is not held; take it with: queue.mjs lock --run R1
$ queue.mjs lock --run R1 --head abc
lock held by run R1
$ queue.mjs lock --run R2 --now 2026-10-21T15:19:21.463Z
lock held by run R1 for 1 min (< 180 min); another writer may be active — stop
$ queue.mjs unlock --run R2
lock released
$ queue.mjs lock --run R3
lock held by run R3
$ queue.mjs next --run R3 --json
[
 {
  "id": "passive/UNOWN",
  "why": "queued",
  "units": [
   "UNOWN_A",
   "UNOWN_B",
$ queue.mjs start passive/UNOWN --run R3
passive/UNOWN in progress
$ queue.mjs start passive/HATCH --run R3
passive/HATCH in progress
$ queue.mjs start ability/POWDER --run R3
ability/POWDER in progress
$ queue.mjs start ability/JUDGEMENT --run R3
ability/JUDGEMENT in progress
$ queue.mjs start ability/MULTI_ATTACK --run R3
ability/MULTI_ATTACK in progress
$ queue.mjs start ability/CRUNCH --run R3
run R3 already handled 5 records (limit per run); stop and report
$ queue.mjs next --run R3 --json
[]
$ queue.mjs unlock --run R3
lock released
$ queue.mjs lock --run R4
lock held by run R4
$ queue.mjs next --run R4 --json
[
 {
  "id": "passive/UNOWN",
  "why": "resume (in progress)",
  "units": [
   "UNOWN_A",
   "UNOWN_B",
$ queue.mjs unlock --run R4
lock released

### candidate flow using the already-covered THRASH record as fixture material
$ queue.mjs sync 
sync: 728 added, 0 refreshed, 0 removed (now covered, untouched), 0 superseded; 728 records in the queue
$ queue.mjs lock --run R10
lock held by run R10
$ queue.mjs start ability/THRASH --run R10
ability/THRASH in progress
$ queue.mjs candidate ability/THRASH --file /tmp/automation-CElaun/elsewhere.json --run R10
candidate files must be .json files under /tmp/automation-CElaun/candidates (generated candidates stay separate from data/ and knowledge/)
$ queue.mjs candidate ability/THRASH --file /tmp/automation-CElaun/candidates/ability-THRASH.json --run R10
candidate registered: ../../../../tmp/automation-CElaun/candidates/ability-THRASH.json
$ queue.mjs validate ability/THRASH --run R10
validation passed for ability/THRASH: 25 evidence refs, 3 unit bindings, 1 source tables, 5 examples; review: pending (mechanical checks only; unchecked claims: 8 kinds)
$ queue.mjs start passive/SURGE_SURFER --run R10
passive/SURGE_SURFER in progress
$ queue.mjs candidate passive/SURGE_SURFER --file /tmp/automation-CElaun/candidates/passive-SURGE_SURFER.json --run R10
candidate registered: ../../../../tmp/automation-CElaun/candidates/passive-SURGE_SURFER.json
$ queue.mjs validate passive/SURGE_SURFER --run R10
validation FAILED for passive/SURGE_SURFER (1 problem(s)); failed attempts 1; the record is blocked at 3 (initial attempt + 2 repairs)
- passive SURGE_SURFER: evidence unit-alolan-raichu: "text that is not in the source" not found in app/models/colyseus-models/pokemon.ts:3256-3278
$ queue.mjs candidate passive/SURGE_SURFER --file /tmp/automation-CElaun/candidates/passive-SURGE_SURFER.json --run R10
candidate registered: ../../../../tmp/automation-CElaun/candidates/passive-SURGE_SURFER.json
$ queue.mjs validate passive/SURGE_SURFER --run R10
validation FAILED for passive/SURGE_SURFER (2 problem(s)); failed attempts 2; the record is blocked at 3 (initial attempt + 2 repairs)
- passive SURGE_SURFER: unit ALOLAN_RAICHU: stars/maxPP/range disagree with the catalog
- passive SURGE_SURFER: unit ALOLAN_RAICHU: class AlolanRaichu does not declare stars = 2
$ queue.mjs candidate passive/SURGE_SURFER --file /tmp/automation-CElaun/candidates/passive-SURGE_SURFER.json --run R10
candidate registered: ../../../../tmp/automation-CElaun/candidates/passive-SURGE_SURFER.json
$ queue.mjs validate passive/SURGE_SURFER --run R10
validation FAILED for passive/SURGE_SURFER (1 problem(s)); record is now BLOCKED
- passive SURGE_SURFER: required field resetBehaviour missing or empty
$ queue.mjs next --run R10 --json
[
 {
  "id": "passive/UNOWN",
  "why": "queued",
  "units": [
   "UNOWN_A",
$ queue.mjs unlock --run R10
lock released
$ queue.mjs lock --run R11
lock held by run R11
$ queue.mjs sync --run R11
sync: 0 added, 728 refreshed, 0 removed (now covered, untouched), 0 superseded; 728 records in the queue
$ queue.mjs start passive/PACHIRISU --run R11
passive/PACHIRISU in progress
$ queue.mjs candidate passive/PACHIRISU --file /tmp/automation-CElaun/candidates/passive-SURGE_SURFER.json --run R11
candidate registered: ../../../../tmp/automation-CElaun/candidates/passive-SURGE_SURFER.json
$ queue.mjs validate passive/PACHIRISU --run R11
validation FAILED for passive/PACHIRISU (8 problem(s)); failed attempts 1; the record is blocked at 3 (initial attempt + 2 repairs)
- candidate reviewStatus must be "candidate" (was "reviewed"); review is a human decision recorded elsewhere
- passive PACHIRISU: required field summary missing or empty
- passive PACHIRISU: required field kind missing or empty
- passive PACHIRISU: required field resetBehaviour missing or empty
- passive PACHIRISU: required field dependsOnUnverifiedGenericCombat missing or empty
$ queue.mjs unblock passive/SURGE_SURFER
passive/SURGE_SURFER queued again
$ queue.mjs report --run R10
Batch report for run R10 (production-branch reference; deployment unverified; 07367c34)
records handled: 2 of max 5
- ability/THRASH: work candidate_ready; validation passed; review pending
- passive/SURGE_SURFER: work queued; validation failed (3 failures); review none
queue now: queued 726, candidate_ready 1, in_progress 1
candidates are mechanically validated only and none is reviewed or promoted into data/ or knowledge/

### dependency ordering (fixture)

### common checks against mutated copies of covered records

### branch guard with temporary git repositories
$ branch-guard.mjs head --branch work
ec8dc5c1b1e1f2d807ba7e549874b3c30ecd33ec
$ branch-guard.mjs verify --branch work --expect ec8dc5c1b1e1f2d807ba7e549874b3c30ecd33ec
ok: origin/work still ec8dc5c1b1e1; HEAD descends from it
$ branch-guard.mjs verify --branch main --expect ec8dc5c1b1e1f2d807ba7e549874b3c30ecd33ec
refusing: main is a default branch; automated runs work only on the designated branch
$ branch-guard.mjs scope --expect ec8dc5c1b1e1f2d807ba7e549874b3c30ecd33ec
changes outside assistant/ (not allowed): eadme.md
$ branch-guard.mjs scope --expect ec8dc5c1b1e1f2d807ba7e549874b3c30ecd33ec
ok: 1 changed path(s), all under assistant/
$ branch-guard.mjs push --branch work --expect ec8dc5c1b1e1f2d807ba7e549874b3c30ecd33ec
branch work changed unexpectedly: origin/work is f4fee6a9102230d82ef7fc121a6c136a783aa3f5, this run started from ec8dc5c1b1e1f2d807ba7e549874b3c30ecd33ec. Another writer pushed. STOP: do not merge, rebase or force-push; report and end the run.
$ branch-guard.mjs push --branch work --expect f4fee6a9102230d82ef7fc121a6c136a783aa3f5
ok: origin/work still f4fee6a91022; HEAD descends from it
ok: 1 changed path(s), all under assistant/
pushed HEAD to origin/work

all checks passed
```
