// Probe: base economy and leveling, executed against the REAL pinned code (production-branch reference; deployment unverified, 07367c34).
// Real code exercised: OnUpdatePhaseCommand.computeIncome, ExperienceManager (+ ExpTable), OnLevelUpCommand.execute, OnShopRerollCommand.execute.
// STUBS (nothing else): players are plain objects {id, alive, isBot, items: [], board: empty MapSchema, money, streak, interest, maxInterest,
// shopFreeRolls, gameStats, addMoney(), addExperience() -> real ExperienceManager}; `this` of each command is {state:{players,shop,...}, room:{clients:[]}};
// the shop is a stub that only records assignShop calls. No Room, Simulation, items, special rules or server.
// NOT exercised: the streak update in Simulation.onFinish (computed from the read rules in the notes), the +1 win gold, phase scheduling.
// Usage (inside a checkout of the pinned SHA with node_modules): node_modules/.bin/tsx assistant/probes/economy-probe.ts --out <file.json>
import { MapSchema } from "@colyseus/schema"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { ExpTable } from "../../app/config"
import ExperienceManager from "../../app/models/colyseus-models/experience-manager"
import { OnLevelUpCommand, OnShopRerollCommand, OnUpdatePhaseCommand } from "../../app/rooms/commands/game-commands"
import { probeStartup } from "./probe-guard"

const out = probeStartup(resolve(__dirname, "results", "economy-probe.json"))

function mkPlayer(over: Record<string, unknown> = {}): any {
  const p: any = {
    id: "p1", alive: true, isBot: false, items: [], board: new MapSchema(), money: 0, streak: 0, interest: 0, maxInterest: 0,
    shopFreeRolls: 0, gameStats: { rerollCount: 0 }, experienceManager: new ExperienceManager(),
    addMoney(v: number) { this.money += v },
    addExperience(v: number) { return this.experienceManager.addExperience(v) },
    ...over
  }
  return p
}
const xp = (p: any) => ({ level: p.experienceManager.level, experience: p.experienceManager.experience, expNeeded: p.experienceManager.expNeeded })

// ---- A. computeIncome (real method) -----------------------------------------------------------------------------
function income(money: number, streak: number, isPVE: boolean) {
  const p = mkPlayer({ money, streak })
  const ctx: any = { state: { players: new Map([["p1", p]]) }, room: { clients: [] } }
  ;(OnUpdatePhaseCommand.prototype as any).computeIncome.call(ctx, isPVE, null)
  return { moneyBefore: money, streak, isPVE, interest: p.interest, maxInterest: p.maxInterest, moneyAfter: p.money, incomeAwarded: p.money - money, ...xp(p) }
}
const incomeTable = [
  [0, 0, false], [5, 0, true], [5, 0, false], [9, 0, false], [10, 0, false], [19, 0, false], [20, 0, false], [49, 0, false], [50, 0, false], [51, 0, false], [99, 0, false], [100, 0, false],
  [10, 1, false], [10, 4, false], [10, 5, false], [10, 6, false], [10, 99, false], [10, 3, true], [10, 5, true]
].map(([m, s, e]) => income(m as number, s as number, e as boolean))

// ---- B. ExperienceManager ----------------------------------------------------------------------------------------
const lv = new ExperienceManager()
const start = { level: lv.level, experience: lv.experience, expNeeded: lv.expNeeded, maxLevel: lv.maxLevel }
const cumulative: any[] = []
let total = 0
let prevLevel = lv.level
while (lv.level < lv.maxLevel) {
  lv.addExperience(1)
  total += 1
  if (lv.level !== prevLevel) { // record only actual level transitions (levels 3-9), not every XP increment
    cumulative.push({ reachedLevel: lv.level, totalXpAdded: total, experience: lv.experience })
    prevLevel = lv.level
  }
}
const em = (level: number, experience: number) => { const m = new ExperienceManager(); m.level = level; m.experience = experience; m.expNeeded = ExpTable[level] ?? 255; return m }
const add = (level: number, experience: number, q: number) => { const m = em(level, experience); const gained = m.addExperience(q); return { from: { level, experience }, added: q, xpActuallyGained: gained, to: { level: m.level, experience: m.experience, expNeeded: m.expNeeded } } }
const examples = [add(2, 0, 4), add(2, 1, 1), add(2, 0, 2), add(3, 5, 1), add(3, 5, 4), add(2, 0, 20), add(8, 70, 2), add(8, 70, 4), add(8, 0, 4), add(9, 0, 4), add(9, 0, 2)]

// ---- C. OnLevelUpCommand (real) --------------------------------------------------------------------------------------
function buyXp(money: number, level: number, experience: number, alive = true) {
  const p = mkPlayer({ money, alive }); p.experienceManager = em(level, experience)
  const ctx: any = { state: { players: new Map([["p1", p]]), specialGameRule: null } }
  new (OnLevelUpCommand as any)().execute.call({ ...ctx, state: ctx.state }, "p1")
  return { before: { money, level, experience, alive }, after: { money: p.money, level: p.experienceManager.level, experience: p.experienceManager.experience } }
}
const buys = [buyXp(3, 2, 0), buyXp(4, 2, 0), buyXp(5, 2, 0), buyXp(4, 8, 70), buyXp(4, 8, 0), buyXp(10, 9, 0), buyXp(4, 2, 0, false)]

// ---- D. OnShopRerollCommand (real) ----------------------------------------------------------------------------------------
function reroll(money: number, shopFreeRolls: number) {
  const p = mkPlayer({ money, shopFreeRolls }); const calls: any[] = []
  const state: any = { players: new Map([["p1", p]]), shop: { assignShop: (...a: any[]) => calls.push({ manualRefresh: a[1] }) } }
  new (OnShopRerollCommand as any)().execute.call({ state }, "p1")
  return { before: { money, shopFreeRolls }, after: { money: p.money, shopFreeRolls: p.shopFreeRolls, rerollCount: p.gameStats.rerollCount }, shopAssigned: calls.length > 0, assignShopCalls: calls }
}
const rerolls = [reroll(0, 0), reroll(1, 0), reroll(5, 0), reroll(0, 1), reroll(3, 2)]

const result = {
  label: "production-branch reference; deployment unverified", sourceSha: "07367c341fe928763da2b565c2eee010433e4fc1",
  stubs: "plain-object players with a real ExperienceManager; command `this` = {state:{players:Map,shop:stub}, room:{clients:[]}}; computeIncome/OnLevelUpCommand/OnShopRerollCommand/ExperienceManager are the real pinned code",
  scope: "normal path only: specialGameRule null, no items on the player or board, human alive player",
  computeIncome: incomeTable,
  experienceManager: { start, expTable: ExpTable, cumulativeXpToReachEachLevelFromLevel2: cumulative, examples },
  buyXp: buys,
  reroll: rerolls
}
writeFileSync(out, JSON.stringify(result, null, 2) + "\n")
console.log(`wrote probe results: ${incomeTable.length} income cases, ${examples.length} xp cases, ${buys.length} buy cases, ${rerolls.length} reroll cases`)
