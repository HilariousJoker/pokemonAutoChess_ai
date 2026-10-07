// Shared start-up checks for the probes (production-branch reference; deployment unverified, pinned 07367c34).
// Run BEFORE any scenario: (1) strict argument parsing, (2) game source outside assistant/ must equal the pinned revision,
// (3) the existing output guard (../output-guard.ts) protects game files, root config and tracked assistant files.
// Allowed outputs: this probe's own result file (intentional regeneration) and explicit scratch .json files
// (outside the repo, or new untracked files under assistant/). Everything else is refused before anything runs or is written.
import { execFileSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { checkOutputPath, OutputGuardError } from "../output-guard"

export const PINNED_SHA = "07367c341fe928763da2b565c2eee010433e4fc1"
const PROBES_DIR = dirname(resolve(process.argv[1]))
const REPO_ROOT = resolve(PROBES_DIR, "..", "..")
const DATA = (...p: string[]) => resolve(REPO_ROOT, "assistant", "data", ...p)
// every dataset checkpoint of the assistant is protected from probe output; probe result files are decided per probe
const DATASETS = [
  DATA("baseline.json"), DATA("01a3e845", "pilot-units.json"), DATA("01a3e845", "pilot-evolution.json"),
  DATA("07367c34", "pilot-units.json"), DATA("07367c34", "pilot-evolution.json"), DATA("07367c34", "catalog-units.json"),
  DATA("07367c34", "pilot-abilities.json"),
  resolve(PROBES_DIR, "results", "regional-pikachu-probe.json"), resolve(PROBES_DIR, "results", "cosmog-evolution-probe.json") // each probe regenerates only its own (removed below)
]

function die(msg: string): never {
  console.error(`probe: ${msg}`)
  process.exit(1)
}
const git = (...a: string[]) => execFileSync("git", ["-C", REPO_ROOT, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()

/** Returns the validated absolute output path. `ownResult` = this probe's committed result file (may be regenerated). */
export function probeStartup(ownResult: string): string {
  const argv = process.argv.slice(2)
  let out: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--out") {
      const v = argv[++i]
      if (!v || v.startsWith("--")) die("--out requires a file path")
      if (out !== undefined) die("--out given more than once")
      out = v
    } else if (a.startsWith("--out=")) {
      if (out !== undefined) die("--out given more than once")
      out = a.slice("--out=".length)
      if (!out) die("--out requires a file path")
    } else die(`unknown or malformed argument "${a}" (usage: --out <file.json>)`)
  }
  if (out === undefined) die("--out <file.json> is required")
  const outPath = resolve(process.cwd(), out)
  const own = resolve(ownResult)
  try {
    checkOutputPath({ outPath, repoRoot: REPO_ROOT, ownCheckpoints: [own], otherCheckpoints: DATASETS.filter((c) => c !== own) })
  } catch (e) {
    if (e instanceof OutputGuardError) die(e.message)
    throw e
  }
  let differing: string[] = [], untracked: string[] = [], head = ""
  try {
    head = git("rev-parse", "HEAD")
    git("cat-file", "-e", `${PINNED_SHA}^{commit}`)
    const notAssistant = ["--", ".", ":(exclude)assistant"]
    differing = git("diff", "--name-only", PINNED_SHA, ...notAssistant).split("\n").filter(Boolean)
    untracked = git("ls-files", "--others", "--exclude-standard", ...notAssistant).split("\n").filter(Boolean)
  } catch (e: any) {
    die(`cannot verify the pinned revision ${PINNED_SHA}: ${String(e.stderr ?? e.message).trim()}`)
  }
  if (differing.length || untracked.length) {
    die(`game source outside assistant/ does not match pinned revision ${PINNED_SHA}: ${differing.length} tracked file(s) differ (${differing.slice(0, 3).join(", ")}), ${untracked.length} untracked (HEAD ${head}). Refusing to label this checkout as that revision.`)
  }
  return outPath
}
