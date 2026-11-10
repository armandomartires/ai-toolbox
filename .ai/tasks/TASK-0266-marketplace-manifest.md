# TASK-0266 — Marketplace manifest over the monorepo (P0.1)

## Status

- Status: done
- Owner: agent
- Branch: agent/TASK-0266
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `.claude-plugin/`, `tests/test-mods.sh`, `docs/registry.md`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P0.1 (Q1), decisions D2=B (marketplace and plugins primary), Q8=D (GitLab marketplace plus the claude.ai org library); related: ADR-0054 (layout unchanged)

## Objective

Make the four existing mods installable from the repo itself with `/plugin marketplace add`, by adding a marketplace manifest with relative-path sources. The marketplace becomes the primary Claude Code install (D2=B); `install.sh` stays for development and non-Claude ports. The claude.ai org library stays a second release target (Q8=D).

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mods/<name>/claude/.claude-plugin/plugin.json` for agent-watch, switchboard, task-compass, task-orchestrator | one plugin per mod already exists (ADR-0054 layout) |
| `.claude-plugin/marketplace.json` | absent |
| `tests/test-mods.sh` | does not run `claude plugin validate` on the repo root |
| `docs/registry.md` | has no marketplace install line |

## Scope

- In: `.claude-plugin/marketplace.json` (name `ai-toolbox`, owner, four plugins with sources `./mods/<n>/claude`); a check in `tests/test-mods.sh` that runs `claude plugin validate .` and asserts the file exists and lists the four mods; an install line in `docs/registry.md` naming the GitLab source; a note that the claude.ai org library is the second target.
- Out: the skills, agents and gates plugins (TASK-0272); versions, tags and signing (TASK-0283); changing ADR-0054's layout; publishing to the org library; the GitHub mirror form of the command.

## Likely files

- `.claude-plugin/marketplace.json`
- `tests/test-mods.sh`
- `docs/registry.md`

## Execution plan

1. Add a check to `tests/test-mods.sh` that requires `.claude-plugin/marketplace.json`, runs `claude plugin validate .` and compares the plugin names to the four mods; run it and see it fail.
2. Write `.claude-plugin/marketplace.json` with relative sources `./mods/<n>/claude`.
3. Run the check green; delete the manifest and see it fail again; restore it.
4. Add the `/plugin marketplace add` line (GitLab source) and the org-library note to `docs/registry.md`.
5. Run `tests/test-mods.sh` and `tests/validate.sh`.

## Acceptance criteria

- [x] `claude plugin validate .` passes at the repo root
- [x] The new `tests/test-mods.sh` check passes, and fails when `.claude-plugin/marketplace.json` is deleted
- [x] `docs/registry.md` carries the install line and says `install.sh` is for development and non-Claude ports

## Mandatory validations

- [x] tests/validate.sh
- [x] `bash tests/test-mods.sh`

## Risks and rollback

- `claude plugin validate` may not be installed on every host; the check must report a skip, not a pass, when it is missing.
- Two release targets (GitLab marketplace, org library) can drift; the registry line names both.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `.claude-plugin/marketplace.json` | new: name ai-toolbox, owner, four plugins with sources `./mods/<n>/claude`; validates |
| `tests/test-mods.sh` | new marketplace check (file exists, four sources listed, `plugin validate .`); skips with the CLI absent; skipped under `--mod` |
| `scripts/sync-registry.sh`, `docs/registry.md` | registry is generated: the install section is in the generator, registry regenerated |

Next: commit; the four plugin.json files give two validate warnings each (category belongs in the marketplace entry, no author) - a mod edit outside this brief.

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
  - Evidence: none yet
  - Deviation: none
- 2026-11-10 · agent/Sonnet 5.5 · implemented
  - Evidence: red: with the manifest absent `bash tests/test-mods.sh` printed `FAIL marketplace: .claude-plugin/marketplace.json is missing`, `5 passed, 1 failed`. Green: after adding it, `PASS marketplace: plugin validate .`, `6 passed, 0 failed`; `claude plugin validate .` printed `Validation passed with warnings` (8 warnings, all from the mods' plugin.json). With no `claude` on PATH the script printed `SKIP all mods` and `SKIP is not a pass`.
  - Validate: the first `tests/validate.sh` run exited 1 on check-private-names (the origin host in the install line); the line now uses `https://<gitlab-host>/<group>/ai-toolbox.git`, registry regenerated, and the second run exited 0 and ended `validate.sh: OK`.
  - Deviation: docs/registry.md is generated, so the line went into scripts/sync-registry.sh (allowed). The delete-and-restore step was covered by the red run before the file existed, not repeated after.
