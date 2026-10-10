// Validates data/07367c34/item-recipes-stats.json, knowledge/07367c34/silk-scarf-items.md and match-reference.md
// against the pinned source (`git show <sha>:<path>`). Production-branch reference; deployment unverified.
// Usage: node assistant/validate-items.mjs   (exit 0 = all checks pass). Read-only; no install.
// The tables are re-derived here by EVALUATING the declared object literals (the extractor parses lines instead),
// so the two methods must agree.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { isDeepStrictEqual as eq } from "node:util"

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, "..")
const SHA = "07367c341fe928763da2b565c2eee010433e4fc1"
const problems = [], bad = (m) => problems.push(m)
const cache = new Map()
const src = (f) => { if (!cache.has(f)) cache.set(f, execFileSync("git", ["-C", REPO, "show", `${SHA}:${f}`], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\n")); return cache.get(f) }
const norm = (s) => s.replace(/\s+/g, " ").trim()
const data = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/item-recipes-stats.json"), "utf8"))
if (data.sourceSha !== SHA) bad("sourceSha mismatch")

// 1. independent re-derivation by evaluating the literals
const literal = (file, header) => {
  const L = src(file), s = L.findIndex((l) => l.startsWith(header))
  if (s < 0) { bad(`cannot find ${header}`); return {} }
  let e = s + 1
  while (L[e] !== "}") e++
  const body = "{" + L.slice(s + 1, e).join("\n") + "}"
  const toStr = body.replace(/\bItem\.([A-Z0-9_]+)/g, '"$1"').replace(/\bStat\.([A-Z0-9_]+)/g, '"$1"')
  return Function(`"use strict"; return (${toStr.replace(/\[("[^"]+")\]:/g, "$1:")})`)()
}
const recipe = literal("app/types/enum/Item.ts", "export const ItemRecipe")
const stats = literal("app/config/game/items.ts", "export const ItemStats")
const dRecipe = Object.fromEntries(data.recipes.map((r) => [r.result, r.ingredients]))
const dStats = Object.fromEntries(data.itemStats.map((s) => [s.item, s.values]))
if (!eq(recipe, dRecipe)) bad("ItemRecipe in data differs from the evaluated source literal")
if (!eq(stats, dStats)) bad("ItemStats in data differs from the evaluated source literal")
if (Object.keys(recipe).length !== data.recipes.length || Object.keys(stats).length !== data.itemStats.length) bad("entry counts differ")
// entry order and line numbers
data.recipes.forEach((r) => { const t = src("app/types/enum/Item.ts")[r.line - 1]; if (!t.includes(`Item.${r.result}]`)) bad(`recipe line ${r.line} is not ${r.result}`) })
data.itemStats.forEach((s) => { const t = src("app/config/game/items.ts")[s.lines[0] - 1]; if (!t.includes(`Item.${s.item}]`)) bad(`stats line ${s.lines[0]} is not ${s.item}`) })
const scarves = Object.keys(recipe).filter((k) => recipe[k].includes("SILK_SCARF"))
if (!eq(scarves, data.derived.scarvesRecipeResults)) bad("derived scarf list differs")
if (scarves.length !== 10) bad(`expected 10 scarf recipes, found ${scarves.length}`)

// 2. handler / caller citations used by the guide: [file, "a–b" as written in the guide, expected text (all must appear in the range)]
const CITES = [
  ["app/types/enum/Item.ts", "552–561", ["[Item.FRIEND_BOW]: [Item.SILK_SCARF, Item.FOSSIL_STONE]", "[Item.NULLIFY_BANDANNA]: [Item.SILK_SCARF, Item.SILK_SCARF]"]],
  ["app/types/enum/Item.ts", "837", ["[Item.FRIEND_BOW]: Synergy.NORMAL"]],
  ["app/config/game/items.ts", "98", ["[Item.SILK_SCARF]: { [Stat.SHIELD]: 15 }"]],
  ["app/core/pokemon-entity.ts", "825–828", ["applyItemEffect", "applyStat"]],
  ["app/core/pokemon-entity.ts", "1399–1437", ["applyStat(stat: Stat", "case Stat.SHIELD:", "this.addShield(value, this, 0, false)"]],
  ["app/core/effects/items.ts", "608–614", ["[Item.BLACK_BELT]", "if (crit)", "Math.ceil(0.33 * totalDamage)"]],
  ["app/core/pokemon-state.ts", "236–238", ["const totalDamage = physicalDamage + specialDamage + trueDamage"]],
  ["app/core/pokemon-state.ts", "215–216", ["damage *= 1 + (pokemon.critPower - 1) * critReductionFactor"]],
  ["app/core/pokemon-state.ts", "67–70", ["hasCritNegation = target.items.has(Item.ROCKY_HELMET)", "critReductionFactor = 0"]],
  ["app/core/pokemon-state.ts", "99–117", ["damage = 0", "target.status.protect"]],
  ["app/core/pokemon-state.ts", "284–296", ["pokemon.onAttack({", "totalDamage,", "crit"]],
  ["app/core/pokemon-entity.ts", "910, 938–950", ["called after every attack, no matter if it's successful or not", "this.getEffects(OnAttackEffect)"]],
  ["app/core/effects/items.ts", "241–253", ["class MachRibbonEffect", "pokemon.addSpeed(20, pokemon, 0, false)", "3000"]],
  ["app/core/effects/items.ts", "784–798", ["[Item.MACH_RIBBON]", "new MachRibbonEffect()", "pokemon.addSpeed(-15 * effect.count"]],
  ["app/core/effects/items.ts", "1500–1534", ["[Item.EXPLOSIVE_BAND]", "OnShieldDepletedEffect", "dps.get(pokemon.id)?.shield ?? 0", "Math.round(0.5 * shieldGained)", "pokemon.removeItem(Item.EXPLOSIVE_BAND)", "cell.value.team !== pokemon.team", "handleSpecialDamage"]],
  ["app/core/pokemon-state.ts", "620–643", ["if (pokemon.shield > 0)", "damageOnShield >= pokemon.shield", "OnShieldDepletedEffect"]],
  ["app/core/pokemon-state.ts", "408–417", ["shield < 0 && pokemon.shield <= 0", "OnShieldDepletedEffect"]],
  ["app/core/pokemon-state.ts", "407", ["caster.shieldDone += shield"]],
  ["app/core/board.ts", "152–163", ["getAdjacentCells", "includesCenter = false"]],
  ["app/core/simulation.ts", "1345–1384", ["blueDpsMeter", "redDpsMeter", "pkm.shieldDone"]],
  ["app/core/dps.ts", "dps.ts", ["@type(\"uint16\") shield = 0", "this.shield = shield"]],
  ["app/core/pokemon-entity.ts", "1839–1868", ["function applyBigEaterBeltStatBuff", "value * 1.25", "function applyTwistBandBuff", "value *= -1"]],
  ["app/models/colyseus-models/pokemon.ts", "164–168", ["Item.BIG_EATER_BELT", "dishes.size === 1"]],
  ["app/core/pokemon-state.ts", "698–725", ["pokemon.items.has(Item.COVER_BAND) === false", "ally.items.has(Item.COVER_BAND)", "ally.hp > 0", "coverAlly.handleDamage", "damage: incomingDamage"]],
  ["app/core/effects/items.ts", "1536–1548", ["[Item.EFFICIENT_BANDANNA]", "[-1, 0, 1]", "entity.positionY", "Math.round(0.85 * ally.maxPP)"]],
  ["app/core/effects/items.ts", "1550–1554", ["[Item.LUCKY_RIBBON]", "addDodgeChance(0.15"]],
  ["app/core/board.ts", "33–37", ["getEntityOnCell", "isOnBoard"]],
  ["app/core/simulation.ts", "239–262", ["post simulation start hooks", "OnSimulationStartEffect"]],
  ["app/core/pokemon-entity.ts", "250–256", ["get canCast", "Item.NULLIFY_BANDANNA"]],
  ["app/core/attacking-state.ts", "92", ["pokemon.pp >= pokemon.maxPP && pokemon.canCast"]],
  ["app/core/moving-state.ts", "40–43", ["pokemon.pp >= pokemon.maxPP", "pokemon.canCast"]],
  ["app/core/pokemon-state.ts", "132–135", ["Item.NULLIFY_BANDANNA", "specialDamage += pokemon.pp", "pokemon.pp = 0"]],
  ["app/core/pokemon-state.ts", "257–268", ["handleSpecialDamage", "specialDamage"]],
  ["app/core/pokemon-entity.ts", "621–631", ["addAbilityPower", "Item.NULLIFY_BANDANNA", "Math.round(0.2 * value)"]],
  ["app/core/pokemon-entity.ts", "163–165", ["pokemon.items.forEach((it) => {", "this.items.add(it)"]],
  ["app/core/simulation.ts", "498–534", ["applyItemsEffects(", "pokemon.applyItemEffect(item)"]],
  ["app/config/game/synergies.ts", "180", ["[Synergy.NORMAL]: [3, 5, 7, 9]"]],
  ["app/models/colyseus-models/synergies.ts", "300–307", ["getSynergyTier", ".length"]],
  ["app/models/colyseus-models/player.ts", "504–570", ["getScarvesItemsWithNbScarves", "Item.NULLIFY_BANDANNA ? 2 : 1", "updateScarves"]],
  ["app/rooms/commands/game-commands.ts", "670–678", ["Item.SILK_SCARF", "player.scarvesItems.length < nbScarvesBasedOnNormalSynergy", "player.scarvesItems.push(result)"]],
  ["app/rooms/commands/game-commands.ts", "681–683", ["player.items.push(result)", "removeInArray(player.items, itemA)", "removeInArray(player.items, itemB)"]],
  ["app/rooms/commands/game-commands.ts", "906–932", ["recipe[1].includes(Item.SILK_SCARF)", "player.scarvesItems.push(itemCombined)", "pokemon.addItem(itemCombined, player)"]],
  ["app/rooms/commands/game-commands.ts", "925–931", ["itemCombined === Item.FRIEND_BOW", "pokemon.types.has(SynergyGivenByItem[itemCombined])"]],
  ["app/models/colyseus-models/player.ts", "542–564", ["lostScarves", "removeScarf", "removeInArray<Item>(this.items, item)"]],
  ["app/services/gift-shop.ts", "273", ["giftAmountOfItem(1, [Item.SILK_SCARF])"]],
  ["app/core/mini-game.ts", "580–587", ["TownEncounters.CINCCINO", "Item.SILK_SCARF"]],
]
const rangeOf = (cite) => {
  const m = cite.match(/^(\d+)(?:–(\d+))?$/); if (!m) return null
  return [Number(m[1]), Number(m[2] ?? m[1])]
}
const guide = readFileSync(resolve(HERE, "knowledge/07367c34/silk-scarf-items.md"), "utf8")
for (const [file, cite, expects] of CITES) {
  const L = src(file)
  let ranges
  if (cite === "dps.ts") ranges = [[1, L.length]]
  else ranges = cite.split(",").map((c) => rangeOf(c.trim())).filter(Boolean)
  if (!ranges.length) { bad(`${file} ${cite}: unparsable range`); continue }
  for (const [a, b] of ranges) if (!(a >= 1 && b >= a && b <= L.length)) bad(`${file}:${cite} out of range`)
  const text = norm(ranges.map(([a, b]) => L.slice(a - 1, b).join(" ")).join(" "))
  for (const x of expects) if (!text.includes(norm(x))) bad(`${file}:${cite}: "${x}" not found`)
  if (cite !== "dps.ts" && !guide.includes(cite)) bad(`guide does not cite ${file}:${cite}`)
}
// 2b. Foundation citations used by core-mechanics.md §H–I (basic attack vs ability, ability crit, cast slot, item stats -> combat stats)
const FOUND = [
  ["app/core/pokemon-state.ts", "36", ["let damage = pokemon.atk"]],
  ["app/core/pokemon-state.ts", "41–43", ["EffectEnum.SPECIAL_ATTACKS", "AttackType.SPECIAL"]],
  ["app/core/pokemon-state.ts", "59", ["const crit = chance(critChance, pokemon)"]],
  ["app/core/pokemon-state.ts", "85–91", ["WONDER_ROOM", "damage = Math.ceil(damage * (1 + pokemon.ap / 100))"]],
  ["app/core/pokemon-state.ts", "208–212", ["trueDamagePart > 0", "trueDamage = damage * trueDamagePart"]],
  ["app/core/pokemon-state.ts", "214–217", ["damage *= 1 + (pokemon.critPower - 1) * critReductionFactor"]],
  ["app/core/pokemon-state.ts", "234–238", ["physicalDamage = Math.round(physicalDamage)", "const totalDamage"]],
  ["app/core/pokemon-state.ts", "257–268", ["target.handleSpecialDamage(", "specialDamage,", "false,"]],
  ["app/core/pokemon-state.ts", "455–507", ["attacker.status.enraged", "electricField", "psychicField"]],
  ["app/core/pokemon-state.ts", "559–566", ["damage / (1 + ARMOR_FACTOR * def)", "damage / (1 + ARMOR_FACTOR * speDef)"]],
  ["app/core/pokemon-state.ts", "597", ["reducedDamage = min(1)(Math.ceil(reducedDamage))"]],
  ["app/core/pokemon-entity.ts", "346–353", ["handleSpecialDamage(", "apBoost = true"]],
  ["app/core/pokemon-entity.ts", "354–358", ["this.status.protect", "this.status.skydiving", "this.status.magicBounce"]],
  ["app/core/pokemon-entity.ts", "399–400", ["let specialDamage =", "attacker && apBoost ? attacker.ap : 0"]],
  ["app/core/pokemon-entity.ts", "401–404", ["EffectEnum.DOUBLE_DAMAGE", "specialDamage *= 2"]],
  ["app/core/pokemon-entity.ts", "405–411", ["STRANGE_STEAM_BOARD_EFFECT", "specialDamage *= 1.2"]],
  ["app/core/pokemon-entity.ts", "412–433", ["if (crit && attacker)", "Item.ROCKY_HELMET", "BLACK_AUGURITE", "specialDamage *= 1 + (attacker.critPower - 1) * critReductionFactor"]],
  ["app/core/pokemon-entity.ts", "435–442", ["this.state.handleDamage", "damage: specialDamage"]],
  ["app/core/pokemon-entity.ts", "97", ["pp = 0"]],
  ["app/core/pokemon-entity.ts", "530", ["this.pp = clamp(this.pp + value, 0, this.maxPP * 2 - 1)"]],
  ["app/core/pokemon-entity.ts", "183–198", ["this.maxPP = pokemon.maxPP", "this.ap = pokemon.ap"]],
  ["app/core/pokemon-entity.ts", "163–165", ["pokemon.items.forEach((it) => {", "this.items.add(it)"]],
  ["app/core/pokemon-entity.ts", "782–815", ["addItem(", "this.items.add(item)", "this.applyItemEffect(item)"]],
  ["app/core/pokemon-entity.ts", "825–846", ["applyItemEffect(item: Item)", "this.applyStat("]],
  ["app/core/simulation.ts", "498–534", ["applyItemsEffects(", "pokemon.applyItemEffect(item)"]],
  ["app/core/abilities/hidden-power.ts", "368", ["uxie.addItem(Item.AQUA_EGG)"]],
  ["app/core/pokemon-entity.ts", "414–416", ["this.items.has(Item.ROCKY_HELMET)", "attackType !== AttackType.TRUE"]],
  ["app/core/pokemon-state.ts", "67–70", ["hasCritNegation = target.items.has(Item.ROCKY_HELMET)"]],
  ["app/core/pokemon-entity.ts", "1399–1437", ["case Stat.AP:", "this.addAbilityPower(value", "case Stat.PP:", "this.addPP(value", "case Stat.HP:"]],
  ["app/core/abilities/cast.ts", "16–26", ["pokemon.canCast === false", "EffectEnum.ABILITY_CRIT", "abilityStrategy.canCritByDefault", "chance(pokemon.critChance / 100", "abilityStrategy.process"]],
  ["app/core/abilities/ability-strategy.ts", "8", ["canCritByDefault = false"]],
  ["app/core/abilities/ability-strategy.ts", "15–17", ["pokemon.pp = min(0)(pokemon.pp - pokemon.maxPP)", "pokemon.count.ult += 1"]],
  ["app/core/abilities/blast-burn.ts", "6–28", ["class BlastBurnStrategy extends AbilityStrategy", "[30, 60, 120, 240][pokemon.stars - 1]", "handleSpecialDamage(", "crit"]],
  ["app/core/abilities/blast-burn.ts", "14", ["[30, 60, 120, 240]"]],
  ["app/core/effects/items.ts", "946–957", ["[Item.REAPER_CLOTH]", "EffectEnum.ABILITY_CRIT"]],
  ["app/core/effects/dishes.ts", "128–145", ["Item.LARGE_LEEK", "Item.LEEK", "EffectEnum.ABILITY_CRIT"]],
  ["app/core/attacking-state.ts", "22", ["pokemon.cooldown <= 0"]],
  ["app/core/attacking-state.ts", "24", ["pokemon.resetCooldown(1000, speed)"]],
  ["app/core/attacking-state.ts", "92–94", ["pokemon.pp >= pokemon.maxPP && pokemon.canCast", "castAbility("]],
  ["app/core/moving-state.ts", "40–45", ["AbilityStrategies[pokemon.skill]?.requiresTarget === false", "castAbility("]],
  ["app/core/simulation.ts", "350–351", ["this.applySynergyEffects(pokemonEntity)", "this.applyItemsEffects(pokemonEntity)"]],
  ["app/config/game/battle.ts", "8–9", ["DEFAULT_CRIT_CHANCE = 10", "DEFAULT_CRIT_POWER = 2"]],
]
const cm = readFileSync(resolve(HERE, "knowledge/07367c34/core-mechanics.md"), "utf8")
for (const [file, cite, expects] of FOUND) {
  const L = src(file), [a, b] = rangeOf(cite)
  if (!(a >= 1 && b <= L.length)) { bad(`${file}:${cite} out of range`); continue }
  const text = norm(L.slice(a - 1, b).join(" "))
  for (const x of expects) if (!text.includes(norm(x))) bad(`${file}:${cite}: "${x}" not found`)
  if (!cm.includes("`:" + cite + "`") && !cm.includes(":" + cite)) bad(`core-mechanics.md does not cite ${file}:${cite}`)
}
// no ItemStats entry uses MAX_PP, and applyStat has no MAX_PP case
if (data.itemStats.some((e) => "MAX_PP" in e.values)) bad("an ItemStats entry uses MAX_PP; core-mechanics §I is wrong")
if (src("app/core/pokemon-entity.ts").slice(1398, 1437).join("\n").includes("MAX_PP")) bad("applyStat mentions MAX_PP; core-mechanics §I is wrong")

// Twist Band / Big Eater call sites: exact method list at the cited lines
const PE = src("app/core/pokemon-entity.ts")
const methodAt = (line) => { for (let i = line - 1; i >= 0; i--) { const m = PE[i].match(/^  (add[A-Za-z]+)\(/); if (m) return m[1] } }
const BIG = { 504: "addShield", 546: "addCritChance", 571: "addCritPower", 587: "addMaxHP", 615: "addDodgeChance", 636: "addAbilityPower", 662: "addLuck", 688: "addDefense", 714: "addSpecialDefense", 740: "addAttack", 759: "addSpeed" }
const TWIST = { 521: "addPP", 547: "addCritChance", 572: "addCritPower", 588: "addMaxHP", 616: "addDodgeChance", 637: "addAbilityPower", 663: "addLuck", 689: "addDefense", 715: "addSpecialDefense", 741: "addAttack", 760: "addSpeed" }
for (const [line, name] of Object.entries(BIG)) { if (!PE[line - 1].includes("applyBigEaterBeltStatBuff(this")) bad(`Big Eater call not at pokemon-entity.ts:${line}`); if (methodAt(line) !== name) bad(`line ${line} is in ${methodAt(line)}, expected ${name}`); if (!guide.includes(`\`${name}\` ${line}`)) bad(`guide lacks Big Eater ${name} ${line}`) }
for (const [line, name] of Object.entries(TWIST)) { if (!PE[line - 1].includes("applyTwistBandBuff(this")) bad(`Twist Band call not at pokemon-entity.ts:${line}`); if (methodAt(line) !== name) bad(`line ${line} is in ${methodAt(line)}, expected ${name}`); if (!guide.includes(`\`${name}\` ${line}`)) bad(`guide lacks Twist Band ${name} ${line}`) }
const allBig = PE.map((l, i) => (l.includes("applyBigEaterBeltStatBuff(this") ? i + 1 : 0)).filter(Boolean)
const allTwist = PE.map((l, i) => (l.includes("applyTwistBandBuff(this") ? i + 1 : 0)).filter(Boolean)
if (!eq(allBig, Object.keys(BIG).map(Number))) bad(`Big Eater call sites in source: ${allBig}`)
if (!eq(allTwist, Object.keys(TWIST).map(Number))) bad(`Twist Band call sites in source: ${allTwist}`)

// 3. Markdown tables agree with the data
const parseBonuses = (t) => Object.fromEntries(t.split(",").map((s) => s.trim().match(/^([A-Z_]+) (-?\d+)$/)).filter(Boolean).map((m) => [m[1], Number(m[2])]))
const titleToKey = (t) => t.replace(/[*`]/g, "").trim()
const check = (file, rowRe) => {
  const md = readFileSync(resolve(HERE, file), "utf8")
  let seen = 0
  for (const line of md.split("\n")) {
    const cells = line.split("|").map((c) => c.trim())
    const key = titleToKey(cells[1] ?? "")
    if (!scarves.includes(key)) continue
    seen++
    const exp = data.derived.scarfItemStats[key]
    const ing = recipe[key].filter((x) => x !== "SILK_SCARF")
    const second = ing.length ? ing[0] : "SILK_SCARF"
    const flat = (t) => t.toLowerCase().replace(/[^a-z]/g, "")
    if (flat(cells[2] ?? "") !== flat(second)) bad(`${file}: ${key} second component cell "${cells[2]}" does not match ${second}`)
    const got = parseBonuses((cells[3] ?? "").replace(/\(`[^)]*`\)/g, "").replace(/\s+/g, " ").trim())
    if (!eq(got, exp)) bad(`${file}: ${key} bonuses ${JSON.stringify(got)} != source ${JSON.stringify(exp)}`)
  }
  if (seen !== 10) bad(`${file}: expected 10 scarf rows, found ${seen}`)
}
check("knowledge/07367c34/silk-scarf-items.md")
if (existsSync(resolve(HERE, "knowledge/07367c34/match-reference.md"))) check("knowledge/07367c34/match-reference.md")
else bad("match-reference.md missing")

// 4. item-effects.json (batch 1): evidence ranges, recipes/declared stats vs item-recipes-stats.json and source, absence checks, Markdown agreement
{
  const fx = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/item-effects.json"), "utf8"))
  if (fx.sourceSha !== SHA) bad("item-effects.json sourceSha mismatch")
  const ids = new Set()
  for (const e of fx.evidence) {
    if (ids.has(e.id)) bad(`item-effects: duplicate evidence id ${e.id}`)
    ids.add(e.id)
    const L = src(e.file), [a, b] = e.lines
    if (!(a >= 1 && b >= a && b <= L.length)) { bad(`item-effects ${e.id}: bad range ${a}-${b}`); continue }
    if (!norm(L.slice(a - 1, b).join(" ")).includes(norm(e.expect))) bad(`item-effects ${e.id}: "${e.expect}" not in ${e.file}:${a}-${b}`)
  }
  const BATCH1 = ["CHOICE_SPECS", "SOUL_DEW", "UPGRADE", "REAPER_CLOTH", "AQUA_EGG", "BLUE_ORB", "SCOPE_LENS", "POKEMONOMICON", "SHINY_CHARM", "MAX_REVIVE", "SHELL_BELL", "HEAVY_DUTY_BOOTS"]
  const BATCH2 = ["ABILITY_SHIELD", "POWER_LENS", "STAR_DUST", "DEEP_SEA_TOOTH", "XRAY_VISION", "RAZOR_FANG", "LOADED_DICE", "PUNCHING_GLOVE", "MUSCLE_BAND", "ASSAULT_VEST", "POKE_DOLL", "ROCKY_HELMET"]
  const BATCH3 = ["GREEN_ORB", "GRACIDEA_FLOWER", "WONDER_BOX", "SMOKE_BALL", "WIDE_LENS", "RAZOR_CLAW", "SAFETY_GOGGLES", "KINGS_ROCK", "STICKY_BARB", "PROTECTIVE_PADS", "RED_ORB", "FLAME_ORB"]
  const SCARVES = ["FRIEND_BOW", "BLACK_BELT", "MACH_RIBBON", "EXPLOSIVE_BAND", "TWIST_BAND", "LUCKY_RIBBON", "BIG_EATER_BELT", "COVER_BAND", "EFFICIENT_BANDANNA", "NULLIFY_BANDANNA"]
  const STONES = ["OLD_AMBER", "DAWN_STONE", "WATER_STONE", "THUNDER_STONE", "FIRE_STONE", "MOON_STONE", "DUSK_STONE", "LEAF_STONE", "ICE_STONE"]
  const WANT = [...BATCH1, ...BATCH2, ...BATCH3, ...SCARVES, ...STONES]
  // exact key-set equality with the ItemRecipe output keys of the pinned source; Eviolite / Shiny Stone are not recipe outputs
  if (!eq([...WANT].sort(), Object.keys(recipe).sort())) bad("batch lists do not equal the ItemRecipe key set")
  if (WANT.length !== 55 || new Set(WANT).size !== 55) bad("expected 55 distinct recipe outputs")
  if (!eq(Object.keys(fx.items).sort(), [...WANT].sort())) bad("item-effects: key set differs from the ItemRecipe output keys")
  if ("EVIOLITE" in fx.items || "SHINY_STONE" in fx.items) bad("Eviolite / Shiny Stone must not be counted in item-effects.json")
  const md = readFileSync(resolve(HERE, "knowledge/07367c34/item-effects.md"), "utf8")
  const cite = (id) => { const e = fx.evidence.find((x) => x.id === id); return e && `${e.file.replace(/^app\//, "")}:${e.lines[0] === e.lines[1] ? e.lines[0] : e.lines[0] + "–" + e.lines[1]}` }
  for (const [name, rec] of Object.entries(fx.items)) {
    if (!eq(rec.recipe.ingredients, recipe[name])) bad(`item-effects ${name}: recipe differs from source`)
    if (!eq(rec.recipe.ingredients, dRecipe[name])) bad(`item-effects ${name}: recipe differs from item-recipes-stats.json`)
    const declared = stats[name] ?? null
    if (!eq(rec.declaredStats, declared)) bad(`item-effects ${name}: declaredStats ${JSON.stringify(rec.declaredStats)} != source ${JSON.stringify(declared)}`)
    if (name === "MAX_REVIVE" && rec.declaredStats !== null) bad("MAX_REVIVE must record declaredStats null (no entry)")
    const pre = rec.effects.length ? "" : "(no behavioral effect)"
    if (!rec.effects.length && !(rec.absentEffects && rec.absentEffects.length)) bad(`item-effects ${name}: no effects and no absentEffects`)
    if (!(rec.unresolved && rec.unresolved.length)) bad(`item-effects ${name}: no unresolved details recorded`)
    if (!("declaredStats" in rec)) bad(`item-effects ${name}: declaredStats availability missing`)
    const used = new Set([...(rec.evidence ?? [])])
    for (const ef of rec.effects) {
      if (!ef.evidence?.length) bad(`item-effects ${name}/${ef.id}: no evidence`)
      for (const x of ef.evidence ?? []) { used.add(x); if (!ids.has(x)) bad(`item-effects ${name}/${ef.id}: unknown evidence ${x}`) }
      if (!md.includes(ef.id)) bad(`item-effects.md lacks effect id ${ef.id}`)
    }
    for (const x of rec.evidence ?? []) if (!ids.has(x)) bad(`item-effects ${name}: unknown evidence ${x}`)
    for (const x of used) { const c = cite(x); if (c && !md.includes(c)) bad(`item-effects.md lacks citation ${c} (${name}/${x})`) }
    if (!md.includes("### " + name)) bad(`item-effects.md lacks section for ${name}`)
  }
  // confirmed absences: records with absentEffectsCheck must be referenced only in the listed TypeScript files
  for (const [name, rec] of Object.entries(fx.items)) {
    if (!rec.absentEffectsCheck) { if (rec.handlerIn === "none") bad(`${name}: handlerIn none needs absentEffectsCheck`); continue }
    const g = execFileSync("git", ["-C", REPO, "grep", "-l", name, SHA, "--", ":(glob)app/**/*.ts", ":(glob)app/**/*.tsx"], { encoding: "utf8" }).trim().split("\n").map((l) => l.replace(SHA + ":", "")).sort()
    if (!eq(g, [...rec.absentEffectsCheck.gitGrepFiles].sort())) bad(`${name} referenced in unexpected files: ${g}`)
  }
  // each record says where its handler lives; check that against the ItemEffects table (ItemEffects entry present <=> handlerIn "ItemEffects")
  const ie = src("app/core/effects/items.ts").join("\n")
  for (const [k, rec] of Object.entries(fx.items)) {
    const inTable = ie.includes(`[Item.${k}]:`)
    if (rec.handlerIn === "ItemEffects" && !inTable) bad(`ItemEffects has no [Item.${k}] entry`)
    if (rec.handlerIn === "ItemEffects-generated") {
      // stones: the OnItemDropped refusal is generated for every SynergyStones member (items.ts), not written as a literal key
      if (inTable || !ie.includes("SynergyStones.map((stone) => [") || !STONES.includes(k)) bad(`${k}: generated ItemEffects claim is wrong`)
    } else if (rec.handlerIn !== "ItemEffects" && inTable) bad(`ItemEffects has a ${k} entry but the record says handlerIn=${rec.handlerIn}`)
    if (!["ItemEffects", "ItemEffects-generated", "elsewhere", "none"].includes(rec.handlerIn)) bad(`${k}: handlerIn missing/invalid`)
  }
  // corrections made after batch 1 stay in place
  const lim = (k) => JSON.stringify(fx.items[k].effects)
  if (!/clamps SPE_DEF at 0/.test(lim("POKEMONOMICON"))) bad("POKEMONOMICON record lost the SPE_DEF clamp")
  if (!/0\.5 to the crit-power multiplier/.test(lim("REAPER_CLOTH"))) bad("REAPER_CLOTH record lost the crit-power units")
  if (!/not guaranteed/.test(lim("SCOPE_LENS")) || !/not unconditional/.test(lim("BLUE_ORB"))) bad("Scope Lens / Blue Orb records lost the addPP qualification")
  // milestone corrections stay in place
  if (!/residual damage that goes to HP/.test(lim("PROTECTIVE_PADS")) || /HP damage is not doubled/.test(lim("PROTECTIVE_PADS"))) bad("PROTECTIVE_PADS record lost the shield-overflow correction")
  if (!/HP -40/.test(JSON.stringify(fx.items.PROTECTIVE_PADS.arithmetic)) || !/not an execution/.test(JSON.stringify(fx.items.PROTECTIVE_PADS.arithmetic))) bad("PROTECTIVE_PADS arithmetic example missing or not labelled")
  if (/only when the caster has ABILITY_CRIT/.test(JSON.stringify(fx.items.RAZOR_CLAW)) || !/canCritByDefault/.test(JSON.stringify(fx.items.RAZOR_CLAW))) bad("RAZOR_CLAW record has the retired ability-crit wording")
  if (!/does not enlarge|not enlarge|does not enlarge that area/.test(JSON.stringify(fx.items.WIDE_LENS)) || !/Inference/.test(JSON.stringify(fx.items.WIDE_LENS))) bad("WIDE_LENS record lost the Blast Burn area qualification")
  if (!/ATTEMPTS to set the holder on fire/.test(lim("FLAME_ORB")) || !/Rune Protect/.test(lim("FLAME_ORB"))) bad("FLAME_ORB record lost the blockable-burn wording")
  if (/permanently burns/.test(md)) bad("item-effects.md still says Flame Orb permanently burns")
  // lookup-item cards: every record has display name, summary, caveats and a note link whose anchor exists; numbers in the
  // summary / caveats must also appear in the detailed record (so a compact summary cannot invent a figure)
  for (const k of WANT) {
    const rec = fx.items[k]
    for (const f of ["displayName", "summary", "caveats", "noteLink"]) if (typeof rec[f] !== "string" || !rec[f].trim()) bad(`${k}: ${f} missing for the lookup card`)
    const anchor = rec.noteLink?.match(/item-effects\.md#(.+)$/)
    if (anchor && !md.split("\n").some((l) => l === "### " + anchor[1].toUpperCase())) bad(`${k}: noteLink anchor ${anchor[1]} has no heading in item-effects.md`)
    if (!anchor && !(SCARVES.includes(k) && rec.noteLink === "knowledge/07367c34/silk-scarf-items.md")) bad(`${k}: unexpected noteLink ${rec.noteLink}`)
    const detail = JSON.stringify({ ...rec, summary: undefined, caveats: undefined })
    const has = (n) => new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d])`).test(detail)
    for (const m of (rec.summary + " " + rec.caveats).matchAll(/(\d+(?:\.\d+)?)( ?%)?/g)) {
      const n = m[1]
      const pct = m[2] ? String(+(Number(n) / 100).toFixed(4)) : null // "33 %" may appear as 0.33 in the record
      if (!has(n) && !(pct && has(pct))) bad(`${k}: number ${m[0].trim()} in summary/caveats not found in the detailed record`)
    }
  }
  // compact summaries must keep the important conditions
  const card = (k) => (fx.items[k].summary + " " + fx.items[k].caveats)
  const need = (k, ...res) => res.forEach((re) => { if (!re.test(card(k))) bad(`${k}: summary/caveats lost ${re}`) })
  need("NULLIFY_BANDANNA", /cannot cast/, /PP/, /Attack/, /positive or negative/)
  need("PROTECTIVE_PADS", /only to a target that has a shield/, /excess goes to HP/, /unshielded/, /arithmetic/)
  need("WIDE_LENS", /does not enlarge|not enlarge/, /inference/)
  need("FLAME_ORB", /attempts/, /Rune Protect/, /burn immunity/, /Water Bubble/)
  need("DUSK_STONE", /MovingState/, /not a guaranteed first attack/)
  for (const k of STONES) need(k, /ordinary base counting/, /Dragon doubling/, /Removal differs by path/)
  // stone path qualifications (records)
  for (const k of STONES) {
    const t = JSON.stringify(fx.items[k].effects)
    if (!/ordinary base counting/.test(t) || !/Dragon doubling/.test(t)) bad(`${k}: stone counting qualification missing in effects`)
    if (!/Board unit \(Pokemon\.removeItems\)/.test(t) || !/Fight entity \(PokemonEntity\.removeItemEffect\)/.test(t) || !/without checking other held type-granting items/.test(t)) bad(`${k}: separate removal paths missing in effects`)
  }
  if (!/MovingState/.test(JSON.stringify(fx.items.DUSK_STONE.effects)) || /so it acts first/.test(JSON.stringify(fx.items.DUSK_STONE.effects))) bad("DUSK_STONE record has the retired initial-cooldown wording")
  // card corrections (Smoke Ball survives-a-hit, Shell Bell abilities, Big Eater same-team negatives): card, record and note agree
  need("SMOKE_BALL", /survives a damaging hit/, /does not save a lethal hit/, /fight entity/)
  need("SHELL_BELL", /basic attacks or abilities/)
  need("BIG_EATER_BELT", /same-team sources/, /enemies or the environment are not scaled/)
  const rj = (k) => JSON.stringify(fx.items[k].effects)
  if (!/SURVIVES a damaging hit/.test(rj("SMOKE_BALL")) || !/does not save a lethal hit/.test(rj("SMOKE_BALL")) || !/fight entity/.test(rj("SMOKE_BALL"))) bad("SMOKE_BALL record lost the survive-the-hit condition")
  if (!/basic attack parts or ability/.test(rj("SHELL_BELL"))) bad("SHELL_BELL record lost the ability-damage condition")
  if (!/negative values from same-team casters/.test(rj("BIG_EATER_BELT"))) bad("BIG_EATER_BELT record lost the same-team negative scaling")
  if (!/does not save a lethal hit/.test(md) || !/same-team/.test(md.slice(md.indexOf("### BIG_EATER_BELT"), md.indexOf("### COVER_BAND")))) bad("item-effects.md lacks the Smoke Ball / Big Eater corrections")
  // representative-builds / match-reference guidance
  const rb = readFileSync(resolve(HERE, "knowledge/07367c34/representative-builds.md"), "utf8")
  const mr = readFileSync(resolve(HERE, "knowledge/07367c34/match-reference.md"), "utf8")
  const gs = mr.indexOf("## Item choice guidance"), ge = mr.indexOf("\n## ", gs + 5)
  if (gs < 0) bad("match-reference.md lacks the Item choice guidance section")
  else if (mr.slice(gs, ge).split(/\s+/).filter(Boolean).length > 450) bad("Item choice guidance exceeds 450 words")
  for (const t of ["Charmander", "Totodile", "Vespiquen"]) if (gs >= 0 && !mr.slice(gs, ge).includes(t)) bad(`guidance lacks ${t}`)
  for (const t of ["not simulated fights and not parity with the combat engine", "newly inspected", "abilities/heal-order.ts:47", "defend-order.ts:42", "Default", "Anti-synergies"]) if (!rb.includes(t)) bad(`representative-builds.md lacks "${t}"`)
  // timing-model corrections: no derived cast times / fight-length cutoffs in the guidance, answer checks or builds note
  const ac = readFileSync(resolve(HERE, "analysis/representative-answer-checks.md"), "utf8")
  const guide = gs >= 0 ? mr.slice(gs, ge) : ""
  const timeLike = /(\d+(\.\d+)? ?s\b|≈ ?\d+(\.\d+)? ?s\b|fights? (of )?(at least|≥)|fights? last|past ~?\d+|before ~?\d+)/
  for (const [n, t] of [["match-reference guidance", guide], ["answer checks", ac.replace(/Common pass criteria[\s\S]*/, "")], ["representative-builds.md", rb.replace(/enraged 3 s|3000 ms/g, "")]]) if (timeLike.test(t)) bad(`${n} still quotes a derived time or fight-length cutoff: ${t.match(timeLike)[0]}`)
  if (/every star level|beats Soul Dew only|Choice Specs beats/.test(rb + guide + ac)) bad("retired blanket Totodile / Choice Specs wording is back")
  if (/no comparison across items|comparison across items, comps or opponents has been done/.test(mr)) bad("match-reference.md has the stale 'no item comparison' wording")
  const totoAnti = rb.slice(rb.indexOf("## 2."), rb.indexOf("## 3.")).split("\n").find((l) => l.startsWith("**Anti-synergies.**")) ?? ""
  if (!totoAnti || /Pokemonomicon/.test(totoAnti)) bad("Totodile anti-synergies missing or still list Pokemonomicon")
  // Efficient Bandanna on Vespiquen: holder keeps the +15 PP; a neighbor does not
  for (const t of ["round(90 × 0.85) = 77", "start 15, so 62 more PP: ceil(62 / 5) = **13** attacks", "neighbor** of the holder (77 without the +15)"]) if (!rb.includes(t)) bad(`representative-builds.md lacks "${t}"`)
  // Vespiquen builds: at most three items per mode, DEFEND without Aqua Egg, Combee growth conditional
  const vb = guide.slice(guide.indexOf("Complete builds:"))
  for (const m of ["ATTACK", "HEAL", "DEFEND"]) {
    const seg = (vb.match(new RegExp(`\\*\\*${m}\\*\\* ([^;.]+)`)) ?? [])[1] ?? ""
    const base = seg.replace(/\(.*?\)/g, "")
    if (!seg || base.split(" + ").length > 3) bad(`guidance Vespiquen ${m} build missing or has more than three items: ${seg}`)
    if (m === "DEFEND" && /Aqua Egg/.test(seg)) bad("guidance DEFEND build contains Aqua Egg")
  }
  const rbModes = rb.slice(rb.indexOf("| ATTACK, row 1")).split("\n").filter((l) => /^\| (ATTACK|HEAL|DEFEND)/.test(l))
  for (const l of rbModes) { const sug = l.split("|")[2].replace(/\(.*?\)/g, "").trim(); if (sug.split(" + ").length > 3) bad(`builds table has more than three items: ${sug}`); if (/^\| DEFEND/.test(l) && /Aqua Egg/.test(sug)) bad("builds DEFEND suggestion contains Aqua Egg") }
  if (!/only if a free cell exists, and Combees can die/.test(rb) || !/a cast adds one only if a cell is free/.test(guide)) bad("conditional Combee growth wording missing")
  // items named in the builds doc as recommendations must be in the catalog
  for (const k of ["Soul Dew", "Deep Sea Tooth", "King's Rock", "Rocky Helmet", "Choice Specs", "Aqua Egg", "Red Orb", "Pokemonomicon", "Shell Bell", "Water Stone", "Efficient Bandanna", "Punching Glove", "Nullify Bandanna", "Wide Lens"]) {
    const key = Object.keys(fx.items).find((x) => fx.items[x].displayName === k || fx.items[x].displayName === k.replace("Pokemonomicon", "Pokemonomicon"))
    if (!key) bad(`representative-builds.md names ${k}, which is not a catalog item`)
  }
  // newly inspected claims (bounded read of the pinned source)
  const ho = src("app/core/abilities/heal-order.ts"), dor = src("app/core/abilities/defend-order.ts")
  if (!ho[46].includes("cell.value.handleHeal(heal, pokemon, 1, crit)")) bad("heal-order.ts:47 changed")
  if (!dor[41].includes("p.addShield(shield, pokemon, 1, crit)")) bad("defend-order.ts:42 changed")
  // stones: type grant vs tier activation, equip refusal and evolution declarations are recorded
  for (const k of STONES) {
    const t = JSON.stringify(fx.items[k].effects)
    if (!/not the same as activating a tier/.test(t) || !/Equip is refused/.test(t) || !/Type Null/.test(t)) bad(`${k}: stone record missing type-vs-tier, refusal or evolution declarations`)
  }
  // batch-3 ordering corrections stay in place
  if (!/AFTER the bounce damage and after the holder's onHit/.test(lim("RAZOR_FANG"))) bad("RAZOR_FANG record lost the Loaded Dice ordering")
  if (!/does not check that the second hit actually dealt damage/.test(lim("POWER_LENS")) || !/source-traced, not gameplay-tested/.test(lim("POWER_LENS"))) bad("POWER_LENS record lost the separate Loaded Dice reflection branch")
  if (!/not benefiting the bounce/.test(lim("LOADED_DICE"))) bad("LOADED_DICE record lost the Razor Fang ordering")
  if (/does nothing for basic attacks|only matters for a holder whose damage comes from AP-scaled casts/.test(md)) bad("item-effects.md has the retired Choice Specs wording")
  const sumRows = md.split("\n").filter((l) => /^\| [A-Z_]+ \|/.test(l) && !l.startsWith("| Item")).length
  if (sumRows !== WANT.length) bad(`item-effects.md summary has ${sumRows} rows, expected ${WANT.length}`)
  console.log(`validate-items: item-effects OK (${fx.evidence.length} evidence ranges, ${WANT.length} recipe outputs)`)
}

if (problems.length) { console.error(`validate-items: ${problems.length} problem(s)`); problems.forEach((p) => console.error(" - " + p)); process.exit(1) }
console.log(`validate-items: OK (${FOUND.length} foundation ranges, ${data.recipes.length} recipes, ${data.itemStats.length} ItemStats entries, ${CITES.length} cited ranges, ${allBig.length + allTwist.length} Big Eater/Twist call sites)`)
