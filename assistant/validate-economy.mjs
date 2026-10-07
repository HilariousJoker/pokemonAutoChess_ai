// Validates data/07367c34/economy-leveling.json against the pinned source (read with `git show <sha>:<path>`), against the executed probe
// results, and checks that knowledge/07367c34/economy-leveling.md agrees with the record.
// Production-branch reference; deployment unverified. Usage: node assistant/validate-economy.mjs   (exit 0 = all checks pass)
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { isDeepStrictEqual as eq } from "node:util"

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, "..")
const SHA = "07367c341fe928763da2b565c2eee010433e4fc1"
const data = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/economy-leveling.json"), "utf8"))
const probe = JSON.parse(readFileSync(resolve(HERE, "probes/results/economy-probe.json"), "utf8"))
const md = readFileSync(resolve(HERE, "knowledge/07367c34/economy-leveling.md"), "utf8")
const norm = (s) => s.replace(/\s+/g, " ").trim()
const problems = [], bad = (m) => problems.push(m)
const cache = new Map()
const src = (f) => { if (!cache.has(f)) cache.set(f, execFileSync("git", ["-C", REPO, "show", `${SHA}:${f}`], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\n")); return cache.get(f) }
if (data.sourceSha !== SHA || probe.sourceSha !== SHA) bad("sourceSha mismatch")

// 1. evidence lines contain the expected text; every reference resolves
const ids = new Set()
for (const e of data.evidence) {
  if (ids.has(e.id)) bad(`duplicate evidence id ${e.id}`)
  ids.add(e.id)
  const L = src(e.file), [a, b] = e.lines
  if (!(a >= 1 && b >= a && b <= L.length)) { bad(`${e.id}: bad range ${a}-${b}`); continue }
  if (!norm(L.slice(a - 1, b).join(" ")).includes(norm(e.expect))) bad(`${e.id}: "${e.expect}" not in ${e.file}:${a}-${b}`)
}
for (const [name, r] of Object.entries(data.rules)) {
  for (const id of [...(r.evidence ?? []), ...(r.evidenceExtra ?? [])]) if (!ids.has(id)) bad(`${name}: unknown evidence ${id}`)
  if (!r.unresolvedModifiers?.length) bad(`${name}: no unresolvedModifiers`)
}

// 2. declared values equal the source
const text = (f) => src(f).join("\n")
const num = (f, re) => { const m = text(f).match(re); if (!m) { bad(`pattern not found ${re}`); return NaN } return Number(m[1]) }
const R = data.rules
const check = (what, rec, srcv) => { if (rec !== srcv) bad(`${what}: record ${rec} vs source ${srcv}`) }
check("starting gold", R.startingGold.declared.value, num("app/models/colyseus-models/player.ts", /money = process\.env\.MODE == "dev" \? \d+ : (\d+)/))
check("dev gold", R.startingGold.declared.devModeValue, num("app/models/colyseus-models/player.ts", /money = process\.env\.MODE == "dev" \? (\d+) :/))
check("interest divisor", R.roundIncome.declared.interestDivisor, num("app/rooms/commands/game-commands.ts", /Math\.floor\(player\.money \/ (\d+)\)/))
check("default max interest", R.roundIncome.declared.maxInterestDefault, num("app/rooms/commands/game-commands.ts", /player\.maxInterest = (\d+) \+/))
check("streak cap", R.roundIncome.declared.streakBonusCap, num("app/rooms/commands/game-commands.ts", /income \+= max\((\d+)\)\(player\.streak\)/))
check("base income", R.roundIncome.declared.baseIncomePerRound, num("app/rooms/commands/game-commands.ts", /\n\s+income \+= (\d+)\n/))
check("auto xp", R.automaticXp.declared.amount, num("app/rooms/commands/game-commands.ts", /player\.addExperience\((\d+)\)\n\s+\}\n\s+\}\)/))
check("buy xp amount", R.buyXp.declared.xpGained, num("app/rooms/commands/game-commands.ts", /player\.addExperience\((\d+)\)\n\s+player\.money -= cost/))
check("buy xp cost", R.buyXp.declared.goldCost, num("app/models/colyseus-models/experience-manager.ts", /const cost = (\d+)/))
check("max level", R.levels.declared.maxLevel, num("app/models/colyseus-models/experience-manager.ts", /this\.maxLevel = (\d+)/))
check("start level", R.levels.declared.startLevel, num("app/models/colyseus-models/experience-manager.ts", /this\.level = (\d+)/))
check("win gold", R.winLossStreak.declared.winGoldPvP, num("app/core/simulation.ts", /hasLeadersCrest \? \d+ : (\d+)/))
check("win gold (leaders crest)", R.winLossStreak.declared.winGoldWithLeadersCrest, num("app/core/simulation.ts", /hasLeadersCrest \? (\d+) :/))
check("paid reroll", R.reroll.declared.paidCost, num("app/rooms/commands/game-commands.ts", /shopFreeRolls > 0 \? 0 : (\d+)/))
const table = {}
for (const m of text("app/config/game/experience.ts").matchAll(/^\s+(\d+): (\d+),?$/gm)) table[m[1]] = Number(m[2])
const decl = R.levels.declared
for (let n = 2; n <= 8; n++) check(`ExpTable[${n}]`, decl.xpToNextLevel[n], table[n])
let cum = 0
for (let n = 2; n <= 8; n++) { cum += table[n]; check(`cumulative XP to reach ${n + 1}`, decl.cumulativeXpToReach[n + 1], cum) }
if (!eq(probe.experienceManager.expTable, Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v])))) bad("probe ExpTable differs from source table")
const pve = text("app/models/pve-stages.ts").split("export const PVEStages")[1].match(/^  \d+: \{/gm).map((x) => Number(x.match(/\d+/)[0]))
if (!eq(pve, [1, 2, 3, 9, 14, 19, 24, 28, 32, 36, 40])) bad(`PVEStages keys now ${pve}`)

// 3. boundary examples equal the executed probe results
for (const [i, r] of probe.computeIncome.entries()) {
  const g = R.roundIncome.boundaryExamples[i]
  if (!g || !eq(g, { moneyBefore: r.moneyBefore, streak: r.streak, isPVE: r.isPVE, interest: r.interest, maxInterest: r.maxInterest, incomeAwarded: r.incomeAwarded })) bad(`income example ${i} differs from the probe`)
  // independent recomputation from the declared formula
  const expect = Math.min(R.roundIncome.declared.maxInterestDefault, Math.floor(r.moneyBefore / 10)) + (r.isPVE ? 0 : Math.min(5, r.streak)) + 5
  if (expect !== r.incomeAwarded) bad(`probe income ${i}: formula gives ${expect}, probe ${r.incomeAwarded}`)
}
if (!eq(R.buyXp.boundaryExamples, probe.buyXp) || !eq(R.reroll.boundaryExamples, probe.reroll) || !eq(R.levels.boundaryExamples, probe.experienceManager.examples)) bad("buy/reroll/level examples differ from the probe")
for (const c of probe.experienceManager.cumulativeXpToReachEachLevelFromLevel2) if (c.experience === 0 && c.reachedLevel <= 8 && c.reachedLevel >= 3 && c.totalXpAdded !== decl.cumulativeXpToReach[c.reachedLevel]) bad(`probe cumulative XP to level ${c.reachedLevel}`)

// 4. Markdown agrees with the record
const need = [
  "Production-branch reference; deployment unverified", SHA, "min(5, floor(gold / 10))", "min(5, streak)", "Base: 5 gold", "+2 XP", "+4 XP for 4 gold",
  "2, 6, 10, 22, 34, 52, 72", "2, 8, 18, 40, 74, 126, 198", "Maximum level 9", "level 2 with 0 XP", "**1 gold**", "costs 0", "(→ 10 gold)",
  "calculations from the inspected rule, not runtime tests", "PVEStages", "1, 2, 3, 9, 14, 19, 24, 28, 32, 36, 40"
]
for (const s of need) if (!md.includes(s)) bad(`Markdown lacks "${s}"`)
for (const r of probe.computeIncome) {
  const pat = r.isPVE ? null : `| ${r.moneyBefore}${[5].includes(r.moneyBefore) ? " (starting gold)" : ""} | ${r.streak} |`
  if (pat && ![9, 10, 19, 20, 49, 50].includes(r.moneyBefore) && r.streak === 0) continue
  if (pat && r.streak === 0 && !md.includes(`| ${r.moneyBefore} | 0 | PvP | ${r.interest} | ${r.incomeAwarded} |`)) bad(`Markdown table lacks row for gold ${r.moneyBefore}`)
}
for (const [s, inc] of [[1, 7], [4, 10], [5, 11], [6, 11]]) { const r = probe.computeIncome.find((x) => x.moneyBefore === 10 && x.streak === s && !x.isPVE); if (!r || r.incomeAwarded !== inc) bad(`streak ${s} example`) }
if (!md.includes("| 10 | 1 / 4 / 5 / 6 | PvP | 1 | 7 / 10 / 11 / 11 |")) bad("Markdown streak row missing")
const exec = (cond, what) => { if (!cond) bad(what) }
exec(probe.buyXp[1].after.money === 0 && probe.buyXp[1].after.level === 3 && probe.buyXp[1].after.experience === 2 && md.includes("level 2 + 4 XP → level 3 with 2 XP"), "buy-XP example vs Markdown")
exec(probe.buyXp[3].after.level === 9 && probe.buyXp[3].after.money === 0 && md.includes("level 8 with 70 XP + 4 → level 9"), "level-9 overflow example vs Markdown")
exec(probe.buyXp[5].after.money === 10 && md.includes("level 9: refused, gold unchanged"), "level-9 refusal vs Markdown")
exec(probe.reroll[3].after.money === 0 && probe.reroll[3].after.shopFreeRolls === 0 && probe.reroll[0].shopAssigned === false, "reroll examples")

if (problems.length) { console.error(`FAILED (${problems.length}):\n- ${problems.join("\n- ")}`); process.exit(1) }
console.log(`OK: ${data.evidence.length} evidence references verified against ${SHA.slice(0, 8)}; declared values, probe examples and Markdown agree`)
