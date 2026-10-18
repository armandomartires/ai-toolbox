# TASK-0172 — Run the unattended loop on a forge tracker

## Status

- Status: done
- Owner: agent (Claude Code)
- Created: 2026-10-18
- Updated: 2026-10-18
- Applies to: `loops/unattended-run/`, `skills/unattended-ops/`, `agents/{preflight,closer,run-scribe}/`, `skills/project-workflow/templates/reference/tracker.md`
- Source: `B-055`; human request 2026-10-18 ("let's complete the open item"); human decisions the same day: the lock is a committed snapshot of each issue, and the forge is written by the human after the push; `ADR-0038`

## Objective

A project whose `tracker.conf` names GitLab or GitHub can run `loops/unattended-run/`. The lock is a committed snapshot of each queued issue (`ADR-0022` clause 3 unchanged). The run never reads or writes the forge, and its handover tells the human what to post once the push is confirmed.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `unattended-run.js` | reads `task_file_glob`, `tracker_path`, `commit_shape`; no tracker mode; 29 tests |
| `driver.py` | same slots; 40 tests |
| `tracker.conf` grammar | owned by `skills/project-workflow/scripts/tracker_lib.py` (`ADR-0037`) |
| `unattended-ops` | 1.3.2 |

## Scope

- In: both drivers learn the mode from `tracker.conf`; forge checks at preflight; the issue reference in the commit; a forge section in the handover; docs for the loop, binding contract, roles and `tracker.md`; `ADR-0038`.
- Out: any forge read or write in a run (the human's decision); a snapshot script (no `gh`/`glab` wrappers, `ADR-0037` clause 5).

## Likely files

- `skills/unattended-ops/templates/bindings/claude-code/{unattended-run.js,binding.md,tests/unattended-run.test.mjs}`
- `skills/unattended-ops/templates/bindings/opencode/{driver.py,binding.md,tests/test_driver.py}`
- `skills/unattended-ops/{SKILL.md,templates/binding.md}`, `loops/unattended-run/loop.md`, `agents/{preflight,closer,run-scribe}/agent.md`
- `skills/project-workflow/templates/reference/tracker.md`, `.ai/` live files

## Execution plan

1. Both drivers: read the mode (absent = files); on a forge, refuse a `tracker_path` other than `not-applicable` and a non-numeric queue id.
2. On a forge, the closer is told to write nothing to the forge and the commit must carry `#<id>`, not followed by a digit.
3. The handover carries *Forge updates, NOT taken* for every closed and parked task.
4. Tests in both suites; prove them red against `HEAD`'s drivers.
5. Docs, `ADR-0038`; close `B-055`.

## Acceptance criteria

- [x] With no `tracker.conf`, every existing binding test passes unchanged.
- [x] On a forge, a `tracker_path` file or a non-numeric queue id halts at preflight.
- [x] On a forge, a closer commit without `#<id>` halts; with it the task closes.
- [x] On a forge, the handover names each closed and parked issue and the action left to the human.
- [x] No driver calls `glab`, `gh` or the network.

## Mandatory validations

- [x] tests/validate.sh
- [x] both binding suites, and both against `HEAD`'s drivers (red proof)

## Risks and rollback

- **The snapshot is a copy.** It is a run input, removed by the human once the issue carries it; until then the issue and the snapshot can disagree.
- **Claude Code's forge boundary is prompt-level.** OpenCode's closer allowlist already denies `glab` and `gh`.
- Rollback: git revert the task commit

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `unattended-run.js` | forge-aware; 37 tests |
| `driver.py` | forge-aware; 48 tests; the stub reads issue numbers |
| `unattended-ops` | 1.4.0: *On a forge tracker* |
| `tracker.md` | *Unattended runs*: snapshot, lock, after-push steps |
| `B-055` | closed |

Next: the first forge project's first unattended run, which exercises the snapshot commands.

## Execution log

- 2026-10-18 · Claude Code (Opus 5.5) · done
  - Evidence: `node --test …/unattended-run.test.mjs` → `# pass 37`, `# fail 0`; `python3 -m unittest discover -s …/opencode/tests` → `Ran 48 tests`, `OK`
  - Evidence: the new Claude Code cases against `HEAD`'s driver → 7 of 8 fail; the eighth, no role asked to run `glab`/`gh`, holds at `HEAD` too
  - Evidence: `TestForgeTracker` against `HEAD`'s `driver.py` → `FAILED (failures=8, errors=2)`, all 8 cases
  - Deviation: `stub_opencode.py` now also substitutes a bare issue number for `{TASK}`
