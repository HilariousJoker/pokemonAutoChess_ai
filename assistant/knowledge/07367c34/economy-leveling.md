# Base economy and leveling

**Production-branch reference; deployment unverified.** Source `07367c341fe928763da2b565c2eee010433e4fc1` (upstream `prod` head). Structured rules, evidence and unresolved items: [`../../data/07367c34/economy-leveling.json`](../../data/07367c34/economy-leveling.json) (checked by [`../../validate-economy.mjs`](../../validate-economy.mjs)). Isolated execution of the real functions: [`../../probes/economy-probe.ts`](../../probes/economy-probe.ts) → [`results`](../../probes/results/economy-probe.json).

**Scope.** The normal human-player match path: no special game rule, no gold/XP/reroll items held, an alive non-bot player; SCRIBBLE and DOUBLE_UP modes and all item/rule modifiers are **excluded** (recorded as unresolved, not traced). This note states mechanics only; it gives no advice about saving or leveling.

Evidence labels: **Declared** (a value written in the code or config) · **Traced** (behavior read through callers and conditions) · **Executed** (the real function run with stub players; stubs listed in the probe) · **Unresolved**.

## How much income will I get?
After every fight round (inside `stopFightingPhase`, `game-commands.ts:1897–1931`, via `computeIncome`, `:1425–1462`) each alive human player receives:

`income = interest + streak bonus + 5`

- **Base: 5 gold** every round, PvE rounds included. *(Declared, `:1450`)*
- **Interest:** `min(5, floor(gold / 10))`, where `gold` is the balance at that moment. The balance is sampled once, right then: **after** the fight's +1 PvP win gold has been paid and before the new shop, so it includes that gold. *(Declared `:1440–1446`; timing Traced.)* The cap 5 is the default; Gimmighoul Coins raise it, Amulet Coins lower it, Blood Money removes interest *(modifiers, unresolved)*.
- **Streak bonus:** `min(5, streak)`, added **only after a PvP round** (not after a PvE stage). *(Declared `:1447–1449`.)* The streak counts consecutive **identical** non-draw PvP results — wins *or* losses (`simulation.ts:1561–1578`, Traced): the first result of a run leaves it at 0, each further identical result adds 1, a different result resets it to 0, a **draw leaves it unchanged**, and PvE fights neither change nor reset it. So the bonus is 0, 1, 2, 3, 4, 5 for the 1st … 6th-or-later consecutive identical result.
- **PvP win gold:** +1 gold for a PvP win (5 with the opponent's Leaders Crest), paid when the fight ends; none for losses, draws or PvE wins. *(Declared `simulation.ts:1590`, Traced.)*
- **Automatic XP:** +2 XP in the same call, every round (PvE and PvP), for alive human players. *(Declared `:1459`.)*
- **When:** nothing before the first fight (stage 0 is a town phase that jumps to stage 1, `:1340–1343`); PvE stages are the keys of `PVEStages` (1, 2, 3, 9, 14, 19, 24, 28, 32, 36, 40).

### Boundary examples (Executed: real `computeIncome`, stub player, no items)
| Gold before | Streak | Round | Interest | Income |
|---|---|---|---|---|
| 5 (starting gold) | 0 | PvE | 0 | 5 (→ 10 gold) |
| 9 | 0 | PvP | 0 | 5 |
| 10 | 0 | PvP | 1 | 6 |
| 19 | 0 | PvP | 1 | 6 |
| 20 | 0 | PvP | 2 | 7 |
| 49 | 0 | PvP | 4 | 9 |
| 50 | 0 | PvP | 5 | 10 |
| 51 / 99 / 100 | 0 | PvP | 5 | 10 |
| 10 | 1 / 4 / 5 / 6 | PvP | 1 | 7 / 10 / 11 / 11 |
| 10 | 3 or 5 | PvE | 1 | 6 (streak ignored) |

Streak sequences are **calculations from the inspected rule, not runtime tests** (the streak update was not executed): results W L L → streak 0, 0, 1; W W W D W → 0, 1, 2, 2 (draw), 3.

## What happens when I buy XP or reroll?
**Buy XP** (`OnLevelUpCommand`, `:1091–1107`; cost `getLevelUpCost` = 4, `experience-manager.ts:50–53`). *(Declared + Traced.)*
- Needs: alive, gold ≥ 4, level < 9. Effect: **+4 XP for 4 gold**. No phase restriction was found in the message handler (`game-room.ts:551–559`) or the command.
- At level 9 the purchase is refused and nothing is charged. When the purchase carries you into level 9, XP beyond the threshold is discarded but the full 4 gold is charged.
- **Levels** *(Declared, `config/game/experience.ts`)*: you start at level 2 with 0 XP; the XP needed to go from level n to n+1 is 2, 6, 10, 22, 34, 52, 72 for n = 2…8, i.e. cumulative 2, 8, 18, 40, 74, 126, 198 XP to reach levels 3…9. Maximum level 9. Surplus XP carries over, and several levels can be gained at once.
- Executed examples (real `ExperienceManager` / `OnLevelUpCommand`): level 2 + 4 XP → level 3 with 2 XP; level 3 with 5 XP + 1 → level 4 with 0; level 8 with 70 XP + 4 → level 9 (4 gold charged, surplus lost); level 9: refused, gold unchanged. Quirk: after the final level-up the stored `experience` stays at its old value (70) and `addExperience` returns 72; only the gift-shop caller uses that return value (not traced).

**Reroll** (`OnShopRerollCommand`, `:1045–1067`). *(Declared + Traced + Executed.)*
- A normal paid reroll costs **1 gold** and draws a new shop (`assignShop(manual)`). It needs ≥ 1 gold; with 0 gold nothing happens.
- **Free rerolls:** if `shopFreeRolls > 0` the reroll costs 0 and the counter drops by 1 (works with 0 gold). Paths that grant them: Unown shops (Psychic transcendence) +1 (`shop.ts:354–357`; one is spent when buying from such a shop, `:194–204`; an untouched one is removed at the next automatic refresh, `:1979–1985`), and Repeat Ball holders on the board add one per holder on a paid reroll (`:1058–1063`). Other free-reroll items were not searched.
- No phase restriction was found in the handler (`game-room.ts:500–508`) or command.
- What the new shop contains (odds, pools) is out of scope.

## Unresolved
Item and rule modifiers (Amulet/Gimmighoul Coin, Red Scale, Leaders Crest, Repeat Ball, Blood Money), SCRIBBLE and DOUBLE_UP economies, ghost-opponent streak handling, other gold/XP sources running in the same window (gift shop XP, mission orders), client-side phase gating, and the assumption that the PvE test in the streak update (opponent id) and the income test (stage table) coincide. See `unresolved` in the JSON.
