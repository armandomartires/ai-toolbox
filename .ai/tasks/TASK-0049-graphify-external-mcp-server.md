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

- [x] `mcp-servers/graphify/server.json` exists, is valid JSON, and passes
      every manifest check in `tests/validate.sh`.
- [x] Version is **pinned exactly** in both `upstream.version` and
      `launch.command`; the resolution date is in the log.
- [x] `runtime.declared` and `runtime.tested` are both present and
      distinct in meaning.
- [x] `capabilities.destructive` describes the wired command, and the CLI's
      mutating subcommands are named somewhere in the manifest — so no
      reader concludes the whole tool is read-only.
- [x] The `.graphify/graph.json` precondition is stated.
- [x] The manifest check was **observed failing** on a deliberately broken
      copy, and the restore verified.
- [x] `docs/registry.md` regenerated and committed; graphify appears with
      Shape `external`; no template row present.
- [x] `tests/smoke-mcp.sh` reports **PASS or SKIP** for graphify — never a
      FAIL caused by an unmet precondition — and the corrected outcome was
      observed, not predicted. **Both** outcomes were observed: SKIP in the
      shipped state, PASS with a graph present.
- [x] If `smoke-mcp.sh` was edited, a human authorized it and the
      authorization is recorded here. **Two separate authorizations** — see
      the log.
- [x] `.env.example` complete for this manifest, or the absence of required
      vars stated explicitly. **Unchanged**; `environment` is `{}` and
      `environment_note` says why.
- [x] No graphify source vendored; no `plugins/` directory created.

## Mandatory validations

- [x] tests/validate.sh
- [x] scripts/sync-registry.sh (components changed — **required**)
- [x] tests/smoke-mcp.sh --server graphify (not part of the mandatory gate,
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

| Artifact | End state |
|----------|-----------|
| `mcp-servers/graphify/server.json` | New; pinned to `0.18.0`; gate-valid; precondition, tool-list and mutating-subcommand notes present; observed failing three ways when broken, restore md5-verified |
| `docs/registry.md` | Regenerated; one new `external` row for graphify; no template row |
| `tests/smoke-mcp.sh` | **Changed twice, both human-authorized** — manifest-driven precondition SKIP (option (a)), *and* a fix to a second defect found during execution: it waited for process exit, so a conforming long-lived MCP server was reported as never having spoken |
| `.env.example` | **Unchanged.** `environment` is `{}` and `environment_note` states that as a decision, not an omission |
| `.gitignore` | `.graphify/` ignored, with the reason inline |
| ponytail / omniroute | **Untouched**, as planned |

**Next task starts here**: `TASK-0051` picks up from a shipped, indexed
manifest. Two things it must carry: **graphify does occupy more than one
routing row** — it is an `mcp-servers/` component here *and* has a
client-native OpenCode surface (`TASK-0048` Q1), so `ADR-0021`'s
non-exclusivity is real and must be stated, not hedged. And the
`smoke_test` manifest key is now part of the external-server shape in
practice; the authoring guide's schema table does not yet mention it.

**Deviations from the Plan — three, recorded rather than smoothed:**

1. **A second `smoke-mcp.sh` defect was found and fixed inside this task.**
   Not in the brief, not in `B-020`, and strictly larger than the problem
   the task was scoped around. Separately authorized by the human once the
   evidence was in hand; the alternative offered was a backlog item or a
   follow-up task, and the human chose to fix it here.
2. **`requires_paths` is `.graphify/graph.json`, not `.graphify/`.** The
   brief and `ADR-0021` both frame the precondition as the state directory.
   Declaring the directory would have left a narrower false FAIL, proven by
   observation — see the log.
3. **The tool list was read out of the published bundle**, because upstream
   ships only `dist/` plus `src/skills/` in the tarball; `src/serve.ts`, which
   the brief and `ADR-0021` cite by line number, is not in the package. The
   readings were confirmed against the CLI's own `--help` output rather than
   rested on the bundle alone.

## Status

- Status: done
- Owner: agent
- Created: 2026-09-16
- Updated: 2026-09-23

## Execution log

### Attempt 1

- Date: 2026-09-23
- Agent: Claude Opus 5 (1M context)

#### Upstream re-resolved, not carried forward

| Thing | Observed 2026-09-23 (00:07 CEST / 2026-09-22 22:07 UTC) | Plan-time value |
|---|---|---|
| `@sentropic/graphify` latest | **0.18.0** | 0.18.0 — unchanged over 7 days |
| `engines.node` | **`>=20`** | not stated in the brief |
| license / homepage | **MIT**, `github.com/rhanka/graphify` | MIT ✓ |
| `bin` | `graphify` → `dist/cli.js` | ✓ |
| local node / npx | **v22.23.2** / 10.9.8 | ≥20 ✓ |

`0.18.0` is pinned in both `upstream.version` and `launch.command`.

#### `capabilities.destructive: false`, on a mechanical basis

The wired command is `graphify serve`. Its own help output is the whole
argument:

```
Usage: graphify serve [options] [graph]
Start a stdio MCP server for graph.json
Options:
  -h, --help  display help for command
```

**No options at all beyond `-h`.** In the published bundle the mutating
ontology tools (`validate_ontology_patch`, `apply_ontology_patch`) are
pushed onto the tool list only when `options.ontology?.write === true`, and
`serve` has no flag that can set it. The flag lives on a *different*
subcommand, whose help says so outright: `graphify ontology serve` —
*"Start an ontology MCP server; write tools require explicit --write"*.

So `destructive: false` is not a judgement about upstream's intentions, it
is a statement about reachability. `tests/validate.sh:122-200` was re-read
rather than recalled: `authorization` is required only when `destructive`
is `true`, so no authorization block is needed here — and break-test 2
below confirms that branch fires when it should.

The CLI around `serve` is *not* read-only, and the manifest says so in
`cli_scope.not_wired_mutating_commands`, each entry from observed `--help`
output: `ontology serve --write`, `hook install` (post-commit,
post-checkout, post-merge, post-rewrite hooks), `store push` (Postgres/neo4j
REPLACE mode), `install`/`<platform> install`, and the graph-building
commands. This is the B-012 lesson applied before it could repeat.

#### Q2 re-observed independently

Not taken on trust from `TASK-0048`. In an empty directory:

```
EXIT CODE: 1
stdout: (empty)
stderr: error: Graph base directory does not exist: /tmp/t49-emptydir/.graphify.
        Run the graphify skill first to build the graph (for Codex: $graphify .).
```

It created nothing. Matches `TASK-0048` Q2 exactly.

#### The precondition is the graph FILE, not the state directory

The brief, `ADR-0021` and `TASK-0048` all frame this as `.graphify/`. With
the directory present and the file absent:

```
EXIT CODE: 1
stderr: error: Graph file not found: /tmp/t49-basedir/.graphify/graph.json
```

**Declaring `.graphify/` would have reproduced the same false FAIL in a
narrower window.** `requires_paths` is therefore
`[".graphify/graph.json"]`. The known imprecision in the other direction is
recorded in the manifest: upstream also accepts a legacy `graphify-out/`
layout, which this check does not look for, so such a project gets a
*pessimistic* SKIP — never a false PASS, never the false FAIL the key
exists to remove.

#### Smoke test: the authorized change, and the defect it uncovered

**Authorization 1 (human, 2026-09-23):** option (a), a manifest-driven
precondition SKIP. Chosen over excluding graphify by name because nothing
about graphify is then hard-coded in the harness — which is the property
the script's own comment at its launch block claims for itself — and
because B-020 is latent for *any* future stateful server.

Sequence actually observed, in order:

| Step | Outcome |
|---|---|
| Manifest added, harness unchanged | `FAIL graphify: no stdout (exit 1); stderr: Graph base directory does not exist…` — **B-020 reproduced live**, suite exit 1 |
| `smoke_test.requires_paths` + harness support | `SKIP graphify: precondition unmet, server never started: missing .graphify/graph.json`, suite exit 0 |
| Graph placed at `.graphify/graph.json` | Handshake **attempted** — proving the SKIP is a precondition gate, not a blanket exemption |

That third step is what turned up the second defect, and it is the reason
the step was worth running at all. With the precondition met the harness
reported:

```
FAIL graphify: no reply within 90s (server hung or never spoke)
```

**The server had in fact already answered, correctly.** Run by hand with
stdin held open, `graphify serve` returns:

```json
{"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{},"resources":{}},
 "serverInfo":{"name":"graphify","version":"0.18.0"}},"jsonrpc":"2.0","id":1}
```

The cause is mechanical: the harness used
`subprocess.run(..., input=…, timeout=…)`, which **waits for the process to
exit**. A conforming MCP server keeps serving after `initialize`, so the
harness was testing whether a server *dies*, not whether it *speaks* — and
then printed a message asserting the opposite of what had happened. ansible
passes only because its server happens to exit on stdin EOF. This is the
repo's most-repeated defect class — *a claim an artifact makes that the
artifact falsifies* — sitting inside a test whose header is unusually
careful about exactly that.

**Authorization 2 (human, 2026-09-23):** fix it inside this task, rather
than filing a backlog item or opening a follow-up task. Both alternatives
were offered explicitly. The harness now writes the request, leaves stdin
**open**, reads one reply with a deadline on a reader thread, then
terminates the server. `PASS` now means *"returned a well-formed initialize
result"* — which is what the script's header has claimed since TASK-0009.
The no-reply branch was also split, so the two real failure modes are no
longer reported with one sentence that fits neither: exited-without-speaking
keeps the old `no stdout (exit N)` wording, and alive-but-silent gets its
own.

Verified after the change, in the same run:

```
PASS ansible:  serverInfo.name=ansible-mcp-server version=0.1.0 protocol=2024-11-05
PASS graphify: serverInfo.name=graphify version=0.18.0 protocol=2024-11-05
smoke-mcp.sh: 2 passed, 0 failed, 0 skipped
```

**The fabricated graph was then deleted**, so the repo ships in the SKIP
state. A PASS resting on a hand-written `{"nodes":[],"edges":[]}` would be
this repo's own "a check that cannot fail", and `tests/smoke-mcp.sh` prints
*"SKIP is not a pass"* for precisely this reason.

One incidental fix, disclosed rather than slipped in: `--help` printed
`sed -n '2,29p'`, which leaked shell code into the help text. The header
grew by one line here, so the range was corrected to `2,28p`.

#### Manifest checks observed failing, then restored

A green gate proves nothing until it has gone red for *this* file. Three
deliberate breaks, `md5 46a5fbc8f1568687f7175726258464da` before and after:

| Break | Message |
|---|---|
| removed `runtime.tested` | `INVALID MANIFEST: … missing required key: runtime.tested` (exit 1) |
| `destructive: true`, no authorization | `INVALID MANIFEST: … authorization.granted is not true` |
| `name: graphifyy` | `INVALID MANIFEST: … name 'graphifyy' does not match directory 'graphify'` |

Restore verified byte-for-byte by md5, not by eye.

#### `.env.example` and `.gitignore`

- **`.env.example` unchanged, deliberately.** `environment` is `{}` and
  `environment_note` states it as a decision. The package reads many
  optional `GRAPHIFY_*` variables, but every one belongs to a subcommand
  this manifest does not wire, so none is `required` and the completeness
  check at `validate.sh:684-712` has nothing to assert.
- **`.gitignore` now ignores `.graphify/`.** It is generated,
  machine-specific and potentially large, and upstream warns its
  `branch.json`, `worktree.json`, `needs_update` and `cache/` must never be
  committed. Confirmed working: with a graph present, `git status` stayed
  clean. This closes the trap the brief flagged.
- `scripts/install.sh` needed no change — simulating its manifest block
  against this file prints the launch command, `transport: stdio` and
  `required env: (none)` correctly.

#### One thing worth carrying forward

`@modelcontextprotocol/sdk` is an **optionalDependency** of
`@sentropic/graphify`, not a hard one — the bundle guards its import and
throws *"@modelcontextprotocol/sdk not installed"* if it is absent. It
resolved fine under `npx -y` here, so this is not a live problem, but an
`npm install --no-optional` or a failed optional install would produce a
server that cannot speak MCP at all. Recorded because it is exactly the kind
of thing a pinned version does not protect against.

- Validation: `tests/validate.sh` → **OK** (~1.06 s).
  `scripts/sync-registry.sh` → row added, Shape `external`, no `_template`
  leak. `tests/smoke-mcp.sh` → **2 passed, 0 failed** with a graph present;
  **1 skipped** in the shipped state; full suite green either way.
- Result: **done.** All eleven acceptance criteria met. Two scope
  expansions, both human-authorized before the edit, both recorded above.
- Commit:
- Push:
