# Sprint S8 — Third-party agent extensions

> **PLANNED 2026-09-16, and NOT YET CURRENT.** `SPRINT-CURRENT.md` still
> holds **S7**, deliberately.
>
> This file sits in `sprints/` — which otherwise holds *archived* sprints —
> because S7 has not been closed: `REVIEW-0008` does not exist, even though
> all six of its tasks are `done`. Promoting S8 to `SPRINT-CURRENT.md`
> would have silently closed a sprint without its checkpoint, and S7's own
> headline finding was about artifacts making false claims about their own
> state.
>
> **Whether S7 closes with `REVIEW-0008` before S8 begins is a human
> decision** — `PLAN-0005`, Human decisions required, item 3. Move this
> file to `SPRINT-CURRENT.md` when that call is made.
>
> The deviation from convention is recorded here rather than quietly taken.

**Phase 8. Planned by `PLAN-0005`. Planning only — no implementation.**

Opened from a human request rather than a backlog item: *add ponytail,
omniroute and graphify to the toolbox, cross-agent compatible if
possible.* That makes it the third sprint in a row to start from a
human-supplied premise, and the third in a row where **the premise had to
be corrected before it could be built**.

## What this sprint is for

Bring two of the three requested extensions into this repo's governance —
each in the category it actually belongs to — and document the third as an
optional tool rather than a component.

- **graphify** → `mcp-servers/graphify/server.json` (ADR-0005 external
  shape). A real, pinned, indexed component.
- **ponytail** → per-client wiring in `configs/*/README.md`.
- **omniroute** → **out of the component layer** (human decision,
  2026-09-16). One entry in a new `docs/development/third-party-tools.md`.

**No new component category. No plumbing changes. Nothing vendored.
Nothing auto-installed.** All four are `ADR-0021`.

## The correction that shapes the sprint

**The word "plugin" named three unrelated mechanisms.** Verified from npm
metadata and upstream *source* on 2026-09-16:

| | OpenCode | Claude Code |
|---|---|---|
| ponytail | npm `plugin` entry; `main` points at `./.opencode/plugins/ponytail.mjs` | plugin **marketplace** + two Node lifecycle hooks |
| omniroute | provider plugin needing a running daemon and an API key | **not a plugin** — an OpenAI-compatible base URL |
| graphify | a generated plugin file *or* `AGENTS.md` — **its README and its source disagree** | `CLAUDE.md` section + `PreToolUse` hook |

There is no portable "plugin" capability to abstract. ADR-0006's rule
applies unchanged: portability is scoped **per capability**.

## Two upstream claims were falsified before the sprint started

Both found by reading source rather than READMEs, and both set
`TASK-0048`'s agenda:

1. **graphify's README contradicts graphify's source.** The README lists
   OpenCode among platforms with no hook point that fall back to
   `AGENTS.md`; `src/cli.ts` defines
   `OPENCODE_PLUGIN_ENTRY = ".opencode/plugins/graphify.js"` plus a plugin
   template that hooks bash calls.
2. **`graphify serve` cannot start without an existing graph.**
   `src/serve.ts:188-195` — `validateGraphFilePath`, then `console.error`
   and `process.exit(1)`. This breaks `tests/smoke-mcp.sh`, which would
   report **FAIL** where the truth is *precondition unmet* → **SKIP** —
   the mirror of the defect that script's own header guards against.

Neither document is evidence of installed behaviour. That is `TASK-0036`'s
lesson from S7 — *a doc-confirmed field is not an installed field* — which
is why the spike runs first.

## Tasks

| Task | Depends on | Status | What |
|------|-----------|--------|------|
| `TASK-0048` | none | **planned** | **Spike.** Verify both products on this machine: graphify's real OpenCode surface, `graphify serve` without a graph, and whether ponytail loads from an npm `plugin` entry. Version-stamped observations; no component files written |
| `TASK-0049` | TASK-0048 | **planned** | `mcp-servers/graphify/server.json` pinned exactly; registry regenerated; the smoke-test precondition decision made and **observed** |
| `TASK-0050` | TASK-0048 | **planned** | ponytail sections in all three `configs/*/README.md`; Bionic labelled **unverified**; the out-of-plugin-dir state files noted |
| `TASK-0051` | TASK-0049, TASK-0050 | **planned** | Placement rule into the authoring guide (linking, not restating); `docs/development/third-party-tools.md` created with omniroute |
| `REVIEW-0009` | all | **planned** | Checkpoint; headline question pre-committed below |

`TASK-0049` and `TASK-0050` are dependency-independent but **not assumed
safely concurrent** — both would regenerate `docs/registry.md`, and S7's
TASK-0038/0039/0040 sequence is the precedent for checking that before
parallelising rather than after.

## Decisions taken at plan time — do not re-open

- **No `plugins/` category.** ADR-0016 declined one for hooks, and its
  three plumbing findings were **re-verified 2026-09-16**: four hardcoded
  `emit_section` calls, four hardcoded `validate.sh` iteration roots, a
  four-column `install.sh` `CLIENTS` table. A new top-level directory is
  still silently ignored by all three and by CI.
- **Nothing is vendored.** `install.sh:105` deploys skills with `ln -sfn`,
  so a vendored copy would be a symlink into this repo's working tree,
  making this repo maintainer-of-record for upstream content. Same
  mechanism that invalidated ADR-0015's shape in S6.
- **Nothing is auto-installed.** `install.sh` is not extended to write into
  `~/.claude/plugins/` or `~/.config/opencode/opencode.jsonc`. This holds
  the line the repo already keeps for agent emission.
- **ponytail cannot be an MCP server**, on a checkable fact: upstream's
  `ponytail-mcp/` is `"private": true` and unpublished
  (`registry.npmjs.org/ponytail-mcp` → *Not found*, 2026-09-16). ADR-0005's
  external shape needs a published package; with none there is no
  `launch.command`.
- **omniroute is a service, not an agent extension.** A daemon on `:20128`,
  an API key, a dashboard. Its OpenCode plugin's `mcpAutoEmit` even
  **writes an `mcp.*` entry into the client config** — a mutation this repo
  forbids itself. The human's exclusion is also the technically correct
  call, and `ADR-0021` records why, not just that.

## Known limitation, recorded at plan time

**Two of three deliverables are prose.** graphify becomes a real pinned
component; ponytail and omniroute produce documentation only.

That is the pattern `mcp-servers/_template/` established (ADR-0010),
`agents/` and `prompts/` repeated (ADR-0016), and S7 flagged about itself.
This would be the **fourth** instance of the class.

The only defence is ordering: `TASK-0048` runs first, so the prose
describes observed behaviour rather than transcribed vendor claims.
**If this sprint shrinks, the honest cut is a product, never the spike.**

Hence `REVIEW-0009`'s question is fixed in advance: **did the spike change
anything, or did it rubber-stamp the vendor READMEs?** Two README/source
discrepancies were found *before* the spike began, so a spike reporting
zero findings is more likely weak than reassuring — the checkpoint must
judge its method, not only its verdict.

## Standing constraints

- **Capability claims about third-party clients cite vendor documentation
  *or* a version-stamped observation, and say which** (ADR-0020, now
  `ADR-0021` clause 5). Three independently-shipping products plus two
  clients is the fastest-decaying claim class this repo has yet handled;
  graphify is pre-1.0 at `0.18.0`.
- **Directory-name inference is not evidence in either direction**
  (ADR-0020's generalisation). The mistake that cost two sprints of a false
  belief about Bionic.
- **A pinned version is a record, not a guarantee.** Bump deliberately and
  update the manifest in the same change, as the ansible entry already
  says.
- **`validate.sh` checks documentation completeness, never runtime
  presence** (ADR-0009). For `configs/` it checks only that the file
  *exists* — a green gate says almost nothing about whether these
  instructions are true, and `TASK-0050` must say so in its log.

## Out of scope, recorded not hidden

Each of these would recreate a defect already paid for:

- **A `plugins/` (or `extensions/`, or `hooks/`) category** — ADR-0016's
  reasoning, re-verified. Naming a category after one vendor's term for a
  capability another implements differently is how confusion starts.
- **Vendoring ponytail's six skills into `skills/`** — the symlink
  ownership problem above, plus ADR-0004's three copies.
- **`mcp-servers/omniroute/` or an omniroute `configs/` section** — the
  decision is precisely that it gets neither.
- **Extending `install.sh` to wire any of the three** — crosses the
  never-touch-client-config line deliberately.
- **Installing omniroute to "complete the picture"** during the spike. It
  is a gateway service with a daemon and an API key.
- **A `validate.sh` check enforcing the placement rule** — routing is a
  judgment call; a check that cannot really decide it would be a check that
  cannot fail, which is this repo's most-repeated lesson.
