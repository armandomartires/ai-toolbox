# ADR-0024 — The authored (Python) MCP server shape is exercised, and its launch convention is fixed

## Status
Accepted — 2026-09-24, as part of `TASK-0088`. **Supersedes `ADR-0010`**, on
`ADR-0010`'s own terms: it said *"this ADR is superseded, not amended"* when
its reopen trigger fired. Accepted rather than `Proposed` because it records
what its predecessor already decided would happen, plus two conventions
forced by observation; it widens nothing. **A human may reopen it** — the
launch convention (clause 3) is the part with alternatives.

## Context
`ADR-0010` (2026-09-13) deferred the authored shape *"until the first time a
real requirement calls for an MCP server this repo must author itself — a tool
with no suitable upstream package"*, and named three obligations for that day:

1. `tests/smoke-mcp.sh` gains authored-shape support;
2. `docs/development/authoring-guide.md`'s authored section is verified
   against reality rather than assumption;
3. `ADR-0010` is superseded.

`ADR-0022` identified the trigger: the unattended-run harness needs a gate
entry point any MCP-capable client can call, and no upstream package runs a
consuming repository's named gates detached behind a watchdog. `TASK-0088`
built it — `mcp-servers/gates/`, destructive, authorized by the human in its
task file on 2026-09-24.

**What running it found that reading had not.** `ADR-0010` warned that
`mcp-servers/_template/` was *"unverified scaffolding, not a proven path"*,
and `TASK-0059`'s reading of it flagged its layout as unverified. Building and
importing it on 2026-09-24:

- **The template could not be built.** hatchling's wheel auto-detection
  requires `src/<package>/__init__.py`; the template had none, and the build
  failed with *"Unable to determine which files to ship inside the wheel"*.
- **The template could not be imported.** Its `mcp>=1.0` resolved to mcp
  2.2.0, which renamed the bundled FastMCP to `MCPServer`; the template's
  `from mcp.server.fastmcp import FastMCP` raised `ModuleNotFoundError`.

Neither was findable by reading. That is the return `ADR-0022` F8 predicted
from having deferred.

## Decision

1. **`ADR-0010` is superseded.** The authored shape is exercised by a real
   server, `mcp-servers/gates/`, which builds, passes its tests, and answers
   `initialize` through `tests/smoke-mcp.sh`.
2. **The authored shape pins `mcp>=1.0,<2`** and ships `__init__.py`, in the
   template and in `gates`. The bound is load-bearing, not caution: `AGENTS.md`
   names FastMCP, and FastMCP under that import path does not exist in mcp 2.x.
   Moving to mcp 2's `MCPServer` is a separate decision with its own task, and
   would change `AGENTS.md`'s technology line.
3. **The launch convention is `uv --directory <absolute server dir> run <dir>`**,
   and an authored server's console script is **named after its directory**.
   `--directory` because an MCP client chooses its own working directory, so a
   `cd … && uv run` form works at a shell and nowhere else; the name rule
   because both the smoke harness and `scripts/install.sh`'s printed line name
   the directory. The guide's two open launch-form discrepancies are resolved
   this way.
4. **An authored server may declare `[tool.ai-toolbox] smoke_test.env`**,
   values relative to the server directory, for the handshake only — the
   counterpart of the external shape's `smoke_test.requires_paths`. Needed
   because `gates` refuses to start without a gate map, which the harness's
   name-based fallback for required variables cannot supply.

## Consequences
- `ADR-0010`'s three obligations are discharged: smoke support (obligation 1),
  the guide's authored section rewritten from what ran (obligation 2), this
  ADR (obligation 3).
- **The wiring-section gate now reads both shapes**, closing
  `SPRINT-CURRENT.md`'s carried-forward item 4, which `TASK-0059` named before
  it could matter.
- **`ADR-0022` F8 is only partly settled.** The server launches and answers
  `initialize` through the harness; **no client** has launched it, because the
  authorization's condition keeps it unwired until S10.5. The verdict recorded
  there says exactly that.
- **Not gated, stated rather than implied:** that `destructive_tools` names
  registered tools (the server's own test asserts it; `validate.sh` does not
  import servers, `ADR-0009`), that the console script matches the directory
  (smoke only), and that pytest runs (nothing here runs it automatically).
- The `<2` pin will age. When mcp 1.x stops receiving fixes, the migration is
  a task, not a silent bump — `mcp>=1.0` without a bound is exactly the
  defect this ADR records.
