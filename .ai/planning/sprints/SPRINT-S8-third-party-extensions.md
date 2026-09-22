# Sprint S8 — Third-party agent extensions

> # CLOSED 2026-09-23 on `REVIEW-0009`
>
> **Archived by `TASK-0068`.** All four briefs (`TASK-0048`, `0049`, `0050`,
> `0051`) are `done`, the checkpoint
> (`.ai/reviews/REVIEW-0009-sprint-s8-third-party-extensions.md`) approved
> the work, and the human **ratified `ADR-0021` as written on 2026-09-23** —
> the one act the review named as blocking closure. All seven of Phase 8's
> roadmap exit criteria are met; four of them are verifiable mechanically
> rather than from any log.
>
> **The pre-committed question was answered, and the answer was not
> comfortable:** the spike changed things, and **kept changing them after it
> ended** — six corrections, **three against this sprint's own artifacts**.
>
> **`B-019` is closed** (this sprint's own item). **`B-020` closed and
> `B-022` raised-and-closed** by `TASK-0049`; **`B-023` raised** by
> `TASK-0051` and still `ready`.
>
> **No sprint replaced this one.** S9 and S10 exist as plans (`PLAN-0006`,
> unattended task runs) but are queued in `sprints/`, and S9 rests on
> `ADR-0022`, which is `Proposed` and blocked on its own two spikes — so
> promoting it is a human decision. Five `REVIEW-0009` follow-ups are
> outstanding, including the clause-5 amendment the human declined to make
> at ratification.
>
> Everything below is preserved as written, including its own superseded
> status headers. This file is a dated record, not a live status page.

> **ALL FOUR BRIEFS ARE `done`; `REVIEW-0009` IS WRITTEN; THE SPRINT IS NOT
> CLOSED (2026-09-23).** *(Superseded by the closure header above, the same
> day.)* `TASK-0048`, `0049`, `0050` and `0051` all ran.
> `REVIEW-0009` — `.ai/reviews/REVIEW-0009-sprint-s8-third-party-extensions.md`
> — **approves the work and states it cannot close the sprint**: `ADR-0021`
> is still `Proposed`, and `PLAN-0005`'s first acceptance criterion requires
> a **human** to ratify or reject it on `TASK-0048`'s evidence. The
> ratification packet is in the review. **S8 stays current until that
> decision is recorded** — the same shape as S6's closure on `REVIEW-0010`.
>
> **The pre-committed question is answered: the spike was load-bearing.**
> Six corrections, **three of them against this sprint's own artifacts** —
> the precondition path, the Claude Code hook count and the skills' schema
> compatibility were all wrong in briefs written after the spike, and were
> caught by re-opening the evidence rather than trusting the logs.
>
> **Two findings the checkpoint asks to be judged as process, not output:**
> a *labelled* limitation is not a *contained* one (`TASK-0048` correctly
> labelled its package-level answer, and the wrong number propagated
> anyway, because the label records provenance but not which artifact was
> read); and **B-023 is a seam between two briefs** that each assigned the
> same work to the other.
>
> **Two things landed that the sprint did not plan.** `B-020` was fixed and
> **`B-022` was raised and closed in the same task** — `tests/smoke-mcp.sh`
> had been testing whether a server *exits*, not whether it *speaks*, and
> was found only because `TASK-0049` chose to verify its own fix. And the
> gate budget this sprint was pre-blamed for was **not spent**: 1008 ms
> median on `/mnt/c` against `REVIEW-0010`'s ~1085 ms.
>
> Everything below is the sprint as planned. Its task-status table is
> superseded by this note.

> **NOW CURRENT — promoted 2026-09-22 by `TASK-0054`**, once S6 closed on
> `REVIEW-0010` and its three ADRs were ratified. This executes the ordering
> the human set in `TASK-0052` (*"finish S6 before S8"*) rather than making a
> new decision: that ordering always presupposed S8 followed.
>
> **Promotion is a state change, not a start.** `TASK-0048`, `0049`, `0050`
> and `0051` are all still **`planned`**, `ADR-0021` is still **`Proposed`**
> and owes its own ratification, and `B-019`/`B-020` are still **`ready`**.
> Nothing in this sprint has been executed. This is the third time this file
> has changed sprint-state without changing its content, and the reason is
> unchanged: planning-only was the explicit instruction, so nothing is
> half-built.
>
> **Two things landed while this sprint was re-queued** and bear on it:
>
> - **`ADR-0016` is now `Accepted`** (2026-09-22). This sprint's `ADR-0021`
>   extends it and asserted twice that it was `Proposed`; both assertions now
>   carry dated notes. The substantive argument is unaffected — if anything
>   it is firmer, since the ADR it extends is no longer provisional.
> - **`REVIEW-0010` left four follow-ups** that are not this sprint's but
>   will be read alongside it: the gate at ~1085 ms against a sub-second
>   claim (**unactioned at its second checkpoint** — S8 adds a
>   `mcp-servers/` entry, so it is the sprint most likely to be blamed for a
>   budget it did not spend), an `ansible-core` version recorded in nine
>   places that has moved, whether anything re-checks external claims at all,
>   and `skills/ansible-ops/` unexercised against a live estate.
>
> **The re-queue note below is preserved as written.** Everything under it is
> the sprint as planned, unmodified.


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
