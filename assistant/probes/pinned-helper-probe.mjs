// Narrow reproduction of five repaired candidates (KING_SHIELD, LEECH_SEED, RAGING_BULL, FLAME_CHARGE, EXPLOSION) using the TEXT of the
// pinned functions (production-branch reference 07367c341fe928763da2b565c2eee010433e4fc1; deployment unverified).
// Each function body is read with `git show <sha>:<path>` by line range (the first line is asserted), types are stripped with
// node:module stripTypeScriptTypes, and the code is run against minimal stubs (enums answer with their own name). Nothing is installed,
// no game module is imported, nothing is written. The stubs are NOT the game: this shows what the pinned helper code requests/returns
// for the stated inputs, not a fight.
// Usage: node assistant/probes/pinned-helper-probe.mjs [--check]     (--check exits 1 if a printed value differs from the recorded expectation)
import { execFileSync } from "node:child_process"
import { stripTypeScriptTypes } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SHA = "07367c341fe928763da2b565c2eee010433e4fc1"
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const cache = new Map()
const lines = (f) => { if (!cache.has(f)) cache.set(f, execFileSync("git", ["-C", REPO, "show", `${SHA}:${f}`], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\n")); return cache.get(f) }
const cut = (f, a, b, starts) => {
  const t = lines(f).slice(a - 1, b).join("\n")
  if (!t.trimStart().startsWith(starts)) throw new Error(`${f}:${a}-${b} does not start with ${JSON.stringify(starts)}`)
  return t
}
const js = (code) => stripTypeScriptTypes(code)
const enums = () => new Proxy({}, { get: (_, k) => (typeof k === "string" ? k : undefined) })
const min = (m) => (v) => Math.max(m, v)
const max = (m) => (v) => Math.min(m, v)
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi)
const count = (arr, el) => arr.filter((x) => x === el).length
const build = (names, code, ret) => new Function(...Object.keys(names), `${code}\nreturn ${ret}`)(...Object.values(names))
const PE = "app/core/pokemon-entity.ts", ST = "app/models/colyseus-models/status.ts", BD = "app/core/board.ts", NUM = "app/utils/number.ts", SC = "app/core/simulation-command.ts"

const out = {}
const expectations = []
const expect = (name, got, want) => expectations.push({ name, ok: JSON.stringify(got) === JSON.stringify(want), got, want })

// shared pieces
const roundToNDigits = build({}, js(cut(NUM, 16, 32, "export const roundToNDigits").replace("export ", "")), "roundToNDigits")
const helpers = js(`${cut(PE, 1839, 1852, "function applyBigEaterBeltStatBuff")}\n${cut(PE, 1854, 1867, "function applyTwistBandBuff")}`)
const commandsSrc = js(`${cut(SC, 5, 20, "export abstract class SimulationCommand").replace("export abstract class", "class").replace(" implements ISimulationCommand", "")}\n${cut(SC, 22, 32, "export class DelayedCommand").replace("export class", "class")}`)
const { DelayedCommand } = build({}, commandsSrc, "{ DelayedCommand }")

// ---------------------------------------------------------------------------------------------------------------------------------
// 1. KING_SHIELD: the real strategy text, real stat adders, real Big Eater Belt / Twist Band helpers, real DelayedCommand
const statMethods = `${cut(PE, 674, 698, "addDefense(")}\n${cut(PE, 700, 724, "addSpecialDefense(")}\n${cut(PE, 726, 750, "addAttack(")}`
const EntClass = (extra = {}) => build({ Item: enums(), min, max, clamp, roundToNDigits, ...extra }, `${helpers}\nclass Ent {\n${js(`class _ {\n${statMethods}\n}`).replace(/^class _ \{\n/, "").replace(/\n\}\s*$/, "")}\n}`, "Ent")
const Ent = EntClass()
const strategySrc = (file) => lines(file).filter((l) => !/^import /.test(l)).join("\n").replace(/^export /gm, "")
const KingShield = build({ Passive: enums(), Pkm: enums(), PkmIndex: enums(), DelayedCommand, AbilityStrategy: class { process() {} } }, js(strategySrc("app/core/abilities/king-shield.ts")), "KingShieldStrategy")
const mkAegi = (items) => Object.assign(new Ent(), {
  items: new Set(items), team: "BLUE", ap: 0, critPower: 2, atk: 30, def: 20, speDef: 20, isGhostOpponent: true, passive: "AEGISLASH", name: "AEGISLASH", index: 1, player: null, commands: [], stars: 3,
  status: { triggerProtect() {} }, addShield() {}, state: { getFarthestTarget: () => null }, moveTo() {}
})
const stats = (p) => `${p.atk}/${p.def}/${p.speDef}`
const runForm = (items, casts = 1) => {
  const p = mkAegi(items), s = new KingShield(), seen = [stats(p)]
  for (let i = 0; i < casts; i++) s.process(p, {}, null, false)
  const queued = p.commands.length
  p.commands.forEach((c) => c.update(1501)) // delay 1500 < 0 after 1501 ms of simulated time
  seen.push(stats(p), p.name)
  if (casts === 1) { s.process(p, {}, null, false); p.commands.slice(1).forEach((c) => c.update(1501)); seen.push(stats(p), p.name) }
  return { queued, seen }
}
out.KING_SHIELD = { withBigEaterBelt: runForm(["BIG_EATER_BELT"]), withoutItem: runForm([]), twoCastsBeforeCallbackRuns_withBelt: runForm(["BIG_EATER_BELT"], 2) }
expect("KING_SHIELD belt: Aegislash -> Blade -> Aegislash (ATK/DEF/SPE_DEF)", out.KING_SHIELD.withBigEaterBelt.seen, ["30/20/20", "42/13/13", "AEGISLASH_BLADE", "29/19/19", "AEGISLASH"])
expect("KING_SHIELD no item: stat changes cancel", out.KING_SHIELD.withoutItem.seen, ["30/20/20", "40/15/15", "AEGISLASH_BLADE", "30/20/20", "AEGISLASH"])
expect("KING_SHIELD two casts before the first callback runs queue two form-1 callbacks", [out.KING_SHIELD.twoCastsBeforeCallbackRuns_withBelt.queued, out.KING_SHIELD.twoCastsBeforeCallbackRuns_withBelt.seen[1]], [2, "54/6/6"])

// ---------------------------------------------------------------------------------------------------------------------------------
// 2. LEECH_SEED: Status.updatePoison (the poison tick), GLISCOR, maxHP 1000, no other modifiers
const updatePoisonSrc = js(`class S {\n${cut(ST, 617, 688, "updatePoison(")}\n}`)
const S = build({ Passive: enums(), Weather: enums(), Item: enums(), EffectEnum: enums(), AttackType: enums(), min }, updatePoisonSrc, "S")
const tick = (stacks) => {
  const calls = []
  const pkm = { maxHP: 1000, passive: "GLISCOR", simulation: { weather: "NONE" }, items: new Set(), effects: new Set(), handleHeal: (...a) => calls.push(["handleHeal", ...a.slice(0, 1), a[2], a[3]]), handleDamage: (o) => calls.push(["handleDamage", o.damage, o.attackType, o.attacker, o.shouldTargetGainMana]), addAttack() {} }
  const st = Object.assign(new S(), { poisonDamageCooldown: 0, poisonStacks: stacks, poisonCooldown: 5000, poisonOrigin: "ORIGIN", burn: false, triggerPoison() {} })
  st.updatePoison(100, pkm, {})
  return calls
}
out.LEECH_SEED = { stacks1: tick(1), stacks2: tick(2), stacks3: tick(3) }
expect("LEECH_SEED Gliscor stacks 1: handleHeal request 50 (apBoost 0, crit false)", out.LEECH_SEED.stacks1, [["handleHeal", 50, 0, false]])
expect("LEECH_SEED Gliscor stacks 2: no call", out.LEECH_SEED.stacks2, [])
expect("LEECH_SEED Gliscor stacks 3: handleDamage TRUE 50, attacker = poison origin, no mana", out.LEECH_SEED.stacks3, [["handleDamage", 50, "TRUE", "ORIGIN", false]])

// ---------------------------------------------------------------------------------------------------------------------------------
// 3. RAGING_BULL: the real strategy text against a Status built from the real triggerArmorReduction / applyStatusDurationReductions
const statusSrc = js(`class S {\n${cut(ST, 342, 352, "triggerArmorReduction(")}\n${cut(ST, 1282, 1305, "private applyStatusDurationReductions(")}\n}`)
const Status = build({ EffectEnum: enums(), Item: enums(), count }, statusSrc, "S")
const RagingBull = build({ AttackType: enums(), AbilityStrategy: class { process() {} } }, js(strategySrc("app/core/abilities/raging-bull.ts")), "RagingBullStrategy")
const bull = ({ targetRuneProtect = false, casterEffects = [], targetEffects = [], oddKeystones = 0 }) => {
  const status = Object.assign(new Status(), { runeProtect: targetRuneProtect, armorReduction: false, armorReductionCooldown: 0, reflect: true, reflectCooldown: 9, protect: true, protectCooldown: 9, magicBounce: true, magicBounceCooldown: 9 })
  const target = { status, effects: new Set(targetEffects), player: null, handleSpecialDamage: (d) => hits.push(d) }
  const hits = []
  const caster = { stars: 1, effects: new Set(casterEffects), player: { items: Array(oddKeystones).fill("ODD_KEYSTONE") } }
  new RagingBull().process(caster, {}, target, false)
  return { armorReduction: status.armorReduction, armorReductionCooldown: status.armorReductionCooldown, protect: status.protect, reflect: status.reflect, magicBounce: status.magicBounce, damageRequested: hits }
}
out.RAGING_BULL = {
  plain: bull({}), casterHydration: bull({ casterEffects: ["HYDRATION"] }), targetHydrationOnly: bull({ targetEffects: ["HYDRATION"] }),
  casterOddKeystone2: bull({ oddKeystones: 2 }), targetRuneProtect: bull({ targetRuneProtect: true })
}
expect("RAGING_BULL plain: 3000 ms armor reduction", [out.RAGING_BULL.plain.armorReduction, out.RAGING_BULL.plain.armorReductionCooldown], [true, 3000])
expect("RAGING_BULL caster with HYDRATION: 1500 ms", out.RAGING_BULL.casterHydration.armorReductionCooldown, 1500)
expect("RAGING_BULL HYDRATION only on the target: still 3000 (reductions read the supplied caster)", out.RAGING_BULL.targetHydrationOnly.armorReductionCooldown, 3000)
expect("RAGING_BULL caster with 2 Odd Keystones: 2400", out.RAGING_BULL.casterOddKeystone2.armorReductionCooldown, 2400)
expect("RAGING_BULL target Rune Protect: no armor reduction, barrier flags still cleared, damage still requested", out.RAGING_BULL.targetRuneProtect, { armorReduction: false, armorReductionCooldown: 0, protect: false, reflect: false, magicBounce: false, damageRequested: [20] })

// ---------------------------------------------------------------------------------------------------------------------------------
// 4. FLAME_CHARGE (and AQUA_JET / NUZZLE nuance): the real Board.getFarthestTargetCoordinateAvailablePlace on a 6-row x 8-column board
const distanceM = (x0, y0, x1, y1) => Math.abs(x1 - x0) + Math.abs(y1 - y0)
const boardSrc = js(`class Board {\n${cut(BD, 23, 31, "constructor(")}\n${cut(BD, 33, 37, "getEntityOnCell(")}\n${cut(BD, 75, 83, "forEach(")}\n${cut(BD, 152, 163, "getAdjacentCells(")}\n${cut(BD, 544, 566, "getClosestAvailablePlace(")}\n${cut(BD, 568, 630, "getFarthestTargetCoordinateAvailablePlace(")}\n${cut(BD, 724, 726, "isOnBoard(")}\n}`)
const Board = build({ distanceM, Set, Array }, boardSrc, "Board")
const place = (board, x, y, team, name) => { const e = { positionX: x, positionY: y, team, name, isTargettableBy: (p, enemy) => enemy && e.team !== p.team }; board.cells[board.columns * y + x] = e; return e }
const farthest = (layout) => {
  const board = new Board(6, 8)
  const caster = place(board, 0, 0, "BLUE", "caster")
  layout(board, place)
  const r = board.getFarthestTargetCoordinateAvailablePlace(caster)
  return r && { x: r.x, y: r.y, distance: r.distance, target: r.target.name }
}
out.FLAME_CHARGE = {
  // enemy "near" (2,0) has free neighbours; enemy "far" in the corner (7,5) has none (its three neighbours are occupied): the earlier selection is retained
  farthestEnemyHasNoFreeAdjacentCell: farthest((b, put) => { put(b, 2, 0, "RED", "near"); put(b, 7, 5, "RED", "far"); put(b, 6, 5, "BLUE", "block1"); put(b, 6, 4, "BLUE", "block2"); put(b, 7, 4, "BLUE", "block3") }),
  farthestEnemyHasFreeAdjacentCell: farthest((b, put) => { put(b, 2, 0, "RED", "near"); put(b, 7, 5, "RED", "far") }),
  onlyEnemyHasNoFreeAdjacentCell_fallbackRuns: farthest((b, put) => { put(b, 7, 5, "RED", "far"); put(b, 6, 5, "BLUE", "block1"); put(b, 6, 4, "BLUE", "block2"); put(b, 7, 4, "BLUE", "block3") })
}
expect("FLAME_CHARGE farthest enemy boxed in: destination is next to the NEARER enemy", out.FLAME_CHARGE.farthestEnemyHasNoFreeAdjacentCell?.target, "near")
expect("FLAME_CHARGE farthest enemy with a free neighbour: destination is next to it", out.FLAME_CHARGE.farthestEnemyHasFreeAdjacentCell?.target, "far")
expect("FLAME_CHARGE fallback (closest free cell to the farthest enemy) only when nothing was selected", out.FLAME_CHARGE.onlyEnemyHasNoFreeAdjacentCell_fallbackRuns?.target, "far")

// ---------------------------------------------------------------------------------------------------------------------------------
// 5. EXPLOSION: the real PokemonEntity.handleSpecialDamage with the caster as its own attacker and Magic Bounce active
const hsd = js(`class E {\n${cut(PE, 346, 467, "handleSpecialDamage(")}\n}`)
const E = build({ Item: enums(), EffectEnum: enums(), AttackType: enums(), DelayedCommand, chance: () => false, ARMOR_FACTOR: 0.05, min, count, DOUBLE: 0 }, hsd, "E")
const selfHit = ({ items = [], stars = 1 } = {}) => {
  const e = Object.assign(new E(), { status: { magicBounce: true, protect: false, skydiving: false }, items: new Set(items), effects: new Set(), stars, ap: 0, critPower: 2, critChance: 0, skill: "EXPLOSION", positionX: 3, positionY: 3, commands: [], count: { spellBlockedCount: 0, crit: 0 }, player: null, broadcastAbility() {}, handleDamage(p) { requests.push({ damage: p.damage, attackType: p.attackType, attackerIsSelf: p.attacker === e, targetIsSelf: true, isRetaliation: p.isRetaliation }) } })
  const requests = []
  const ret = e.handleSpecialDamage(50, {}, "SPECIAL", e, false)
  const queued = e.commands.map((c) => c.delay)
  e.commands.forEach((c) => c.update(501))
  return { immediateReturn: ret, queuedDelays: queued, requestsAfterCallbackRuns: requests }
}
out.EXPLOSION = { selfMagicBounce_noPads_1star_ap0: selfHit(), selfMagicBounce_withPadsOnTarget: selfHit({ items: ["PROTECTIVE_PADS"] }) }
expect("EXPLOSION self Magic Bounce (1 star, AP 0, no crit, raw 50): immediate takenDamage 0, one delay-500 callback requesting 25 SPECIAL on itself", out.EXPLOSION.selfMagicBounce_noPads_1star_ap0, { immediateReturn: { death: false, takenDamage: 0 }, queuedDelays: [500], requestsAfterCallbackRuns: [{ damage: 25, attackType: "SPECIAL", attackerIsSelf: true, targetIsSelf: true, isRetaliation: true }] })
out.EXPLOSION.note = "with PROTECTIVE_PADS held the bounce is not queued (the strategy would also skip the self hit); the second entry only shows the pads check inside handleSpecialDamage"
expect("EXPLOSION: Protective Pads on the entity suppress the bounce", out.EXPLOSION.selfMagicBounce_withPadsOnTarget.queuedDelays, [])

// ---------------------------------------------------------------------------------------------------------------------------------
console.log(JSON.stringify(out, null, 1))
const failed = expectations.filter((x) => !x.ok)
for (const x of expectations) console.error(`${x.ok ? "ok  " : "FAIL"} ${x.name}${x.ok ? "" : ` -> got ${JSON.stringify(x.got)}, want ${JSON.stringify(x.want)}`}`)
if (process.argv.includes("--check") && failed.length) process.exit(1)
