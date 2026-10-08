# Check: the two failed practical questions, answered from the loaded reference

Production-branch reference `07367c34…`; deployment unverified. Same-author check, not independent proof of accuracy.

**Questions:** (1) What are all Silk Scarf combinations? (2) What do those resulting items do?

**Method.** A fresh subagent with no conversation history was told to read only `ASK.md` and `knowledge/07367c34/match-reference.md`, with no searching, git, node or other files, and to answer in QUICK mode. The harness reported 3 tool uses for the run; the agent reported 2 parallel `Read` calls (the two files) and no grep/glob/git/node — I could not inspect the transcript, so the third use is unexplained (most likely the report hand-back).

**Result.** It listed all 10 recipes (Fossil Stone→Friend Bow, Black Glasses→Black Belt, Magnet→Mach Ribbon, Charcoal→Explosive Band, Never-Melt Ice→Twist Band, Twisted Spoon→Lucky Ribbon, Miracle Seed→Big Eater Belt, Heart Scale→Cover Band, Mystic Water→Efficient Bandanna, Silk Scarf→Nullify Bandanna) and, for each, the declared bonuses and main effect, with the 11-stat lists for Twist Band and Big Eater Belt, and the one essential uncertainty each time (allowance vs crafting; Mach Ribbon removal mismatch). It reported nothing missing from the loaded files.

**What is mechanically verified.** `node assistant/validate-items.mjs` checks that the ten recipes, second components and declared bonuses in both `silk-scarf-items.md` and `match-reference.md` equal the pinned source, so the answers above cannot drift from the data. The effect descriptions rest on the cited source lines in the guide (45 line ranges re-read by the validator), not on probes or gameplay.
