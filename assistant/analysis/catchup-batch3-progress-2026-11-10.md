# Catch-up batch 3 progress (aggregate report)

**Production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1`; deployment unverified.** Source-text probes are not live-game verification.

- Start head: `0a47ecebbdeeac76df78b4e72b596df7a924938e` (lock empty; 100 abilities / 334 keys, 4 passive records + 1 gap; 293 candidate_ready, 337 queued, 96 superseded).
- Scope (exactly): Cycle 0 = QUIVER_DANCE / HAPPY_HOUR scaling wording and removal of the empty `assistant/0`; Cycle 1 = MAGIC_BOUNCE, RECOVER, SLACK_OFF, SOFT_BOILED, AURORA_VEIL; Cycle 2 = DYNAMIC_PUNCH, FAKE_OUT, POWER_HUG, STRING_SHOT, BURN_UP; Cycle 3 = MUD_SHOT, ROCK_TOMB, SLASHING_CLAW, COIL, GROWL; Cycle 4 = POLTERGEIST, ORIGIN_PULSE, ASSURANCE, SHADOW_BALL, WAVE_SPLASH. Nothing else is touched.
- Resume rule: read this file, `git log` and `queue.mjs status`; start at the first cycle below not marked complete; never redo a completed cycle.

| Cycle | Status | Records | Checkpoint commit | Notes |
|---|---|---|---|---|
| 0 | complete | QUIVER_DANCE / HAPPY_HOUR single-rounding scaling wording; empty unused `assistant/0` removed (counts unchanged 100 / 334) | `9d564d88154f716b7a6e03ce0c463eb1eb3280f1` | lock `run-20261110T010523Z` released; probe section 38 with non-integer AP / crit products; all checks passed |
| 1 | complete | MAGIC_BOUNCE, RECOVER, SLACK_OFF, SOFT_BOILED, AURORA_VEIL imported (105 / 347 expected; measured in the final report) | `ce020c7ad97367600cc13c92fb0c70d64439603d` | lock `run-20261110T010810Z`; applier numeral helper extended past ninety-nine and one re-apply after a tooling error (candidate files refreshed to the final content); all seven checks passed |
| 2 | complete | DYNAMIC_PUNCH, FAKE_OUT, POWER_HUG, STRING_SHOT, BURN_UP imported (110 / 360 expected; measured in the final report) | `a618a0271490f6c632cd09db1ae8c3c23aced6dc` | lock `run-20261110T011535Z`; status entries normalised; all seven checks passed |
| 3 | complete | MUD_SHOT, ROCK_TOMB, SLASHING_CLAW, COIL, GROWL imported (115 / 374 expected; measured in the final report) | `701d696bf3a757f78445942a1196f25ee4d38b24` | lock `run-20261110T012215Z`; probe sections renamed CATCHUP_D1-D3 to avoid reusing the earlier C1-C3 names (cycle 1 and 2 records updated); all seven checks passed |
| 4 | complete | POLTERGEIST, ORIGIN_PULSE, ASSURANCE, SHADOW_BALL, WAVE_SPLASH imported | commit 'Checkpoint batch3 cycle 4' (hash in the final report) | lock `run-20261110T012829Z`; all seven checks passed |

Next unfinished cycle: none (all five cycles complete; the task stops after these 20 records).
