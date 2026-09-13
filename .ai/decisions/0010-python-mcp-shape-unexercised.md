# ADR-0010 — The authored (Python) MCP server shape stays unexercised until a real use case exists

## Status
Accepted — 2026-09-13. Closes a candidate item that had appeared in three
consecutive sprint candidate lists without being scoped.

## Context
ADR-0005 established two MCP server shapes: **authored** (Python, marked by
`pyproject.toml`) and **external** (a manifest, marked by `server.json`).
Only the external shape has ever been used by a real component
(`mcp-servers/ansible`). The authored shape exists in
`mcp-servers/_template/` and has never been instantiated, so:

- No authored server has ever been built, launched, or connected.
- `tests/smoke-mcp.sh` covers external manifests only — it reads
  `launch.command` from `server.json`, which an authored server does not
  have.
- `tests/validate.sh` checks the authored shape only structurally (exactly
  one marker file present).

Roughly half the MCP convention is therefore unverified in practice. That is
a real gap and it should not be pretended away.

The tempting fix is to author a small Python MCP server to exercise the
path. `SPRINT-CURRENT.md` already recorded the objection: it "needs a real
reason to author a Python server, not a synthetic one."

That objection is correct, and this repo has direct evidence for why. The
registry's `_template` leak had to be fixed **three separate times**
(TASK-0005, TASK-0006, TASK-0008) because scaffolding that was not a real
component kept being treated as one by tooling that could not tell the
difference. A synthetic MCP server would be exactly that shape of problem
again, but larger: it would appear in `docs/registry.md`, be deployed by
`scripts/install.sh`, be smoke-tested by `tests/smoke-mcp.sh`, and need
maintaining — all to serve no user. Every future contributor would have to
work out whether it is real.

There is also a subtler cost. A synthetic server would make
`smoke-mcp.sh` "cover both shapes" while proving only that a server written
specifically to pass the test passes it. That is the failure mode ADR-0007
and ADR-0008 both circled: a check that cannot fail, or that verifies its
own fixture, reports confidence it has not earned.

## Decision
**The authored Python shape stays unexercised until a genuine need for a
Python MCP server arises.** No server will be written to close this gap for
its own sake.

The gap is recorded as a **known limitation** — in
`.ai/context/CURRENT_STATE.md` and here — not as pending work, and not in
the sprint candidate list where it would misrepresent itself as queued.

**Trigger that reopens this:** the first time a real requirement calls for
an MCP server this repo must author itself — a tool with no suitable
upstream package. At that point, and as part of that work:

1. `tests/smoke-mcp.sh` gains authored-shape support. It cannot read
   `launch.command` from a `pyproject.toml`, so the authored path needs its
   own launch convention (most likely `uv run <name>`, matching what
   `install.sh` already prints).
2. `docs/development/authoring-guide.md`'s authored-server section gets
   verified against reality rather than assumption — it currently describes
   a path nobody has walked.
3. This ADR is superseded, not amended.

Until then, anyone reading `mcp-servers/_template/` should know it is
**unverified scaffolding**, not a proven path.

## Consequences
- The candidate list shrinks to items that are genuinely actionable, making
  the ones that are actionable easier to see. This was the actual problem:
  three sprints of noise around two items nobody could pick up.
- The repo carries an honestly-labelled gap instead of a fake component. A
  known limitation is cheaper than a synthetic asset that must be
  maintained, deployed, and repeatedly explained.
- If the authored path is broken today, we will find out at the moment
  someone first needs it — with a real server to test against, which is a
  better test than a fixture. The cost is that the discovery is deferred,
  not avoided; that trade is accepted deliberately.
- `mcp-servers/_template/`'s status should be read as untested. It is not
  removed: ADR-0005's two-shape design is still the intended convention,
  and deleting the template would silently reduce the repo to one shape.

## Alternatives rejected
- **Author a minimal Python MCP server (e.g. an echo tool).** Rejected: it
  would be a permanent synthetic component in the registry and on every
  client `install.sh` touches, and it would verify mainly itself. See the
  three-times-repaired `_template` leak for how tooling handles components
  that are not really components.
- **Delete the authored shape and support only external servers.**
  Rejected: it would discard ADR-0005's deliberate two-shape design over an
  absence of current demand, and the first genuinely-needed authored server
  would have to relitigate it.
- **Leave it in the candidate list.** Rejected: that is the status quo this
  ADR exists to end. An item that no agent can pick up and no human has
  scheduled is not a candidate; it is an undocumented decision.
