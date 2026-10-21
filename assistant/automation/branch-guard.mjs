// Branch and scope guard for automated runs. Uses only git (no network beyond `git fetch/push origin`), never force-pushes,
// never touches a default branch. Exit codes: 0 ok · 1 usage · 3 branch changed unexpectedly / push rejected (STOP, do not retry,
// do not merge or force) · 5 changes outside assistant/ · 6 refused branch (default branch).
//
//   node assistant/automation/branch-guard.mjs head   --branch B            fetch origin/B and print its commit
//   node assistant/automation/branch-guard.mjs verify --branch B --expect SHA   origin/B must still equal SHA, HEAD must descend from SHA, current branch must be B
//   node assistant/automation/branch-guard.mjs scope  --expect SHA          every changed path since SHA (and the working tree) must be under assistant/
//   node assistant/automation/branch-guard.mjs push   --branch B --expect SHA   verify + scope, then a plain (non-force) `git push origin HEAD:B`
// Options: --repo <dir> (default: this repository), --remote <name> (default origin), --no-fetch (tests)
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { REPO } from "./record-checks.mjs"

const argv = process.argv.slice(2)
const cmd = argv[0]
const f = new Map()
for (let i = 1; i < argv.length; i++) if (argv[i].startsWith("--")) f.set(argv[i], argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[++i] : true)
const repo = resolve(f.get("--repo") ?? REPO), remote = f.get("--remote") ?? "origin", branch = f.get("--branch"), expect = f.get("--expect")
const out = (m) => console.log(m)
const stop = (code, m) => { process.stderr.write(m + "\n"); process.exit(code) }
const git = (...a) => { const r = spawnSync("git", ["-C", repo, ...a], { encoding: "utf8" }); return { code: r.status, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() } }

function defaultBranch() {
  const r = git("symbolic-ref", "--short", `refs/remotes/${remote}/HEAD`)
  return r.code === 0 ? r.out.replace(`${remote}/`, "") : null
}
function needBranch() {
  if (!branch || branch === true) stop(1, "--branch <name> is required")
  const d = defaultBranch()
  if (branch === d || ["main", "master"].includes(branch)) stop(6, `refusing: ${branch} is a default branch; automated runs work only on the designated branch`)
}
function fetch() {
  if (f.has("--no-fetch")) return
  const r = git("fetch", remote, branch)
  if (r.code !== 0) stop(3, `cannot fetch ${remote}/${branch}: ${r.err}`)
}
function remoteHead() { const r = git("rev-parse", `refs/remotes/${remote}/${branch}`); if (r.code !== 0) stop(3, `no ${remote}/${branch} after fetch`); return r.out }

function verify() {
  needBranch()
  if (!expect || expect === true) stop(1, "--expect <sha> is required")
  fetch()
  const head = remoteHead()
  if (head !== expect) stop(3, `branch ${branch} changed unexpectedly: ${remote}/${branch} is ${head}, this run started from ${expect}. Another writer pushed. STOP: do not merge, rebase or force-push; report and end the run.`)
  const cur = git("rev-parse", "--abbrev-ref", "HEAD")
  if (cur.out !== branch) stop(3, `checked-out branch is ${cur.out}, not ${branch}`)
  const anc = git("merge-base", "--is-ancestor", expect, "HEAD")
  if (anc.code !== 0) stop(3, `local HEAD does not descend from ${expect}; history was rewritten locally. STOP.`)
  out(`ok: ${remote}/${branch} still ${expect.slice(0, 12)}; HEAD descends from it`)
}
// Paths are parsed from NUL-separated git output (no trimming, no quoting, spaces preserved). Renames are reported by git as
// delete + add (--no-renames), so both the old and the new path are checked, in the working tree, the index and every commit since SHA.
function insideAssistant(p) {
  const parts = p.split("/")
  return parts.length > 1 && parts[0] === "assistant" && !parts.includes("..") && !parts.includes("") && !parts.includes(".")
}
function rawGit(...a) { const r = spawnSync("git", ["-C", repo, ...a], { encoding: "utf8", maxBuffer: 1 << 28 }); return { code: r.status, out: r.stdout ?? "", err: (r.stderr ?? "").trim() } }
function changedPaths(expectSha) {
  const files = new Set()
  const merges = rawGit("rev-list", "--merges", `${expectSha}..HEAD`); if (merges.code !== 0) stop(1, `git rev-list failed: ${merges.err}`)
  if (merges.out.trim()) stop(5, "merge commits since the run started are not allowed (a run must not merge); STOP")
  const log = rawGit("log", "--name-only", "-z", "--no-renames", "--format=", `${expectSha}..HEAD`); if (log.code !== 0) stop(1, `git log failed: ${log.err}`)
  log.out.split("\0").filter((x) => x !== "" && x !== "\n").forEach((x) => files.add(x.replace(/^\n+/, "")))
  const st = rawGit("status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"); if (st.code !== 0) stop(1, `git status failed: ${st.err}`)
  for (const e of st.out.split("\0")) if (e.length > 3) files.add(e.slice(3)) // "XY path": two status letters, one space, then the path verbatim
  return [...files]
}
function scope() {
  if (!expect || expect === true) stop(1, "--expect <sha> is required")
  const files = changedPaths(expect)
  const outside = files.filter((x) => !insideAssistant(x))
  if (outside.length) stop(5, `changes outside assistant/ (not allowed): ${outside.slice(0, 10).map((x) => JSON.stringify(x)).join(", ")}`)
  out(`ok: ${files.length} changed path(s), all under assistant/`)
}

switch (cmd) {
  case "head": needBranch(); fetch(); out(remoteHead()); break
  case "verify": verify(); break
  case "scope": scope(); break
  case "push": {
    verify(); scope()
    const r = git("push", remote, `HEAD:refs/heads/${branch}`)
    if (r.code !== 0) {
      const rejected = /rejected|non-fast-forward|fetch first|stale info/i.test(r.err)
      stop(rejected ? 3 : 1, `push ${rejected ? "REJECTED (branch moved): STOP, no retry, no force" : "failed (network or permission; a plain retry with backoff is allowed)"}: ${r.err.split("\n").slice(-2).join(" ")}`)
    }
    out(`pushed HEAD to ${remote}/${branch}`)
    break
  }
  default: stop(1, "usage: branch-guard.mjs head|verify|scope|push --branch B --expect SHA")
}
