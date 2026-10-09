// Tests for lookup-item.mjs (read-only item lookup). Production-branch reference; deployment unverified.
// Usage: node assistant/test-lookup-item.mjs   (exit 0 = all pass). Writes only temporary fixtures in the OS temp dir.
// The timing section reports LOCAL PROCESS time only; it says nothing about model/tool response time.
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = resolve(HERE, "lookup-item.mjs"), DATA = resolve(HERE, "data/07367c34")
const run = (args) => { const r = spawnSync(process.execPath, [TOOL, ...args], { encoding: "utf8" }); return { code: r.status, out: r.stdout, err: r.stderr } }
let pass = 0, fail = 0
const ok = (cond, name, extra = "") => { if (cond) { pass++; console.log("PASS ", name) } else { fail++; console.log("FAIL ", name, extra) } }
const rs = JSON.parse(readFileSync(join(DATA, "item-recipes-stats.json"), "utf8")), fx = JSON.parse(readFileSync(join(DATA, "item-effects.json"), "utf8"))
const keys = rs.recipes.map((r) => r.result)

const treeHash = (dir) => { const h = createHash("sha256"); const walk = (d) => { for (const n of readdirSync(d).sort()) { if (n === "node_modules" || n === ".git") continue; const f = join(d, n); const st = statSync(f); if (st.isDirectory()) walk(f); else h.update(f + "\0" + readFileSync(f)) } }; walk(dir); return h.digest("hex") }
const before = treeHash(HERE)

// 1. coverage
const list = run(["--list"])
ok(list.code === 0 && keys.length === 55 && keys.every((k) => list.out.includes(k)) && /Coverage: 55 /.test(list.out), "--list reports all 55 recipe outputs")
ok((list.out.match(/^Snapshot:/gm) ?? []).length === 1, "--list prints the snapshot label once")

// 2. every item resolves by enum key and by its ordinary (display) name, with identical output
let allResolve = true, allAgree = true, firstBad = ""
for (const k of keys) {
  const a = run([k]); const m = a.out.match(/^(.+)  \(([A-Z0-9_]+)\)$/m)
  if (a.code !== 0 || !m || m[2] !== k) { allResolve = false; firstBad ||= k; continue }
  const b = run([m[1]]); const c = run([m[1].toLowerCase()])
  if (b.code !== 0 || b.out !== a.out || c.out !== a.out) { allAgree = false; firstBad ||= k + " (name)" }
}
ok(allResolve, "all 55 enum keys resolve", firstBad)
ok(allAgree, "ordinary names (and lowercase) give the same card as the enum key", firstBad)
for (const [name, key] of [["soul dew", "SOUL_DEW"], ["Soul-Dew", "SOUL_DEW"], ["X Ray Vision", "XRAY_VISION"], ["x-ray vision", "XRAY_VISION"], ["Kings Rock", "KINGS_ROCK"], ["Poke Doll", "POKE_DOLL"], ["Poké Doll", "POKE_DOLL"], ["Heavy Duty Boots", "HEAVY_DUTY_BOOTS"]]) {
  const r = run([name]); ok(r.code === 0 && r.out.includes(`(${key})`), `alias/normalization: ${name} -> ${key}`)
}

// 3. multi-item, duplicates, component queries
const multi = run(["Soul Dew", "Choice Specs", "Aqua Egg"])
ok(multi.code === 0 && (multi.out.match(/^Snapshot:/gm) ?? []).length === 1 && ["SOUL_DEW", "CHOICE_SPECS", "AQUA_EGG"].every((k) => multi.out.includes(`(${k})`)) && multi.out.indexOf("(SOUL_DEW)") < multi.out.indexOf("(CHOICE_SPECS)") && multi.out.indexOf("(CHOICE_SPECS)") < multi.out.indexOf("(AQUA_EGG)"), "multi-item query: one snapshot, three cards, order kept")
ok((run(["Soul Dew", "SOUL_DEW"]).out.match(/\(SOUL_DEW\)/g) ?? []).length === 1, "duplicate items are shown once")
for (const [comp, key] of [["Silk Scarf", "SILK_SCARF"], ["Fossil Stone", "FOSSIL_STONE"], ["Never-Melt Ice", "NEVER_MELT_ICE"], ["magnet", "MAGNET"]]) {
  const expected = rs.recipes.filter((r) => r.ingredients.includes(key)).map((r) => r.result)
  const r = run(["--component", comp])
  ok(r.code === 0 && expected.length > 0 && expected.every((k) => r.out.includes(`(${k})`)) && (r.out.match(/^[^\n]+ \([A-Z0-9_]+\): /gm) ?? []).length === expected.length, `--component ${comp} lists exactly its ${expected.length} recipe outputs`)
}
ok(run(["--component", "Silk Scarf"]).out.includes("(10)"), "Silk Scarf component query reports 10 outputs")

// 4. failures: unknown, prototype-like, malformed, outside coverage
for (const bad of [["Banana"], ["Soul"], ["Soul Dew Extra"], [""], ["   "], ["__proto__"], ["constructor"], ["toString"], ["hasOwnProperty"], ["prototype"], ["Eviolite"], ["Shiny Stone"], ["--bogus"], [], ["--component"], ["--component", "--list"], ["--component", "Soul Dew"], ["--component", "Silk Scarf", "Fossil Stone"], ["--list", "Soul Dew"], ["Soul Dew", "--list"], ["--list", "--component", "Magnet"], ["--data-dir"]]) {
  const r = run(bad)
  ok(r.code === 1 && r.out === "" && r.err.length > 0, `fails clearly (exit 1, no stdout): ${JSON.stringify(bad)}`, `code=${r.code} err=${r.err.slice(0, 80)}`)
}
ok(/outside this 55-item/.test(run(["Eviolite"]).err), "Eviolite is reported as outside the catalog, not given an effect")
ok(/Unknown item/.test(run(["__proto__"]).err), "prototype-like names are plain unknown items")

// 5. fixtures: revisions, missing/inconsistent data, ambiguity (temporary directories only)
const tmp = mkdtempSync(join(tmpdir(), "lookup-item-test-"))
const fixture = (name, mutate) => { const d = join(tmp, name); cpSync(DATA, d, { recursive: true }); const e = JSON.parse(readFileSync(join(d, "item-effects.json"), "utf8")), r = JSON.parse(readFileSync(join(d, "item-recipes-stats.json"), "utf8")); mutate(e, r, d); writeFileSync(join(d, "item-effects.json"), JSON.stringify(e)); writeFileSync(join(d, "item-recipes-stats.json"), JSON.stringify(r)); return d }
const runIn = (d, args) => run(["--data-dir", d, ...args])
ok(runIn(fixture("ok", () => {}), ["Soul Dew"]).code === 0, "fixture copy of the real data works")
ok(runIn(fixture("sha-e", (e) => { e.sourceSha = "01a3e845e91ebe3144b3c43fa9cd261a5dadafd2" }), ["Soul Dew"]).code === 3, "item-effects.json from another revision is refused (exit 3)")
ok(runIn(fixture("sha-r", (e, r) => { r.sourceSha = "0".repeat(40) }), ["Soul Dew"]).code === 3, "item-recipes-stats.json from another revision is refused (exit 3)")
ok(runIn(fixture("label", (e) => { e.label = "development snapshot" }), ["--list"]).code === 3, "wrong snapshot label is refused (exit 3)")
const broken = fixture("broken", () => {}); writeFileSync(join(broken, "item-recipes-stats.json"), "{")
ok(runIn(broken, ["Soul Dew"]).code === 2, "unreadable data fails (exit 2)")
ok(runIn(join(tmp, "nonexistent"), ["Soul Dew"]).code === 2, "missing data directory fails (exit 2)")
ok(runIn(fixture("recipe-mismatch", (e) => { e.items.SOUL_DEW.recipe.ingredients = ["MAGNET", "MAGNET"] }), ["Soul Dew"]).code === 2, "recipe disagreement between the two files fails (exit 2)")
ok(runIn(fixture("stats-mismatch", (e) => { e.items.SOUL_DEW.declaredStats = { AP: 1 } }), ["Soul Dew"]).code === 2, "declared-stat disagreement fails (exit 2)")
ok(runIn(fixture("nosummary", (e) => { delete e.items.SOUL_DEW.summary }), ["Soul Dew"]).code === 2, "missing required card field fails (exit 2)")
ok(runIn(fixture("missing-item", (e) => { delete e.items.SOUL_DEW }), ["Soul Dew"]).code === 2, "item missing from one file fails (exit 2)")
const amb = fixture("ambiguous", (e, r) => { e.items["SOUL-DEW"] = { ...e.items.SOUL_DEW, displayName: "Soul-Dew" }; r.recipes.push({ result: "SOUL-DEW", ingredients: r.recipes.find((x) => x.result === "SOUL_DEW").ingredients, line: 999 }); r.itemStats.push({ item: "SOUL-DEW", values: {}, lines: [999, 999] }) })
const ra = runIn(amb, ["Soul Dew"])
ok(ra.code === 1 && /Ambiguous/.test(ra.err), "two keys with the same normalized name: ambiguous input fails, no guess")
ok(runIn(amb, ["SOUL_DEW"]).code === 0, "an exact enum key stays unambiguous even then")
rmSync(tmp, { recursive: true, force: true })

// 6. cards keep important conditions (compact text must not lose them)
const cardOf = (k) => run([k]).out
const has = (k, ...res) => ok(res.every((re) => re.test(cardOf(k))), `${k} card keeps its key conditions`, res.map(String).join(" "))
has("NULLIFY_BANDANNA", /cannot cast/, /current PP as special damage/, /PP to 0/, /AP gains become Attack/, /positive or negative/)
has("PROTECTIVE_PADS", /doubled damage against shields/, /only to a target that has a shield/, /excess goes to HP/, /nothing is doubled against unshielded/)
has("WIDE_LENS", /does not enlarge|Range does not enlarge/, /Blast Burn/, /inference/)
has("FLAME_ORB", /attempts to burn/, /Rune Protect/, /burn immunity/, /Water Bubble/, /\+ATK still applies/)
has("DUSK_STONE", /MovingState/, /not a guaranteed first attack/, /ordinary base counting/, /Dragon doubling/, /Removal differs by path/)
has("SCOPE_LENS", /not guaranteed/, /Twist Band/)
has("RAZOR_CLAW", /ABILITY_CRIT or an ability that crits by default/)
has("SMOKE_BALL", /survives a damaging hit/, /does not save a lethal hit/, /fight entity/)
has("SHELL_BELL", /basic attacks or abilities/)
has("BIG_EATER_BELT", /same-team sources/, /enemies or the environment are not scaled/)
ok(/Snapshot:/.test(cardOf("SOUL_DEW")) && /Source note: knowledge\/07367c34\/item-effects\.md#soul_dew/.test(cardOf("SOUL_DEW")), "cards carry the snapshot label and one source-note link")
ok((cardOf("NULLIFY_BANDANNA").match(/Source note:/g) ?? []).length === 1, "exactly one source-note link per card")
ok(!/allowance note|Crafting and allowance/.test(multi.out + cardOf("NULLIFY_BANDANNA")), "cards do not repeat the long scarf allowance note")

// 7. read-only: no file changes, no write/network/process APIs in the tool
ok(treeHash(HERE) === before, "assistant/ tree is byte-identical after all lookups")
const src = readFileSync(TOOL, "utf8")
ok(!/writeFile|appendFile|mkdir|unlink|rmSync|child_process|node:http|node:net|fetch\(|require\(|import\(|\.\.\/app|from "\.\.\//.test(src), "tool source has no write, network, process or game-code imports")
ok(/import \{ readFileSync \} from "node:fs"/.test(src), "only readFileSync is imported from node:fs")

// 8. local timing (informational)
const times = []
for (let i = 0; i < 20; i++) { const t = process.hrtime.bigint(); run(["Soul Dew", "Choice Specs", "Aqua Egg"]); times.push(Number(process.hrtime.bigint() - t) / 1e6) }
times.sort((a, b) => a - b)
console.log(`INFO  local command wall time (node start + 3-item lookup), 20 runs: median ${times[10].toFixed(0)} ms, min ${times[0].toFixed(0)} ms, max ${times[19].toFixed(0)} ms — local process time only, NOT Claude/tool response time`)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
