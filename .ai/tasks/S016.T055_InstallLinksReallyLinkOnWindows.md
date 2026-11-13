# TASK-0160 — `install.sh link` really links on Windows; `--status` reports

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: `scripts/install.sh`, this workstation's Claude Code and OpenCode skill installs
- Source: human request 2026-10-11 ("how can I make sure every project has this skill up to date?")

## Objective

Every project on a machine reads the current skills. `link` must produce a link on Windows too, prove it did, and `--status` must show any install that is a copy, and how stale it is.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `scripts/install.sh` | `link` runs `ln -sfn`; under Git Bash without `MSYS=winsymlinks` that copies, silently |
| `~/.claude/skills`, `~/.config/opencode/skills` | real directories from 2026-10-05: project-workflow 5.2.1, project-migration 3.3.0, vault-secrets 1.1.0 |

## Scope

- In: junctions on Git Bash/MSYS/Cygwin; link verification; safe unlinking; `--status`; runbook and `AGENTS.md`.
- Out: agent emission (still copies, ADR-0018); any gate on installed copies (ADR-0009); the claude.ai-synced copies (the human's); per-project vendored copies (`TASK-0161`).

## Likely files

- `scripts/install.sh`, `docs/operations/runbook.md`, `AGENTS.md`, `.ai/` live files

## Execution plan

1. Prove junction create, detect (`test -L`, `pwd -P`) and remove (`cmd /c rmdir` leaves the target) in a scratch directory.
2. `make_link` and `unlink_dir`; `deploy_skills` never `rm -rf`s a link; `--status` with versions read from the frontmatter.
3. Exercise it against a fake `HOME`: pre-existing copy, a foreign skill, re-run, copy over a junction, back to link.
4. Run it for real, then `--status`.

## Acceptance criteria

- [x] On Git Bash, `link` makes junctions, and `dir /AL` lists them as `<JUNCTION>` to the repo.
- [x] A link that does not resolve to the repo skill fails the run instead of being reported deployed.
- [x] Re-running is idempotent; `copy` over a junction leaves the repo's skill intact; a skill the repo does not own is untouched.
- [x] `--status` names each install linked, COPY or absent, with versions and `STALE`.

## Mandatory validations

- [x] tests/validate.sh (WSL)
- [x] fake-`HOME` exercise (Git Bash)

## Risks and rollback

- **A linked skill follows the main checkout's branch.** The runbook says to keep it on `master`.
- **Deleting a linked install by hand with `rm -rf`** may recurse into the repo. The runbook and script comment say to unlink.
- Rollback: git revert the task commit, then `install.sh copy`

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `install.sh` | junction links on Windows, verified; `--status` |
| this workstation | both clients linked: project-workflow 6.2.0, project-migration 4.2.0, vault-secrets 2.3.0 |

Next: `TASK-0161`, vendored copies inside consuming projects.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done
  - Evidence: `install.sh --status` before → 4 skills `COPY  STALE` per client (project-workflow `5.2.1 (repo 6.2.0)`)
  - Evidence: `install.sh link` then `--status` → all 12 lines `linked`, no `STALE`
  - Evidence: fake-`HOME` run → copy over a junction leaves `git status --short skills/` empty
  - Deviation: none
