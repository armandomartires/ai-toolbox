# Sprint S6 — Ansible agent guardrails

**Phase 6. Opened 2026-09-14, planning only — no implementation yet.**
Planned by `PLAN-0003`. The second sprint since S1 to start from a written
plan rather than a backlog item, and the first to start from a
human-supplied analysis that had to be corrected before it could be
built.

Sprint opened by commit `9528d13` (pushed to `origin/master`, confirmed by
`git fetch` + `git log origin/master`). That commit contains **no component
changes** — `skills/`, `mcp-servers/`, `loops/`, `configs/`, `scripts/`,
`tests/` and `docs/` are all untouched, and `sync-registry.sh` produced no
diff, which is the correct result for a planning-only commit.

## What this sprint is for

The `ansible` MCP server has shipped since S1 with **no instruct layer**:
nothing tells an agent how or when to use it, what this estate's workflow
is, or which actions need approval. The premise, supplied by the human,
is that MCP gives connectivity and structured tool use while a skill
supplies the runbook and hooks supply enforcement.

The premise holds. **Its specifics did not survive contact with the
files**, and six corrections are the substance of `PLAN-0003`. The two
that matter most:

- **There is no staging inventory in the target estate, and there cannot
  be one.** The analysis's central example (`--check --diff -l staging`,
  then `-l staging`, then production) is unimplementable against a single
  6-node cluster at 3-of-4 quorum with one inventory file. The real
  graduated workflow is **`--check --diff` plus snapshot and rollback**.
  Building from the source text would have produced a runbook gating on
  an inventory that does not exist.
- **The pinned MCP server exposes 2 of the 7 capabilities the analysis
  recommends** — and they are the two destructive ones. `ansible_navigator`
  has no inventory, limit, `--check` or `--diff` parameter, so it *cannot*
  perform the safe workflow, while it *can* execute against production.
  It is disabled by this sprint.

## Tasks

| Task | Depends on | Status | What |
|------|-----------|--------|------|
| TASK-0026 | — | **planned** | Correct the `WORKSPACE_ROOT` blast-radius claim; disable `ansible_navigator` in 3 snippets; LM Studio → models-only |
| TASK-0027 | — | **planned** | *Spike.* Lint the two real playbooks on a `/tmp/opencode/` copy; record what degraded; choose the guard's home |
| TASK-0028 | — | **planned** | *Spike.* Can a Claude Code `PreToolUse` hook match `mcp__ansible__*`? OpenCode's equivalent? Non-blocking |
| ADR-0014 | TASK-0027 | **proposed** | Accept and narrow the MCP surface; ADR-0010 stays closed |
| ADR-0015 | TASK-0027 | **proposed** | Portable core + per-project templates; check+snapshot, not staging |
| ADR-0016 | TASK-0028 | **proposed** | Hooks as a component category — expected "no" |
| TASK-0029 | ADR-0015 | **planned** | `skills/ansible-ops/` |
| TASK-0030 | TASK-0029 | **planned** | `loops/ansible-change/` |
| TASK-0031 | ADR-0016, TASK-0027 | **planned** | The `gather_subset` guard + fixture proofs |
| TASK-0032 | TASK-0029 | **planned** | Record the target-repo findings; state what was left alone |

Order matters, and for the same reason it did in S5: ground truth before
decisions, decisions before the canonical shape, enforcement last.
TASK-0026 and both spikes are mutually independent and may run in
parallel or in one session — ADR-0012's second decision applies, so
one-task-one-session remains the default rather than a rule.

## Decisions taken at plan time — do not re-open

All are human decisions from the planning session, recorded in
`PLAN-0003`'s "Human decisions required" table with where each binds.

1. **MCP surface: accept-and-document.** No Python MCP server. ADR-0010
   stays closed and its reopen trigger is deliberately not pulled, even
   though the 2-of-7 gap is exactly the kind of "real reason" that
   trigger describes. ADR-0014 must close this door explicitly so the
   next reader who notices the gap does not re-raise it.
2. **`ansible_navigator` is disabled.** Not a preference — it cannot
   express the safe workflow and the control venv's own
   `ansible-playbook` strictly dominates it.
3. **Option (a) for cross-repo work.** This repo ships portable
   components. `SIGMA-infrastructure` is **read as evidence and never
   modified**; its 42 unpushed commits and 4 stale claims are left
   untouched. Adoption there is that repo's own sprint to open.
4. **The working guard beats the portable abstraction.** If the guard
   ships usefully without a new component category, it does.
5. **Spike linting happens on a `/tmp/opencode/` copy**, not in place.

## The highest-value item, and why it is not the skill

`ansible.cfg:21-48` in the target repo carries a capitalised warning that
`ansible.builtin.setup`'s default fact gathering stats `/etc/pve`, which on
a node with wedged pmxcfs is an uninterruptible D-state hang that
`timeout` cannot kill. It records that the intended global fix **does not
work** (`gather_subset` is rejected in `[defaults]` and silently ignored in
group_vars — verified empirically, there), that it is a play-level keyword
only, and then: *"A code-review or CI check should confirm this before that
playbook is trusted against a live node. **Tracked as unenforced until
then.**"*

A written rule, with a node-hanging failure mode, statically checkable,
enforced by nothing. Unlike every example in the source analysis, it does
**not** depend on whether hooks can intercept MCP tool calls — so it
survives TASK-0028 reporting either way. TASK-0031 is the sprint's
strongest deliverable; everything else is supporting structure.

## Known limitation, recorded at plan time

**Under Option (a) the skill is authored from the target repo as evidence
but never executed there during S6.** `ansible-ops` will therefore end
this sprint in the same epistemic position as `mcp-servers/_template/`:
plausible, unexercised scaffolding. That is the honest price of clean repo
ownership.

This is deliberately written down *now*, before the work, because S5's
equivalent limitation (four tasks in one session leaving the cold-start
benefit untested) was only stated at its checkpoint. It should be S6's
headline checkpoint finding.

## Standing constraints

Unchanged, and four bind this sprint directly:

- `tests/validate.sh` is a commit gate: offline, hermetic, sub-second —
  all three load-bearing. TASK-0031 validates *other* repos' content, so
  it likely belongs in `tests/` as its own harness rather than inside the
  mandatory gate. It must never require the network or an env var.
- **A check that cannot fail is worse than no check, because it is still
  trusted.** Lesson 8 records that knowing this has not prevented
  authoring one — twice. The control is TASK-0031's fixture proofs run
  before the guard is trusted.
- **No invented size budget for `SKILL.md`** (ADR-0008,
  `authoring-guide.md:17-21`). To add one, define it there first, in
  bytes, with a rationale.
- Destructive changes need explicit human authorization in the task file.
  TASK-0026 *narrows* an existing authorization rather than widening one,
  which is the safe direction but still a change to a recorded grant.

## Two gate properties discovered while planning

Both changed this sprint's file layout, and both are worth knowing before
adding any artifact:

- `tests/validate.sh:456-463` **fails** on any file in `.ai/tasks/` not
  matching `TASK-####-*.md`. So the two spikes are **numbered task
  briefs**, not a `SPIKE-####` type. Introducing a new artifact type
  would have meant weakening the gate for a naming preference.
- `:402`, `:450-465` require `## Inputs` and `## Outputs / handover`
  non-empty for every brief ≥ 0020 — **including briefs not yet
  executed**. Every unexecuted brief in this sprint therefore states an
  explicitly-labelled *intended* end state. A planned brief cannot
  describe a real one, and the check cannot tell the difference: it
  detects omission, not correctness (ADR-0012 Decision 3).

## Out of scope, recorded not hidden

- **Modifying `SIGMA-infrastructure` in any way** — decision 3. Its four
  stale claims (`.ansible-lint:4`, `.pre-commit-config.yaml:42`,
  `ci.yml:13,44`, `requirements.yml:4-6`) are recorded by TASK-0032 as
  evidence and fixed nowhere. Its `ansible-lint` gate has also never had
  content to lint, which TASK-0027 establishes but does not fix there.
- **Authoring a Python MCP server** — decision 1.
- **A `hooks/` component category**, unless ADR-0016 justifies it against
  TASK-0028's evidence. Note it would need two implementations (Claude
  Code `settings.json` JSON vs an OpenCode TS plugin), which is a real
  portability problem under `AGENTS.md`'s "portable across every client
  that supports its capability."
- **Retrofitting the `ansible` server to the Python shape.** ADR-0010,
  unchanged.
