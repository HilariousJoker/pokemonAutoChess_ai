# Generated candidates (not reviewed knowledge)

Files here are **machine-generated candidate records** for the production-branch reference `07367c341fe928763da2b565c2eee010433e4fc1` (deployment unverified). They are kept apart from reviewed knowledge on purpose:

- `data/07367c34/` and `knowledge/07367c34/` hold the records and notes that lookups, `ASK.md` and the match reference use. Nothing from this folder is read by `lookup-production.mjs`, `lookup-item.mjs` or `match-reference.md`.
- A candidate is a JSON wrapper `{schema, label, sourceSha, itemId, kind, identifier, reviewStatus: "candidate", generatedBy, record}`; `record` has the same shape as a record in `data/07367c34/reusable-abilities.json` plus `sourceTables`.
- Passing `queue.mjs validate` means only that the shared mechanical checks passed (revision, required fields, unit bindings, evidence text, declared source tables). It does not mean the claims are right or reviewed. See `assistant/AUTOMATION.md`, "Semantic claims that stay unchecked".
- **Promotion** (moving a candidate into `data/` and `knowledge/`, adding it to `review-status.json`, lookup wiring) is a separate, human-decided step. Automated runs never do it.

File names: `<kind>-<IDENTIFIER>.json`, for example `ability-SOME_ABILITY.json` (one file per queue record; a repair overwrites the same file).
