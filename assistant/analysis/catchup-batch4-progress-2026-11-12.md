# Catch-up batch 4 progress (aggregate report)

**Production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1`; deployment unverified.** Source-text probes are not live-game verification.

- Start head: `4bf839986ca33e36339348e4b04095a0c1725078` (lock empty; 120 abilities / 386 keys, 4 passive records + 1 gap; 273 candidate_ready, 337 queued, 116 superseded).
- Scope (exactly): Cycle 0 = STRING_SHOT / DYNAMIC_PUNCH / SLACK_OFF description cleanup; Cycle 1 = HYPNOSIS, PLAY_ROUGH, FIRE_FANG, THUNDER_FANG, GUNK_SHOT; Cycle 2 = LICK, ICE_HAMMER, OCTOLOCK, HEADBUTT, BODY_SLAM; Cycle 3 = SPIRIT_BREAK, ROLLOUT, MAGIC_POWDER, METEOR_MASH, CONFUSION; Cycle 4 = ICICLE_CRASH, ECHO, HYPER_VOICE, AURASPHERE, NIGHT_SHADE.
- Resume rule: read this file, `git log` and `queue.mjs status`; start at the first cycle not marked complete; never redo a completed cycle.

| Cycle | Status | Records | Checkpoint commit | Notes |
|---|---|---|---|---|
| 0 | complete | STRING_SHOT (Quartz (1 - 0.2n) only in STORM; damage attempted independently), DYNAMIC_PUNCH (same wording), SLACK_OFF (curse +2000 only when curse true and cooldown > 0); counts unchanged 120 / 386 | `8f4de7ec5e9d4b8c18766cb55fb9eab49695fe37` | lock `run-20261112T193010Z` released; probe section 43; all checks passed; no historical validation timestamps altered |
| 1 | complete | HYPNOSIS, PLAY_ROUGH, FIRE_FANG, THUNDER_FANG, GUNK_SHOT imported (13 keys; abilities 125 / keys 399) | `2d2fc348970ad73693c57ec77b2a6312ec7f3e1e` | lock `run-20261112T193417Z` released; probe section 44 (CATCHUP_E1); queue sync preceded the per-record queue validate, so the shared record checks ran through validate-abilities.mjs (130 records) instead; GUNK_SHOT sourceTables path switched to statusEffects.0.declaredRaw.byStars |
| 2 | complete | LICK, ICE_HAMMER, OCTOLOCK, HEADBUTT, BODY_SLAM imported (16 keys; abilities 130 / keys 415) | (this commit; see git log 'Checkpoint batch4 cycle 2') | lock `run-20261112T195249Z` released; probe section 45 (CATCHUP_E2, includes the real getTargetWhenConfused text reused by cycle 3); sync again preceded the per-record queue validate, so the shared record checks ran through validate-abilities.mjs (135 records); queue 126 superseded / 263 candidate_ready / 337 queued |
| 3 | not started | – | – | – |
| 4 | not started | – | – | – |

Next unfinished cycle: 3.
