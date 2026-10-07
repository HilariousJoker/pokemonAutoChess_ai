// Output-path guard shared by extract-baseline.ts and extract-evolution.ts.
// Called BEFORE anything is extracted, created or written, so a rejected path leaves every file untouched.
//
// Allowed:   - an extractor's own checkpoint files (intentional reruns);
//            - any other new/untracked `.json` file under assistant/ and any `.json` file outside the repository
//              (explicit scratch outputs).
// Rejected:  - not a `.json` file, or an existing directory;
//            - anything inside the repository but outside assistant/ (game source, precomputed data, root config such as
//              package.json / tsconfig.json / biome.json);
//            - the other extractor's checkpoint files;
//            - any other file under assistant/ that git tracks (committed evidence/notes);
//            - paths that reach one of the above through a symlink (the real path is checked as well as the given one).
import { execFileSync } from "node:child_process"
import { existsSync, realpathSync, statSync } from "node:fs"
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path"

export class OutputGuardError extends Error {}

export interface OutputGuardOptions {
  outPath: string // absolute path (already resolved against the current directory)
  repoRoot: string
  ownCheckpoints: string[] // absolute paths this extractor is allowed to regenerate
  otherCheckpoints: string[] // absolute paths owned by the other extractor
}

// realpath of the nearest existing ancestor + the not-yet-existing remainder (no filesystem changes).
function realTarget(p: string): string {
  const rest: string[] = []
  let cur = resolve(p)
  while (!existsSync(cur)) {
    const parent = dirname(cur)
    if (parent === cur) return resolve(p)
    rest.unshift(basename(cur))
    cur = parent
  }
  return join(realpathSync(cur), ...rest)
}

function isInside(root: string, p: string): string | null {
  const rel = relative(root, p)
  return rel === "" || rel.startsWith("..") || isAbsolute(rel) ? null : rel.split("\\").join("/")
}

export function checkOutputPath(o: OutputGuardOptions): void {
  const repoRoot = realTarget(o.repoRoot)
  const given = resolve(o.outPath)
  const real = realTarget(given)
  const own = new Set(o.ownCheckpoints.flatMap((p) => [resolve(p), realTarget(p)]))
  const other = new Set(o.otherCheckpoints.flatMap((p) => [resolve(p), realTarget(p)]))
  const reject = (why: string): never => {
    throw new OutputGuardError(`refusing output path ${given}${real !== given ? ` (resolves to ${real})` : ""}: ${why}. Nothing was written.`)
  }

  if (extname(given).toLowerCase() !== ".json" || extname(real).toLowerCase() !== ".json") {
    reject("output must be a .json file")
  }
  if (existsSync(real) && !isRegularFile(real)) reject("it is not a regular file (is it a directory?)")

  for (const form of [given, real]) {
    if (other.has(form)) reject("it is a checkpoint file of the other extractor")
  }
  const isOwn = own.has(given) && own.has(real)

  for (const form of [real, given]) {
    const rel = isInside(repoRoot, form) ?? isInside(resolve(o.repoRoot), form)
    if (rel === null) continue // outside the repository: explicit scratch output
    if (!rel.startsWith("assistant/")) {
      reject("it is inside the repository but outside assistant/ (game source, precomputed data or root configuration)")
    }
    if (!isOwn && isTracked(repoRoot, rel)) {
      reject("it is a tracked file under assistant/ that is not this extractor's own checkpoint; use a new scratch path")
    }
  }
}

function isRegularFile(p: string): boolean {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

function isTracked(repoRoot: string, rel: string): boolean {
  try {
    execFileSync("git", ["-C", repoRoot, "ls-files", "--error-unmatch", "--", rel], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}
