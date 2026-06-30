# Revising the skill — staying linked to the repo

Read this only when maintaining the skill (re-syncing the engine from its source
repo). It is not needed to run an analysis.

This skill is **linked to the methodology in the `prestressed_beam_power`
repository**, not a frozen snapshot. The single source of truth is:

- `src/utils/beamCalculations.js` — the power-formula analysis engine
- `src/data/steelPresets.js` — per-grade Q/R/K parameters

The files under `engine/` are *generated copies* of those two (see
`engine/SOURCE.txt` for the commit they came from). A skill uploaded to Claude
runs as a standalone bundle with no access to the rest of the repo, so the copy
has to travel with it — but it is always regenerated from the canonical source,
never hand-edited.

## Workflow when the methodology changes

1. Edit the canonical source under `src/` (or pull the latest repo).
2. Re-sync the engine copy:

   ```bash
   npm run skill:sync          # or: node skills/power-formula/sync-engine.mjs
   ```

3. Re-run the examples to confirm the regression values still hold (see the
   "Worked examples" table in SKILL.md for the expected numbers).
4. Download the `skills/power-formula/` folder and re-upload it to Claude.

This way the uploaded skill always reflects the current repo methodology.
