# TASK-0049 — graphify as a pinned external MCP server

## Objective

Add `mcp-servers/graphify/server.json` describing
`@sentropic/graphify`'s read-only stdio MCP server, pinned to an exact
upstream version, and settle how `tests/smoke-mcp.sh` treats a server that
cannot start without pre-existing state.

## Minimal context

graphify is the only one of the three requested "plugins" that becomes a
real component: it has a published upstream package
(`@sentropic/graphify`, MIT, `node>=20`, `bin: graphify`) and a stdio MCP
transport (`graphify serve`), which is exactly ADR-0005's **external**
shape — described by a manifest, with no source vendored.

### The manifest must not imply the CLI is read-only

`graphify serve` exposes read-only graph queries (`query_graph`,
`get_node`, `get_neighbors`, `shortest_path`, plus resources). But the CLI
around it is not read-only:

- `graphify ontology serve --write` enables patch mutation tools.
- `graphify hook install` writes git hooks **and a merge driver**.
- `graphify store push` writes to a database backend.
- `graphify install` / `graphify <platform> install` writes client config
  files, `CLAUDE.md`/`AGENTS.md` sections, and hooks.

`capabilities.destructive` describes the **wired** command, which is
`serve`. Everything above therefore belongs in `preconditions` or an
explicit note. Getting this wrong reproduces `B-012` — this repo's
`server.json` overstating `WORKSPACE_ROOT` as a blast radius, then
repeating the wrong claim in three wiring snippets. The lesson from that
item is that a manifest's *scope* statement is load-bearing, and a
comfortable half-truth propagates.

### The smoke-test problem, known before starting

From source: `serve.ts:188-195` — `createReloadingGraphStore` calls
`validateGraphFilePath`, then `console.error` + `process.exit(1)` on
failure; `serve.ts:896-897` defaults the graph path to
`resolveGraphInputPath()`. So with no `.graphify/graph.json` the server
exits 1 without speaking MCP.

`tests/smoke-mcp.sh` launches from `launch.command` and asserts on an
`initialize` reply. It would report **FAIL** where the truth is
*precondition unmet* → **SKIP**. Its own header states the three outcomes
and that *"a SKIP is not a pass"*; a false FAIL is the mirror defect. This
is the task's central design decision and `TASK-0048` Q2 supplies the
evidence for it.

### Why this is not new-category plumbing

`ADR-0021` clause 1 bars plumbing for a *new component category*. A
correctness fix to an existing test is not that — but it is a change to a
shared, validated test file, which S7 showed is where task collisions live
(TASK-0038/0039 both wanted `validate.sh`). Hence PLAN-0005's Human
decisions item 4: a human authorizes any `smoke-mcp.sh` edit.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `TASK-0048` execution log | TASK-0048 | **done**; Q2 answered — `graphify serve` behaviour with no graph, exit code and stderr recorded verbatim |
| `ADR-0021` | this sprint | ratified (preferred) or at least `Proposed` with clause 2's routing table intact |
| `mcp-servers/_template-external/server.json` | TASK-0005 | present; **copy from it**, per AGENTS.md's documentation rules |
| `docs/development/authoring-guide.md:48-76` | TASK-0005 | the `server.json` schema table — the normative field list |
| `mcp-servers/ansible/server.json` | TASK-0007 | present; the only worked example of this shape, incl. how `preconditions` is used |
| `tests/validate.sh:122-200` | TASK-0005 | manifest schema checks; note `authorization` is required only when `destructive` is true |
| `tests/validate.sh:684-712` | TASK-0015 | the `.env.example` completeness check — every `required` env var must be documented |
| `tests/smoke-mcp.sh` | TASK-0009 | present; three-outcome contract; **read its header before changing it** |
| `scripts/sync-registry.sh` | TASK-0011 | present; will add the registry row automatically |
| upstream `@sentropic/graphify` | third party | version resolved and recorded at the moment of writing — `0.18.0` at plan time, 2026-09-16 |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you.

## Scope

### Included

- `mcp-servers/graphify/server.json`, pinned to an exact version (**not**
  a floating `@latest`), with `runtime.declared` and `runtime.tested`
  recorded separately, as the schema requires and for the reason it gives:
  npm `engines` is advisory, so one number misleads either way.
- `capabilities.destructive` set for the **wired** command, with the CLI's
  mutating subcommands named in `preconditions` or a note.
- The `.graphify/graph.json` precondition stated in `preconditions`.
- **A decision on the smoke test**, one of:
  (a) teach `smoke-mcp.sh` a precondition-aware **SKIP** (needs human
  authorization); or
  (b) exclude graphify from it, with the exclusion **visible** in the
  script and the reason in the manifest.
  Either is acceptable; silently leaving a false FAIL is not.
- Regenerating `docs/registry.md` via `scripts/sync-registry.sh` and
  committing the result.
- Adding any `required` env var to `.env.example`. If graphify's manifest
  needs none, state that explicitly rather than leaving it ambiguous.
- Deciding whether `.graphify/` belongs in `.gitignore` — upstream's own
  guidance says never to commit `branch.json`, `worktree.json`,
  `needs_update` or `cache/`.

### Not included

- `configs/*/README.md` wiring for graphify's **plugin/rules** integration
  if `TASK-0048` Q1 found one. That is a client-native mechanism and
  belongs to `TASK-0050`'s category. Note the overlap in Outputs —
  `ADR-0021`'s routing rows are not mutually exclusive, and graphify may
  legitimately occupy two.
- Any `install.sh` change. Per ADR-0021 clause 4 this repo does not
  install graphify; `install.sh` already prints launch commands from
  manifests generically.
- Building a graph over this repo as part of the task.
- Vendoring any graphify source.
- ponytail or omniroute.

## Likely files

Forecast, written before the work:

- `mcp-servers/graphify/server.json` (new)
- `docs/registry.md` (regenerated — one new MCP Servers row)
- `.env.example` (only if the manifest declares a required var)
- `tests/smoke-mcp.sh` (**only** under option (a) and with authorization)
- `.gitignore` (if `.graphify/` is excluded)
- `.ai/tasks/TASK-0049-*.md`, `.ai/sessions/*`, `.ai/context/CURRENT_STATE.md`

## Execution plan

1. Re-resolve the current published version of `@sentropic/graphify` and
   its declared `engines.node`. Record both, with the date. Do not carry
   `0.18.0` forward from the plan without re-checking — PLAN-0003 measured
   this exact decay over four days.
2. Copy `mcp-servers/_template-external/server.json` to
   `mcp-servers/graphify/server.json` and fill it in against the authoring
   guide's schema table, field by field.
3. Decide `capabilities.destructive` for the **wired** command and justify
   it in the log. If `false`, no `authorization` block is needed — confirm
   that against `validate.sh:122-200` rather than from memory.
4. Write `preconditions`: node runtime reality, the
   `.graphify/graph.json` requirement, and the CLI's mutating subcommands
   that are deliberately **not** wired.
5. Run `tests/validate.sh`. Then **prove the manifest is actually being
   checked** — temporarily break one required field, watch the specific
   message fire, restore, and confirm the restore byte-for-byte. S7's
   TASK-0037 found `validate.sh` returning exit 0 on a malformed agent
   file; a green gate proves nothing until you have seen it go red for
   this file.
6. Run `scripts/sync-registry.sh`; confirm the row appears with the right
   Shape (`external`) and that no `_template` row leaked in.
7. Run `tests/smoke-mcp.sh --server graphify` and record the **actual**
   outcome. Then implement the chosen option, and **observe** the corrected
   outcome — a SKIP that was never seen is a claim, not a result.
8. If `.env.example` changed, re-run `validate.sh` to confirm the
   completeness check is satisfied.

## Acceptance criteria

- [ ] `mcp-servers/graphify/server.json` exists, is valid JSON, and passes
      every manifest check in `tests/validate.sh`.
- [ ] Version is **pinned exactly** in both `upstream.version` and
      `launch.command`; the resolution date is in the log.
- [ ] `runtime.declared` and `runtime.tested` are both present and
      distinct in meaning.
- [ ] `capabilities.destructive` describes the wired command, and the CLI's
      mutating subcommands are named somewhere in the manifest — so no
      reader concludes the whole tool is read-only.
- [ ] The `.graphify/graph.json` precondition is stated.
- [ ] The manifest check was **observed failing** on a deliberately broken
      copy, and the restore verified.
- [ ] `docs/registry.md` regenerated and committed; graphify appears with
      Shape `external`; no template row present.
- [ ] `tests/smoke-mcp.sh` reports **PASS or SKIP** for graphify — never a
      FAIL caused by an unmet precondition — and the corrected outcome was
      observed, not predicted.
- [ ] If `smoke-mcp.sh` was edited, a human authorized it and the
      authorization is recorded here.
- [ ] `.env.example` complete for this manifest, or the absence of required
      vars stated explicitly.
- [ ] No graphify source vendored; no `plugins/` directory created.

## Mandatory validations

- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (components changed — **required**)
- [ ] tests/smoke-mcp.sh --server graphify (not part of the mandatory gate,
      but this task is the reason it exists)

## Risks and rollback

- **Overstating read-only-ness.** The wired command is safe; the CLI is
  not. B-012 is the precedent for how such a claim propagates. Mitigation:
  name the mutating subcommands in the manifest.
- **Making `smoke-mcp.sh` lie in a new direction.** Excluding graphify
  invisibly means the script appears to cover a server it does not. Any
  exclusion must be legible in the script itself.
- **A pinned version is a record, not a guarantee.** graphify is pre-1.0
  (`0.18.0`), so breaking changes are expected by convention. The manifest
  records what was tested; bumping is a deliberate act, as the ansible
  entry's note already says.
- **`.graphify/` could be committed by accident** if anyone runs a build in
  this repo. Decide the `.gitignore` question in this task rather than
  leaving a trap.
- Rollback: delete `mcp-servers/graphify/`, re-run
  `scripts/sync-registry.sh`, revert `.env.example`/`.gitignore`/
  `smoke-mcp.sh`. Nothing outside the repo changes, so rollback is local
  and complete.

## Outputs / handover

*Intended* end state — this task has not run.

| Artifact | End state |
|----------|-----------|
| `mcp-servers/graphify/server.json` | New; pinned; gate-valid; precondition and mutating-subcommand notes present; observed failing when broken |
| `docs/registry.md` | Regenerated; one new `external` row for graphify |
| `tests/smoke-mcp.sh` | Either unchanged with a documented exclusion, or precondition-aware with authorization recorded |
| `.env.example` | Extended if required, or explicitly confirmed as needing nothing |
| `.gitignore` | `.graphify/` decision made either way, with the reason |
| ponytail / omniroute | **Deliberately untouched** — different tasks, different categories |

**Next task starts here**: `TASK-0051` picks up from a shipped, indexed
manifest and documents the placement rule that put it there — including
whether graphify also needed a `configs/` section, which would make
`ADR-0021`'s routing rows non-exclusive in practice. Record any deviation
from this plan here.

## Status

- Status: planned
- Owner: agent
- Created: 2026-09-16
- Updated: 2026-09-16

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
