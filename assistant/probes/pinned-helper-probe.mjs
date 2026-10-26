// Narrow reproduction of twenty-five repaired candidates (KING_SHIELD, LEECH_SEED, RAGING_BULL, FLAME_CHARGE, EXPLOSION; SLUDGE, VOLT_SWITCH, ZAP_CANNON, BLAZE_KICK, AQUA_STEP; FLOWER_TRICK, DARKEST_LARIAT, DRAGON_BREATH, DRUM_BEATING, EXPANDING_FORCE; POWDER, ICE_BALL, BITE, HORN_LEECH, TELEPORT; JUDGEMENT, MULTI_ATTACK, SPIKY_SHIELD, HATCH, PROTEAN3) using the TEXT of the
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
// Sections 11-15 (run 4): FLOWER_TRICK, DARKEST_LARIAT, DRAGON_BREATH, DRUM_BEATING, EXPANDING_FORCE. Real strategy text on the real
// AbilityStrategy base (count.ult is incremented by the base text); real PokemonState.attack (lines 29-117), handleSpecialDamage,
// addSpeed / addAttack, effectInOrientation, Board methods and Status.addPsychicField; stubs for the rest.
const PS = "app/core/pokemon-state.ts"
const RealBase = build({ Team: enums(), min }, js(strategySrc("app/core/abilities/ability-strategy.ts")), "AbilityStrategy")
const stratReal = (file, cls, env = {}) => build({ AttackType: enums(), EffectEnum: enums(), Ability: enums(), AbilityStrategy: RealBase, DelayedCommand, ...env }, js(strategySrc(file)), cls)
const mkCaster = (over = {}) => Object.assign({ team: "BLUE", stars: 1, ap: 0, critPower: 2, critChance: 0, atk: 30, speed: 44, pp: 100, maxPP: 100, skill: "X", effects: new Set(), items: new Set(), passive: "NONE", player: null, count: { ult: 0, crit: 0 }, commands: [], positionX: 0, positionY: 0, range: 1, status: {}, types: new Set(), simulation: { blueAbilitiesCast: [], redAbilitiesCast: [], weather: "NONE" }, broadcastAbility() {}, moveTo() {}, resetCooldown() {} }, over)

// 11. FLOWER_TRICK: the crit counter counts crit rolls of basic attacks (before dodge / protect), not successful crit hits
let chanceQueue = []
const PSclass = build({ Item: enums(), Synergy: enums(), EffectEnum: enums(), AttackType: enums(), distanceM, count, min, chance: () => chanceQueue.shift() ?? false, applyWandEffects: () => ({}) }, js(`class PS {\n${cut(PS, 29, 117, "attack(")}\nreturn { damage, isAttackSuccessful, crit }\n}\n}\n}`), "PS")
const FlowerTrick = stratReal("app/core/abilities/flower-trick.ts", "FlowerTrickStrategy")
const mkEnemy = (over = {}) => mkCaster({ team: "RED", hp: 100, dodge: 0.5, count: { ult: 0, crit: 0, dodgeCount: 0 }, positionX: 3, positionY: 3, status: { paralysis: false, sleep: false, freeze: false, locked: false, protect: false, skydiving: false }, hits: [], handleSpecialDamage(...a) { this.hits.push(a[0]); return { death: false, takenDamage: 0 } }, ...over })
const flower = ({ rolls, targetItems = [], protect = false }) => {
  const target = mkEnemy({ items: new Set(targetItems) }); target.status.protect = protect
  const caster = mkCaster({ stars: 1 }), board = { getAdjacentCells: () => [{ value: target }] }
  new FlowerTrick().process(caster, board, target, false)
  const attacker = mkCaster({ critChance: 100, status: { blinded: false } })
  chanceQueue = [...rolls]
  const basic = new PSclass().attack(attacker, board, target)
  caster.commands.forEach((c) => c.update(3001))
  return { basicDamage: basic.damage, basicSuccessful: basic.isAttackSuccessful, critCounter: target.count.crit, dodgeCount: target.count.dodgeCount, explosionRawRequested: target.hits }
}
const specialCrit = ({ items = [], type, protect = false }) => {
  const reqs = []
  const e = Object.assign(new E(), { status: { magicBounce: false, protect, skydiving: false }, items: new Set(items), effects: new Set(), count: { spellBlockedCount: 0, crit: 0 }, player: null, state: { handleDamage: (p) => { reqs.push(p.damage); return { death: false, takenDamage: 0 } } } })
  e.handleSpecialDamage(10, {}, type, { ap: 0, critPower: 2, effects: new Set(), items: new Set() }, true)
  return { critCounter: e.count.crit, handedToDamageHandler: reqs }
}
out.FLOWER_TRICK = {
  basicCritThenDodged: flower({ rolls: [true, true] }), basicCritNotDodged: flower({ rolls: [true, false] }), noCrit: flower({ rolls: [false, false] }),
  basicCritWithRockyHelmetTarget: flower({ rolls: [true, false], targetItems: ["ROCKY_HELMET"] }), basicCritIntoProtect: flower({ rolls: [true, false], protect: true }),
  abilityTrueCritHelmet: specialCrit({ items: ["ROCKY_HELMET"], type: "TRUE" }), abilitySpecialCritHelmet: specialCrit({ items: ["ROCKY_HELMET"], type: "SPECIAL" }),
  abilitySpecialCritNoHelmet: specialCrit({ type: "SPECIAL" }), abilitySpecialCritIntoProtect: specialCrit({ type: "SPECIAL", protect: true })
}
expect("FLOWER_TRICK a forced basic crit that is DODGED still increments the counter: basic damage 0, counter 1, the 1-star explosion requests raw 30 instead of 15", [out.FLOWER_TRICK.basicCritThenDodged.basicDamage, out.FLOWER_TRICK.basicCritThenDodged.basicSuccessful, out.FLOWER_TRICK.basicCritThenDodged.dodgeCount, out.FLOWER_TRICK.basicCritThenDodged.critCounter, out.FLOWER_TRICK.basicCritThenDodged.explosionRawRequested], [0, false, 1, 1, [30]])
expect("FLOWER_TRICK baseline: no crit roll -> counter 0, raw 15; a basic crit into protect still increments (counter 1, raw 30); Rocky Helmet on the target suppresses the basic-attack counter (raw 15)", [out.FLOWER_TRICK.noCrit.critCounter, out.FLOWER_TRICK.noCrit.explosionRawRequested, out.FLOWER_TRICK.basicCritIntoProtect.critCounter, out.FLOWER_TRICK.basicCritIntoProtect.explosionRawRequested, out.FLOWER_TRICK.basicCritWithRockyHelmetTarget.critCounter, out.FLOWER_TRICK.basicCritWithRockyHelmetTarget.explosionRawRequested], [0, [15], 1, [30], 0, [15]])
expect("FLOWER_TRICK ability crits (Rocky Helmet, raw 10, AP 0, critPower 2): TRUE increments the counter and hands 20 to the damage handler; SPECIAL leaves the counter at 0 and hands 10; without a helmet SPECIAL counts and hands 20; a protected target is blocked before the counter", [out.FLOWER_TRICK.abilityTrueCritHelmet, out.FLOWER_TRICK.abilitySpecialCritHelmet, out.FLOWER_TRICK.abilitySpecialCritNoHelmet, out.FLOWER_TRICK.abilitySpecialCritIntoProtect], [{ critCounter: 1, handedToDamageHandler: [20] }, { critCounter: 0, handedToDamageHandler: [10] }, { critCounter: 1, handedToDamageHandler: [20] }, { critCounter: 0, handedToDamageHandler: [] }])

// 12. DARKEST_LARIAT: destination = target + (target - caster) (full vector), board-wide closest free cell; Fire-effect gains after the damage request; flinch shield split uses ceil
const DarkestLariat = stratReal("app/core/abilities/darkest-lariat.ts", "DarkestLariatStrategy")
const EntAtk = EntClass()
const lariatBoard = (freeCells, casterAt, targetAt) => {
  const b = new BoardFull(6, 8), put = (x, y, team, name) => { const e = mkCaster({ team, name, positionX: x, positionY: y }); b.cells[8 * y + x] = e; return e }
  for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) if (!freeCells.some(([fx, fy]) => fx === x && fy === y)) put(x, y, "BLUE", "filler")
  const c = put(casterAt[0], casterAt[1], "BLUE", "caster"), t = put(targetAt[0], targetAt[1], "RED", "target")
  return { b, c, t }
}
const lariatMove = (freeCells, casterAt, targetAt) => {
  const { b, c, t } = lariatBoard(freeCells, casterAt, targetAt), moves = [], cd = []
  Object.assign(t, { hp: 100, status: { triggerFlinch() {} }, handleSpecialDamage() { return { death: false, takenDamage: 0 } } })
  Object.assign(c, { moveTo: (x, y, bd, forced) => moves.push([x, y, forced]), resetCooldown: (n) => cd.push(n) })
  new DarkestLariat().process(c, b, t, false)
  return { moves, resetCooldown: cd }
}
const lariatFire = ({ effect = "WILDFIRE", targetHp = 100, killsTarget = false, damageRequestResult = { death: false, takenDamage: 0 } } = {}) => {
  const requests = [], caster = Object.assign(new EntAtk(), mkCaster({ atk: 30, speed: 44, effects: new Set(effect ? [effect] : []) })), target = mkEnemy({ hp: targetHp, status: { triggerFlinch() {} } })
  target.handleSpecialDamage = function (...a) { requests.push(a[0]); if (killsTarget) this.hp = 0; return damageRequestResult }
  const board = { getClosestAvailablePlace: () => null }
  new DarkestLariat().process(caster, board, target, false)
  const queued = caster.commands.map((c) => c.delay)
  caster.commands[0].update(1)
  const afterFirst = { atk: caster.atk, requests: [...requests] }
  caster.commands.slice(1).forEach((c) => c.update(1000))
  return { queuedDelays: queued, afterFirstCallback: afterFirst, allRequests: requests, finalAtk: caster.atk }
}
const flinchSplit = build({ Item: enums(), min, OnShieldDepletedEffect: class {} }, js(`function f(reducedDamage, pokemon, attacker, board) {\nlet takenDamage = 0\n${cut(PS, 618, 649, "let residualDamage = reducedDamage")}\nreturn { takenDamage, residualDamage, shieldLeft: pokemon.shield }\n}`), "f")
const split = (reduced, shield, flinch) => flinchSplit(reduced, { shield, hp: 100, status: { flinch }, id: "a", shieldDamageTaken: 0, getEffects: () => [] }, { items: new Set(), id: "b" }, {})
out.DARKEST_LARIAT = {
  fullVectorNotOneSignStep: lariatMove([[5, 2], [3, 0]], [0, 0], [2, 1]),
  boardWideSearchOnlyFarCellFree: lariatMove([[7, 5]], [0, 0], [2, 1]),
  noFreeCell: lariatMove([], [0, 0], [2, 1]),
  wildfireBlockedFirstHit: lariatFire({ damageRequestResult: { death: false, takenDamage: 0 } }),
  wildfireTargetKilledByFirstHit: lariatFire({ killsTarget: true }), targetAlreadyDeadAtEntry: lariatFire({ targetHp: 0 }), noFireEffect: lariatFire({ effect: null }),
  flinchShieldOddDamage: { flinch: split(5, 100, true), noFlinch: split(5, 100, false), evenDamage: split(4, 100, true), shieldBreaks: split(5, 1, true) }
}
expect("DARKEST_LARIAT destination uses the FULL vector: caster (0,0), target (2,1) -> point (4,2); free cells (5,2) and (3,0) -> (5,2) (a one-sign-step point (3,1) would pick (3,0)); the cooldown reset follows the move", out.DARKEST_LARIAT.fullVectorNotOneSignStep, { moves: [[5, 2, false]], resetCooldown: [500] })
expect("DARKEST_LARIAT the closest-free-cell search is board-wide: a single free cell far away (7,5) is chosen; with no free cell the caster neither moves nor resets its cooldown", [out.DARKEST_LARIAT.boardWideSearchOnlyFarCellFree.moves, out.DARKEST_LARIAT.noFreeCell], [[[7, 5, false]], { moves: [], resetCooldown: [] }])
expect("DARKEST_LARIAT speed 44 queues 4 hits at delays 0/250/500/750; WILDFIRE: the damage request is BLOCKED (takenDamage 0) yet ATK 30 -> 31 after the first callback (30 requested, then 31, 32, 33 as ATK is read at each hit)", [out.DARKEST_LARIAT.wildfireBlockedFirstHit.queuedDelays, out.DARKEST_LARIAT.wildfireBlockedFirstHit.afterFirstCallback, out.DARKEST_LARIAT.wildfireBlockedFirstHit.allRequests, out.DARKEST_LARIAT.wildfireBlockedFirstHit.finalAtk], [[0, 250, 500, 750], { atk: 31, requests: [30] }, [30, 31, 32, 33], 34])
expect("DARKEST_LARIAT a hit that kills the stored target still grants its gain, later callbacks do nothing; a target already dead at callback entry gives no request and no gain; without a fire effect ATK stays 30", [out.DARKEST_LARIAT.wildfireTargetKilledByFirstHit.allRequests, out.DARKEST_LARIAT.wildfireTargetKilledByFirstHit.finalAtk, out.DARKEST_LARIAT.targetAlreadyDeadAtEntry.allRequests, out.DARKEST_LARIAT.targetAlreadyDeadAtEntry.finalAtk, out.DARKEST_LARIAT.noFireEffect.finalAtk], [[30], 31, [], 30, 30])
expect("DARKEST_LARIAT flinch with a shield: reduced 5 -> shield takes ceil(2.5)=3 and HP residual ceil(2.5)=3 (taken 6, one more than 5); without flinch 5; reduced 4 -> 2 + 2; shield 1 breaks: residual 3 + (3 - 1) = 5, taken 1 + 5", [out.DARKEST_LARIAT.flinchShieldOddDamage.flinch, out.DARKEST_LARIAT.flinchShieldOddDamage.noFlinch, out.DARKEST_LARIAT.flinchShieldOddDamage.evenDamage, out.DARKEST_LARIAT.flinchShieldOddDamage.shieldBreaks], [{ takenDamage: 6, residualDamage: 3, shieldLeft: 97 }, { takenDamage: 5, residualDamage: 0, shieldLeft: 95 }, { takenDamage: 4, residualDamage: 2, shieldLeft: 98 }, { takenDamage: 6, residualDamage: 5, shieldLeft: 0 }])

// 13. DRAGON_BREATH: effectInOrientation RIGHT loops x < board.rows (6) on the 8-column board; fallback to the cast target only when no enemy was hit
const DragonBreath = stratReal("app/core/abilities/dragon-breath.ts", "DragonBreathStrategy", { effectInOrientation })
const breath = ({ caster: [cx, cy], enemies, target }) => {
  const b = new BoardFull(6, 8), put = (x, y, team, name) => { const e = mkEnemy({ team, name, positionX: x, positionY: y }); e.status = {}; b.cells[8 * y + x] = e; return e }
  const c = put(cx, cy, "BLUE", "caster"); c.range = 1
  const made = enemies.map(([x, y]) => put(x, y, "RED", `e${x}${y}`))
  const tgt = made.find((e) => e.positionX === target[0] && e.positionY === target[1])
  new DragonBreath().process(c, b, tgt, false)
  return made.filter((e) => e.hits.length).map((e) => `${e.name}:${e.hits.join("/")}`)
}
out.DRAGON_BREATH = {
  right_caster4_enemies5and6: breath({ caster: [4, 2], enemies: [[5, 2], [6, 2]], target: [5, 2] }),
  right_caster3_enemies4and5: breath({ caster: [3, 2], enemies: [[4, 2], [5, 2]], target: [4, 2] }),
  right_caster5_enemy6_fallback: breath({ caster: [5, 2], enemies: [[6, 2]], target: [6, 2] }),
  right_caster4_enemy6_only_fallback: breath({ caster: [4, 2], enemies: [[6, 2]], target: [6, 2] }),
  left_caster3_enemies2and1: breath({ caster: [3, 2], enemies: [[2, 2], [1, 2]], target: [2, 2] })
}
expect("DRAGON_BREATH RIGHT, caster (4,2), range 1, enemies (5,2) and (6,2): only (5,2) receives a damage request (the loop stops before column 6); an enemy was found, so the fallback adds nothing", out.DRAGON_BREATH.right_caster4_enemies5and6, ["e52:25"])
expect("DRAGON_BREATH RIGHT, caster (3,2): columns 4 and 5 are both walked and hit", out.DRAGON_BREATH.right_caster3_enemies4and5, ["e42:25", "e52:25"])
expect("DRAGON_BREATH RIGHT from column 5, or an enemy beyond the walked columns: nothing walked / no enemy found, so the cast target alone is hit by the fallback", [out.DRAGON_BREATH.right_caster5_enemy6_fallback, out.DRAGON_BREATH.right_caster4_enemy6_only_fallback], [["e62:25"], ["e62:25"]])
expect("DRAGON_BREATH LEFT is not truncated: both cells of the two-cell ray are hit", out.DRAGON_BREATH.left_caster3_enemies2and1, ["e22:25", "e12:25"])

// 14. DRUM_BEATING: MELMETAL delegation through addAttack (second item-helper pass); count.ult starts at 0 and is incremented by the base before the switch
const { applyBigEaterBeltStatBuff: beltHelper } = build({ Item: enums(), roundToNDigits }, helpers, "{ applyBigEaterBeltStatBuff, applyTwistBandBuff }")
const speedMethods = `${cut(PE, 726, 750, "addAttack(")}\n${cut(PE, 752, 780, "addSpeed(")}`
const EntSpeed = build({ Item: enums(), Passive: enums(), min, max, clamp, roundToNDigits, MAX_SPEED: 300 }, `${helpers}\nclass Ent2 {\n${js(`class _ {\n${speedMethods}\n}`).replace(/^class _ \{\n/, "").replace(/\n\}\s*$/, "")}\n}`, "Ent2")
const speedBuff = ({ passive = "NONE", items = [], ap = 0 }) => {
  const m = Object.assign(new EntSpeed(), { items: new Set(items), passive, atk: 40, speed: 100, team: "BLUE" }), delegated = [], orig = m.addAttack
  m.addAttack = function (...a) { delegated.push(a[0]); return orig.apply(this, a) }
  const caster = { ap, critPower: 2, team: "BLUE" }
  m.addSpeed(10, caster, 1, false)
  return { firstBeltPass: beltHelper(m, 10, caster), delegatedAttackValue: delegated, atk: m.atk, storedSpeed: m.speed }
}
const DrumBeating = stratReal("app/core/abilities/drum-beating.ts", "DrumBeatingStrategy")
const drum = (casts) => {
  const log = [], mkTeam = (team, name) => mkCaster({ team, name, addShield: (...a) => log.push(["shield", name, a[0]]), addSpeed: (...a) => log.push(["speed", name, a[0]]), handleSpecialDamage: (...a) => log.push(["damage", name, a[0]]) })
  const caster = mkTeam("BLUE", "caster"), ally = mkTeam("BLUE", "ally"), enemy = mkTeam("RED", "enemy"), all = [caster, ally, enemy]
  const board = { forEach: (cb) => all.forEach((e, i) => cb(i, 0, e)) }
  const modes = []
  for (let i = 0; i < casts; i++) { log.length = 0; new DrumBeating().process(caster, board, enemy, false); modes.push(log.map((l) => `${l[0]}:${l[1]}:${l[2]}`).join(",")) }
  return { countUltAfter: caster.count.ult, modes }
}
const textHas = (f, ln, s) => lines(f)[ln - 1].includes(s)
out.DRUM_BEATING = {
  melmetalBelt: speedBuff({ passive: "MELMETAL", items: ["BIG_EATER_BELT"] }), melmetalNoItem: speedBuff({ passive: "MELMETAL" }), ordinaryBelt: speedBuff({ items: ["BIG_EATER_BELT"] }),
  castOrderFromZero: drum(4),
  counterInitialisation: { countUltDefault: textHas("app/models/colyseus-models/count.ts", 6, '@type("uint8") ult = 0'), entityConstructor: textHas(PE, 167, "this.count = new Count()"), simulationAddPokemon: textHas("app/core/simulation.ts", 346, "new PokemonEntity(pokemon, x, y, team, this)"), onlyResetInResurrect: textHas(PE, 1552, "this.skill === Ability.VOLT_SURGE") && textHas(PE, 1553, "this.count.ult = 0") }
}
expect("DRUM_BEATING MELMETAL + Big Eater Belt, raw speed buff 10, AP 0, no crit: first Belt pass 12, delegated Attack value 6, second Belt pass inside addAttack gives +7; ATK 40 -> 47 and the stored speed stays 100", out.DRUM_BEATING.melmetalBelt, { firstBeltPass: 12, delegatedAttackValue: [6], atk: 47, storedSpeed: 100 })
expect("DRUM_BEATING MELMETAL without an item: delegated 5, ATK +5, speed unchanged; an ordinary ally with the Belt gets speed +12", [out.DRUM_BEATING.melmetalNoItem.delegatedAttackValue, out.DRUM_BEATING.melmetalNoItem.atk, out.DRUM_BEATING.melmetalNoItem.storedSpeed, out.DRUM_BEATING.ordinaryBelt.storedSpeed], [[5], 45, 100, 112])
expect("DRUM_BEATING from count.ult 0 the base increments before the switch: cast 1 shield (caster and ally, raw 10), cast 2 damage (enemy), cast 3 speed (caster and ally), cast 4 shield again", out.DRUM_BEATING.castOrderFromZero, { countUltAfter: 4, modes: ["shield:caster:10,shield:ally:10", "damage:enemy:10", "speed:caster:10,speed:ally:10", "shield:caster:10,shield:ally:10"] })
expect("DRUM_BEATING count.ult starts at 0 (Count class default, PokemonEntity constructor, Simulation.addPokemon builds a fresh entity); the only reset of count.ult in pokemon-entity.ts is the VOLT_SURGE branch of resurrect()", Object.values(out.DRUM_BEATING.counterInitialisation), [true, true, true, true])

// 15. EXPANDING_FORCE: existing fields count on the first cast; damage radiates around every field-bearing ally after the optional grant
const ExpandingForce = stratReal("app/core/abilities/expanding-force.ts", "ExpandingForceStrategy", { distanceM })
const PsychicStatus = build({ Passive: enums() }, js(`class S {\n${cut(ST, 1307, 1313, "addPsychicField(")}\n}`), "S")
const force = ({ units, enemies, casts = 1, surgeSurfer = false }) => {
  const b = new BoardFull(6, 8), speedRequests = []
  const put = (x, y, team, name, field) => { const e = mkEnemy({ team, name, positionX: x, positionY: y }); e.status = Object.assign(new PsychicStatus(), { psychicField: !!field }); e.stars = 1; if (surgeSurfer && name === "caster") { e.passive = "SURGE_SURFER" } e.addSpeed = (...a) => speedRequests.push([a[0], a[1] === e, a[2], a[3]]); e.broadcastAbility = () => {}; b.cells[8 * y + x] = e; return e }
  const us = units.map(([x, y, name, field]) => put(x, y, "BLUE", name, field)), them = enemies.map(([x, y, name]) => put(x, y, "RED", name, false))
  const caster = us.find((u) => u.name === "caster"); caster.simulation = { blueAbilitiesCast: [], redAbilitiesCast: [] }; caster.count = { ult: 0 }; caster.pp = 85; caster.maxPP = 85; caster.team = "BLUE"
  for (let i = 0; i < casts; i++) new ExpandingForce().process(caster, b, null, false)
  return { fields: us.filter((u) => u.status.psychicField).map((u) => u.name), hits: them.map((e) => `${e.name}:${e.hits.length}`), speedRequests }
}
out.EXPANDING_FORCE = {
  firstCastWithOneExistingFieldAlly: force({ units: [[1, 1, "caster", false], [5, 1, "fieldAlly", true]], enemies: [[1, 2, "nearCaster"], [5, 2, "nearFieldAlly"]] }),
  secondCastSpreadsToNearestFieldlessAlly: force({ units: [[1, 1, "caster", false], [2, 1, "near", false], [6, 1, "far", false]], enemies: [[2, 2, "e"]], casts: 2 }),
  noFieldlessAllyLeft: force({ units: [[1, 1, "caster", true], [5, 1, "a", true]], enemies: [[1, 2, "e1"], [5, 2, "e2"]] }),
  overlappingHitsOnOneEnemy: force({ units: [[1, 1, "caster", true], [3, 1, "a", true]], enemies: [[2, 1, "between"]] }),
  surgeSurferCasterGainsField: force({ units: [[1, 1, "caster", false]], enemies: [[1, 2, "e"]], surgeSurfer: true }),
  surgeSurferAlreadyHasField: force({ units: [[1, 1, "caster", true]], enemies: [[1, 2, "e"]], surgeSurfer: true })
}
expect("EXPANDING_FORCE first cast, caster without a field plus one already-field-bearing ally: the caster gets the field and the damage radiates around BOTH (one hit each on the two adjacent enemies)", out.EXPANDING_FORCE.firstCastWithOneExistingFieldAlly, { fields: ["caster", "fieldAlly"], hits: ["nearCaster:1", "nearFieldAlly:1"], speedRequests: [] })
expect("EXPANDING_FORCE second cast: the caster already has the field, so the nearest field-less ally (not the far one) receives it", [out.EXPANDING_FORCE.secondCastSpreadsToNearestFieldlessAlly.fields, out.EXPANDING_FORCE.secondCastSpreadsToNearestFieldlessAlly.hits], [["caster", "near"], ["e:3"]])
expect("EXPANDING_FORCE no field-less ally left: nothing is granted (no additional source) but the damage still radiates around every field-bearing ally", out.EXPANDING_FORCE.noFieldlessAllyLeft, { fields: ["caster", "a"], hits: ["e1:1", "e2:1"], speedRequests: [] })
expect("EXPANDING_FORCE overlapping hits are kept: an enemy adjacent to two field-bearing allies is hit twice in one cast", out.EXPANDING_FORCE.overlappingHitsOnOneEnemy.hits, ["between:2"])
expect("EXPANDING_FORCE SURGE_SURFER: gaining the field makes a raw addSpeed(30, itself, 0, false) request (not a guaranteed final speed); an existing field makes none", [out.EXPANDING_FORCE.surgeSurferCasterGainsField.speedRequests, out.EXPANDING_FORCE.surgeSurferAlreadyHasField.speedRequests], [[[30, true, 0, false]], []])

// 5b. EXPLOSION (run 6): bounceCrit = incoming crit OR a fresh successful ABILITY_CRIT roll made when the callback runs
const E2 = build({ Item: enums(), EffectEnum: enums(), AttackType: enums(), DelayedCommand, chance: () => true, ARMOR_FACTOR: 0.05, min, count, DOUBLE: 0 }, hsd, "E")
const selfBounce = (Cls, effects) => {
  const requests = []
  const e = Object.assign(new Cls(), { status: { magicBounce: true, protect: false, skydiving: false }, items: new Set(), effects: new Set(effects), stars: 1, ap: 0, critPower: 2, critChance: 50, skill: "EXPLOSION", positionX: 3, positionY: 3, commands: [], count: { spellBlockedCount: 0, crit: 0 }, player: null, broadcastAbility() {}, handleDamage(p) { requests.push(p.damage) } })
  const ret = e.handleSpecialDamage(50, {}, "SPECIAL", e, false)
  e.commands.forEach((c) => c.update(501))
  return { immediate: ret, callbackRequests: requests }
}
out.EXPLOSION.bounceCrit = { noAbilityCrit_successfulRollIrrelevant: selfBounce(E2, []), abilityCritWithSuccessfulRoll: selfBounce(E2, ["ABILITY_CRIT"]), abilityCritWithFailedRoll: selfBounce(E, ["ABILITY_CRIT"]) }
expect("EXPLOSION bounceCrit: incoming crit false, 1 star, AP 0, critPower 2, raw 50: no ABILITY_CRIT -> callback requests 25; ABILITY_CRIT with a successful roll -> 50; ABILITY_CRIT with a failed roll -> 25; the immediate takenDamage is 0 in all cases", [out.EXPLOSION.bounceCrit.noAbilityCrit_successfulRollIrrelevant, out.EXPLOSION.bounceCrit.abilityCritWithSuccessfulRoll, out.EXPLOSION.bounceCrit.abilityCritWithFailedRoll], [{ immediate: { death: false, takenDamage: 0 }, callbackRequests: [25] }, { immediate: { death: false, takenDamage: 0 }, callbackRequests: [50] }, { immediate: { death: false, takenDamage: 0 }, callbackRequests: [25] }])

// ---------------------------------------------------------------------------------------------------------------------------------
// Sections 16-20 (run 6): POWDER, ICE_BALL, BITE, HORN_LEECH, TELEPORT. Real strategy text; real PokemonState.handleDamage / handleHeal /
// addShield (lines 308-420, 422-808) and PokemonEntity.handleDamage / handleSpecialDamage / handleHeal / addShield on a stub Unit; real
// addSpeed / addAttack / addSpecialDefense; the real PokemonState.attack (29-306) for TELEPORT. Stubs for everything else.
const FullState = build({ Item: enums(), Passive: enums(), Weather: enums(), EffectEnum: enums(), Synergy: enums(), AttackType: enums(), Transfer: enums(), HealType: enums(), min, max, count, ARMOR_FACTOR: 0.05, logger, chance: () => false, humanHealEffect: { apply() {} }, SynergyTiers: new Proxy({}, { get: () => [] }), OnShieldDepletedEffect: class {}, OnResurrectingEffect: class {}, FIGHTING_PHASE_DURATION: 0 },
  js(`class FS {\n${cut(PS, 308, 380, "handleHeal(")}\n${cut(PS, 382, 420, "addShield(")}\n${cut(PS, 422, 808, "handleDamage(")}\n triggerDeath() {}\n}`), "FS")
const FullUnitSrc = `${helpers}\nclass FU {\n${js(`class _ {\n${[cut(PE, 335, 344, "handleDamage("), cut(PE, 346, 467, "handleSpecialDamage("), cut(PE, 469, 476, "handleHeal("), cut(PE, 498, 506, "addShield(")].join("\n")}\n}`).replace(/^class _ \{\n/, "").replace(/\n\}\s*$/, "")}\n}`
const FU = build({ Item: enums(), EffectEnum: enums(), AttackType: enums(), DelayedCommand, chance: () => false, ARMOR_FACTOR: 0.05, min, count, roundToNDigits }, FullUnitSrc, "FU")
const mkFU = (over = {}) => {
  const u = Object.assign(new FU(), mkCaster({ team: "RED", hp: 500, maxHP: 1000, shield: 0, def: 0, speDef: 0, id: Math.random().toString(36).slice(2), ap: 0, stars: 1, atk: 50, pp: 0, status: { protect: false, skydiving: false, magicBounce: false, flinch: false, wound: false, burn: false, enraged: false, armorReduction: false, reflect: false, resurrecting: false, resurrection: false, possessedCooldown: 0, triggerProtect() {}, electricField: false, psychicField: false, grassField: false, fairyField: false }, count: { crit: 0, spellBlockedCount: 0, fightingBlockCount: 0, ult: 0 }, physicalDamageReduced: 0, specialDamageReduced: 0, shieldDamageTaken: 0, shieldDone: 0, healDone: 0, physicalDamage: 0, specialDamage: 0, trueDamage: 0, simulation: { weather: "NONE", room: { state: { time: 1 } }, broadcastToSpectators() {}, id: "s", blueAbilitiesCast: [], redAbilitiesCast: [] }, hasSynergyEffect: () => false, getEffects: () => [], addPP() {}, onDamageReceived() {}, onDamageDealt() {}, removeItem(i) { this.items.delete(i) }, addAttack() {}, resetCooldown() {}, toMovingState() {}, addMaxHP() {}, positionX: 1, positionY: 1 }), over)
  u.state = new FullState()
  return u
}
const take = (r) => ({ death: r.death, takenDamage: r.takenDamage })
const dmgCase = ({ shield = 0, hp = 500, maxHP = 1000, flinch = false, pads = false, protect = false, shiny = false, fossil = false, cover = null, dmg = 100 } = {}) => {
  const t = mkFU({ hp, maxHP, shield, items: new Set(shiny ? ["SHINY_CHARM"] : []) })
  t.status.flinch = flinch; t.status.protect = protect
  if (fossil) t.hasSynergyEffect = () => true
  const board = { getAdjacentCells: () => (cover ? [{ value: cover }] : []) }
  const a = mkFU({ team: "BLUE", items: new Set(pads ? ["PROTECTIVE_PADS"] : []) })
  const r = t.handleSpecialDamage(dmg, board, "SPECIAL", a, false)
  return { ...take(r), targetHp: t.hp, targetShield: t.shield }
}
const coverAlly = (hp = 500) => mkFU({ hp, maxHP: 1000, items: new Set(["COVER_BAND"]), id: "cover" })
out.TAKEN_DAMAGE = {
  plain: dmgCase(), shield40: dmgCase({ shield: 40 }), shield200: dmgCase({ shield: 200 }), shield200Flinch: dmgCase({ shield: 200, flinch: true }),
  shield30Pads: dmgCase({ shield: 30, pads: true }), overkillCap: dmgCase({ hp: 40 }), protect: dmgCase({ protect: true }),
  shinyCharm: dmgCase({ hp: 500, maxHP: 1000, dmg: 300, shiny: true }), fossil: dmgCase({ hp: 500, maxHP: 1000, dmg: 300, fossil: true }),
  coverBand: dmgCase({ hp: 50, shield: 20, cover: coverAlly() })
}
const TD = out.TAKEN_DAMAGE
// 18. BITE / HORN_LEECH: heal and flinch inputs come from the REAL handleDamage result (shield part + HP part, exceptions, Cover Band)
const Bite = stratReal("app/core/abilities/bite.ts", "BiteStrategy")
const HornLeech = stratReal("app/core/abilities/horn-leech.ts", "HornLeechStrategy", { min })
const leechRun = (Strat, { shield = 0, hp = 500, protect = false, shiny = false, cover = null, maxHP = 1000, casterHp = 500, wound = false, burn = false, casterProtect = false, bloodMoon = false, casterMaxHP = 1000, dmgHp = null } = {}) => {
  const flinch = []
  const t = mkFU({ hp, maxHP, shield, items: new Set(shiny ? ["SHINY_CHARM"] : []) })
  t.status.protect = protect; t.status.triggerFlinch = (...a) => flinch.push(a[0])
  if (dmgHp) t.hp = dmgHp
  const c = mkFU({ team: "BLUE", hp: casterHp, maxHP: casterMaxHP, atk: 50, stars: 1, player: bloodMoon ? { items: ["BLOOD_STONE"] } : null })
  c.status.wound = wound; c.status.burn = burn; c.status.protect = casterProtect
  if (bloodMoon) c.simulation.weather = "BLOODMOON"
  const board = { getAdjacentCells: () => (cover ? [{ value: cover }] : []) }
  new Strat().process(c, board, t, false)
  return { casterHp: c.hp, casterShield: c.shield, flinchRequests: flinch, targetHp: t.hp, targetShield: t.shield, coverHp: cover?.hp }
}
out.BITE = {
  plain: leechRun(Bite), shieldAbsorbsAll: leechRun(Bite, { shield: 100 }), protectedTarget: leechRun(Bite, { protect: true }), shinyCharmTarget: leechRun(Bite, { hp: 320, maxHP: 1000, shiny: true }),
  coverBandRedirect: leechRun(Bite, { hp: 20, cover: coverAlly() }), woundedCaster: leechRun(Bite, { wound: true }), woundedCasterBloodMoon: leechRun(Bite, { wound: true, bloodMoon: true })
}
out.HORN_LEECH = {
  fullHpCaster_noMissing: leechRun(HornLeech, { casterHp: 1000 }), nearFull_overhealShield: leechRun(HornLeech, { casterHp: 990 }), wounded_nearFull: leechRun(HornLeech, { casterHp: 990, wound: true }),
  protectedCaster_nearFull: leechRun(HornLeech, { casterHp: 990, casterProtect: true }), burned_nearFull: leechRun(HornLeech, { casterHp: 990, burn: true }),
  coverBandRedirect: leechRun(HornLeech, { hp: 20, cover: coverAlly(), casterHp: 500 }), shieldAbsorbsAll: leechRun(HornLeech, { shield: 500, casterHp: 500 })
}
expect("TAKEN_DAMAGE (real handleSpecialDamage + handleDamage, SPECIAL 100, SPE_DEF 0, HP 500): plain 100; shield 40 -> 40 on the shield + 60 HP = 100; shield 200 -> 100 all on the shield; flinch + shield 200 -> ceil(50) + ceil(50) = 100; overkill is capped at current HP (40); protect 0; Shiny Charm 0", [TD.plain.takenDamage, TD.shield40.takenDamage, TD.shield40.targetHp, TD.shield200.takenDamage, TD.shield200.targetHp, TD.shield200Flinch.takenDamage, TD.shield200Flinch.targetShield, TD.shield200Flinch.targetHp, TD.overkillCap.takenDamage, TD.protect.takenDamage, TD.shinyCharm.takenDamage], [100, 100, 440, 100, 500, 100, 150, 450, 40, 0, 0])
expect("TAKEN_DAMAGE Protective Pads on the attacker double the part that hits a shield (shield 30: 30 absorbed, 170 residual, taken 200); the Fossil branch ADDS shield damage on top of the HP part (damage 300 -> taken 500, HP unchanged); a Cover Band redirect returns the COVER ALLY's result (taken 100 although the original target lost no HP and only its shield)", [TD.shield30Pads.takenDamage, TD.shield30Pads.targetHp, TD.fossil.takenDamage, TD.fossil.targetHp, TD.coverBand.takenDamage, TD.coverBand.targetHp, TD.coverBand.targetShield], [200, 330, 500, 500, 100, 50, 0])
expect("BITE (1 star: raw 40, caster HP 500/1000): heal ceil(0.3 x taken) = 12 and flinch 5000 on takenDamage > 0, also when the shield absorbed everything; protect -> no heal, no flinch; Shiny Charm (takenDamage 0) -> no heal, no flinch; Cover Band redirect -> heal and flinch follow the cover ally's takenDamage while the original target keeps its HP", [out.BITE.plain.casterHp, out.BITE.plain.flinchRequests, out.BITE.shieldAbsorbsAll.casterHp, out.BITE.shieldAbsorbsAll.flinchRequests, out.BITE.protectedTarget.casterHp, out.BITE.protectedTarget.flinchRequests, out.BITE.shinyCharmTarget.casterHp, out.BITE.shinyCharmTarget.flinchRequests, out.BITE.coverBandRedirect.casterHp, out.BITE.coverBandRedirect.flinchRequests, out.BITE.coverBandRedirect.targetHp, out.BITE.coverBandRedirect.coverHp], [512, [5000], 512, [5000], 500, [], 500, [], 512, [5000], 20, 460])
expect("BITE wounded caster: no HP heal; with BLOODMOON weather and a Blood Stone the same handleHeal call first requests a shield of round(0.3 x 1 x 12) = 4", [out.BITE.woundedCaster.casterHp, out.BITE.woundedCaster.casterShield, out.BITE.woundedCasterBloodMoon.casterHp, out.BITE.woundedCasterBloodMoon.casterShield], [500, 0, 500, 4])
expect("HORN_LEECH (raw 2 x ATK 50 = 100, taken 100, heal 50): overheal = heal - missing HP from the UNMODIFIED heal and the pre-heal HP -> shield round(overheal / 2): full-HP caster 25, 10 missing 20; a wounded or protected caster gets no heal but still the shield (20); a burned caster's heal is halved by handleHeal while the shield input stays 20; Cover Band redirect heals from the cover ally's takenDamage; a target shield that absorbs everything still counts", [out.HORN_LEECH.fullHpCaster_noMissing.casterShield, out.HORN_LEECH.nearFull_overhealShield.casterHp, out.HORN_LEECH.nearFull_overhealShield.casterShield, out.HORN_LEECH.wounded_nearFull.casterHp, out.HORN_LEECH.wounded_nearFull.casterShield, out.HORN_LEECH.protectedCaster_nearFull.casterHp, out.HORN_LEECH.protectedCaster_nearFull.casterShield, out.HORN_LEECH.burned_nearFull.casterHp, out.HORN_LEECH.burned_nearFull.casterShield, out.HORN_LEECH.coverBandRedirect.casterHp, out.HORN_LEECH.shieldAbsorbsAll.casterHp, out.HORN_LEECH.shieldAbsorbsAll.targetShield], [25, 1000, 20, 990, 20, 990, 20, 1000, 20, 550, 550, 400])

// 16. POWDER: requested nerf vs the applied change and the later restoration (real addSpeed / addAttack with the Belt and Twist helpers)
const Powder = stratReal("app/core/abilities/powder.ts", "PowderStrategy", { max })
const powder = ({ items = [], passive = "NONE", speed = 100, atk = 40, ap = 0, crit = false } = {}) => {
  const victim = Object.assign(new EntSpeed(), mkCaster({ team: "RED", name: "victim", items: new Set(items), passive, speed, atk, commands: [], positionX: 3, positionY: 3 }), { handleSpecialDamage() { return { death: false, takenDamage: 0 } } })
  const caster = mkCaster({ stars: 3, ap, critPower: 2, range: 2, team: "BLUE" })
  const board = { getCellsInRange: () => [{ value: victim }], getCellsBetween: () => [{ x: 3, y: 3, value: victim }] }
  new Powder().process(caster, board, victim, crit)
  const afterNerf = { speed: victim.speed, atk: victim.atk }
  victim.commands.forEach((c) => c.update(5001))
  return { afterNerf, afterRestore: { speed: victim.speed, atk: victim.atk } }
}
out.POWDER = { plain: powder(), bigEaterBelt: powder({ items: ["BIG_EATER_BELT"] }), twistBand: powder({ items: ["TWIST_BAND"] }), twistBandNearCap: powder({ items: ["TWIST_BAND"], speed: 290 }), nerfCappedBySpeed: powder({ speed: 20 }), apAndCrit: powder({ ap: 100, crit: true }), melmetal: powder({ passive: "MELMETAL" }), melmetalBelt: powder({ passive: "MELMETAL", items: ["BIG_EATER_BELT"] }) }
expect("POWDER (3 stars: requested speed nerf 30, AP 0): plain victim 100 -> 70 -> 100; Big Eater Belt does NOT scale the enemy debuff but scales the restoration (30 -> 37): 70 -> 107", [out.POWDER.plain, out.POWDER.bigEaterBelt], [{ afterNerf: { speed: 70, atk: 40 }, afterRestore: { speed: 100, atk: 40 } }, { afterNerf: { speed: 70, atk: 40 }, afterRestore: { speed: 107, atk: 40 } }])
expect("POWDER Twist Band victim: the nerf is flipped into a speed GAIN (100 -> 130) and the restoration adds again (-> 160); both clamp at MAX_SPEED (290 -> 300 -> 300)", [out.POWDER.twistBand.afterNerf.speed, out.POWDER.twistBand.afterRestore.speed, out.POWDER.twistBandNearCap.afterNerf.speed, out.POWDER.twistBandNearCap.afterRestore.speed], [130, 160, 300, 300])
expect("POWDER nerf is capped at the victim's current speed (20 -> 0 -> 20); AP 100 + crit (critPower 2) requests 120, capped at 100: 100 -> 0 -> 100", [out.POWDER.nerfCappedBySpeed.afterNerf.speed, out.POWDER.nerfCappedBySpeed.afterRestore.speed, out.POWDER.apAndCrit.afterNerf.speed, out.POWDER.apAndCrit.afterRestore.speed], [0, 20, 0, 100])
expect("POWDER MELMETAL victim: speed untouched, ATK changes by the delegated half (-15, restoration +15); with Big Eater Belt the restoration is belted twice (+23): ATK 25 -> 48", [out.POWDER.melmetal, out.POWDER.melmetalBelt.afterNerf.atk, out.POWDER.melmetalBelt.afterRestore.atk, out.POWDER.melmetalBelt.afterRestore.speed], [{ afterNerf: { speed: 100, atk: 25 }, afterRestore: { speed: 100, atk: 40 } }, 25, 48, 100])

// 17. ICE_BALL: the +10 SPE_DEF is a request (Belt: +12) and the damage reads the modified stat
const IceBall = stratReal("app/core/abilities/ice-ball.ts", "IceBallStrategy")
const iceBall = ({ items = [], speDef = 20, stars = 1 } = {}) => {
  const caster = Object.assign(new EntAtk(), mkCaster({ stars, items: new Set(items), speDef, def: 5 })), target = mkEnemy({}), reqs = []
  target.handleSpecialDamage = (...a) => { reqs.push(a[0]); return { death: false, takenDamage: 0 } }
  new IceBall().process(caster, {}, target, false)
  return { speDefAfter: caster.speDef, damageRequested: reqs }
}
out.ICE_BALL = { plain: iceBall(), bigEaterBelt: iceBall({ items: ["BIG_EATER_BELT"] }), twistBand: iceBall({ items: ["TWIST_BAND"] }), walrein: iceBall({ stars: 3 }) }
expect("ICE_BALL (1 star, SPE_DEF 20): +10 -> 30 and damage 10 + 0.5 x 30 = 25; Big Eater Belt +12 -> 32 and 26; Twist Band does not touch a positive self gain (25); 3 stars: 30 + 1.5 x 30 = 75", [out.ICE_BALL.plain, out.ICE_BALL.bigEaterBelt, out.ICE_BALL.twistBand, out.ICE_BALL.walrein], [{ speDefAfter: 30, damageRequested: [25] }, { speDefAfter: 32, damageRequested: [26] }, { speDefAfter: 30, damageRequested: [25] }, { speDefAfter: 30, damageRequested: [75] }])

// 19. TELEPORT: the real PokemonState.attack (lines 29-306) consumes the flag whatever the outcome of the basic attack
const AttackFn = build({ Item: enums(), Synergy: enums(), EffectEnum: enums(), AttackType: enums(), Passive: enums(), Pkm: enums(), distanceM, count, min, chance: () => chanceQueue.shift() ?? false, applyWandEffects: () => ({}) }, js(`class PS2 {\n${cut(PS, 29, 306, "attack(")}\n}`), "PS2")
const CanCast = build({ Item: enums(), EffectEnum: enums() }, js(`class C {\n${cut(PE, 250, 256, "get canCast")}\n}`), "C")
const teleportHit = ({ rolls, targetProtect = false, bounce = false, abilityCrit = false, flag = true } = {}) => {
  const t = mkFU({ hp: 500, maxHP: 1000, dodge: 0.5, items: new Set(), effects: new Set() })
  Object.assign(t.status, { protect: targetProtect, magicBounce: bounce, paralysis: false, sleep: false, freeze: false, locked: false, confusion: false }); t.count.dodgeCount = 0
  const a = mkFU({ team: "BLUE", stars: 1, atk: 30, critChance: 100, effects: new Set([...(flag ? ["TELEPORT_NEXT_ATTACK"] : []), ...(abilityCrit ? ["ABILITY_CRIT"] : [])]), onAttack() {}, onHit() {}, types: new Set() })
  a.status.blinded = false
  chanceQueue = [...rolls]
  new AttackFn().attack(a, { cells: [], getAdjacentCells: () => [] }, t)
  return { targetHp: t.hp, flagLeft: a.effects.has("TELEPORT_NEXT_ATTACK"), dodgeCount: t.count.dodgeCount, bounceCommandsQueued: t.commands.length }
}
const noAttack = (flag) => { const c = Object.assign(new CanCast(), { status: { silence: false }, items: new Set(), effects: new Set(flag ? ["TELEPORT_NEXT_ATTACK"] : []) }); return c.canCast }
out.TELEPORT = {
  hit: teleportHit({ rolls: [false, false] }), dodged: teleportHit({ rolls: [false, true] }), protectedTarget: teleportHit({ rolls: [false, false], targetProtect: true }), magicBounceTarget: teleportHit({ rolls: [false, false], bounce: true }),
  critWithAbilityCrit: teleportHit({ rolls: [true, false], abilityCrit: true }), critWithoutAbilityCrit: teleportHit({ rolls: [true, false] }), noFlagControl: teleportHit({ rolls: [false, false], flag: false }),
  canCastWhileMarked: noAttack(true), canCastUnmarked: noAttack(false)
}
expect("TELEPORT (1 star, ATK 30, AP 0): a normal attack adds the 15 bonus as SPECIAL (HP 500 -> 455) and consumes the flag; a DODGED attack (basic damage 0) still delivers the bonus (HP 485) and consumes the flag", [out.TELEPORT.hit, out.TELEPORT.dodged, out.TELEPORT.noFlagControl.targetHp], [{ targetHp: 455, flagLeft: false, dodgeCount: 0, bounceCommandsQueued: 0 }, { targetHp: 485, flagLeft: false, dodgeCount: 1, bounceCommandsQueued: 0 }, 470])
expect("TELEPORT against a protected target: the flag is consumed and the bonus request is blocked by handleSpecialDamage (HP unchanged); against Magic Bounce the SPECIAL bonus is blocked and a delayed bounce is queued on the target while the 30 PHYSICAL basic hit still lands (HP 470)", [out.TELEPORT.protectedTarget, out.TELEPORT.magicBounceTarget], [{ targetHp: 500, flagLeft: false, dodgeCount: 0, bounceCommandsQueued: 0 }, { targetHp: 470, flagLeft: false, dodgeCount: 0, bounceCommandsQueued: 1 }])
expect("TELEPORT bonus crit comes from the BASIC attack's crit roll and needs ABILITY_CRIT: with it a crit roll doubles the bonus (15 -> 30, plus the doubled basic hit), without it the bonus stays 15", [out.TELEPORT.critWithAbilityCrit.targetHp, out.TELEPORT.critWithoutAbilityCrit.targetHp], [410, 425])
expect("TELEPORT canCast is false while the flag is set (pokemon-entity.ts:250-256), so a marked unit that never attacks cannot cast again; it is true again once unmarked", [out.TELEPORT.canCastWhileMarked, out.TELEPORT.canCastUnmarked], [false, true])

// ---------------------------------------------------------------------------------------------------------------------------------
// Sections 21-25 (run 7): JUDGEMENT / MULTI_ATTACK raw zero, SPIKY_SHIELD, HATCH, PROTEAN3. Real strategy text, real handleSpecialDamage /
// handleDamage on stub units, real effectInOrientation, the spike-armor block of PokemonEntity.onHit, the pinned hatch / evolution
// logic (setTimeout replaced by a recorder) and the pinned computeSynergies. Stubs for everything else; nothing here is a fight.

// 21. JUDGEMENT / MULTI_ATTACK: a raw 0 is a request of 0, not a resolved 0 (handleDamage floors a non-blocked hit at 1)
const Judgement = stratReal("app/core/abilities/judgement.ts", "JudgementStrategy")
const MultiAttack = stratReal("app/core/abilities/multi-attack.ts", "MultiAttackStrategy")
const zeroRun = (kind, { synergies = null, types = ["NORMAL"], shield = 0, flinch = false, protect = false, bounce = false, items = [], effects = [], enemies = 1 } = {}) => {
  const mkT = () => { const t = mkFU({ hp: 500, maxHP: 1000, shield, items: new Set(items), effects: new Set(effects) }); t.status.flinch = flinch; t.status.protect = protect; t.status.magicBounce = bounce; return t }
  const targets = Array.from({ length: kind === "multi" ? enemies : 1 }, mkT)
  const c = mkFU({ team: "BLUE", stars: 3, types: new Set(types), player: synergies ? { synergies: new Map(synergies) } : null })
  const board = { getAdjacentCells: () => targets.map((t) => ({ value: t })) }
  new (kind === "judgement" ? Judgement : MultiAttack)().process(c, board, targets[0], false)
  return targets.map((t) => ({ hp: t.hp, shield: t.shield, queuedBounce: t.commands.length }))
}
out.ZERO_RAW = {
  judgementNoPlayer: zeroRun("judgement"), judgementPlayerTypeMissing: zeroRun("judgement", { synergies: [["FIRE", 4]] }), judgementThirty: zeroRun("judgement", { synergies: [["NORMAL", 3]] }),
  judgementZeroOnShield: zeroRun("judgement", { shield: 100 }), judgementZeroFlinchShield: zeroRun("judgement", { shield: 100, flinch: true }), judgementZeroProtect: zeroRun("judgement", { protect: true }), judgementZeroMagicBounce: zeroRun("judgement", { bounce: true }),
  judgementZeroPokeDoll: zeroRun("judgement", { items: ["POKE_DOLL"] }), judgementZeroGuts: zeroRun("judgement", { effects: ["GUTS"] }),
  multiNoPlayerTwoEnemies: zeroRun("multi", { enemies: 2 }), multiTwoEnemiesRaw39: zeroRun("multi", { synergies: [["NORMAL", 3]], enemies: 2 })
}
const ZR = out.ZERO_RAW
expect("JUDGEMENT raw 0 (no player, or no synergy value for the caster's types) still resolves to 1 damage on an unblocked target (HP 500 -> 499); a nonzero raw 30 lands as 30 (HP 470)", [ZR.judgementNoPlayer[0].hp, ZR.judgementPlayerTypeMissing[0].hp, ZR.judgementThirty[0].hp], [499, 499, 470])
expect("JUDGEMENT raw 0 on a shielded target: the 1 lands on the shield (shield 99, HP 500); with flinch and a shield the ceil split gives 1 + 1 (shield 99, HP 499); protect and Magic Bounce block it (HP 500, no bounce queued for a zero amount)", [ZR.judgementZeroOnShield[0], ZR.judgementZeroFlinchShield[0], ZR.judgementZeroProtect[0], ZR.judgementZeroMagicBounce[0]], [{ hp: 500, shield: 99, queuedBounce: 0 }, { hp: 499, shield: 99, queuedBounce: 0 }, { hp: 500, shield: 0, queuedBounce: 0 }, { hp: 500, shield: 0, queuedBounce: 0 }])
expect("JUDGEMENT raw 0 with Poke Doll (x0.7) or the GUTS flat reduction (-3): the minimum-of-1 step still leaves 1 (HP 499)", [ZR.judgementZeroPokeDoll[0].hp, ZR.judgementZeroGuts[0].hp], [499, 499])
expect("MULTI_ATTACK raw 0 hits every adjacent enemy for 1 (two enemies: HP 499 each); raw 39 (13 x 3) lands as 39 on each", [ZR.multiNoPlayerTwoEnemies.map((t) => t.hp), ZR.multiTwoEnemiesRaw39.map((t) => t.hp)], [[499, 499], [461, 461]])

// 22. SPIKY_SHIELD: rays use the real RIGHT-ray bound on the 8 x 6 board; retaliation is the spike-armor block of onHit (successful hits only)
const OrientationArray = [...lines("app/utils/orientation.ts").slice(24, 34).join(" ").matchAll(/Orientation\.(\w+)/g)].map((m) => m[1])
const SpikyShield = stratReal("app/core/abilities/spiky-shield.ts", "SpikyShieldStrategy", { effectInOrientation, OrientationArray })
const spiky = ({ armor, enemies, target, cx = 4, cy = 2 }) => {
  const b = new BoardFull(6, 8), armorCalls = []
  const put = (x, y, team, name) => { const e = mkEnemy({ team, name, positionX: x, positionY: y }); e.status = {}; b.cells[8 * y + x] = e; return e }
  const c = put(cx, cy, "BLUE", "caster"); Object.assign(c, { stars: 1, def: 50, status: { spikeArmor: armor, triggerSpikeArmor: (d) => armorCalls.push(d) } })
  const made = enemies.map(([x, y]) => put(x, y, "RED", `e${x}${y}`))
  const tgt = made.find((e) => e.positionX === target[0] && e.positionY === target[1])
  new SpikyShield().process(c, b, tgt, false)
  return { hits: made.filter((e) => e.hits.length).map((e) => `${e.name}:${e.hits.join("/")}`), armorRequested: armorCalls }
}
const retaliate = build({ Item: enums(), EffectEnum: enums(), AttackType: enums(), chance: () => false, distanceC }, js(`function r(target, board) {\n${cut(PE, 1097, 1126, "if (")}\n}`), "r")
const retaliation = ({ dist = 1, pads = false, armor = true, stars = 3 } = {}) => {
  const woundCalls = [], dmg = []
  const hitter = { positionX: 3, positionY: 3, items: new Set(pads ? ["PROTECTIVE_PADS"] : []), status: { triggerWound: (...a) => woundCalls.push(a[0]) }, handleDamage: (o) => dmg.push([o.damage, o.attackType, o.isRetaliation]) }
  const target = { positionX: 3 + dist, positionY: 3, status: { spikeArmor: armor }, effects: new Set(), critChance: 0, stars, def: 50, ap: 0, critPower: 2 }
  retaliate.call(hitter, target, {})
  return { woundCalls, retaliationDamage: dmg }
}
out.SPIKY_SHIELD = {
  orientationOrder: OrientationArray,
  armorActive: spiky({ armor: true, enemies: [[5, 2], [7, 2], [0, 2], [4, 5]], target: [5, 2] }), armorInactive: spiky({ armor: false, enemies: [[5, 2], [7, 2], [0, 2], [4, 5]], target: [5, 2] }),
  armorActiveCasterColumn5: spiky({ armor: true, enemies: [[6, 2], [7, 2], [0, 2]], target: [6, 2], cx: 5 }),
  retaliationAdjacent: retaliation(), retaliationDistance2: retaliation({ dist: 2 }), retaliationWithPads: retaliation({ pads: true }), retaliationNoArmor: retaliation({ armor: false }), retaliationOneStar: retaliation({ stars: 1 }),
  onHitCallers: { basicAttackSuccessBranch: lines(PS)[294].includes("if (isAttackSuccessful)") && lines(PS)[295].includes("pokemon.onHit("), loadedDiceSecondHit: lines("app/core/effects/items.ts")[193].includes("pokemon.onHit("), notInHandleSpecialDamage: !cut(PE, 346, 467, "handleSpecialDamage(").includes("onHit("), notInHandleDamage: !cut(PS, 422, 808, "handleDamage(").includes("onHit(") }
}
const SP = out.SPIKY_SHIELD
expect("SPIKY_SHIELD orientation order and RIGHT bound: with spike armor already active, caster (4,2), target (5,2): the target takes the DEF hit (30) AND the RIGHT ray hit (30); (7,2) beyond the RIGHT shortfall is never reached; LEFT (0,2) and UP (4,5) are hit; the new armor is requested afterwards", [SP.orientationOrder, SP.armorActive.hits, SP.armorActive.armorRequested], [["DOWN", "DOWNRIGHT", "RIGHT", "UPRIGHT", "UP", "UPLEFT", "LEFT", "DOWNLEFT"], ["e52:30/30", "e02:30", "e45:30"], [3000]])
expect("SPIKY_SHIELD without pre-existing armor: only the cast target is hit (30), no rays; from column 5 the RIGHT ray visits nothing, so (6,2) only takes the DEF hit while LEFT (0,2) takes a ray hit", [SP.armorInactive.hits, SP.armorActiveCasterColumn5.hits], [["e52:30"], ["e62:30", "e02:30"]])
expect("SPIKY_SHIELD retaliation (spike-armor block of onHit): an adjacent hitter without Pads is wounded 2000 and takes SPECIAL retaliation round(DEF 50 x factor) = 50 (3 stars) / 30 (1 star) with isRetaliation true; distance 2, Protective Pads or no armor do nothing", [SP.retaliationAdjacent, SP.retaliationOneStar, SP.retaliationDistance2, SP.retaliationWithPads, SP.retaliationNoArmor], [{ woundCalls: [2000], retaliationDamage: [[50, "SPECIAL", true]] }, { woundCalls: [2000], retaliationDamage: [[30, "SPECIAL", true]] }, { woundCalls: [], retaliationDamage: [] }, { woundCalls: [], retaliationDamage: [] }, { woundCalls: [], retaliationDamage: [] }])
expect("SPIKY_SHIELD retaliation pathway: onHit is called after a successful basic attack (pokemon-state.ts:295-296) and by the Loaded Dice second hit (items.ts:194), and neither handleSpecialDamage nor handleDamage calls it, so spell hits do not trigger it", Object.values(SP.onHitCallers), [true, true, true, true])

// 23. HATCH: transformPokemon carry-over, the delayed (setTimeout) evolution window and the chained-hatch question
const EVO = "app/core/evolution-logic/", PLY = "app/models/colyseus-models/player.ts"
const getHatchTime = build({ EvolutionTime: { EGG_HATCH: 5, EVOLVE_HATCH: 5 }, Pkm: enums(), EffectEnum: enums() }, js(cut(EVO + "hatch-time.ts", 7, 15, "export function getHatchTime").replace("export function", "function")), "getHatchTime")
const HatchHandler = build({ Item: enums(), Pkm: enums(), getHatchTime, GoldenEggItems: [], pickRandomIn: (a) => a[0], EvolutionHandler: class { constructor(rule) { this.rule = rule } getEvolution(p) { return p.evolution } } }, js(cut(EVO + "hatch-evolution-handler.ts", 10, 32, "export class").replace("export class", "class")), "HatchEvolutionHandler")
const timers = []
const emPieces = [[52, 62], [64, 73], [75, 107], [118, 125], [135, 154]].map(([a, b]) => cut(EVO + "evolution-manager.ts", a, b, "").replace(/,\s*$/, ""))
const EM = new (build({ HatchHandler, getHatchTime, EvolutionRuleType: enums(), PokemonActionState: enums(), Passive: enums(), Pkm: enums(), PassiveEffects: {}, OnEvolutionEffect: class {}, setTimeout: (fn, ms) => timers.push([ms, fn]) },
  js(`class EMc {\n getHandler() { return new HatchHandler({}) }\n${emPieces.join("\n")}\n}`), "EMc"))()
const carryOver = build({ PokemonFactory: { createPokemonFromName: () => ({ maxHP: 100, atk: 10, def: 5, speDef: 5, speed: 40, ap: 0, luck: 0 }) }, sum: (a) => a.reduce((x, y) => x + y, 0), Stat: enums(), Ability: enums(), pickRandomIn: (a) => a[0] }, js(cut(EVO + "evolution-handler.ts", 45, 93, "export function carryOverPermanentStats").replace("export function", "function")), "carryOverPermanentStats")
const PlayerCls = build({ PokemonFactory: { createPokemonFromName: (name) => ({ id: `new-${name}`, name, stacks: 0, evolution: "NEXT", evolutionRule: { type: "HATCH" }, items: new Set(), maxHP: 100, atk: 10, def: 5, speDef: 5, speed: 40, ap: 0, luck: 0, tm: "DEFAULT", applyStat(stat, v) { this.appliedStats = { ...(this.appliedStats ?? {}), [stat]: v } }, addItem() {}, onAcquired() {} }) }, carryOverPermanentStats: carryOver, Item: enums() }, js(`class P {\n${cut(PLY, 333, 352, "transformPokemon(")}\n}`), "P")
const hatchPlayer = () => Object.assign(new PlayerCls(), { board: new Map(), pokemonsPlayed: new Set(), updateSynergies() {}, items: [], effects: new Set() })
const mkHatchMon = (over = {}) => ({ id: "old", name: "DREEPY", stacks: 4, evolution: "DRAKLOAK", evolutionRule: { type: "HATCH" }, items: new Set(), action: "IDLE", dishes: new Set(), positionX: 1, positionY: 1, maxHP: 100, atk: 17, def: 5, speDef: 5, speed: 40, ap: 0, luck: 0, tm: "DEFAULT", ...over })
const hatchRun = ({ stacks = 4, items = [], soldInWindow = false } = {}) => {
  timers.length = 0
  const player = hatchPlayer(), old = mkHatchMon({ stacks, items: new Set(items) })
  player.board.set(old.id, old)
  EM.updateHatch(old, player)
  const afterStageEnd = { stacks: old.stacks, action: old.action, timers: timers.map((t) => t[0]), stillOldOnBoard: player.board.has("old") }
  if (soldInWindow) player.board.delete("old")
  const fns = timers.splice(0).map((t) => t[1]); fns.forEach((f) => f())
  const evolved = [...player.board.values()][0]
  return { afterStageEnd, afterTimer: { oldStacks: old.stacks, boardIds: [...player.board.keys()], newStacks: evolved?.stacks, newAppliedStats: evolved?.appliedStats, extraTimers: timers.length } }
}
out.HATCH = { reachesFive: hatchRun(), belowFive: hatchRun({ stacks: 2 }), eviolite: hatchRun({ items: ["EVIOLITE"] }), soldDuringWindow: hatchRun({ soldInWindow: true }), hatchTimes: { egg: getHatchTime({ name: "EGG" }, { effects: new Set() }), eggBreeder: getHatchTime({ name: "EGG" }, { effects: new Set(["BREEDER"]) }), other: getHatchTime({ name: "DREEPY" }, { effects: new Set() }) }, stageEndCallSite: lines("app/rooms/commands/game-commands.ts")[1963].includes("EvolutionRuleType.HATCH") && lines("app/rooms/commands/game-commands.ts")[1964].includes("EvolutionManager.updateHatch(pokemon, player)") }
const HT = out.HATCH
expect("HATCH stacks 4 -> stage end: stacks 5, action HOP, one 2000 ms timer, the old unit is still on the board until the timer runs; when it runs the old instance has stacks 0, the board holds only the new instance with stacks 0 (the permanent stat deltas +7 ATK are carried over, stacks are not) and no further timer is queued, so there is no immediate second hatch", [HT.reachesFive.afterStageEnd, HT.reachesFive.afterTimer], [{ stacks: 5, action: "HOP", timers: [2000], stillOldOnBoard: true }, { oldStacks: 0, boardIds: ["new-DRAKLOAK"], newStacks: 0, newAppliedStats: { HP: 0, ATK: 7, DEF: 0, SPE_DEF: 0, SPEED: 0, AP: 0, LUCK: 0 }, extraTimers: 0 }])
expect("HATCH below 5 stacks: stacks increment, no timer; Eviolite blocks hatching at 5 (no timer, stacks stay 5 and keep counting); a unit sold during the 2 s window does not evolve (the board stays empty)", [HT.belowFive.afterStageEnd.stacks, HT.belowFive.afterStageEnd.timers, HT.eviolite.afterStageEnd.stacks, HT.eviolite.afterStageEnd.timers, HT.eviolite.afterTimer.boardIds, HT.soldDuringWindow.afterTimer.boardIds], [3, [], 5, [], ["old"], []])
expect("HATCH hatch time: Egg 5 (4 with BREEDER or GOLDEN_EGGS), every other HATCH unit 5; the stage-end call site loops over player.board and calls updateHatch for units whose evolutionRule type is HATCH", [HT.hatchTimes.egg, HT.hatchTimes.eggBreeder, HT.hatchTimes.other, HT.stageEndCallSite], [5, 4, 5, true])

// 24. PROTEAN3: dynamic reset versus item-derived types; which units contribute to counts (the pinned computeSynergies)
const SynergyEnum = Object.fromEntries([...lines("app/types/enum/Synergy.ts").join("\n").matchAll(/^\s+([A-Z_]+) = "/gm)].map((m) => [m[1], m[1]]))
class SetSchema extends Set { constructor(a) { super(a) } }
const computeSynergies = build({ Synergy: SynergyEnum, Passive: enums(), SpecialGameRule: enums(), PkmFamily: new Proxy({}, { get: (_, k) => String(k) }), PkmIndex: new Proxy({}, { get: (_, k) => `IDX_${String(k)}` }), Pkm: enums(), SynergyTiersThresholds: { DRAGON: [3, 5, 7] }, SynergyGivenByItem: { FIRE_GEM: "FIRE" }, schemaValues: (s) => [...s], SetSchema },
  js(`${cut("app/models/colyseus-models/synergies.ts", 97, 285, "export function computeSynergies").replace("export function", "function")}\n${cut("app/models/colyseus-models/synergies.ts", 287, 298, "export function addSynergiesGivenByItem").replace("export function", "function")}`), "computeSynergies")
const unit = (name, types, y = 2, passive = "NONE", items = []) => ({ name, passive, positionY: y, types: new SetSchema(types), items: new Set(items), index: name })
const proteanBoard = (arceus) => [unit("A", ["FIRE"]), unit("B", ["FIRE"]), unit("C", ["WATER"]), unit("D", ["WATER"]), unit("E", ["GRASS"]), ...arceus]
const protean = (arceusList) => {
  const board = proteanBoard(arceusList), syn = computeSynergies(board)
  const arc = board.filter((u) => u.passive === "PROTEAN3")
  return { types: arc.map((u) => [...u.types]), counts: { FIRE: syn.get("FIRE"), WATER: syn.get("WATER"), GRASS: syn.get("GRASS") } }
}
out.PROTEAN3 = {
  baseline: protean([]), onBoard: protean([unit("ARCEUS", [], 2, "PROTEAN3")]), onBench: protean([unit("ARCEUS", [], 0, "PROTEAN3")]),
  benchWithFireItem: protean([unit("ARCEUS", [], 0, "PROTEAN3", ["FIRE_GEM"])]), boardWithFireItem: protean([unit("ARCEUS", [], 2, "PROTEAN3", ["FIRE_GEM"])]),
  staleDynamicTypesClearedOnBench: protean([unit("ARCEUS", ["WATER", "GRASS"], 0, "PROTEAN3")]), twoOnBoard: protean([unit("ARCEUS", [], 2, "PROTEAN3"), unit("ARCEUS", [], 3, "PROTEAN3")])
}
const PR = out.PROTEAN3
expect("PROTEAN3 baseline board (two Fire, two Water, one Grass family): FIRE 2, WATER 2, GRASS 1; an Arceus on the board takes the top three with ties in Synergy key order (WATER, FIRE, GRASS) and each added type adds +1 (3, 3, 2)", [PR.baseline.counts, PR.onBoard.types, PR.onBoard.counts], [{ FIRE: 2, WATER: 2, GRASS: 1 }, [["WATER", "FIRE", "GRASS"]], { FIRE: 3, WATER: 3, GRASS: 2 }])
expect("PROTEAN3 bench: an Arceus on the bench gets no dynamic types and adds nothing to the counts; stale dynamic types are cleared (WATER, GRASS -> none); a held type item is re-added after the reset (FIRE stays) but is not counted while on the bench", [PR.onBench, PR.staleDynamicTypesClearedOnBench.types, PR.benchWithFireItem], [{ types: [[]], counts: { FIRE: 2, WATER: 2, GRASS: 1 } }, [[]], { types: [["FIRE"]], counts: { FIRE: 2, WATER: 2, GRASS: 1 } }])
expect("PROTEAN3 on the board with a Fire type item: the item type is added before counting (FIRE 3 by family count), the dynamic loop then skips FIRE without replacing the slot, adding only WATER and GRASS (+1 each): FIRE 3, WATER 3, GRASS 2", [PR.boardWithFireItem.types, PR.boardWithFireItem.counts], [[["FIRE", "WATER", "GRASS"]], { FIRE: 3, WATER: 3, GRASS: 2 }])
// ---------------------------------------------------------------------------------------------------------------------------------
console.log(JSON.stringify(out, null, 1))
const failed = expectations.filter((x) => !x.ok)
for (const x of expectations) console.error(`${x.ok ? "ok  " : "FAIL"} ${x.name}${x.ok ? "" : ` -> got ${JSON.stringify(x.got)}, want ${JSON.stringify(x.want)}`}`)
if (process.argv.includes("--check") && failed.length) process.exit(1)
