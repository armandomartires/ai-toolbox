# TASK-0059 — Enforce the delegation rule, and close the authored-MCP validation gap

## Objective

Add two checks to `tests/validate.sh`, each with a fixture proving it **fails**
before any passing result from it is trusted:

1. A `delegates_to` entry must name a role emitted for every client the
   delegating role declares.
2. The destructive-capability gate and the `.env.example` completeness check
   must cover the **authored** MCP shape, not `server.json` only.

The second closes `B-024` and is a precondition for `TASK-0067`.

> ## Check 1 was already built — read this before writing it again
>
> **`TASK-0075` (2026-09-23) implemented check 1** while closing `B-028`,
> outside this sprint and ahead of the `ADR-0022` gate. That was a deliberate
> partial pull-forward, authorised by the same human decision that closed
> `B-028`, on the grounds that the defect was **live** and `TASK-0056` had
> already produced the evidence justifying the check.
>
> **What exists now**, as a cross-role pass in `tests/validate.sh`
> (`INVALID DELEGATION:`), separate from the per-role loop because it is the
> only agent rule that needs to see two files at once:
> - a `delegates_to` entry naming a role that does not exist → fails;
> - a delegate not emitted for a client the **caller** is emitted for → fails.
>
> **Both were observed failing**, and the first observation is the one worth
> keeping: the check was written *before* the fix and **fired on the real
> `designer-manager` defect**, not on an invented fixture.
>
> **What this task still owes:** check 2 in full (`B-024`, the authored-MCP
> shape), and a re-read of check 1 against whatever `TASK-0058` settles about
> the `delegates_to` cross-client rule and the `mode` row — `TASK-0055`
> falsified **F1**, so `MODES` may gain `all`, and if a role can be `all` the
> delegation rule may need to say something about it. **Do not assume check 1
> is finished; assume it is written and unreviewed against S9's schema
> changes.**

## Minimal context

**The second check is the urgent one.** `validate.sh`'s manifest checks —
required keys, `capabilities.destructive` → non-empty `destructive_tools` →
`authorization.granted` → `authorization.task` is a file that exists — run on
`server.json` only. So does the `.env.example` completeness loop. The first
authored server this repo will ship (`TASK-0067`) is a **command runner**: it
launches builds measured at ~70 minutes, rewrites workbook VBA and queries, and
force-terminates Excel processes. Under the current gate its authorization block
would be **prose that nothing checks** — which is the authoring guide's own
"Claims a component makes about its own wiring" defect class, in the file that
polices it.

`AGENTS.md` states the rule this gate is the mechanical form of: *"MCP servers
must not expose destructive capabilities without explicit human authorization in
the task file."*

**The fixture requirement is not ceremony.** This repo has shipped a check that
could not fail **twice**, and knowing that did not prevent the second. The
registry `.md` claim check auto-passed because `validate.sh` contained the very
strings it searched for. Both new checks here are therefore accepted only on a
demonstrated red.

`ADR-0005`'s shape rule is not negotiable: a server directory holds **exactly
one** marker file. Carrying both `pyproject.toml` and `server.json` to reuse the
existing check is closed — `validate.sh` fails it as `AMBIGUOUS SHAPE`, and
deliberately.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `docs/development/authoring-guide.md` | `TASK-0058` | `delegates_to` cross-client rule present, Gated **no**; authored-MCP section verified |
| `.ai/tasks/TASK-0056-*.md` | `TASK-0056` | F5's verdict — the evidence justifying check 1 |
| `tests/validate.sh` | pre-existing | the agent checks; the `server.json`-only manifest checks; the `.env.example` loop |
| `mcp-servers/_template/` | pre-existing | the authored template, for the metadata location |
| `.ai/decisions/0005-*.md` | pre-existing | shape derived from the marker file; the Clarification |
| `.ai/planning/BACKLOG.md` | this sprint | `B-024` present |

**Verify the expected state; don't assume it.** Read the guide as `TASK-0058`
left it — if `worktree-only` was left open there, nothing here changes, but the
roles downstream need to know.

## Scope

### Included

- **Check 1** — `delegates_to` cross-client. For each role declaring
  `delegation-allowlist`, every name in `delegates_to` must resolve to a role
  directory whose `clients` is a superset of the delegating role's.
- **Check 2** — extend the destructive and `.env.example` gates to the authored
  shape, reading the metadata from `pyproject.toml`. The same four assertions,
  including that `authorization.task` names a file that exists.
- **A fixture per check, each shown to fail**, then removed. Record the failing
  output verbatim in this task file.
- Flip the Gated cells in the authoring guide to **yes** for both rules.
- Update `B-024`'s backlog entry to `done` with the closing evidence.

### Not included

- Fixing `agents/designer-manager/` if check 1 fails against it. If the gate goes
  red on an existing role, **that is the check working**; record it and raise it.
  A fix is its own task — but note that a red gate blocks commits, so this task
  must say plainly how it is handled rather than leaving the next session stuck.
- Authoring the server. `TASK-0067`.
- A new vocabulary term (`B-025`).
- Any change to `scripts/emit-agents.py`.

## Likely files

- `tests/validate.sh`
- `docs/development/authoring-guide.md` — Gated cells only
- `.ai/planning/BACKLOG.md`
- This task file

## Execution plan

1. Read the guide as `TASK-0058` left it; both rules must already be defined
   there. If either is absent, stop — the order is definition first.
2. Write check 1. Build a fixture role that violates it. **Run the gate and
   confirm it fails**, capturing the message verbatim. Remove the fixture.
3. Run the gate against the **real** `agents/` tree and record the result. If
   `designer-manager` goes red, record it and decide the handling explicitly.
4. Write check 2. Build a fixture authored server declaring `destructive: true`
   with no authorization, and a second whose `authorization.task` points at a
   path that does not exist. **Confirm both fail.** Remove them.
5. Extend the `.env.example` loop to the authored shape; fixture the same way.
6. Flip both Gated cells to yes.
7. Close `B-024` with evidence.
8. `tests/validate.sh` on a clean tree, review the diff, commit.

## Acceptance criteria

- [x] Both checks exist. **Their authoring-guide rows do NOT yet read Gated
      yes** — see *Deviations*, item 1. This half is owed and named.
- [x] **Each check was observed failing on a fixture**, and the failing output is
      recorded verbatim in this file. A check accepted on a green alone does not
      satisfy this criterion.
- [x] Every fixture is removed, and its removal verified.
- [x] `validate.sh` passes on the real tree. Check 1 reds **nothing**.
- [x] Check 2 asserts all four of: `destructive` boolean present;
      `destructive_tools` non-empty when true; `authorization.granted`;
      `authorization.task` is an existing file.
- [x] `B-024` is `done` with its evidence.
- [x] No shape rule is weakened. No directory gains a second marker file.

## Mandatory validations

- [x] `tests/validate.sh` — `validate.sh: OK`, exit 0, on a clean tree.
- [x] `scripts/sync-registry.sh` — no-op confirmed (`git status --porcelain`
      unchanged after running it). Templates are excluded from the registry, and
      the `[tool.ai-toolbox]` block was appended **below** `[project]` so
      `sync-registry.sh`'s `grep '^name = ' | head -1` still reads the
      `[project]` values.

## Deviations from the plan

1. **The authoring guide was not edited**, though step 6 of the plan says to
   flip two Gated cells. This worktree was scoped out of
   `docs/development/authoring-guide.md` (the landing session consolidates the
   narrative files). Three edits are therefore **owed to the guide** and are not
   optional, because two of them make a currently-true sentence false:
   - The *"Authored (Python) servers"* section states **"What `tests/validate.sh`
     checks on an authored server is the marker file, and nothing else. It never
     reads `pyproject.toml`."** That is now **false**. It also names `B-024` as
     open.
   - The `mode: all` section quotes the old failure string verbatim: *"fails the
     commit with `mode 'all' is not one of: primary, subagent`"*. Also now false.
     The new string is recorded below.
   - The authored shape has **no schema section** to match *"`server.json` schema
     (external servers)"*. `[tool.ai-toolbox]` is currently defined only by the
     commented template and by `validate.sh`'s own block comment. Under
     `ADR-0008` (define first, enforce second) the guide owes that section; this
     task inverted the order and says so rather than hiding it.
2. **`mcp-servers/_template/pyproject.toml` was edited**, which the plan did not
   list. It is unavoidable: a required table that the template does not model is
   a rule every first author would discover by failing the gate.
3. **The `.env.example` half was not written as a second loop** beside the
   external one. Both halves of check 2 read `pyproject.toml` in one parse, in
   one place, so the file is read once and the two rules cannot drift. A pointer
   comment was added at the external `.env.example` loop saying so.

## Risks and rollback

- **Shipping a check that cannot fail.** The named risk, twice realised. The
  fixture-first order is the control, and the verbatim failing output is the
  evidence that it was followed.
- **A red gate on an existing role blocking every commit.** Anticipate it: the
  handling is decided in this task, not discovered by the next session. Note that
  `git commit --no-verify` exists for fixing the gate itself and **never** for
  dodging a real failure.
- **Weakening the shape rule to make check 2 easy.** Closed by `ADR-0005`.
- Rollback: revert the commit; both checks are additive.

## Verification

### The schema check 2 enforces

Authored servers declare capabilities in a `[tool.ai-toolbox]` table in
`pyproject.toml`, mirroring `server.json` key for key, so the two shapes answer
the same questions with the same words:

```toml
[tool.ai-toolbox.capabilities]
destructive = false                       # required, a real TOML boolean
destructive_tools = ["run_command"]       # required non-empty when destructive

[tool.ai-toolbox.authorization]           # required when destructive
granted = true
by = "<human>"
date = "YYYY-MM-DD"
task = ".ai/tasks/TASK-0000-example.md"   # must be a file that EXISTS

[tool.ai-toolbox.environment.EXAMPLE_VAR] # each required var must be in .env.example
required = true
```

**No directory gains a second marker file.** `ADR-0005` is untouched; a
directory holding both markers is still `AMBIGUOUS SHAPE`, verified below.

**Parsed with `tomllib`, never grepped.** `scripts/sync-registry.sh` reads the
registry row by line prefix (`grep '^name = '`, first match, quotes stripped),
which is sound only for a single-line double-quoted value at column 1. Nesting
and booleans are not grep-shaped questions: `^destructive = false` would be
satisfied by that text in a comment or in an unrelated `[tool.*]` table. If
`tomllib` is absent (python3 < 3.11) the pass **fails loudly** rather than
skipping — it raises the gate's interpreter floor and says so in the failure.

### Observed failures — check 2 (`B-024`), verbatim

Fixture `mcp-servers/_fixture-authored/`, one form at a time. Every run exited
**1**.

```
INVALID AUTHORED MANIFEST: mcp-servers/_fixture-authored/pyproject.toml: missing required table [tool.ai-toolbox] — an authored server declares its capabilities there, exactly as an external one declares them in server.json. Without it this server would be the only shape that can expose destructive tools with nothing checking its authorization (B-024). Copy the block from mcp-servers/_template/pyproject.toml.

INVALID AUTHORED MANIFEST: mcp-servers/_fixture-authored/pyproject.toml: capabilities.destructive is true but destructive_tools is empty
INVALID AUTHORED MANIFEST: mcp-servers/_fixture-authored/pyproject.toml: capabilities.destructive is true but authorization.granted is not true (AGENTS.md requires explicit human authorization in the task file)

INVALID AUTHORED MANIFEST: mcp-servers/_fixture-authored/pyproject.toml: authorization.task points at a nonexistent file: .ai/tasks/TASK-9999-does-not-exist.md

INVALID AUTHORED MANIFEST: mcp-servers/_fixture-authored/pyproject.toml: authorization.by is required when destructive
INVALID AUTHORED MANIFEST: mcp-servers/_fixture-authored/pyproject.toml: authorization.date is required when destructive

INVALID AUTHORED MANIFEST: mcp-servers/_fixture-authored/pyproject.toml: tool.ai-toolbox.capabilities.destructive must be a TOML boolean (true/false), not 'true'

INVALID AUTHORED MANIFEST: mcp-servers/_fixture-authored/pyproject.toml: does not parse as TOML: Expected ']' at the end of a table declaration (at line 1, column 9)

UNDOCUMENTED ENV: mcp-servers/_fixture-authored/pyproject.toml requires 'FIXTURE_UNDOCUMENTED' but .env.example does not list it
```

**Positive control — the check is not merely always-red.** The same fixture,
fully declared (`destructive = true`, `destructive_tools` named, `granted`/`by`/
`date` set, `task = "CLAUDE.md"` which exists, and `WORKSPACE_ROOT` which
`.env.example` documents) produced `validate.sh: OK`, exit **0**.

**The `_template*` carve-out is split, and the split was verified rather than
asserted.** The destructive half runs on templates (parity with the external
manifest check, which validates `_template-external/server.json` for schema
drift); the `.env.example` half skips them (parity with the external
`.env.example` loop). A `mcp-servers/_template-fixture/` declaring **both**
faults produced the two `INVALID AUTHORED MANIFEST` lines and **no**
`UNDOCUMENTED ENV` line — the split behaving exactly as its comment claims.

**No double-reporting.** A fixture carrying both markers produced
`AMBIGUOUS SHAPE: mcp-servers/_fixture-both has both pyproject.toml and
server.json` and nothing from the authored pass.

### Observed failures — check 1 (`delegates_to`), re-verified

Not rebuilt. `TASK-0075` wrote it and it fired on the live `designer-manager`
defect. Re-run here so this task does not trust a check it has only read:

```
INVALID DELEGATION: agents/designer-manager/agent.md: delegates_to names 'git-ops', which is not emitted for claude-code — the caller IS emitted for claude-code, so that client gets an Agent(git-ops) allowlist naming an agent it does not have, and neither client warns (TASK-0056). Narrow the caller's clients, or widen the delegate's.

INVALID DELEGATION: agents/_fixture-del/agent.md: delegates_to names 'ghost-role', which is not a role in agents/
```

The first was produced by temporarily re-widening `designer-manager` to
`clients: [claude-code, opencode]` — i.e. by reconstructing the historical live
defect, then `git checkout --`ing the file. Both modes still fire.

**The re-read against `TASK-0058`'s `mode` decision: the delegation rule needs
no change, and here is why, so the next reader does not have to redo it.**
`TASK-0058` **rejected** `all`, so `MODES` stays `{primary, subagent}` and no new
mode value can reach the cross-role pass at all. Independently of that, the pass
never reads `mode`: it reads `clients` and `delegates_to` only, and its rule
(*the delegate must be emitted for every client the caller is*) is a statement
about emission targets, which `mode` does not affect. The `mode`-sensitive half
of delegation already lives in the **per-role** check —
`delegation-allowlist` requires `mode: primary`, because Claude Code ignores a
subagent's `Agent(...)` allowlist. Note that had `all` been admitted, that
existing `mode != "primary"` test would have rejected it, and for the right
reason: `all` means both, so the boundary would be enforced or silently widened
depending on invocation, which is argument 1 of the guide's rejection. So the
rule was already correct for the case that did not arrive. **Nothing to change.**

### The `mode: all` message

`MODES` is unchanged — no value in that set was touched. A `REJECTED_MODES`
table was added beside it, so the failure distinguishes *rejected* from
*unrecognised*. Observed on a fixture role declaring `mode: all`:

```
INVALID AGENT: agents/_fixture-mode/agent.md: mode 'all' is a real client value this repo REJECTS ON PURPOSE, not an unrecognised string. OpenCode accepts 'all' and this repo rejects it deliberately: 'all' means BOTH primary and subagent, so a role carrying 'delegation-allowlist' would have that boundary enforced or silently widened depending on how it happened to be invoked, which no reader can determine from the file. Nothing in this repo needs it, and what 'all' does beyond selection is untested. Do not widen MODES to make this pass — see docs/development/authoring-guide.md, "`mode: all` is rejected on purpose, not overlooked", which states what would reopen it
```

**Control: a genuine typo must still read as a typo.** The same fixture with
`mode: primry` produced the unchanged
`mode 'primry' is not one of: primary, subagent`. The two paths are
distinguishable, which was the whole point.

### Fixtures removed

`git status --porcelain` after the fixture runs shows only
`M mcp-servers/_template/pyproject.toml` and `M tests/validate.sh`.
`mcp-servers/` holds `ansible graphify _template _template-external` and
`agents/` holds `critic designer-manager git-ops ideator qa-test review
_template README.md` — the trees as found.

### Cost

Within measurement noise on this `/mnt/c` WSL checkout. Five consecutive runs,
two rounds, alternating stash/pop: before 8.31 s / 7.54 s, after 8.70 s /
7.30 s — i.e. ~1.5 s per run in both conditions, with round-to-round variance
larger than the difference. The added pass is one `python3` spawn, and a bare
`python3 -c pass` costs ~10 ms here. Measure on a native path before concluding
a check is expensive.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `tests/validate.sh` | The authored-MCP pass (`INVALID AUTHORED MANIFEST` / `UNDOCUMENTED ENV`), each form demonstrated red on a fixture first, plus a positive control; `REJECTED_MODES` beside `MODES`; a pointer comment on the external `.env.example` loop |
| `mcp-servers/_template/pyproject.toml` | Models the `[tool.ai-toolbox]` block, with the destructive/authorization/environment forms commented in place |
| `docs/development/authoring-guide.md` | **Unchanged — three edits owed**, see *Deviations* item 1. Two of its sentences are now false |
| `.ai/planning/BACKLOG.md` | `B-024` `done` with evidence |
| `agents/`, `docs/registry.md`, `.env.example` | Unchanged |

**Next task starts here.**

- **`TASK-0067`** may author the gate server knowing its `authorization` block is
  mechanically checked. It must put the block in `[tool.ai-toolbox]`, and it will
  fail the gate until `authorization.task` names a file that exists — which is
  the point. Its two launch-form discrepancies are untouched and still its.
- **`TASK-0063`** may author roles against a gate that enforces the delegation
  rule. **Check 1 reds nothing in the existing tree** — no commit is blocked, and
  no session should discover otherwise from a failing commit.
- **A third `server.json`-only gate was found and deliberately left.** The
  per-client wiring-section check (`TASK-0073`, `B-023`) also begins
  `[ -f "$d/server.json" ] || continue`, so an **authored** server declaring a
  required variable or `destructive = true` owes sections that nothing demands.
  The guide's claim *"The first two triggers are checked"* becomes false the
  moment `TASK-0067` lands. It is the same defect class as `B-024` but a
  different backlog row, and this worktree may only touch `B-024`'s — so it is
  raised here rather than silently scope-crept. It is now ~10 lines, since the
  metadata is already parsed.
- **The two agent-file parsers remain separate**: the per-role check's `seq()`
  and the cross-role pass's `field()` both read a YAML block sequence, by
  different code. No hole was found between them (an inline `[a, b]` list fails
  the per-role check either way), but they are two owners of one rule.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-23
- Updated: 2026-09-23

## Execution log
### Attempt 1
- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context), in worktree `agent/t0059`
- Actions: read `CLAUDE.md`, this brief, the authoring guide's authored-server
  and `mode: all` sections, `B-024`, and `tests/validate.sh`. Confirmed check 1
  already exists (`TASK-0075`) and did not rebuild it. Added the authored-MCP
  pass to `tests/validate.sh`; added `REJECTED_MODES`; modelled the
  `[tool.ai-toolbox]` block in `mcp-servers/_template/pyproject.toml`; closed
  `B-024`.
- Observations: eight distinct failure forms observed red before any green was
  trusted, plus a positive control, a carve-out split proof, an
  `AMBIGUOUS SHAPE` de-dup proof, a typo-vs-rejection control, and both modes of
  check 1 re-fired. All verbatim above. Two guide sentences are now false and
  the guide owes a `[tool.ai-toolbox]` schema section; a third `server.json`-only
  gate (the wiring-section check) was found and left named.
- Validation: `tests/validate.sh` → `validate.sh: OK`, exit 0.
  `scripts/sync-registry.sh` → no-op.
- Result: done, with the authoring-guide half explicitly owed rather than
  silently dropped.
- Commit: 97e8be9 (amended to record its own hash)
- Push: **not pushed, deliberately.** This worktree lands by rebase from the
  main checkout (`ADR-0023`); the landing session pushes.
