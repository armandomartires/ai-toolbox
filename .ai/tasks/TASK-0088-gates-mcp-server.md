# TASK-0088 — S10.3: `mcp-servers/gates/`, the first authored MCP server

## Objective

Author `mcp-servers/gates/`: this repo's **first authored (Python) MCP
server**, a portable form of `asset-management`'s `Invoke-Gate.ps1`. It runs
**named** gates from a consuming repository's gate map, detached behind a
watchdog, and reports them in bounded polls — so that rule 2 (*gate commands
come from a hardcoded map*) and rule 3 (*long gates are detached*) hold on any
client that can call an MCP tool, including Claude Code and Bionic.

In the same unit of work, discharge `ADR-0010`'s three obligations and
supersede it.

## Minimal context

### Why this server exists, and why it is destructive

A real gate in the pilot's source repo measured **68m10s, 70m23s and 72m44s**;
an agent's shell call is capped at ten minutes (`skills/unattended-ops/
references/long-gates.md`). `Invoke-Gate.ps1` (A119, 375 lines, read
2026-09-23) solved this for one repo with `Start` / `Wait` / `Status` / `Kill`
and one machine-readable line per action. This server generalises that
**interface**, not that repo's gates.

**`capabilities.destructive = true`, and it cannot be otherwise.** The server
executes whatever commands a consumer's map names — in the pilot's source repo
those rebuild workbooks, rewrite VBA and queries — and `kill_gate`
force-terminates processes it started. `AGENTS.md`: *"MCP servers must not
expose destructive capabilities without explicit human authorization in the
task file."* **That authorization is the section below, and it is the human's
to fill.** `tests/validate.sh` (`TASK-0059`) fails the commit unless
`[tool.ai-toolbox.authorization]` has `granted = true`, `by`, `date`, and a
`task` path that exists. **The gate is mechanical; the signature is not.**

### Design, proposed — confirm or amend before work starts

Nothing in `PLAN-0006` or `ADR-0022` fixes the tool surface. This is the
proposal; **a change here is a change to the brief, made by the human, before
the commit that locks it.**

> **Amended 2026-09-24, at the human's request and before signature**, to match
> `run-gate.sh` (`TASK-0086`), which was built after this table was written:
> `SKIPPED` added to the states and `skip_exit` to the map entry (the original
> would have reported a skip as a fail, against `references/gate-map.md`
> rule D), and the evidence line aligned to `run-gate.sh`'s format (`NAME=`,
> `ELAPSED=<n>s`). Nothing else changed.

| Decision | Proposal | Why |
|---|---|---|
| Map source | A JSON file in the **consuming** repo, path in env var `GATES_MAP` (required). No map → server refuses to start | Rule 2: the map is the consumer's, never a task file's and never a tool argument. JSON, not TOML, because the server targets `requires-python >= 3.10` and `tomllib` is 3.11+ |
| Map entry | `name → {argv: [...], cwd, timeout_seconds, skip_exit}` — the same entry shape `run-gate.sh` reads (`TASK-0086`), so one map serves both | **argv list, no shell** — Invoke-Gate's "no generated code" lesson: quoting through a shell is exactly where its first cut broke on a path with a space. `skip_exit`, optional, is the exit code that means SKIP rather than FAIL |
| Tools (one per concern) | `list_gates()`, `start_gate(name)`, `wait_gate(handle, max_wait_seconds ≤ 420)`, `gate_status(handle)`, `kill_gate(handle)` | Mirrors `Start`/`Wait`/`Status`/`Kill`. **No tool accepts a command string** — a caller can only name a gate |
| Destructive tools | `start_gate`, `kill_gate` | `start_gate` runs consumer commands; `kill_gate` terminates processes |
| Kill scope | Only the process group the server itself started. **Never by name** | Invoke-Gate's Excel hygiene: an operator's own open workbook must never be touched |
| Evidence | One line per finished gate appended to `$GATES_RUN_ROOT/gates.txt`: `GATE <handle> NAME=<gate> STATE=<state> EXIT=<n> ELAPSED=<n>s LOG=<path>` — **byte-for-byte the format `run-gate.sh` writes** | The evidence rule: this file is the only admissible source for a gate's outcome. One format across both entry points, so an evidence file reads the same whichever produced it |
| States | `RUNNING`, `PASSED`, `FAILED`, `SKIPPED`, `TIMEOUT`, `KILLED`, `MISSING` | `references/gate-map.md` rule D: PASS, FAIL and SKIP are distinct and a SKIP is not a pass. Same set as `run-gate.sh` |
| Watchdog | Survives the calling agent; owns the timeout | A gate stays bounded even if its caller dies |

### `ADR-0010`'s obligations, now due (`ADR-0022` Consequences)

1. `tests/smoke-mcp.sh` gains authored-shape support — it currently skips any
   directory without `server.json` (line 56). Launch convention: `uv run <name>`,
   matching what `install.sh` prints.
2. `docs/development/authoring-guide.md`'s authored-server section verified
   **against a server that has actually run**, not against the template — which
   is all `TASK-0059` could do.
3. A **superseding ADR** (`ADR-0024`), not an amendment.

**Carried-forward item 4** in `SPRINT-CURRENT.md` goes false in this task: the
wiring-section gate reads `server.json` only, so an authored server with a
required variable or a destructive tool would owe a `configs/*/README.md`
section and never be asked for one. This server has both. Closing that gap is
**in scope** — otherwise the first authored server ships through a hole the
sprint already named.

## Authorization — to be completed by the human, not by an agent

> **An agent must not fill, paraphrase or pre-fill any field below.** Rule 4:
> nothing is invented. Until every field is filled by a person, this task is
> `blocked` and no destructive capability may be declared.

- Granted: **yes**
- By: **Armando Martires**
- Date: **2026-09-24**
- Scope authorized: **`start_gate` and `kill_gate` as specified in the Design
  table above, no wider** — `kill_gate` limited to process groups the server
  itself started.
- Design table above: **confirmed as written** (the version amended
  2026-09-24, commit `691f157`).
- Conditions: **Not wired into clients** — this task registers the server in
  no client (Claude Code, OpenCode, Bionic); wiring waits for S10.5.

> **Provenance.** Every value above was chosen by the human in the session
> of 2026-09-24, as answers to multiple-choice questions the agent put
> (name and date proposed from the git user and the day, and not
> corrected). The agent transcribed the chosen options; it chose none of
> them.

The server's `pyproject.toml` will carry
`[tool.ai-toolbox.authorization] task = ".ai/tasks/TASK-0088-gates-mcp-server.md"`,
and its `by` / `date` must match what is written here.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `mcp-servers/_template/` | pre-existing | `pyproject.toml` with commented `[tool.ai-toolbox]` block; **unverified scaffolding** (`ADR-0010`) |
| `tests/validate.sh` authored-shape checks | `TASK-0059` | Parses `[tool.ai-toolbox]` with `tomllib`; enforces the authorization block |
| `tests/smoke-mcp.sh` | `TASK-0009` | `server.json` shape only |
| `docs/development/authoring-guide.md` | `TASK-0059` et al. | Authored section read back off the implementation |
| `.ai/decisions/0010-*.md` | `TASK-0016` | `Accepted`; to be superseded |
| `../asset-management/build/scripts/Invoke-Gate.ps1` | A119 | Read-only reference. **Not edited** |
| `uv`, `python3` ≥ 3.11 | pre-existing | `~/.local/bin/uv` present |

**Verify the expected state; don't assume it.**

## Scope

### Included

- `mcp-servers/gates/` — src layout, hatchling, FastMCP, strict schemas,
  tests (per `AGENTS.md`'s technology stack).
- `[tool.ai-toolbox]`: `destructive = true`, `destructive_tools`,
  `authorization`, `environment.GATES_MAP` and `environment.GATES_RUN_ROOT`.
- `.env.example`: both variables, names and meanings only.
- `tests/smoke-mcp.sh`: authored-shape support.
- The wiring-section gate extended to authored servers (carried item 4).
- `ADR-0024` superseding `ADR-0010`; `ADR-0010`'s status line updated to
  point at it.
- Authoring guide's authored section corrected against what actually ran.

### Not included

- `configs/*/README.md` wiring **snapshots** for each client — S10.5 — beyond
  what the extended wiring gate forces this task to add.
- Any consumer's gate map. A test fixture map only (`true`, `false`, `sleep`).
- Any change to `asset-management`.
- Wiring the server into either binding (`TASK-0086`, `TASK-0087`).

## Likely files

- `mcp-servers/gates/{pyproject.toml,src/gates_mcp_server/*.py,tests/*}`
- `.env.example`, `tests/smoke-mcp.sh`, `tests/validate.sh`
- `.ai/decisions/0024-*.md`, `.ai/decisions/0010-*.md` (status line only)
- `docs/development/authoring-guide.md`, `docs/registry.md` (regenerated)
- `.ai/context/CURRENT_STATE.md`, `.ai/planning/SPRINT-CURRENT.md` (item 4)

## Execution plan

0. **Stop unless the Authorization section is complete.** Completed
   2026-09-24; re-read it before declaring the capability, and honour its
   condition (no client wiring).
1. Copy `_template/`; write the server against the confirmed design.
2. Tests with a fixture map: pass, fail, timeout, kill, missing gate, map
   absent, a caller trying to pass a command. Watch each fail first.
3. `smoke-mcp.sh` authored support; run it against `gates`.
4. Extend the wiring gate; prove it fails on the server before the wiring
   section exists, passes after.
5. `ADR-0024`; authoring-guide correction.
6. `tests/validate.sh`, `scripts/sync-registry.sh`, commit, push.

## Acceptance criteria

- [ ] Authorization section filled **by the human**; `pyproject.toml`'s block
      matches it; `tests/validate.sh` passes with it and **fails with
      `granted = false`** (observed, recorded).
- [ ] No tool accepts a command, argv or path to execute — asserted by a test
      over the tool schemas.
- [ ] A fixture gate that outlives `wait_gate`'s cap is still `RUNNING` on the
      next poll, then reaches its terminal state; `wait_gate` never blocks past
      its bound.
- [ ] Timeout → `TIMEOUT`; `kill_gate` → `KILLED`, and a **sibling process the
      server did not start survives** the kill.
- [ ] Every terminal state appends exactly one evidence line in the stated
      format — **the same line `run-gate.sh` writes for the same gate**,
      asserted by running one fixture map through both.
- [ ] A gate exiting its `skip_exit` code reports `SKIPPED` — not `FAILED`,
      and not `PASSED`.
- [ ] Missing `GATES_MAP` → server refuses to start with a stated reason.
- [ ] `tests/smoke-mcp.sh --server gates` reports **PASS** (not SKIP).
- [ ] The wiring gate now reads authored servers, proven red-then-green.
- [ ] `ADR-0024` exists and `ADR-0010` says it is superseded by it.
- [ ] Each new test **fails when its behaviour is reverted** (recorded).

## Mandatory validations

- [ ] `tests/validate.sh`
- [ ] `cd mcp-servers/gates && uv run pytest`
- [ ] `tests/smoke-mcp.sh --server gates`
- [ ] `scripts/sync-registry.sh` (commit the regenerated registry)
- [ ] `git status --porcelain` clean after commit

## Risks and rollback

- **The highest-risk deliverable in S10**: runnable code that executes
  arbitrary consumer commands. Mitigated by name-only invocation, argv without
  a shell, process-group-scoped kill, and the human authorization — not by any
  one of them alone.
- **F7 is untested** — *one detaching entry point keeps each call inside the
  client's cap*. MCP clients have their own tool-call timeouts; if a client's
  is below `wait_gate`'s bound, that is a finding for the binding, recorded
  with the measured figure.
- **Windows-side gates from WSL** (`powershell.exe` in an argv) are plausible
  for the pilot's source repo and untested here. Not claimed.
- Rollback: `git revert` of one commit. The server is not wired into any
  client by this task, so reverting it disables nothing in use.

## Outputs / handover

*Not yet written — forecast until verified.*

| Artifact | End state |
|----------|-----------|
|          |           |

**Next task starts here**: —

## Status
- Status: ready   # authorization signed 2026-09-24
- Owner: agent (implementation) / human (authorization)
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
