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

- [x] Authorization section filled **by the human**; `pyproject.toml`'s block
      matches it; `tests/validate.sh` passes with it and **fails with
      `granted = false`** (observed, recorded). *(Also observed failing with
      `task` pointed at a nonexistent file.)*
- [x] No tool accepts a command, argv or path to execute — asserted by a test
      over the tool schemas. *(Parameters are only `name`, `handle`,
      `max_wait_seconds`; `list_gates` returns no argv either.)*
- [x] A fixture gate that outlives `wait_gate`'s cap is still `RUNNING` on the
      next poll, then reaches its terminal state; `wait_gate` never blocks past
      its bound. *(Terminal via `kill_gate` in that test, via the watchdog in
      the timeout test; the 420 s bound is schema-enforced, test tightened —
      see observation 4.)*
- [x] Timeout → `TIMEOUT`; `kill_gate` → `KILLED`, and a **sibling process the
      server did not start survives** the kill. *(And a handle the server did
      not start is refused outright, its process left running.)*
- [x] Every terminal state appends exactly one evidence line in the stated
      format — **the same line `run-gate.sh` writes for the same gate**,
      asserted by running one fixture map through both. *(Equal after
      normalising the run root and the measured elapsed time, the only two
      fields that legitimately differ.)*
- [x] A gate exiting its `skip_exit` code reports `SKIPPED` — not `FAILED`,
      and not `PASSED`.
- [x] Missing `GATES_MAP` → server refuses to start with a stated reason
      (exit 2, *"gates: refusing to start: GATES_MAP is not set"*).
- [x] `tests/smoke-mcp.sh --server gates` reports **PASS** (not SKIP).
- [x] The wiring gate now reads authored servers, proven red-then-green.
- [x] `ADR-0024` exists and `ADR-0010` says it is superseded by it.
- [x] Each new test **fails when its behaviour is reverted** (recorded).

## Mandatory validations

- [x] `tests/validate.sh` — OK
- [x] `cd mcp-servers/gates && uv run pytest` — **14 passed**
- [x] `tests/smoke-mcp.sh --server gates` — `PASS gates: serverInfo.name=gates version=1.30.0 protocol=2024-11-05`; the full run: ansible PASS, gates PASS, graphify SKIP (its declared precondition), unchanged for the external servers
- [x] `scripts/sync-registry.sh` — one row added, `gates | python`
- [x] `git status --porcelain` clean after commit

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

| Artifact | End state |
|----------|-----------|
| `mcp-servers/gates/` | `pyproject.toml` (`mcp>=1.0,<2`, script `gates`, the `[tool.ai-toolbox]` block with the human's authorization and a `smoke_test.env`), `src/gates/{__init__,server,watchdog}.py`, `tests/` with a harmless fixture map, `uv.lock`. Five tools; `start_gate` and `kill_gate` destructive |
| **`mcp-servers/_template/`** | **Two defects fixed, not forecast:** `__init__.py` added (it could not be built) and `mcp` bounded `<2` (it could not be imported); pytest declared; a comment on naming the script after the directory |
| `tests/smoke-mcp.sh` | Handshakes authored servers from a synthesised manifest; FAILs a script not named after its directory |
| `tests/validate.sh` | Wiring-section gate reads both shapes |
| `scripts/install.sh` | Prints the cwd-independent, quoted launch line |
| `configs/*/README.md` | A `gates` section in each, saying it is **not wired**, by the authorization's condition |
| `.env.example` | `GATES_MAP`, `GATES_RUN_ROOT` and the two optional variables, names and meanings only |
| `docs/development/authoring-guide.md`, `AGENTS.md` | Authored section rewritten from what ran; launch form updated |
| `.ai/decisions/0024-*.md` | New, `Accepted`; `ADR-0010` marked superseded; `ADR-0022` F8 **partly settled** |
| Any client configuration | **Unchanged**, per the authorization's condition |

**Next task starts here**: `gates` exists, runs and is authorized, and is wired
into **no** client. S10.5 wires it (and the nine roles); `ADR-0022` F8 closes
only when a client, not the harness, has launched it.

**Deviations from the Plan:** the template fixes, the `install.sh` change and
the `smoke_test.env` key were not in the brief's scope list; each was forced
by walking the path (`ADR-0024` Decision 2–4). `GATES_REPO_ROOT` and
`GATES_TIMEOUT_SECONDS` are two optional variables the design table did not
name; neither widens the destructive surface.

## Status
- Status: done
- Owner: agent (implementation) / human (authorization)
- Created: 2026-09-23
- Updated: 2026-09-24

## Execution log
### Attempt 1
- Date: 2026-09-24
- Agent: Claude Opus 5.5 (1M context)
- Actions: re-read the Authorization section before declaring anything and
  kept its condition (no client wiring). Read `validate.sh`'s authored and
  wiring checks, `smoke-mcp.sh`, the guide's authored section and the
  template. Built the server against the confirmed design; walked the template
  through build and test in a scratch copy; extended the smoke harness and the
  wiring gate; wrote `ADR-0024`.
- Observations:
  1. **The authored template could be neither built nor imported** — the
     payoff `ADR-0010` deferred and `ADR-0022` F8 predicted. No `__init__.py`,
     so hatchling's wheel detection fails; and `mcp>=1.0` now resolves to mcp
     2.2.0, where `mcp.server.fastmcp` no longer exists. Both were invisible to
     `TASK-0059`'s careful *reading*, which correctly marked the layout
     "unverified". Fixed in the template, recorded in `ADR-0024`.
  2. **The smoke harness could not have passed this server as it stood.** Its
     fallback for a required variable supplies the repo root only for names
     containing `WORKSPACE`, `ROOT` or `DIR`, so `GATES_MAP` would have been a
     SKIP. Solved by a declared `smoke_test.env`, not by widening the name
     heuristic — a heuristic that guesses a *file* path is how a smoke test
     starts reporting PASS for a server pointed at a directory.
  3. **The printed launch line had a second latent defect**: this repository's
     path contains a space, so the unquoted `--directory $PWD/...` form would
     not paste. Quoted.
  4. **One revert proof survived, and the test was vacuous.**
     `test_schema_bounds_are_enforced` ran without the configured environment,
     so every call failed on configuration and `pytest.raises(Exception)` was
     satisfied whatever the schema said — removing the 420 s bound left it
     green. Rewritten to run configured, to match the validation error for the
     named field, and with a control call inside the bounds. Its corrected
     first run then failed on the unmodified server — `.` does not cross the
     newline in pydantic's message — which is why an assertion gets watched
     passing on the real code as well as failing on the reverted one. Now
     green on the real server and red on each of three reverted bounds.
  5. **The smoke harness leaked its synthesised manifest** into `/tmp` on every
     run. Now removed after use; the four stale ones from this task's runs were
     deleted by content (they contain `smoke_env`), three unrelated `/tmp/tmp.*`
     files left alone.
- Validation:
  - `uv run pytest`: **14 passed**.
  - **Fails-when-reverted, 15 behaviours, all red**: no tool accepts a
    command; kill by own group only; kill refuses a foreign handle; SKIP
    distinct from FAIL; watchdog timeout; watchdog in its own session; refusal
    without a map; argv without a shell; evidence line matches `run-gate.sh`;
    `list_gates` hides commands; a missing gate is not evidence; and the
    schema bounds — 420 s, handle pattern, name pattern — each separately.
  - **Gates observed red, then green:** `validate.sh` with `granted = false`
    (INVALID AUTHORED MANIFEST … authorization.granted is not true); with
    `task` → a nonexistent file; the wiring gate on all three snapshots before
    their sections existed; `smoke-mcp.sh` with the script renamed (FAIL) and
    with `smoke_test.env` removed (SKIP, not PASS).
  - `tests/smoke-mcp.sh`: gates **PASS**; ansible PASS and graphify SKIP,
    unchanged.
  - `tests/validate.sh`: OK. `scripts/sync-registry.sh`: one row added.
  - Secrets: none — `.env.example` carries names only; the authorization
    carries a name and a date.
  - **Not validated, and not claimed:** any client launching the server (F8's
    remainder), a real consumer's gate map, `powershell.exe` gates from WSL,
    or a client's own tool-call timeout against `wait_gate`'s 420 s (F7).
- Result: **done.**
- Commit: `df22d17`. Pre-commit hook ran `tests/validate.sh`: OK.
  **Re-verified from a fresh clone** on native ext4: `uv run pytest` 14
  passed; `smoke-mcp.sh --server gates` PASS with no pre-existing `.venv`
  (the first launch installs inside the 90 s handshake timeout);
  `validate.sh` OK; and the repaired template's own `uv run pytest` — 1
  passed, where before this task it could not be imported.
- Push: **confirmed** — `origin/master` `e383da1..df22d17`.
