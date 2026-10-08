# First-version question checks (12 practical questions)

**Production-branch reference; deployment unverified** (`07367c341fe928763da2b565c2eee010433e4fc1`). **This is a curated check written by the same author as the notes: it shows how the knowledge answers representative questions and where it stops. It is not independent proof of accuracy and nothing here was tested in the live game.** Answers use only existing notes (no new investigation); they follow the rules in [ASK.md](../ASK.md). Statement types: *declared*, *traced*, *probe* (isolated execution), *inference*.

Index of sources: [knowledge/07367c34/index.md](../knowledge/07367c34/index.md).

---
### 1. "What are Charizard's base stats and what does its ability do?"  *(unit stats)*
**Answer.** Bare instance: Dragon/Fire/Flying, 3★, HP 220, ATK 18, DEF 5, SPE_DEF 5, speed 57, range 1, max PP 100, crit 10 % ×2 (*declared*). Its skill is Blast Burn: special damage to every enemy in the 8 cells around Charizard, **raw 120** at 3★ before AP, crit and defense (*traced*).
**Support.** `node assistant/lookup-production.mjs CHARIZARD` (catalog record + reviewed `abilities.BLAST_BURN`); [pilot-abilities.md](../knowledge/07367c34/pilot-abilities.md) §BLAST_BURN (`blast-burn.ts:6–28`, `board.ts:152–163`).
**Caveats.** Stats are bare-instance, not what a Charizard has in a match; 120 is a raw declared amount, not final damage; final damage depends on the generic pipeline ([core-mechanics.md](../knowledge/07367c34/core-mechanics.md) §A, partial).

### 2. "How does Pikachu choose between Raichu and Alolan Raichu?"  *(evolution)*
**Answer.** When three Pikachu evolve, the code gives Alolan Raichu if your **current map has the Psychic synergy**, otherwise Raichu; before any portal choice (the "town") it is always Raichu. 14 of 144 maps qualify (*traced*; *probe* over all maps).
**Support.** [evolution-context.md](../knowledge/07367c34/evolution-context.md) §Pikachu (`pokemon.ts:3226–3230`, `player.ts:781–900`, `pokemon.ts:3274–3277`); `probes/results/regional-pikachu-probe.json`.
**Caveats.** Which map you end up on (portal symbol draw, Lapras Passport) is not traced; special rules not traced.

### 3. "Can I find Totodile or Vespiquen in my shop at level 5?"  *(shop eligibility)*
**Answer.** **Totodile: yes** — it is a RARE 1★ in the shared RARE pool (18 copies at game start); RARE has a 20 % chance per slot at level 5, so it can be offered if copies remain and you have not finalized the Totodile line. **Vespiquen: no, not in this normal shop** — it is UNIQUE (no shop pool) and a 3★; it is offered through the stage-10 portal choice. (*traced*, *probe*: pool construction)
**Support.** [shop-rules.md](../knowledge/07367c34/shop-rules.md) (five-unit table; `shop.ts:213–226`, `:548–600`; odds row `config/game/shop.ts:56–67`).
**Caveats.** The chance that a *specific* unit appears needs the remaining pool state (not computable from the rules); modifiers (items, synergies, special rules) not traced; "not in the shop" does not mean unobtainable elsewhere.

### 4. "I'm on my third win in a row with 37 gold after the fight. What income do I get, and what does buying XP do?"  *(interest and XP)*
**Answer.** Interest `min(5, ⌊37/10⌋) = 3`; streak bonus `min(5, streak)` where the third identical PvP result has streak 2; base 5 → **income 10** (47 gold), plus **+2 XP** automatically. Buying XP costs 4 gold for +4 XP (refused at level 9). At level 3 with 0 XP, the automatic +2 and one purchase (+4) make exactly the 6 XP needed to reach level 4 (*arithmetic* from *declared*/*traced* rules).
**Support.** [economy-leveling.md](../knowledge/07367c34/economy-leveling.md) (`game-commands.ts:1425–1462`, `:1091–1107`, `simulation.ts:1561–1578`, `config/game/experience.ts`); executed `computeIncome` rows in `probes/results/economy-probe.json`.
**Caveats.** Normal path only (no income items, special rules, SCRIBBLE/DOUBLE_UP); the streak update itself was read, not executed; I assumed 37 is the balance when income is computed (after the +1 PvP win gold).

### 5. "How much damage does a 20-ATK physical hit do to a unit with 10 DEF?"  *(damage)*
**Answer.** `20 ÷ (1 + 0.05 × 10) = 13.33…`, rounded up → **14** — assuming no crit, AP, shield or other modifiers. Special hits use SPE_DEF the same way; true damage ignores defenses (the final round-up/min-1 still applies).
**Support.** [core-mechanics.md](../knowledge/07367c34/core-mechanics.md) §A (`pokemon-state.ts:559–566`, `:597`); *probe*: real `handleDamage` with stub target (30 vs DEF 10 → 20).
**Caveats.** This is the defense step only; many multipliers (enrage, fields, weather, items, statuses) were not traced.

### 6. "When does a unit cast, and how fast does a speed-57 unit attack?"  *(PP, attack speed)*
**Answer.** PP rises +5 per basic attack and +⌈damage past the shield ÷ 10⌉ when hit; at the next attack slot with `pp ≥ maxPP` (and not silenced) it casts instead of attacking, then PP drops by `maxPP` (extra carries over). A speed-57 unit has a nominal attack interval of `round(1000 / (0.4 + 0.007×57)) = 1252` — about 0.80 attacks per second (a *nominal*, uninterrupted rate, assuming one cooldown unit is a millisecond); with max PP 100 that is 20 attacks of PP from attacking alone (*traced*, *arithmetic*, *probe* for the conversion).
**Support.** [core-mechanics.md](../knowledge/07367c34/core-mechanics.md) §B–C (`attacking-state.ts:22–24, 92–94`, `pokemon-entity.ts:319–321, 508–532`, `ability-strategy.ts:16–17`).
**Caveats.** Nominal, not observed rates; the time unit of the simulation delta was not traced into the library; PP and speed modifiers (items, statuses, abilities) not catalogued.

### 7. "Which row gives Vespiquen which mode?"  *(positioning)*
**Answer.** Row 0 is the bench; rows 1–3 are the board with **row 1 the back and row 3 the front** for both teams. Moving Vespiquen to row 1 sets ATTACK_ORDER (range 3), row 2 HEAL_ORDER (range 2), row 3 DEFEND_ORDER (range 1). Placement is only the starting cell — units then walk toward enemies (*traced*).
**Support.** [core-mechanics.md](../knowledge/07367c34/core-mechanics.md) §D (`simulation.ts:200–221`, `passives.ts:1751–1764`); modes in [pilot-abilities.md](../knowledge/07367c34/pilot-abilities.md).
**Caveats.** A Vespiquen never moved to rows 1–3 (e.g. made by evolution) keeps the placeholder skill — untraced; which row is *better* is a situational inference that needs your team and opponent.

### 8. "Do bench units count for synergies, and does an evolved line count more than once?"  *(synergies)*
**Answer.** Only **deployed** units count (not the bench), and each **evolution family counts once** per type (types are merged first). A Charmander→Charizard line alone gives Dragon 1, Fire 1, Flying 1. Tiers switch on at per-synergy thresholds (e.g. Dragon 3/5/7). (*traced*; *probe*: `computeSynergies`).
**Support.** [core-mechanics.md](../knowledge/07367c34/core-mechanics.md) §E (`synergies.ts:97–131`, `config/game/synergies.ts:179–211`).
**Caveats.** Exceptions exist and were not audited: Dragon doubling (3+ Dragon families add each dragon's second type), FAMILY_OUTING (no family merging), dynamic types (Arceus-like), item-granted types.

### 9. "Does a Shiny Stone on my Cosmoem help it become Solgaleo?"  *(item interaction)*
**Answer.** **Not directly.** Cosmoem becomes Solgaleo only if it stands exactly on the light cell **and** you have an active Light synergy tier; otherwise Lunala. The stone puts its holder "in the spotlight" for other mechanics but Cosmoem's check reads neither that nor items. A *different* deployed unit holding the stone can add Light count that switches the tier on (*traced*; *probe*: callback with stub objects).
**Support.** [core-mechanics.md](../knowledge/07367c34/core-mechanics.md) §G, [evolution-context.md](../knowledge/07367c34/evolution-context.md) §Cosmoem (`pokemon.ts:14870–14878`, `pokemon-entity.ts:302–312`, `player.ts:902–916`).
**Caveats.** Where the light cell is for you is shown by the game client (not read); the executed probe set the item directly on the stub unit.

### 10. "What does Pikachu's Nuzzle do, and how does Eviolite change it?"  *(uncovered ability — coverage limit)*
**Answer.** **I can't say what Nuzzle does — it has not been reviewed.** The knowledge only shows that Pikachu's skill identifier is `NUZZLE` (and its bare stats). Eviolite, separately, is documented: it can be equipped only on a unit that can still evolve, blocks evolution while held, and declares +100 HP, +10 ATK, +50 AP, +10 DEF, +10 SPE_DEF. How Eviolite's AP would interact with Nuzzle is unknown without reading the ability.
**Support.** `node assistant/lookup-production.mjs PIKACHU` ("No reviewed ability information"); [core-mechanics.md](../knowledge/07367c34/core-mechanics.md) §G (`items.ts:1260–1265`, `config/game/items.ts:79–85`).
**Caveats.** An identifier is not an explanation; answering would need a new, bounded read of the ability implementation.

### 11. "What's the best composition right now?"  *(current meta)*
**Answer.** **The source cannot tell me.** It gives mechanics (synergy thresholds, shop odds, economy, damage rules), not win rates, tier lists or what players currently run, and no current-meta data was collected. I can explain how a specific synergy or unit works, or reason from mechanics (labelled as inference) if you tell me your gold, level, board and items.
**Support.** [ASK.md](../ASK.md) rules; coverage in the [index](../knowledge/07367c34/index.md).
**Caveats.** Any "best comp" claim would be invented.

### 12. "Is this the version running on the live servers?"  *(live version / deployment uncertainty)*
**Answer.** **Unknown.** The notes describe the head of upstream `prod` (`07367c34…`, package version 6.11.1). Deployment is a manual `pm2 deploy` of `origin/prod` on each host and the client shows only a version number, so the repository cannot tell which commit is live; the host operator would have to confirm it. The development branch (`01a3e845…`) differs from this reference (e.g. TOTODILE skill BITE vs CRUNCH, COSMOEM HP 200 vs 220) and is kept separate.
**Support.** [version-alignment.md](version-alignment.md) (`ecosystem.config.js:8–9`, `deployment/README.md:47–50`); [pilot-baseline-comparison.md](pilot-baseline-comparison.md).
**Caveats.** All answers inherit this uncertainty; no live-game verification exists.
