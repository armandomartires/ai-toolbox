# TASK-0139 — Make the generated banners true in every repository they reach (B-051)

## Objective

Close `B-051` by the route the human chose on 2026-10-05: **one banner, true
in both places**. Templates rendered here are copied into other repositories,
and their banner names three ai-toolbox paths as if they were local: a
script to run, a schema to edit, and a gate that fails on drift. In a
migrated repository none of them exists. Rewrite the banner so every claim
holds in ai-toolbox and in a copy, and gate that.

## Minimal context

- The banner is `scripts/sync-templates.sh`'s `BANNER`, rendered into eleven
  targets. Seven of them ship inside skills and are copied out:
  - the four under `skills/project-migration/templates/`, which
    `ai-project-scaffold.sh` emits as `.ai/templates/*.md`;
  - the three under `skills/project-workflow/templates/`.

  `B-051` named only the first group, but the second carries the same text,
  and the human's route covers both.
- **The same defect, found while planning**: `scripts/sync-decision-standard.sh`
  writes `skills/unattended-ops/templates/bindings/opencode/decision-standard.md`,
  which ships beside `driver.py` into consuming repositories. Its banner
  makes the same three local claims. It is fixed here because it is the same
  change; nothing in the driver or its tests reads the banner (measured by
  `grep`).
- The gate already fails when a rendered file drifts from its generator, so
  changing a banner means re-rendering, not hand-editing.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `scripts/sync-templates.sh` | `TASK-0109`, `TASK-0119` | `BANNER` names `scripts/sync-templates.sh`, `{schema}` and `tests/validate.sh` unqualified |
| `scripts/sync-decision-standard.sh` | `TASK-0106` | banner names its script and `tests/validate.sh` unqualified |
| `.ai/planning/BACKLOG.md` | `TASK-0138` | `B-051` `ready`; eight open |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

1. Both banners, reworded so that each path is *ai-toolbox's*, and a copy
   says it is not regenerated where it lands.
2. Re-render: `scripts/sync-templates.sh` and
   `scripts/sync-decision-standard.sh`.
3. `tests/validate.sh`: every generated file shipped under `skills/` must
   name `ai-toolbox's` generator in its banner. Red-proved against the old
   banners.
4. `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md`, this brief.

### Not included

- A per-target banner rewritten at copy time; the human chose against it.
- The skills' version numbers. Only generated comments change, not
  behaviour or instructions, so no skill's content is affected.

## Likely files

`scripts/sync-templates.sh`, `scripts/sync-decision-standard.sh`, the eleven
rendered templates, `decision-standard.md`, `tests/validate.sh`, the ledger,
this brief.

## Execution plan

1. This brief first.
2. Write the gate check, and run it on the old banners: it must fail.
3. Change both banners, re-render, and run the gate.
4. Ledger; commit; push both remotes; record commit.

## Acceptance criteria

- [x] No banner shipped under `skills/` names a script, schema or gate
      without saying it is ai-toolbox's.
- [x] The new gate check fails on the old banners and passes on the new.
- [x] `sync-templates.sh --check` and the decision-standard staleness check
      pass, so everything is re-rendered, not hand-edited.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (if components changed)
- [x] the red proof against the old banners

## Risks and rollback

- **A check that is only a string match.** It proves the banner names its
  origin, not that every sentence is true. The sentences are reviewed here.
- **Rollback:** `git revert` the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `scripts/sync-templates.sh`, `scripts/sync-decision-standard.sh` | banners say *ai-toolbox's*, and that a copy elsewhere is not regenerated |
| eleven templates and `decision-standard.md` | re-rendered |
| `tests/validate.sh` | the banner-origin check |
| `BACKLOG.md`, `TODO.md`, `CURRENT_STATE.md` | `B-051` done; seven open |

**Next task starts here**: `master` at the record commit.

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-05
- Updated: 2026-10-05

## Execution log

### Attempt 1

- Date: 2026-10-05
- Agent: Claude Code (Opus 5.5), main checkout
- Actions: wrote the brief, then the gate check, then both banners, then
  re-rendered with both generators.
- Observations:
  - **Red proof**: with the check in place and the old banners, the gate
    printed `BANNER: … does not name ai-toolbox's generator` for **8**
    files: the four `project-migration` templates, the three
    `project-workflow` templates, and `decision-standard.md`.
  - The first wording overflowed line 2 once `{schema}` was substituted, so
    it was reflowed to put the schema path on a short line.
  - **A scratch repository**, scaffolded with
    `ai-project-scaffold.sh demo` in a `mktemp` directory, received the new
    banner in `.ai/templates/SESSION.md`.
  - `decision-standard.md` is read by the OpenCode adjudicator, so that
    binding's suite was run: 40 tests, `OK`, in 191.7 s.
- Validation: `tests/validate.sh` printed `validate.sh: OK`, including the
  `sync-templates.sh --check` and decision-standard staleness checks.
  `sync-registry.sh` left the registry unchanged.
- Result: done.
- Commit: `33e1ce2` — *Make generated banners true outside ai-toolbox (TASK-0139)*, plus the record-keeping commit after it
- Push: **confirmed to both remotes** — `d152b52..33e1ce2 master -> master` to
  `origin` and to `github`; `HEAD`, `origin/master` and `github/master` all
  read `33e1ce2`, and `git remote -v` is token-free
