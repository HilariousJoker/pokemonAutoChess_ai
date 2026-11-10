// Narrow reproduction of twenty-five repaired candidates (KING_SHIELD, LEECH_SEED, RAGING_BULL, FLAME_CHARGE, EXPLOSION; SLUDGE, VOLT_SWITCH, ZAP_CANNON, BLAZE_KICK, AQUA_STEP; FLOWER_TRICK, DARKEST_LARIAT, DRAGON_BREATH, DRUM_BEATING, EXPANDING_FORCE; POWDER, ICE_BALL, BITE, HORN_LEECH, TELEPORT; JUDGEMENT, MULTI_ATTACK, SPIKY_SHIELD, HATCH, PROTEAN3) using the TEXT of the Section 25 (SHARED_HELPERS) adds shared-helper cases: addPP guards, handleHeal branch order, wound flag vs cooldown, Grass overheal, Blood Stone shield. Section 28 (IMPORT_RECHECK_3) runs the real PROTECT / PSYBEAM / PSYSHOCK / PSYSTRIKE / PSYSHIELD_BASH strategy text with the real status, PP, shield, board-line, teleport and move helpers against stand-in units (controlled callbacks, not fights). Section 27 (IMPORT_RECHECK_2) runs the real MUD_BUBBLE / ABSORB / DRAIN_PUNCH / DREAM_EATER / NATURAL_GIFT strategy text with the real resetCooldown, sleep and Rune Protect helpers against stand-in units. Section 26 (IMPORT_RECHECK) runs the real SUCTION_HEAL / PARABOLIC_CHARGE / POLLEN_PUFF / AROMATHERAPY strategy text and the DRUMMER / WATER_SPRING passive text against the shared-helper stand-ins.
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
// 25. SHARED_HELPERS: addPP guards, handleHeal branch order, wound flag versus cooldown, Grass overheal and Blood Stone shield (maintenance run).
// Real text of PokemonState.handleHeal / addShield (pokemon-state.ts:308-420), PokemonEntity.handleHeal / addShield / addPP / addMaxHP
// (pokemon-entity.ts:469-476, 498-506, 508-532, 577-606), the two item helpers (:1839-1867) and Status.clearNegativeStatus / updateWound
// (status.ts:122-146, 899-906). Explicit assumptions: recipient and caster have AP 0 and critPower 2, apBoost 0 and crit false unless
// stated, no held items unless stated, no BUFF_HEAL_RECEIVED / burn / enraged / ZENITH, no broadcast (time >= FIGHTING_PHASE_DURATION).
// The probe records DOWNSTREAM REQUESTS (arguments the helper passes to addShield / addMaxHP) separately from FINAL RESULTS (hp, maxHP, shield).
const HealEntSrc = `${helpers}\nclass HU {\n${js(`class _ {\n${[cut(PE, 469, 476, "handleHeal("), cut(PE, 498, 506, "addShield("), cut(PE, 508, 532, "addPP("), cut(PE, 577, 606, "addMaxHP(")].join("\n")}\n}`).replace(/^class _ \{\n/, "").replace(/\n\}\s*$/, "")}\n}`
const HU = build({ Item: enums(), EffectEnum: enums(), min, max, clamp, roundToNDigits }, HealEntSrc, "HU")
const StatusH = build({}, js(`class SH {\n${cut(ST, 122, 146, "clearNegativeStatus(")}\n${cut(ST, 899, 906, "updateWound(")}\n}`), "SH")
const mkHU = ({ hp = 500, maxHP = 1000, shield = 0, pp = 10, maxPP = 100, status = {}, items = [], grass = false, weather = "NONE", stones = 0, name = "unit" } = {}) => {
  const u = Object.assign(new HU(), {
    name, team: "BLUE", hp, maxHP, shield, pp, maxPP, ap: 0, critPower: 2, healDone: 0, shieldDone: 0, id: name, items: new Set(items), effects: new Set(),
    status: Object.assign(new StatusH(), { protect: false, runeProtect: false, silence: false, fatigue: false, resurrecting: false, tree: false, wound: false, burn: false, enraged: false, woundCooldown: 0 }, status),
    player: stones ? { items: Array(stones).fill("BLOOD_STONE") } : null,
    simulation: { weather, room: { state: { time: 1 } }, broadcastToSpectators() {} }, hasSynergyEffect: (s) => grass && s === "GRASS"
  })
  u.state = new FullState()
  u.requests = []
  for (const m of ["addShield", "addMaxHP"]) { const real = u[m].bind(u); u[m] = (...a) => { u.requests.push({ helper: m, request: a[0], casterIsRecipient: a[1] === u, apBoost: a[2], crit: a[3] }); return real(...a) } }
  return u
}
const ppAdd = (status, base = 5, items = []) => { const u = mkHU({ status, items, pp: 10 }); u.addPP(base, mkHU({ name: "caster" }), 0, false); return { requested: base, ppBefore: 10, ppAfter: u.pp } }
const healOf = (u, amount = 20, caster = mkHU({ name: "caster" }), apBoost = 0, crit = false) => { const r = u.handleHeal(amount, caster, apBoost, crit); return { returned: r, hp: u.hp, maxHP: u.maxHP, shield: u.shield, downstreamRequests: u.requests, casterHealDone: caster.healDone } }
const woundSeq = (() => {
  const u = mkHU({ hp: 500, status: { wound: true, woundCooldown: 3000 } }), origin = mkHU({ name: "origin" })
  u.status.clearNegativeStatus(u, origin)
  const afterClear = { wound: u.status.wound, woundCooldown: u.status.woundCooldown }
  const immediate = healOf(u, 20)
  u.status.updateWound(50)
  const afterUpdate = { wound: u.status.wound, woundCooldown: u.status.woundCooldown }
  const later = healOf(u, 20)
  return { afterClear, immediate: { returned: immediate.returned, hp: immediate.hp }, afterUpdate, later: { returned: later.returned, hp: later.hp } }
})()
out.SHARED_HELPERS = {
  pp: { protect: ppAdd({ protect: true }), runeProtectAlone: ppAdd({ runeProtect: true }), fatigue: ppAdd({ fatigue: true }), protectAndRuneProtect: ppAdd({ protect: true, runeProtect: true }), none: ppAdd({}) },
  heal20: { protect: healOf(mkHU({ status: { protect: true } })), runeProtectAlone: healOf(mkHU({ status: { runeProtect: true } })), none: healOf(mkHU()) },
  woundCooldownCleared: woundSeq,
  grassOverheal: healOf(mkHU({ hp: 990, maxHP: 1000, grass: true }), 50),
  grassOverhealBigEaterBelt: healOf(mkHU({ hp: 990, maxHP: 1000, grass: true, items: ["BIG_EATER_BELT"] }), 50),
  woundProtectBloodMoonStone: healOf(mkHU({ status: { wound: true, protect: true }, weather: "BLOODMOON", stones: 1 })),
  woundProtectBloodMoonTwoStones: healOf(mkHU({ status: { wound: true, protect: true }, weather: "BLOODMOON", stones: 2 })),
  woundProtectBloodMoonNoStone: healOf(mkHU({ status: { wound: true, protect: true }, weather: "BLOODMOON" })),
  woundProtectStoneClearWeather: healOf(mkHU({ status: { wound: true, protect: true }, weather: "NONE", stones: 1 })),
  woundBloodMoonStoneBigEaterBelt: healOf(mkHU({ status: { wound: true }, weather: "BLOODMOON", stones: 1, items: ["BIG_EATER_BELT"] }))
}
const SH_ = out.SHARED_HELPERS
expect("SHARED_HELPERS addPP (real text; base +5, AP 0, no crit; PP 10): Protect -> PP stays 10 (applied change 0); Rune Protect alone -> 15 (+5); fatigue -> 13 (+3, because round(5 x 0.5) = round(2.5) = 3); Protect together with Rune Protect -> 10 (status.protect is the blocking flag, status.runeProtect is not read by addPP)", [SH_.pp.protect.ppAfter, SH_.pp.runeProtectAlone.ppAfter, SH_.pp.fatigue.ppAfter, SH_.pp.protectAndRuneProtect.ppAfter, SH_.pp.none.ppAfter], [10, 15, 13, 10, 15])
expect("SHARED_HELPERS handleHeal 20 (HP 500/1000, no modifiers): Protect -> returned 0 / 0 and HP stays 500; Rune Protect alone -> healReceived 20, HP 520 (handleHeal tests status.protect, never status.runeProtect); both without any downstream addShield / addMaxHP request", [SH_.heal20.protect.returned, SH_.heal20.protect.hp, SH_.heal20.runeProtectAlone.returned, SH_.heal20.runeProtectAlone.hp, SH_.heal20.protect.downstreamRequests, SH_.heal20.runeProtectAlone.downstreamRequests], [{ healReceived: 0, overheal: 0 }, 500, { healReceived: 20, overheal: 0 }, 520, [], []])
expect("SHARED_HELPERS wound flag versus cooldown (real clearNegativeStatus and updateWound): clearing the cooldown leaves wound = true (cooldown 0); an immediate heal of 20 still returns 0 / 0 and HP stays 500; only updateWound(50) sets wound = false, and the next heal then returns 20 (HP 520)", [woundSeq.afterClear, woundSeq.immediate, woundSeq.afterUpdate, woundSeq.later], [{ wound: true, woundCooldown: 0 }, { returned: { healReceived: 0, overheal: 0 }, hp: 500 }, { wound: false, woundCooldown: 0 }, { returned: { healReceived: 20, overheal: 0 }, hp: 520 }])
expect("SHARED_HELPERS Grass recipient 990/1000, heal 50 (no items): healReceived 10, overheal 40; DOWNSTREAM REQUEST addMaxHP(16) with the recipient as caster, apBoost 0, crit false; FINAL maxHP 1016 and HP 1016 (addMaxHP also raises current HP by its value, so the total HP gain is 26, not 10); with a Big Eater Belt on the recipient the request is still 16 but the FINAL maxHP is 1020 (16 x 1.25 = 20)", [SH_.grassOverheal.returned, SH_.grassOverheal.downstreamRequests, SH_.grassOverheal.hp, SH_.grassOverheal.maxHP, SH_.grassOverhealBigEaterBelt.downstreamRequests[0].request, SH_.grassOverhealBigEaterBelt.maxHP, SH_.grassOverhealBigEaterBelt.hp], [{ healReceived: 10, overheal: 40 }, [{ helper: "addMaxHP", request: 16, casterIsRecipient: true, apBoost: 0, crit: false }], 1016, 1016, 16, 1020, 1020])
expect("SHARED_HELPERS wound + Protect + Blood Moon + one Blood Stone, heal 20: the wound branch comes first, so Protect is never reached: returned 0 / 0, HP unchanged (500), DOWNSTREAM REQUEST addShield(6) = round(0.3 x 1 x 20) with the recipient as caster; FINAL shield 6. Two stones -> request 12; no Blood Stone or no Blood Moon weather -> no request; a Big Eater Belt on the recipient turns the request 6 into a FINAL shield of 7 (6 x 1.25 = 7.5 rounded down)", [SH_.woundProtectBloodMoonStone.returned, SH_.woundProtectBloodMoonStone.hp, SH_.woundProtectBloodMoonStone.downstreamRequests, SH_.woundProtectBloodMoonStone.shield, SH_.woundProtectBloodMoonTwoStones.downstreamRequests[0].request, SH_.woundProtectBloodMoonNoStone.downstreamRequests, SH_.woundProtectStoneClearWeather.downstreamRequests, SH_.woundBloodMoonStoneBigEaterBelt.downstreamRequests[0].request, SH_.woundBloodMoonStoneBigEaterBelt.shield], [{ healReceived: 0, overheal: 0 }, 500, [{ helper: "addShield", request: 6, casterIsRecipient: true, apBoost: 0, crit: false }], 6, 12, [], [], 6, 7])
// 26. IMPORT_RECHECK (import run): the real strategy / passive text of SUCTION_HEAL, PARABOLIC_CHARGE, POLLEN_PUFF, AROMATHERAPY, drumBeat (DRUMMER) and
// WaterSpringEffect (WATER_SPRING) run against the section-25 stand-ins for handleHeal / addPP / addShield / addMaxHP / clearNegativeStatus. Shared helpers are
// executed; the whole ability or passive in a real fight is NOT. Stubs: board / cell lookups, the target of the damage call (records the request), PP spend.
const AB = "app/core/abilities/", PASS = "app/core/effects/passives.ts"
const mkS = (over = {}) => { const u = mkHU(over); u.count = { ult: 0, attackCount: 0 }; u.simulation.blueAbilitiesCast = []; u.simulation.redAbilitiesCast = []; u.broadcastAbility = () => {}; u.stars = over.stars ?? 1; u.ap = over.ap ?? 0; u.skill = over.skill ?? "X"; u.positionX = over.x ?? 0; u.positionY = over.y ?? 0; u.passive = over.passive ?? "NONE"; u.team = over.team ?? "BLUE"; return u }
const dmgSpy = (name = "target", team = "RED") => { const t = { name, team, requests: [], positionX: 5, positionY: 5, handleSpecialDamage(raw, board, type, att, crit) { t.requests.push(raw); return { takenDamage: 0, death: false } } }; return t }
// PARABOLIC_CHARGE: overHeal is computed BEFORE the heal from the UNMODIFIED request and the pre-heal HP; handleHeal's own overheal comes after its modifiers
const Parabolic = stratReal(`${AB}parabolic-charge.ts`, "ParabolicChargeStrategy", { min })
const parabolic = ({ stars = 2, hp = 90, maxHP = 100, status = {}, grass = false, items = [] } = {}) => {
  const c = mkS({ stars, hp, maxHP, status, grass, items }), t = dmgSpy(), done = []
  const real = c.state.handleHeal.bind(c.state); c.state.handleHeal = (...a) => { const r = real(...a); done.push(r); return r }
  new Parabolic().process(c, {}, t, false)
  return { damageRequests: t.requests, handleHealReturned: done[0], hp: c.hp, maxHP: c.maxHP, shield: c.shield, downstreamRequests: c.requests }
}
// POLLEN_PUFF: lowest ABSOLUTE current hp among all same-team entities (caster and full-HP units included), apBoost 1 with the caster's AP
const Pollen = stratReal(`${AB}pollen-puff.ts`, "PollenPuffStrategy")
const pollen = (allies, { stars = 1, ap = 0 } = {}) => {
  const c = mkS({ stars, ap, hp: 400, maxHP: 400, name: "caster" })
  const units = [c, ...allies.map((a) => mkS(a))]; units.push(mkS({ name: "enemy", team: "RED", hp: 1, maxHP: 500 }))
  const heals = []
  for (const u of units) { const real = u.state.handleHeal.bind(u.state); u.state.handleHeal = (p, h, cst, ap, cr) => { const r = real(p, h, cst, ap, cr); heals.push({ target: u.name, requested: h, apBoost: ap, crit: cr, returned: r }); return r }; }
  new Pollen().process(c, { cells: units }, null, false)
  return { heals, units: Object.fromEntries(units.map((u) => [u.name, { hp: u.hp, maxHP: u.maxHP, shield: u.shield, requests: u.requests }])) }
}
// AROMATHERAPY: clearNegativeStatus only zeroes cooldowns; wound / burn FLAGS are still set when the next statement runs handleHeal
const Aroma = stratReal(`${AB}aroma-therapy.ts`, "AromatherapyStrategy")
const aroma = (neighbours, { stars = 1 } = {}) => {
  const c = mkS({ stars, hp: 400, maxHP: 400, name: "caster", x: 3, y: 3 })
  const cells = neighbours.map((n) => ({ value: mkS(n) }))
  new Aroma().process(c, { getAdjacentCells: () => cells }, dmgSpy(), false)
  return Object.fromEntries(cells.filter((x) => x.value).map((x) => [x.value.name, { hp: x.value.hp, wound: x.value.status.wound, shield: x.value.shield, downstream: x.value.requests, woundCooldown: x.value.status.woundCooldown, burn: x.value.status.burn, burnCooldown: x.value.status.burnCooldown }]))
}
// SUCTION_HEAL: heal = 0.5 x the returned takenDamage (shield damage included)
const Suction = stratReal(`${AB}suction-heal.ts`, "SuctionHealStrategy")
const suction = ({ stars = 3, casterStatus = {}, casterHp = 300, enemies = [{ shield: 100 }], weather = "NONE", stones = 0 } = {}) => {
  const c = mkFU({ team: "BLUE", hp: casterHp, maxHP: 1000, stars, atk: 50, player: stones ? { items: Array(stones).fill("BLOOD_STONE") } : null })
  Object.assign(c.status, casterStatus); c.simulation.weather = weather
  const es = enemies.map((e, i) => { const u = mkFU({ team: "RED", hp: e.hp ?? 500, maxHP: 1000, shield: e.shield ?? 0, name: `e${i}`, items: new Set(e.shiny ? ["SHINY_CHARM"] : []) }); u.positionX = 5; u.positionY = 5; return u })
  new Suction().process(c, { getCellsInFront: () => es.map((value) => ({ value })), getAdjacentCells: () => [] }, es[0], false)
  return { casterHp: c.hp, casterShield: c.shield, enemyHp: es.map((e) => e.hp), enemyShield: es.map((e) => e.shield) }
}
// DRUMMER and WATER_SPRING: PP given by the real passive code reaches addPP; Protect blocks, Rune Protect alone and fatigue behave as in addPP
const drumBeat = build({ Passive: enums(), OnAttackEffect: class {}, castAbility() {}, AbilityStrategies: {} }, js(`${cut(PASS, 73, 111, "export function drumBeat").replace("export function", "function")}`), "drumBeat")
const drumRun = (stars, status) => {
  const d = Object.assign(mkS({ stars, passive: "DRUMMER", pp: 0, maxPP: 60, name: "drummer" }), { pp: 0, maxPP: 60, speed: 58, canCast: true, resetCooldown() {}, getEffects: () => [], status: { paralysis: false } })
  const r = mkS({ pp: 10, maxPP: 100, status, name: "receiver" }), other = mkS({ pp: 10, passive: "DRUMMER", name: "otherDrummer" }), foe = mkS({ pp: 10, team: "RED", name: "foe" })
  drumBeat(d, { getAdjacentCells: () => [r, other, foe].map((value) => ({ value })) })
  return { receiver: r.pp, otherDrummer: other.pp, foe: foe.pp, drummerPP: d.pp }
}
const WaterSpring = build({ Passive: enums(), OnAbilityCastEffect: class { constructor(cb, origin) { this.cb = cb; this.origin = origin } } }, js(cut(PASS, 332, 339, "export const WaterSpringEffect").replace("export const", "const")), "WaterSpringEffect")
const spring = (status, { casterTeam = "RED" } = {}) => {
  const ws = mkS({ passive: "WATER_SPRING", team: "BLUE", pp: 10, status, name: "ws", skill: "MUD_BUBBLE" }), allyOfCaster = mkS({ passive: "WATER_SPRING", team: casterTeam, pp: 10, name: "wsSameTeam" })
  const board = { forEach: (cb) => [ws, allyOfCaster].forEach((u, i) => cb(i, 0, u)) }
  WaterSpring.cb(mkS({ team: casterTeam, name: "caster" }), board)
  return { ws: ws.pp, wsOnCasterTeam: allyOfCaster.pp }
}
out.IMPORT_RECHECK = {
  parabolic: {
    heliolisk90: parabolic(), helioptile90: parabolic({ stars: 1 }), fullHp: parabolic({ hp: 100 }), burning: parabolic({ status: { burn: true } }),
    wounded: parabolic({ status: { wound: true } }), protect: parabolic({ status: { protect: true } }), runeProtectAlone: parabolic({ status: { runeProtect: true } }),
    grass: parabolic({ grass: true }), grassBurning: parabolic({ grass: true, status: { burn: true } })
  },
  pollen: {
    absoluteLowest: pollen([{ name: "bigHurt", hp: 300, maxHP: 1000 }, { name: "smallFull", hp: 100, maxHP: 100 }]),
    tieFirstInArray: pollen([{ name: "a", hp: 200, maxHP: 200 }, { name: "b", hp: 200, maxHP: 900 }]),
    grassFullHp: pollen([{ name: "grassFull", hp: 100, maxHP: 100, grass: true }], { ap: 50 }),
    grassFullHpAp0Ribombee: pollen([{ name: "grassFull", hp: 100, maxHP: 100, grass: true }], { stars: 2 }),
    woundedLowest: pollen([{ name: "wounded", hp: 100, maxHP: 1000, status: { wound: true } }])
  },
  aroma: {
    woundAndBurn: aroma([{ name: "wounded", hp: 100, maxHP: 1000, status: { wound: true, woundCooldown: 3000 } }, { name: "burning", hp: 100, maxHP: 1000, status: { burn: true, burnCooldown: 3000 } }, { name: "plain", hp: 100, maxHP: 1000 }, { name: "enemy", hp: 100, maxHP: 1000, team: "RED", status: { wound: true, woundCooldown: 3000 } }]),
    woundBloodMoon: aroma([{ name: "woundedStone", hp: 100, maxHP: 1000, status: { wound: true, woundCooldown: 3000 }, weather: "BLOODMOON", stones: 1 }], { stars: 2 }),
    protectedAlly: aroma([{ name: "protectedAlly", hp: 100, maxHP: 1000, status: { protect: true } }])
  },
  suction: {
    shieldAbsorbs: suction(), plainTarget: suction({ enemies: [{}] }), shinyCharmTarget: suction({ enemies: [{ shiny: true, hp: 320 }], casterHp: 300 }),
    casterProtect: suction({ casterStatus: { protect: true } }), casterRuneProtectAlone: suction({ casterStatus: { runeProtect: true } }),
    casterWoundedBloodMoon: suction({ casterStatus: { wound: true }, weather: "BLOODMOON", stones: 1 })
  },
  drummer: { stars1: drumRun(1, {}), stars2: drumRun(2, {}), stars3: drumRun(3, {}), protect: drumRun(3, { protect: true }), runeProtectAlone: drumRun(3, { runeProtect: true }), fatigue1: drumRun(1, { fatigue: true }), fatigue2: drumRun(2, { fatigue: true }), fatigue3: drumRun(3, { fatigue: true }) },
  waterSpring: { plain: spring({}), protect: spring({ protect: true }), runeProtectAlone: spring({ runeProtect: true }), fatigue: spring({ fatigue: true }), sameTeamCast: spring({}, { casterTeam: "BLUE" }) }
}
const IR = out.IMPORT_RECHECK
expect("IMPORT_RECHECK PARABOLIC_CHARGE (real strategy text; 2 stars: heal 50, base damage 50; caster 90/100, AP 0): the damage request is 50 + the PRE-heal raw overHeal 40 = 90 while handleHeal returns healReceived 10, overheal 40; a 1-star caster (heal 25) at 90/100 requests 25 + 15 = 40; a full-HP caster requests 50 + 50 = 100 although healReceived is 0", [IR.parabolic.heliolisk90.damageRequests, IR.parabolic.heliolisk90.handleHealReturned, IR.parabolic.helioptile90.damageRequests, IR.parabolic.fullHp.damageRequests, IR.parabolic.fullHp.handleHealReturned], [[90], { healReceived: 10, overheal: 40 }, [40], [100], { healReceived: 0, overheal: 50 }])
expect("IMPORT_RECHECK PARABOLIC_CHARGE modified healing versus the precomputed overHeal: a burning caster (heal x0.5 = 25, capped at 10 missing) gets healReceived 10 and a handleHeal overheal of 15, but the damage request is still 50 + 40 = 90; a wounded or Protected caster is not healed (HP stays 90) and the damage request is still 90; Rune Protect alone does not block the heal (HP 100)", [IR.parabolic.burning.damageRequests, IR.parabolic.burning.handleHealReturned, IR.parabolic.wounded.damageRequests, IR.parabolic.wounded.hp, IR.parabolic.protect.damageRequests, IR.parabolic.protect.hp, IR.parabolic.runeProtectAlone.hp], [[90], { healReceived: 10, overheal: 15 }, [90], 90, [90], 90, 100])
expect("IMPORT_RECHECK PARABOLIC_CHARGE Grass caster 90/100: handleHeal overheal 40 -> downstream request addMaxHP(16) (final maxHP and HP 116); a burning Grass caster has handleHeal overheal 15 -> request addMaxHP(6) (final 106) while the damage request stays 90; the Grass amount is never the pre-heal overHeal", [IR.parabolic.grass.downstreamRequests[0].request, IR.parabolic.grass.maxHP, IR.parabolic.grass.hp, IR.parabolic.grass.damageRequests, IR.parabolic.grassBurning.downstreamRequests[0].request, IR.parabolic.grassBurning.maxHP, IR.parabolic.grassBurning.damageRequests], [16, 116, 116, [90], 6, 106, [90]])
expect("IMPORT_RECHECK POLLEN_PUFF (real strategy text; caster 400/400 plus allies; the heal is one handleHeal call with apBoost 1 and the cast crit flag): the target is the ally with the lowest ABSOLUTE current hp - a 100/100 unit is chosen over a 300/1000 unit and over the caster; the request is the raw 30 and the unit is already full (healReceived 0, overheal 30); on equal hp the first in the cells array is chosen; a wounded lowest-hp ally receives nothing", [IR.pollen.absoluteLowest.heals, IR.pollen.tieFirstInArray.heals.map((h) => h.target), IR.pollen.woundedLowest.heals, IR.pollen.woundedLowest.units.wounded.hp], [[{ target: "smallFull", requested: 30, apBoost: 1, crit: false, returned: { healReceived: 0, overheal: 30 } }], ["a"], [{ target: "wounded", requested: 30, apBoost: 1, crit: false, returned: { healReceived: 0, overheal: 0 } }], 100])
expect("IMPORT_RECHECK POLLEN_PUFF Grass overheal: a full-HP Grass target with the caster at AP 50: 30 x 1.5 = 45 all overheal, DOWNSTREAM request addMaxHP(0.4 x 45 = 18), final maxHP and HP 118 (0.4 x the overheal, not 40% of the existing max HP 100, which would be 40); a 2-star caster at AP 0 requests 60 -> overheal 60 -> addMaxHP(24), final 124", [IR.pollen.grassFullHp.units.grassFull.requests, IR.pollen.grassFullHp.units.grassFull.maxHP, IR.pollen.grassFullHp.units.grassFull.hp, IR.pollen.grassFullHpAp0Ribombee.units.grassFull.requests[0].request, IR.pollen.grassFullHpAp0Ribombee.units.grassFull.maxHP], [[{ helper: "addMaxHP", request: 18, casterIsRecipient: true, apBoost: 0, crit: false }], 118, 118, 24, 124])
expect("IMPORT_RECHECK AROMATHERAPY (real strategy text, real clearNegativeStatus; 1 star: heal 20, apBoost 1, caster AP 0; adjacent allies only, enemies skipped): a wounded ally keeps wound = true (woundCooldown 0) and receives no HP; a burning ally keeps burn = true (burnCooldown 0) so the immediately following heal is halved (HP 100 -> 110, not 120); an ordinary ally gains the full 20 (HP 120); the enemy neighbour is untouched (wound cooldown still 3000)", [IR.aroma.woundAndBurn.wounded, IR.aroma.woundAndBurn.burning, IR.aroma.woundAndBurn.plain.hp, IR.aroma.woundAndBurn.enemy.woundCooldown], [{ hp: 100, wound: true, shield: 0, downstream: [], woundCooldown: 0, burn: false, burnCooldown: 0 }, { hp: 110, wound: false, shield: 0, downstream: [], woundCooldown: 0, burn: true, burnCooldown: 0 }, 120, 3000])
expect("IMPORT_RECHECK AROMATHERAPY wound branch: a wounded 2-star neighbour under Blood Moon with one Blood Stone is not healed (HP 100) but DOWNSTREAM request addShield(round(0.3 x 1 x 40) = 12) with the ally as the shield's caster and apBoost 1 (final shield 12); an unwounded neighbour with status.protect receives nothing", [IR.aroma.woundBloodMoon.woundedStone.hp, IR.aroma.woundBloodMoon.woundedStone.downstream, IR.aroma.woundBloodMoon.woundedStone.shield, IR.aroma.protectedAlly.protectedAlly.hp], [100, [{ helper: "addShield", request: 12, casterIsRecipient: true, apBoost: 1, crit: false }], 12, 100])
expect("IMPORT_RECHECK SUCTION_HEAL (real strategy text, real handleSpecialDamage / handleDamage; 3 stars: raw 60, caster 300/1000, AP 0): returned takenDamage 60 gives a heal request of 30 (HP 330) even when the target's shield absorbed all of it (target HP unchanged); Shiny Charm triggering makes takenDamage 0 and no heal; caster Protect -> no heal; Rune Protect alone -> heal 30; wounded caster under Blood Moon with a Blood Stone -> no HP and a shield of round(0.3 x 30) = 9", [IR.suction.shieldAbsorbs.casterHp, IR.suction.shieldAbsorbs.enemyHp, IR.suction.shieldAbsorbs.enemyShield, IR.suction.plainTarget.enemyHp, IR.suction.shinyCharmTarget.casterHp, IR.suction.casterProtect.casterHp, IR.suction.casterRuneProtectAlone.casterHp, IR.suction.casterWoundedBloodMoon.casterHp, IR.suction.casterWoundedBloodMoon.casterShield], [330, [500], [40], [440], 300, 300, 330, 300, 9])
expect("IMPORT_RECHECK DRUMMER (real drumBeat text, real addPP; receiver PP 10; ppGained 2 / 3 / 5 for 1 / 2 / 3 stars, adjacent same-team non-DRUMMER only): PP 12 / 13 / 15; Protect -> 10 (no gain); Rune Protect alone -> 15; fatigue rounds the halved request: 2 -> 1 (PP 11), 3 -> 2 (PP 12), 5 -> 3 (PP 13); another DRUMMER and the enemy neighbour gain nothing; the drummer's own PP is unchanged", [IR.drummer.stars1.receiver, IR.drummer.stars2.receiver, IR.drummer.stars3.receiver, IR.drummer.protect.receiver, IR.drummer.runeProtectAlone.receiver, IR.drummer.fatigue1.receiver, IR.drummer.fatigue2.receiver, IR.drummer.fatigue3.receiver, IR.drummer.stars3.otherDrummer, IR.drummer.stars3.foe, IR.drummer.stars3.drummerPP], [12, 13, 15, 10, 15, 11, 12, 13, 10, 10, 0])
expect("IMPORT_RECHECK WATER_SPRING (real WaterSpringEffect text, real addPP; Water Spring unit PP 10; an enemy casts): +5 -> 15; Protect -> 10; Rune Protect alone -> 15; fatigue -> 13 (round 2.5 = 3); a Water Spring unit on the CASTER's own team gains nothing", [IR.waterSpring.plain.ws, IR.waterSpring.protect.ws, IR.waterSpring.runeProtectAlone.ws, IR.waterSpring.fatigue.ws, IR.waterSpring.plain.wsOnCasterTeam, IR.waterSpring.sameTeamCast.ws], [15, 10, 15, 13, 10, 10])
// 27. IMPORT_RECHECK_2 (second import run): the real MUD_BUBBLE / ABSORB / DRAIN_PUNCH / DREAM_EATER / NATURAL_GIFT strategy text plus the real resetCooldown,
// handleHeal / addShield / addMaxHP, handleDamage, clearNegativeStatus, triggerRuneProtect, triggerSleep, updateSleep, updateWound text and the real sleep-reduction lines of
// onDamageReceived, run against STAND-IN units and boards (cell lists, the target of plain damage calls, the swap helper). Requests = arguments a helper receives; returns =
// what a helper hands back; final = the stored hp / maxHP / shield / pp / cooldown afterwards. Nothing here is a fight.
const ST2 = ST
const StatusB = build({ Weather: enums(), EffectEnum: enums(), Item: enums(), Passive: enums(), CC_COOLDOWN: 1500 },
  js(`class SB {\n${cut(ST2, 122, 146, "clearNegativeStatus(")}\n${cut(ST2, 760, 786, "triggerSleep(")}\n${cut(ST2, 788, 804, "updateSleep(")}\n${cut(ST2, 899, 906, "updateWound(")}\n${cut(ST2, 956, 966, "triggerRuneProtect(")}\n applyStatusDurationReductions(d) { return d }\n triggerRage() {}\n}`), "SB")
const sleepFrag = new Function(cut(PE, 1211, 1214, "// Reduce sleep duration"))
const RC = build({}, js(`class RC {\n${cut(PE, 319, 321, "resetCooldown(")}\n}`), "RC")
const resetCooldownReal = RC.prototype.resetCooldown
const mkB = (over = {}) => { // stand-in caster: real handleHeal / addShield / addMaxHP via section 25's HU, plus cooldown / counts
  const u = mkS(over); u.cooldown = over.cooldown ?? 0; u.speed = over.speed ?? 44; u.resetCooldown = resetCooldownReal; u.status = Object.assign(new StatusB(), { sleep: false, ccCooldown: 0, runeProtectCooldown: 0, burnCooldown: 0, burnOrigin: null }, u.status); return u
}
const healLog = (units) => { const log = []; for (const u of units) { const real = u.state.handleHeal.bind(u.state); u.state.handleHeal = (p, h, cst, ap, cr) => { const r = real(p, h, cst, ap, cr); log.push({ target: u.name, requested: h, apBoost: ap, crit: cr, returned: r }); return r } } return log }
// MUD_BUBBLE
const MudBubble = stratReal(`${AB}mud-bubble.ts`, "MudBubbleStrategy")
const mud = ({ speed = 44, stars = 1, ap = 0, hp = 50, maxHP = 100, cooldown = 0, status = {}, grass = false, weather = "NONE", stones = 0, items = [] } = {}) => {
  const c = mkB({ stars, ap, hp, maxHP, speed, cooldown, status, grass, weather, stones, items, name: "caster" }), log = healLog([c])
  new MudBubble().process(c, {}, null, false)
  return { heal: log, hp: c.hp, maxHP: c.maxHP, shield: c.shield, downstream: c.requests, cooldown: c.cooldown }
}
// ABSORB
const Absorb = stratReal(`${AB}absorb.ts`, "AbsorbStrategy")
const absorb = ({ stars = 1, ap = 0, targetZero = true, neighbours = [] } = {}) => {
  const c = mkB({ stars, ap, hp: 100, maxHP: 100, name: "caster", x: 3, y: 3 }), ns = neighbours.map((n) => mkB(n)), enemy = mkB({ team: "RED", name: "enemyNeighbour", hp: 10, maxHP: 100 })
  const all = [c, ...ns, enemy], log = healLog(all), dmg = []
  const t = { name: "target", handleSpecialDamage(raw, b, ty, a, cr) { dmg.push(raw); return { takenDamage: targetZero ? 0 : 999, death: false } } }
  new Absorb().process(c, { getAdjacentCells: (x, y, centre) => { dmg.push(["centre", centre]); return all.map((value) => ({ value })) } }, t, false)
  return { damageCall: dmg, heals: log, units: Object.fromEntries(all.map((u) => [u.name, { hp: u.hp, maxHP: u.maxHP, shield: u.shield, requests: u.requests }])) }
}
// DRAIN_PUNCH
const DrainPunch = stratReal(`${AB}drain-punch.ts`, "DrainPunchStrategy")
const drain = ({ atk = 50, ap = 0, casterHp = 100, shield = 0, hp = 500, flinch = false, pads = false, shiny = false, fossil = false, cover = null, protect = false, casterStatus = {}, bloodMoon = false } = {}) => {
  const c = mkFU({ team: "BLUE", hp: casterHp, maxHP: 1000, stars: 1, atk, ap, items: new Set(pads ? ["PROTECTIVE_PADS"] : []), player: bloodMoon ? { items: ["BLOOD_STONE"] } : null }); Object.assign(c.status, casterStatus); if (bloodMoon) c.simulation.weather = "BLOODMOON"
  const t = mkFU({ hp, maxHP: 1000, shield, items: new Set(shiny ? ["SHINY_CHARM"] : []) }); t.status.flinch = flinch; t.status.protect = protect; if (fossil) t.hasSynergyEffect = () => true
  const dmgCalls = [], realH = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (raw, b, ty, a, cr, apb) => { const r = realH(raw, b, ty, a, cr, apb); dmgCalls.push({ requestedRaw: raw, apBoostParam: apb, returnedTakenDamage: r.takenDamage }); return r }
  const heals = [], realC = c.state.handleHeal.bind(c.state); c.state.handleHeal = (p, h, cst, apb, cr) => { const r = realC(p, h, cst, apb, cr); heals.push({ requested: h, apBoost: apb, crit: cr, returned: r }); return r }
  const board = { getAdjacentCells: () => (cover ? [{ value: cover }] : []) }
  new DrainPunch().process(c, board, t, false)
  return { dmgCalls, heals, casterShield: c.shield, casterHp: c.hp, targetHp: t.hp, targetShield: t.shield, targetHpLost: hp - t.hp, coverHp: cover?.hp }
}
// DREAM_EATER
const DreamEater = stratReal(`${AB}dream-eater.ts`, "DreamEaterStrategy")
const mkEnemyB = (name, o = {}) => { const u = mkFU({ team: "RED", hp: o.hp ?? 500, maxHP: 1000, shield: o.shield ?? 0, name, items: new Set(o.shiny ? ["SHINY_CHARM"] : []) }); u.name = name; u.positionX = o.x ?? 5; u.positionY = o.y ?? 5; u.effects = new Set(o.immuneSleep ? ["IMMUNITY_SLEEP"] : []); u.status = Object.assign(new StatusB(), u.status, { sleep: !!o.asleep, sleepCooldown: o.asleep ? (o.sleepCooldown ?? 2000) : 0, runeProtect: !!o.rune, ccCooldown: o.cc ?? 0, skydiving: false, runeProtectCooldown: 0 }); u.sleepCalls = []; const realTs = u.status.triggerSleep.bind(u.status); u.status.triggerSleep = (d, p) => { u.sleepCalls.push(d); return realTs(d, p) }; u.onDamageReceived = function () { u.sleepReductionCalls = (u.sleepReductionCalls ?? 0) + 1; sleepFrag.call(u) }; return u }
const dream = ({ pp = 100, maxPP = 100, stars = 1, ap = 0, enemies, targetName, casterHp = 300 }) => {
  const c = mkFU({ team: "BLUE", hp: casterHp, maxHP: 1000, stars, ap, atk: 50 }); c.pp = pp; c.maxPP = maxPP
  c.state.getNearestAvailablePlaceCoordinates = () => ({ x: 4, y: 5 }); const moves = []; c.moveTo = (x, y) => moves.push([x, y])
  const es = enemies.map((e) => mkEnemyB(e.name, e)), target = es.find((e) => e.name === targetName)
  const board = { cells: es, find: (cb) => es.find((e) => cb(e.positionX, e.positionY, e)) ?? null, getAdjacentCells: () => [] }
  new DreamEater().process(c, board, target, false)
  return { casterPP: c.pp, casterHp: c.hp, moves, sleepCalls: Object.fromEntries(es.map((e) => [e.name, e.sleepCalls])), enemies: Object.fromEntries(es.map((e) => [e.name, { hp: e.hp, shield: e.shield, sleep: e.status.sleep, sleepCooldown: e.status.sleepCooldown, reductionCalls: e.sleepReductionCalls ?? 0 }])) }
}
// NATURAL_GIFT
const NaturalGift = stratReal(`${AB}natural-gift.ts`, "NaturalGiftStrategy")
const gift = (units, { stars = 1, ap = 0, casterHp = 400, casterLast = false } = {}) => {
  const c = mkB({ stars, ap, hp: casterHp, maxHP: 400, name: "caster" }), others = units.map((u) => mkB(u)), us = casterLast ? [...others, c] : [c, ...others], log = healLog(us)
  new NaturalGift().process(c, { cells: [...us, mkB({ team: "RED", name: "enemy", hp: 1, maxHP: 1000 })] }, null, false)
  return { heals: log, units: Object.fromEntries(us.map((u) => [u.name, { hp: u.hp, maxHP: u.maxHP, shield: u.shield, requests: u.requests, wound: u.status.wound, woundCooldown: u.status.woundCooldown, burn: u.status.burn, runeProtect: u.status.runeProtect, runeProtectCooldown: u.status.runeProtectCooldown }])) }
}
const BM = { weather: "BLOODMOON", stones: 1 }
out.IMPORT_RECHECK_2 = {
  mud: { speed44: mud(), speed100: mud({ speed: 100 }), replacesLonger: mud({ cooldown: 5000 }), apHeal: mud({ ap: 100, hp: 10, stars: 3 }), burnWounded: mud({ status: { wound: true }, ...BM }), grass: mud({ grass: true, hp: 100 }), protect: mud({ status: { protect: true } }), runeProtectAlone: mud({ status: { runeProtect: true } }) },
  absorb: {
    targetZero: absorb({ neighbours: [{ name: "ally", hp: 50, maxHP: 100 }] }), parasect: absorb({ stars: 2, neighbours: [] }), ap100: absorb({ ap: 100, neighbours: [] }),
    mixed: absorb({ neighbours: [{ name: "woundedStone", hp: 50, maxHP: 100, status: { wound: true }, ...BM }, { name: "protectedAlly", hp: 50, maxHP: 100, status: { protect: true } }, { name: "grassFull", hp: 100, maxHP: 100, grass: true }, { name: "burning", hp: 50, maxHP: 100, status: { burn: true } }] }),
    targetTaken999: absorb({ targetZero: false, neighbours: [] })
  },
  drain: {
    plain: drain(), shield40: drain({ shield: 40 }), shield200: drain({ shield: 200 }), flinchShield200: drain({ shield: 200, flinch: true }), pads30: drain({ shield: 30, pads: true }), overkill: drain({ hp: 40 }),
    fossil: drain({ atk: 150, hp: 500, fossil: true }), shiny: drain({ atk: 150, hp: 500, shiny: true }), protect: drain({ protect: true }), ap100: drain({ ap: 100 }),
    cover: drain({ hp: 20, cover: (() => { const v = mkFU({ hp: 500, maxHP: 1000, items: new Set(["COVER_BAND"]), id: "cover" }); return v })() }), woundedCaster: drain({ casterStatus: { wound: true } }), woundedBloodMoon: drain({ casterStatus: { wound: true }, bloodMoon: true })
  },
  dream: {
    damageBranchKeepsExcess: dream({ pp: 150, enemies: [{ name: "sleeper", asleep: true }, { name: "other" }], targetName: "other" }),
    sleepBranchAssignsMax: dream({ pp: 100, enemies: [{ name: "t" }], targetName: "t" }),
    otherQualifiesTargetRefuses: dream({ pp: 150, enemies: [{ name: "t", rune: true }, { name: "other" }], targetName: "t" }),
    nobodyCanSleep: dream({ pp: 150, enemies: [{ name: "t", rune: true }, { name: "o", immuneSleep: true }], targetName: "t" }),
    sleeperNotTarget: dream({ pp: 100, enemies: [{ name: "t" }, { name: "sleeper", asleep: true, x: 6, y: 6 }], targetName: "t" }),
    apDuration: dream({ stars: 2, ap: 50, enemies: [{ name: "t" }], targetName: "t" })
  }
}
// sleep reduction: the real handleDamage decides whether onDamageReceived runs; the real 300 ms lines run inside the stand-in onDamageReceived; the real updateSleep clears the flag later
const sleepHit = ({ shield = 0, hp = 500, protect = false, shiny = false, raw = 100, sleepCooldown = 2000, cover = false } = {}) => {
  const t = mkEnemyB("sleeper", { asleep: true, sleepCooldown, shield, hp, shiny }); t.status.protect = protect
  const att = mkFU({ team: "BLUE", atk: 50 }); let coverAlly = null
  if (cover) { coverAlly = mkEnemyB("coverAlly", { hp: 500 }); coverAlly.items = new Set(["COVER_BAND"]); coverAlly.id = "cover" }
  const r = t.handleSpecialDamage(raw, { getAdjacentCells: () => (coverAlly ? [{ value: coverAlly }] : []) }, "SPECIAL", att, false)
  return { takenDamage: r.takenDamage, hp: t.hp, reductionCalls: t.sleepReductionCalls ?? 0, sleep: t.status.sleep, sleepCooldown: t.status.sleepCooldown, coverReductionCalls: coverAlly?.sleepReductionCalls ?? 0, coverSleep: coverAlly?.status.sleep }
}
out.IMPORT_RECHECK_2.sleepReduction = { plain: sleepHit(), shieldAbsorbsAll: sleepHit({ shield: 500 }), protect: sleepHit({ protect: true }), lethal: sleepHit({ hp: 50 }), shinyCharm: sleepHit({ shiny: true, raw: 300 }), coverBandLethal: sleepHit({ hp: 20, cover: true }) }
{ const t = mkEnemyB("sleeper", { asleep: true, sleepCooldown: 200 }); t.onDamageReceived(); const afterHit = { sleep: t.status.sleep, sleepCooldown: t.status.sleepCooldown }; t.status.updateSleep(50, { passive: "NONE" }); out.IMPORT_RECHECK_2.sleepReduction.flagVersusTimer = { afterHit, afterUpdateSleep: { sleep: t.status.sleep, sleepCooldown: t.status.sleepCooldown, ccCooldown: t.status.ccCooldown } } }
out.IMPORT_RECHECK_2.gift = {
  fractionNotAbsolute: gift([{ name: "A", hp: 50, maxHP: 1000 }, { name: "B", hp: 40, maxHP: 100 }]),
  casterLowest: gift([{ name: "A", hp: 50, maxHP: 1000 }], { casterHp: 4 }),
  woundBeforeRune: gift([{ name: "W", hp: 100, maxHP: 1000, status: { wound: true, woundCooldown: 3000 }, ...BM }]),
  burnBeforeRune: gift([{ name: "B", hp: 100, maxHP: 1000, status: { burn: true, burnCooldown: 3000 } }]),
  keepsLongerRune: gift([{ name: "R", hp: 100, maxHP: 1000, status: { runeProtect: true, runeProtectCooldown: 5000 } }]),
  raisesShorterRune: gift([{ name: "R", hp: 100, maxHP: 1000, status: { runeProtect: true, runeProtectCooldown: 200 } }], { stars: 3 }),
  fullHpGrass: gift([{ name: "G", hp: 100, maxHP: 100, grass: true }], { casterLast: true }),
  protectedAlly: gift([{ name: "P", hp: 100, maxHP: 1000, status: { protect: true } }])
}
const D2 = out.IMPORT_RECHECK_2
expect("IMPORT_RECHECK_2 MUD_BUBBLE cooldown (real strategy text and real resetCooldown on a stand-in unit): resetCooldown(250, speed) stores round(250 / (0.4 + 0.007 x speed)) = 353 at speed 44 and 227 at speed 100, replacing a longer earlier value (5000 -> 353); it is a stored timer value, not a guaranteed next action or attack time", [D2.mud.speed44.cooldown, D2.mud.speed100.cooldown, D2.mud.replacesLonger.cooldown], [353, 227, 353])
expect("IMPORT_RECHECK_2 MUD_BUBBLE heal (stand-in unit, real handleHeal; apBoost 1): 1 star requests 10 (HP 50 -> 60); 3 stars at AP 100 requests 40 and handleHeal returns healReceived 80 (HP 10 -> 90); Protect -> nothing; Rune Protect alone -> healed; wounded under Blood Moon with one stone -> no HP, addShield request 3 (final shield 3); full-HP Grass caster -> healReceived 0, overheal 10, addMaxHP request 4 (final 104)", [D2.mud.speed44.hp, D2.mud.apHeal.heal[0].requested, D2.mud.apHeal.heal[0].returned.healReceived, D2.mud.apHeal.hp, D2.mud.protect.hp, D2.mud.runeProtectAlone.hp, D2.mud.burnWounded.hp, D2.mud.burnWounded.downstream[0].request, D2.mud.burnWounded.shield, D2.mud.grass.heal[0].returned, D2.mud.grass.downstream[0].request, D2.mud.grass.maxHP], [60, 40, 80, 90, 50, 60, 50, 3, 3, { healReceived: 0, overheal: 10 }, 4, 104])
expect("IMPORT_RECHECK_2 ABSORB (real strategy text; stand-in board and stand-in damage target): the heal request is 0.1 x the RAW table (30 -> 3 for PARAS, 60 -> 6 for PARASECT) with apBoost 1, even when the damage call returns takenDamage 0 and equally when it returns 999 (it never reads the damage result); the 3x3 call includes the centre, so the caster is a recipient; the enemy neighbour is not healed", [D2.absorb.targetZero.damageCall, D2.absorb.targetZero.heals.map((h) => [h.target, h.requested, h.apBoost]), D2.absorb.parasect.heals[0].requested, D2.absorb.targetTaken999.heals[0].requested, D2.absorb.targetZero.units.enemyNeighbour.hp], [[30, ["centre", true]], [["caster", 3, 1], ["ally", 3, 1]], 6, 3, 10])
expect("IMPORT_RECHECK_2 ABSORB request versus returns versus final: a full-HP caster gets healReceived 0 / overheal 3; at AP 100 the REQUEST stays 3 and handleHeal's own x(1 + AP/100) makes overheal 6; an ally at 50/100 gains 3 (HP 53); in a mixed neighbourhood a wounded ally under Blood Moon with a stone gets no HP and addShield(1) (final shield 1), an unwounded Protected ally gets nothing, a full-HP Grass ally gets overheal 3 and addMaxHP (final maxHP 101), a burning ally's request 3 is halved to 2 received", [D2.absorb.targetZero.heals[0].returned, D2.absorb.ap100.heals[0].requested, D2.absorb.ap100.heals[0].returned.overheal, D2.absorb.targetZero.units.ally.hp, D2.absorb.mixed.units.woundedStone.hp, D2.absorb.mixed.units.woundedStone.requests[0].request, D2.absorb.mixed.units.woundedStone.shield, D2.absorb.mixed.units.protectedAlly.hp, D2.absorb.mixed.heals.find((h) => h.target === "grassFull").returned, D2.absorb.mixed.units.grassFull.maxHP, D2.absorb.mixed.heals.find((h) => h.target === "burning").returned.healReceived], [{ healReceived: 0, overheal: 3 }, 3, 6, 53, 50, 1, 1, 50, { healReceived: 0, overheal: 3 }, 101, 2])
expect("IMPORT_RECHECK_2 DRAIN_PUNCH (real strategy, real handleSpecialDamage / handleDamage / handleHeal; ATK 50 -> raw request 100, heal request = 2 x the RETURNED takenDamage with apBoost 0 and crit false): plain 100 -> heal request 200 (HP lost 100); shield 40 -> returned 100 but only 60 HP lost; shield 200 -> returned 100, 0 HP lost; flinch + shield 200 -> returned 100, 50 HP lost; Protective Pads + shield 30 -> returned 200, 170 HP lost -> request 400; overkill on 40 HP -> returned 40 -> request 80", [D2.drain.plain.heals[0].requested, D2.drain.plain.heals[0].apBoost, D2.drain.plain.heals[0].crit, D2.drain.shield40.dmgCalls[0].returnedTakenDamage, D2.drain.shield40.targetHpLost, D2.drain.shield200.dmgCalls[0].returnedTakenDamage, D2.drain.shield200.targetHpLost, D2.drain.flinchShield200.dmgCalls[0].returnedTakenDamage, D2.drain.flinchShield200.targetHpLost, D2.drain.pads30.heals[0].requested, D2.drain.pads30.targetHpLost, D2.drain.overkill.heals[0].requested], [200, 0, false, 100, 60, 100, 0, 100, 50, 400, 170, 80])
expect("IMPORT_RECHECK_2 DRAIN_PUNCH exceptions (ATK 150 -> raw 300 where stated): the Fossil branch returns 500 with the target's HP unchanged (request 1000, caster 100 -> 1000 with overheal 100); Shiny Charm and Protect return 0 (request 0); a Cover Band ally's result (100) is what the strategy receives although the original target's HP is unchanged; AP is applied once inside the damage call: at AP 100 the returned takenDamage is 200 and the heal request is 400 (2 x returned), not 800", [D2.drain.fossil.dmgCalls[0].returnedTakenDamage, D2.drain.fossil.targetHpLost, D2.drain.fossil.heals[0].requested, D2.drain.fossil.heals[0].returned, D2.drain.shiny.heals[0].requested, D2.drain.protect.heals[0].requested, D2.drain.cover.dmgCalls[0].returnedTakenDamage, D2.drain.cover.targetHp, D2.drain.ap100.dmgCalls[0].returnedTakenDamage, D2.drain.ap100.heals[0].requested, D2.drain.ap100.heals[0].apBoost], [500, 0, 1000, { healReceived: 900, overheal: 100 }, 0, 0, 100, 20, 200, 400, 0])
expect("IMPORT_RECHECK_2 DRAIN_PUNCH healing branches: a wounded caster takes no HP from the request 200 (HP 100 stays); under Blood Moon with a Blood Stone the same call requests addShield(round(0.3 x 200) = 60) (final shield 60)", [D2.drain.woundedCaster.casterHp, D2.drain.woundedCaster.casterShield, D2.drain.woundedBloodMoon.casterHp, D2.drain.woundedBloodMoon.casterShield], [100, 0, 100, 60])
expect("IMPORT_RECHECK_2 DREAM_EATER PP (real strategy; stand-in board, stand-in swap helper): the damage branch keeps the excess of the base cost - 150 PP with maxPP 100 ends at 50 and heals 1 x the returned takenDamage (45, HP 300 -> 345) on the sleeper, not on the cast target; the sleep branch assigns maxPP directly (PP 100 -> 100; 150 -> 100, the excess is not kept); with nobody able to sleep only the base cost applies (150 -> 50)", [D2.dream.damageBranchKeepsExcess.casterPP, D2.dream.damageBranchKeepsExcess.casterHp, D2.dream.damageBranchKeepsExcess.enemies.sleeper.hp, D2.dream.damageBranchKeepsExcess.enemies.other.hp, D2.dream.sleepBranchAssignsMax.casterPP, D2.dream.otherQualifiesTargetRefuses.casterPP, D2.dream.nobodyCanSleep.casterPP], [50, 345, 455, 500, 100, 100, 50])
expect("IMPORT_RECHECK_2 DREAM_EATER targeting: another enemy may satisfy targetThatCanSleep but triggerSleep is called on the ORIGINAL cast target (real triggerSleep text): target with Rune Protect + a qualifying other enemy -> sleep requested only on the target (3000 ms), the real guard refuses it (not asleep), the other enemy is untouched, and PP is still assigned maxPP (100); nobody qualifying -> no sleep call; 2 stars at AP 50 request round(4000 x 1.5) = 6000 ms; the damage branch hits the first sleeping enemy anywhere (dealing 45 to it) and moves the caster next to it, leaving the cast target alone", [D2.dream.otherQualifiesTargetRefuses.sleepCalls, D2.dream.otherQualifiesTargetRefuses.enemies.t.sleep, D2.dream.otherQualifiesTargetRefuses.enemies.other.sleep, D2.dream.nobodyCanSleep.sleepCalls, D2.dream.apDuration.sleepCalls.t, D2.dream.apDuration.enemies.t.sleepCooldown, D2.dream.sleeperNotTarget.moves, D2.dream.sleeperNotTarget.enemies.sleeper.hp, D2.dream.sleeperNotTarget.enemies.t.hp, D2.dream.sleeperNotTarget.casterPP], [{ t: [3000], other: [] }, false, false, { t: [], o: [] }, [6000], 6000, [[4, 5]], 455, 500, 0])
expect("IMPORT_RECHECK_2 DREAM_EATER sleep reduction (real handleDamage decides the call, the real 300 ms lines of onDamageReceived run in the stand-in callback): a surviving recipient with positive takenDamage - also when a shield absorbed everything - loses 300 ms (2000 -> 1700); Protect, a lethal hit and a triggered Shiny Charm do not call it; with a Cover Band redirect the ORIGINAL target is not called and the cover ally is; the flag is not cleared by the subtraction: sleepCooldown 200 -> -100 with sleep still true until the real updateSleep clears it (ccCooldown 1500)", [D2.sleepReduction.plain.reductionCalls, D2.sleepReduction.plain.sleepCooldown, D2.sleepReduction.shieldAbsorbsAll.reductionCalls, D2.sleepReduction.protect.reductionCalls, D2.sleepReduction.lethal.reductionCalls, D2.sleepReduction.shinyCharm.reductionCalls, D2.sleepReduction.coverBandLethal.reductionCalls, D2.sleepReduction.coverBandLethal.coverReductionCalls, D2.sleepReduction.flagVersusTimer.afterHit, D2.sleepReduction.flagVersusTimer.afterUpdateSleep], [1, 1700, 1, 0, 0, 0, 0, 1, { sleep: true, sleepCooldown: -100 }, { sleep: false, sleepCooldown: -100, ccCooldown: 1500 }])
expect("IMPORT_RECHECK_2 NATURAL_GIFT selection and order (real strategy; real handleHeal, clearNegativeStatus and triggerRuneProtect on stand-in units): the target is the LOWEST HP FRACTION, not the lowest absolute hp (50/1000 beats 40/100) and the caster itself is eligible (a 4/400 caster heals itself); the heal precedes Rune Protect: a wounded ally under Blood Moon with a stone gets no HP and addShield(9), and afterwards wound is STILL true (woundCooldown 0, Rune Protect 1000); a burning ally's 30 is halved to 15 and its burn flag stays true; Protect blocks the heal but Rune Protect is still applied", [D2.gift.fractionNotAbsolute.heals[0].target, D2.gift.casterLowest.heals[0].target, D2.gift.woundBeforeRune.units.W.hp, D2.gift.woundBeforeRune.units.W.requests[0].request, D2.gift.woundBeforeRune.units.W.wound, D2.gift.woundBeforeRune.units.W.woundCooldown, D2.gift.woundBeforeRune.units.W.runeProtectCooldown, D2.gift.burnBeforeRune.heals[0].returned.healReceived, D2.gift.burnBeforeRune.units.B.burn, D2.gift.protectedAlly.units.P.hp, D2.gift.protectedAlly.units.P.runeProtect], ["A", "caster", 100, 9, true, 0, 1000, 15, true, 100, true])
expect("IMPORT_RECHECK_2 NATURAL_GIFT Rune Protect timer and Grass: an existing longer Rune Protect timer (5000) is kept when the new one is 1000; a shorter existing one (200) is raised to 3000 (3 stars); a full-HP Grass ally chosen first on a tie gets healReceived 0, overheal 30 and addMaxHP request 12 (final maxHP and HP 112)", [D2.gift.keepsLongerRune.units.R.runeProtectCooldown, D2.gift.raisesShorterRune.units.R.runeProtectCooldown, D2.gift.fullHpGrass.heals[0].returned, D2.gift.fullHpGrass.units.G.requests[0].request, D2.gift.fullHpGrass.units.G.maxHP, D2.gift.fullHpGrass.units.G.hp], [5000, 3000, { healReceived: 0, overheal: 30 }, 12, 112, 112])
// 28. IMPORT_RECHECK_3 (third import run): the real PROTECT / PSYBEAM / PSYSHOCK / PSYSTRIKE / PSYSHIELD_BASH strategy text, the real triggerProtect / updateProtect /
// triggerConfusion, addPP / addShield / handleSpecialDamage / handleDamage, effectInLine / getCellsBetween / getTeleportationCell / getFarthestTargetCoordinateAvailablePlace /
// swapCells, getFarthestTarget, isTargettableBy, canBeMoved, moveTo and chance text, run against STAND-IN units and boards (controlled callbacks: the random roll, plain damage
// recorders, the animation / state-change hooks). Teams use the game's enum names (BLUE_TEAM / RED_TEAM). Requests = arguments a helper receives; returns = what it hands back; final =
// stored fields afterwards. Nothing here is a fight.
const BLUE_Z = "BLUE_TEAM", RED_Z = "RED_TEAM"
const StatusZ = build({ Weather: enums(), EffectEnum: enums(), Item: enums(), Passive: enums() },
  js(`class SZ {\n${cut(ST, 744, 750, "triggerProtect(")}\n${cut(ST, 752, 758, "updateProtect(")}\n${cut(ST, 806, 835, "triggerConfusion(")}\n applyStatusDurationReductions(d) { return d }\n}`), "SZ")
const TeamZ = enums()
const BoardZ = (() => {
  const Base = BoardFull
  class BZ extends Base {}
  BZ.prototype.swapCells = build({}, js(`class T {\n${cut(BD, 68, 73, "swapCells(")}\n}`), "T").prototype.swapCells
  BZ.prototype.setEntityOnCell = function (x, y, e) { this.cells[this.columns * y + x] = e; if (e) { e.positionX = x; e.positionY = y } }
  BZ.prototype.getTeleportationCell = build({ Team: { BLUE_TEAM: BLUE_Z, RED_TEAM: RED_Z }, distanceC }, js(`class T {\n${cut(BD, 348, 381, "getTeleportationCell(")}\n}`), "T").prototype.getTeleportationCell
  return BZ
})()
const effectInLineZ = build({}, js(cut(BD, 920, 940, "export function effectInLine").replace("export function", "function")), "effectInLine")
const UnitZ = (() => {
  const src = js(`class UZ {\n${cut(PE, 258, 264, "get canBeMoved")}\n${cut(PE, 274, 287, "isTargettableBy(")}\n${cut(PE, 890, 899, "moveTo(")}\n toMovingState() { this.movingStateCalls = (this.movingStateCalls ?? 0) + 1 }\n}`)
  return build({ EffectEnum: enums(), Item: enums() }, src, "UZ")
})()
const getFarthestTargetZ = build({ distanceM }, js(`class G {\n${cut(PS, 1199, 1217, "getFarthestTarget(")}\n}`), "G").prototype.getFarthestTarget
let zid = 0
const unitZ = (name, team, x, y, o = {}) => {
  const u = Object.assign(new UnitZ(), { name, team, id: `z${++zid}`, positionX: x, positionY: y, hp: o.hp ?? 100, maxHP: 100, pp: o.pp ?? 0, maxPP: 100, stars: o.stars ?? 1, ap: o.ap ?? 0, luck: o.luck ?? 0, critPower: 2, items: new Set(o.items ?? []), effects: new Set(o.effects ?? []), count: { ult: 0 }, skill: "X",
    status: Object.assign(new StatusZ(), { protect: false, protectCooldown: 0, runeProtect: false, enraged: false, confusion: false, confusionCooldown: 0, skydiving: false, locked: false, untargettable: false }, o.status ?? {}),
    simulation: { weather: o.weather ?? "NONE", blueAbilitiesCast: [], redAbilitiesCast: [] }, passive: o.passive ?? "NONE", log: [], broadcastAbility() {}, handleSpecialDamage(raw, b, ty, att, crit, apb) { this.log.push({ call: "damage", raw, crit, apBoost: apb }); if (o.lethal) this.hp = 0; return { takenDamage: 0, death: false } } })
  u.state = { getFarthestTarget: getFarthestTargetZ }
  return u
}
const placeZ = (board, ...us) => { for (const u of us) board.setEntityOnCell(u.positionX, u.positionY, u) }
const casterEnv = { max, min }
// ---- PROTECT
const ProtectZ = stratReal(`${AB}protect.ts`, "ProtectStrategy", { min })
const protectZ = ({ stars = 1, ap = 0, crit = false, critPower = 2, status = {} } = {}) => {
  const c = unitZ("caster", BLUE_Z, 0, 0, { stars, ap, status }); c.critPower = critPower
  const s = new ProtectZ(); s.process(c, {}, null, crit)
  return { requiresTarget: s.requiresTarget, protect: c.status.protect, protectCooldown: c.status.protectCooldown }
}
const protectUnits = { kabutoAp0: protectZ({ stars: 1 }), deoxysDefenseAp0: protectZ({ stars: 3 }), oneStarAp100Crit: protectZ({ stars: 1, ap: 100, crit: true, critPower: 2 }), alreadyProtected: protectZ({ stars: 1, status: { protect: true, protectCooldown: 300 } }), enraged: protectZ({ stars: 1, status: { enraged: true } }), runeProtectDoesNotMatter: protectZ({ stars: 1, status: { runeProtect: true } }) }
// ---- PSYBEAM
const chanceRolls = []
const chanceZ = (() => { const f = build({ max, Math: Object.assign(Object.create(Math), { random: () => (chanceRolls.length ? chanceRolls.shift() : 0) }) }, js(cut("app/utils/random.ts", 3, 13, "export function chance").replace("export function", "function")), "chance"); return f })()
const PsybeamZ = (() => { const rolls = []; const S = stratReal(`${AB}psybeam.ts`, "PsybeamStrategy", { effectInLine: effectInLineZ, chance: (p, pk) => { rolls.push([p, pk.luck]); return chanceZ(p, pk) } }); S.rolls = rolls; return S })()
const psybeamZ = ({ stars = 1, ap = 0, luck = 0, rolls = [], weather = "NONE", enemies }) => {
  const board = new BoardZ(6, 8), c = unitZ("caster", BLUE_Z, 0, 2, { stars, ap, luck, weather })
  const es = enemies.map((e) => unitZ(e.name, e.team ?? RED_Z, e.x, e.y, { status: e.status, weather, effects: e.effects, items: e.items }))
  es.forEach((e) => { e.confusionCalls = []; const t = e.status.triggerConfusion.bind(e.status); e.status.triggerConfusion = (d, p, o) => { e.confusionCalls.push(d); return t(d, p, o) } })
  placeZ(board, c, ...es); chanceRolls.length = 0; chanceRolls.push(...rolls); PsybeamZ.rolls.length = 0
  new PsybeamZ().process(c, board, es[0], false)
  return { rolls: PsybeamZ.rolls.slice(), enemies: Object.fromEntries(es.map((e) => [e.name, { damageCalls: e.log.length, confusionCalls: e.confusionCalls, confusion: e.status.confusion, confusionCooldown: e.status.confusionCooldown }])) }
}
const EZ = (name, x, y, o = {}) => ({ name, x, y, ...o })
const psybeamCases = {
  lineHitsAndRolls: psybeamZ({ rolls: [0.1, 0.1], enemies: [EZ("front", 3, 2), EZ("behind", 6, 2), EZ("ally", 4, 2, { team: BLUE_Z })] }),
  protectedStillConfused: psybeamZ({ rolls: [0.1], enemies: [EZ("p", 3, 2, { status: { protect: true } })] }),
  runeProtectRefuses: psybeamZ({ rolls: [0.1], enemies: [EZ("r", 3, 2, { status: { runeProtect: true } })] }),
  alreadyConfused: psybeamZ({ rolls: [0.1], enemies: [EZ("c", 3, 2, { status: { confusion: true, confusionCooldown: 500 } })] }),
  immune: psybeamZ({ rolls: [0.1], enemies: [EZ("i", 3, 2, { effects: ["IMMUNITY_CONFUSION"] })] }),
  rollFails: psybeamZ({ rolls: [0.9], enemies: [EZ("n", 3, 2)] }),
  apNotApplied: psybeamZ({ stars: 2, ap: 100, rolls: [0.1], enemies: [EZ("a", 3, 2)] }),
  sandstorm: psybeamZ({ rolls: [0.1], weather: "SANDSTORM", enemies: [EZ("s", 3, 2)] }),
  luck50: psybeamZ({ luck: 50, rolls: [0.7], enemies: [EZ("l", 3, 2)] }),
  luck0SameRoll: psybeamZ({ luck: 0, rolls: [0.7], enemies: [EZ("l", 3, 2)] })
}
// all 2256 ordered position pairs on the ordinary 8 columns x 6 rows board: does the projected line reach the target cell?
const lineReach = (() => { let pairs = 0, reached = 0; const b = new BoardZ(6, 8); for (let x0 = 0; x0 < 8; x0++) for (let y0 = 0; y0 < 6; y0++) for (let x1 = 0; x1 < 8; x1++) for (let y1 = 0; y1 < 6; y1++) { if (x0 === x1 && y0 === y1) continue; pairs++; let hit = false; effectInLineZ(b, { positionX: x0, positionY: y0 }, { positionX: x1, positionY: y1 }, (cell) => { if (cell.x === x1 && cell.y === y1) hit = true }); if (hit) reached++ } return { pairs, reached } })()
// Persim Berry and PSYDUCK reactions are REQUESTS to stand-in helpers
const persimZ = (() => { const calls = []; const f = build({ Item: enums(), EffectEnum: enums() }, js(`function eat(heal) { const r = {}; switch (Item.PERSIM_BERRY) {\n${cut(PE, 1648, 1653, "case Item.PERSIM_BERRY:")}\n} return r }`), "eat"); const self = { status: { confusion: true, confusionCooldown: 900 }, effects: new Set(), addSpecialDefense: (...a) => calls.push(["addSpecialDefense", ...a.slice(0, 1), a[2], a[3]]) }; f.call(self, (n) => calls.push(["heal", n])); return { calls, status: self.status, immune: [...self.effects] } })()
const psyduckAp = (() => { const calls = []; const target = unitZ("duck", RED_Z, 3, 2, { passive: "PSYDUCK" }); target.addAbilityPower = (...a) => calls.push(a.slice(0, 1).concat(a[2], a[3])); target.status.triggerConfusion(2000, target, unitZ("c", BLUE_Z, 0, 0)); return { calls, confusion: target.status.confusion } })()
// ---- PSYSHOCK
const FUPz = build({ Item: enums(), EffectEnum: enums(), AttackType: enums(), DelayedCommand, chance: () => false, ARMOR_FACTOR: 0.05, min, max, clamp, count, roundToNDigits },
  `${helpers}\nclass FUP {\n${js(`class _ {\n${[cut(PE, 335, 344, "handleDamage("), cut(PE, 346, 467, "handleSpecialDamage("), cut(PE, 498, 506, "addShield("), cut(PE, 508, 532, "addPP(")].join("\n")}\n}`).replace(/^class _ \{\n/, "").replace(/\n\}\s*$/, "")}\n}`, "FUP")
const PsyShockZ = stratReal(`${AB}psy-shock.ts`, "PsyShockStrategy", { max })
const psyshockZ = ({ stars = 1, ap = 5, crit = false, targetPP = 10, targetStatus = {}, targetItems = [], targetEnemyBounce = false, casterStatus = {}, casterItems = [], padsOnCaster = false }) => {
  const c = mkS({ stars, ap, name: "caster", status: casterStatus, items: [...casterItems, ...(padsOnCaster ? ["PROTECTIVE_PADS"] : [])], hp: 100, maxHP: 100 }); c.team = BLUE_Z; c.critPower = 2; c.onDamageDealt = () => {}
  const t = mkFU({ hp: 500, maxHP: 1000, items: new Set(targetItems) }); Object.setPrototypeOf(t, FUPz.prototype); delete t.addPP; delete t.addShield; t.pp = targetPP; t.maxPP = 100; t.team = RED_Z; Object.assign(t.status, { tree: false, resurrecting: false, silence: false, fatigue: false }, targetStatus); t.effects = new Set(); t.stars = 1
  const calls = []
  const rAdd = t.addPP.bind(t); t.addPP = (...a) => { calls.push({ call: "addPP", value: a[0], apBoost: a[2], crit: a[3] }); return rAdd(...a) }
  const rShield = c.addShield.bind(c); c.addShield = (...a) => { calls.push({ call: "addShield", value: a[0], apBoost: a[2], crit: a[3] }); return rShield(...a) }
  const rDmg = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { const r = rDmg(...a); calls.push({ call: "damage", raw: a[0], crit: a[4], apBoostParam: a[5], returned: r.takenDamage }); return r }
  new PsyShockZ().process(c, { getAdjacentCells: () => [] }, t, crit)
  return { calls, targetPP: t.pp, targetHp: t.hp, casterShield: c.shield, bounceCommands: t.commands.length, blocked: t.count.spellBlockedCount }
}
// ---- PSYSTRIKE
const PsystrikeZ = stratReal(`${AB}psystrike.ts`, "PsystrikeStrategy")
const psystrikeZ = ({ rows = 6, cols = 8, caster = [3, 0], units, casterEffects = [] }) => {
  const board = new BoardZ(rows, cols), c = unitZ("caster", BLUE_Z, caster[0], caster[1], { stars: 3, effects: casterEffects })
  const us = units.map((u) => unitZ(u.name, u.team ?? RED_Z, u.x, u.y, { hp: u.hp, status: u.status, items: u.items, lethal: u.lethal }))
  placeZ(board, c, ...us)
  new PsystrikeZ().process(c, board, us.find((u) => u.team !== BLUE_Z) ?? us[0], false)
  return Object.fromEntries(us.map((u) => [u.name, { damageCalls: u.log.map((l) => l.raw), position: [u.positionX, u.positionY], movingStateCalls: u.movingStateCalls ?? 0, hp: u.hp }]))
}
const psystrikeCases = {
  twoEnemiesOnLine: psystrikeZ({ units: [{ name: "e1", x: 3, y: 3 }, { name: "e2", x: 3, y: 5 }] }),
  lockedSkydivingBoots: psystrikeZ({ units: [{ name: "locked", x: 3, y: 2, status: { locked: true } }, { name: "sky", x: 3, y: 3, status: { skydiving: true } }, { name: "boots", x: 3, y: 4, items: ["HEAVY_DUTY_BOOTS"] }, { name: "far", x: 3, y: 5 }] }),
  protectDoesNotBlockMove: psystrikeZ({ units: [{ name: "prot", x: 3, y: 5, status: { protect: true } }] }),
  lethalStillMoved: psystrikeZ({ units: [{ name: "dead", x: 3, y: 5, lethal: true }] }),
  mercilessAllyFallback: psystrikeZ({ casterEffects: ["MERCILESS"], units: [{ name: "lowAlly", team: BLUE_Z, x: 3, y: 5, hp: 5 }] }),
  noMercilessAllyNotTargetable: psystrikeZ({ units: [{ name: "lowAlly", team: BLUE_Z, x: 3, y: 5, hp: 5 }, { name: "enemy", x: 5, y: 1 }] }),
  noFreeCell: psystrikeZ({ rows: 1, cols: 2, caster: [0, 0], units: [{ name: "boxed", x: 1, y: 0 }] })
}
// ---- PSYSHIELD_BASH
const PsyshieldZ = stratReal(`${AB}psyshield-bash.ts`, "PsyshieldBashStrategy")
const psyshieldZ = ({ caster = [0, 0], units, casterStatus = {}, casterItems = [], target = null, noEnemies = false }) => {
  const board = new BoardZ(6, 8), c = unitZ("caster", BLUE_Z, caster[0], caster[1], { stars: 3, status: casterStatus, items: casterItems })
  const order = []
  const us = units.map((u) => unitZ(u.name, u.team ?? RED_Z, u.x, u.y))
  placeZ(board, c, ...us)
  const mv = c.moveTo.bind(c); c.moveTo = (x, y, b, f) => { order.push(["move", x, y, f]); return mv(x, y, b, f) }
  const tp = c.status.triggerProtect.bind(c.status); c.status.triggerProtect = (t) => { order.push(["protect", t]); return tp(t) }
  us.forEach((u) => { const h = u.handleSpecialDamage; u.handleSpecialDamage = function (...a) { order.push(["damage", u.name, a[0]]); return h.apply(this, a) } })
  const tgt = target ? us.find((u) => u.name === target) : us.find((u) => u.team !== BLUE_Z) ?? us[0]
  new PsyshieldZ().process(c, board, tgt, false)
  return { order, casterPos: [c.positionX, c.positionY], protect: c.status.protect, protectCooldown: c.status.protectCooldown }
}
const wall = (xs, y) => xs.map((x, i) => ({ name: `wall${x}${y}${i}`, team: BLUE_Z, x, y }))
const psyshieldCases = {
  basic: psyshieldZ({ caster: [0, 0], units: [{ name: "decoy", x: 0, y: 5 }, { name: "e1", x: 2, y: 2 }, { name: "e2", x: 5, y: 5 }], target: "decoy" }),
  retainedEarlierCell: psyshieldZ({ caster: [0, 0], units: [{ name: "near", x: 3, y: 0 }, { name: "far", x: 7, y: 5 }, { name: "w1", team: BLUE_Z, x: 6, y: 5 }, { name: "w2", team: BLUE_Z, x: 7, y: 4 }, { name: "w3", team: BLUE_Z, x: 6, y: 4 }], target: "far" }),
  nonadjacentFallback: psyshieldZ({ caster: [0, 0], units: [{ name: "far", x: 7, y: 5 }, { name: "w1", team: BLUE_Z, x: 6, y: 5 }, { name: "w2", team: BLUE_Z, x: 7, y: 4 }, { name: "w3", team: BLUE_Z, x: 6, y: 4 }] }),
  noDestinationNoEnemy: psyshieldZ({ caster: [3, 0], units: [{ name: "allyTarget", team: BLUE_Z, x: 3, y: 3 }], target: "allyTarget" }),
  unforcedMoveIgnoresCanBeMoved: psyshieldZ({ caster: [0, 0], units: [{ name: "e", x: 5, y: 5 }], casterStatus: { locked: true }, casterItems: ["HEAVY_DUTY_BOOTS"] }),
  existingProtect: psyshieldZ({ caster: [0, 0], units: [{ name: "e", x: 5, y: 5 }], casterStatus: { protect: true, protectCooldown: 300 } }),
  enraged: psyshieldZ({ caster: [0, 0], units: [{ name: "e", x: 5, y: 5 }], casterStatus: { enraged: true } })
}
out.IMPORT_RECHECK_3 = { protect: protectUnits, psybeam: psybeamCases, lineReach, persim: persimZ, psyduckAp, psyshock: {
  plain: psyshockZ({ targetPP: 10 }), enoughPP: psyshockZ({ targetPP: 50 }), tree: psyshockZ({ targetPP: 10, targetStatus: { tree: true } }), resurrecting: psyshockZ({ targetPP: 10, targetStatus: { resurrecting: true } }),
  twist: psyshockZ({ targetPP: 10, targetItems: ["TWIST_BAND"] }), twistProtect: psyshockZ({ targetPP: 10, targetItems: ["TWIST_BAND"], targetStatus: { protect: true } }), twistFatigue: psyshockZ({ targetPP: 10, targetItems: ["TWIST_BAND"], targetStatus: { fatigue: true } }),
  protectTarget: psyshockZ({ targetPP: 10, targetStatus: { protect: true } }), fatigueTarget: psyshockZ({ targetPP: 10, targetStatus: { fatigue: true } }),
  enraged: psyshockZ({ casterStatus: { enraged: true } }), belt: psyshockZ({ casterItems: ["BIG_EATER_BELT"] }), enragedBelt: psyshockZ({ casterStatus: { enraged: true }, casterItems: ["BIG_EATER_BELT"] }),
  crit: psyshockZ({ targetPP: 10, crit: true }), bounce: psyshockZ({ targetPP: 10, targetStatus: { magicBounce: true } }), bounceWithPads: psyshockZ({ targetPP: 10, targetStatus: { magicBounce: true }, padsOnCaster: true }) },
  psystrike: psystrikeCases, psyshield: psyshieldCases }
const Z3 = out.IMPORT_RECHECK_3
expect("IMPORT_RECHECK_3 PROTECT (real strategy text, real triggerProtect; stand-in caster; BLUE_TEAM): duration = round(flat x (2 + AP/100) x crit factor): Kabuto 1 star AP 0 -> 1000 ms, Deoxys Defense 3 stars AP 0 -> 5000 ms, 1 star AP 100 critPower 2 crit true -> round(500 x 3 x 1.5) = 2250 ms; the strategy inherits requiresTarget = true; an existing Protect is not refreshed (300 stays 300); an enraged caster gets none; Rune Protect on the caster does not matter (it is a different flag)", [Z3.protect.kabutoAp0.protectCooldown, Z3.protect.deoxysDefenseAp0.protectCooldown, Z3.protect.oneStarAp100Crit.protectCooldown, Z3.protect.kabutoAp0.requiresTarget, Z3.protect.alreadyProtected.protectCooldown, Z3.protect.enraged.protect, Z3.protect.runeProtectDoesNotMatter.protectCooldown], [1000, 5000, 2250, true, 300, false, 1000])
expect("IMPORT_RECHECK_3 PSYBEAM (real strategy, real effectInLine / getCellsBetween / triggerConfusion / chance on a stand-in 8x6 board; the random roll is a controlled callback): every enemy on the line (in front of and behind the first target) gets one damage call and one independent roll (chance 0.5, luck 0), allies are skipped; the roll and triggerConfusion happen when the damage call returned 0 (a stand-in recorder) and when the target has Protect (Protect does not block confusion: confusion true, 2000 ms); Rune Protect, an existing confusion and IMMUNITY_CONFUSION refuse it although triggerConfusion was called; a failed roll calls nothing", [Z3.psybeam.lineHitsAndRolls.rolls, Z3.psybeam.lineHitsAndRolls.enemies.front.confusionCalls, Z3.psybeam.lineHitsAndRolls.enemies.behind.confusionCalls, Z3.psybeam.lineHitsAndRolls.enemies.ally.damageCalls, Z3.psybeam.protectedStillConfused.enemies.p.confusion, Z3.psybeam.runeProtectRefuses.enemies.r, Z3.psybeam.alreadyConfused.enemies.c.confusionCooldown, Z3.psybeam.immune.enemies.i.confusion, Z3.psybeam.rollFails.enemies.n.confusionCalls], [[[0.5, 0], [0.5, 0]], [2000], [2000], 0, true, { damageCalls: 1, confusionCalls: [2000], confusion: false, confusionCooldown: 0 }, 500, false, []])
expect("IMPORT_RECHECK_3 PSYBEAM duration and luck: the requested confusion duration is 2000 / 3000 ms by stars (2 stars at AP 100 still requests 3000, no AP scaling); SANDSTORM makes the stored cooldown 2600 (x1.3) in the stand-in; luck 50 turns the roll probability into 0.5^(1 - 0.5) = 0.707 (a controlled roll of 0.7 succeeds) while luck 0 with the same roll fails", [Z3.psybeam.apNotApplied.enemies.a.confusionCalls, Z3.psybeam.sandstorm.enemies.s.confusionCooldown, Z3.psybeam.luck50.enemies.l.confusion, Z3.psybeam.luck0SameRoll.enemies.l.confusion], [[3000], 2600, true, false])
expect("IMPORT_RECHECK_3 PSYBEAM geometry: with the real effectInLine and getCellsBetween on an 8-column x 6-row stand-in board, the projected line reaches the target's own cell for all 2256 distinct ordered position pairs (this is an enumeration of the ordinary board, not a proof for arbitrary boards); Persim Berry (stand-in eatBerry with the real case text) requests heal(50) and addSpecialDefense(10, self, 0, false), clears confusion and adds IMMUNITY_CONFUSION; a PSYDUCK-passive target requests addAbilityPower(100, self, 0, false) when confused - requests to stand-in helpers, not final results", [Z3.lineReach, Z3.persim.calls, Z3.persim.status, Z3.persim.immune, Z3.psyduckAp.calls], [{ pairs: 2256, reached: 2256 }, [["heal", 50], ["addSpecialDefense", 10, 0, false]], { confusion: false, confusionCooldown: 0 }, ["IMMUNITY_CONFUSION"], [[100, 0, false]]])
expect("IMPORT_RECHECK_3 PSYSHOCK order and amounts (1 star, AP 5 -> ppBurn 21, target PP 10; real addPP / addShield / handleSpecialDamage text, stand-in units): ppStolen 10 and extraPP 11 are fixed BEFORE the PP loss: addPP(-10, apBoost 0, crit false), addShield(21, apBoost 0, crit false), then the excess damage request 11 with apBoost false (no second AP factor); target PP 50 -> loss 21, no excess damage, shield still 21; the final shield is 21 (no Belt, not enraged)", [Z3.psyshock.plain.calls.map((c) => [c.call, c.value ?? c.raw]).filter((x) => x[0] !== "addPP" || x[1] < 0 || true), Z3.psyshock.plain.calls[3].apBoostParam, Z3.psyshock.plain.casterShield, Z3.psyshock.enoughPP.calls.map((c) => [c.call, c.value]), Z3.psyshock.enoughPP.targetPP], [[["addPP", -10], ["addShield", 21], ["addPP", 2], ["damage", 11]], false, 21, [["addPP", -21], ["addShield", 21]], 29])
expect("IMPORT_RECHECK_3 PSYSHOCK guards and Twist (the +2/+3 addPP calls are the target's own damage-based PP gain from the excess hit): a tree or resurrecting target drops the loss (PP 10 stays; tree 12 with the +2) yet extraPP is NOT recomputed (damage request still 11, shield request still 21); Twist Band flips the rounded -10 into +10 (PP 22 = 10 + 10 + 2) with the request still 11; Twist + Protect drops the flipped gain (PP 10); Twist + fatigue keeps the flipped gain unhalved (10 + 10 + 1 = 21 where the +1 is the fatigued damage gain); plain Protect permits the negative loss (PP 0) and fatigue does not halve the negative request (PP 1 = 0 + 1)", [Z3.psyshock.tree.targetPP, Z3.psyshock.tree.calls[3].raw, Z3.psyshock.resurrecting.targetPP, Z3.psyshock.resurrecting.calls[2].raw, Z3.psyshock.twist.targetPP, Z3.psyshock.twistProtect.targetPP, Z3.psyshock.twistFatigue.targetPP, Z3.psyshock.protectTarget.targetPP, Z3.psyshock.fatigueTarget.targetPP], [12, 11, 10, 11, 22, 10, 21, 0, 1])
expect("IMPORT_RECHECK_3 PSYSHOCK shield rounding order (ppBurn 21): Belt multiplication and floor first (21 x 1.25 = 26.25 -> 26), then enrage halving, then Math.round: plain 21; enraged caster 11 (10.5 rounds up); Belt 26; Belt + enraged 13; crit applies only to the excess damage (crit true on the damage call, false on addPP and addShield)", [Z3.psyshock.plain.casterShield, Z3.psyshock.enraged.casterShield, Z3.psyshock.belt.casterShield, Z3.psyshock.enragedBelt.casterShield, Z3.psyshock.crit.calls.map((c) => c.crit)], [21, 11, 26, 13, [false, false, false, true]])
expect("IMPORT_RECHECK_3 PSYSHOCK Magic Bounce (stand-in target with status.magicBounce): the excess damage request 11 is blocked (returned 0, spellBlockedCount 1) and a delayed reflection command is queued only when the attacker lacks Protective Pads (1 command without, 0 with Pads); the PP loss and the shield request are unaffected", [Z3.psyshock.bounce.bounceCommands, Z3.psyshock.bounceWithPads.bounceCommands, Z3.psyshock.bounce.blocked, Z3.psyshock.bounce.calls[2].returned, Z3.psyshock.bounce.casterShield], [1, 0, 1, 0, 21])
expect("IMPORT_RECHECK_3 PSYSTRIKE (real strategy, real getFarthestTarget / isTargettableBy / getCellsBetween / getTeleportationCell / canBeMoved / moveTo on a stand-in 8x6 board; the damage call is a controlled recorder): two enemies on the line each get one damage request 80 and are then moved to the farthest free cell on the lines to their own team's back corners (e1 (3,3) -> (7,5), e2 (3,5) -> (0,5), the second move sees the first's new cell occupied); locked, skydiving and Heavy Duty Boots enemies are damaged but not moved (state change not requested); Protect does not block the move; an enemy whose damage request set hp to 0 (controlled callback) is still moved (no survival check in the strategy); with no free cell on the lines nothing moves", [Z3.psystrike.twoEnemiesOnLine.e1, Z3.psystrike.twoEnemiesOnLine.e2.position, Z3.psystrike.lockedSkydivingBoots.locked.movingStateCalls + Z3.psystrike.lockedSkydivingBoots.sky.movingStateCalls + Z3.psystrike.lockedSkydivingBoots.boots.movingStateCalls, Z3.psystrike.lockedSkydivingBoots.far.position, Z3.psystrike.protectDoesNotBlockMove.prot.position, Z3.psystrike.lethalStillMoved.dead, Z3.psystrike.noFreeCell.boxed.position], [{ damageCalls: [80], position: [7, 5], movingStateCalls: 1, hp: 100 }, [0, 5], 0, [7, 5], [7, 5], { damageCalls: [80], position: [7, 5], movingStateCalls: 1, hp: 0 }, [1, 0]])
expect("IMPORT_RECHECK_3 PSYSTRIKE endpoint and fallback: isTargettableBy admits an ALLY with hp <= 10 only for an attacker with the MERCILESS effect: with MERCILESS the 5-hp ally is the farthest target, the line holds no enemy so the endpoint is inserted without a team check, damaged (80) and moved by its own team's corners (to (0,0)); without MERCILESS the ally is ignored and only the enemy is hit", [Z3.psystrike.mercilessAllyFallback.lowAlly, Z3.psystrike.noMercilessAllyNotTargetable.lowAlly.damageCalls, Z3.psystrike.noMercilessAllyNotTargetable.enemy.damageCalls], [{ damageCalls: [80], position: [0, 0], movingStateCalls: 1, hp: 5 }, [], [80]])
expect("IMPORT_RECHECK_3 PSYSHIELD_BASH (real strategy and board helpers; stand-in units; BLUE_TEAM / RED_TEAM): the order is move (unforced, forced flag false) -> Protect 1000 -> damage; with a destination the enemies on the line are hit (e1 and e2) and the off-line cast target is not; retained earlier cell: when the farthest enemy has no free adjacent cell the cell chosen for the earlier nearer enemy is kept ((4,1), next to 'near'), the line then holds no enemy and the original target is hit; nonadjacent fallback: with every neighbour of the farthest enemy occupied the closest free cell is used ((7,3), two away from (7,5)) and the original target is hit", [Z3.psyshield.basic.order, Z3.psyshield.retainedEarlierCell.order, Z3.psyshield.nonadjacentFallback.order], [[["move", 6, 5, false], ["protect", 1000], ["damage", "e1", 50], ["damage", "e2", 50]], [["move", 4, 1, false], ["protect", 1000], ["damage", "far", 50]], [["move", 7, 3, false], ["protect", 1000], ["damage", "far", 50]]])
expect("IMPORT_RECHECK_3 PSYSHIELD_BASH no destination and guards: with no targettable enemy there is no move, Protect 1000 is still requested and the original cast target - here an ALLY - is damaged without another team check; a caster that is locked and holds Heavy Duty Boots still moves (the self-move is unforced and does not consult canBeMoved); an existing Protect keeps its remaining 300 ms (not refreshed); an enraged caster gets no Protect", [Z3.psyshield.noDestinationNoEnemy.order, Z3.psyshield.unforcedMoveIgnoresCanBeMoved.casterPos, Z3.psyshield.existingProtect.protectCooldown, Z3.psyshield.enraged.protect], [[["protect", 1000], ["damage", "allyTarget", 50]], [6, 5], 300, false])
// 29. CATCHUP_C1 (catch-up cycle 1): the real RAPID_SPIN / REFLECT / ROCK_HEAD / ROCK_SMASH / ROCK_WRECKER strategy text with the real addDefense / addSpecialDefense, handleDamage /
// handleSpecialDamage (reflect branch, armor-reduction halving, flinch shield split) and triggerArmorReduction / triggerFlinch / triggerFatigue / applyStatusDurationReductions text,
// run against STAND-IN units (controlled recorders for plain damage calls and for the attacker that receives a reflection). Requests = arguments received; returns = what a helper hands
// back; final = stored fields. Not a fight.
const StatusY = build({ Weather: enums(), EffectEnum: enums(), Item: enums(), Passive: enums(), count },
  js(`class SY {\n${cut(ST, 342, 352, "triggerArmorReduction(")}\n${cut(ST, 547, 562, "triggerFatigue(")}\n${cut(ST, 976, 986, "triggerFlinch(")}\n${cut(ST, 1282, 1305, "private applyStatusDurationReductions(").replace("private ", "")}\n}`), "SY")
const stratY = (file, cls, env = {}) => stratReal(`${AB}${file}`, cls, env)
const mkY = (o = {}) => { const u = mkFU({ team: o.team ?? "RED_TEAM", hp: o.hp ?? 500, maxHP: 1000, shield: o.shield ?? 0, atk: o.atk ?? 30, ap: o.ap ?? 0, stars: o.stars ?? 1, items: new Set(o.items ?? []) }); u.def = o.def ?? 20; u.speDef = o.speDef ?? 20; u.name = o.name ?? "u"; u.effects = new Set(o.effects ?? []); u.status = Object.assign(new StatusY(), u.status, { runeProtect: false, armorReduction: false, armorReductionCooldown: 0, flinch: false, flinchCooldown: 0, fatigue: false, fatigueCooldown: 0, reflect: false }, o.status ?? {}); u.player = o.player ?? null; u.onDamageDealt = () => {}; u.onDamageReceived = () => {}; return u }
// ---- RAPID_SPIN: atk sampled BEFORE the damage call; self buffs unconditional (real addDefense / addSpecialDefense)
const RapidSpinY = stratY("rapid-spin.ts", "RapidSpinStrategy")
const rapidSpinY = ({ atk = 14, ap = 0, crit = false, items = [], damageChangesAtk = false, damageTakenZero = false } = {}) => {
  const c = Object.assign(new Ent(), { items: new Set(items), team: "BLUE_TEAM", ap, critPower: 2, atk, def: 10, speDef: 10, isGhostOpponent: true, passive: "NONE", name: "c", index: 1, player: null, commands: [], stars: 2, pp: 100, maxPP: 100, count: { ult: 0 }, status: {}, simulation: { blueAbilitiesCast: [], redAbilitiesCast: [] }, broadcastAbility() {} })
  const calls = []
  const t = { handleSpecialDamage(raw, b, ty, a, cr) { calls.push({ requestedRaw: raw, atkWhenCalled: c.atk }); if (damageChangesAtk) c.atk = 100; return { takenDamage: damageTakenZero ? 0 : 7, death: false } } }
  new RapidSpinY().process(c, {}, t, crit)
  return { calls, atk: c.atk, def: c.def, speDef: c.speDef }
}
// ---- REFLECT: real handleDamage; reflection is generated only for an eligible PHYSICAL hit
const ReflectY = stratY("reflect.ts", "ReflectStrategy")
const reflectCast = (status = {}) => { const s = Object.assign(new (build({}, js(`class R {\n${cut(ST, 1026, 1031, "triggerReflect(")}\n}`), "R"))(), { reflect: false, reflectCooldown: 0 }, status); new ReflectY().process({ stars: 1, pp: 100, maxPP: 100, count: { ult: 0 }, team: "BLUE_TEAM", status: s, simulation: { blueAbilitiesCast: [], redAbilitiesCast: [] }, broadcastAbility() {}, ap: 0, critPower: 2 }, {}, null, false); return { reflect: s.reflect, cooldown: s.reflectCooldown } }
const reflectHit = ({ attackType = "PHYSICAL", pads = false, retaliation = false, protect = false, skydiving = false, resurrecting = false, dead = false, stars = 1, ap = 0, dmg = 100, noAttacker = false } = {}) => {
  const t = mkY({ hp: dead ? 0 : 500, stars, ap, status: { reflect: true, protect, skydiving, resurrecting } }); t.status.flinch = false
  const att = mkY({ team: "BLUE_TEAM", items: pads ? ["PROTECTIVE_PADS"] : [] }); const got = []; att.handleDamage = (a) => { got.push({ damage: a.damage, attackType: a.attackType, isRetaliation: a.isRetaliation }); return { death: false, takenDamage: 0 } }
  const r = t.state.handleDamage({ target: t, damage: dmg, board: { getAdjacentCells: () => [] }, attackType, attacker: noAttacker ? null : att, shouldTargetGainMana: false, isRetaliation: retaliation })
  return { returned: r, hp: t.hp, reflected: got }
}
// ---- ROCK_HEAD: Math.round(multiplier x (current atk + def)); handleSpecialDamage with apBoost true
const RockHeadY = stratY("rock-head.ts", "RockHeadStrategy")
const rockHead = ({ stars = 1, atk = 30, def = 20, ap = 0, armorReduced = false }) => {
  const c = mkY({ team: "BLUE_TEAM", stars, atk, ap }); c.def = def; c.status.armorReduction = armorReduced; const t = mkY({ hp: 1000, speDef: 0 }); t.maxHP = 5000; t.hp = 5000
  const calls = []; const real = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { const r = real(...a); calls.push({ requestedRaw: a[0], apBoostParam: a[5], returnedTakenDamage: r.takenDamage }); return r }
  new RockHeadY().process(c, { getAdjacentCells: () => [] }, t, false)
  return { calls, targetHp: t.hp }
}
// ---- ROCK_SMASH: status AFTER the hit; an already-active armor reduction halves SPE_DEF for this very hit
const RockSmashY = stratY("rock-smash.ts", "RockSmashStrategy")
const rockSmash = ({ priorArmor = false, targetEffects = [], stars = 1, speDef = 20 }) => {
  const c = mkY({ team: "BLUE_TEAM", stars }), t = mkY({ hp: 5000, speDef, effects: targetEffects, status: { armorReduction: priorArmor, armorReductionCooldown: priorArmor ? 1000 : 0 } }); t.maxHP = 5000
  const order = []; const rd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { order.push(["damage", t.status.armorReduction]); const r = rd(...a); order.push(["taken", r.takenDamage]); return r }
  const ra = t.status.triggerArmorReduction.bind(t.status); t.status.triggerArmorReduction = (d, p) => { order.push(["armorReduction", d, p === t ? "target" : "other"]); return ra(d, p) }
  new RockSmashY().process(c, { getAdjacentCells: () => [] }, t, false)
  return { order, armorReduction: t.status.armorReduction, cooldown: t.status.armorReductionCooldown, hp: t.hp }
}
// ---- ROCK_WRECKER: triggerFlinch(2000, caster): the CASTER supplies the duration reductions, the TARGET status holds the guard
const RockWreckerY = stratY("rock-wrecker.ts", "RockWreckerStrategy")
const rockWrecker = ({ casterEffects = [], targetEffects = [], targetRune = false, casterRune = false, shield = 0, pads = false, hp = 500, casterOddStones = 0 }) => {
  const c = mkY({ team: "BLUE_TEAM", stars: 1, effects: casterEffects, items: pads ? ["PROTECTIVE_PADS"] : [], player: casterOddStones ? { items: Array(casterOddStones).fill("ODD_KEYSTONE") } : null, status: { runeProtect: casterRune } })
  const t = mkY({ hp, shield, speDef: 0, effects: targetEffects, status: { runeProtect: targetRune } })
  const order = []; const rd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { order.push("damage"); return rd(...a) }
  new RockWreckerY().process(c, { getAdjacentCells: () => [] }, t, false)
  return { flinch: t.status.flinch, flinchCooldown: t.status.flinchCooldown, targetHp: t.hp, targetShield: t.shield, fatigue: c.status.fatigue, fatigueCooldown: c.status.fatigueCooldown, casterFlinch: c.status.flinch }
}
out.CATCHUP_C1 = {
  rapidSpin: { plain: rapidSpinY(), atkChangedByDamage: rapidSpinY({ damageChangesAtk: true }), blockedDamage: rapidSpinY({ damageTakenZero: true }), ap100: rapidSpinY({ ap: 100 }), belt: rapidSpinY({ items: ["BIG_EATER_BELT"] }) },
  reflect: { cast: reflectCast(), recast: reflectCast({ reflect: true, reflectCooldown: 4000 }), eligible: reflectHit(), pads: reflectHit({ pads: true }), retaliation: reflectHit({ retaliation: true }), protect: reflectHit({ protect: true }), skydiving: reflectHit({ skydiving: true }), resurrecting: reflectHit({ resurrecting: true }), dead: reflectHit({ dead: true }), special: reflectHit({ attackType: "SPECIAL" }), meowstic: reflectHit({ stars: 2 }), ap100: reflectHit({ ap: 100 }), noAttacker: reflectHit({ noAttacker: true }) },
  rockHead: { oneStar: rockHead({ stars: 1 }), threeStar: rockHead({ stars: 3 }), ap100: rockHead({ ap: 100 }), casterArmorReduced: rockHead({ armorReduced: true }) },
  rockSmash: { fresh: rockSmash({}), prior: rockSmash({ priorArmor: true }), targetHydration: rockSmash({ targetEffects: ["HYDRATION"] }), twoStars: rockSmash({ stars: 2 }) },
  rockWrecker: { plain: rockWrecker({}), casterHydration: rockWrecker({ casterEffects: ["HYDRATION"] }), targetHydrationOnly: rockWrecker({ targetEffects: ["HYDRATION"] }), casterOdd: rockWrecker({ casterOddStones: 2 }), targetRune: rockWrecker({ targetRune: true }), casterRune: rockWrecker({ casterRune: true }), shield30: rockWrecker({ shield: 30 }), shield30Pads: rockWrecker({ shield: 30, pads: true }) }
}
const C1 = out.CATCHUP_C1
expect("CATCHUP_C1 RAPID_SPIN (real strategy, real addDefense / addSpecialDefense; stand-in damage target; caster atk 14): the buff amount round(0.5 x atk) = 7 is computed BEFORE the damage call - a stand-in that changes atk to 100 during the damage call does not change the buff (def and speDef 10 -> 17); the buffs are made when the damage call returns takenDamage 0 as well; AP 100 doubles the stored buff through the adders (10 -> 24); Big Eater Belt turns 7 into 8 (10 -> 18)", [C1.rapidSpin.plain.def, C1.rapidSpin.plain.speDef, C1.rapidSpin.atkChangedByDamage.def, C1.rapidSpin.atkChangedByDamage.calls[0].atkWhenCalled, C1.rapidSpin.blockedDamage.def, C1.rapidSpin.ap100.def, C1.rapidSpin.belt.def], [17, 17, 17, 14, 17, 24, 18])
expect("CATCHUP_C1 REFLECT (real triggerReflect and real handleDamage text; stand-in attacker recording the reflected call): the cast stores 3000 ms and a recast with a longer remaining timer keeps it (4000); an eligible PHYSICAL hit of 100 is negated (returned takenDamage 0, HP unchanged) and attacker.handleDamage receives a SPECIAL retaliation of round(factor x 100 x (1 + reflector AP/100)): 50 for a 1-star reflector, 75 for 2 stars, 100 at AP 100; the no-reflection cases keep the negation: Protective Pads and an incoming retaliation hit are negated without a reflection; protect, skydiving, resurrecting and dead recipients return 0 BEFORE the reflect branch (no reflection); a SPECIAL hit is neither negated nor reflected (taken 50)", [C1.reflect.cast, C1.reflect.recast.cooldown, C1.reflect.eligible.returned.takenDamage, C1.reflect.eligible.reflected, C1.reflect.meowstic.reflected[0].damage, C1.reflect.ap100.reflected[0].damage, C1.reflect.pads, C1.reflect.retaliation, C1.reflect.protect.reflected, C1.reflect.skydiving.reflected, C1.reflect.resurrecting.reflected, C1.reflect.dead.reflected, C1.reflect.special.returned.takenDamage, C1.reflect.noAttacker.reflected], [{ reflect: true, cooldown: 3000 }, 4000, 0, [{ damage: 50, attackType: "SPECIAL", isRetaliation: true }], 75, 100, { returned: { death: false, takenDamage: 0 }, hp: 500, reflected: [] }, { returned: { death: false, takenDamage: 0 }, hp: 500, reflected: [] }, [], [], [], [], 50, []])
expect("CATCHUP_C1 ROCK_HEAD (real strategy and handleSpecialDamage on a stand-in target, speDef 0): the request is round(1.2 x (current atk 30 + def 20)) = 60 for 1 star and round(1.5 x 50) = 75 for 3 stars, handed over with apBoost true; AP 100 doubles the applied figure inside handleSpecialDamage (returned 120); an armor-reduction status on the CASTER changes nothing (the raw def field is read)", [C1.rockHead.oneStar.calls[0], C1.rockHead.threeStar.calls[0].requestedRaw, C1.rockHead.ap100.calls[0].returnedTakenDamage, C1.rockHead.casterArmorReduced.calls[0].requestedRaw], [{ requestedRaw: 60, apBoostParam: true, returnedTakenDamage: 60 }, 75, 120, 60])
expect("CATCHUP_C1 ROCK_SMASH (real strategy, handleDamage and triggerArmorReduction): the damage call comes BEFORE the status request (order damage, armorReduction), so this cast's own hit does not benefit from its new armor reduction (raw 25 vs speDef 20 -> 13) while an ALREADY-active armor reduction halves speDef for the hit (-> 17); the duration is supplied with the TARGET as the reduction source: a target with HYDRATION stores 1500 for the 3000 request, 2 stars request 6000", [C1.rockSmash.fresh.order, C1.rockSmash.prior.order[1], C1.rockSmash.prior.order[0], C1.rockSmash.targetHydration.cooldown, C1.rockSmash.twoStars.cooldown], [[["damage", false], ["taken", 13], ["armorReduction", 3000, "target"]], ["taken", 17], ["damage", true], 1500, 6000])
expect("CATCHUP_C1 ROCK_WRECKER (real triggerFlinch / triggerFatigue / applyStatusDurationReductions text): triggerFlinch(2000, caster) takes the duration reductions from the CASTER while the Rune Protect guard is the TARGET status: caster HYDRATION -> flinch 1000 ms, target HYDRATION alone -> 2000 ms, two caster Odd Keystones -> 1600 ms; target Rune Protect refuses the flinch while the caster's fatigue (4000 ms, caster as source: 2000 with caster HYDRATION, 3200 with two Odd Keystones) still applies; caster Rune Protect blocks only the fatigue", [C1.rockWrecker.plain.flinchCooldown, C1.rockWrecker.casterHydration.flinchCooldown, C1.rockWrecker.targetHydrationOnly.flinchCooldown, C1.rockWrecker.casterOdd.flinchCooldown, C1.rockWrecker.casterHydration.fatigueCooldown, C1.rockWrecker.casterOdd.fatigueCooldown, C1.rockWrecker.targetRune.flinch, C1.rockWrecker.targetRune.fatigue, C1.rockWrecker.casterRune.flinch, C1.rockWrecker.casterRune.fatigue], [2000, 1000, 2000, 1600, 2000, 3200, false, true, true, false])
expect("CATCHUP_C1 ROCK_WRECKER shield split (reduced damage 80, target shield 30): flinch makes the first split ceil(50%) = 40 on the shield and 40 residual; the shield overflow (10) joins the residual so HP loses 50 (500 -> 450); an attacker's Protective Pads double the shield part first (80), so the overflow is larger and HP loses 90 (-> 410) - final accounting differs from the simple 50 / 50 split", [C1.rockWrecker.plain.targetHp, C1.rockWrecker.shield30.targetHp, C1.rockWrecker.shield30.targetShield, C1.rockWrecker.shield30Pads.targetHp], [420, 450, 0, 410])
// 30. CATCHUP_C2 (catch-up cycle 2): the real SAND_TOMB / SCREECH / SEED_FLARE / SHADOW_SNEAK / SHEER_COLD strategy text with the real triggerParalysis / triggerSilence /
// applyStatusDurationReductions, getCellsInRadius, addDefense / addSpecialDefense (+ Belt / Twist helpers), handleSpecialDamage / handleDamage and chance text, run against STAND-IN
// units and boards (controlled random roll, plain damage recorders, a stand-in healParalysis for the Cheri Berry case). Requests = arguments received; returns = what a helper hands
// back; final = stored fields. Not a fight.
const StatusX = build({ Weather: enums(), EffectEnum: enums(), Item: enums(), Passive: enums(), count },
  js(`class SX {\n${cut(ST, 908, 939, "triggerParalysis(")}\n${cut(ST, 520, 536, "triggerSilence(")}\n${cut(ST, 1282, 1305, "private applyStatusDurationReductions(").replace("private ", "")}\n healParalysis() { this.paralysis = false; this.paralysisCooldown = 0 }\n}`), "SX")
const cheriBerryX = build({ Item: enums(), EffectEnum: enums() }, js(`function eat(heal) {\n${cut(PE, 1601, 1604, "this.status.healParalysis(this)")}\n}`), "eat")
const uX = (o = {}) => { const u = mkFU({ team: o.team ?? "RED_TEAM", hp: o.hp ?? 500, maxHP: 1000, atk: 30, ap: o.ap ?? 0, stars: o.stars ?? 1, items: new Set(o.items ?? []) }); u.name = o.name ?? "u"; u.def = o.def ?? 20; u.speDef = o.speDef ?? 20; u.effects = new Set(o.effects ?? []); u.types = new Set(o.types ?? []); u.luck = o.luck ?? 0; u.player = o.player ?? null; u.simulation.weather = o.weather ?? "NONE"; u.status = Object.assign(new StatusX(), u.status, { runeProtect: false, tree: false, paralysis: false, paralysisCooldown: 0, silence: false, silenceCooldown: 0, silenceOrigin: null, freeze: false }, o.status ?? {}); u.onDamageDealt = () => {}; u.onDamageReceived = () => {}; u.eatBerry = function (b) { this.removeItem?.(b); this.log = [...(this.log ?? []), "eat" + b]; cheriBerryX.call(this, () => {}) }; u.addAbilityPower = () => {}; u.addAttack = () => {}; u.healDone = 0; return u }
// ---- SAND_TOMB: paralysis -> silence -> damage; requested versus stored durations
const SandTombX = stratReal(`${AB}sand-tomb.ts`, "SandTombStrategy")
const sandTomb = ({ stars = 1, weather = "NONE", targetEffects = [], status = {}, items = [], player = null, protect = false }) => {
  const c = uX({ team: "BLUE_TEAM", stars }), t = uX({ effects: targetEffects, status: { ...status, protect }, items, player, weather }); c.simulation.weather = weather
  const order = []; for (const m of ["triggerParalysis", "triggerSilence"]) { const f = t.status[m].bind(t.status); t.status[m] = (d, p, o) => { order.push([m, d]); return f(d, p, o) } }
  const hd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { order.push(["damage", a[0]]); return hd(...a) }
  t.status.healParalysis = t.status.healParalysis.bind(t.status)
  new SandTombX().process(c, { getAdjacentCells: () => [] }, t, false)
  return { order, paralysis: t.status.paralysis, paralysisCooldown: t.status.paralysisCooldown, silence: t.status.silence, silenceCooldown: t.status.silenceCooldown, hp: t.hp, eaten: t.log ?? [] }
}
// ---- SCREECH / SEED_FLARE: caster-centred radius cells; real stat adders
const rx = (name, x, y, o = {}) => ({ name, x, y, ...o })
const discX = (radius, caster, enemies) => { const b = new BoardZ(6, 8); const c = unitZ("caster", BLUE_Z, caster[0], caster[1], {}); const es = enemies.map((e) => unitZ(e.name, RED_Z, e.x, e.y, {})); placeZ(b, c, ...es); const cells = BoardXFn(b).call(b, caster[0], caster[1], radius, false); return cells.filter((cell) => cell.value).map((cell) => cell.value.name).sort() }
const BoardXFn = () => build({}, js(`class T {\n${cut(BD, 267, 289, "getCellsInRadius(")}\n}`), "T").prototype.getCellsInRadius
const EntX = EntClass()
const statEnemy = (name, team, x, y, o = {}) => Object.assign(new EntX(), { name, team, items: new Set(o.items ?? []), ap: 0, critPower: 2, atk: 20, def: o.def ?? 10, speDef: o.speDef ?? 10, isGhostOpponent: true, passive: "NONE", index: 1, player: null, commands: [], stars: 1, positionX: x, positionY: y, id: name, status: {}, effects: new Set(), simulation: {}, handleSpecialDamage() { return { takenDamage: 0, death: false } } })
const ScreechX = stratReal(`${AB}screech.ts`, "ScreechStrategy"), SeedFlareX = stratReal(`${AB}seed-flare.ts`, "SeedFlareStrategy")
const areaX = (Strat, { stars = 1, ap = 0, caster = [3, 2], enemies, crit = false }) => {
  const b = new BoardZ(6, 8); b.getCellsInRadius = BoardXFn().bind(b)
  const c = Object.assign(unitZ("caster", BLUE_Z, caster[0], caster[1], { stars, ap }), { ap }); c.broadcastAbility = () => {}
  const es = enemies.map((e) => statEnemy(e.name, e.team ?? RED_Z, e.x, e.y, e)); const seen = []
  for (const e of es) { e.handleSpecialDamage = function (raw, bd, ty, a, cr) { seen.push({ name: e.name, speDefAtDamage: e.speDef, raw, crit: cr }); return { takenDamage: 0, death: false } } }
  placeZ(b, c, ...es); new Strat().process(c, b, es[0], crit)
  return { def: Object.fromEntries(es.map((e) => [e.name, e.def])), speDef: Object.fromEntries(es.map((e) => [e.name, e.speDef])), damage: seen }
}
// ---- SHADOW_SNEAK: TRUE on a silenced target still goes through handleSpecialDamage's block guards
const ShadowSneakX = stratReal(`${AB}shadow-sneak.ts`, "ShadowSneakStrategy")
const shadowSneak = ({ silence = false, protect = false, skydiving = false, bounce = false, pads = false }) => {
  const c = uX({ team: "BLUE_TEAM", stars: 3, items: pads ? ["PROTECTIVE_PADS"] : [] }), t = uX({ hp: 500, speDef: 0, status: { silence, protect, skydiving, magicBounce: bounce } })
  const seen = []; const hd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { const r = hd(...a); seen.push({ type: a[2], returned: r.takenDamage }); return r }
  new ShadowSneakX().process(c, { getAdjacentCells: () => [] }, t, false)
  return { seen, hp: t.hp, bounceCommands: t.commands.length, blocked: t.count.spellBlockedCount }
}
// ---- SHEER_COLD: luck-adjusted roll, ICE override before frozen override, 9999 as a requested amount
const SheerColdX = (() => { const log = []; const S = stratReal(`${AB}sheer-cold.ts`, "SheerColdStrategy", { min, Synergy: enums(), chance: (p, pk) => { log.push([p, pk.luck]); return chanceZ(p, pk) } }); S.log = log; return S })()
const sheerCold = ({ stars = 2, casterHp = 1000, targetHp = 500, types = [], freeze = false, roll = 0.01, luck = 0, ap = 0 }) => {
  const c = uX({ team: "BLUE_TEAM", stars, hp: casterHp, ap }); c.luck = luck; const t = uX({ hp: targetHp, types, speDef: 0, status: { freeze } })
  const seen = []; t.handleSpecialDamage = (...a) => { seen.push({ raw: a[0], type: a[2], apBoostParam: a[5] }); return { takenDamage: 0, death: false } }
  chanceRolls.length = 0; chanceRolls.push(roll); SheerColdX.log.length = 0
  new SheerColdX().process(c, {}, t, false)
  return { chance: SheerColdX.log.slice(), seen }
}
out.CATCHUP_C2 = {
  sandTomb: { plain: sandTomb({}), twoStars: sandTomb({ stars: 2 }), storm: sandTomb({ weather: "STORM" }), murky: sandTomb({ weather: "MURKY" }), hydration: sandTomb({ targetEffects: ["HYDRATION"] }), rune: sandTomb({ status: { runeProtect: true } }), tree: sandTomb({ status: { tree: true } }), immune: sandTomb({ targetEffects: ["IMMUNITY_PARALYSIS"] }), protectedTarget: sandTomb({ protect: true }), cheri: sandTomb({ items: ["CHERI_BERRY"] }), longer: sandTomb({ status: { paralysisCooldown: 9000, silenceCooldown: 9000 } }) },
  radius: { r2: discX(2, [3, 2], [rx("off21", 5, 3), rx("off22", 5, 4), rx("off12", 4, 4), rx("off20", 5, 2), rx("self", 3, 2)]), r5corner: discX(5, [0, 0], [rx("a", 3, 4), rx("b", 5, 0), rx("c", 6, 0), rx("d", 5, 2), rx("e", 5, 3), rx("far", 7, 5)]) },
  screech: { plain: areaX(ScreechX, { enemies: [rx("e1", 5, 3), rx("out", 5, 4), rx("ally", 4, 2, { team: BLUE_Z })] }), ap100: areaX(ScreechX, { ap: 100, enemies: [rx("e1", 4, 2)] }), twist: areaX(ScreechX, { enemies: [rx("e1", 4, 2, { items: ["TWIST_BAND"] })] }), floor: areaX(ScreechX, { stars: 2, enemies: [rx("e1", 4, 2, { def: 2 })] }), belt: areaX(ScreechX, { enemies: [rx("e1", 4, 2, { items: ["BIG_EATER_BELT"] })] }) },
  seedFlare: { plain: areaX(SeedFlareX, { stars: 3, caster: [0, 0], enemies: [rx("in", 5, 2), rx("edge", 3, 4), rx("outside", 6, 0), rx("outside2", 5, 3), rx("ally", 1, 1, { team: BLUE_Z })] }), apCrit: areaX(SeedFlareX, { stars: 3, ap: 100, crit: true, caster: [0, 0], enemies: [rx("in", 2, 2)] }), twist: areaX(SeedFlareX, { stars: 3, caster: [0, 0], enemies: [rx("in", 2, 2, { items: ["TWIST_BAND"] })] }), floor: areaX(SeedFlareX, { stars: 3, caster: [0, 0], enemies: [rx("in", 2, 2, { speDef: 1 })] }) },
  shadowSneak: { normal: shadowSneak({}), silenced: shadowSneak({ silence: true }), silencedProtect: shadowSneak({ silence: true, protect: true }), silencedSkydiving: shadowSneak({ silence: true, skydiving: true }), silencedBounce: shadowSneak({ silence: true, bounce: true }), bounce: shadowSneak({ bounce: true }), bouncePads: shadowSneak({ bounce: true, pads: true }) },
  sheerCold: { lead: sheerCold({}), noLead: sheerCold({ casterHp: 300, targetHp: 500 }), ice: sheerCold({ types: ["ICE"] }), frozen: sheerCold({ freeze: true }), iceFrozen: sheerCold({ types: ["ICE"], freeze: true }), success: sheerCold({ roll: 0.1 }), failure: sheerCold({ roll: 0.9 }), luck50Hit: sheerCold({ roll: 0.6, luck: 50 }), luck0Miss: sheerCold({ roll: 0.6, luck: 0 }), oneStar: sheerCold({ stars: 1, casterHp: 500, targetHp: 500 }) }
}
const C2 = out.CATCHUP_C2
expect("CATCHUP_C2 SAND_TOMB (real strategy, real triggerParalysis / triggerSilence / applyStatusDurationReductions, handleSpecialDamage; stand-in healParalysis for the Cheri Berry case): the order is paralysis, silence, damage (requests 3000 / 3000 / 10 for 1 star; 5000 / 5000 / 20 for 2 stars); the statuses are attempts with their own guards: Rune Protect refuses both, IMMUNITY_PARALYSIS only the paralysis, the tree flag only the silence; a Protected target still receives both statuses while the damage is blocked (HP 500); STORM stores paralysis 3900 (x1.3) and MURKY silence 3900; target HYDRATION halves both stored durations (1500); a longer remaining timer is kept (9000); a Cheri Berry holder eats the berry after the paralysis application, so the paralysis flag is cleared at once (false, cooldown 0) while the silence stays", [C2.sandTomb.plain.order, C2.sandTomb.twoStars.order, C2.sandTomb.rune.paralysis, C2.sandTomb.rune.silence, C2.sandTomb.immune.paralysis, C2.sandTomb.immune.silence, C2.sandTomb.tree.paralysis, C2.sandTomb.tree.silence, C2.sandTomb.protectedTarget.paralysis, C2.sandTomb.protectedTarget.silence, C2.sandTomb.protectedTarget.hp, C2.sandTomb.storm.paralysisCooldown, C2.sandTomb.murky.silenceCooldown, C2.sandTomb.hydration.paralysisCooldown, C2.sandTomb.longer.paralysisCooldown, C2.sandTomb.cheri.paralysis, C2.sandTomb.cheri.paralysisCooldown, C2.sandTomb.cheri.silence], [[["triggerParalysis", 3000], ["triggerSilence", 3000], ["damage", 10]], [["triggerParalysis", 5000], ["triggerSilence", 5000], ["damage", 20]], false, false, false, true, true, false, true, true, 500, 3900, 3900, 1500, 9000, false, 0, true])
expect("CATCHUP_C2 getCellsInRadius (real text, 8x6 stand-in board, caster excluded): radius 2 uses squared distance < 6.25, so offset (2,1) is included and (2,2) is excluded; radius 5 uses squared distance < 30.25 - from (0,0) the cells (3,4) [25], (5,0) [25] and (5,2) [29] are inside while (6,0) [36] and (5,3) [34] are outside: a clipped disc, not the whole board", [C2.radius.r2, C2.radius.r5corner], [["off12", "off20", "off21"], ["a", "b", "d"]])
expect("CATCHUP_C2 SCREECH (real strategy, real addDefense and the Belt / Twist helpers; caster at (3,2), enemy DEF 10): a debuff of -2 reaches the enemy at offset (2,1) (DEF 8), not the one at offset (2,2) or the ally; AP 100 doubles it through the adder (-4 -> DEF 6); an enemy Twist Band holder gains instead (DEF 12); a Big Eater Belt on the enemy changes nothing; the DEF stat floors at 0 (2-star -4 on DEF 2 -> 0); no timer or restore is installed by the strategy (only the stored stat changes)", [C2.screech.plain.def, C2.screech.ap100.def.e1, C2.screech.twist.def.e1, C2.screech.belt.def.e1, C2.screech.floor.def.e1], [{ e1: 8, out: 10, ally: 10 }, 6, 12, 8, 0])
expect("CATCHUP_C2 SEED_FLARE (real strategy, real addSpecialDefense; caster (0,0), 3 stars, enemy SPE_DEF 10): per victim the SPE_DEF change comes BEFORE the damage request (the recorder sees SPE_DEF 7 at damage time, raw 30); AP 100 and a crit do not scale the debuff (still -3) while the crit flag reaches the damage call; an enemy Twist Band holder gains instead (13, and the damage sees 13); SPE_DEF floors at 0; only the cells inside the clipped radius-5 disc are touched ((6,0) and (5,3) are not), allies never", [C2.seedFlare.plain.damage, C2.seedFlare.plain.speDef, C2.seedFlare.apCrit.speDef.in, C2.seedFlare.apCrit.damage[0].crit, C2.seedFlare.twist.speDef.in, C2.seedFlare.twist.damage[0].speDefAtDamage, C2.seedFlare.floor.speDef.in], [[{ name: "in", speDefAtDamage: 7, raw: 30, crit: false }, { name: "edge", speDefAtDamage: 7, raw: 30, crit: false }], { in: 7, edge: 7, outside: 10, outside2: 10, ally: 10 }, 7, true, 13, 13, 0])
expect("CATCHUP_C2 SHADOW_SNEAK (real strategy, real handleSpecialDamage on a stand-in target, speDef 0, raw 50): a silenced target is hit as TRUE, otherwise SPECIAL; the TRUE request still goes through handleSpecialDamage's block guards - protect, skydiving and magicBounce return 0 for TRUE too; the SPECIAL-only bounce branch does not queue a reflection for the TRUE hit (0 commands) while a SPECIAL hit on a magicBounce target queues one (1) unless the attacker holds Protective Pads (0)", [C2.shadowSneak.normal.seen, C2.shadowSneak.silenced.seen, C2.shadowSneak.silencedProtect.seen, C2.shadowSneak.silencedSkydiving.seen, C2.shadowSneak.silencedBounce.seen, C2.shadowSneak.silencedBounce.bounceCommands, C2.shadowSneak.bounce.bounceCommands, C2.shadowSneak.bouncePads.bounceCommands], [[{ type: "SPECIAL", returned: 50 }], [{ type: "TRUE", returned: 50 }], [{ type: "TRUE", returned: 0 }], [{ type: "TRUE", returned: 0 }], [{ type: "TRUE", returned: 0 }], 0, 1, 0])
expect("CATCHUP_C2 SHEER_COLD (real strategy, the real chance text with a controlled roll, real min): min(0) is Math.max(0, value), so a caster with less HP than the target gets factor 1 (2 stars: 0.2) and a caster with twice the target's HP factor 2 (0.2 x 2 = 0.4); ICE target -> chance(0); frozen target -> chance(1); ICE AND frozen -> 0 (the ICE override comes first); the roll uses the caster's luck as exponent (probability 0.4, roll 0.6: miss at luck 0, hit at luck 50 because 0.4^0.5 = 0.632); a successful roll changes only the REQUESTED SPECIAL amount to 9999 (apBoost true) - a request, not a guaranteed kill", [C2.sheerCold.lead.chance, C2.sheerCold.noLead.chance, C2.sheerCold.ice.chance, C2.sheerCold.frozen.chance, C2.sheerCold.iceFrozen.chance, C2.sheerCold.luck50Hit.seen[0].raw, C2.sheerCold.luck0Miss.seen[0].raw, C2.sheerCold.success.seen[0], C2.sheerCold.failure.seen[0].raw, C2.sheerCold.oneStar.chance], [[[0.4, 0]], [[0.2, 0]], [[0, 0]], [[1, 0]], [[0, 0]], 9999, 100, { raw: 9999, type: "SPECIAL", apBoostParam: true }, 100, [[0.1, 0]]])
// 31. CATCHUP_C3 (catch-up cycle 3): the real SHORE_UP / SOLAR_BEAM / SPLASH / SUPER_FANG / TAILWIND strategy text with the real PokemonState.handleHeal / addShield, PokemonEntity.handleHeal /
// addShield / addPP / addMaxHP / addSpeed / addAttack, Status.updateBurn, Board.getCellsBetween / effectInLine / forEach, handleSpecialDamage / handleDamage and castAbility text, run against STAND-IN units
// and boards. Requests = arguments received; returns = what a helper hands back; final = stored fields. Not a fight.
const AB3 = "app/core/abilities/"
// ---- SHORE_UP: heal request, wound branch before the alive / protect guard, Blood Moon shield request, Grass overheal request
const ShoreUpX = stratReal(`${AB3}shore-up.ts`, "ShoreUpStrategy", { Weather: enums() })
const shoreUp = ({ stars = 1, hp = 500, maxHP = 1000, weather = "NONE", status = {}, items = [], grass = false, stones = 0, ap = 0, crit = false, effects = [] } = {}) => {
  const u = mkHU({ hp, maxHP, status, items, grass, weather, stones, name: "caster" })
  Object.assign(u, { stars, ap, count: { ult: 0 }, broadcastAbility() {}, team: "BLUE_TEAM", skill: "SHORE_UP", effects: new Set(effects) })
  u.simulation = { ...u.simulation, blueAbilitiesCast: [], redAbilitiesCast: [] }
  const heals = []; const real = u.handleHeal.bind(u); u.handleHeal = (...a) => { const r = real(...a); heals.push({ request: a[0], casterIsSelf: a[1] === u, apBoost: a[2], crit: a[3], returned: r }); return r }
  new ShoreUpX().process(u, {}, null, crit)
  return { heals, hp: u.hp, maxHP: u.maxHP, shield: u.shield, downstream: u.requests, pp: u.pp }
}
// ---- SOLAR_BEAM: line cells, per-cell burn then damage, conditional PP request before the line, burn tick by weather
const SolarBeamX = stratReal(`${AB3}solar-beam.ts`, "SolarBeamStrategy", { effectInLine: effectInLineZ, Weather: enums() })
const lineCells = (from, to) => { const b = new BoardZ(6, 8); const t = { positionX: to[0], positionY: to[1] }; const c = { positionX: from[0], positionY: from[1] }; const cells = []; effectInLineZ(b, c, t, (cell) => cells.push(`${cell.x},${cell.y}`)); return cells }
const solarBeam = ({ stars = 1, weather = "NONE", light = false, ap = 0, crit = false, pp = 0, casterStatus = {}, casterEffects = [], enemies, allies = [], target }) => {
  const b = new BoardZ(6, 8)
  const c = mkHU({ pp, maxPP: 100, status: { ...casterStatus, light }, weather, name: "caster", effects: casterEffects })
  Object.assign(c, { stars, ap, count: { ult: 0 }, broadcastAbility() {}, team: BLUE_Z, skill: "SOLAR_BEAM", positionX: 0, positionY: 0, effects: new Set(casterEffects) })
  c.simulation = { ...c.simulation, weather, blueAbilitiesCast: [], redAbilitiesCast: [] }
  const order = []
  const ppReal = c.addPP.bind(c); c.addPP = (...a) => { order.push(["addPP", a[0], a[2], a[3]]); return ppReal(...a) }
  const es = enemies.map((e) => { const u = unitZ(e.name, RED_Z, e.x, e.y, {}); u.status.triggerBurn = (d, p, o) => { order.push(["burn", e.name, d, o === c]) }; u.handleSpecialDamage = (raw, bd, ty, att, cr, apb) => { order.push(["damage", e.name, raw, ty, cr, apb]); return { takenDamage: 0, death: false } }; return u })
  const al = allies.map((e) => { const u = unitZ(e.name, BLUE_Z, e.x, e.y, {}); u.status.triggerBurn = () => order.push(["burn", e.name]); u.handleSpecialDamage = () => { order.push(["damage", e.name]); return { takenDamage: 0, death: false } }; return u })
  placeZ(b, ...es, ...al)
  const tgt = es.find((e) => e.name === target)
  b.setEntityOnCell(0, 0, c)
  new SolarBeamX().process(c, b, tgt, crit)
  return { order, pp: c.pp }
}
const UpdateBurnX = build({ Passive: enums(), Weather: enums(), Item: enums(), EffectEnum: enums(), AttackType: enums(), count }, js(`class SB {\n${cut(ST, 440, 501, "updateBurn(")}\n}`), "SB")
const burnTick = ({ weather = "NONE", items = [], effects = [], passive = "NONE", maxHP = 1000, heatRocks = 0 }) => {
  const calls = []
  const pkm = { maxHP, passive, simulation: { weather }, items: new Set(items), effects: new Set(effects), player: heatRocks ? { items: Array(heatRocks).fill("HEAT_ROCK") } : null, addSpeed: (...a) => calls.push(["addSpeed", ...a.slice(0, 1)]), handleDamage: (o) => calls.push(["damage", o.damage, o.attackType]) }
  const st = Object.assign(new UpdateBurnX(), { burnDamageCooldown: 0, burnCooldown: 3000, burnOrigin: "ORIGIN", healBurn() {} })
  st.updateBurn(100, pkm, {})
  return calls
}
// ---- SPLASH: real strategy on the real AbilityStrategy base, and the real castAbility text around it
const SplashX = stratReal(`${AB3}splash.ts`, "SplashStrategy")
const castAbilityX = (log) => build({ EffectEnum: enums(), chance: () => false, OnAbilityCastEffect: class OnAbilityCastEffect {} }, js(strategySrc(`${AB3}cast.ts`)), "castAbility")
const splash = ({ canCast = true, withTarget = false, pp = 120, maxPP = 100 } = {}) => {
  const calls = []
  const c = mkCaster({ pp, maxPP, hp: 500, shield: 7, atk: 30, speed: 44, skill: "SPLASH", team: "BLUE_TEAM", canCast, critChance: 0, getEffects: () => [{ apply: (...a) => calls.push(["hook", a[2] === null ? "null target" : "target", a[3]]) }], broadcastAbility: (o) => calls.push(["broadcast", o.targetX, o.targetY]), simulation: { blueAbilitiesCast: [], redAbilitiesCast: [] } })
  const before = { hp: c.hp, shield: c.shield, atk: c.atk, speed: c.speed, ap: c.ap, status: JSON.stringify(c.status) }
  const target = withTarget ? { positionX: 4, positionY: 2 } : null
  castAbilityX()(new SplashX(), c, {}, target)
  const after = { hp: c.hp, shield: c.shield, atk: c.atk, speed: c.speed, ap: c.ap, status: JSON.stringify(c.status) }
  return { calls, ppAfter: c.pp, countUlt: c.count.ult, castList: c.simulation.blueAbilitiesCast, unchanged: JSON.stringify(before) === JSON.stringify(after) }
}
// ---- SUPER_FANG: requested TRUE amount from the target's max HP, apBoost false, real handleSpecialDamage / handleDamage
const SuperFangX = stratReal(`${AB3}super-fang.ts`, "SuperFangStrategy")
const superFang = ({ stars = 1, ap = 0, targetMax = 1000, targetHp = 1000, shield = 0, crit = false, protect = false, doubleDamage = false }) => {
  const c = mkFU({ team: "BLUE", stars, ap, hp: 800, maxHP: 800 }); Object.assign(c, { count: { ult: 0 }, broadcastAbility() {}, skill: "SUPER_FANG", pp: 0, maxPP: 100, critPower: 2, positionX: 0, positionY: 0 })
  c.simulation = { ...c.simulation, blueAbilitiesCast: [], redAbilitiesCast: [] }
  if (doubleDamage) c.effects = new Set(["DOUBLE_DAMAGE"])
  const t = mkFU({ team: "RED", hp: targetHp, maxHP: targetMax, shield }); t.status.protect = protect
  const seen = []; const hd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { const r = hd(...a); seen.push({ raw: a[0], type: a[2], crit: a[4], apBoostParam: a[5], returned: r.takenDamage }); return r }
  new SuperFangX().process(c, { getAdjacentCells: () => [] }, t, crit)
  return { seen, hp: t.hp, shield: t.shield }
}
// ---- TAILWIND: real strategy, real addSpeed / addAttack and the Belt / Twist helpers, real Board.forEach order
const TwSrc = `${helpers}\nclass TW {\n${js(`class _ {\n${[cut(PE, 726, 750, "addAttack("), cut(PE, 752, 780, "addSpeed(")].join("\n")}\n}`).replace(/^class _ \{\n/, "").replace(/\n\}\s*$/, "")}\n}`
const TW = build({ Item: enums(), Passive: enums(), min, max, clamp, roundToNDigits, MAX_SPEED: 300 }, TwSrc, "TW")
const TailwindX = stratReal(`${AB3}tailwind.ts`, "TailwindStrategy")
const mkTW = (name, team, o = {}) => Object.assign(new TW(), { name, team, items: new Set(o.items ?? []), passive: o.passive ?? "NONE", ap: o.ap ?? 0, critPower: 2, speed: o.speed ?? 50, atk: o.atk ?? 20, isGhostOpponent: true, stars: o.stars ?? 1, skill: "TAILWIND", pp: 0, maxPP: 100, count: { ult: 0 }, broadcastAbility() {}, simulation: { blueAbilitiesCast: [], redAbilitiesCast: [] } })
const tailwind = ({ stars = 1, ap = 0, crit = false, allies, enemies = [] }) => {
  const c = mkTW("caster", "BLUE_TEAM", { stars, ap, ...(allies.find((a) => a.name === "caster") ?? {}) })
  const others = allies.filter((a) => a.name !== "caster").map((a) => mkTW(a.name, "BLUE_TEAM", a)); const foes = enemies.map((a) => mkTW(a.name, "RED_TEAM", a))
  const all = [c, ...others, ...foes]
  const board = { forEach: (cb) => all.forEach((e, i) => cb(i % 8, Math.floor(i / 8), e)) }
  new TailwindX().process(c, board, null, crit)
  return Object.fromEntries(all.map((e) => [e.name, { speed: e.speed, atk: e.atk }]))
}
out.CATCHUP_C3 = {
  shoreUp: {
    star1: shoreUp({}), star2: shoreUp({ stars: 2 }), sand1: shoreUp({ weather: "SANDSTORM" }), sand2: shoreUp({ stars: 2, weather: "SANDSTORM" }), ap100: shoreUp({ ap: 100 }), crit: shoreUp({ crit: true }), fallback: shoreUp({ stars: 5 }),
    woundMoon: shoreUp({ status: { wound: true }, weather: "BLOODMOON", stones: 1 }), woundMoonAp: shoreUp({ status: { wound: true }, weather: "BLOODMOON", stones: 1, ap: 100 }), woundMoonCrit: shoreUp({ status: { wound: true }, weather: "BLOODMOON", stones: 1, crit: true }),
    woundMoonProtect: shoreUp({ status: { wound: true, protect: true }, weather: "BLOODMOON", stones: 2 }), woundMoonDead: shoreUp({ hp: 0, status: { wound: true }, weather: "BLOODMOON", stones: 1 }), woundMoonEnraged: shoreUp({ status: { wound: true, enraged: true }, weather: "BLOODMOON", stones: 1 }), woundMoonBelt: shoreUp({ status: { wound: true }, weather: "BLOODMOON", stones: 1, items: ["BIG_EATER_BELT"] }), woundNoMoon: shoreUp({ status: { wound: true }, stones: 1 }),
    protect: shoreUp({ status: { protect: true } }), runeProtect: shoreUp({ status: { runeProtect: true } }), burn: shoreUp({ status: { burn: true } }), zenith: shoreUp({ weather: "ZENITH" }),
    grass: shoreUp({ hp: 990, grass: true }), grassAp: shoreUp({ hp: 990, grass: true, ap: 100 }), grassBelt: shoreUp({ hp: 990, grass: true, items: ["BIG_EATER_BELT"] }), noGrass: shoreUp({ hp: 990 }), fullHp: shoreUp({ hp: 1000, grass: true })
  },
  solarBeam: {
    cellsDiagonal: lineCells([0, 0], [2, 2]), cellsKnight: lineCells([0, 0], [2, 1]), cellsRow: lineCells([0, 0], [3, 0]), cellsFromMiddle: lineCells([2, 2], [3, 2]),
    plain: solarBeam({ enemies: [{ name: "e11", x: 1, y: 1 }, { name: "e22", x: 2, y: 2 }, { name: "side10", x: 1, y: 0 }, { name: "side01", x: 0, y: 1 }, { name: "far55", x: 5, y: 5 }], allies: [{ name: "a33", x: 3, y: 3 }], target: "e22" }),
    zenith: solarBeam({ weather: "ZENITH", enemies: [{ name: "e11", x: 1, y: 1 }], target: "e11" }), light: solarBeam({ light: true, stars: 2, enemies: [{ name: "e11", x: 1, y: 1 }], target: "e11" }), apCrit: solarBeam({ ap: 100, crit: true, enemies: [{ name: "e11", x: 1, y: 1 }], target: "e11" }),
    noEnemyBeyond: solarBeam({ weather: "ZENITH", enemies: [{ name: "e11", x: 1, y: 1 }], target: "e11", pp: 0 }),
    pp: { zenith: solarBeam({ weather: "ZENITH", pp: 30, enemies: [{ name: "e11", x: 1, y: 1 }], target: "e11" }).pp, fatigue: solarBeam({ weather: "ZENITH", pp: 30, casterStatus: { fatigue: true }, enemies: [{ name: "e11", x: 1, y: 1 }], target: "e11" }).pp, silence: solarBeam({ weather: "ZENITH", pp: 30, casterStatus: { silence: true }, enemies: [{ name: "e11", x: 1, y: 1 }], target: "e11" }).pp, protect: solarBeam({ weather: "ZENITH", pp: 30, casterStatus: { protect: true }, enemies: [{ name: "e11", x: 1, y: 1 }], target: "e11" }).pp, noPpGain: solarBeam({ weather: "ZENITH", pp: 30, casterEffects: ["NO_PP_GAIN"], enemies: [{ name: "e11", x: 1, y: 1 }], target: "e11" }).pp, resurrecting: solarBeam({ weather: "ZENITH", pp: 30, casterStatus: { resurrecting: true }, enemies: [{ name: "e11", x: 1, y: 1 }], target: "e11" }).pp, afterSpendNeverNearClamp: solarBeam({ weather: "ZENITH", pp: 199, enemies: [{ name: "e11", x: 1, y: 1 }], target: "e11" }).pp, noLightNoZenith: solarBeam({ pp: 30, enemies: [{ name: "e11", x: 1, y: 1 }], target: "e11" }).pp },
    burnTick: { none: burnTick({}), drought: burnTick({ weather: "DROUGHT" }), droughtOneRock: burnTick({ weather: "DROUGHT", heatRocks: 1 }), droughtTwoRocks: burnTick({ weather: "DROUGHT", heatRocks: 2 }), rainWithRocks: burnTick({ weather: "RAIN", heatRocks: 2 }), rain: burnTick({ weather: "RAIN" }), vest: burnTick({ items: ["ASSAULT_VEST"] }), swiftSwim: burnTick({ effects: ["SWIFT_SWIM"] }), hydration: burnTick({ effects: ["HYDRATION"] }), waterVeil: burnTick({ effects: ["WATER_VEIL"] }), wellBaked: burnTick({ passive: "WELL_BAKED" }), magmarizer: burnTick({ items: ["MAGMARIZER"] }), cookingPot: burnTick({ items: ["COOKING_POT"] }) }
  },
  splash: { plain: splash({}), withTarget: splash({ withTarget: true }), cannotCast: splash({ canCast: false }), lowPp: splash({ pp: 60 }) },
  superFang: {
    star1: superFang({}), ap100: superFang({ ap: 100 }), star2: superFang({ stars: 2 }), oddMax: superFang({ ap: 50, targetMax: 1234 }), lowCurrent: superFang({ targetHp: 100 }), shield: superFang({ shield: 150 }), protect: superFang({ protect: true }), crit: superFang({ crit: true }), dd: superFang({ doubleDamage: true }), fallback: superFang({ stars: 5 }), star3: superFang({ stars: 3 })
  },
  tailwind: {
    star1: tailwind({ allies: [{ name: "caster" }, { name: "ally" }], enemies: [{ name: "foe" }] }), star2: tailwind({ stars: 2, allies: [{ name: "caster" }, { name: "ally" }] }),
    belt: tailwind({ allies: [{ name: "caster" }, { name: "belt", items: ["BIG_EATER_BELT"] }] }), beltStar2: tailwind({ stars: 2, allies: [{ name: "caster" }, { name: "belt", items: ["BIG_EATER_BELT"] }] }),
    ap50: tailwind({ ap: 50, allies: [{ name: "caster" }, { name: "ally" }] }), ap100: tailwind({ ap: 100, allies: [{ name: "caster" }, { name: "ally" }] }), crit: tailwind({ crit: true, allies: [{ name: "caster" }, { name: "ally" }] }), apCritBelt: tailwind({ ap: 50, crit: true, allies: [{ name: "caster" }, { name: "belt", items: ["BIG_EATER_BELT"] }] }),
    clampHigh: tailwind({ stars: 2, allies: [{ name: "caster" }, { name: "fast", speed: 295 }] }),
    melmetal: tailwind({ allies: [{ name: "caster" }, { name: "mel", passive: "MELMETAL" }] }), melmetalStar2: tailwind({ stars: 2, allies: [{ name: "caster" }, { name: "mel", passive: "MELMETAL" }] }),
    melmetalBelt: tailwind({ allies: [{ name: "caster" }, { name: "mel", passive: "MELMETAL", items: ["BIG_EATER_BELT"] }] }), melmetalBeltStar2: tailwind({ stars: 2, allies: [{ name: "caster" }, { name: "mel", passive: "MELMETAL", items: ["BIG_EATER_BELT"] }] }), melmetalApCrit: tailwind({ ap: 100, crit: true, stars: 2, allies: [{ name: "caster" }, { name: "mel", passive: "MELMETAL" }] })
  }
}
const C3 = out.CATCHUP_C3

const C3SU = C3.shoreUp
const su = (v) => ({ requests: v.heals.map((h) => [h.request, h.apBoost, h.crit]), returned: v.heals[0].returned, hp: v.hp, maxHP: v.maxHP, shield: v.shield, downstream: v.downstream.map((d) => [d.helper, d.request, d.apBoost, d.crit]) })
expect("CATCHUP_C3 SHORE_UP (real strategy, real handleHeal / addShield / addMaxHP on a stand-in caster, maxHP 1000, hp 500): the request is healFactor x maxHP through handleHeal(self, apBoost 1, crit): 1 star 200, 2 stars 250, the fallback (5 stars) 800; SANDSTORM adds 0.1 to the FRACTION before the multiplication (1 star: 0.2 + 0.1 = 0.30000000000000004 -> request 300.00000000000006, rounded to 300 inside handleHeal; 2 stars 350); AP 100 and a cast crit each double the applied heal (request stays 200, applied 400); ZENITH x1.2 (240), burn x0.5 (100), protect blocks (0) while Rune Protect alone does not (200)", [C3SU.star1.heals[0].request, C3SU.star2.heals[0].request, C3SU.fallback.heals[0].request, C3SU.sand1.heals[0].request, C3SU.sand1.hp, C3SU.sand2.heals[0].request, C3SU.ap100.heals[0].returned.healReceived, C3SU.crit.heals[0].returned.healReceived, C3SU.zenith.heals[0].returned.healReceived, C3SU.burn.heals[0].returned.healReceived, C3SU.protect.heals[0].returned.healReceived, C3SU.runeProtect.heals[0].returned.healReceived], [200, 250, 800, 300.00000000000006, 800, 350, 400, 400, 240, 100, 0, 200])
expect("CATCHUP_C3 SHORE_UP wound branch comes BEFORE the alive / protect guard (BLOODMOON weather, BLOOD_STONE owner): a wounded caster heals 0 but requests addShield(round(0.3 x stones x the RAW request), apBoost 1, the cast crit) - the shield helper then applies AP, crit, enraged x0.5 and the alive check itself: 1 stone -> request 60, final shield 60 (AP 100 or a crit -> 120, enraged -> 30, Big Eater Belt on the caster -> 75 because the Belt multiplies the requested value first); Protect does not stop it (2 stones, wound + protect -> request 120, shield 120); a caster at hp 0 still makes the request (60) but the shield stays 0; without BLOODMOON weather there is no request", [su(C3SU.woundMoon), C3SU.woundMoonAp.shield, C3SU.woundMoonCrit.shield, C3SU.woundMoonEnraged.shield, C3SU.woundMoonBelt.shield, su(C3SU.woundMoonProtect).downstream, C3SU.woundMoonProtect.shield, su(C3SU.woundMoonDead).downstream, C3SU.woundMoonDead.shield, C3SU.woundNoMoon.downstream.length], [{ requests: [[200, 1, false]], returned: { healReceived: 0, overheal: 0 }, hp: 500, maxHP: 1000, shield: 60, downstream: [["addShield", 60, 1, false]] }, 120, 120, 30, 75, [["addShield", 120, 1, false]], 120, [["addShield", 60, 1, false]], 0, 0])
expect("CATCHUP_C3 SHORE_UP Grass overheal (hp 990, maxHP 1000): the heal is rounded first, the excess requests addMaxHP(0.4 x overheal, self, apBoost 0, crit false, not permanent): request 76 for overheal 190 (maxHP 1076, hp 1076); AP 100 doubles the heal and so the overheal (390 -> request 156, maxHP 1156); a Big Eater Belt turns the request into 95 inside addMaxHP (maxHP 1095); without the GRASS synergy effect there is no request; a caster at full HP converts the whole heal into overheal (request 80)", [su(C3SU.grass), C3SU.grassAp.downstream.map((d) => [d.request, d.apBoost, d.crit]), C3SU.grassAp.maxHP, C3SU.grassBelt.maxHP, C3SU.noGrass.downstream.length, C3SU.fullHp.downstream.map((d) => d.request)], [{ requests: [[200, 1, false]], returned: { healReceived: 10, overheal: 190 }, hp: 1076, maxHP: 1076, shield: 0, downstream: [["addMaxHP", 76, 0, false]] }, [[156, 0, false]], 1156, 1095, 0, [80]])
const C3SB = C3.solarBeam
expect("CATCHUP_C3 SOLAR_BEAM line cells (real effectInLine / getCellsBetween on an 8-column x 6-row stand-in board; the end point is the rounded point 12 cells away along the angle): from (0,0) toward (2,2) the walk takes DIAGONAL steps and visits only (0,0), (1,1), (2,2), (3,3), (4,4), (5,5) - the side cells (1,0) and (0,1) are NOT visited; an oblique line toward (2,1) visits (0,0), (1,0), (1,1), (2,1), (3,1), (3,2), (4,2), (5,2), (6,3), (7,3) (off-board cells skipped); the caster's own cell is the first cell and holds an ally, so it is never hit; a row line visits the row to the edge", [C3SB.cellsDiagonal, C3SB.cellsKnight, C3SB.cellsRow, C3SB.cellsFromMiddle], [["0,0", "1,1", "2,2", "3,3", "4,4", "5,5"], ["0,0", "1,0", "1,1", "2,1", "3,1", "3,2", "4,2", "5,2", "6,3", "7,3"], ["0,0", "1,0", "2,0", "3,0", "4,0", "5,0", "6,0", "7,0"], ["2,2", "3,2", "4,2", "5,2", "6,2", "7,2"]])
expect("CATCHUP_C3 SOLAR_BEAM (real strategy, stand-in units): per enemy on the line the burn request (3000 ms, origin the caster) comes BEFORE its SPECIAL damage request (raw 25 for 1 star, apBoost default, crit flag passed through); units off the line (side cells) and allies on the line are not touched; ZENITH weather or the light status multiplies the raw request by 1.3 UNROUNDED (25 -> 32.5, 2 stars 50 -> 65) and requests addPP(20, apBoost 0, crit false) BEFORE the first line effect; AP and a crit are not applied by the strategy (the request stays 25, crit true is only passed on)", [C3SB.plain.order, C3SB.zenith.order, C3SB.light.order[1], C3SB.light.order[2], C3SB.apCrit.order], [[["burn", "e11", 3000, true], ["damage", "e11", 25, "SPECIAL", false, null], ["burn", "e22", 3000, true], ["damage", "e22", 25, "SPECIAL", false, null], ["burn", "far55", 3000, true], ["damage", "far55", 25, "SPECIAL", false, null]], [["addPP", 20, 0, false], ["burn", "e11", 3000, true], ["damage", "e11", 32.5, "SPECIAL", false, null]], ["burn", "e11", 3000, true], ["damage", "e11", 65, "SPECIAL", false, null], [["burn", "e11", 3000, true], ["damage", "e11", 25, "SPECIAL", true, null]]])
expect("CATCHUP_C3 SOLAR_BEAM conditional PP request (real addPP; PP 30 before the cast, maxPP 100: the base spend already set PP to 0): ZENITH -> 20; fatigue halves the positive request (10); silence, protect, NO_PP_GAIN and resurrecting each refuse it (0); without ZENITH or light no request is made (0); the base spend comes first, so the clamp never matters (PP 199 -> 119)", [C3SB.pp.zenith, C3SB.pp.fatigue, C3SB.pp.silence, C3SB.pp.protect, C3SB.pp.noPpGain, C3SB.pp.resurrecting, C3SB.pp.noLightNoZenith, C3SB.pp.afterSpendNeverNearClamp], [20, 10, 0, 0, 0, 0, 0, 119])
expect("CATCHUP_C3 SOLAR_BEAM burn tick (real Status.updateBurn, maxHP 1000): 5 % of max HP as TRUE damage = 50; weather is not always a reduction: DROUGHT x1.3 = 65, and Heat Rocks reduce only inside DROUGHT (1 rock x0.8 -> 52, 2 rocks x0.6 -> 39) while RAIN x0.7 = 35 with the rocks having no effect; Assault Vest x0.5 = 25; SWIFT_SWIM x0.7 (35), HYDRATION x0.5 (25), WATER_VEIL x0.3 (15); WELL_BAKED and MAGMARIZER zero the damage (no call); a COOKING_POT holder gains addSpeed(10) per tick", [C3SB.burnTick.none, C3SB.burnTick.drought, C3SB.burnTick.droughtOneRock, C3SB.burnTick.droughtTwoRocks, C3SB.burnTick.rainWithRocks, C3SB.burnTick.vest, C3SB.burnTick.swiftSwim, C3SB.burnTick.hydration, C3SB.burnTick.waterVeil, C3SB.burnTick.wellBaked, C3SB.burnTick.magmarizer, C3SB.burnTick.cookingPot], [[["damage", 50, "TRUE"]], [["damage", 65, "TRUE"]], [["damage", 52, "TRUE"]], [["damage", 39, "TRUE"]], [["damage", 35, "TRUE"]], [["damage", 25, "TRUE"]], [["damage", 35, "TRUE"]], [["damage", 25, "TRUE"]], [["damage", 15, "TRUE"]], [], [], [["addSpeed", 10], ["damage", 50, "TRUE"]]])
const C3SP = C3.splash
expect("CATCHUP_C3 SPLASH (real strategy on the real AbilityStrategy base inside the real castAbility text; caster pp 120, maxPP 100): the strategy itself changes nothing, but the cast is not a no-op: the base process spends maxPP (PP 120 -> 20; PP 60 -> 0), counts the cast (count.ult 1), broadcasts the default animation (-1, -1 without a target, the target's cell with one), records the skill in the team's cast list, and the OnAbilityCastEffect hooks still run afterwards (once, with a null target and crit false); HP, shield, ATK, speed, AP and status stay untouched; a caster whose canCast is false returns before anything (PP 120, no hook, no count)", [C3SP.plain, C3SP.withTarget.calls, C3SP.lowPp.ppAfter, C3SP.cannotCast], [{ calls: [["broadcast", -1, -1], ["hook", "null target", false]], ppAfter: 20, countUlt: 1, castList: ["SPLASH"], unchanged: true }, [["broadcast", 4, 2], ["hook", "target", false]], 0, { calls: [], ppAfter: 120, countUlt: 0, castList: [], unchanged: true }])
const C3SF = C3.superFang
const sf1 = (v) => [v.seen[0].raw, v.seen[0].type, v.seen[0].apBoostParam, v.seen[0].returned, v.hp]
expect("CATCHUP_C3 SUPER_FANG (real strategy, real handleSpecialDamage / handleDamage, target maxHP 1000): the request is ceil(fraction x target.maxHP x (2 + AP/100)) with apBoost false downstream and type TRUE: 1 star AP 0 -> 200 (twice 10 %), AP 100 -> 300 (three times), 2 stars AP 0 -> 300, maxHP 1234 with AP 50 -> ceil(308.5) = 309; the fallback (5 stars) 700 and 3 stars 500 use the other table entries; the base is the target's MAX HP (current HP 100 -> still a request of 200, returned 100); a shield absorbs first (150 shield: HP 1000 -> 950); protect blocks (returned 0); a crit multiplies by the critPower (400) and DOUBLE_DAMAGE doubles the downstream amount (400) while the strategy's request stays 200", [sf1(C3SF.star1), sf1(C3SF.ap100), sf1(C3SF.star2), sf1(C3SF.oddMax), C3SF.fallback.seen[0].raw, C3SF.star3.seen[0].raw, sf1(C3SF.lowCurrent), C3SF.shield.hp, C3SF.protect.seen[0].returned, [C3SF.crit.seen[0].raw, C3SF.crit.seen[0].returned], [C3SF.dd.seen[0].raw, C3SF.dd.seen[0].returned]], [[200, "TRUE", false, 200, 800], [300, "TRUE", false, 300, 700], [300, "TRUE", false, 300, 700], [309, "TRUE", false, 309, 691], 700, 500, [200, "TRUE", false, 100, 0], 950, 0, [200, 400], [200, 400]])
const C3TW = C3.tailwind
expect("CATCHUP_C3 TAILWIND (real strategy, real addSpeed / addAttack and the Belt helper; ally speed 50, ATK 20): every ally including the caster gains speed 5 (1 star) / 10 (2 stars) and enemies are untouched; a Big Eater Belt holder gets the value x1.25 rounded down first (5 -> 6, 10 -> 12); AP 100 or a crit doubles it and the speed is NOT rounded by the adder (AP 50: 5 x 1.5 = 7.5 -> speed 57.5); speed clamps at 300 (295 + 10 -> 300)", [C3TW.star1, C3TW.star2.ally.speed, C3TW.ap50.ally.speed, C3TW.belt.belt.speed, C3TW.beltStar2.belt.speed, C3TW.ap100.ally.speed, C3TW.crit.ally.speed, C3TW.apCritBelt.belt.speed, C3TW.clampHigh.fast.speed], [{ caster: { speed: 55, atk: 20 }, ally: { speed: 55, atk: 20 }, foe: { speed: 50, atk: 20 } }, 60, 57.5, 56, 62, 60, 60, 68, 300])
expect("CATCHUP_C3 TAILWIND MELMETAL delegation (real addSpeed -> addAttack): the Belt and Twist helpers run inside addSpeed on the raw value (5 -> 6 with a Belt), half of that goes to addAttack(value x 0.5, caster, apBoost 1, crit), which applies the caster's AP and crit and ROUNDS (Math.round), then runs the Belt and Twist helpers again: AP 0, no crit, no Belt: 1 star 5 -> 2.5 -> 3 ATK (23), 2 stars 10 -> 5 (25); with a Belt 1 star 5 -> 6 -> 3 -> 3 (23), 2 stars 10 -> 12 -> 6 -> 7 (27); AP 100 with a crit at 2 stars: 5 x 2 x 2 = 20 (ATK 40); the speed of the MELMETAL ally never changes (50)", [C3TW.melmetal.mel, C3TW.melmetalStar2.mel, C3TW.melmetalBelt.mel, C3TW.melmetalBeltStar2.mel, C3TW.melmetalApCrit.mel], [{ speed: 50, atk: 23 }, { speed: 50, atk: 25 }, { speed: 50, atk: 23 }, { speed: 50, atk: 27 }, { speed: 50, atk: 40 }])
// 32. CATCHUP_C4 (catch-up cycle 4): the real TAIL_WHIP / TICKLE / TOXIC / WATERFALL / YAWN strategy text with the real addDefense / addAttack / addAbilityPower / addShield / resetCooldown,
// Board.getClosestEnemies / clearBoardEffect, Status.triggerPoison / updatePoison / triggerFatigue / clearNegativeStatus and the Belt / Twist helpers, run against STAND-IN units and boards.
// Requests = arguments received; returns = what a helper hands back; final = stored fields. Not a fight.
const AB4 = "app/core/abilities/"
const StatEntSrc = `${helpers}\nclass SE {\n${js(`class _ {\n${[cut(PE, 319, 321, "resetCooldown("), cut(PE, 621, 647, "addAbilityPower("), cut(PE, 674, 698, "addDefense("), cut(PE, 726, 750, "addAttack(")].join("\n")}\n}`).replace(/^class _ \{\n/, "").replace(/\n\}\s*$/, "")}\n}`
const SE = build({ Item: enums(), min, max, clamp, roundToNDigits }, StatEntSrc, "SE")
const mkSE = (name, team, x, y, o = {}) => Object.assign(new SE(), { name, team, positionX: x, positionY: y, hp: o.hp ?? 100, maxHP: 100, items: new Set(o.items ?? []), effects: new Set(o.effects ?? []), ap: o.ap ?? 0, critPower: 2, atk: o.atk ?? 20, def: o.def ?? 10, speDef: 10, speed: o.speed ?? 50, stars: o.stars ?? 1, id: name, skill: "X", pp: 0, maxPP: 100, count: { ult: 0 }, broadcastAbility() {}, isGhostOpponent: true, passive: "NONE", targetEntityId: o.targetEntityId ?? "", status: {}, simulation: { blueAbilitiesCast: [], redAbilitiesCast: [] } })
// ---- TAIL_WHIP: share of the CURRENT DEF, real addDefense
const TailWhipX = stratReal(`${AB4}tail-whip.ts`, "TailWhipStrategy")
const tailWhip = ({ stars = 1, ap = 0, crit = false, def = 10, items = [], casts = 1 }) => {
  const c = mkSE("caster", BLUE_Z, 0, 0, { stars, ap }), t = mkSE("target", RED_Z, 1, 0, { def, items }); const seq = []
  const real = t.addDefense.bind(t); t.addDefense = (...a) => { seq.push(a[0]); return real(...a) }
  for (let i = 0; i < casts; i++) new TailWhipX().process(c, {}, t, crit)
  return { requests: seq, def: t.def }
}
// ---- TICKLE / TOXIC share getClosestEnemies: real text on a stand-in board (cells array row-major, 8 columns x 6 rows)
const getClosestEnemiesX = build({ distanceC }, js(`class G {\n${cut(BD, 792, 807, "getClosestEnemies(")}\n}`), "G").prototype.getClosestEnemies
const mkBoard4 = (units) => { const b = { cells: new Array(48).fill(undefined), columns: 8 }; b.getClosestEnemies = getClosestEnemiesX.bind(b); for (const u of units) b.cells[8 * u.positionY + u.positionX] = u; return b }
const TickleX = stratReal(`${AB4}tickle.ts`, "TickleStrategy")
const tickle = ({ stars = 1, ap = 0, crit = false, enemies, caster = [3, 3], castTargetTeam = RED_Z, extraUnits = [], targetName }) => {
  const c = mkSE("caster", BLUE_Z, caster[0], caster[1], { stars, ap })
  const es = enemies.map((e) => mkSE(e.name, e.team ?? RED_Z, e.x, e.y, e)); const others = extraUnits.map((e) => mkSE(e.name, e.team, e.x, e.y, e))
  const b = mkBoard4([c, ...es, ...others])
  const target = [...es, ...others, c].find((u) => u.name === (targetName ?? es[0].name))
  new TickleX().process(c, b, target, crit)
  return Object.fromEntries([...es, ...others, c].map((u) => [u.name, [u.atk, u.def]]))
}
// ---- TOXIC: real strategy, real triggerPoison / applyStatusDurationReductions / updatePoison
const PoisonSrc = `class PX {\n${cut(ST, 572, 615, "triggerPoison(")}\n${cut(ST, 617, 688, "updatePoison(")}\n${cut(ST, 1282, 1305, "private applyStatusDurationReductions(").replace("private ", "")}\n}`
const PX = build({ Passive: enums(), Weather: enums(), Item: enums(), EffectEnum: enums(), AttackType: enums(), min, max, count }, js(PoisonSrc), "PX")
const mkPoisonUnit = (name, team, x, y, o = {}) => {
  const u = mkSE(name, team, x, y, o); u.passive = o.passive ?? "NONE"; u.player = o.player ?? null; u.hp = 500; u.maxHP = 1000; u.log = []
  u.simulation = { ...u.simulation, weather: o.weather ?? "NONE" }
  u.status = Object.assign(new PX(), { runeProtect: !!o.runeProtect, poisonStacks: o.stacks ?? 0, poisonCooldown: o.poisonCooldown ?? 0, poisonDamageCooldown: 0, poisonOrigin: null, burn: false })
  u.eatBerry = (b) => { u.log.push(["eatBerry", b]); u.status.poisonStacks = 0 }
  u.handleHeal = (...a) => u.log.push(["heal", a[0]]); u.handleDamage = (o2) => u.log.push(["damage", o2.damage, o2.attackType])
  return u
}
const ToxicX = stratReal(`${AB4}toxic.ts`, "ToxicStrategy")
const toxic = ({ stars = 1, ap = 0, crit = false, enemies, effects = [], caster = [3, 3] }) => {
  const c = mkSE("caster", BLUE_Z, caster[0], caster[1], { stars, ap, effects })
  const es = enemies.map((e) => mkPoisonUnit(e.name, RED_Z, e.x, e.y, e)); const calls = []
  for (const e of es) { const real = e.status.triggerPoison.bind(e.status); e.status.triggerPoison = (d, p, o) => { calls.push([e.name, d, o === c]); return real(d, p, o) } }
  const b = mkBoard4([c, ...es]); new ToxicX().process(c, b, es[0], crit)
  return { calls, state: Object.fromEntries(es.map((e) => [e.name, { stacks: e.status.poisonStacks, cooldown: e.status.poisonCooldown, atk: e.atk, effects: [...e.effects], log: e.log, immune: e.effects.has("IMMUNITY_POISON") }])) }
}
const poisonTick = ({ stacks = 1, weather = "NONE", items = [], effects = [], passive = "NONE", maxHP = 1000 }) => {
  const u = mkPoisonUnit("v", RED_Z, 0, 0, { passive, weather, items, effects, stacks }); u.maxHP = maxHP; u.status.poisonCooldown = 5000; u.status.poisonOrigin = "O"
  u.status.updatePoison(1000, u, {})
  return u.log
}
// ---- WATERFALL: shield -> clearNegativeStatus -> clearBoardEffect on the own cell
const ClearSrc = `class CW {\n${cut(ST, 122, 146, "clearNegativeStatus(")}\n}`
const CW = build({}, js(ClearSrc), "CW")
const clearBoardX = build({ Transfer: enums(), logger: { debug() {} } }, js(`class B {\n${cut(BD, 656, 692, "clearBoardEffect(")}\n}`), "B").prototype.clearBoardEffect
const WaterfallX = stratReal(`${AB4}waterfall.ts`, "WaterfallStrategy")
const waterfall = ({ stars = 1, ap = 0, crit = false, hp = 500, status = {}, items = [], cellEffects = [], otherCellEffects = [], entityEffects = [], enraged = false, possessedFlag = false }) => {
  const u = mkHU({ hp, maxHP: 1000, items, status: { enraged }, name: "caster" })
  Object.assign(u, { stars, ap, count: { ult: 0 }, broadcastAbility() {}, team: BLUE_Z, skill: "WATERFALL", positionX: 2, positionY: 1, effects: new Set([...entityEffects, ...cellEffects]) })
  u.simulation = { ...u.simulation, blueAbilitiesCast: [], redAbilitiesCast: [], id: "s", room: { broadcast() {}, state: { time: 1 } } }
  u.status = Object.assign(new CW(), { protect: false, runeProtect: false, silence: false, fatigue: false, resurrecting: false, tree: false, wound: false, burn: true, enraged, woundCooldown: 0, burnCooldown: 4000, silenceCooldown: 4000, fatigueCooldown: 4000, poisonCooldown: 4000, freezeCooldown: 4000, sleepCooldown: 4000, confusionCooldown: 4000, paralysisCooldown: 4000, charmCooldown: 4000, flinchCooldown: 4000, armorReductionCooldown: 4000, lockedCooldown: 4000, blindCooldown: 4000, curse: true, curseCooldown: 3000, possessed: possessedFlag, possessedCooldown: 5000, poison: true, poisonStacks: 3, paralysis: true, ...status })
  const board = { columns: 8, boardEffects: Array.from({ length: 48 }, () => new Set()), getEntityOnCell: (x, y) => (x === 2 && y === 1 ? u : undefined) }
  board.boardEffects[8 * 1 + 2] = new Set(cellEffects); board.boardEffects[8 * 1 + 3] = new Set(otherCellEffects)
  board.clearBoardEffect = clearBoardX.bind(board)
  const order = []
  for (const [obj, m, label] of [[u, "addShield", "shield"], [u.status, "clearNegativeStatus", "clearNegativeStatus"], [board, "clearBoardEffect", "clearBoardEffect"]]) { const real = obj[m].bind(obj); obj[m] = (...a) => { order.push(label); return real(...a) } }
  new WaterfallX().process(u, board, null, crit)
  const s = u.status
  return { order, shield: u.shield, hp: u.hp, cooldowns: [s.burnCooldown, s.silenceCooldown, s.fatigueCooldown, s.poisonCooldown, s.freezeCooldown, s.sleepCooldown, s.confusionCooldown, s.woundCooldown, s.paralysisCooldown, s.charmCooldown, s.flinchCooldown, s.armorReductionCooldown, s.lockedCooldown, s.blindCooldown], curse: s.curse, curseCooldown: s.curseCooldown, possessedCooldown: s.possessedCooldown, flagsStillSet: { burn: s.burn, poison: s.poison, paralysis: s.paralysis, poisonStacks: s.poisonStacks }, cellEffects: [...board.boardEffects[8 * 1 + 2]], otherCellEffects: [...board.boardEffects[8 * 1 + 3]], entityEffects: [...u.effects] }
}
// ---- YAWN: opponents targeting the caster, fatigue then AP change, shield, cooldown reset
const FatigueSrc = `class FX {\n${cut(ST, 547, 562, "triggerFatigue(")}\n${cut(ST, 1282, 1305, "private applyStatusDurationReductions(").replace("private ", "")}\n}`
const FX = build({ Passive: enums(), Weather: enums(), Item: enums(), EffectEnum: enums(), count }, js(FatigueSrc), "FX")
const YawnX = stratReal(`${AB4}yawn.ts`, "YawnStrategy")
const mkOpp = (name, o = {}) => {
  const u = mkSE(name, RED_Z, 4, 3, o); u.ap = o.oppAp ?? 0; u.status = Object.assign(new FX(), { runeProtect: !!o.runeProtect, fatigue: false, fatigueCooldown: o.fatigueCooldown ?? 0 }); u.player = o.player ?? null; u.targetEntityId = o.target === false ? "someone else" : "caster"
  return u
}
const yawn = ({ stars = 1, ap = 0, crit = false, speed = 35, opps, enraged = false, items = [], paralysed = false }) => {
  const c = mkHU({ hp: 500, maxHP: 1000, items, status: { enraged }, name: "caster" })
  Object.assign(c, { stars, ap, count: { ult: 0 }, broadcastAbility() {}, team: BLUE_Z, skill: "YAWN", id: "caster", speed, cooldown: 777, resetCooldown: SE.prototype.resetCooldown, effects: new Set() })
  c.simulation = { ...c.simulation, blueAbilitiesCast: [], redAbilitiesCast: [] }
  const os = opps.map((o) => mkOpp(o.name, o)); const order = []
  for (const o of os) { const f = o.status.triggerFatigue.bind(o.status), g = o.addAbilityPower.bind(o); o.status.triggerFatigue = (...a) => { order.push([o.name, "fatigue", a[0]]); return f(...a) }; o.addAbilityPower = (...a) => { order.push([o.name, "ap", a[0], a[2], a[3]]); return g(...a) } }
  const bd = { cells: [c, ...os] }
  new YawnX().process(c, bd, null, crit)
  return { order, opps: Object.fromEntries(os.map((o) => [o.name, { ap: o.ap, atk: o.atk, fatigue: o.status.fatigue, fatigueCooldown: o.status.fatigueCooldown }])), shield: c.shield, cooldown: c.cooldown, speed: c.speed, pp: c.pp }
}
out.CATCHUP_C4 = {
  tailWhip: { star1: tailWhip({}), star2: tailWhip({ stars: 2 }), half: tailWhip({ stars: 2, def: 5 }), tiny: tailWhip({ def: 2 }), tinyAp: tailWhip({ def: 2, ap: 100 }), ap100: tailWhip({ ap: 100 }), crit: tailWhip({ crit: true }), twist: tailWhip({ items: ["TWIST_BAND"] }), belt: tailWhip({ items: ["BIG_EATER_BELT"] }), repeat: tailWhip({ def: 100, casts: 3 }), repeatTwist: tailWhip({ def: 100, casts: 2, items: ["TWIST_BAND"] }), floor: tailWhip({ stars: 5, ap: 300, def: 10 }), fallback: tailWhip({ stars: 5, def: 10 }) },
  tickle: {
    star1: tickle({ enemies: [{ name: "far", x: 7, y: 5 }, { name: "near", x: 4, y: 3 }, { name: "mid", x: 5, y: 3 }] }),
    star2: tickle({ stars: 2, enemies: [{ name: "far", x: 7, y: 5 }, { name: "near", x: 4, y: 3 }, { name: "mid", x: 5, y: 3 }] }),
    star5: tickle({ stars: 5, enemies: [1, 2, 3, 4, 5, 6].map((i) => ({ name: `e${i}`, x: i, y: 0 })) }),
    ties: tickle({ stars: 2, enemies: [{ name: "right", x: 4, y: 3 }, { name: "below", x: 3, y: 4 }, { name: "above", x: 3, y: 2 }, { name: "left", x: 2, y: 3 }] }),
    chebyshev: tickle({ stars: 2, enemies: [{ name: "diag2", x: 5, y: 5 }, { name: "line3", x: 6, y: 3 }, { name: "knight", x: 5, y: 4 }] }),
    dead: tickle({ enemies: [{ name: "deadNear", x: 4, y: 3, hp: 0 }, { name: "aliveFar", x: 7, y: 3 }] }),
    allyIgnored: tickle({ stars: 2, enemies: [{ name: "e1", x: 6, y: 3 }], extraUnits: [{ name: "allyNear", team: BLUE_Z, x: 4, y: 3 }] }),
    targetNotNearest: tickle({ enemies: [{ name: "castTarget", x: 7, y: 5 }, { name: "nearest", x: 4, y: 3 }], targetName: "castTarget" }),
    sameTeamTarget: tickle({ stars: 1, enemies: [{ name: "enemy", x: 4, y: 3 }], extraUnits: [{ name: "allyTarget", team: BLUE_Z, x: 5, y: 3 }], targetName: "allyTarget" }),
    ap100: tickle({ ap: 100, enemies: [{ name: "e", x: 4, y: 3 }] }), crit: tickle({ crit: true, enemies: [{ name: "e", x: 4, y: 3 }] }), floors: tickle({ enemies: [{ name: "e", x: 4, y: 3, atk: 2, def: 1 }] }), twist: tickle({ enemies: [{ name: "e", x: 4, y: 3, items: ["TWIST_BAND"] }] }), belt: tickle({ enemies: [{ name: "e", x: 4, y: 3, items: ["BIG_EATER_BELT"] }] })
  },
  toxic: {
    star1: toxic({ enemies: [{ name: "a", x: 4, y: 3 }, { name: "b", x: 5, y: 3 }] }), star2: toxic({ stars: 2, enemies: [{ name: "a", x: 4, y: 3 }, { name: "b", x: 5, y: 3 }, { name: "c", x: 6, y: 3 }] }),
    ap100: toxic({ ap: 100, enemies: [{ name: "a", x: 4, y: 3 }] }), crit: toxic({ crit: true, enemies: [{ name: "a", x: 4, y: 3 }] }), apCrit: toxic({ ap: 100, crit: true, stars: 2, enemies: [{ name: "a", x: 4, y: 3 }] }),
    stackCap: toxic({ enemies: [{ name: "a", x: 4, y: 3, stacks: 3 }] }), venomous: toxic({ effects: ["VENOMOUS"], enemies: [{ name: "a", x: 4, y: 3, stacks: 3 }] }), toxicEffect: toxic({ effects: ["TOXIC"], enemies: [{ name: "a", x: 4, y: 3, stacks: 4 }, { name: "x", x: 5, y: 3, stacks: 0 }], stars: 2 }),
    keepsLonger: toxic({ enemies: [{ name: "a", x: 4, y: 3, poisonCooldown: 9000, stacks: 1 }] }), hydration: toxic({ enemies: [{ name: "a", x: 4, y: 3, effects: ["HYDRATION"] }] }), immune: toxic({ enemies: [{ name: "a", x: 4, y: 3, effects: ["IMMUNITY_POISON"] }] }), rune: toxic({ enemies: [{ name: "a", x: 4, y: 3, runeProtect: true }] }),
    guts: toxic({ enemies: [{ name: "a", x: 4, y: 3, passive: "GUTS" }] }), toxicBoost: toxic({ enemies: [{ name: "a", x: 4, y: 3, passive: "TOXIC_BOOST" }] }), pecha: toxic({ enemies: [{ name: "a", x: 4, y: 3, items: ["PECHA_BERRY"], stacks: 0 }] }),
    tick: { one: poisonTick({}), three: poisonTick({ stacks: 3 }), rain: poisonTick({ weather: "RAIN" }), vest: poisonTick({ items: ["ASSAULT_VEST"] }), toxicBoost: poisonTick({ passive: "TOXIC_BOOST" }), swiftSwim: poisonTick({ effects: ["SWIFT_SWIM"] }), hydration: poisonTick({ effects: ["HYDRATION"] }), waterVeil: poisonTick({ effects: ["WATER_VEIL"] }), gliscor1: poisonTick({ passive: "GLISCOR", stacks: 1 }), gliscor2: poisonTick({ passive: "GLISCOR", stacks: 2 }), gliscor3: poisonTick({ passive: "GLISCOR", stacks: 3 }), tiny: poisonTick({ maxHP: 10 }) }
  },
  waterfall: {
    star1: waterfall({}), star2: waterfall({ stars: 2 }), ap100: waterfall({ ap: 100 }), crit: waterfall({ crit: true }), belt: waterfall({ items: ["BIG_EATER_BELT"] }), enraged: waterfall({ enraged: true }), dead: waterfall({ hp: 0 }),
    cell: waterfall({ cellEffects: ["POISON_GAS", "HEAL_FIELD"], otherCellEffects: ["POISON_GAS"], entityEffects: ["VENOMOUS"] }), possessed: waterfall({ possessedFlag: true }), notPossessed: waterfall({ possessedFlag: false })
  },
  yawn: {
    star1: yawn({ opps: [{ name: "t1" }, { name: "t2" }, { name: "notTargeting", target: false }] }), star2: yawn({ stars: 2, opps: [{ name: "t1" }] }),
    rune: yawn({ opps: [{ name: "r", runeProtect: true }] }), twist: yawn({ opps: [{ name: "w", items: ["TWIST_BAND"] }] }), belt: yawn({ opps: [{ name: "b", items: ["BIG_EATER_BELT"] }] }),
    nullify: yawn({ opps: [{ name: "n", items: ["NULLIFY_BANDANNA"] }] }), nullifyTwist: yawn({ opps: [{ name: "nt", items: ["NULLIFY_BANDANNA", "TWIST_BAND"] }] }), floor: yawn({ opps: [{ name: "f", oppAp: -90 }] }), hydration: yawn({ opps: [{ name: "h", effects: ["HYDRATION"] }] }), longer: yawn({ opps: [{ name: "l", fatigueCooldown: 9000 }] }),
    shieldAp: yawn({ ap: 100, opps: [] }), shieldCrit: yawn({ crit: true, opps: [] }), shieldBelt: yawn({ items: ["BIG_EATER_BELT"], opps: [] }), shieldEnraged: yawn({ enraged: true, opps: [] }), fastCaster: yawn({ speed: 100, opps: [] }), noOpponents: yawn({ opps: [] })
  }
}
const C4 = out.CATCHUP_C4

const C4TW = C4.tailWhip
expect("CATCHUP_C4 TAIL_WHIP (real strategy and real addDefense; target DEF 10 unless stated): the request is -(percent / 100) x the target's CURRENT DEF (1 star 20 % -> -2, 2 stars 30 % -> -3, the fallback 50 % -> -5), handed to addDefense(request, caster, apBoost 1, crit) which scales by AP and crit and then Math.round: 30 % of DEF 5 is -1.5 and Math.round(-1.5) = -1 (DEF 4, not 3); 20 % of DEF 2 is -0.4 which rounds to 0 (no change), while AP 100 makes it -0.8 -> -1 (DEF 1); AP 100 or a crit doubles the rounded loss (DEF 6); a Big Eater Belt on the enemy changes nothing; a Twist Band holder GAINS the same amount (DEF 12); DEF floors at 0 (50 % with AP 300 on DEF 10 -> 0)", [C4TW.star1.requests, C4TW.star1.def, C4TW.star2.requests, C4TW.half.requests, C4TW.half.def, C4TW.tiny.def, C4TW.tinyAp.def, C4TW.ap100.def, C4TW.crit.def, C4TW.belt.def, C4TW.twist.def, C4TW.fallback.requests, C4TW.floor.def], [[-2], 8, [-3], [-1.5], 4, 2, 1, 6, 6, 8, 12, [-5], 0])
expect("CATCHUP_C4 TAIL_WHIP repeated casts (DEF 100, 1 star, three casts): each request is a share of the REMAINING DEF, so the losses shrink - requests -20, -16, -12.8 (rounded to -13) and DEF 100 -> 80 -> 64 -> 51; this holds only without a Twist Band: a Twist Band holder turns each request into a GAIN of the current share, so the DEF grows (100 -> 120 -> 144, requests -20, -24)", [C4TW.repeat.requests, C4TW.repeat.def, C4TW.repeatTwist.requests, C4TW.repeatTwist.def], [[-20, -16, -12.8], 51, [-20, -24], 144])
const C4TK = C4.tickle
const hit = (v) => Object.entries(v).filter(([k, x]) => x[0] !== 20 || x[1] !== 10).map(([k]) => k).sort()
expect("CATCHUP_C4 TICKLE selection (real strategy and real Board.getClosestEnemies on an 8 x 6 stand-in board, caster at (3,3)): the closest LIVING units of the CAST TARGET's team by Chebyshev distance from the CASTER's cell, count 1 / 2 / 3 / 5 by the caster's stars; 1 star hits only the nearest, 2 stars the two nearest, 5 stars five of six; the cast target itself is not hit when another enemy is nearer; allies and dead units (hp 0) are skipped; Chebyshev, not Manhattan: (5,5) and (5,4) [distance 2] are chosen before (6,3) [distance 3]; ties keep the board's row-major order: of four enemies at distance 1 the two first in cell order (above, then left) are hit, not right / below", [hit(C4TK.star1), hit(C4TK.star2), hit(C4TK.star5), hit(C4TK.targetNotNearest), hit(C4TK.allyIgnored), hit(C4TK.dead), hit(C4TK.chebyshev), hit(C4TK.ties)], [["near"], ["mid", "near"], ["e1", "e2", "e3", "e4", "e5"], ["nearest"], ["e1"], ["aliveFar"], ["diag2", "knight"], ["above", "left"]])
expect("CATCHUP_C4 TICKLE amounts (real addAttack / addDefense; enemy ATK 20, DEF 10): ATK -3 and DEF -3 are two separate requests (17 / 7); AP 100 or a crit doubles each rounded request (14 / 4); the floors differ - ATK stops at 1 (ATK 2 -> 1) and DEF at 0 (DEF 1 -> 0); a Twist Band holder gains instead (23 / 13); a Big Eater Belt on the enemy changes nothing; the selection uses target.team, so with a same-team cast target (executed with a stand-in) the nearest unit of THAT team - here the caster itself at distance 0 - is hit instead (the enemy is not): the enemy-team description holds for an ordinary enemy cast target only", [C4TK.star1.near, C4TK.ap100.e, C4TK.crit.e, C4TK.floors.e, C4TK.twist.e, C4TK.belt.e, C4TK.sameTeamTarget.caster, C4TK.sameTeamTarget.enemy], [[17, 7], [14, 4], [14, 4], [1, 0], [23, 13], [17, 7], [17, 7], [20, 10]])
const C4TX = C4.toxic
expect("CATCHUP_C4 TOXIC requests (real strategy; closest enemies as for TICKLE): ONE triggerPoison per selected enemy per cast (1 star 1 enemy, 2 stars 2 of 3), duration = round(flat x (2 + AP/100) x critFactor): 1 star 3000 (double the flat 1500 at AP 0), 2 stars 6000, AP 100 4500, a crit 4500 (the crit factor is HALF-strength: 1 + (critPower - 1) x 0.5 = 1.5), 2 stars with AP 100 and a crit 13500", [C4TX.star1.calls, C4TX.star2.calls.map((c) => c[1]), C4TX.ap100.calls[0][1], C4TX.crit.calls[0][1], C4TX.apCrit.calls[0][1]], [[["a", 3000, true]], [6000, 6000], 4500, 4500, 13500])
expect("CATCHUP_C4 TOXIC inside triggerPoison (real text, stand-in unit): +1 stack per call capped at 3 (VENOMOUS caster 4, caster with the synergy effect EffectEnum.TOXIC 5; a second selected enemy starts at 1); a longer remaining poison timer is kept (9000) while the stack still rises; the enemy's reductions change the STORED duration (HYDRATION 1500); IMMUNITY_POISON or Rune Protect refuses the whole trigger (0 stacks, no timer); GUTS adds ATK +5 once and TOXIC_BOOST +10 once as addAttack requests; a PECHA_BERRY holder requests eatBerry (the berry's own text clears stacks and adds IMMUNITY_POISON: source reading, the stand-in only records the call)", [C4TX.stackCap.state.a.stacks, C4TX.venomous.state.a.stacks, [C4TX.toxicEffect.state.a.stacks, C4TX.toxicEffect.state.x.stacks], [C4TX.keepsLonger.state.a.cooldown, C4TX.keepsLonger.state.a.stacks], C4TX.hydration.state.a.cooldown, [C4TX.immune.state.a.stacks, C4TX.immune.state.a.cooldown], [C4TX.rune.state.a.stacks, C4TX.rune.state.a.cooldown], C4TX.guts.state.a.atk, C4TX.toxicBoost.state.a.atk, C4TX.pecha.state.a.log], [3, 4, [5, 1], [9000, 2], 1500, [0, 0], [0, 0], 25, 30, [["eatBerry", "PECHA_BERRY"]]])
const C4TT = C4TX.tick
expect("CATCHUP_C4 TOXIC poison tick (real Status.updatePoison, maxHP 1000): TRUE damage of round(5 % x max HP x stacks) per tick = 50 per stack (150 at 3 stacks); RAIN x0.7 = 35, Assault Vest x0.5 = 25, TOXIC_BOOST passive x0.5 = 25, SWIFT_SWIM x0.7 = 35, HYDRATION x0.5 = 25, WATER_VEIL x0.3 = 15; a GLISCOR uses stacks - 2: 1 stack HEALS 50 (handleHeal request), 2 stacks nothing, 3 stacks 50 damage; a damage request is at least 1 (maxHP 10 -> 1)", [C4TT.one, C4TT.three, C4TT.rain, C4TT.vest, C4TT.toxicBoost, C4TT.swiftSwim, C4TT.hydration, C4TT.waterVeil, C4TT.gliscor1, C4TT.gliscor2, C4TT.gliscor3, C4TT.tiny], [[["damage", 50, "TRUE"]], [["damage", 150, "TRUE"]], [["damage", 35, "TRUE"]], [["damage", 25, "TRUE"]], [["damage", 25, "TRUE"]], [["damage", 35, "TRUE"]], [["damage", 25, "TRUE"]], [["damage", 15, "TRUE"]], [["heal", 50]], [], [["damage", 50, "TRUE"]], [["damage", 1, "TRUE"]]])
const C4WF = C4.waterfall
expect("CATCHUP_C4 WATERFALL order and shield (real strategy, real addShield, real clearNegativeStatus and clearBoardEffect on stand-ins): the order is shield, clearNegativeStatus, clearBoardEffect (own cell); the shield request 50 / 100 by stars goes through addShield: AP 100 or a crit doubles it, a Big Eater Belt gives 62 (62.5 rounded down first), enraged halves it (25), a caster at 0 HP gets 0", [C4WF.star1.order, C4WF.star1.shield, C4WF.star2.shield, C4WF.ap100.shield, C4WF.crit.shield, C4WF.belt.shield, C4WF.enraged.shield, C4WF.dead.shield], [["shield", "clearNegativeStatus", "clearBoardEffect"], 50, 100, 100, 100, 62, 25, 0])
expect("CATCHUP_C4 WATERFALL cleansing (real Status.clearNegativeStatus): the 14 listed cooldowns are zeroed at once but the boolean flags are NOT touched (burn, poison, paralysis stay true and the poison stacks stay 3 until each status's own update sees its cooldown run out); the curse flag is cleared while a running curse cooldown gets +2000 (3000 -> 5000) instead of being zeroed; with an active possession the caster passes itself as the origin, so origin.team === entity.team always holds and ANY active possession keeps its cooldown (5000) while without possession it is 0", [C4WF.star1.cooldowns, C4WF.star1.flagsStillSet, C4WF.star1.curse, C4WF.star1.curseCooldown, C4WF.possessed.possessedCooldown, C4WF.notPossessed.possessedCooldown], [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { burn: true, poison: true, paralysis: true, poisonStacks: 3 }, false, 5000, 5000, 0])
expect("CATCHUP_C4 WATERFALL board effects (real Board.clearBoardEffect without a specific effect): EVERY board effect registered on the caster's own cell is deleted from the cell and from the occupant's effects set - harmful and helpful alike (POISON_GAS and HEAL_FIELD both gone) - while an effect on another cell (POISON_GAS at (3,1)) and the caster's own unrelated effect (VENOMOUS) stay; this is separate from the status cleansing above", [C4WF.cell.cellEffects, C4WF.cell.otherCellEffects, C4WF.cell.entityEffects], [[], ["POISON_GAS"], ["VENOMOUS"]])
const C4YW = C4.yawn
expect("CATCHUP_C4 YAWN loop (real strategy, real triggerFatigue and addAbilityPower on stand-in units): every enemy whose targetEntityId equals the caster's id (not the one targeting someone else) gets, in this order, triggerFatigue(3000) and then addAbilityPower(-20, caster, apBoost 0, crit false): AP -20, fatigue 3000 ms; the AP change happens even when fatigue is refused (Rune Protect: fatigue false, AP still -20); the stored fatigue duration follows the enemy's reductions (HYDRATION 1500) and a longer remaining fatigue is kept (9000); a Big Eater Belt on the enemy changes nothing; a Twist Band holder GAINS AP (+20); AP floors at -100 (-90 -> -100)", [C4YW.star1.order, C4YW.star1.opps.notTargeting, C4YW.rune.opps.r, C4YW.hydration.opps.h.fatigueCooldown, C4YW.longer.opps.l.fatigueCooldown, C4YW.belt.opps.b.ap, C4YW.twist.opps.w.ap, C4YW.floor.opps.f.ap], [[["t1", "fatigue", 3000], ["t1", "ap", -20, 0, false], ["t2", "fatigue", 3000], ["t2", "ap", -20, 0, false]], { ap: 0, atk: 20, fatigue: false, fatigueCooldown: 0 }, { ap: -20, atk: 20, fatigue: false, fatigueCooldown: 0 }, 1500, 9000, -20, 20, -100])
expect("CATCHUP_C4 YAWN Nullify Bandanna (real addAbilityPower -> addAttack): a holder takes no AP change; round(0.2 x -20) = -4 is routed to addAttack(-4, caster, 0, false), so ATK 20 -> 16; a holder that ALSO wears a Twist Band has that -4 flipped by addAttack's Twist helper and GAINS 4 ATK (24)", [C4YW.nullify.opps.n, C4YW.nullifyTwist.opps.nt], [{ ap: 0, atk: 16, fatigue: true, fatigueCooldown: 3000 }, { ap: 0, atk: 24, fatigue: true, fatigueCooldown: 3000 }])
expect("CATCHUP_C4 YAWN shield and cooldown (real addShield / resetCooldown on a stand-in caster): the shield request 15 (1 star) / 30 (2 stars) is made even with no opponent targeting the caster; AP 100 or a crit doubles it (30), a Big Eater Belt gives 18 (18.75 rounded down), enraged halves it (7.5 rounds to 8); resetCooldown(1000) STORES cooldown = round(1000 / (0.4 + speed x 0.007)) overwriting the running value (777): speed 35 -> 1550, speed 100 -> 909 - a stored number only (AttackingState.update stores the same formula just before casting, with the speed halved when paralysed, and onEnter sets it to 0; how the unit's next action changes in a fight was not simulated)", [C4YW.noOpponents.shield, C4YW.star2.shield, C4YW.shieldAp.shield, C4YW.shieldCrit.shield, C4YW.shieldBelt.shield, C4YW.shieldEnraged.shield, C4YW.noOpponents.cooldown, C4YW.fastCaster.cooldown], [15, 30, 30, 30, 18, 8, 1550, 909])
// 33. CATCHUP_B0 (batch 2 cleanup): the real PokemonEntity.addPP text rounds a NEGATIVE request with Math.round (only the fatigue multiplier depends on base > 0), and the real
// effectInLine / getCellsBetween walk visits only diagonal cells on an exact diagonal (PSYBEAM geometry wording). Stand-in units and board; not a fight.
const negPp = (base, fatigue = false) => { const u = mkHU({ pp: 10, status: { fatigue } }); u.addPP(base, mkHU({ name: "enemy" }), 0, false); return u.pp }
out.CATCHUP_B0 = { negHalf: negPp(-2.5), negHalfFatigue: negPp(-2.5, true), negThird: negPp(-2.4), posHalfFatigue: negPp(5, true), diag: lineCells([0, 0], [2, 2]) }
expect("CATCHUP_B0 PSYSHOCK addPP (real text): PP 10 with addPP(-2.5, enemy, 0, false) gives PP 8 because Math.round(-2.5) = -2 (rounding applies to either sign); fatigue does not change a negative request (still 8) while it halves a positive one (+5 -> 2.5 -> round 3: PP 13)", [out.CATCHUP_B0.negHalf, out.CATCHUP_B0.negHalfFatigue, out.CATCHUP_B0.negThird, out.CATCHUP_B0.posHalfFatigue], [8, 8, 8, 13])
expect("CATCHUP_B0 PSYBEAM / SOLAR_BEAM geometry (real effectInLine and getCellsBetween): an exact diagonal from (0,0) toward (2,2) visits only the diagonal cells, not the side cells at the corners", out.CATCHUP_B0.diag, ["0,0", "1,1", "2,2", "3,3", "4,4", "5,5"])
// 34. CATCHUP_B1 (batch 2 cycle 1): the real AGILITY / HARDEN / DEFENSE_CURL / MEDITATE / QUIVER_DANCE strategy text with the real addAttack / addDefense / addSpecialDefense / addSpeed /
// addAbilityPower / resetCooldown and the Belt / Twist helpers, run against STAND-IN casters (no fight). Requests = arguments received; final = stored stats.
const AB5 = "app/core/abilities/"
const SelfSrc = `${helpers}\nclass SF {\n${js(`class _ {\n${[cut(PE, 319, 321, "resetCooldown("), cut(PE, 621, 647, "addAbilityPower("), cut(PE, 674, 698, "addDefense("), cut(PE, 700, 724, "addSpecialDefense("), cut(PE, 726, 750, "addAttack("), cut(PE, 752, 780, "addSpeed(")].join("\n")}\n}`).replace(/^class _ \{\n/, "").replace(/\n\}\s*$/, "")}\n}`
const SF = build({ Item: enums(), Passive: enums(), min, max, clamp, roundToNDigits, MAX_SPEED: 300 }, SelfSrc, "SF")
const mkSelf = (o = {}) => {
  const log = []; const u = Object.assign(new SF(), { name: "caster", team: BLUE_Z, items: new Set(o.items ?? []), passive: o.passive ?? "NONE", ap: o.ap ?? 0, critPower: 2, atk: o.atk ?? 20, baseAtk: o.baseAtk ?? 20, def: 10, speDef: 10, speed: o.speed ?? 50, cooldown: 777, stars: o.stars ?? 1, skill: "X", pp: 100, maxPP: 100, count: { ult: 0 }, isGhostOpponent: true, simulation: { blueAbilitiesCast: [], redAbilitiesCast: [] }, status: {}, effects: new Set() })
  u.broadcastAbility = () => log.push("broadcast"); u.log = log
  for (const m of ["addAttack", "addDefense", "addSpecialDefense", "addSpeed", "addAbilityPower", "resetCooldown"]) { const real = u[m].bind(u); u[m] = (...a) => { log.push([m, a[0], u.ap]); return real(...a) } }
  return u
}
const selfCast = (file, cls, o = {}, crit = false, casts = 1, env = {}) => { const S = stratReal(`${AB5}${file}.ts`, cls, env); const u = mkSelf(o); const s = new (typeof S === "function" ? S : S.constructor)(); for (let i = 0; i < casts; i++) (S.process ? S : s).process(u, {}, null, crit); return { atk: u.atk, def: u.def, speDef: u.speDef, speed: u.speed, ap: u.ap, cooldown: u.cooldown, calls: u.log } }
const agility = (o, crit, casts) => selfCast("agility", "AgilityStrategy", o, crit, casts)
const harden = (o, crit, casts) => selfCast("harden", "HardenStrategy", o, crit, casts)
const defCurl = (o, crit, casts) => selfCast("defense-curl", "DefenseCurlStrategy", o, crit, casts)
const meditate = (o, crit, casts) => selfCast("meditate", "meditateStrategy", o, crit, casts)
const quiver = (o, crit, casts) => selfCast("quiver-dance", "QuiverDanceStrategy", o, crit, casts)
out.CATCHUP_B1 = {
  agility: { star1: agility({}), star2: agility({ stars: 2 }), belt: agility({ items: ["BIG_EATER_BELT"] }), ap25: agility({ ap: 25 }), ap100: agility({ ap: 100 }), crit: agility({}, true), clamp: agility({ speed: 295 }), melmetal: agility({ passive: "MELMETAL" }), melmetalBelt: agility({ passive: "MELMETAL", items: ["BIG_EATER_BELT"] }), fallback: agility({ stars: 5 }), twice: agility({}, false, 2) },
  harden: { star1: harden({}), star2: harden({ stars: 2 }), fallback: harden({ stars: 5 }), ap12: harden({ ap: 12 }), ap12Belt: harden({ ap: 12, items: ["BIG_EATER_BELT"] }), ap100: harden({ ap: 100 }), crit: harden({}, true), belt: harden({ items: ["BIG_EATER_BELT"] }), twist: harden({ items: ["TWIST_BAND"] }) },
  defenseCurl: { star1: defCurl({ speed: 36 }), star2: defCurl({ stars: 2, speed: 36 }), fast: defCurl({ speed: 100, stars: 1 }), ap100: defCurl({ ap: 100 }), belt: defCurl({ items: ["BIG_EATER_BELT"] }), crit: defCurl({}, true) },
  meditate: { plain: meditate({ atk: 20, baseAtk: 9 }), twice: meditate({ atk: 20, baseAtk: 9 }, false, 2), grown: meditate({ atk: 40, baseAtk: 9 }), ap100: meditate({ atk: 20, baseAtk: 9, ap: 100 }), crit: meditate({ atk: 20, baseAtk: 9 }, true), belt: meditate({ atk: 20, baseAtk: 9, items: ["BIG_EATER_BELT"] }), medicham: meditate({ atk: 30, baseAtk: 16 }) },
  quiver: { star1: quiver({}), star2: quiver({ stars: 2 }), ap100: quiver({ ap: 100 }), crit: quiver({}, true), belt: quiver({ stars: 2, items: ["BIG_EATER_BELT"] }), beltStar1: quiver({ items: ["BIG_EATER_BELT"] }), nullify: quiver({ items: ["NULLIFY_BANDANNA"] }), nullifyBelt: quiver({ items: ["NULLIFY_BANDANNA", "BIG_EATER_BELT"] }), twist: quiver({ items: ["TWIST_BAND"] }), melmetal: quiver({ passive: "MELMETAL" }), apMinus: quiver({ ap: -50 }) }
}
const B1 = out.CATCHUP_B1

const B1AG = B1.agility
expect("CATCHUP_B1 AGILITY (real strategy and addSpeed; caster speed 50): no animation is broadcast (preventDefaultAnim true), one addSpeed(10 / 20 / fallback 60, self, apBoost 1, crit): 1 star 60, 2 stars 70, 5 stars 110; a Big Eater Belt takes 10 -> 12 BEFORE scaling (62); AP 25 gives 12.5 and the stored speed is NOT rounded (62.5); AP 100 or a crit doubles (70); speed clamps at 300 (295 -> 300); two casts stack (70); a MELMETAL passive (no bound unit) would instead call addAttack(0.5 x the Belt-adjusted value): ATK +5, or +7 with a Belt (10 -> 12 -> 6 -> 7) and the speed stays 50", [B1AG.star1.calls, B1AG.star1.speed, B1AG.star2.speed, B1AG.fallback.speed, B1AG.belt.speed, B1AG.ap25.speed, B1AG.ap100.speed, B1AG.crit.speed, B1AG.clamp.speed, B1AG.twice.speed, B1AG.melmetal.atk, B1AG.melmetal.speed, B1AG.melmetalBelt.atk], [[["addSpeed", 10, 0]], 60, 70, 110, 62, 62.5, 70, 70, 300, 70, 25, 50, 27])
const B1HD = B1.harden
expect("CATCHUP_B1 HARDEN (real strategy and addDefense; DEF 10, SPE_DEF 10): addDefense(4 / 8 / fallback 24, self, 1, crit) changes DEF only (SPE_DEF stays 10): 14 / 18 / 34; the request is Math.round-ed after AP / crit and the Big Eater Belt comes AFTER the rounding: AP 12 gives round(4.48) = 4 (DEF 14), with a Belt 4 -> 5 (DEF 15); AP 100 or a crit doubles (18); a Twist Band changes nothing for the positive self-buff; the default animation is broadcast", [B1HD.star1.def, B1HD.star1.speDef, B1HD.star2.def, B1HD.fallback.def, B1HD.ap12.def, B1HD.ap12Belt.def, B1HD.ap100.def, B1HD.crit.def, B1HD.belt.def, B1HD.twist.def, B1HD.star1.calls[0]], [14, 10, 18, 34, 14, 15, 18, 18, 15, 14, "broadcast"])
const B1DC = B1.defenseCurl
expect("CATCHUP_B1 DEFENSE_CURL (real strategy, addDefense, addSpecialDefense, resetCooldown): the order is addDefense, addSpecialDefense, then resetCooldown(250); both stats get the same request (5 / 10): DEF and SPE_DEF 10 -> 15 / 20; AP 100 or a crit doubles both (20); a Belt gives 6 (16); the cooldown is a STORED value round(250 / (0.4 + speed x 0.007)) overwriting the running 777: speed 36 -> 383, speed 100 -> 227, speed 50 -> 333 - not a guaranteed 250 ms wait", [B1DC.star1.calls.slice(1).map((c) => c[0]), B1DC.star1.def, B1DC.star1.speDef, B1DC.star2.def, B1DC.ap100.def, B1DC.crit.def, B1DC.belt.def, B1DC.belt.speDef, B1DC.star1.cooldown, B1DC.fast.cooldown, B1DC.belt.cooldown], [["addDefense", "addSpecialDefense", "resetCooldown"], 15, 15, 20, 20, 20, 16, 16, 383, 227, 333])
const B1MD = B1.meditate
expect("CATCHUP_B1 MEDITATE (real exported meditateStrategy instance, real addAttack): the request is the combat entity's baseAtk (a snapshot, distinct from the current atk): baseAtk 9 with atk 20 -> 29 (not +20); two casts add the fixed 9 twice (38); with current atk 40 the gain is still 9 (49); AP 100 or a crit doubles it (38); a Belt gives 11 (31); baseAtk 16 with atk 30 -> 46", [B1MD.plain.atk, B1MD.twice.atk, B1MD.grown.atk, B1MD.ap100.atk, B1MD.crit.atk, B1MD.belt.atk, B1MD.medicham.atk, B1MD.plain.calls], [29, 38, 49, 38, 38, 31, 46, ["broadcast", ["addAttack", 9, 0]]])
const B1QD = B1.quiver
expect("CATCHUP_B1 QUIVER_DANCE order and values (real strategy and stat helpers; ATK 20, SPE_DEF 10, speed 50, AP 0): ATK, SPE_DEF, SPEED, then AP: 1 star 23 / 13 / 60 / 20, 2 stars ATK 24 SPE_DEF 14; with AP 100 the first three see AP 100 (ATK +6, SPE_DEF +6, speed +20) and the last request AP +20 (apBoost 0, crit false) is NOT scaled and does not boost them (AP 120 afterwards); a crit doubles the first three (26 / 16 / 70) but not the AP (20)", [B1QD.star1.calls.slice(1).map((c) => c[0]), [B1QD.star1.atk, B1QD.star1.speDef, B1QD.star1.speed, B1QD.star1.ap], B1QD.star2.atk, B1QD.star2.speDef, [B1QD.ap100.atk, B1QD.ap100.speDef, B1QD.ap100.speed, B1QD.ap100.ap], [B1QD.crit.atk, B1QD.crit.speDef, B1QD.crit.speed, B1QD.crit.ap]], [["addAttack", "addSpecialDefense", "addSpeed", "addAbilityPower"], [23, 13, 60, 20], 24, 14, [26, 16, 70, 120], [26, 16, 70, 20]])
expect("CATCHUP_B1 QUIVER_DANCE item helpers (2 stars unless stated): a Big Eater Belt rounds ATK / SPE_DEF first and then takes x1.25 down (4 -> 5: ATK 25, SPE_DEF 15), takes speed 10 -> 12 BEFORE scaling (62, not rounded by the adder) and takes the AP request 20 -> 25, so the last gain is not always 20; a Twist Band changes nothing (positive self-buff); a Nullify Bandanna holder (a helper path only - ordinary canCast blocks such a cast) gets no AP but addAttack(round(0.2 x 20) = 4): ATK 27, with a Belt on top 4 -> 5 (ATK 28); a MELMETAL passive (no bound unit) turns the speed part into addAttack(5) and leaves speed 50; a negative caster AP (-50) halves the scaled parts (ATK +2, speed +5) while the AP request still adds 20 (-30)", [[B1QD.belt.atk, B1QD.belt.speDef, B1QD.belt.speed, B1QD.belt.ap], B1QD.twist.ap, [B1QD.nullify.ap, B1QD.nullify.atk], B1QD.nullifyBelt.atk, [B1QD.melmetal.atk, B1QD.melmetal.speed], [B1QD.apMinus.atk, B1QD.apMinus.speed, B1QD.apMinus.ap]], [[25, 15, 62, 25], 20, [0, 27], 28, [28, 50], [22, 55, -30]])
// 35. CATCHUP_B2 (batch 2 cycle 2): the real HAPPY_HOUR / FAIRY_WIND / JET_PUNCH / PECK / RAZOR_WIND strategy text with the real addAttack, addPP, handleSpecialDamage / handleDamage and
// castAbility text, run against STAND-IN units and boards. Requests = arguments received; final = stored fields. Not a fight.
const AB6 = "app/core/abilities/"
// ---- HAPPY_HOUR: board.forEach over occupants of the caster's team, addAttack(buff, caster, 1, crit)
const HappyHourX = stratReal(`${AB6}happy-hour.ts`, "HappyHourStrategy")
const happyHour = ({ stars = 2, ap = 0, crit = false, units }) => {
  const c = mkSelf({ stars, ap }); c.name = "caster"; c.team = BLUE_Z; c.atk = 20; c.id = "caster"
  const others = units.map((u) => { const e = mkSelf({ items: u.items ?? [], atk: u.atk ?? 20 }); e.name = u.name; e.team = u.team ?? BLUE_Z; e.id = u.name; e.hp = u.hp ?? 100; return e })
  const all = [c, ...others]; const board = { forEach: (cb) => all.forEach((e, i) => cb(i % 8, Math.floor(i / 8), e)) }
  board.forEach(() => {}); board.forEach = (cb) => { all.forEach((e, i) => cb(i % 8, Math.floor(i / 8), e)); cb(7, 5, undefined) }
  new HappyHourX().process(c, board, null, crit)
  return Object.fromEntries(all.map((e) => [e.name, e.atk]))
}
// ---- FAIRY_WIND: addPP on every same-team unit except the caster
const FairyWindX = stratReal(`${AB6}fairy-wind.ts`, "FairyWindStrategy")
const fairyWind = ({ stars = 1, ap = 0, crit = false, status = {}, items = [], maxPP = 100, pp = 10, effects = [], allies = 1 }) => {
  const c = mkHU({ name: "caster", pp: 100, maxPP: 100 }); Object.assign(c, { stars, ap, count: { ult: 0 }, broadcastAbility() {}, team: BLUE_Z, skill: "FAIRY_WIND", id: "caster" }); c.simulation = { ...c.simulation, blueAbilitiesCast: [], redAbilitiesCast: [] }
  const mk = (name, team) => { const u = mkHU({ name, pp, maxPP, status, items }); Object.assign(u, { team, id: name, effects: new Set(effects) }); return u }
  const ally = mk("ally", BLUE_Z), enemy = mk("enemy", RED_Z)
  const extra = allies > 1 ? [mk("ally2", BLUE_Z)] : []
  const all = [c, ally, enemy, ...extra]
  const reqs = []; const real = ally.addPP.bind(ally); ally.addPP = (...a) => { reqs.push([a[0], a[2], a[3]]); return real(...a) }
  const board = { forEach: (cb) => all.forEach((e, i) => cb(i % 8, Math.floor(i / 8), e)) }
  new FairyWindX().process(c, board, null, crit)
  return { reqs, ally: ally.pp, enemy: enemy.pp, caster: c.pp, maxPP: ally.maxPP }
}
// ---- JET_PUNCH: request = multiplier x the stored speed stat; real handleSpecialDamage recorder
const JetPunchX = stratReal(`${AB6}jet-punch.ts`, "JetPunchStrategy")
const jetPunch = ({ stars = 3, speed = 64, ap = 0, crit = false, paralysis = false }) => {
  const c = mkFU({ team: "BLUE", stars, ap, hp: 800, maxHP: 800 }); Object.assign(c, { count: { ult: 0 }, skill: "JET_PUNCH", pp: 0, maxPP: 80, critPower: 2, speed }); c.status.paralysis = paralysis; c.simulation = { ...c.simulation, blueAbilitiesCast: [], redAbilitiesCast: [] }; const bc = []; c.broadcastAbility = () => bc.push("broadcast"); c.log = bc
  const t = mkFU({ team: "RED", hp: 5000, maxHP: 5000 }); const seen = []; const hd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { const r = hd(...a); seen.push({ raw: a[0], type: a[2], crit: a[4], apBoostParam: a[5], returned: r.takenDamage }); return r }
  new JetPunchX().process(c, {}, t, crit)
  return { seen, hp: t.hp, broadcast: c.log.includes("broadcast") }
}
// ---- PECK / RAZOR_WIND: direct SPECIAL; request versus final HP loss with the real handleSpecialDamage / handleDamage
const PeckX = stratReal(`${AB6}peck.ts`, "PeckStrategy"), RazorWindX = stratReal(`${AB6}razor-wind.ts`, "RazorWindStrategy")
const direct = (Strat, { stars = 1, ap = 0, crit = false, speDef = 0, shield = 0, protect = false, hp = 500 }) => {
  const c = mkFU({ team: "BLUE", stars, ap, hp: 800, maxHP: 800 }); Object.assign(c, { count: { ult: 0 }, broadcastAbility() {}, skill: "X", pp: 0, maxPP: 100, critPower: 2, positionX: 0, positionY: 0 }); c.simulation = { ...c.simulation, blueAbilitiesCast: [], redAbilitiesCast: [] }
  const t = mkFU({ team: "RED", hp, maxHP: 1000, shield, speDef }); t.status.protect = protect
  const seen = []; const hd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { const r = hd(...a); seen.push({ raw: a[0], type: a[2], crit: a[4], apBoostParam: a[5], boardPassed: a[1] !== undefined }); return r }
  new Strat().process(c, { getAdjacentCells: () => [] }, t, crit)
  return { seen, hpLoss: hp - t.hp, shield: t.shield }
}
// real castAbility with a controlled crit roll: PECK (canCritByDefault false) versus RAZOR_WIND (true)
const castRoll = (Strat, { abilityCrit = false, roll = 0.01, critChance = 10 }) => {
  const f = build({ EffectEnum: enums(), chance: (p, pk) => chanceZ(p, pk), OnAbilityCastEffect: class OnAbilityCastEffect {} }, js(strategySrc(`${AB6}cast.ts`)), "castAbility")
  const c = mkFU({ team: "BLUE", stars: 1, hp: 800, maxHP: 800 }); Object.assign(c, { count: { ult: 0 }, broadcastAbility() {}, skill: "X", pp: 0, maxPP: 100, critPower: 2, canCast: true, critChance, getEffects: () => [] }); c.simulation = { ...c.simulation, blueAbilitiesCast: [], redAbilitiesCast: [] }
  if (abilityCrit) c.effects = new Set(["ABILITY_CRIT"])
  const t = mkFU({ team: "RED", hp: 500, maxHP: 1000, speDef: 0 }); const seen = []; const hd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { seen.push(a[4]); return hd(...a) }
  chanceRolls.length = 0; chanceRolls.push(roll)
  f(new Strat(), c, { getAdjacentCells: () => [] }, t)
  return seen
}
out.CATCHUP_B2 = {
  happyHour: {
    plain: happyHour({ units: [{ name: "ally" }, { name: "foe", team: RED_Z }] }), star1: happyHour({ stars: 1, units: [{ name: "ally" }] }), ap100: happyHour({ ap: 100, units: [{ name: "ally" }] }), crit: happyHour({ crit: true, units: [{ name: "ally" }] }),
    belt: happyHour({ units: [{ name: "belt", items: ["BIG_EATER_BELT"] }] }), twist: happyHour({ units: [{ name: "tw", items: ["TWIST_BAND"] }] }), deadAlly: happyHour({ units: [{ name: "dead", hp: 0 }] }), fallback: happyHour({ stars: 5, units: [{ name: "ally" }] })
  },
  fairyWind: {
    star1: fairyWind({}), star2: fairyWind({ stars: 2 }), star3: fairyWind({ stars: 3 }), ap100: fairyWind({ ap: 100 }), apCrit: fairyWind({ ap: 100, crit: true }), apCritFatigue: fairyWind({ ap: 100, crit: true, status: { fatigue: true } }), fatigue: fairyWind({ status: { fatigue: true } }), fatigueAp100: fairyWind({ ap: 100, status: { fatigue: true } }),
    silence: fairyWind({ status: { silence: true } }), protect: fairyWind({ status: { protect: true } }), noGain: fairyWind({ effects: ["NO_PP_GAIN"] }), resurrecting: fairyWind({ status: { resurrecting: true } }), clamp: fairyWind({ stars: 3, pp: 190, maxPP: 100, ap: 300 }), belt: fairyWind({ items: ["BIG_EATER_BELT"] }), twist: fairyWind({ items: ["TWIST_BAND"] }), fallback: fairyWind({ stars: 5 })
  },
  jetPunch: { finizen: jetPunch({}), hero: jetPunch({ stars: 4, speed: 80 }), star5: jetPunch({ stars: 5, speed: 80 }), fallback: jetPunch({ stars: 6, speed: 80 }), star1: jetPunch({ stars: 1, speed: 50 }), paralysed: jetPunch({ stars: 4, speed: 80, paralysis: true }), ap100: jetPunch({ ap: 100 }), crit: jetPunch({ crit: true }) },
  peck: { star1: direct(PeckX, {}), star2: direct(PeckX, { stars: 2 }), star5: direct(PeckX, { stars: 5 }), ap100Def20: direct(PeckX, { ap: 100, speDef: 20 }), def20: direct(PeckX, { speDef: 20 }), apNoDef: direct(PeckX, { ap: 100 }), crit: direct(PeckX, { crit: true }), shield: direct(PeckX, { stars: 2, shield: 20 }), protect: direct(PeckX, { protect: true }) },
  razorWind: { star1: direct(RazorWindX, {}), star2: direct(RazorWindX, { stars: 2 }), star3: direct(RazorWindX, { stars: 3 }), crit: direct(RazorWindX, { crit: true }) },
  castCrit: { razorHit: castRoll(RazorWindX, { roll: 0.01 }), razorMiss: castRoll(RazorWindX, { roll: 0.9 }), peckNoEffect: castRoll(PeckX, { roll: 0.01 }), peckAbilityCrit: castRoll(PeckX, { roll: 0.01, abilityCrit: true }), peckAbilityCritMiss: castRoll(PeckX, { roll: 0.9, abilityCrit: true }) }
}
const B2 = out.CATCHUP_B2

const B2HH = B2.happyHour
expect("CATCHUP_B2 HAPPY_HOUR (real strategy and addAttack on a stand-in board; every unit ATK 20): every non-null same-team occupant, the caster included, gets addAttack(buff, caster, 1, crit) with buff 2 / 4 / 7 / 10 by the caster's stars: 2 stars +4 (24), 1 star +2 (22), the fallback (5 stars) +10 (30); enemies are untouched; the loop has no hp or targettability filter (an ally with hp 0 still gets +4); AP 100 or a cast crit doubles the rounded request (28); a recipient's Big Eater Belt gives 4 -> 5 (25); a Twist Band holder gets the plain +4", [B2HH.plain, B2HH.star1.ally, B2HH.fallback.ally, B2HH.deadAlly.dead, B2HH.ap100.ally, B2HH.crit.ally, B2HH.belt.belt, B2HH.twist.tw], [{ caster: 24, ally: 24, foe: 20 }, 22, 30, 24, 28, 28, 25, 24])
const B2FW = B2.fairyWind
expect("CATCHUP_B2 FAIRY_WIND request (real strategy and addPP; recipients PP 10, maxPP 100): every same-team unit except the caster (by id) gets addPP(flat x (2 + AP/100), caster, apBoost 0, cast crit): the caster's own PP only spends (0) and enemies are untouched; 1 star flat 2.5 -> request 5 (PP 15), 2 stars 10 (PP 20), 3 stars 20 (PP 30), the fallback 40; AP 100 -> request 7.5 -> Math.round 8 (PP 18); AP 100 with a crit (critPower 2) -> 15 (PP 25); a Big Eater Belt or Twist Band on the recipient changes nothing and maxPP stays 100", [B2FW.star1.reqs, B2FW.star1.ally, B2FW.star1.caster, B2FW.star1.enemy, B2FW.star2.ally, B2FW.star3.ally, B2FW.fallback.reqs, B2FW.ap100.ally, B2FW.apCrit.ally, B2FW.belt.ally, B2FW.twist.ally, B2FW.star1.maxPP], [[[5, 0, false]], 15, 0, 10, 20, 30, [[40, 0, false]], 18, 25, 15, 15, 100])
expect("CATCHUP_B2 FAIRY_WIND recipient guards (real addPP): the recipient's fatigue halves the originally positive gain before rounding (AP 0: 2.5 -> 3, PP 13; AP 100 with a crit: 15 x 0.5 = 7.5 -> 8, PP 18); silence, Protect, NO_PP_GAIN and resurrecting each refuse the gain (PP stays 10); PP clamps at 2 x maxPP - 1 (190 + 50 -> 199)", [B2FW.fatigue.ally, B2FW.apCritFatigue.ally, B2FW.silence.ally, B2FW.protect.ally, B2FW.noGain.ally, B2FW.resurrecting.ally, B2FW.clamp.ally], [13, 18, 10, 10, 10, 10, 199])
const B2JP = B2.jetPunch
expect("CATCHUP_B2 JET_PUNCH (real strategy, real handleSpecialDamage on a stand-in target): the request is multiplier [1, 1, 1, 1.5, 3] (fallback 3) times the caster's STORED speed stat: FINIZEN / PALAFIN (3 stars, speed 64) 64, PALAFIN_HERO (4 stars, speed 80) 120, 5 stars 240 and the fallback 240, 1 star speed 50 -> 50; a paralysed caster still requests the stored-speed amount (120) - paralysis only halves the speed used for the attack / move rate elsewhere; no animation is broadcast (preventDefaultAnim true); AP (apBoost default) and a crit act inside handleSpecialDamage: the request stays 64 while the returned amount doubles (128)", [B2JP.finizen.seen[0].raw, B2JP.hero.seen[0].raw, B2JP.star5.seen[0].raw, B2JP.fallback.seen[0].raw, B2JP.star1.seen[0].raw, B2JP.paralysed.seen[0].raw, B2JP.finizen.broadcast, [B2JP.ap100.seen[0].raw, B2JP.ap100.seen[0].returned], [B2JP.crit.seen[0].raw, B2JP.crit.seen[0].returned]], [64, 120, 240, 240, 50, 120, false, [64, 128], [64, 128]])
const B2PK = B2.peck, B2RW = B2.razorWind
expect("CATCHUP_B2 PECK (real strategy and real handleSpecialDamage / handleDamage, target maxHP 1000, hp 500): direct SPECIAL 10 / 30 / fallback 100 with the board passed through; AP 100 or a crit doubles the damage inside the helper (10 -> HP loss 20) and the target's SPE_DEF divides it (SPE_DEF 20: 10 -> 5), so the final HP loss can be BELOW or ABOVE the raw table value (AP 100 against SPE_DEF 20 gives exactly 10, AP 100 against SPE_DEF 0 gives 20); a shield absorbs first (30 with a 20 shield -> HP loss 10); protect blocks (0); no status is added", [B2PK.star1.seen[0], B2PK.star2.seen[0].raw, B2PK.star5.seen[0].raw, B2PK.crit.hpLoss, B2PK.def20.hpLoss, B2PK.ap100Def20.hpLoss, B2PK.apNoDef.hpLoss, B2PK.shield.hpLoss, B2PK.protect.hpLoss], [{ raw: 10, type: "SPECIAL", crit: false, apBoostParam: undefined, boardPassed: true }, 30, 100, 20, 5, 10, 20, 10, 0])
expect("CATCHUP_B2 RAZOR_WIND (real strategy; real castAbility with a controlled roll): direct SPECIAL 20 / 40 / 80 (1 / 2 / 3 stars) with the board passed to handleSpecialDamage (the strategy itself selects no geometry or area); a crit doubles it (HP loss 40); canCritByDefault is true, so the cast rolls chance(critChance / 100) WITHOUT ABILITY_CRIT: roll 0.01 at critChance 10 -> crit true, roll 0.9 -> crit false (not automatic); PECK (canCritByDefault false) rolls only with ABILITY_CRIT (no effect -> false; effect and roll 0.01 -> true, roll 0.9 -> false)", [B2RW.star1.seen[0], B2RW.star2.seen[0].raw, B2RW.star3.seen[0].raw, B2RW.crit.hpLoss, B2.castCrit.razorHit, B2.castCrit.razorMiss, B2.castCrit.peckNoEffect, B2.castCrit.peckAbilityCrit, B2.castCrit.peckAbilityCritMiss], [{ raw: 20, type: "SPECIAL", crit: false, apBoostParam: undefined, boardPassed: true }, 40, 80, 40, [true], [false], [false], [true], [false]])
// 36. CATCHUP_B3 (batch 2 cycle 3): the real ANCIENT_POWER / FIERY_DANCE / METAL_CLAW / TROP_KICK / MYSTICAL_FIRE strategy text with the real addAbilityPower / addAttack, the Belt / Twist helpers,
// handleSpecialDamage / handleDamage, the real canCast getter and castAbility text, run against STAND-IN units. A direct process invocation is NOT evidence that the cast gate permits it. Not a fight.
const AB7 = "app/core/abilities/"
const CanCastCls = build({ Item: enums(), EffectEnum: enums() }, js(`class CC {\n${cut(PE, 250, 256, "get canCast")}\n}`), "CC")
const canCastDesc = Object.getOwnPropertyDescriptor(CanCastCls.prototype, "canCast")
const mkCombat = (team, o = {}) => {
  const u = mkFU({ team, stars: o.stars ?? 1, ap: o.ap ?? 0, hp: o.hp ?? 500, maxHP: 1000, shield: o.shield ?? 0, speDef: o.speDef ?? 0, items: new Set(o.items ?? []) })
  Object.assign(u, { count: { ult: 0 }, broadcastAbility() {}, skill: "X", pp: o.pp ?? 100, maxPP: 100, critPower: 2, atk: o.atk ?? 20, effects: new Set(o.effects ?? []), isGhostOpponent: true, passive: "NONE", positionX: 0, positionY: 0 })
  u.status = { ...u.status, protect: !!o.protect, magicBounce: !!o.bounce, silence: false }
  u.addAbilityPower = SF.prototype.addAbilityPower; u.addAttack = SF.prototype.addAttack
  Object.defineProperty(u, "canCast", canCastDesc)
  u.simulation = { ...u.simulation, blueAbilitiesCast: [], redAbilitiesCast: [] }
  return u
}
const spyDamage = (t, caster, log) => { const hd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { const r = hd(...a); log.push({ raw: a[0], type: a[2], crit: a[4], apBoostParam: a[5], casterApAtCall: caster.ap, returned: r.takenDamage }); return r } }
const AncientPowerX = stratReal(`${AB7}ancient-power.ts`, "AncientPowerStrategy"), FieryDanceX = stratReal(`${AB7}fiery-dance.ts`, "FieryDanceStrategy"), MetalClawX = stratReal(`${AB7}metal-claw.ts`, "MetalClawStrategy"), TropKickX = stratReal(`${AB7}trop-kick.ts`, "TropKickStrategy"), MysticalFireX = stratReal(`${AB7}mystical-fire.ts`, "MysticalFireStrategy")
const castFor = (Strat, c, t, crit = false) => { const f = build({ EffectEnum: enums(), chance: () => crit, OnAbilityCastEffect: class OnAbilityCastEffect {} }, js(strategySrc(`${AB7}cast.ts`)), "castAbility"); c.getEffects = () => []; c.critChance = 0; f(new Strat(), c, { getAdjacentCells: () => [] }, t, false) }
const duel = (Strat, { stars = 1, ap = 0, crit = false, casterItems = [], tOpts = {}, direct = true, speDef = 0 } = {}) => {
  const c = mkCombat("BLUE", { stars, ap, items: casterItems }), t = mkCombat("RED", { speDef, ...tOpts }); const log = []; spyDamage(t, c, log)
  const tCalls = []; for (const m of ["addAttack", "addAbilityPower"]) { const real = t[m].bind(t); t[m] = (...a) => { tCalls.push([m, a[0], a[2], a[3], c.ap, log.length]); return real(...a) } }
  const cCalls = []; for (const m of ["addAttack", "addAbilityPower"]) { const real = c[m].bind(c); c[m] = (...a) => { cCalls.push([m, a[0], a[2], a[3], log.length]); return real(...a) } }
  if (direct) new Strat().process(c, { getAdjacentCells: () => [] }, t, crit); else castFor(Strat, c, t, crit)
  return { damage: log, hpLoss: (tOpts.hp ?? 500) - t.hp, tCalls, cCalls, cAp: c.ap, cAtk: c.atk, tAp: t.ap, tAtk: t.atk, pp: c.pp, shield: t.shield }
}
out.CATCHUP_B3 = {
  ancient: { star1: duel(AncientPowerX), ap100: duel(AncientPowerX, { ap: 100 }), belt: duel(AncientPowerX, { casterItems: ["BIG_EATER_BELT"] }), nullify: duel(AncientPowerX, { casterItems: ["NULLIFY_BANDANNA"] }), nullifyBelt: duel(AncientPowerX, { casterItems: ["NULLIFY_BANDANNA", "BIG_EATER_BELT"] }), nullifyCast: duel(AncientPowerX, { casterItems: ["NULLIFY_BANDANNA"], direct: false }), blocked: duel(AncientPowerX, { tOpts: { protect: true } }), twice: (() => { const c = mkCombat("BLUE", {}), t = mkCombat("RED", {}); new AncientPowerX().process(c, {}, t, false); new AncientPowerX().process(c, {}, t, false); return c.ap })(), normalCast: duel(AncientPowerX, { direct: false }) },
  fiery: { star1: duel(FieryDanceX), star2: duel(FieryDanceX, { stars: 2 }), belt: duel(FieryDanceX, { casterItems: ["BIG_EATER_BELT"] }), nullify: duel(FieryDanceX, { casterItems: ["NULLIFY_BANDANNA"] }), nullifyBelt: duel(FieryDanceX, { casterItems: ["NULLIFY_BANDANNA", "BIG_EATER_BELT"] }), nullifyCast: duel(FieryDanceX, { casterItems: ["NULLIFY_BANDANNA"], direct: false }), blocked: duel(FieryDanceX, { tOpts: { protect: true } }), normalCast: duel(FieryDanceX, { direct: false }) },
  metalClaw: { star1: duel(MetalClawX), star2: duel(MetalClawX, { stars: 2 }), trueDef: duel(MetalClawX, { speDef: 100 }), ap100: duel(MetalClawX, { ap: 100 }), crit: duel(MetalClawX, { crit: true }), shield: duel(MetalClawX, { tOpts: { shield: 6 } }), protect: duel(MetalClawX, { tOpts: { protect: true } }), bounce: duel(MetalClawX, { tOpts: { bounce: true } }), belt: duel(MetalClawX, { stars: 2, casterItems: ["BIG_EATER_BELT"] }) },
  tropKick: { star1: duel(TropKickX), star2: duel(TropKickX, { stars: 2 }), star3: duel(TropKickX, { stars: 3 }), fallback: duel(TropKickX, { stars: 5 }), ap100: duel(TropKickX, { ap: 100 }), crit: duel(TropKickX, { crit: true }), apHalf: duel(TropKickX, { ap: -50 }), belt: duel(TropKickX, { tOpts: { items: ["BIG_EATER_BELT"] } }), twist: duel(TropKickX, { tOpts: { items: ["TWIST_BAND"] } }), floor: duel(TropKickX, { tOpts: { atk: 2 } }), protect: duel(TropKickX, { tOpts: { protect: true } }) },
  mystical: { star1: duel(MysticalFireX), star2: duel(MysticalFireX, { stars: 2 }), apCrit: duel(MysticalFireX, { ap: 100, crit: true }), nullify: duel(MysticalFireX, { ap: 100, crit: true, tOpts: { items: ["NULLIFY_BANDANNA"] } }), nullifyPlain: duel(MysticalFireX, { tOpts: { items: ["NULLIFY_BANDANNA"] } }), nullifyTwist: duel(MysticalFireX, { ap: 100, crit: true, tOpts: { items: ["NULLIFY_BANDANNA", "TWIST_BAND"] } }), nullifyFloor: duel(MysticalFireX, { tOpts: { items: ["NULLIFY_BANDANNA"], atk: 2 } }), twist: duel(MysticalFireX, { ap: 100, crit: true, tOpts: { items: ["TWIST_BAND"] } }), belt: duel(MysticalFireX, { tOpts: { items: ["BIG_EATER_BELT"] } }), floor: duel(MysticalFireX, { ap: 100, crit: true, tOpts: { ap: -90 } }), protect: duel(MysticalFireX, { tOpts: { protect: true } }), bounce: duel(MysticalFireX, { tOpts: { bounce: true } }), killed: duel(MysticalFireX, { stars: 3, tOpts: { hp: 5 } }) }
}
const B3 = out.CATCHUP_B3

const B3AP = B3.ancient
expect("CATCHUP_B3 ANCIENT_POWER (real strategy, real addAbilityPower / addAttack / handleSpecialDamage; caster AP 0, target maxHP 1000): the SPECIAL damage request (40 for 1 star) is made FIRST with the caster's AP unchanged (AP 0 at the call, AP 100 at the call when the caster already had 100: returned 80) and the +25 AP request follows (apBoost 0, crit false), so this cast's damage does not benefit from it; final AP 25 (two casts 50, 125 from 100); a Big Eater Belt makes it 31; a blocked hit (protect) still gets the +25; a Nullify Bandanna holder (DIRECT process call only) gets no AP but addAttack(round(0.2 x 25) = 5): ATK 25, with a Belt on top 5 -> 6 (ATK 26); through the real castAbility and the real canCast getter a Nullify holder casts nothing at all (PP stays 100)", [B3AP.star1.damage[0].casterApAtCall, B3AP.star1.cAp, B3AP.ap100.damage[0].casterApAtCall, B3AP.ap100.damage[0].returned, B3AP.ap100.cAp, B3AP.twice, B3AP.belt.cAp, B3AP.blocked.cAp, B3AP.blocked.damage[0].returned, [B3AP.nullify.cAp, B3AP.nullify.cAtk], B3AP.nullifyBelt.cAtk, [B3AP.nullifyCast.pp, B3AP.nullifyCast.damage.length, B3AP.nullifyCast.cAtk], B3AP.normalCast.cAp], [0, 25, 100, 80, 125, 50, 31, 25, 0, [0, 25], 26, [100, 0, 20], 25])
const B3FD = B3.fiery
expect("CATCHUP_B3 FIERY_DANCE (real strategy and helpers; same setup): the +30 AP request (apBoost 0, crit false) comes BEFORE the SPECIAL damage, so the hit sees the new AP: 1 star raw 25 with AP 30 -> 32.5 -> returned 33, 2 stars 50 -> 65; a Belt makes the gain 37 (30 x 1.25 rounded down) and the damage 35; a blocked hit (protect) still gets the +30 (the hit sees AP 30 and returns 0); a Nullify Bandanna holder (DIRECT process call only) gets no AP but addAttack(round(0.2 x 30) = 6): ATK 26, damage unboosted (25), with a Belt on top 6 -> 7 (ATK 27); through the real castAbility and canCast getter a Nullify holder casts nothing (PP 100); a normal cast gives AP 30", [B3FD.star1.damage[0].casterApAtCall, B3FD.star1.damage[0].returned, B3FD.star2.damage[0].returned, B3FD.belt.cAp, B3FD.belt.damage[0].returned, [B3FD.blocked.cAp, B3FD.blocked.damage[0].returned], [B3FD.nullify.cAp, B3FD.nullify.cAtk, B3FD.nullify.damage[0].returned], B3FD.nullifyBelt.cAtk, [B3FD.nullifyCast.pp, B3FD.nullifyCast.damage.length], B3FD.normalCast.cAp], [30, 33, 65, 37, 35, [30, 0], [0, 26, 25], 27, [100, 0], 30])
const B3MC = B3.metalClaw
expect("CATCHUP_B3 METAL_CLAW (real strategy and helpers): TRUE damage 10 / 20 through handleSpecialDamage still scales with AP and a crit (AP 100 or a crit -> 20 against raw 10) but skips the SPE_DEF division (SPE_DEF 100: loss 10); it does NOT bypass shields (6 shield absorbs first: HP loss 4) or the protect / skydiving / magicBounce guards (protect and magicBounce: 0 loss); THEN the self ATK request 2 / 4 (apBoost 1, cast crit) is made even when the hit returned 0 (ATK 22 after a protected target; AP 100 -> 24; crit -> 24; 2 stars with a Belt 4 -> 5 = ATK 25)", [B3MC.star1.damage[0], B3MC.star2.damage[0].raw, B3MC.trueDef.hpLoss, B3MC.ap100.hpLoss, B3MC.crit.hpLoss, B3MC.shield.hpLoss, B3MC.protect.hpLoss, B3MC.bounce.hpLoss, B3MC.star1.cAtk, B3MC.protect.cAtk, B3MC.bounce.cAtk, B3MC.ap100.cAtk, B3MC.crit.cAtk, B3MC.belt.cAtk], [{ raw: 10, type: "TRUE", crit: false, casterApAtCall: 0, returned: 10 }, 20, 10, 20, 20, 4, 0, 0, 22, 22, 22, 24, 24, 25])
const B3TK = B3.tropKick
expect("CATCHUP_B3 TROP_KICK (real strategy, addAttack, handleSpecialDamage; target ATK 20): the target's ATK request is made BEFORE the SPECIAL damage (the recorded count of earlier damage calls is 0 at the ATK call): -3 / -5 / -7 / fallback -14 (ATK 17 / 15 / 13 / 6) and raw damage 50 / 100 / 200 / 400; the negative request is scaled by the caster's AP and crit and rounded first: AP 100 or a crit -> -6 (ATK 14), AP -50 gives -1.5 which Math.round makes -1 (ATK 19); an enemy Big Eater Belt does not amplify it (17), a Twist Band holder GAINS 3 (23), ATK floors at 1 (ATK 2 -> 1); a protected target (damage returned 0) is still debuffed (17); nothing restores it in the strategy", [B3TK.star1.tCalls[0].slice(1, 5).concat(B3TK.star1.tCalls[0][5]), [B3TK.star1.tAtk, B3TK.star2.tAtk, B3TK.star3.tAtk, B3TK.fallback.tAtk], [B3TK.star1.damage[0].raw, B3TK.star2.damage[0].raw, B3TK.fallback.damage[0].raw], B3TK.ap100.tAtk, B3TK.crit.tAtk, B3TK.apHalf.tAtk, B3TK.belt.tAtk, B3TK.twist.tAtk, B3TK.floor.tAtk, [B3TK.protect.tAtk, B3TK.protect.damage[0].returned]], [[-3, 1, false, 0, 0], [17, 15, 13, 6], [50, 100, 400], 14, 14, 19, 17, 23, 1, [17, 0]])
const B3MF = B3.mystical
expect("CATCHUP_B3 MYSTICAL_FIRE order and scaling (real strategy, addAbilityPower, handleSpecialDamage; target AP 0): the SPECIAL damage comes FIRST (the AP call index follows it) and then addAbilityPower(-15 / -20 / -25 / -50, caster, apBoost 1, cast crit) on the same target: 1 star at caster AP 100 with a crit (critPower 2) requests and stores -60 (round(-15 x 2 x 2)); a Twist Band holder GAINS 60; AP floors at -100 (-90 -> -100); a Belt on the enemy changes nothing (-15); the AP change still happens when the damage returned 0 (protect and magicBounce) or was capped by a kill (target at 5 HP: returned 5, AP -25 at 3 stars)", [B3MF.star1.tCalls[0][5], B3MF.star1.tAp, B3MF.star2.tAp, [B3MF.apCrit.tCalls[0].slice(1, 4), B3MF.apCrit.tAp], B3MF.twist.tAp, B3MF.floor.tAp, B3MF.belt.tAp, [B3MF.protect.damage[0].returned, B3MF.protect.tAp], [B3MF.bounce.damage[0].returned, B3MF.bounce.tAp], [B3MF.killed.damage[0].returned, B3MF.killed.tAp]], [1, -15, -20, [[-15, 1, true], -60], 60, -100, -15, [0, -15], [0, -15], [5, -25]])
expect("CATCHUP_B3 MYSTICAL_FIRE Nullify Bandanna on the TARGET (real addAbilityPower routing): the Nullify check comes FIRST and routes round(0.2 x the RAW negative request) = round(0.2 x -15) = -3 into addAttack(-3, caster, apBoost 0, crit false), so the caster's AP and crit do NOT scale it: with caster AP 100 and a crit the ordinary target stores -60 AP while a Nullify target keeps AP 0 and loses only 3 ATK (20 -> 17), the same as without caster AP; a Nullify + Twist Band target GAINS 3 ATK (23); ATK floors at 1 (ATK 2 -> 1)", [B3MF.nullify.tAp, B3MF.nullify.tAtk, B3MF.nullify.tCalls.map((c) => c.slice(0, 4)), B3MF.nullifyPlain.tAtk, B3MF.nullifyTwist.tAtk, B3MF.nullifyTwist.tAp, B3MF.nullifyFloor.tAtk], [0, 17, [["addAbilityPower", -15, 1, true], ["addAttack", -3, 0, false]], 17, 23, 0, 1])
// 37. CATCHUP_B4 (batch 2 cycle 4): the real HORN_ATTACK / AIR_SLASH / GIGATON_HAMMER / THUNDER_SHOCK / HEX strategy text with the real triggerArmorReduction / triggerFlinch / triggerFatigue /
// applyStatusDurationReductions, hasNegativeStatus, handleSpecialDamage / handleDamage and addPP text, run against STAND-IN units (mkY). Requests = arguments received; final = stored fields. Not a fight.
const AB8 = "app/core/abilities/"
const HornAttackZ = stratReal(`${AB8}horn-attack.ts`, "HornAttackStrategy"), AirSlashZ = stratReal(`${AB8}air-slash.ts`, "AirSlashStrategy"), GigatonZ = stratReal(`${AB8}gigaton-hammer.ts`, "GigatonHammerStrategy"), ThunderShockZ = stratReal(`${AB8}thunder-shock.ts`, "thunderShockStrategy"), HexZ = stratReal(`${AB8}hex.ts`, "HexStrategy")
const board0 = { getAdjacentCells: () => [] }
const hornAttack = ({ stars = 1, atk = 20, ap = 0, priorArmor = false, targetEffects = [], speDef = 20, rune = false, crit = false }) => {
  const c = mkY({ team: "BLUE_TEAM", stars, atk, ap }), t = mkY({ hp: 5000, speDef, effects: targetEffects, status: { armorReduction: priorArmor, armorReductionCooldown: priorArmor ? 1000 : 0, runeProtect: rune } }); t.maxHP = 5000
  const order = []; const rd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { order.push(["damage", a[0], t.status.armorReduction]); const r = rd(...a); order.push(["taken", r.takenDamage]); return r }
  const ra = t.status.triggerArmorReduction.bind(t.status); t.status.triggerArmorReduction = (d, p) => { order.push(["armorReduction", d, p === t ? "target" : "other"]); return ra(d, p) }
  new HornAttackZ().process(c, board0, t, crit)
  return { order, armorReduction: t.status.armorReduction, cooldown: t.status.armorReductionCooldown }
}
const airSlash = ({ stars = 1, ap = 0, casterEffects = [], targetEffects = [], rune = false, shield = 0, pads = false, protect = false, speDef = 0, hp = 500 }) => {
  const c = mkY({ team: "BLUE_TEAM", stars, ap, effects: casterEffects, items: pads ? ["PROTECTIVE_PADS"] : [] }), t = mkY({ hp, shield, speDef, effects: targetEffects, status: { runeProtect: rune, protect } })
  const order = []; const rd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { order.push(["damage", a[0], t.status.flinch]); return rd(...a) }
  const rf = t.status.triggerFlinch.bind(t.status); t.status.triggerFlinch = (d, p, o) => { order.push(["flinch", d, p === t ? "target" : "other", o === c ? "caster" : "other"]); return rf(d, p, o) }
  new AirSlashZ().process(c, board0, t, false)
  return { order, flinch: t.status.flinch, flinchCooldown: t.status.flinchCooldown, hp: t.hp, shield: t.shield }
}
const gigaton = ({ stars = 1, casterEffects = [], rune = false, odd = 0, preFatigue = 0 }) => {
  const c = mkY({ team: "BLUE_TEAM", stars, effects: casterEffects, player: odd ? { items: Array(odd).fill("ODD_KEYSTONE") } : null, status: { runeProtect: rune, fatigue: !!preFatigue, fatigueCooldown: preFatigue } }), t = mkY({ hp: 5000, speDef: 0 }); t.maxHP = 5000
  const order = []; const rd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { order.push(["damage", a[0], c.status.fatigue]); return rd(...a) }
  const rf = c.status.triggerFatigue.bind(c.status); c.status.triggerFatigue = (d, p, o, ab) => { order.push(["fatigue", d, p === c ? "self" : "other", o === c ? "self" : "other", ab]); return rf(d, p, o, ab) }
  new GigatonZ().process(c, board0, t, false)
  return { order, fatigue: c.status.fatigue, cooldown: c.status.fatigueCooldown }
}
const fatiguedPp = (fatigue, base = 10) => { const u = mkHU({ pp: 10, status: { fatigue } }); u.addPP(base, mkHU({ name: "self" }), 0, false); return u.pp }
const thunderShock = ({ stars = 1, ap = 0, crit = false, shield = 0 }) => {
  const c = mkY({ team: "BLUE_TEAM", stars, ap }), t = mkY({ hp: 5000, speDef: 0, shield }); t.maxHP = 5000
  const calls = []; for (const m of Object.getOwnPropertyNames(StatusY.prototype)) { if (m === "constructor" || typeof t.status[m] !== "function") continue; const real = t.status[m].bind(t.status); t.status[m] = (...a) => { calls.push(m); return real(...a) } }
  const seen = []; const rd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { const r = rd(...a); seen.push({ raw: a[0], type: a[2], crit: a[4], returned: r.takenDamage }); return r }
  ThunderShockZ.process(c, board0, t, crit)
  return { seen, statusCalls: calls, hp: t.hp }
}
const HexStatus = build({}, js(`class HS {\n${cut(ST, 148, 167, "hasNegativeStatus(")}\n}`), "HS")
const hexFlags = ["burn", "silence", "fatigue", "freeze", "sleep", "confusion", "wound", "paralysis", "charm", "flinch", "armorReduction", "curse", "locked", "blinded", "possessed"]
const hex = ({ stars = 1, flags = {}, poisonStacks = 0, cooldowns = {}, ap = 0, protect = false, statChange = false }) => {
  const c = mkY({ team: "BLUE_TEAM", stars, ap }), t = mkY({ hp: 5000, speDef: 0 }); t.maxHP = 5000
  t.status = Object.assign(new HexStatus(), Object.fromEntries(hexFlags.map((f) => [f, false])), { poisonStacks, protect, skydiving: false, magicBounce: false, resurrecting: false, runeProtect: false }, flags, cooldowns)
  if (statChange) t.atk = 1
  const seen = []; const rd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { const r = rd(...a); seen.push({ raw: a[0], returned: r.takenDamage }); return r }
  new HexZ().process(c, board0, t, false)
  return { raw: seen[0].raw, returned: seen[0].returned }
}
out.CATCHUP_B4 = {
  hornAttack: { star1: hornAttack({}), star2: hornAttack({ stars: 2 }), star3: hornAttack({ stars: 3 }), star4: hornAttack({ stars: 4 }), star5: hornAttack({ stars: 5 }), prior: hornAttack({ priorArmor: true }), hydration: hornAttack({ targetEffects: ["HYDRATION"] }), rune: hornAttack({ rune: true }), ap100: hornAttack({ ap: 100 }), atkChange: hornAttack({ atk: 34 }) },
  airSlash: { plain: airSlash({}), star2: airSlash({ stars: 2 }), targetHydration: airSlash({ targetEffects: ["HYDRATION"] }), casterHydration: airSlash({ casterEffects: ["HYDRATION"] }), rune: airSlash({ rune: true }), runeShield: airSlash({ rune: true, shield: 20 }), shield: airSlash({ shield: 20 }), shieldSmall: airSlash({ shield: 5 }), shieldPads: airSlash({ shield: 20, pads: true }), noShield: airSlash({}), protect: airSlash({ protect: true }) },
  gigaton: { star1: gigaton({}), star3: gigaton({ stars: 3 }), star5: gigaton({ stars: 5 }), hydration: gigaton({ casterEffects: ["HYDRATION"] }), odd: gigaton({ odd: 2 }), rune: gigaton({ rune: true }), longer: gigaton({ preFatigue: 9000 }), pp: { plain: fatiguedPp(false), fatigued: fatiguedPp(true), fatiguedOdd: fatiguedPp(true, 5), loss: fatiguedPp(true, -5) } },
  thunderShock: { star1: thunderShock({}), star2: thunderShock({ stars: 2 }), star3: thunderShock({ stars: 3 }), star5: thunderShock({ stars: 5 }), ap100: thunderShock({ ap: 100 }), crit: thunderShock({ crit: true }) },
  hex: { none: hex({}), star2: hex({ stars: 2 }), star3: hex({ stars: 3 }), poisoned: hex({ poisonStacks: 2 }), noStacks: hex({ poisonStacks: 0 }), woundFlagCooldown0: hex({ flags: { wound: true }, cooldowns: { woundCooldown: 0 } }), cooldownOnly: hex({ cooldowns: { burnCooldown: 5000, woundCooldown: 3000, poisonCooldown: 4000 } }), statChange: hex({ statChange: true }), perFlag: Object.fromEntries(hexFlags.map((f) => [f, hex({ flags: { [f]: true } }).raw])), ap100: hex({ flags: { burn: true }, ap: 100 }), protect: hex({ flags: { burn: true }, protect: true }) }
}
const B4 = out.CATCHUP_B4

const B4HA = B4.hornAttack, B4AS = B4.airSlash, B4GH = B4.gigaton, B4TS = B4.thunderShock, B4HX = B4.hex
expect("CATCHUP_B4 HORN_ATTACK (real strategy, real handleSpecialDamage / handleDamage and triggerArmorReduction on a stand-in target, SPE_DEF 20, caster atk 20): the damage request is multiplier [3, 4, 5, 10] (fallback 10) x the caster's CURRENT atk (1 star 60, 2 stars 80, 3 stars 100, 4 stars 200, 5 stars 200; atk 34 -> 102), then triggerArmorReduction(8000, target) AFTER the damage: the new reduction does not help this hit (returned 30 = 60 / 2) while an ALREADY-active armor reduction halves SPE_DEF for it (returned 40); the duration reductions come from the supplied TARGET (target HYDRATION stores 4000) and the Rune Protect guard is the target's status (flag and timer stay off); AP 100 doubles the returned damage (60)", [B4HA.star1.order, [B4HA.star2.order[0][1], B4HA.star3.order[0][1], B4HA.star4.order[0][1], B4HA.star5.order[0][1], B4HA.atkChange.order[0][1]], B4HA.prior.order[1], B4HA.hydration.cooldown, [B4HA.rune.armorReduction, B4HA.rune.cooldown], B4HA.ap100.order[1]], [[["damage", 60, false], ["taken", 30], ["armorReduction", 8000, "target"]], [80, 100, 200, 200, 102], ["taken", 40], 4000, [false, 0], ["taken", 60]])
expect("CATCHUP_B4 AIR_SLASH order and guards (real strategy, real triggerFlinch / applyStatusDurationReductions): the flinch request triggerFlinch(7000, TARGET, caster) comes BEFORE the SPECIAL damage (25 / 50 for 1 / 2 stars) and the damage sees the flinch flag; unlike ROCK_WRECKER the duration reductions come from the TARGET (target HYDRATION stores 3500, caster HYDRATION leaves 7000); the target's Rune Protect refuses the flinch independently of the damage (flag false, HP still 475); a protected target is still flinched while the damage is blocked (HP 500)", [B4AS.plain.order, B4AS.star2.order[1][1], B4AS.targetHydration.flinchCooldown, B4AS.casterHydration.flinchCooldown, [B4AS.rune.flinch, B4AS.rune.hp], [B4AS.protect.flinch, B4AS.protect.hp]], [[["flinch", 7000, "target", "caster"], ["damage", 25, true]], 50, 3500, 7000, [false, 475], [true, 500]])
expect("CATCHUP_B4 AIR_SLASH flinch shield split (target shield, SPE_DEF 0, raw 25, HP 500): with the flinch active the first split is ceil(50 %) = 13 on the shield and 13 residual (shield 20: shield 7, HP 487, total 26 for a 25 hit); a SMALL shield (5) overflows into the residual (HP 479, shield 0); an attacker's Protective Pads change the shield part and so the final losses (HP 481); without the flinch (Rune Protect) the shield just absorbs first (shield 20 -> HP 495); the flinch is therefore not a promise of a 50/50 final split or of a persistent flinch on every hit", [[B4AS.shield.hp, B4AS.shield.shield], [B4AS.shieldSmall.hp, B4AS.shieldSmall.shield], [B4AS.shieldPads.hp, B4AS.shieldPads.shield], B4AS.runeShield.hp], [[487, 7], [479, 0], [481, 0], 495])
expect("CATCHUP_B4 GIGATON_HAMMER (real strategy, real triggerFatigue / applyStatusDurationReductions): the CASTER fatigues itself with triggerFatigue(6000, self, self) BEFORE the SPECIAL damage 100 / 400 / fallback 800 (the damage call already sees fatigue true) - unlike ROCK_WRECKER, which fatigues after its hit; guard and duration reductions read the CASTER: HYDRATION stores 3000, two Odd Keystones 4800, Rune Protect leaves no fatigue at all (flag false), an already longer fatigue (9000) is kept - so it is not a guaranteed 6 s application; with the flag on, the caster's positive PP gains through the real addPP are halved (+10 -> +5: PP 15; +5 -> 2.5 -> 3: PP 13) while a negative change is not (PP 5)", [B4GH.star1.order, B4GH.star3.order[1][1], B4GH.star5.order[1][1], B4GH.hydration.cooldown, B4GH.odd.cooldown, [B4GH.rune.fatigue, B4GH.rune.cooldown], B4GH.longer.cooldown, B4GH.pp], [[["fatigue", 6000, "self", "self", null], ["damage", 100, true]], 400, 800, 3000, 4800, [false, 0], 9000, { plain: 20, fatigued: 15, fatiguedOdd: 13, loss: 5 }])
expect("CATCHUP_B4 THUNDER_SHOCK (real exported thunderShockStrategy instance): one direct SPECIAL hit 30 / 60 / 120 (240 fallback) with NO status call of any kind on the target (zero calls to any Status method); AP 100 or a crit doubles the returned damage (60)", [B4TS.star1.seen[0].raw, B4TS.star2.seen[0].raw, B4TS.star3.seen[0].raw, B4TS.star5.seen[0].raw, B4TS.star1.statusCalls, B4TS.ap100.seen[0].returned, B4TS.crit.seen[0].returned], [30, 60, 120, 240, [], 60, 60])
expect("CATCHUP_B4 HEX (real strategy and the real status.hasNegativeStatus predicate): the raw 20 / 40 / 80 is doubled when ANY of burn, silence, fatigue, freeze, sleep, confusion, wound, paralysis, charm, flinch, armorReduction, curse, locked, blinded, possessed is set, or poisonStacks > 0 (all fifteen flags checked one by one -> 40 at 1 star; 2 stacks 40, 0 stacks 20); the predicate tests flags only, no timers: a wound flag with woundCooldown 0 (as after clearNegativeStatus, before the next update) still doubles, while cooldowns alone with the flags false (burn 5000, wound 3000, poison 4000) do not; a negative stat change does not double it; the doubling happens before handleSpecialDamage's AP (AP 100: raw 40 returns 80) and a protected target returns 0", [Object.values(B4HX.perFlag), B4HX.poisoned.raw, B4HX.noStacks.raw, B4HX.woundFlagCooldown0.raw, B4HX.cooldownOnly.raw, B4HX.statChange.raw, [B4HX.none.raw, B4HX.star2.raw, B4HX.star3.raw], [B4HX.ap100.raw, B4HX.ap100.returned], B4HX.protect.returned], [Array(15).fill(40), 40, 20, 40, 20, 20, [20, 40, 80], [40, 80], 0])
// 38. CATCHUP_C0 (batch 3 cleanup): the real addAttack / addSpecialDefense text round the WHOLE product Math.round(raw x (1 + AP/100) x (crit ? critPower : 1)); non-integer AP / crit products
// (AP 100 or critPower 2 would hide the disagreement). Real QUIVER_DANCE and HAPPY_HOUR strategy text on stand-in casters. Not a fight.
const nonInt = (Strat, file, cls, o) => { const S = stratReal(`app/core/abilities/${file}.ts`, cls); const u = mkSelf({ ap: o.ap }); u.critPower = o.critPower; u.stars = o.stars; u.team = BLUE_Z; u.id = "c"
  const board = { forEach: (cb) => cb(0, 0, u) }; (S.process ? S : new S()).process(u, board, null, true); return { atk: u.atk, speDef: u.speDef } }
out.CATCHUP_C0 = { quiver: nonInt(0, "quiver-dance", "QuiverDanceStrategy", { ap: 10, critPower: 1.5, stars: 1 }), happy: nonInt(0, "happy-hour", "HappyHourStrategy", { ap: 30, critPower: 1.5, stars: 1 }) }
expect("CATCHUP_C0 QUIVER_DANCE (real strategy, addAttack / addSpecialDefense, ATK 20 / SPE_DEF 10, raw 3, AP 10, critPower 1.5, crit true): one rounding of the whole product round(3 x 1.1 x 1.5 = 4.95) = 5 for both (ATK 25, SPE_DEF 15) - not 4.5 and not round(3.3) x 1.5", [out.CATCHUP_C0.quiver.atk, out.CATCHUP_C0.quiver.speDef], [25, 15])
expect("CATCHUP_C0 HAPPY_HOUR (real strategy and addAttack, ATK 20, raw 2, AP 30, critPower 1.5, crit true): round(2 x 1.3 x 1.5 = 3.9) = 4 (ATK 24) - not round(2 x 1.3) x 1.5 = 4.5", out.CATCHUP_C0.happy.atk, 24)
// 39. CATCHUP_D1 (batch 3 cycle 1): the real MAGIC_BOUNCE / RECOVER / SLACK_OFF / SOFT_BOILED / AURORA_VEIL strategy text with the real triggerMagicBounce / triggerSleep / triggerRuneProtect /
// clearNegativeStatus / applyStatusDurationReductions, handleSpecialDamage (bounce branch), handleHeal / addShield / addMaxHP / addPP text and DelayedCommand, run against STAND-IN units. Not a fight.
const AB9 = "app/core/abilities/"
const StatusMB = build({ Weather: enums(), EffectEnum: enums(), Item: enums(), Passive: enums(), count }, js(`class SM {\n${cut(ST, 122, 146, "clearNegativeStatus(")}\n${cut(ST, 760, 786, "triggerSleep(")}\n${cut(ST, 956, 966, "triggerRuneProtect(")}\n${cut(ST, 1011, 1016, "triggerMagicBounce(")}\n${cut(ST, 1282, 1305, "private applyStatusDurationReductions(").replace("private ", "")}\n}`), "SM")
const caster9 = (o = {}) => {
  const u = mkHU({ hp: o.hp ?? 500, maxHP: o.maxHP ?? 1000, status: o.status ?? {}, items: o.items ?? [], grass: o.grass, weather: o.weather ?? "NONE", stones: o.stones ?? 0, name: o.name ?? "caster" })
  Object.setPrototypeOf(u.status, StatusMB.prototype)
  Object.assign(u.status, { sleep: false, sleepCooldown: 0, skydiving: false, ccCooldown: 0, runeProtect: false, runeProtectCooldown: 0, magicBounce: false, magicBounceCooldown: 0, burnCooldown: 0, poisonCooldown: 0, possessed: false, possessedCooldown: 0, curse: false, curseCooldown: 0, ...(o.status ?? {}) })
  Object.assign(u, { stars: o.stars ?? 1, ap: o.ap ?? 0, count: { ult: 0 }, team: BLUE_Z, skill: "X", id: o.name ?? "caster", effects: new Set(o.effects ?? []), player: o.player ?? u.player })
  u.broadcasts = []; u.broadcastAbility = (a) => u.broadcasts.push(a ? [a.positionX, a.positionY] : "default"); u.simulation = { ...u.simulation, blueAbilitiesCast: [], redAbilitiesCast: [] }
  u.eaten = []; u.eatBerry = (b) => u.eaten.push(b)
  return u
}
// ---- MAGIC_BOUNCE
const MagicBounceX = stratReal(`${AB9}magic-bounce.ts`, "MagicBounceStrategy")
const magicCast = (o = {}) => { const u = caster9(o); new MagicBounceX().process(u, {}, null, false); return { magicBounce: u.status.magicBounce, cd: u.status.magicBounceCooldown, pp: u.pp } }
const bounceFixture = ({ attackType = "SPECIAL", damage = 100, stars = 1, ap = 0, critPower = 2, crit = false, abilityCrit = false, pads = false, attackerBounce = false, lateAp = null, lateStars = null } = {}) => {
  const h = mkFU({ team: "RED", hp: 500, maxHP: 1000, stars, ap }); h.status.magicBounce = true; h.critPower = critPower; h.critChance = 0; h.effects = new Set(abilityCrit ? ["ABILITY_CRIT"] : []); h.broadcastAbility = () => {}; h.skill = "H"; h.positionX = 0; h.positionY = 0
  const a = mkFU({ team: "BLUE", items: new Set(pads ? ["PROTECTIVE_PADS"] : []) }); a.skill = "A"; a.positionX = 1; a.positionY = 0; a.status.magicBounce = attackerBounce
  const direct = [], viaSpecial = []; a.handleDamage = (x) => { direct.push({ damage: x.damage, type: x.attackType, retaliation: x.isRetaliation, attacker: x.attacker === h }); return { death: false, takenDamage: 0 } }; const hs = a.handleSpecialDamage; a.handleSpecialDamage = (...q) => { viaSpecial.push(q[0]); return hs.apply(a, q) }
  const r = h.handleSpecialDamage(damage, board0, attackType, a, crit)
  const queued = h.commands.length, delay = h.commands[0]?.delay
  if (lateAp !== null) h.ap = lateAp; if (lateStars !== null) h.stars = lateStars
  h.commands.forEach((c) => c.update(501))
  return { returned: r, queued, delay, direct, viaSpecial, blockedCount: h.count.spellBlockedCount, hp: h.hp }
}
// ---- RECOVER: percent of current maxHP through handleHeal
const RecoverX = stratReal(`${AB9}recover.ts`, "RecoverStrategy")
const recover = ({ stars = 1, hp = 500, status = {}, weather = "NONE", stones = 0, ap = 0, crit = false, grass = false, items = [] } = {}) => {
  const u = caster9({ stars, hp, status, weather, stones, ap, grass, items }); const heals = []; const real = u.handleHeal.bind(u); u.handleHeal = (...a) => { const r = real(...a); heals.push({ request: a[0], apBoost: a[2], crit: a[3], returned: r }); return r }
  new RecoverX().process(u, {}, null, crit); return { heals, hp: u.hp, maxHP: u.maxHP, shield: u.shield, downstream: u.requests.map((d) => [d.helper, d.request, d.apBoost, d.crit]) }
}
// ---- SLACK_OFF: clearNegativeStatus -> heal -> triggerSleep(3000)
const SlackOffX = stratReal(`${AB9}slack-off.ts`, "SlackOffStrategy")
const slackOff = (o = {}) => {
  const u = caster9({ hp: 500, ...o }); if (o.hp === 0) u.hp = 0; const order = []
  for (const [obj, m] of [[u.status, "clearNegativeStatus"], [u, "handleHeal"], [u.status, "triggerSleep"]]) { const real = obj[m].bind(obj); obj[m] = (...a) => { order.push(m === "handleHeal" ? [m, a[0]] : m === "triggerSleep" ? [m, a[0]] : [m]); return real(...a) } }
  new SlackOffX().process(u, {}, null, !!o.crit)
  return { order, hp: u.hp, shield: u.shield, sleep: u.status.sleep, sleepCooldown: u.status.sleepCooldown, burn: u.status.burn, burnCooldown: u.status.burnCooldown, wound: u.status.wound, woundCooldown: u.status.woundCooldown, eaten: u.eaten, curseCooldown: u.status.curseCooldown }
}
// ---- SOFT_BOILED / AURORA_VEIL: board loop over same-team units
const SoftBoiledX = stratReal(`${AB9}soft-boiled.ts`, "SoftBoiledStrategy"), AuroraVeilX = stratReal(`${AB9}aurora-veil.ts`, "AuroraVeilStrategy")
const teamBoard = (o) => {
  const c = caster9({ stars: o.stars ?? 1, ap: o.ap ?? 0 }); const units = [c]
  for (const x of o.allies ?? []) { const u = caster9({ name: x.name, hp: x.hp ?? 500, status: x.status ?? {}, items: x.items ?? [] }); u.team = x.team ?? BLUE_Z; units.push(u); }
  const log = []; for (const u of units) { for (const m of ["addShield", "clearNegativeStatus", "triggerRuneProtect"]) { const tgt = m === "addShield" ? u : u.status; const real = tgt[m].bind(tgt); tgt[m] = (...a) => { log.push([u.name, m]); return real(...a) } } }
  const board = { forEach: (cb) => units.forEach((u, i) => cb(i % 8, Math.floor(i / 8), u)) }
  return { c, units, log, board }
}
const softBoiled = (o = {}) => { const t = teamBoard(o); new SoftBoiledX().process(t.c, t.board, null, !!o.crit); return t }
const auroraVeil = (o = {}) => { const t = teamBoard(o); new AuroraVeilX().process(t.c, t.board, null, !!o.crit); return t }
const sum = (t) => Object.fromEntries(t.units.map((u) => [u.name, { shield: u.shield, hp: u.hp }]))
const rp = (t) => Object.fromEntries(t.units.map((u) => [u.name, { rune: u.status.runeProtect, cd: u.status.runeProtectCooldown, burnFlag: u.status.burn, burnCd: u.status.burnCooldown, shield: u.shield }]))
const runeHit = () => { const t = mkFU({ team: "RED", hp: 500, maxHP: 1000, speDef: 0 }); t.status.runeProtect = true; const a = mkFU({ team: "BLUE" }); const r = t.handleSpecialDamage(100, board0, "SPECIAL", a, false); return { returned: r.takenDamage, hp: t.hp } }
out.CATCHUP_D1 = {
  magicBounce: { cast: magicCast(), keepLonger: magicCast({ status: { magicBounceCooldown: 10000, magicBounce: true } }), shorter: magicCast({ status: { magicBounceCooldown: 2000, magicBounce: true } }),
    special: bounceFixture({}), trueType: bounceFixture({ attackType: "TRUE" }), physical: bounceFixture({ attackType: "PHYSICAL" }), zero: bounceFixture({ damage: 0 }), pads: bounceFixture({ pads: true }), star2: bounceFixture({ stars: 2 }), star5: bounceFixture({ stars: 5 }), ap100: bounceFixture({ ap: 100 }),
    incomingCrit: bounceFixture({ crit: true }), noCrit: bounceFixture({}), abilityCritNoRoll: bounceFixture({ abilityCrit: true }), lateRead: bounceFixture({ ap: 0, lateAp: 100, stars: 1, lateStars: 2 }), attackerBouncing: bounceFixture({ attackerBounce: true }) },
  recover: { star1: recover(), star3: recover({ stars: 3 }), star4: recover({ stars: 4 }), star5: recover({ stars: 5 }), ap100: recover({ ap: 100 }), crit: recover({ crit: true }), protect: recover({ status: { protect: true } }), woundNoMoon: recover({ status: { wound: true } }), woundMoon: recover({ status: { wound: true }, weather: "BLOODMOON", stones: 1 }), woundMoonProtect: recover({ status: { wound: true, protect: true }, weather: "BLOODMOON", stones: 1, ap: 100 }), woundMoonDead: recover({ hp: 0, status: { wound: true }, weather: "BLOODMOON", stones: 1 }), burn: recover({ status: { burn: true } }), zenith: recover({ weather: "ZENITH" }), grass: recover({ hp: 900, grass: true }), runeProtect: recover({ status: { runeProtect: true } }) },
  slackOff: { plain: slackOff({}), star4: slackOff({ stars: 4 }), wound: slackOff({ status: { wound: true, woundCooldown: 3000 }, weather: "BLOODMOON", stones: 1 }), woundNoMoon: slackOff({ status: { wound: true, woundCooldown: 3000 } }), burn: slackOff({ status: { burn: true, burnCooldown: 4000 } }), alreadyAsleep: slackOff({ status: { sleep: true, sleepCooldown: 500 } }), rune: slackOff({ status: { runeProtect: true } }), skydiving: slackOff({ status: { skydiving: true } }), immune: slackOff({ effects: ["IMMUNITY_SLEEP"] }), cc: slackOff({ status: { ccCooldown: 500 } }), night: slackOff({ weather: "NIGHT" }), zenith: slackOff({ weather: "ZENITH" }), enraged: slackOff({ status: { enraged: true } }), hydration: slackOff({ effects: ["HYDRATION"] }), chesto: slackOff({ items: ["CHESTO_BERRY"] }), curse: slackOff({ status: { curse: true, curseCooldown: 1000 } }) },
  softBoiled: { base: softBoiled({ allies: [{ name: "ally" }, { name: "foe", team: RED_Z }] }), ap50: softBoiled({ ap: 50, allies: [{ name: "belt", items: ["BIG_EATER_BELT"] }, { name: "plain" }] }), crit: softBoiled({ crit: true, allies: [{ name: "a" }] }), enraged: softBoiled({ allies: [{ name: "rage", status: { enraged: true } }] }), dead: softBoiled({ allies: [{ name: "dead", hp: 0, status: { burn: true, burnCooldown: 4000, woundCooldown: 3000, wound: true } }] }), protectWound: softBoiled({ allies: [{ name: "pw", status: { protect: true, wound: true } }] }), flags: softBoiled({ allies: [{ name: "flagged", status: { burn: true, burnCooldown: 4000, possessed: true, possessedCooldown: 5000 } }] }) },
  auroraVeil: { base: auroraVeil({ allies: [{ name: "ally" }, { name: "foe", team: RED_Z }] }), ap50: auroraVeil({ ap: 50, allies: [{ name: "belt", items: ["BIG_EATER_BELT"] }] }), dead: auroraVeil({ allies: [{ name: "dead", hp: 0 }] }), longer: auroraVeil({ allies: [{ name: "long", status: { runeProtect: true, runeProtectCooldown: 3000 } }, { name: "short", status: { runeProtect: true, runeProtectCooldown: 400 } }] }), flags: auroraVeil({ allies: [{ name: "flagged", status: { burn: true, burnCooldown: 4000 } }] }), runeHit: runeHit(), runeHeal: (() => { const u = mkHU({ status: { runeProtect: true } }); return healOf(u, 20).returned })() }
}
const C1X = out.CATCHUP_D1

const C1MB = C1X.magicBounce
const bd = (x) => x.direct.map((d) => d.damage)
expect("CATCHUP_D1 MAGIC_BOUNCE cast (real strategy and triggerMagicBounce): the cast spends PP and sets magicBounce with a requested 5000 ms; a longer existing timer is kept (10000) and a shorter one is replaced (2000 -> 5000)", [C1MB.cast, C1MB.keepLonger.cd, C1MB.shorter.cd], [{ magicBounce: true, cd: 5000, pp: 0 }, 10000, 5000])
expect("CATCHUP_D1 MAGIC_BOUNCE block and queue (real handleSpecialDamage, real DelayedCommand, stand-in attacker; holder 1 star): every attack type entering handleSpecialDamage is blocked (returned takenDamage 0, spellBlockedCount 1 for SPECIAL, TRUE and PHYSICAL alike) but only a SPECIAL hit with damage > 0 and an attacker without Protective Pads queues a bounce (SPECIAL 1 command, TRUE / PHYSICAL / zero damage / Pads 0); the command delay is 500; the delayed bounce calls attacker.handleDamage DIRECTLY with isRetaliation true (handleSpecialDamage is never called again, so an attacker's own magicBounce does not block it); no callback lifecycle (death, end of fight) is claimed", [C1MB.special.queued, C1MB.special.delay, C1MB.special.direct[0].retaliation, C1MB.special.viaSpecial, C1MB.attackerBouncing.viaSpecial, [C1MB.trueType.queued, C1MB.physical.queued, C1MB.zero.queued, C1MB.pads.queued], [C1MB.trueType.blockedCount, C1MB.physical.blockedCount], C1MB.special.returned], [1, 500, true, [], [], [0, 0, 0, 0], [1, 1], { death: false, takenDamage: 0 }])
expect("CATCHUP_D1 MAGIC_BOUNCE amount (raw incoming 100, holder critPower 2): bounce = round(factor [0.5, 1, 2, 4] x raw x (1 + holder AP/100) x (bounceCrit ? critPower : 1)) with the holder's stars / AP / critPower read when the CALLBACK runs: 1 star 50, 2 stars 100, 5 stars 400; an incoming crit alone forces bounceCrit WITHOUT holder ABILITY_CRIT (50 x 2 = 100), while holder ABILITY_CRIT without a successful roll leaves it 50; AP 100 alone doubles (100); changing the holder to 2 stars and AP 100 after the hit was queued gives 1 x 100 x 2 = 200 (read at callback time)", [bd(C1MB.noCrit), bd(C1MB.star2), bd(C1MB.star5), bd(C1MB.ap100), bd(C1MB.incomingCrit), bd(C1MB.abilityCritNoRoll), bd(C1MB.lateRead)], [[50], [100], [400], [100], [100], [50], [200]])
const C1RC = C1X.recover
const rcs = (x) => [x.heals[0].request, x.heals[0].returned.healReceived, x.heals[0].returned.overheal, x.hp, x.shield]
expect("CATCHUP_D1 RECOVER request and ordinary guards (real strategy, real handleHeal; maxHP 1000, hp 500): request [25, 25, 50, 100] percent of the CURRENT maxHP through handleHeal(self, apBoost 1, crit): 1 star 250 (hp 750), 3 stars 500 (hp 1000), 4 stars / fallback 1000 (received 500, overheal 500); AP 100 or a crit doubles the applied heal (500); protect gives 0; Rune Protect alone heals; burn halves (125); ZENITH x1.2 (300)", [rcs(C1RC.star1), rcs(C1RC.star3), rcs(C1RC.star4), rcs(C1RC.star5), C1RC.ap100.heals[0].returned.healReceived, C1RC.crit.heals[0].returned.healReceived, C1RC.protect.heals[0].returned.healReceived, C1RC.runeProtect.heals[0].returned.healReceived, C1RC.burn.heals[0].returned.healReceived, C1RC.zenith.heals[0].returned.healReceived], [[250, 250, 0, 750, 0], [500, 500, 0, 1000, 0], [1000, 500, 500, 1000, 0], [1000, 500, 500, 1000, 0], 500, 500, 0, 250, 125, 300])
expect("CATCHUP_D1 RECOVER wound branch (real handleHeal / addShield): a wounded caster heals 0, so the old claims 'nothing at all' and 'no shield' are wrong: the wound check comes BEFORE the alive / Protect guard and, under BLOODMOON weather with a BLOOD_STONE owner, requests addShield(round(0.3 x stones x the raw request 250) = 75, apBoost 1, crit): shield 75, AP 100 -> 150, Protect does not stop it, a caster at 0 HP makes the request but keeps shield 0, without BLOODMOON no request; the Grass overheal requests addMaxHP(0.4 x overheal): hp 900 -> received 100, overheal 150, request 60, maxHP 1060", [C1RC.woundMoon.downstream, C1RC.woundMoon.shield, C1RC.woundMoonProtect.shield, C1RC.woundMoonDead.downstream, C1RC.woundMoonDead.shield, C1RC.woundNoMoon.downstream, C1RC.grass.downstream, C1RC.grass.maxHP], [[["addShield", 75, 1, false]], 75, 150, [["addShield", 75, 1, false]], 0, [], [["addMaxHP", 60, 0, false]], 1060])
const C1SO = C1X.slackOff
expect("CATCHUP_D1 SLACK_OFF order and heal (real strategy, real clearNegativeStatus / handleHeal / triggerSleep): the order is clearNegativeStatus, handleHeal(maxHP x 0.3, 0.6 at 4 stars / fallback), triggerSleep(3000); the cleanse zeroes COOLDOWNS only, so a burn flag survives into the heal and halves it (hp 500 -> 650 instead of 800) and a wound flag with cooldown 0 blocks HP healing (hp stays 500) but, under BLOODMOON with a BLOOD_STONE owner, requests the shield replacement (round(0.3 x 300) = 90); plain hp 500 -> 800, 4 stars -> 1000; a running curse cooldown gets +2000 (1000 -> 3000)", [C1SO.plain.order, C1SO.plain.hp, C1SO.star4.hp, C1SO.burn.hp, [C1SO.burn.burn, C1SO.burn.burnCooldown], [C1SO.wound.hp, C1SO.wound.shield, C1SO.wound.wound, C1SO.wound.woundCooldown], [C1SO.woundNoMoon.hp, C1SO.woundNoMoon.shield], C1SO.curse.curseCooldown], [[["clearNegativeStatus"], ["handleHeal", 300], ["triggerSleep", 3000]], 800, 1000, 650, [true, 0], [500, 90, true, 0], [500, 0], 3000])
expect("CATCHUP_D1 SLACK_OFF sleep attempt (real triggerSleep / applyStatusDurationReductions): the sleep is an attempt with guards - a sleep flag already set (the cleanse zeroes its cooldown but not the flag, so it stays refused), Rune Protect, skydiving, IMMUNITY_SLEEP and ccCooldown > 0 each leave the caster awake; otherwise NIGHT weather x1.3 stores 3900, ZENITH x0.7 stores 2100 (and heal x1.2: hp 860), an enraged caster halves it (1500; the heal halves too: hp 650), HYDRATION halves it (1500), a CHESTO_BERRY holder requests eatBerry; plain stores 3000", [C1SO.plain.sleepCooldown, [C1SO.alreadyAsleep.sleep, C1SO.alreadyAsleep.sleepCooldown], C1SO.rune.sleep, C1SO.skydiving.sleep, C1SO.immune.sleep, C1SO.cc.sleep, C1SO.night.sleepCooldown, [C1SO.zenith.sleepCooldown, C1SO.zenith.hp], [C1SO.enraged.sleepCooldown, C1SO.enraged.hp], C1SO.hydration.sleepCooldown, C1SO.chesto.eaten], [3000, [true, 0], false, false, false, false, 3900, [2100, 860], [1500, 650], 1500, ["CHESTO_BERRY"]])
const C1SB = C1X.softBoiled, C1AV = C1X.auroraVeil
const unitC1 = (t, n) => t.units.find((u) => u.name === n)
expect("CATCHUP_D1 SOFT_BOILED (real strategy, real addShield / clearNegativeStatus; stand-in board): every non-null same-team entity, the caster included, gets (in this order per unit) addShield then clearNegativeStatus and the caster broadcasts per unit (enemies untouched); shield 20 / 40 (crit) as raw; the recipient's Big Eater Belt comes BEFORE the caster's AP and crit: AP 50 gives 30 for a plain ally but round(25 x 1.5) = 38 for a Belt holder; an enraged recipient halves it (10); shields are not heals - Protect and wound do not block them (20) - and the loop has no HP filter: an ally at 0 HP gets no shield (alive gate) but is still cleansed (cooldowns 0); the cleanse leaves flags (a burn flag stays true) and, because the recipient's team equals the supplied caster's, keeps an active possession cooldown (5000)", [C1SB.base.log.map((l) => l.join(":")).join(" "), unitC1(C1SB.base, "foe").shield, unitC1(C1SB.crit, "a").shield, [unitC1(C1SB.ap50, "plain").shield, unitC1(C1SB.ap50, "belt").shield], unitC1(C1SB.enraged, "rage").shield, unitC1(C1SB.protectWound, "pw").shield, [unitC1(C1SB.dead, "dead").shield, unitC1(C1SB.dead, "dead").status.burn, unitC1(C1SB.dead, "dead").status.woundCooldown], [unitC1(C1SB.flags, "flagged").status.burn, unitC1(C1SB.flags, "flagged").status.possessedCooldown]], ["caster:addShield caster:clearNegativeStatus ally:addShield ally:clearNegativeStatus", 0, 40, [30, 38], 10, 20, [0, true, 0], [true, 5000]])
expect("CATCHUP_D1 AURORA_VEIL (real strategy, real addShield / triggerRuneProtect / clearNegativeStatus): per same-team entity addShield 5 / 10 (AP and Belt as for SOFT_BOILED: AP 50 gives 8, Belt holder round(6 x 1.5) = 9) THEN triggerRuneProtect(1000, recipient, caster), which clears negative cooldowns (a burn flag stays true) and keeps a longer remaining rune timer (3000) while replacing a shorter one (400 -> 1000); the rune application does not depend on the shield or on the recipient being alive (an ally at 0 HP: shield 0, rune true); Rune Protect is not Protect: a rune-protected unit still takes a 100 SPECIAL hit (HP 500 -> 400) and still receives a heal (20)", [C1AV.base.log.map((l) => l.join(":")).join(" "), [unitC1(C1AV.ap50, "caster").shield, unitC1(C1AV.ap50, "belt").shield], [unitC1(C1AV.dead, "dead").shield, unitC1(C1AV.dead, "dead").status.runeProtect], [unitC1(C1AV.longer, "long").status.runeProtectCooldown, unitC1(C1AV.longer, "short").status.runeProtectCooldown], [unitC1(C1AV.flags, "flagged").status.burn, unitC1(C1AV.flags, "flagged").status.burnCooldown], C1AV.runeHit, C1AV.runeHeal.healReceived], ["caster:addShield caster:triggerRuneProtect caster:clearNegativeStatus ally:addShield ally:triggerRuneProtect ally:clearNegativeStatus", [8, 9], [0, true], [3000, 1000], [true, 0], { returned: 100, hp: 400 }, 20])
// 40. CATCHUP_D2 (batch 3 cycle 2): the real DYNAMIC_PUNCH / FAKE_OUT / POWER_HUG / STRING_SHOT / BURN_UP strategy text with the real triggerConfusion / triggerLocked / triggerParalysis / triggerFlinch /
// triggerBurn / applyStatusDurationReductions, handleSpecialDamage, addAbilityPower / addAttack, moveTo / canBeMoved / canCast and castAbility text, run against STAND-IN units (mkCombat). Not a fight.
const AB10 = "app/core/abilities/"
const StatusD = build({ Weather: enums(), EffectEnum: enums(), Item: enums(), Passive: enums(), count }, js(`class SD {\n${cut(ST, 397, 438, "triggerBurn(")}\n${cut(ST, 806, 835, "triggerConfusion(")}\n${cut(ST, 908, 939, "triggerParalysis(")}\n${cut(ST, 976, 986, "triggerFlinch(")}\n${cut(ST, 1142, 1163, "triggerLocked(")}\n${cut(ST, 1282, 1305, "private applyStatusDurationReductions(").replace("private ", "")}\n}`), "SD")
const stFields = { confusion: false, confusionCooldown: 0, locked: false, lockedCooldown: 0, paralysis: false, paralysisCooldown: 0, flinch: false, flinchCooldown: 0, burn: false, burnCooldown: 0, burnOrigin: null, runeProtect: false, skydiving: false, ccCooldown: 0, enraged: false, protect: false, magicBounce: false }
const unitD = (team, o = {}) => {
  const u = mkCombat(team, { ap: o.ap, stars: o.stars, hp: o.hp, items: o.items, effects: o.effects, shield: o.shield, speDef: o.speDef, atk: o.atk, protect: o.protect })
  Object.setPrototypeOf(u.status, StatusD.prototype); Object.assign(u.status, stFields, { protect: !!o.protect }, o.status ?? {})
  u.player = o.player ?? null; u.passive = o.passive ?? "NONE"; u.range = o.range ?? 1; u.baseRange = 1; u.moves = 0; u.toMovingState = () => { u.moves++ }; u.eaten = []; u.eatBerry = (b) => u.eaten.push(b); u.simulation = { ...u.simulation, weather: o.weather ?? "NONE" }
  u.stat = []; for (const m of ["addAttack", "addDefense", "addSpeed", "addAbilityPower"]) { const real = u[m] ? u[m].bind(u) : null; u[m] = (...a) => { u.stat.push([m, a[0], a[2], a[3]]); return real ? real(...a) : undefined } }
  u.addAbilityPower = SF.prototype.addAbilityPower.bind(u); { const f = u.addAbilityPower; u.addAbilityPower = (...a) => { u.stat.push(["addAbilityPower", a[0], a[2], a[3]]); return f(...a) } }
  u.addAttack = SF.prototype.addAttack.bind(u); { const f = u.addAttack; u.addAttack = (...a) => { u.stat.push(["addAttack", a[0], a[2], a[3]]); return f(...a) } }
  u.addDefense = SF.prototype.addDefense.bind(u); { const f = u.addDefense; u.addDefense = (...a) => { u.stat.push(["addDefense", a[0], a[2], a[3]]); return f(...a) } } u.addSpeed = (...a) => { u.stat.push(["addSpeed", a[0]]) }
  return u
}
const DynamicPunchZ = stratReal(`${AB10}dynamic-punch.ts`, "DynamicPunchStrategy"), FakeOutZ = stratReal(`${AB10}fake-out.ts`, "FakeOutStrategy"), PowerHugZ = stratReal(`${AB10}power-hug.ts`, "PowerHugStrategy"), StringShotZ = stratReal(`${AB10}string-shot.ts`, "StringShotStrategy"), BurnUpZ = stratReal(`${AB10}burn-up.ts`, "BurnUpStrategy")
const spyAll = (t, c, order) => {
  const hd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { const r = hd(...a); order.push(["damage", a[0], r.takenDamage]); return r }
  for (const m of ["triggerConfusion", "triggerLocked", "triggerParalysis", "triggerFlinch", "triggerBurn"]) { for (const holder of [t, c]) { if (typeof holder.status[m] !== "function") continue; const real = holder.status[m].bind(holder.status); holder.status[m] = (...a) => { order.push([m.replace("trigger", "").toLowerCase(), a[0], a[1] === t ? "target" : a[1] === c ? "caster" : "other", a[2] === undefined ? "none" : a[2] === c ? "caster" : a[2] === t ? "target" : "other"]); return real(...a) } } }
}
const run = (Strat, { stars = 1, ap = 0, crit = false, casterO = {}, tO = {}, viaCast = false } = {}) => {
  const c = unitD("BLUE", { stars, ap, ...casterO }), t = unitD("RED", tO); const order = []; spyAll(t, c, order)
  if (viaCast) castFor(Strat, c, t, crit); else new Strat().process(c, board0, t, crit)
  return { order, c, t }
}
const sumT = ({ t }) => ({ confusion: t.status.confusion, confusionCooldown: t.status.confusionCooldown, locked: t.status.locked, lockedCooldown: t.status.lockedCooldown, paralysis: t.status.paralysis, paralysisCooldown: t.status.paralysisCooldown, flinch: t.status.flinch, flinchCooldown: t.status.flinchCooldown, range: t.range, moves: t.moves, ap: t.ap, atk: t.atk, eaten: t.eaten, stat: t.stat })
const dyn = (o) => { const r = run(DynamicPunchZ, o); return { order: r.order, ...sumT(r), hp: r.t.hp } }
const fake = (o) => { const r = run(FakeOutZ, o); return { order: r.order, ...sumT(r), cAp: r.c.ap, cAtk: r.c.atk, cStat: r.c.stat, hp: r.t.hp, pp: r.c.pp } }
const hug = (o) => { const r = run(PowerHugZ, o); return { order: r.order, ...sumT(r), hp: r.t.hp } }
const sshot = (o) => { const r = run(StringShotZ, o); return { order: r.order, ...sumT(r), hp: r.t.hp } }
const burnUp = (o) => { const r = run(BurnUpZ, o); return { order: r.order, cBurn: r.c.status.burn, cCooldown: r.c.status.burnCooldown, cOrigin: r.c.status.burnOrigin === r.c, tBurn: r.t.status.burn, cStat: r.c.stat, cEaten: r.c.eaten, hp: r.t.hp } }
// movement: real moveTo and canBeMoved on a locked stand-in
const MoveCls = build({ Item: enums(), EffectEnum: enums() }, js(`class MV {\n${cut(PE, 258, 264, "get canBeMoved")}\n${cut(PE, 890, 899, "moveTo(")}\n}`), "MV")
const moveCase = (forced) => { const u = Object.assign(new MoveCls(), { status: { locked: true, skydiving: false }, items: new Set(), positionX: 0, positionY: 0, cooldown: 0 }); const swaps = []; const board = { getEntityOnCell: () => undefined, swapCells: (...a) => swaps.push(a) }; u.toMovingState = () => {}; u.moveTo(3, 3, board, forced); return { swaps: swaps.length, canBeMoved: u.canBeMoved } }
const paraCd = (paralysed) => { const u = mkSelf({ speed: 50 }); u.resetCooldown(1000, paralysed ? u.speed / 2 : u.speed); return u.cooldown }
out.CATCHUP_D2 = {
  dynamic: { star1: dyn({}), star2: dyn({ stars: 2 }), star3: dyn({ stars: 3 }), star5: dyn({ stars: 5 }), ap100: dyn({ ap: 100 }), already: dyn({ tO: { status: { confusion: true, confusionCooldown: 700 } } }), rune: dyn({ tO: { status: { runeProtect: true } } }), immune: dyn({ tO: { effects: ["IMMUNITY_CONFUSION"] } }), sand: dyn({ tO: { weather: "SANDSTORM" } }), hydration: dyn({ tO: { effects: ["HYDRATION"] } }), persim: dyn({ tO: { items: ["PERSIM_BERRY"] } }), protect: dyn({ tO: { protect: true } }),
    psyduck: dyn({ tO: { passive: "PSYDUCK" } }), psyduckBelt: dyn({ tO: { passive: "PSYDUCK", items: ["BIG_EATER_BELT"] } }), psyduckNullify: dyn({ tO: { passive: "PSYDUCK", items: ["NULLIFY_BANDANNA"] } }), psyduckRune: dyn({ tO: { passive: "PSYDUCK", status: { runeProtect: true } } }) },
  fake: { plain: fake({}), star2: fake({ stars: 2 }), apNeg: fake({ ap: -10 }), apZero: fake({ ap: 0 }), ap10: fake({ ap: 10 }), belt: fake({ casterO: { items: ["BIG_EATER_BELT"] } }), twist: fake({ casterO: { items: ["TWIST_BAND"] } }), nullify: fake({ casterO: { items: ["NULLIFY_BANDANNA"] } }), nullifyCast: fake({ casterO: { items: ["NULLIFY_BANDANNA"] }, viaCast: true }), nullifyBelt: fake({ casterO: { items: ["NULLIFY_BANDANNA", "BIG_EATER_BELT"] } }), floor: fake({ ap: -80 }), blocked: fake({ tO: { protect: true } }), targetHydration: fake({ tO: { effects: ["HYDRATION"] } }), casterHydration: fake({ casterO: { effects: ["HYDRATION"] } }), rune: fake({ tO: { status: { runeProtect: true } } }),
    twice: (() => { const c = unitD("BLUE", {}), t = unitD("RED", {}); const o1 = []; spyAll(t, c, o1); new FakeOutZ().process(c, board0, t, false); const ap1 = c.ap; new FakeOutZ().process(c, board0, t, false); return { ap1, ap2: c.ap, flinchCalls: o1.filter((x) => x[0] === "flinch").length } })() },
  hug: { star1: hug({}), star2: hug({ stars: 2 }), star3: hug({ stars: 3 }), star5: hug({ stars: 5 }), alreadyLocked: hug({ tO: { status: { locked: true, lockedCooldown: 900 } } }), skydiving: hug({ tO: { status: { skydiving: true } } }), rune: hug({ tO: { status: { runeProtect: true } } }), immuneLock: hug({ tO: { effects: ["IMMUNITY_LOCKED"] } }), cc: hug({ tO: { status: { ccCooldown: 500 } } }), immunePara: hug({ tO: { effects: ["IMMUNITY_PARALYSIS"] } }), enraged: hug({ tO: { status: { enraged: true } } }), hydration: hug({ tO: { effects: ["HYDRATION"] } }), storm: hug({ tO: { weather: "STORM" } }), stormQuartz: hug({ tO: { weather: "STORM", player: { items: ["ELECTRIC_QUARTZ"] } } }), cheri: hug({ tO: { items: ["CHERI_BERRY"] } }), range3: hug({ tO: { range: 3 } }), range1: hug({ tO: { range: 1 } }), protect: hug({ tO: { protect: true } }),
    moveForced: moveCase(true), moveUnforced: moveCase(false), cdNormal: paraCd(false), cdParalysed: paraCd(true) },
  string: { star1: sshot({}), star2: sshot({ stars: 2 }), star3: sshot({ stars: 3 }), star5: sshot({ stars: 5 }), ap100: sshot({ ap: 100 }), storm: sshot({ tO: { weather: "STORM" } }), stormQuartz: sshot({ tO: { weather: "STORM", player: { items: ["ELECTRIC_QUARTZ"] } } }), hydration: sshot({ tO: { effects: ["HYDRATION"] } }), rune: sshot({ tO: { status: { runeProtect: true } } }), immune: sshot({ tO: { effects: ["IMMUNITY_PARALYSIS"] } }), longer: sshot({ tO: { status: { paralysis: true, paralysisCooldown: 9000 } } }), cheri: sshot({ tO: { items: ["CHERI_BERRY"] } }), protect: sshot({ tO: { protect: true } }) },
  burnUp: { star1: burnUp({}), star2: burnUp({ stars: 2 }), blocked: burnUp({ tO: { protect: true } }), immune: burnUp({ casterO: { effects: ["IMMUNITY_BURN"] } }), rune: burnUp({ casterO: { status: { runeProtect: true } } }), bubble: burnUp({ casterO: { passive: "WATER_BUBBLE" } }), hydration: burnUp({ casterO: { effects: ["HYDRATION"] } }), longer: burnUp({ casterO: { status: { burn: true, burnCooldown: 9000 } } }), wellBaked: burnUp({ casterO: { passive: "WELL_BAKED" } }), wellBakedAlready: burnUp({ casterO: { passive: "WELL_BAKED", status: { burn: true } } }), magmarizer: burnUp({ casterO: { items: ["MAGMARIZER"] } }), guts: burnUp({ casterO: { passive: "GUTS" } }), rawst: burnUp({ casterO: { items: ["RAWST_BERRY"] } }) }
}
const C2X = out.CATCHUP_D2

const C2D = C2X.dynamic
expect("CATCHUP_D2 DYNAMIC_PUNCH (real strategy, real triggerConfusion / applyStatusDurationReductions, handleSpecialDamage): the confusion attempt triggerConfusion(2000 / 4000 / 6000 / 8000 (fallback), target, caster) comes BEFORE the SPECIAL damage 40 / 80 / 160 / 320 (stored 2000 / 4000 / 6000 / 8000, damage 40 / 80 / 160 / 320) and there is NO application chance roll (unlike PSYBEAM: every cast attempts it); AP 100 doubles the DAMAGE (returned 80) but not the stored confusion (2000); the attempt is refused by an existing confusion (700 kept), Rune Protect and IMMUNITY_CONFUSION; the victim's weather and reductions change the stored time (SANDSTORM x1.3 = 2600, HYDRATION 1000); a PERSIM_BERRY holder requests eatBerry; a protected target is still confused while the damage is blocked (0)", [C2D.star1.order, [C2D.star2.confusionCooldown, C2D.star3.confusionCooldown, C2D.star5.confusionCooldown], [C2D.star2.order[1][1], C2D.star3.order[1][1], C2D.star5.order[1][1]], [C2D.ap100.confusionCooldown, C2D.ap100.order[1][2]], [C2D.already.confusionCooldown, C2D.rune.confusion, C2D.immune.confusion], [C2D.sand.confusionCooldown, C2D.hydration.confusionCooldown], C2D.persim.eaten, [C2D.protect.confusion, C2D.protect.order[1][2]]], [[["confusion", 2000, "target", "caster"], ["damage", 40, 40]], [4000, 6000, 8000], [80, 160, 320], [2000, 80], [700, false, false], [2600, 1000], ["PERSIM_BERRY"], [true, 0]])
expect("CATCHUP_D2 DYNAMIC_PUNCH PSYDUCK reaction (real triggerConfusion passive branch and addAbilityPower): a PSYDUCK-passive victim REQUESTS addAbilityPower(100, itself, apBoost 0, crit false) when the confusion is applied - not a guaranteed +100: a Big Eater Belt makes the final AP 125, a Nullify Bandanna holder routes it to addAttack(20) and gains no AP (ATK 40), and a Rune Protect victim gets no confusion and so no request", [C2D.psyduck.stat, C2D.psyduck.ap, C2D.psyduckBelt.ap, [C2D.psyduckNullify.ap, C2D.psyduckNullify.atk], [C2D.psyduckRune.stat, C2D.psyduckRune.ap]], [[["addAbilityPower", 100, 0, false]], 100, 125, [0, 40], [[], 0]])
const C2F = C2X.fake
expect("CATCHUP_D2 FAKE_OUT order (real strategy; caster AP 0, target maxHP 500): the check caster AP >= 0 comes BEFORE triggerFlinch(3000, target) (the TARGET supplies the duration reductions: target HYDRATION 1500, caster HYDRATION 3000; Rune Protect refuses it), then SPECIAL damage 40 / 80 (1 / 2 stars), then the caster's own addAbilityPower(-30, self, 0, false): AP 0 qualifies (flinch applied), AP -10 does not (no flinch, damage x0.9 = 36, AP -40); AP ends -30; a second cast sees AP -30 < 0, makes no flinch call but still hits and loses another 30 (-60); a blocked hit (protect, returned 0) still flinches and still costs 30 AP", [C2F.plain.order, C2F.star2.order[1][1], C2F.plain.cAp, C2F.apZero.flinch, [C2F.apNeg.order.length, C2F.apNeg.order[0][2], C2F.apNeg.cAp], [C2F.targetHydration.flinchCooldown, C2F.casterHydration.flinchCooldown, C2F.rune.flinch], C2F.twice, [C2F.blocked.flinch, C2F.blocked.order[1][2], C2F.blocked.cAp]], [[["flinch", 3000, "target", "none"], ["damage", 40, 40]], 80, -30, true, [1, 36, -40], [1500, 3000, false], { ap1: -30, ap2: -60, flinchCalls: 1 }, [true, 0, -30]])
expect("CATCHUP_D2 FAKE_OUT self AP request (real addAbilityPower on the caster): the -30 is a REQUEST through the own-team helpers: a Big Eater Belt amplifies a negative own-team value (-30 -> -38), a Twist Band does not reverse a self loss (-30), AP floors at -100 (-80 -> -100); a Nullify Bandanna holder (a DIRECT process call only) gets addAttack(round(0.2 x -30) = -6) instead of an AP loss (ATK 14, with a Belt -6 -> -8: ATK 12), and through the real castAbility and canCast getter such a caster casts nothing at all (PP stays 100, no damage)", [C2F.belt.cAp, C2F.twist.cAp, C2F.floor.cAp, [C2F.nullify.cAp, C2F.nullify.cAtk], C2F.nullifyBelt.cAtk, [C2F.nullifyCast.pp, C2F.nullifyCast.order.length, C2F.nullifyCast.hp]], [-38, -30, -100, [0, 14], 12, [100, 0, 500]])
const C2H = C2X.hug
expect("CATCHUP_D2 POWER_HUG order and durations (real strategy, triggerLocked / triggerParalysis): lock attempt, then paralysis attempt, then SPECIAL damage 40 / 80 / 160 / 320, both requested 3000 / 3000 / 6000 / 10000 (5 stars -> 10000 / 320); neither status depends on the damage (a protected target still ends locked and paralysed while the damage returns 0)", [C2H.star1.order, [C2H.star2.lockedCooldown, C2H.star2.paralysisCooldown], [C2H.star3.lockedCooldown, C2H.star3.paralysisCooldown, C2H.star3.order[2][1]], [C2H.star5.lockedCooldown, C2H.star5.paralysisCooldown, C2H.star5.order[2][1]], [C2H.protect.locked, C2H.protect.paralysis, C2H.protect.order[2][2]]], [[["locked", 3000, "target", "none"], ["paralysis", 3000, "target", "caster"], ["damage", 40, 40]], [3000, 3000], [6000, 6000, 160], [10000, 10000, 320], [true, true, 0]])
expect("CATCHUP_D2 POWER_HUG guards (real triggerLocked / triggerParalysis): the lock is refused by an existing lock (900 kept), skydiving, Rune Protect, IMMUNITY_LOCKED and ccCooldown, and halved by an enraged target (1500) - while the paralysis is a SEPARATE attempt that still applies when the lock is refused (3000), has its own guards (IMMUNITY_PARALYSIS refuses it while the lock still applies) and its own weather and berry rules (STORM x1.3 = 3900, with an Electric Quartz x0.8 = 3120, a Cheri Berry requests eatBerry); HYDRATION halves both (1500); a successful lock sets range 1 and forces the moving state for a range-3 target (range 1, one toMovingState call) and none for a range-1 target", [[C2H.alreadyLocked.lockedCooldown, C2H.alreadyLocked.paralysis], [C2H.skydiving.locked, C2H.skydiving.paralysis], [C2H.rune.locked, C2H.rune.paralysis], [C2H.immuneLock.locked, C2H.immuneLock.paralysis], [C2H.cc.locked, C2H.cc.paralysis], [C2H.immunePara.locked, C2H.immunePara.paralysis], C2H.enraged.lockedCooldown, [C2H.hydration.lockedCooldown, C2H.hydration.paralysisCooldown], [C2H.storm.paralysisCooldown, C2H.stormQuartz.paralysisCooldown], C2H.cheri.eaten, [C2H.range3.range, C2H.range3.moves, C2H.range1.moves]], [[900, true], [false, true], [false, false], [false, true], [false, true], [true, false], 1500, [1500, 1500], [3900, 3120], ["CHERI_BERRY"], [1, 1, 0]])
expect("CATCHUP_D2 POWER_HUG movement and paralysis wording (real canBeMoved getter and moveTo text, real resetCooldown): a locked unit has canBeMoved false and a FORCED displacement (forcedDisplacement true) is refused (no swap), but moveTo with forcedDisplacement false bypasses the canBeMoved check and swaps (1 swap) - so the claim that no ability can reposition a locked unit is not made; paralysis halves the speed INPUT to the cooldown formula (speed 50: stored cooldown 1333 normally, 1739 with speed 25), not necessarily a literal halving of the attack rate", [C2H.moveForced, C2H.moveUnforced, C2H.cdNormal, C2H.cdParalysed], [{ swaps: 0, canBeMoved: false }, { swaps: 1, canBeMoved: false }, 1333, 1739])
const C2S = C2X.string
expect("CATCHUP_D2 STRING_SHOT (real strategy, triggerParalysis): paralysis attempt triggerParalysis(5000, target, caster) BEFORE SPECIAL damage 10 / 20 / 50 / 100 (fallback); no AP duration multiplier (AP 100 stores 5000 and doubles only the damage: returned 20); the victim's rules change the stored time (STORM x1.3 = 6500, with an Electric Quartz x0.8 = 5200, HYDRATION 2500); Rune Protect and IMMUNITY_PARALYSIS refuse it; a longer remaining paralysis (9000) is kept; a Cheri Berry holder requests eatBerry; so a fixed 5000 request is not a guaranteed lasting five-second status; a protected target is still paralysed while the damage returns 0", [C2S.star1.order, [C2S.star2.order[1][1], C2S.star3.order[1][1], C2S.star5.order[1][1]], [C2S.ap100.paralysisCooldown, C2S.ap100.order[1][2]], [C2S.storm.paralysisCooldown, C2S.stormQuartz.paralysisCooldown, C2S.hydration.paralysisCooldown], [C2S.rune.paralysis, C2S.immune.paralysis], C2S.longer.paralysisCooldown, C2S.cheri.eaten, [C2S.protect.paralysis, C2S.protect.order[1][2]]], [[["paralysis", 5000, "target", "caster"], ["damage", 10, 10]], [20, 50, 100], [5000, 20], [6500, 5200, 2500], [false, false], 9000, ["CHERI_BERRY"], [true, 0]])
const C2B = C2X.burnUp
expect("CATCHUP_D2 BURN_UP (real strategy, real triggerBurn): SPECIAL damage 50 / 100 FIRST, THEN triggerBurn(3000, caster, caster) - the victim AND the origin are the CASTER, the target is never burned - even when the damage returned 0 (a protected target: caster still burns); the caster's own guards apply: IMMUNITY_BURN, Rune Protect and the WATER_BUBBLE passive refuse it, HYDRATION stores 1500, a longer remaining burn (9000) is kept; first-burn requests (not final gains): WELL_BAKED requests addDefense(20), a MAGMARIZER holder addSpeed(30), GUTS addAttack(5), none when already burning; a RAWST_BERRY holder requests eatBerry", [C2B.star1.order, [C2B.star1.cBurn, C2B.star1.cOrigin, C2B.star1.tBurn], [C2B.blocked.order[0][2], C2B.blocked.cBurn], [C2B.immune.cBurn, C2B.rune.cBurn, C2B.bubble.cBurn], C2B.hydration.cCooldown, C2B.longer.cCooldown, C2B.wellBaked.cStat, C2B.wellBakedAlready.cStat, C2B.magmarizer.cStat, C2B.guts.cStat, C2B.rawst.cEaten], [[["damage", 50, 50], ["burn", 3000, "caster", "caster"]], [true, true, false], [0, true], [false, false, false], 1500, 9000, [["addDefense", 20, 0, false]], [], [["addSpeed", 30]], [["addAttack", 5, 0, false]], ["RAWST_BERRY"]])
expect("CATCHUP_D2 BURN_UP burn tick (the real Status.updateBurn already executed for SOLAR_BEAM, maxHP 1000): the self-burn deals 5 % of the caster's max HP as TRUE damage per tick = 50, DROUGHT x1.3 = 65 and Heat Rocks reduce it only after that (1 rock 52), RAIN x0.7 = 35, Assault Vest 25, SWIFT_SWIM 35, HYDRATION 25, WATER_VEIL 15, WELL_BAKED and MAGMARIZER 0, a COOKING_POT holder gains addSpeed(10) per tick", [C3SB.burnTick.none, C3SB.burnTick.drought, C3SB.burnTick.droughtOneRock, C3SB.burnTick.rain, C3SB.burnTick.vest, C3SB.burnTick.swiftSwim, C3SB.burnTick.hydration, C3SB.burnTick.waterVeil, C3SB.burnTick.wellBaked, C3SB.burnTick.magmarizer, C3SB.burnTick.cookingPot], [[["damage", 50, "TRUE"]], [["damage", 65, "TRUE"]], [["damage", 52, "TRUE"]], [["damage", 35, "TRUE"]], [["damage", 25, "TRUE"]], [["damage", 35, "TRUE"]], [["damage", 25, "TRUE"]], [["damage", 15, "TRUE"]], [], [], [["addSpeed", 10], ["damage", 50, "TRUE"]]])
// 41. CATCHUP_D3 (batch 3 cycle 3): the real MUD_SHOT / ROCK_TOMB / SLASHING_CLAW / COIL / GROWL strategy text with the real addSpeed / addAttack / addDefense, the Belt / Twist helpers,
// triggerWound / triggerLocked / triggerParalysis / triggerFlinch / applyStatusDurationReductions, handleSpecialDamage / handleHeal and Board.getAdjacentCells, run against STAND-IN units. Not a fight.
const AB11 = "app/core/abilities/"
const StatusE = build({ Weather: enums(), EffectEnum: enums(), Item: enums(), Passive: enums(), count }, js(`class SE2 {\n${cut(ST, 877, 897, "triggerWound(")}\n${cut(ST, 908, 939, "triggerParalysis(")}\n${cut(ST, 976, 986, "triggerFlinch(")}\n${cut(ST, 1142, 1163, "triggerLocked(")}\n${cut(ST, 1282, 1305, "private applyStatusDurationReductions(").replace("private ", "")}\n}`), "SE2")
const unitE = (team, o = {}) => {
  const u = mkCombat(team, { ap: o.ap, stars: o.stars, hp: o.hp, items: o.items, effects: o.effects, speDef: o.speDef, atk: o.atk, protect: o.protect })
  Object.setPrototypeOf(u.status, StatusE.prototype); Object.assign(u.status, { wound: false, woundCooldown: 0, woundOrigin: null, paralysis: false, paralysisCooldown: 0, flinch: false, flinchCooldown: 0, locked: false, lockedCooldown: 0, runeProtect: false, skydiving: false, ccCooldown: 0, enraged: false, magicBounce: false, protect: !!o.protect }, o.status ?? {})
  u.passive = o.passive ?? "NONE"; u.range = 1; u.baseRange = 1; u.toMovingState = () => {}; u.speed = o.speed ?? 50; u.def = o.def ?? 10; u.player = o.player ?? null; u.simulation = { ...u.simulation, weather: o.weather ?? "NONE" }
  u.stat = []
  for (const [m, proto] of [["addAttack", SF.prototype.addAttack], ["addDefense", SF.prototype.addDefense], ["addSpeed", SF.prototype.addSpeed]]) { const f = proto.bind(u); u[m] = (...a) => { u.stat.push([m, a[0], a[2], a[3]]); return f(...a) } }
  return u
}
const MudShotE = stratReal(`${AB11}mud-shot.ts`, "MudShotStrategy"), RockTombE = stratReal(`${AB11}rock-tomb.ts`, "RockTombStrategy"), SlashingClawE = stratReal(`${AB11}slashing-claw.ts`, "SlashingClawStrategy"), CoilE = stratReal(`${AB11}coil.ts`, "CoilStrategy"), GrowlE = stratReal(`${AB11}growl.ts`, "GrowlStrategy")
const spyE = (t, order) => { const hd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { const r = hd(...a); order.push(["damage", a[0], a[2], r.takenDamage]); return r }; for (const m of ["triggerWound", "triggerLocked", "triggerParalysis", "triggerFlinch"]) { const real = t.status[m].bind(t.status); t.status[m] = (...a) => { order.push([m.replace("trigger", "").toLowerCase(), a[0]]); return real(...a) } } }
const spdCase = (Strat, { stars = 1, ap = 0, crit = false, tO = {}, casterO = {}, casts = 1 } = {}) => {
  const c = unitE("BLUE", { stars, ap, ...casterO }), t = unitE("RED", tO); const order = []; spyE(t, order)
  for (let i = 0; i < casts; i++) new Strat().process(c, board0, t, crit)
  return { order, speed: t.speed, atk: t.atk, stat: t.stat.filter((x) => x[0] !== "addDefense"), hp: t.hp }
}
const claw = ({ stars = 2, ap = 0, crit = false, tO = {}, weather = "NONE" } = {}) => {
  const c = unitE("BLUE", { stars, ap }), t = unitE("RED", { weather, ...tO }); const order = []; spyE(t, order)
  new SlashingClawE().process(c, board0, t, crit)
  return { order, wound: t.status.wound, woundCooldown: t.status.woundCooldown, origin: t.status.woundOrigin === c, hp: t.hp }
}
const woundHeal = ({ stones = 0, weather = "NONE" } = {}) => { const u = mkHU({ hp: 500, status: { wound: true, woundCooldown: 0 }, weather, stones }); const r = healOf(u, 100); return { returned: r.returned, shield: u.shield } }
const coil = ({ stars = 1, ap = 0, crit = false, critPower = 2, tO = {}, casterO = {} } = {}) => {
  const c = unitE("BLUE", { stars, ap, ...casterO }); c.critPower = critPower; const t = unitE("RED", tO); const order = []; spyE(t, order)
  for (const m of ["addAttack", "addDefense"]) { const real = c[m]; c[m] = (...a) => { order.push([m, a[0]]); return real(...a) } }
  new CoilE().process(c, board0, t, crit)
  return { order, t: { locked: t.status.locked, lockedCooldown: t.status.lockedCooldown, paralysis: t.status.paralysis, paralysisCooldown: t.status.paralysisCooldown, range: t.range }, cAtk: c.atk, cDef: c.def, hp: t.hp }
}
const growl = ({ stars = 1, ap = 0, crit = false, critPower = 2, caster = [3, 3], enemies, allies = [] }) => {
  const b = new BoardZ(6, 8); const c = unitE("BLUE", { stars, ap }); c.critPower = critPower; c.name = "caster"
  const es = enemies.map((e) => { const u = unitE("RED", e); u.name = e.name; return Object.assign(u, { positionX: e.x, positionY: e.y }) }); const als = allies.map((e) => { const u = unitE("BLUE", e); u.name = e.name; return Object.assign(u, { positionX: e.x, positionY: e.y }) })
  Object.assign(c, { positionX: caster[0], positionY: caster[1] }); placeZ(b, c, ...es, ...als)
  const order = []; for (const u of es) { const real = u.status.triggerFlinch.bind(u.status); u.status.triggerFlinch = (...a) => { order.push([u.name, "flinch", a[0], a[1] === u ? "victim" : "other", a[2] === c ? "caster" : "other"]); return real(...a) }; const ra = u.addAttack; u.addAttack = (...a) => { order.push([u.name, "atk", a[0]]); return ra(...a) } }
  new GrowlE().process(c, b, null, crit)
  return { order, atk: Object.fromEntries([...es, ...als].map((u) => [u.name, u.atk])), flinch: Object.fromEntries(es.map((u) => [u.name, u.status.flinchCooldown])) }
}
const ring = (cx, cy) => [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([dx, dy]) => ({ name: `e${dx}${dy}`, x: cx + dx, y: cy + dy }))
out.CATCHUP_D3 = {
  mud: { star1: spdCase(MudShotE), star2: spdCase(MudShotE, { stars: 2 }), star5: spdCase(MudShotE, { stars: 5 }), ap100: spdCase(MudShotE, { ap: 100 }), crit: spdCase(MudShotE, { crit: true }), ap25: spdCase(MudShotE, { ap: 25 }), twistAp: spdCase(MudShotE, { ap: 100, tO: { items: ["TWIST_BAND"] } }), belt: spdCase(MudShotE, { tO: { items: ["BIG_EATER_BELT"] } }), clampLow: spdCase(MudShotE, { tO: { speed: 5 } }), melmetal: spdCase(MudShotE, { ap: 100, tO: { passive: "MELMETAL" } }), melmetalTwistBelt: spdCase(MudShotE, { ap: 100, tO: { passive: "MELMETAL", items: ["TWIST_BAND", "BIG_EATER_BELT"] } }), blocked: spdCase(MudShotE, { tO: { protect: true } }) },
  tomb: { star1: spdCase(RockTombE), star2: spdCase(RockTombE, { stars: 2 }), star3: spdCase(RockTombE, { stars: 3 }), star5: spdCase(RockTombE, { stars: 5 }), ap100crit: spdCase(RockTombE, { ap: 100, crit: true }), twist: spdCase(RockTombE, { tO: { items: ["TWIST_BAND"] } }), belt: spdCase(RockTombE, { tO: { items: ["BIG_EATER_BELT"] } }), melmetal: spdCase(RockTombE, { tO: { passive: "MELMETAL" } }), melmetalTwistBelt: spdCase(RockTombE, { tO: { passive: "MELMETAL", items: ["TWIST_BAND", "BIG_EATER_BELT"] } }), clampLow: spdCase(RockTombE, { tO: { speed: 5 } }), stack: spdCase(RockTombE, { casts: 3 }), blocked: spdCase(RockTombE, { tO: { protect: true } }) },
  claw: { plain: claw(), star1: claw({ stars: 1 }), wounded: claw({ tO: { status: { wound: true, woundCooldown: 2000 } } }), woundedStar1: claw({ stars: 1, tO: { status: { wound: true, woundCooldown: 2000 } } }), flagCd0: claw({ tO: { status: { wound: true, woundCooldown: 0 } } }), cdOnly: claw({ tO: { status: { wound: false, woundCooldown: 3000 } } }), rune: claw({ tO: { status: { runeProtect: true } } }), moon: claw({ weather: "BLOODMOON" }), hydration: claw({ tO: { effects: ["HYDRATION"] } }), longer: claw({ tO: { status: { wound: true, woundCooldown: 9000 } } }), blocked: claw({ tO: { protect: true } }), ap100: claw({ ap: 100 }), healNoMoon: woundHeal(), healMoon: woundHeal({ stones: 1, weather: "BLOODMOON" }) },
  coil: { star1: coil(), star2: coil({ stars: 2 }), star5: coil({ stars: 5 }), nonInt: coil({ ap: 10, crit: true, critPower: 1.5 }), ap100: coil({ ap: 100 }), belt: coil({ stars: 2, casterO: { items: ["BIG_EATER_BELT"] } }), lockRefused: coil({ tO: { status: { locked: true, lockedCooldown: 800 } } }), runeRefused: coil({ tO: { status: { runeProtect: true } } }), skydiving: coil({ tO: { status: { skydiving: true } } }), paraImmune: coil({ tO: { effects: ["IMMUNITY_PARALYSIS"] } }), hydration: coil({ tO: { effects: ["HYDRATION"] } }), enraged: coil({ tO: { status: { enraged: true } } }) },
  growl: { center: growl({ enemies: [...ring(3, 3), { name: "far", x: 5, y: 3 }], allies: [{ name: "ally", x: 4, y: 3 }] }), corner: growl({ caster: [0, 0], enemies: [{ name: "right", x: 1, y: 0 }, { name: "below", x: 0, y: 1 }, { name: "diag", x: 1, y: 1 }, { name: "two", x: 2, y: 0 }] }), edge: growl({ caster: [7, 3], enemies: ring(7, 3).concat([{ name: "outside", x: 5, y: 3 }]) }),
    star2: growl({ stars: 2, enemies: [{ name: "a", x: 4, y: 3 }] }), star5: growl({ stars: 5, enemies: [{ name: "a", x: 4, y: 3 }] }), nonInt: growl({ ap: 10, crit: true, critPower: 1.5, enemies: [{ name: "a", x: 4, y: 3 }] }), twist: growl({ enemies: [{ name: "a", x: 4, y: 3, items: ["TWIST_BAND"] }] }), belt: growl({ enemies: [{ name: "a", x: 4, y: 3, items: ["BIG_EATER_BELT"] }] }), floor: growl({ enemies: [{ name: "a", x: 4, y: 3, atk: 2 }] }), rune: growl({ enemies: [{ name: "a", x: 4, y: 3, status: { runeProtect: true } }] }), hydration: growl({ enemies: [{ name: "a", x: 4, y: 3, effects: ["HYDRATION"] }] }) }
}
const C3X = out.CATCHUP_D3

const D3M = C3X.mud, D3T = C3X.tomb
expect("CATCHUP_D3 MUD_SHOT (real strategy, real addSpeed / addAttack, handleSpecialDamage; target speed 50, ATK 20): SPECIAL damage 25 / 50 / 200 (fallback) FIRST, then a FLAT speed request addSpeed(-10 / -20 / -40, caster, apBoost 1, crit) - flat points, not percentages despite the source comment (speed 50 -> 40, 30, 10); inside addSpeed the target's Twist Band / Belt helpers come BEFORE AP / crit and the result is NOT rounded: AP 100 or a crit doubles the request (30), AP 25 gives -12.5 (37.5), an enemy Belt changes nothing (40), a Twist Band holder with AP 100 gains 2 x 10 (70, flipped before scaling), speed clamps at 0 (speed 5 -> 0); a protected target (damage returned 0) is still slowed (40)", [[D3M.star1.speed, D3M.star2.speed, D3M.star5.speed], D3M.star1.order[0].slice(0, 3), [D3M.ap100.speed, D3M.crit.speed, D3M.ap25.speed, D3M.belt.speed, D3M.twistAp.speed, D3M.clampLow.speed], [D3M.blocked.order[0][3], D3M.blocked.speed]], [[40, 30, 10], ["damage", 25, "SPECIAL"], [30, 30, 37.5, 40, 70, 0], [0, 40]])
expect("CATCHUP_D3 MUD_SHOT MELMETAL delegation (real addSpeed -> addAttack, victim ATK 20, AP 100): the victim's speed never changes (50); half of the request goes to addAttack with the supplied AP / crit and Math.round: -10 -> -5 -> round(-5 x 2) = -10 (ATK 10); with a Twist Band the sign is flipped in addSpeed first (+10 -> +5 -> round(10) = 10), then a Big Eater Belt in addAttack gives 12 (12.5 rounded down): ATK 32 - rounding and the item helpers apply a second time", [D3M.melmetal.speed, D3M.melmetal.atk, D3M.melmetalTwistBelt.speed, D3M.melmetalTwistBelt.atk], [50, 10, 50, 32])
expect("CATCHUP_D3 ROCK_TOMB (real strategy and helpers; target speed 50, ATK 20): SPECIAL damage 30 / 60 / 120 / 240 then addSpeed(-10 / -20 / -40 / -80, caster, apBoost 0, crit false): the debuff does NOT scale with the damage's AP / crit (AP 100 with a crit returns 120 damage but the speed is still 40); an enemy Twist Band holder GAINS 10 (60); an enemy Belt changes nothing (40); speed floors at 0 (speed 5 -> 0; 5 stars -80 -> 0); repeated casts stack (three casts: 20) and the strategy installs no restore timer; a protected target is still slowed (40)", [[D3T.star1.speed, D3T.star2.speed, D3T.star3.speed, D3T.star5.speed], [D3T.ap100crit.order[0][3], D3T.ap100crit.speed], D3T.twist.speed, D3T.belt.speed, D3T.clampLow.speed, D3T.stack.speed, [D3T.blocked.order[0][3], D3T.blocked.speed]], [[40, 30, 10, 0], [120, 40], 60, 40, 0, 20, [0, 40]])
expect("CATCHUP_D3 ROCK_TOMB MELMETAL (real addSpeed -> addAttack, apBoost 0): a MELMETAL victim keeps speed 50 and loses half of the request as Attack (-10 -> -5: ATK 15); MELMETAL + Twist Band + Big Eater Belt flips the sign first (+10), halves it (+5) and the second helper pass makes it +6 (5 x 1.25 rounded down): ATK 26 - not every victim loses speed", [D3T.melmetal.speed, D3T.melmetal.atk, D3T.melmetalTwistBelt.speed, D3T.melmetalTwistBelt.atk], [50, 15, 50, 26])
const D3S = C3X.claw
expect("CATCHUP_D3 SLASHING_CLAW (real strategy, real triggerWound, handleSpecialDamage): raw 15 / 30 (1 / 2 stars) becomes ceil(raw x 1.3) = 20 / 39 only if the target's wound FLAG was already true at cast time (flag with cooldown 2000: 39; Sneasel 20); the flag alone decides - a flag left true with cooldown 0 after clearNegativeStatus still boosts (39) while a cooldown with the flag false does not (30); wound(5000) is attempted AFTER the damage on the original target, so the first application never boosts its own hit (30); a blocked hit (protect) still wounds; AP 100 doubles the request inside handleSpecialDamage (returned 60)", [D3S.plain.order, D3S.star1.order[0][1], D3S.wounded.order[0][1], D3S.woundedStar1.order[0][1], D3S.flagCd0.order[0][1], D3S.cdOnly.order[0][1], [D3S.blocked.order[0][3], D3S.blocked.wound], D3S.ap100.order[0][3]], [[["damage", 30, "SPECIAL", 30], ["wound", 5000]], 15, 39, 20, 39, 30, [0, true], 60])
expect("CATCHUP_D3 SLASHING_CLAW wound rules (real triggerWound / applyStatusDurationReductions): Rune Protect refuses the wound (flag false, no timer); BLOODMOON weather multiplies the duration x1.3 (6500) before the victim's reductions (HYDRATION 2500); the timer and origin are replaced only by a LONGER duration (9000 kept, origin not replaced); a wounded unit's real handleHeal returns 0 (and with BLOODMOON + BLOOD_STONE requests the shield replacement: round(0.3 x 100) = 30)", [D3S.rune.wound, D3S.rune.woundCooldown, D3S.moon.woundCooldown, D3S.hydration.woundCooldown, [D3S.longer.woundCooldown, D3S.longer.origin], D3S.healNoMoon, D3S.healMoon], [false, 0, 6500, 2500, [9000, false], { returned: { healReceived: 0, overheal: 0 }, shield: 0 }, { returned: { healReceived: 0, overheal: 0 }, shield: 30 }])
const D3C = C3X.coil
expect("CATCHUP_D3 COIL (real strategy; target maxHP 500, caster ATK 20 / DEF 10): NO damage (target HP stays 500); the order is triggerLocked(3000), triggerParalysis(3000), then self addAttack and addDefense of 3 / 5 / 20 (fallback) by stars (ATK 23 / 25 / 40); the self request is Math.round(raw x (1 + AP/100) x (crit ? critPower : 1)) in ONE rounding before the Belt / Twist helpers and the floor: raw 3, AP 10, critPower 1.5, crit -> round(4.95) = 5 (ATK 25, DEF 15); AP 100 -> 6 (26 / 16); a Belt on a 2-star caster 5 -> 6 (26 / 16)", [D3C.star1.order.map((o) => o[0]), D3C.star1.hp, [D3C.star1.cAtk, D3C.star2.cAtk, D3C.star5.cAtk], [D3C.nonInt.cAtk, D3C.nonInt.cDef], [D3C.ap100.cAtk, D3C.ap100.cDef], [D3C.belt.cAtk, D3C.belt.cDef]], [["locked", "paralysis", "addAttack", "addDefense"], 500, [23, 25, 40], [25, 15], [26, 16], [26, 16]])
expect("CATCHUP_D3 COIL statuses are independent attempts (real triggerLocked / triggerParalysis): an existing lock (800 kept), skydiving, Rune Protect and the enrage halving (1500) affect only the lock; IMMUNITY_PARALYSIS refuses only the paralysis; Rune Protect refuses both; HYDRATION halves both (1500); in every case the self ATK / DEF buffs still happen (23 / 13) - no status is guaranteed", [[D3C.lockRefused.t.lockedCooldown, D3C.lockRefused.t.paralysis], [D3C.skydiving.t.locked, D3C.skydiving.t.paralysis], [D3C.runeRefused.t.locked, D3C.runeRefused.t.paralysis], [D3C.paraImmune.t.locked, D3C.paraImmune.t.paralysis], D3C.enraged.t.lockedCooldown, [D3C.hydration.t.lockedCooldown, D3C.hydration.t.paralysisCooldown], [D3C.runeRefused.cAtk, D3C.runeRefused.cDef]], [[800, true], [false, true], [false, false], [true, false], 1500, [1500, 1500], [23, 13]])
const D3G = C3X.growl
const hitN = (g) => Object.entries(g.atk).filter(([k, v]) => v !== 20).map(([k]) => k).length
expect("CATCHUP_D3 GROWL area (real strategy, real Board.getAdjacentCells on an 8 x 6 stand-in board): only enemy-team entities in the caster's eight adjacent cells are affected, centred on the CASTER and clipped at the board edges: a caster at (3,3) hits its adjacent enemies (7 of them here; an ally in a neighbouring cell, an enemy two cells away and the distant one are untouched), a corner caster at (0,0) reaches only its 3 neighbours (the enemy at (2,0) is untouched), a caster on the right edge (7,3) reaches 5 of the 8 ring cells; no damage", [hitN(D3G.center), D3G.center.atk.ally, D3G.center.atk.far, hitN(D3G.corner), D3G.corner.atk.two, hitN(D3G.edge)], [7, 20, 20, 3, 20, 5])
expect("CATCHUP_D3 GROWL per victim (real triggerFlinch / addAttack; victim ATK 20): the order per enemy is triggerFlinch(3000, victim, caster) THEN addAttack(-3 / -5 / -14 (fallback), caster, 1, crit); the flinch reductions read the victim (HYDRATION 1500) and Rune Protect refuses the flinch while the ATK loss still applies (ATK 17); the whole AP / crit-scaled negative request is rounded once: raw 3, AP 10, critPower 1.5, crit -> round(-4.95) = -5 (ATK 15); an enemy Twist Band holder GAINS 3 (23), an enemy Belt changes nothing (17), ATK floors at 1 (ATK 2 -> 1); 2 stars ATK 15, 5 stars 6", [D3G.star2.order.map((o) => o[1]), D3G.star2.atk.a, D3G.star5.atk.a, D3G.nonInt.atk.a, D3G.twist.atk.a, D3G.belt.atk.a, D3G.floor.atk.a, [D3G.rune.flinch.a, D3G.rune.atk.a], D3G.hydration.flinch.a], [["flinch", "atk"], 15, 6, 15, 23, 17, 1, [0, 17], 1500])
// 42. CATCHUP_D4 (batch 3 cycle 4): the real POLTERGEIST / ORIGIN_PULSE / ASSURANCE / SHADOW_BALL / WAVE_SPLASH strategy text with the real Tools list (Item.ts:604-626) and isIn, handleSpecialDamage /
// handleDamage, addSpecialDefense / addShield and the Belt / Twist helpers, run against STAND-IN units and boards. A direct process call is not evidence that the cast gate permits it. Not a fight.
const AB12 = "app/core/abilities/"
const ToolsList = build({ Item: enums() }, js(cut("app/types/enum/Item.ts", 604, 626, "export const Tools").replace("export ", "")), "Tools")
const isInX = build({}, js(`function isIn(values, x) {\n  return values.includes(x)\n}`), "isIn")
const PoltergeistX = stratReal(`${AB12}poltergeist.ts`, "PoltergeistStrategy", { Tools: ToolsList, isIn: isInX }), OriginPulseX = stratReal(`${AB12}origin-pulse.ts`, "OriginPulseStrategy"), AssuranceX = stratReal(`${AB12}assurance.ts`, "AssuranceStrategy"), ShadowBallX = stratReal(`${AB12}shadow-ball.ts`, "ShadowBallStrategy"), WaveSplashX = stratReal(`${AB12}wave-splash.ts`, "WaveSplashStrategy")
const dmgSpy4 = (t, log, c) => { const hd = t.handleSpecialDamage.bind(t); t.handleSpecialDamage = (...a) => { const r = hd(...a); log.push({ name: t.name, raw: a[0], type: a[2], crit: a[4], returned: r.takenDamage, speDefAtCall: t.speDef, casterAp: c ? c.ap : undefined }); return r } }
const polter = ({ stars = 1, ap = 0, items = [] }) => { const c = mkCombat("BLUE", { stars, ap }), t = mkCombat("RED", { items, speDef: 0 }); t.maxHP = 5000; t.hp = 5000; const log = []; dmgSpy4(t, log); const before = [...t.items]; new PoltergeistX().process(c, board0, t, false); return { log, itemsSame: JSON.stringify([...t.items]) === JSON.stringify(before), hp: t.hp } }
const rowBoard = (units) => { const cells = units.map((u) => ({ x: u.positionX, y: u.positionY, u })).sort((a, b) => a.y - b.y || a.x - b.x); return { forEach: (cb) => cells.forEach((c) => cb(c.x, c.y, c.u)), getAdjacentCells: () => [] } }
const mkAt = (name, team, x, y, o = {}) => { const u = unitE(team, o); u.name = name; u.positionX = x; u.positionY = y; return u }
const pulse = ({ stars = 3, ap = 0, crit = false, mutate = false } = {}) => {
  const c = mkAt("caster", "BLUE", 0, 5, { stars, ap }); const a = mkAt("a", "RED", 1, 2), b = mkAt("b", "RED", 5, 2), d = mkAt("d", "RED", 2, 3), e = mkAt("e", "RED", 4, 4), ally = mkAt("ally", "BLUE", 3, 2), far = mkAt("far", "RED", 7, 0)
  const target = mutate ? b : a; const log = []; for (const u of [a, b, d, e, far, ally]) dmgSpy4(u, log, c)
  if (mutate) { const orig = a.handleSpecialDamage; a.handleSpecialDamage = (...x) => { const r = orig(...x); target.positionY = 3; return r } }
  const before = target.positionY
  new OriginPulseX().process(c, rowBoard([c, a, b, d, e, ally, far]), target, crit)
  return { hit: log.map((x) => [x.name, x.raw, x.crit, x.returned]), targetRowBefore: before, targetRowAfter: target.positionY, allyHp: ally.hp }
}
const assurance = ({ stars = 1, hp = 1000, maxHP = 1000, ap = 0 }) => { const c = mkCombat("BLUE", { stars, ap }); c.hp = hp; c.maxHP = maxHP; const t = mkCombat("RED", { speDef: 0 }); t.maxHP = 5000; t.hp = 5000; const log = []; dmgSpy4(t, log); new AssuranceX().process(c, board0, t, false); return { raw: log[0].raw, returned: log[0].returned } }
const shadowBall = ({ stars = 1, ap = 0, crit = false, tO = {}, others = [{ name: "o1" }, { name: "o2" }], ally = true } = {}) => {
  const c = mkAt("caster", "BLUE", 0, 5, { stars, ap }), t = mkAt("target", "RED", 3, 2, { speDef: 10, ...tO }); const os = others.map((o, i) => mkAt(o.name, "RED", 4 + i, 3, { speDef: 10, ...o })); const al = ally ? [mkAt("ally", "BLUE", 1, 1, { speDef: 10 })] : []
  const log = []; dmgSpy4(t, log); const sd = {}; for (const u of [t, ...os, ...al]) { const f = u.addSpecialDefense ? u.addSpecialDefense.bind(u) : SF.prototype.addSpecialDefense.bind(u); u.addSpecialDefense = (...a) => { log.push([u.name, "speDef", a[0], a[2], a[3]]); return f(...a) } }
  new ShadowBallX().process(c, rowBoard([c, t, ...os, ...al]), t, crit)
  return { log, speDef: Object.fromEntries([t, ...os, ...al].map((u) => [u.name, u.speDef])), hp: t.hp }
}
const waveSplash = ({ stars = 1, maxHP = 1000, ap = 0, crit = false, items = [], tO = {}, hp = 500, direct = true } = {}) => {
  const c = mkFU({ team: "BLUE", stars, ap, hp, maxHP }); Object.assign(c, { count: { ult: 0 }, broadcastAbility() {}, skill: "X", pp: 0, maxPP: 100, critPower: 2, positionX: 2, positionY: 5, items: new Set(items) }); c.simulation = { ...c.simulation, blueAbilitiesCast: [], redAbilitiesCast: [] }
  const t = mkFU({ team: "RED", hp: 5000, maxHP: 5000, speDef: 0 }); t.status.protect = !!tO.protect; Object.assign(t, { positionX: 2, positionY: 2 }); const log = []; dmgSpy4(t, log)
  const reqs = []; const sh = c.addShield.bind(c); c.addShield = (...a) => { reqs.push(["shield", a[0], a[2], a[3]]); return sh(...a) }
  new WaveSplashX().process(c, board0, t, crit)
  return { reqs, log, shield: c.shield, targetHp: t.hp, pos: [c.positionX, c.positionY, t.positionX, t.positionY] }
}
const toolNames4 = ToolsList.slice()
out.CATCHUP_D4 = {
  poltergeist: { toolsCount: ToolsList.length, first: ToolsList[0], last: ToolsList[ToolsList.length - 1], none: polter({}), tool: polter({ items: ["LIGHT_BALL"] }), other: polter({ items: ["SHINY_CHARM"] }), mixed: polter({ items: ["LIGHT_BALL", "SHINY_CHARM"] }), lastTool: polter({ items: ["TERRAIN_EXTENDER"] }), twoTools: polter({ items: ["METRONOME", "COOKING_POT"] }), nearMiss: polter({ items: ["AMULET_COIN"] }), star2: polter({ stars: 2, items: ["LIGHT_BALL"] }), ap100: polter({ ap: 100, items: ["LIGHT_BALL", "SHINY_CHARM"] }), allTools: polter({ items: toolNames4 }) },
  pulse: { star3: pulse(), star4: pulse({ stars: 4 }), star1: pulse({ stars: 1 }), star5: pulse({ stars: 5 }), star6: pulse({ stars: 6 }), ap100: pulse({ ap: 100 }), crit: pulse({ crit: true }), mutated: pulse({ mutate: true }) },
  assurance: { below: assurance({ hp: 499 }), exact: assurance({ hp: 500 }), above: assurance({ hp: 501 }), full: assurance({}), star2Below: assurance({ stars: 2, hp: 100 }), star5Below: assurance({ stars: 5, hp: 100 }), ap100Below: assurance({ hp: 100, ap: 100 }), oddExact: assurance({ hp: 250, maxHP: 500 }), oddBelow: assurance({ hp: 249, maxHP: 500 }) },
  shadow: { base: shadowBall(), star2: shadowBall({ stars: 2 }), star5: shadowBall({ stars: 5 }), ap100crit: shadowBall({ ap: 100, crit: true }), twist: shadowBall({ others: [{ name: "o1", items: ["TWIST_BAND"] }] }), belt: shadowBall({ others: [{ name: "o1", items: ["BIG_EATER_BELT"] }] }), floor: shadowBall({ others: [{ name: "o1", speDef: 1 }] }), protect: shadowBall({ tO: { protect: true } }) },
  wave: { star1: waveSplash(), star4: waveSplash({ stars: 4 }), odd: waveSplash({ maxHP: 333 }), ap100: waveSplash({ ap: 100 }), belt: waveSplash({ items: ["BIG_EATER_BELT"] }), crit: waveSplash({ crit: true }), blocked: waveSplash({ tO: { protect: true } }), dead: waveSplash({ hp: 0 }) }
}
const D4X = out.CATCHUP_D4

const D4P = D4X.poltergeist
const pg = (x) => x.log[0].raw
expect("CATCHUP_D4 POLTERGEIST (real strategy, the real Tools list from Item.ts:604-626 and real isIn; 1 star base 30): the Tools list has 21 entries (first LIGHT_BALL, last TERRAIN_EXTENDER); the request is base [30, 60, 120, 240] + 20 per held item or 40 per held item that is in Tools, summed BEFORE AP / crit: no item 30, one Tool 70, one non-Tool 50, Tool + non-Tool 90, two Tools 110, the last Tool 70, a near-miss non-Tool (AMULET_COIN) 50, 2 stars with one Tool 100, all 21 Tools 30 + 21 x 40 = 870; AP 100 then doubles the summed 90 inside handleSpecialDamage (returned 180); the target's items are only read (the item set is unchanged: no stealing or mutation)", [D4P.toolsCount, D4P.first, D4P.last, pg(D4P.none), pg(D4P.tool), pg(D4P.other), pg(D4P.mixed), pg(D4P.twoTools), pg(D4P.lastTool), pg(D4P.nearMiss), pg(D4P.star2), pg(D4P.allTools), [pg(D4P.ap100), D4P.ap100.log[0].returned], [D4P.mixed.itemsSame, D4P.allTools.itemsSame]], [21, "LIGHT_BALL", "TERRAIN_EXTENDER", 30, 70, 50, 90, 110, 70, 50, 100, 870, [90, 180], [true, true]])
const D4O = D4X.pulse
const hitNames = (x) => x.hit.map((h) => h[0])
expect("CATCHUP_D4 ORIGIN_PULSE (real strategy on a row-major stand-in board; target in row 2, enemies a (1,2), b (5,2), d (2,3), e (4,4), an ally at (3,2) and a far enemy in row 0): SPECIAL [50, 75, 100, 120, 150] (fallback 150) to every opposing entity whose row equals target.positionY - a (1,2) and b (5,2) are hit, the same-row ally, the other rows and the distant row-0 enemy are not; per-hit resolution with the SAME crit flag (a crit doubles each: 200 returned) and AP 100 doubling each (200); no HP or range filter exists in the strategy", [hitNames(D4O.star3), [D4O.star1.hit[0][1], D4O.star4.hit[0][1], D4O.star5.hit[0][1], D4O.star6.hit[0][1]], D4O.ap100.hit.map((h) => h[3]), D4O.crit.hit.map((h) => [h[2], h[3]]), D4O.star3.allyHp], [["a", "b"], [50, 120, 150, 150], [200, 200], [[true, 200], [true, 200]], 500])
expect("CATCHUP_D4 ORIGIN_PULSE mutable-field demonstration (not proof of any live movement): the strategy rereads target.positionY inside EACH comparison instead of capturing a cast-time row. With a controlled callback on the first hit that sets target.positionY from 2 to 3, the later comparisons use 3: b (5,2) is no longer hit while d (2,3) is (hit a, d instead of a, b)", [hitNames(D4O.mutated), D4O.mutated.targetRowBefore, D4O.mutated.targetRowAfter], [["a", "d"], 2, 3])
const D4A = D4X.assurance
expect("CATCHUP_D4 ASSURANCE (real strategy): the request is doubled when the CASTER's hp / maxHP < 0.5 STRICTLY - hp 499 of 1000 doubles (raw 25 -> 50), exactly 500 / 1000 (and 250 / 500) does NOT, 501 and full HP do not; 2 stars below half 100, the fallback below half 400; the target's HP is not used; AP 100 doubles the doubled request inside handleSpecialDamage (50 -> returned 100); no status is added", [D4A.below.raw, D4A.exact.raw, D4A.above.raw, D4A.full.raw, D4A.oddExact.raw, D4A.oddBelow.raw, D4A.star2Below.raw, D4A.star5Below.raw, [D4A.ap100Below.raw, D4A.ap100Below.returned]], [50, 25, 25, 25, 25, 50, 100, 400, [50, 100]])
const D4S = D4X.shadow
expect("CATCHUP_D4 SHADOW_BALL (real strategy, addSpecialDefense, handleSpecialDamage; enemies SPE_DEF 10): SPECIAL 30 / 60 / 200 (fallback) on the target FIRST - the hit sees the OLD SPE_DEF 10 (returned 20 for raw 30) - then EVERY opposing board entity, the target included, gets addSpecialDefense(-2, caster, 0, false): 10 -> 8 each, the ally untouched; the debuff is not scaled by AP or a crit (AP 100 with a crit still -2); an enemy Twist Band holder GAINS 2 (12), an enemy Belt does not amplify it (8), SPE_DEF floors at 0 (1 -> 0); a protected target (damage returned 0) is still debuffed", [D4S.base.log[0].speDefAtCall, D4S.base.log[0].returned, D4S.base.speDef, [D4S.star2.log[0].raw, D4S.star5.log[0].raw], D4S.ap100crit.log.slice(1).map((l) => l[2]), D4S.twist.speDef.o1, D4S.belt.speDef.o1, D4S.floor.speDef.o1, [D4S.protect.log[0].returned, D4S.protect.speDef.target, D4S.protect.speDef.o2]], [10, 20, { target: 8, o1: 8, o2: 8, ally: 10 }, [60, 200], [-2, -2, -2], 12, 8, 0, [0, 8, 8]])
const D4W = D4X.wave
expect("CATCHUP_D4 WAVE_SPLASH (real strategy, addShield, handleSpecialDamage; caster maxHP 1000, no movement): both requests are Math.round(maxHP x 0.2) = 200 at 1-3 stars (0.5 -> 500 at 4 stars / fallback; maxHP 333 -> 67): addShield FIRST, then the damage recomputes the same raw expression; equal initial requests do not give equal finals: AP 100 doubles both (shield 400, damage returned 400), a crit does too, a Big Eater Belt changes only the shield (250 vs damage 200); a blocked hit (protect) still leaves the shield 200; no position changes (the comment's slam is not coded); a caster at 0 HP in a DIRECT process call gets no shield (alive gate) but the damage request is still made - not proof that a dead unit can cast", [D4W.star1.reqs, [D4W.star1.log[0].raw, D4W.star1.shield], D4W.star4.reqs[0][1], [D4W.odd.reqs[0][1], D4W.odd.log[0].raw], [D4W.ap100.shield, D4W.ap100.log[0].returned], [D4W.crit.reqs[0][3], D4W.crit.shield], [D4W.belt.shield, D4W.belt.log[0].returned], [D4W.blocked.shield, D4W.blocked.log[0].returned], D4W.star1.pos, [D4W.dead.shield, D4W.dead.log[0].raw]], [[["shield", 200, 1, false]], [200, 200], 500, [67, 67], [400, 400], [true, 400], [250, 200], [200, 0], [2, 5, 2, 2], [0, 200]])
// ---------------------------------------------------------------------------------------------------------------------------------
console.log(JSON.stringify(out, null, 1))
const failed = expectations.filter((x) => !x.ok)
for (const x of expectations) console.error(`${x.ok ? "ok  " : "FAIL"} ${x.name}${x.ok ? "" : ` -> got ${JSON.stringify(x.got)}, want ${JSON.stringify(x.want)}`}`)
if (process.argv.includes("--check") && failed.length) process.exit(1)
