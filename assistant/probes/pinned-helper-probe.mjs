// Narrow reproduction of ten repaired candidates (KING_SHIELD, LEECH_SEED, RAGING_BULL, FLAME_CHARGE, EXPLOSION; SLUDGE, VOLT_SWITCH, ZAP_CANNON, BLAZE_KICK, AQUA_STEP) using the TEXT of the
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
// Sections 6-10 (run 3): SLUDGE, VOLT_SWITCH, ZAP_CANNON, BLAZE_KICK, AQUA_STEP. Real strategy text; real Status.triggerPoison /
// triggerArmorReduction / triggerParalysis / applyStatusDurationReductions; real Board methods and effectInOrientation; stubs for the rest.
const distanceC = (x0, y0, x1, y1) => Math.max(Math.abs(y0 - y1), Math.abs(x0 - x1))
const logger = { error() {}, trace() {} }
const BoardFull = build({ distanceM, distanceC, Orientation: enums(), logger, pickRandomIn: (o) => Object.values(o)[0], Set, Array },
  js(`class Board {\n${[[23, 31, "constructor("], [33, 37, "getEntityOnCell("], [75, 83, "forEach("], [99, 150, "orientation("], [152, 163, "getAdjacentCells("], [304, 346, "getCellsBetween("], [544, 566, "getClosestAvailablePlace("], [568, 630, "getFarthestTargetCoordinateAvailablePlace("], [724, 726, "isOnBoard("]].map(([a, b, st]) => cut(BD, a, b, st)).join("\n")}\n}`), "Board")
const effectInOrientation = build({ Orientation: enums(), distanceC }, js(cut(BD, 810, 918, "export function effectInOrientation").replace("export function", "function")), "effectInOrientation")
const statusSrc2 = js(`class S {\n${cut(ST, 342, 352, "triggerArmorReduction(")}\n${cut(ST, 572, 615, "triggerPoison(")}\n${cut(ST, 908, 939, "triggerParalysis(")}\n${cut(ST, 1282, 1305, "private applyStatusDurationReductions(")}\n}`)
const Status2 = build({ EffectEnum: enums(), Item: enums(), Passive: enums(), Weather: enums(), max, count }, statusSrc2, "S")
const eatBerry = build({ Item: enums(), EffectEnum: enums() }, js(`function eatBerry(berry) { const heal = () => {}; switch (berry) {\n${cut(PE, 1641, 1647, "case Item.PECHA_BERRY:")}\n}\n this.removeItem(berry, true) }`), "eatBerry")
const strat = (file, cls, env = {}) => build({ AttackType: enums(), AbilityStrategy: class { process() {} }, DelayedCommand, ...env }, js(strategySrc(file)), cls)
const mkSt = (over = {}) => Object.assign(new Status2(), { runeProtect: false, poisonStacks: 0, poisonCooldown: 0, poisonOrigin: null, armorReduction: false, armorReductionCooldown: 0, paralysis: false, paralysisCooldown: 0, ...over })
const mkUnit = ({ team = "RED", effects = [], items = [], passive = "NONE", st = {}, stars = 1 } = {}) => {
  const u = { team, stars, ap: 0, critPower: 2, passive, player: null, simulation: { weather: "NONE" }, effects: new Set(effects), items: new Set(items), status: mkSt(st), hits: [], addAttack() {}, removeItem(i) { this.items.delete(i) }, eatBerry, broadcastAbility() {}, handleSpecialDamage(...a) { this.hits.push({ damage: a[0], type: a[2], crit: a[4], apBoost: a[5] }) } }
  return u
}

// 6. SLUDGE: successive triggerPoison calls (nbStacks 2/3/4/8 by stars, duration table x AP x crit)
const Sludge = strat("app/core/abilities/sludge.ts", "SludgeStrategy")
const sludge = ({ stars, casterEffects = [], enemy = {} }) => {
  const e = mkUnit({ ...enemy }), calls = []
  const orig = e.status.triggerPoison.bind(e.status); e.status.triggerPoison = (...a) => { calls.push(1); return orig(...a) }
  const caster = mkUnit({ team: "BLUE", stars, effects: casterEffects })
  new Sludge().process(caster, { getCellsInFront: () => [{ value: e }] }, e, false)
  return { triggerPoisonCalls: calls.length, stacks: e.status.poisonStacks, cooldown: e.status.poisonCooldown, immunityPoison: e.effects.has("IMMUNITY_POISON"), berryLeft: [...e.items], origin: e.status.poisonOrigin ? "caster" : null }
}
out.SLUDGE = { star1: sludge({ stars: 1 }), star2: sludge({ stars: 2 }), star3: sludge({ stars: 3 }), star3_originVenomous: sludge({ stars: 3, casterEffects: ["VENOMOUS"] }), star1_runeProtect: sludge({ stars: 1, enemy: { st: { runeProtect: true } } }), star1_immunityPoison: sludge({ stars: 1, enemy: { effects: ["IMMUNITY_POISON"] } }), star1_pechaBerry: sludge({ stars: 1, enemy: { items: ["PECHA_BERRY"] } }), star1_targetHydration: sludge({ stars: 1, enemy: { effects: ["HYDRATION"] } }) }
expect("SLUDGE from zero stacks: 1 star requests and applies 2, 2 stars 3", [out.SLUDGE.star1.triggerPoisonCalls, out.SLUDGE.star1.stacks, out.SLUDGE.star2.triggerPoisonCalls, out.SLUDGE.star2.stacks], [2, 2, 3, 3])
expect("SLUDGE 3 stars requests 4, the cap of 3 applies (4 with VENOMOUS on the origin)", [out.SLUDGE.star3.triggerPoisonCalls, out.SLUDGE.star3.stacks, out.SLUDGE.star3_originVenomous.stacks], [4, 3, 4])
expect("SLUDGE Rune Protect / IMMUNITY_POISON: calls made, no stack, no cooldown", [out.SLUDGE.star1_runeProtect.stacks, out.SLUDGE.star1_runeProtect.cooldown, out.SLUDGE.star1_immunityPoison.stacks], [0, 0, 0])
expect("SLUDGE Pecha Berry holder: the first call adds a stack and eats the berry (stacks cleared, IMMUNITY_POISON set), the second call does nothing", [out.SLUDGE.star1_pechaBerry.stacks, out.SLUDGE.star1_pechaBerry.immunityPoison, out.SLUDGE.star1_pechaBerry.berryLeft, out.SLUDGE.star1_pechaBerry.origin], [0, true, [], null])
expect("SLUDGE duration 3000 (1 star, AP 0); target HYDRATION halves it", [out.SLUDGE.star1.cooldown, out.SLUDGE.star1_targetHydration.cooldown], [3000, 1500])

// 7. VOLT_SWITCH: same helper as FLAME_CHARGE; line cells are collected before the move; empty hit set falls back to the cast target
const VoltSwitch = strat("app/core/abilities/volt-switch.ts", "VoltSwitchStrategy")
const bd2 = (layout) => { const b = new BoardFull(6, 8); const put = (x, y, team, name) => { const e = mkUnit({ team }); Object.assign(e, { name, positionX: x, positionY: y, isTargettableBy: (pk, enemy) => enemy && e.team !== pk.team && !e.untargettable }); b.cells[8 * y + x] = e; return e }; const caster = put(0, 0, "BLUE", "caster"); caster.stars = 1; const moves = []; caster.moveTo = (x, y) => moves.push([x, y]); return { b, put, caster, moves, ...layout({ put, b }) } }
const volt = (layout, pick) => { const w = bd2(layout); new VoltSwitch().process(w.caster, w.b, pick(w), false); return { moves: w.moves, hit: Object.values(w.all ?? {}).filter((u) => u.hits.length).map((u) => `${u.name}:${u.hits[0].damage}`) } }
out.VOLT_SWITCH = {
  farthestBoxedIn: volt(({ put }) => { const near = put(2, 0, "RED", "near"), far = put(7, 5, "RED", "far"); put(6, 5, "BLUE", "b1"); put(6, 4, "BLUE", "b2"); put(7, 4, "BLUE", "b3"); return { all: { near, far }, near, far } }, (w) => w.far),
  freeNeighbour: volt(({ put }) => { const near = put(2, 0, "RED", "near"), far = put(7, 5, "RED", "far"); return { all: { near, far }, near, far } }, (w) => w.far),
  noTargettableEnemy: volt(({ put }) => { const t = put(2, 0, "RED", "t"); t.untargettable = true; return { all: { t }, t } }, (w) => w.t),
  destinationLineMissesEveryEnemy: volt(({ put }) => { const far = put(7, 5, "RED", "far"); return { all: { far }, far } }, (w) => w.far)
}
expect("VOLT_SWITCH boxed-in farthest enemy: destination (3,1) next to the nearer enemy; the line (0,0)-(1,0)-(2,1)-(3,1) crosses no enemy, so the empty hit set falls back to the cast target (the far enemy here)", out.VOLT_SWITCH.farthestBoxedIn, { moves: [[3, 1]], hit: ["far:25"] })
expect("VOLT_SWITCH farthest enemy with a free neighbour: destination (7,4)", out.VOLT_SWITCH.freeNeighbour.moves, [[7, 4]])
expect("VOLT_SWITCH no targettable enemy: no move, the cast target is hit", out.VOLT_SWITCH.noTargettableEnemy, { moves: [], hit: ["t:25"] })
expect("VOLT_SWITCH a line that misses every enemy: moved, then the cast target is hit anyway", out.VOLT_SWITCH.destinationLineMissesEveryEnemy, { moves: [[7, 4]], hit: ["far:25"] })

// 8. ZAP_CANNON: Rune Protect blocks the two status applications, not the damage request; timers keep the larger value
const ZapCannon = strat("app/core/abilities/zap-cannon.ts", "ZapCannonStrategy")
const zap = ({ stars = 1, st = {}, effects = [] } = {}) => { const t = mkUnit({ st, effects }), c = mkUnit({ team: "BLUE", stars }); new ZapCannon().process(c, {}, t, false); return { armorReduction: t.status.armorReduction, armorCooldown: t.status.armorReductionCooldown, paralysis: t.status.paralysis, paralysisCooldown: t.status.paralysisCooldown, damageRequests: t.hits } }
out.ZAP_CANNON = { plain1star: zap(), runeProtect1star: zap({ st: { runeProtect: true } }), immunityParalysisOnly: zap({ effects: ["IMMUNITY_PARALYSIS"] }), longerRemainingKept: zap({ st: { armorReductionCooldown: 5000, armorReduction: true, paralysisCooldown: 5000, paralysis: true } }), shorterRemainingReplaced: zap({ st: { armorReductionCooldown: 400, armorReduction: true, paralysisCooldown: 400, paralysis: true } }), targetHydration: zap({ effects: ["HYDRATION"] }) }
expect("ZAP_CANNON plain 1 star: 1000 ms armor reduction and paralysis, 25 SPECIAL requested with apBoost true", [out.ZAP_CANNON.plain1star.armorReduction, out.ZAP_CANNON.plain1star.armorCooldown, out.ZAP_CANNON.plain1star.paralysis, out.ZAP_CANNON.plain1star.paralysisCooldown, out.ZAP_CANNON.plain1star.damageRequests], [true, 1000, true, 1000, [{ damage: 25, type: "SPECIAL", crit: false, apBoost: true }]])
expect("ZAP_CANNON Rune Protect: no armor reduction, no paralysis, the 25 SPECIAL request still occurs", out.ZAP_CANNON.runeProtect1star, { armorReduction: false, armorCooldown: 0, paralysis: false, paralysisCooldown: 0, damageRequests: [{ damage: 25, type: "SPECIAL", crit: false, apBoost: true }] })
expect("ZAP_CANNON IMMUNITY_PARALYSIS blocks only the paralysis", [out.ZAP_CANNON.immunityParalysisOnly.armorReduction, out.ZAP_CANNON.immunityParalysisOnly.paralysis], [true, false])
expect("ZAP_CANNON timers keep the larger of the remaining time and the new (reduced) request", [out.ZAP_CANNON.longerRemainingKept.armorCooldown, out.ZAP_CANNON.longerRemainingKept.paralysisCooldown, out.ZAP_CANNON.shorterRemainingReplaced.armorCooldown, out.ZAP_CANNON.shorterRemainingReplaced.paralysisCooldown, out.ZAP_CANNON.targetHydration.armorCooldown], [5000, 5000, 1000, 1000, 500])

// 9. BLAZE_KICK: effectInOrientation RIGHT loops x < board.rows (6) on the 8-column x 6-row board
const BlazeKick = strat("app/core/abilities/blaze-kick.ts", "BlazeKickStrategy", { effectInOrientation })
const kick = (cx, cy, tx, ty, extra = []) => { const b = new BoardFull(6, 8), moves = []; const put = (x, y, team, name) => { const e = mkUnit({ team }); Object.assign(e, { name, positionX: x, positionY: y }); b.cells[8 * y + x] = e; return e }; const c = put(cx, cy, "BLUE", "caster"), t = put(tx, ty, "RED", "target"); extra.forEach(([x, y]) => put(x, y, "BLUE", `x${x}${y}`)); t.moveTo = (x, y, bd, forced) => moves.push([x, y, forced]); t.status.triggerBurn = () => {}; c.stars = 1; new BlazeKick().process(c, b, t, false); return { moves, damageRequests: t.hits } }
out.BLAZE_KICK = { rightRayAt5_2: kick(5, 2, 6, 2), rightRayAt2_2: kick(2, 2, 3, 2), rightRayAt4_2: kick(4, 2, 5, 2), leftRay: kick(5, 2, 4, 2) }
expect("BLAZE_KICK caster (5,2), target (6,2), (7,2) empty, RIGHT: no move requested (the loop stops before columns 6 and 7; the occupied-target fallback gives no free cell); damage still requested", out.BLAZE_KICK.rightRayAt5_2, { moves: [], damageRequests: [{ damage: 30, type: "SPECIAL", crit: false, apBoost: undefined }] })
expect("BLAZE_KICK caster (2,2), target (3,2): farthest empty cell on the RIGHT ray is (5,2), never (7,2)", out.BLAZE_KICK.rightRayAt2_2.moves, [[5, 2, true]])
expect("BLAZE_KICK caster (4,2), target (5,2): (5,2) is the last cell scanned and is occupied, so no move", out.BLAZE_KICK.rightRayAt4_2.moves, [])
expect("BLAZE_KICK LEFT ray is not truncated: farthest empty cell (0,2)", out.BLAZE_KICK.leftRay.moves, [[0, 2, true]])

// 10. AQUA_STEP: one-sign-step reference coordinate, then getClosestAvailablePlace over ALL free cells; the delayed command is queued either way
const AquaStep = strat("app/core/abilities/aqua-step.ts", "AquaStepStrategy")
const step = ({ freeOnly, noFree = false }) => { const b = new BoardFull(6, 8), moves = []; const put = (x, y, team, name) => { const e = mkUnit({ team }); Object.assign(e, { name, positionX: x, positionY: y }); b.cells[8 * y + x] = e; return e }; const c = put(0, 0, "BLUE", "caster"), t = put(1, 0, "RED", "target"); for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) if (!b.cells[8 * y + x] && !(freeOnly && x === freeOnly[0] && y === freeOnly[1]) ) put(x, y, "BLUE", "filler"); c.stars = 1; c.moveTo = (x, y, bd, forced) => moves.push([x, y, forced]); c.commands = []; const speed = []; c.addSpeed = (...a) => speed.push(a.slice(0, 1).concat([a[2], a[3]])); new AquaStep().process(c, b, t, false); const queued = c.commands.map((k) => k.delay); c.commands.forEach((k) => k.update(300)); const after300 = t.hits.length; c.commands.forEach((k) => k.update(1)); return { moves, queuedDelays: queued, damageAfterUpdate300: after300, damageAfterUpdate301: t.hits.length, damageRequest: t.hits[0], speedGain: speed } }
out.AQUA_STEP = { onlyFreeCell7_5: step({ freeOnly: [7, 5] }), noFreeCell: step({ freeOnly: null }) }
expect("AQUA_STEP caster (0,0), target (1,0), only free cell (7,5): move requested to (7,5), not one cell; delay-300 command queued", [out.AQUA_STEP.onlyFreeCell7_5.moves, out.AQUA_STEP.onlyFreeCell7_5.queuedDelays], [[[7, 5, false]], [300]])
expect("AQUA_STEP no free cell: no move, the delayed damage / speed command is still queued", [out.AQUA_STEP.noFreeCell.moves, out.AQUA_STEP.noFreeCell.queuedDelays], [[], [300]])
expect("AQUA_STEP the nominal 300 does not run at update(300) (delay must go below 0); it runs after a further update(1)", [out.AQUA_STEP.onlyFreeCell7_5.damageAfterUpdate300, out.AQUA_STEP.onlyFreeCell7_5.damageAfterUpdate301, out.AQUA_STEP.onlyFreeCell7_5.speedGain], [0, 1, [[10, 1, false]]])

// ---------------------------------------------------------------------------------------------------------------------------------
console.log(JSON.stringify(out, null, 1))
const failed = expectations.filter((x) => !x.ok)
for (const x of expectations) console.error(`${x.ok ? "ok  " : "FAIL"} ${x.name}${x.ok ? "" : ` -> got ${JSON.stringify(x.got)}, want ${JSON.stringify(x.want)}`}`)
if (process.argv.includes("--check") && failed.length) process.exit(1)
