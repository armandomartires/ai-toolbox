# TASK-0269 — MCP hygiene: gates annotations and lock drift (P0.4)

## Status

- Status: review
- Owner: agent
- Branch: agent/TASK-0269
- Created: 2026-11-10
- Updated: 2026-11-10
- Applies to: `mcp-servers/gates/`, `mcp-servers/graphify/`, `scripts/mcp-tool-lock.py`
- Source: docs/reports/2026-11-10-alignment/ALIGNMENT-PLAN.md item P0.4 (Q4); related #7 / R-04 (integrity-pinned installs, tool hashing). Q12 was A (lock all 17 graphify tools); re-decided to B on 2026-11-10: lock the 12 tools `graphify serve` lists, because 17 is unreachable at 0.18.0 (see Outputs). The gates lock lives in pyproject.toml (decided 2026-11-10): gates has `pyproject.toml`, and tests/validate.sh rejects a directory that also has `server.json`.

## Objective

Give MCP clients accurate safety hints on the five gates tools, and make the lock job compare the live `tools/list` to the lock for every server, graphify at 12 and gates at 5.

## Inputs

| Artifact | Expected state |
|----------|----------------|
| `mcp-servers/gates/src/gates/server.py` | 5 tools, no annotations |
| `mcp-servers/gates/` | `pyproject.toml`, no `server.json` (validate.sh rejects both together), no `tools.lock.json` |
| `mcp-servers/graphify/server.json`, `tools.lock.json` | prose lists 17 names, lock pins 12; no consumer in the repo |
| `scripts/mcp-tool-lock.py`, `.gitlab/ci/mcp-tool-lock.yml` | lock from the live `tools/list`; job covers ansible and graphify only |

## Scope

- In: annotations on the gates tools; `[tool.ai-toolbox.tool_lock]` in gates' pyproject and a `tools.lock.json` from the live list; `scripts/mcp-tool-lock.py` reads that table for a folder with a pyproject and no `server.json`; gates added to the `mcp-tool-lock` job with uv; correct graphify's prose tool list to the 12; a check that live equals locked for every server and that gates carries annotations.
- Out: locking `graphify ontology serve`; wiring a graphify consumer; the gates HTTP transport (TASK-0285); changing tool behaviour; the AMBIGUOUS SHAPE rule and the MCP-PIN loop in tests/validate.sh.

## Likely files

- `mcp-servers/gates/src/gates/server.py`, `pyproject.toml`, `tools.lock.json`; `mcp-servers/graphify/server.json`
- `scripts/mcp-tool-lock.py`, `.gitlab/ci/mcp-tool-lock.yml`, `tests/test-mcp-tools.py`

## Execution plan

1. Find why live graphify lists 12; if 17 is unreachable, stop and ask the human (done: Q12 re-decided to B).
2. Write the live-equals-locked and gates-annotations check; see it fail.
3. Annotate the gates tools; declare the gates lock in pyproject; generate its lock; correct graphify's prose.
4. Add gates (with uv) and the check to the CI job; see the check green and a changed entry fail.

## Acceptance criteria

- [x] `tools/list` for gates returns the five tools with the stated annotations (live, via tests/test-mcp-tools.py)
- [ ] Every server's live `tools/list` equals its lock, graphify at 12: ansible and gates ran green; graphify could NOT run on this Windows host (upstream rejects the backslash graph path), so its equality is by source read plus the unchanged 12-entry lock; CI runs it
- [x] `mcp-servers/gates/tools.lock.json` exists (5 tools, annotations are hashed) and the `mcp-tool-lock` job covers gates
- [x] A changed lock entry fails the check (ansible entry, gates `kill_gate` entry); the pre-change gates run failed 5 times on annotations

## Mandatory validations

- [ ] tests/validate.sh: not run by the builder; the coordinator runs the gate at commit
- [x] `python3 tests/test-mcp-tools.py` (ansible, gates): green after, red before
- [x] `python3 scripts/mcp-tool-lock.py --self-test` OK; `scripts/check-private-names.sh` OK
- [ ] `bash tests/smoke-mcp.sh --server gates`: not passing on this host (FAIL; pre-existing, see Outputs)

## Risks and rollback

- The gates lock hashes depend on the pinned mcp version (uv.lock); a dependency bump changes them and needs a reviewed re-approve.
- The CI job now installs uv from PyPI (`uv==0.13.6`, as gates-sandbox.yml does); it could not be run here.
- Lock hashes change: the diff needs CODEOWNERS review. Rollback: git revert the task commit.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `mcp-servers/gates/src/gates/server.py` | `list_gates`, `gate_status`, `wait_gate`: readOnlyHint=true; `start_gate`, `kill_gate`: destructiveHint=true, readOnlyHint=false |
| `mcp-servers/gates/pyproject.toml`, `tools.lock.json` | `[tool.ai-toolbox.tool_lock]` (uv run --frozen --no-dev gates, fixture map env); lock of 5 tools generated from the live list |
| `scripts/mcp-tool-lock.py` | reads the pyproject table when there is no `server.json`; passes SYSTEMROOT and decodes UTF-8 (Windows hosts) |
| `.gitlab/ci/mcp-tool-lock.yml` | ansible, graphify, gates; uv in the node image; runs `tests/test-mcp-tools.py` after the verifies |
| `tests/test-mcp-tools.py` | new live-equals-locked and gates-annotations check |
| `mcp-servers/graphify/server.json` | prose list now the 12 served tools; ontology tools noted as `graphify ontology serve` only, not wired, not locked; `tools.lock.json` unchanged at 12 |

- Why 17 is unreachable: `serve()` in v0.18.0 always builds 12 tools. Four ontology read tools appear only under `graphify ontology serve --config` (profile state needed; `--write` adds two mutating tools). No tool named `graphify` exists; it is the server name.
- Gates pytest baseline, same host: unchanged `server.py` 10 failed, 18 passed, 3 skipped; with the annotations 10 failed, 18 passed, 3 skipped. The 10 are Windows and POSIX differences (REFUSED, a missing watchdog.pid), identical before and after, with an LF or a CRLF fixture.
- smoke-mcp for gates also fails here; not caused by this task.
- The coordinator runs tests/validate.sh at commit.

Next: run tests/validate.sh, then commit; confirm the CI job on the docker runner (graphify and the uv install were not exercised locally).

## Execution log

- 2026-11-10 · agent/Sonnet 5.5 · brief written from the alignment plan; no work done yet
- 2026-11-10 · agent/Sonnet 5.5 · builder: annotations, check (red then green), graphify analysis; stopped on Q12 and the gates shape
- 2026-11-10 · agent/Sonnet 5.5 · resumed after the human's decisions: Q12 to B, gates lock in pyproject; CI job, script, lock and baseline done
  - Evidence: tests/test-mcp-tools.py green for ansible and gates; pytest baseline 10/18/3 both ways
  - Deviation: graphify not run live on this host
- 2026-11-10 · agent/Sonnet 5.5 · review fixes in tests/test-mcp-tools.py: no vacuous pass (empty or unknown MCP_TOOLS_ONLY and a reworded CI loop fail), minimal env for the gates launch, MCP_LOCK_PASS_ENV refused when CI is set, docstring corrected
- 2026-11-11 · Claude Code (Opus 5.5, coordinator) · live CI read through the GitLab API: `mcp-tool-lock` failed at install on every master pipeline from 910: `node:24-bookworm` has no `ensurepip`, so the venv and `uv` never existed and no lock was checked; fixed by `TASK-0290`.
