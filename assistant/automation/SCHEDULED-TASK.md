# Scheduled-task prompt and setup (NOT created, NOT enabled)

**No schedule exists.** This file only stores the exact prompt and setup steps so a schedule can be created later on purpose. Production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1`; deployment unverified.

## Exact prompt (paste unchanged as the scheduled task's prompt)
```
Repository HilariousJoker/pokemonAutoChess_ai. Work only on branch claude/great-volta-v6znve (never the default branch) and only inside assistant/. Pinned game source: commit 07367c341fe928763da2b565c2eee010433e4fc1 (read with git show; deployment unverified).

First run: git fetch origin claude/great-volta-v6znve && git checkout -B claude/great-volta-v6znve origin/claude/great-volta-v6znve. Then read assistant/AUTOMATION.md and follow its "Worker instruction" exactly: baseline checks, take the single-writer lock, process at most five queued ability/passive records from assistant/automation/queue.json (resume in-progress ones first), write candidates only under assistant/candidates/07367c34/, validate with the shared checks, after two unsuccessful repairs on one record mark it blocked and continue with independent work, save progress and push after every record with node assistant/automation/branch-guard.mjs push, release the lock, and finish with one concise batch report (node assistant/automation/queue.mjs report).

Hard limits: stop immediately (no merge, no rebase, no force-push) if the branch changed unexpectedly or the lock is held by another run; change nothing outside assistant/; no installs, servers, subagents, parallel sessions, pull requests or merges; never edit data/, knowledge/, match-reference.md, ASK.md, lookups or automation/review-status.json; never mark anything reviewed or promote a candidate. Candidates are source-reading records with mechanical validation only, not gameplay evidence.
```

## Setup (when you decide to enable it)
1. Do one **manual** run first: open a new Claude Code cloud session on this repository and paste the same prompt. Check the report, the diff (only `assistant/`), `node assistant/automation/queue.mjs status`, and `node assistant/automation/test-automation.mjs`.
2. Create the scheduled task in the Claude Code on the web interface (or ask a session to use its scheduled-task tool) with: this prompt; **a fresh session per run** (each run starts from the saved files, not from chat memory); this repository; the environment you already use for this project; a cadence of **once a day or slower** (hourly is the platform minimum; more frequent runs only add review backlog); notifications on.
3. Because a run may start on the default branch, the prompt's first command moves it to `claude/great-volta-v6znve`; do not change that.
4. Pause or delete the schedule when the review backlog (`candidate_ready` with review `pending`) grows faster than you review; review and promotion are human steps (see AUTOMATION.md, "Human steps").
5. A run that dies leaves a lock in `queue.json`; a later run takes it over after 180 minutes (logged). To clear it sooner, edit `lock` to `null` by hand and push.

## What this does not do
It does not enforce an account-credit, token or time limit: runs are bounded only by record count (five) and repair attempts (two). Check usage in your account settings. It does not review or promote anything.
