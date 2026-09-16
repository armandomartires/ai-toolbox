# Sprint S8 — Third-party agent extensions

> **RE-QUEUED 2026-09-16 by `TASK-0052` — not current, not parked, not
> closed.** Human decision: **S6 is un-parked and finished first**, so this
> sprint returns to `sprints/` in exactly the state it was planned in.
>
> **Re-queuing cost nothing, for the same reason parking S6 cost nothing:**
> all four tasks (`TASK-0048…0051`) are still `planned` and **zero
> components were changed** — planning-only was the explicit instruction at
> the time. Nothing is half-built, so nothing needs reconciling. Had this
> sprint been mid-implementation the swap would have cost real work.
>
> **This is a third sprint end-state, deliberately distinct from the other
> two.** A *closed* sprint gets a `REVIEW-####` and resolves its backlog
> items. A *parked* sprint keeps its artifacts `planned`/`proposed`. This
> one was promoted and is **un-promoted before doing any work** — so there
> is no checkpoint, because there is nothing to check.
>
> **`B-019` and `B-020` stay `ready`.** Re-queuing a sprint does not
> un-scope its backlog items, the same rule that held B-010…B-013 `ready`
> through S6's park. B-020 in particular is latent for **any** future
> stateful MCP server, not only graphify, so it outlives this sprint's
> scheduling either way.
>
> Nothing below is rescoped. `PLAN-0005` and all four briefs are unmodified.
> **The header below is preserved with exactly one edit**: its "NOW CURRENT"
> claim is struck through, because leaving a false present-tense status
> assertion in place is the defect class `REVIEW-0008` had to sweep across
> four files. Everything else is verbatim — it carries S7's two binding
> findings and the corrected task counts, which are still true and still
> bind this sprint whenever it resumes.

> **PLANNED 2026-09-16.** ~~**NOW CURRENT**~~ *(struck 2026-09-16 by
> `TASK-0052` — re-queued; see the note above)* — promoted 2026-09-16 once
> S7 closed
> with `REVIEW-0008` (**approve**), archived at
> `sprints/SPRINT-S7-design-and-production-loops.md`.
>
> This file previously sat in `sprints/` with a note that it was *not* yet
> current, because promoting it while `REVIEW-0008` was missing would have
> silently closed a sprint without its checkpoint. **That deviation is now
> resolved in the correct order** — the review was written first, from
> independent evidence, and it did not rubber-stamp: it found the gate had
> left its sub-second budget, four S7 tasks (including the pilot) had left
> no session record, and the pilot's most actionable finding was untracked
> until it became **B-021**.
>
> The old header also said *"all six of its tasks are `done`"*. **That was
> false — thirteen were done and one cancelled**, and it was one of three
> files disagreeing about the count. Corrected at closure, and worth keeping
> visible here: the note warning about false self-claims contained one.
>
> **Two S7 findings bind this sprint directly**, before any of its own work
> starts:
> - **`tests/validate.sh` is at ~1150 ms**, past the sub-second property
>   `AGENTS.md` treats as load-bearing. S8 adds a `mcp-servers/` entry and
>   `configs/` prose, so its own cost is small — but do not measure the
>   gate on `/tmp` (ext4) and compare against `/mnt/c` (9p): that
>   understates by ~40%.
> - **A finding recorded only in a task log gets rediscovered, not fixed**
>   (B-021's lesson). `TASK-0048`'s spike exists to produce findings; each
>   one that outlives the task belongs in `BACKLOG.md`, not only in prose.

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
