# Catch-up batch 4 progress (aggregate report)

**Production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1`; deployment unverified.** Source-text probes are not live-game verification.

- Start head: `4bf839986ca33e36339348e4b04095a0c1725078` (lock empty; 120 abilities / 386 keys, 4 passive records + 1 gap; 273 candidate_ready, 337 queued, 116 superseded).
- Scope (exactly): Cycle 0 = STRING_SHOT / DYNAMIC_PUNCH / SLACK_OFF description cleanup; Cycle 1 = HYPNOSIS, PLAY_ROUGH, FIRE_FANG, THUNDER_FANG, GUNK_SHOT; Cycle 2 = LICK, ICE_HAMMER, OCTOLOCK, HEADBUTT, BODY_SLAM; Cycle 3 = SPIRIT_BREAK, ROLLOUT, MAGIC_POWDER, METEOR_MASH, CONFUSION; Cycle 4 = ICICLE_CRASH, ECHO, HYPER_VOICE, AURASPHERE, NIGHT_SHADE.
- Resume rule: read this file, `git log` and `queue.mjs status`; start at the first cycle not marked complete; never redo a completed cycle.

| Cycle | Status | Records | Checkpoint commit | Notes |
|---|---|---|---|---|
| 0 | complete | STRING_SHOT (Quartz (1 - 0.2n) only in STORM; damage attempted independently), DYNAMIC_PUNCH (same wording), SLACK_OFF (curse +2000 only when curse true and cooldown > 0); counts unchanged 120 / 386 | commit 'Checkpoint batch4 cycle 0' (see git log) | lock `run-20261112T193010Z` released; probe section 43; all checks passed; no historical validation timestamps altered |
| 1 | not started | – | – | – |
| 2 | not started | – | – | – |
| 3 | not started | – | – | – |
| 4 | not started | – | – | – |

Next unfinished cycle: 1.
