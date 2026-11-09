# Catch-up maintenance progress (aggregate report)

**Production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1`; deployment unverified.** Source-text probes are not live-game verification.

- Start head: `918ad7ad3fbea4c6375b53284e9f7a885bda187f` (equal to the Codex-reviewed head; lock empty; 60 canonical ability records / 221 keys, 4 passive records + 1 gap; 333 candidate_ready, 337 queued, 56 superseded).
- Scope (exactly): Cycle 0 = two canonical cleanups (PSYSHOCK summary clause, PSYBEAM statusEffects wording); Cycle 1 = RAPID_SPIN, REFLECT, ROCK_HEAD, ROCK_SMASH, ROCK_WRECKER; Cycle 2 = SAND_TOMB, SCREECH, SEED_FLARE, SHADOW_SNEAK, SHEER_COLD; Cycle 3 = SHORE_UP, SOLAR_BEAM, SPLASH, SUPER_FANG, TAILWIND; Cycle 4 = TAIL_WHIP, TICKLE, TOXIC, WATERFALL, YAWN. Nothing else is touched.
- Resume rule: read this file, `git log`, and `queue.mjs status`; start at the first cycle below not marked complete; never redo a completed cycle; if a lock from this task is held and stale, follow AUTOMATION.md (takeover after 180 min only).

| Cycle | Status | Records | Checkpoint commit | Notes |
|---|---|---|---|---|
| 0 | complete | PSYSHOCK, PSYBEAM (canonical cleanup, no reopen; counts unchanged 60 / 221) | `6d6d2014bdcb879b7bbccf255a4ce7716378d641` | lock `run-20261109T193909Z` released; validate, FAST and production suites, probe, automation, inventory, queue checks passed |
| 1 | complete | RAPID_SPIN, REFLECT, ROCK_HEAD, ROCK_SMASH, ROCK_WRECKER imported (65 / 231 expected) | `355b87e9e0a323972e98ca06eb48a09137c773ea` | lock `run-20261109T194233Z`; ROCK_WRECKER flinch-reduction blocker fixed; REFLECT / ROCK_SMASH / ROCK_WRECKER statusEffects normalised (reopened a second time within the run) |
| 2 | complete | SAND_TOMB, SCREECH, SEED_FLARE, SHADOW_SNEAK, SHEER_COLD imported (70 / 241 expected; measured below in the final report) | commit 'Checkpoint cycle 2: ...' (see git log) | lock `run-20261109T195151Z`; SAND_TOMB attempts/Cheri Berry, SCREECH no timer, SEED_FLARE clipped disc, SHADOW_SNEAK TRUE guards, SHEER_COLD Math.max(0,x)/9999 requested; all seven checks passed |
| 3 | not started | – | – | – |
| 4 | not started | – | – | – |

Next unfinished cycle: 3.
