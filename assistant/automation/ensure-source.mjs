// Makes the pinned production-reference source readable in THIS clone, reproducibly (production-branch reference; deployment unverified).
// The pinned commit is a merge commit of the official upstream repository and is NOT an ancestor of the working branch, so a fresh
// clone may not contain it. If it is missing, this fetches EXACTLY that commit, read-only, into the object store (no branch, no tag,
// no checkout, no merge) from the official upstream, then verifies it. It never fetches a branch head and accepts no other commit.
//
//   node assistant/automation/ensure-source.mjs            verify; fetch the exact commit if missing
//   node assistant/automation/ensure-source.mjs --check    verify only (no network); exit 3 if missing
// Exit codes: 0 available and verified · 3 missing/not verifiable (STOP the run and report; do not substitute another commit).
import { spawnSync } from "node:child_process"
import { SHA, REPO } from "./record-checks.mjs"

const UPSTREAM = "https://github.com/keldaanCommunity/pokemonAutoChess.git"
const MARKERS = ["app/core/abilities/abilities.ts", "app/core/pokemon-entity.ts", "app/models/colyseus-models/pokemon.ts", "app/config/game/battle.ts"]
const git = (...a) => { const r = spawnSync("git", ["-C", REPO, ...a], { encoding: "utf8", maxBuffer: 1 << 24 }); return { code: r.status, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() } }
const stop = (m) => { process.stderr.write(`ensure-source: ${m}\n`); process.exit(3) }
const present = () => git("cat-file", "-e", `${SHA}^{commit}`).code === 0

function verify() {
  const t = git("rev-parse", `${SHA}^{commit}`)
  if (t.code !== 0 || t.out !== SHA) stop(`commit ${SHA} is not readable here`)
  for (const m of MARKERS) if (git("cat-file", "-e", `${SHA}:${m}`).code !== 0) stop(`${m} is not readable at ${SHA} (incomplete object store; the commit's tree must be fully present)`)
  const one = git("show", `${SHA}:app/core/abilities/abilities.ts`)
  if (one.code !== 0 || !one.out.includes("export const AbilityStrategies")) stop("abilities.ts at the pinned commit is not as expected")
}

if (!present()) {
  if (process.argv.includes("--check")) stop(`pinned commit ${SHA} is missing (run without --check to fetch exactly that commit)`)
  console.log(`pinned commit missing; fetching exactly ${SHA} (depth 1, read-only) from ${UPSTREAM}`)
  const f = git("fetch", "--no-tags", "--depth=1", "--no-write-fetch-head", UPSTREAM, SHA)
  if (f.code !== 0) stop(`fetch of ${SHA} from ${UPSTREAM} failed: ${f.err.split("\n").slice(-2).join(" ")}. STOP: do not use another commit or the current upstream head; report this.`)
}
verify()
console.log(`ok: ${SHA} readable (${git("log", "-1", "--format=%an %ad", "--date=short", SHA).out}); no branch, checkout or merge involved`)
