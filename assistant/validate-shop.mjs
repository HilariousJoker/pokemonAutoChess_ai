// Validates data/07367c34/shop-rules.json against the pinned source (`git show <sha>:<path>`), the executed probe results, and the Markdown.
// Production-branch reference; deployment unverified. Usage: node assistant/validate-shop.mjs   (exit 0 = all checks pass)
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { isDeepStrictEqual as eq } from "node:util"

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, "..")
const SHA = "07367c341fe928763da2b565c2eee010433e4fc1"
const data = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/shop-rules.json"), "utf8"))
const probe = JSON.parse(readFileSync(resolve(HERE, "probes/results/shop-probe.json"), "utf8"))
const md = readFileSync(resolve(HERE, "knowledge/07367c34/shop-rules.md"), "utf8")
const norm = (s) => s.replace(/\s+/g, " ").trim()
const problems = [], bad = (m) => problems.push(m)
const cache = new Map()
const src = (f) => { if (!cache.has(f)) cache.set(f, execFileSync("git", ["-C", REPO, "show", `${SHA}:${f}`], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\n")); return cache.get(f) }
if (data.sourceSha !== SHA || probe.sourceSha !== SHA) bad("sourceSha mismatch")

// 1. evidence
const ids = new Set()
for (const e of data.evidence) {
  if (ids.has(e.id)) bad(`duplicate evidence id ${e.id}`)
  ids.add(e.id)
  const L = src(e.file), [a, b] = e.lines
  if (!(a >= 1 && b >= a && b <= L.length)) { bad(`${e.id}: bad range ${a}-${b}`); continue }
  if (!norm(L.slice(a - 1, b).join(" ")).includes(norm(e.expect))) bad(`${e.id}: "${e.expect}" not in ${e.file}:${a}-${b}`)
}
const refs = (o, acc = []) => { if (Array.isArray(o)) o.forEach((x) => refs(x, acc)); else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { if (/^evidence/.test(k) && Array.isArray(v) && v.every((x) => typeof x === "string")) acc.push(...v); else refs(v, acc) } return acc }
for (const id of refs({ ...data, evidence: undefined })) if (!ids.has(id)) bad(`unknown evidence id ${id}`)

// 2. declared tables equal the source; rows sum to 1; probe band checks
const table = {}
const shopCfg = src("app/config/game/shop.ts").join("\n")
const block = shopCfg.split("export const RarityProbabilityPerLevel")[1].split("\n}")[0]
for (const m of block.matchAll(/^\s+(\d+): \[([^\]]+)\]/gm)) table[m[1]] = m[2].split(",").map(Number)
if (!eq(data.rarityOdds.declared.table, table)) bad("rarity table differs from source")
if (Object.keys(table).length !== 10) bad("source table does not have 10 rows")
for (const [lvl, row] of Object.entries(table)) {
  const exact = row.reduce((a, b) => a + b, 0)
  if (Math.abs(exact - 1) > 1e-12) bad(`row ${lvl} sums to ${exact}`)
  if (row.length !== 5) bad(`row ${lvl} length`)
  const rec = data.rarityOdds.rowSums[lvl]
  if (!rec || rec.sum !== exact || rec.floatingPointExactlyOne !== (exact === 1)) bad(`row ${lvl} sum record differs`)
}
for (const r of probe.probabilityRows) if (!eq(r.row, table[String(r.level)])) bad(`probe row for level ${r.level} differs from the source table`)
if (Number(shopCfg.match(/SHOP_SIZE = (\d+)/)[1]) !== data.shopSize.declared) bad("shop size")
for (const b of probe.bandChecks) if (!b.allOk) bad(`probe band check failed at level ${b.level}`)
if (!eq(probe.bandChecks.map((b) => b.level), [2, 3, 4, 5, 6, 7, 8, 9])) bad("band checks do not cover levels 2-9")
const bd = Object.fromEntries(probe.boundaryLevel3.map((x) => [x.seed, x.rarity]))
if (bd[0.7] !== "COMMON" || bd[0.69] !== "COMMON" || bd[0.700001] !== "UNCOMMON") bad("boundary semantics differ from the markdown claim")

// 3. pools
const pools = src("app/config/game/pools.ts").join("\n")
const ps = {}
for (const m of pools.split("export const PoolSize")[1].split("\n}")[0].matchAll(/\[Rarity\.(\w+)\]: \[(\d+), (\d+), (\d+)\]/g)) ps[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])]
let totalEntries = 0
for (const p of probe.poolInit) {
  if (!eq(p.poolSizeRow, ps[p.rarity])) bad(`PoolSize row ${p.rarity} differs from source`)
  if (!eq(p.copiesPerUnit, [ps[p.rarity][2]])) bad(`${p.rarity}: copies per unit ${p.copiesPerUnit}`)
  if (p.entries !== p.distinctUnits * ps[p.rarity][2]) bad(`${p.rarity}: entries != units x copies`)
  totalEntries += p.entries
}
if (totalEntries !== data.pools.initialShared.totalCopies) bad("total pool copies differ")
if (!eq(data.pools.initialShared.perRarity, probe.poolInit)) bad("poolInit in record differs from probe")
const a = probe.poolAccounting
if (a.initialTotal !== totalEntries || a.afterFirstAssign !== totalEntries - 6 || a.afterManualRefresh !== a.afterFirstAssign || a.boughtThenRefreshed.totalAfter !== a.afterManualRefresh - 1) bad("pool accounting arithmetic inconsistent")
const s = a.sellReturns
if (s.returnedBy1Star !== 1 || s.returnedBy2Star !== 3 || s.returnedBy3Star !== 9) bad("sell returns differ from 1/3/9")
if (!a.lockedRefill.sameExceptSlot2) bad("locked refill changed other slots")
if (!probe.emptyPool.commonPoolEmptiedLevel2Shop.every((x) => x === "MAGIKARP") || !probe.emptyPool.allCommonLinesFinalizedLevel2Shop.every((x) => x === "MAGIKARP") || probe.emptyPool.uncommonPoolEmptiedLevel3SeedInUncommonBand !== "MAGIKARP") bad("empty-pool fallback not MAGIKARP")
const entries = (srcLines, re) => srcLines.join("\n").match(re)
if (src("app/models/shop.ts").join("\n").match(/stars >= 3 \? 9 : stars === 2 \? 3 : 1/) === null) bad("release counts 9/3/1 not in source")
const wc = probe.specialBranches.wildChanceStage1
if (wc.stage1 !== 0.06 || wc.stage4 !== 0 || wc.stage0 !== 0.06) bad("wild chance probe values")
if (probe.specialBranches.dittoRoll0_stage6.pkm !== "DITTO" || probe.specialBranches.dittoRoll0_stage5.pkm === "DITTO") bad("ditto stage gating")
if (!/DITTO_RATE = 0\.005/.test(shopCfg) || !/MIN_STAGE_FOR_DITTO = 6/.test(shopCfg)) bad("ditto constants")

// 4. the five units
const uf = Object.fromEntries(probe.unitFacts.map((u) => [u.key, u]))
const five = data.fiveUnits
for (const k of ["CHARMANDER", "TOTODILE", "VESPIQUEN", "ARCEUS", "TYPE_NULL"]) {
  const u = uf[k]
  if (!u) { bad(`no facts for ${k}`); continue }
  if (five[k].canAppear !== (u.inSharedShopPoolAtGameStart)) bad(`${k}: canAppear ${five[k].canAppear} vs pool membership ${u.inSharedShopPoolAtGameStart}`)
  if (u.inSharedShopPoolAtGameStart !== u.hasShopPoolForItsRarity || (five[k].canAppear && u.copiesInSharedPool <= 0)) bad(`${k}: pool facts inconsistent`)
}
if (uf.TOTODILE.rarity !== "RARE" || uf.CHARMANDER.rarity !== "COMMON" || uf.VESPIQUEN.rarity !== "UNIQUE" || uf.ARCEUS.rarity !== "LEGENDARY" || uf.TYPE_NULL.rarity !== "LEGENDARY") bad("rarity facts")
if (!uf.VESPIQUEN.inUniquePool || !uf.ARCEUS.inLegendaryPool || !uf.TYPE_NULL.inLegendaryPool) bad("unique/legendary pool membership facts")
if (!(table["2"][2] === 0 && table["3"][2] === 0 && table["4"][2] > 0)) bad("RARE first non-zero level is not 4")
// cross-check unit rarity with the committed production catalog
const cat = JSON.parse(readFileSync(resolve(HERE, "data/07367c34/catalog-units.json"), "utf8")).pokemon
for (const k of Object.keys(uf)) if (cat[k].stats.rarity !== uf[k].rarity || cat[k].stats.stars !== uf[k].stars) bad(`${k}: probe rarity/stars differ from catalog`)

// 5. Markdown agrees
const need = ["Production-branch reference; deployment unverified", SHA, "**6** slots", "27 / 22 / 18 / 14 / 10", "594 / 506 / 324 / 238 / 140", "1802", "22 / 23 / 18 / 17 / 14", "1802 → 1796", "→ 1795",
  "1 / 3 / 9", "27 → 28 → 31 → 40", "six MAGIKARP", "lower rarity", "0.700001", "0.9999999999999999", "no hit-chance formula", "0.5 %", "6 % per slot", "from level 4",
  "UniquePool", "LegendaryPool"]
for (const x of need) if (!md.includes(x)) bad(`Markdown lacks "${x}"`)
for (const [lvl, row] of Object.entries(table)) if (Number(lvl) >= 2 && Number(lvl) <= 9 && !md.includes(`| ${lvl} | ${row.join(" | ")} |`)) bad(`Markdown table row for level ${lvl} missing or different`)
for (const [k, u] of Object.entries(uf)) if (!md.includes(`| ${k} | ${u.rarity}, ${u.stars}★ | **${five[k].canAppear ? "Yes" : "No"}`)) bad(`Markdown row for ${k} disagrees (${u.rarity}, ${u.stars}★, ${five[k].canAppear})`)

if (problems.length) { console.error(`FAILED (${problems.length}):\n- ${problems.join("\n- ")}`); process.exit(1) }
console.log(`OK: ${data.evidence.length} evidence references verified against ${SHA.slice(0, 8)}; tables (rows sum to 1), probe results and Markdown agree`)
