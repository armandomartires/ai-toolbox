# TASK-0161 — `vendor-skill.sh`: per-project skill copies with a manifest

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-11
- Updated: 2026-10-11
- Applies to: `skills/project-workflow/`, `tests/validate.sh`
- Source: human request 2026-10-11 ("how can I make sure every project has this skill up to date?"); `ADR-0036`

## Objective

A project that publishes its dashboard holds a copy of the skill that can be made, updated, checked against the source and verified in place by one script, so "is it current, is it edited?" is answered by a command.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `publish_lib.check_skill_dir` | refuses a `skill_dir` outside the repository; says only "copy it in" |
| asset-management | a hand-made copy from 2026-10-05, with its own `MANIFEST.sha256` |
| `dashboard/VENDORED.md` | sigma-llmwiki's manifest shape for this repo's generator copy |

## Scope

- In: `vendor-skill.sh` and `vendor_lib.py` (`--write`, `--check`, `--verify`, `--adopt`); `check-vendor.sh` in the gate; docs; 6.3.0.
- Out: changing asset-management (a task in that repository); `dashboard/VENDORED.md` drift (sigma-llmwiki's sync owns it).

## Likely files

- `skills/project-workflow/scripts/{vendor-skill.sh,vendor_lib.py,check-vendor.sh,publish_lib.py}`
- `skills/project-workflow/{SKILL.md,references/dashboard.md}`, `tests/validate.sh`, `.ai/` live files

## Execution plan

1. `vendor_lib.py`: read the source from HEAD; resolve `dest` from the conf or `--dest`, inside the repository; write the files and `VENDORED.md`; check; verify.
2. `check-vendor.sh`: a source repo and a consumer repo under mktemp, 30 cases.
3. Red-prove it by mutation: disable each rule in a scratch copy of the library.
4. Wire it into `validate.sh`; name the script in `check_skill_dir`'s refusal; docs, ADR.

## Acceptance criteria

- [x] `--write` copies HEAD's tracked files and writes version, commit and hashes; it refuses dirty source, a destination outside the repository, a hand-made directory and local edits, unless `--adopt`.
- [x] `--write` removes only files its previous manifest listed, and keeps and names a hand-added file.
- [x] `--check` reports files behind the source and edited in the copy, with both versions.
- [x] `--verify` fails on any edited, missing or added file, ignores `__pycache__`, and treats CRLF as no edit.

## Mandatory validations

- [x] tests/validate.sh (WSL)
- [x] mutation red-proof of `check-vendor.sh`

## Risks and rollback

- **`--check` is a report run by hand.** A project's copy can fall behind unnoticed until someone runs it.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `project-workflow` | 6.3.0: `vendor-skill.sh` |
| `check-vendor.sh` | 30 cases, in the gate |

Next: move asset-management's copy onto `vendor-skill.sh --write --adopt`, in that repository.

## Execution log

- 2026-10-11 · Claude Code (Opus 5.5) · done
  - Evidence: `bash skills/project-workflow/scripts/check-vendor.sh` (WSL) → `check-vendor.sh: OK (30 cases)`
  - Evidence: mutation run → all 8 mutants red (edits, dirty source, outside dest, removal, added files, hand-made copy, CRLF, behind)
  - Deviation: none
