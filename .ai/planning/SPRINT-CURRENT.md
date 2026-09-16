# Sprint S6 — Ansible agent guardrails

> **UN-PARKED 2026-09-16 by `TASK-0052`. NOW CURRENT.** Human decision, in
> answer to a direct question about how S6 should re-enter: **finish S6
> before S8**. S8 is **re-queued** (not parked, not closed) at
> `sprints/SPRINT-S8-third-party-extensions.md` — it had done zero work, so
> the swap cost nothing in either direction.
>
> **The parking note below still stands as written and is preserved
> deliberately.** Its central claim is still true and is why un-parking is
> also cheap: **S6 still has zero implementation of its own.** What changed
> is only that two of its briefs were delivered by another route.
>
> ## What is actually outstanding
>
> `TASK-0029` and `TASK-0030` are **`done`, delivered by S7's pilot**
> (`TASK-0046`) — the table below has been corrected, because it read
> `planned` while both task files read `done`. That is the four-files-
> disagree defect `REVIEW-0008` had to sweep across S7, found here on the
> first read of this file. **Remaining as of 2026-09-16: `TASK-0031`,
> `TASK-0032`, ratification of the three ADRs, and a checkpoint.**
> `TASK-0026`, `TASK-0027`, `TASK-0028` and all three ADR bodies are
> **done** — and `TASK-0026` **closed B-012 and B-013**, the first S6 items
> resolved by S6's own execution rather than by another sprint's route. **The checkpoint is NOT `REVIEW-0009`** — that number is reserved
> by S8's file; S6's takes the next free one.
>
> **All three ADRs now have bodies; all three remain `Proposed`.** They were
> skeletons until 2026-09-16 — every section reading "to be written". Per the
> human decision they were written **from the spikes' observed evidence** and
> **not** self-accepted, and deliberately not filled from `PLAN-0003`'s prose,
> which is how they reached skeleton state. **Two were retitled because the
> evidence contradicted their planned titles:**
>
> - **`ADR-0015`** — clause 1 is **formally reversed**. The "portable core
>   plus per-project `templates/`" mechanism fails because `install.sh:105`
>   symlinks a deployed skill into this repo's working tree, so an operator
>   filling in a shipped template would write one estate's production facts
>   into the portable component. Decision 1 is now **derive per change, never
>   declared and never stored**, which is what the shipped skill already does.
>   `templates/` survives for **copy-out** artifacts holding no estate facts
>   (`change-record.md` is the worked example). **Its filename still names the
>   rejected shape**, deliberately, per `ADR-0017`'s precedent — flagged in
>   the ADR's own Status. Ratification is owed *specifically* on this clause:
>   reversing an approved mechanism is substantive, not a restatement.
> - **`ADR-0016`** — still **no category**, but the reasoning is **inverted**.
>   The plan expected hooks not to work; `TASK-0028` found interception
>   **works in both clients**. What declines the category is that the two
>   clients **disagree on the tool's name** —
>   `mcp__ansible__zen_of_ansible` (Claude Code, documented) vs
>   `ansible_zen_of_ansible` (OpenCode, **observed live**) — so no portable
>   artifact can even match the same string. The ADR must therefore read as a
>   **declined** option, never an unavailable one.
>
> **Both spikes' results now bind `TASK-0031`:** its home is a custom
> `ansible-lint` rule wired via `enable_list:`, and it **must ship a proof
> that it fires**. `TASK-0027` observed that a custom rule outside the active
> profile is **loaded, listed and never evaluated — at exit 0**. Without the
> fires-proof this route is strictly worse than `pre-commit`, which fails
> loudly. Two sibling silent-no-op modes are on the record for the same
> reason: Claude Code's matcher needs its `.*` (`mcp__ansible` matches
> nothing), and OpenCode under `experimental.codeMode` does not register MCP
> tools individually at all.
>
> ## Four defects in this sprint's own remaining plan
>
> Found by `TASK-0052` before executing any of it, by opening the files the
> briefs name (standing lesson 7). **All four bear on `TASK-0031`**, the
> guard — this sprint's highest-value deliverable — and are corrected in that
> brief as well as recorded here, because a finding kept only in the log of
> the task that fixes it gets rediscovered rather than reused
> (`REVIEW-0008` finding 2):
>
> - **D1 — the guard's target matching does not match the real playbook.**
>   `TASK-0031` scopes "PVE-class" detection around group names
>   (`pve_cluster`/`pve_voting`). But `capture_pve_baseline.yml:21` reads
>   `hosts: sigsrvpve1` — a **bare hostname**. Group-name matching would
>   never classify the one playbook in the estate that targets a PVE node.
>   Detection must resolve host→group membership from
>   `inventory/production.yml`.
> - **D2 — fixture 5 cannot tell a working guard from a broken one, and it
>   was an acceptance criterion.** "The two real playbooks → guard silent"
>   is satisfied by a correct guard *and* by a D1-afflicted guard that
>   recognises nothing at all. That is a check that cannot fail — standing
>   lesson 8, in the fixture design of the task written to avoid it. A
>   **sixth fixture** is now required: PVE host by bare hostname,
>   `gather_facts: true`, no exclusion → must **fail**.
> - **D3 — a naive `module_defaults` check would over-accept the real
>   playbook.** `capture_pve_baseline.yml:23` has `module_defaults:` scoped
>   to `group/community.proxmox.proxmox` with **no
>   `ansible.builtin.setup`** entry. Accepting the key rather than a
>   `setup`-scoped `gather_subset` passes dangerous code while appearing to
>   implement the second accepted form.
> - **D4 — `ansible-lint`'s recorded location is wrong.** There is no venv
>   in `SIGMA-infrastructure`. It is at
>   `~/.venvs/sigma-ansible/bin/ansible-lint`, **not on `PATH`**. Version
>   confirmed by running it: `26.8.0`, `ansible-core 2.20.8`. The version
>   claim held; the location did not.
>
> **What D1–D3 have in common:** the plan was written from `ansible.cfg`'s
> prose — accurate and emphatic about the hazard — without opening the
> playbook the guard must classify. **The brief verified the hazard and
> never verified the subject.** D2 generalises past Ansible: it is a
> fixture-design failure mode.
>
> ## Still binding
>
> `SIGMA-infrastructure` is **read as evidence and never modified**
> (decision 3 below). Verified clean at the start of this session and to be
> verified clean at the end of every task.
>
> **`REVIEW-0009` is S8's checkpoint number, already reserved in that
> sprint's file.** S6's checkpoint must take the next free number rather
> than reusing it — check before writing.
>
> Everything from here down is the sprint as parked, with the single
> correction to the `TASK-0029`/`0030` rows noted above.

> **PARKED 2026-09-15 by TASK-0033, not closed and not abandoned.**
>
> Human decision, recorded in `PLAN-0004`'s "Human decisions required"
> table. S7 (`PLAN-0004`) opened instead. All ten artifacts below stay
> exactly as planned: TASK-0026…0032 remain `planned`, ADR-0014…0016
> remain `proposed`, and B-010…B-013 remain **ready** in
> `BACKLOG.md` — parking a sprint does not un-scope its backlog items.
>
> **Nothing in this sprint was implemented before it was parked**, which
> is why parking cost nothing: the archived file below is the plan as
> written, not a partial execution needing reconciliation.
>
> Two connections to S7 that a future reader will need:
>
> - **S7's pilot (`TASK-0046`) delivers this sprint's `TASK-0029` and
>   `TASK-0030`** — `skills/ansible-ops/` and `loops/ansible-change/` —
>   by producing them *through* S7's new design and build loops. Whether
>   0029/0030 are then closed as delivered-by-S7, rewritten, or left
>   parked is recorded in `TASK-0046`'s execution log, deliberately not
>   pre-empted here.
> - **This sprint's standing constraint still binds S7**:
>   `SIGMA-infrastructure` is read as evidence and **never modified**, and
>   its unpushed commits are left untouched. Parking does not relax it.
>
> Everything below is the sprint as opened on 2026-09-14, unedited.

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
| TASK-0026 | — | **done** | Correct the `WORKSPACE_ROOT` blast-radius claim; disable `ansible_navigator` in 3 snippets; ~~LM Studio → models-only~~. **Done 2026-09-16; closes B-012 and B-013.** The false claim was in **six** places, not four (the extras: `docs/operations/runbook.md` and a *lessons* list). **Models-only deliberately not done — `ADR-0020` refuted it.** `authorization.history` now shows the original five-tool grant *and* the narrowing; gate **observed failing** on a broken authorization block, then restored byte-identically |
| TASK-0027 | — | **done** | *Spike.* Lint the two real playbooks on a `/tmp/opencode/` copy; record what degraded; choose the guard's home. **Ran 2026-09-16: gate passes (0 failures / 53 rules / exit 0); guard = custom `ansible-lint` rule via `enable_list:`, conditional on a fires-proof** |
| TASK-0028 | — | **done** | *Spike.* Can a Claude Code `PreToolUse` hook match `mcp__ansible__*`? OpenCode's equivalent? Non-blocking. **Ran 2026-09-16: YES in both — Claude Code documented, OpenCode observed live. The clients' MCP tool *names* are incompatible, which is what declines the category** |
| ADR-0014 | TASK-0027 | **proposed** (body written) | Accept and narrow the MCP surface; ADR-0010 stays closed. **Body written 2026-09-16; ratification owed** |
| ADR-0015 | TASK-0027 | **proposed** (body written, **retitled**) | ~~Portable core + per-project templates~~ → **derive per change, persist nothing**; check+snapshot, not staging. **Clause 1 reversed on evidence**; filename deliberately unchanged |
| ADR-0016 | TASK-0028 | **proposed** (body written, **retitled**) | Hooks as a component category — ~~expected "no"~~ **declined, but because the clients disagree on the tool's *name*, not because interception fails; it works in both** |
| TASK-0029 | ADR-0015 | **done** | `skills/ansible-ops/` — **delivered by S7's pilot (`TASK-0046`), 2026-09-15**, produced *through* S7's loops. Row corrected 2026-09-16 by `TASK-0052`: it read `planned` while the task file read `done` |
| TASK-0030 | TASK-0029 | **done** | `loops/ansible-change/` — same, delivered by `TASK-0046`. Both ran under an **Option 2 waiver** (built from `PLAN-0003`'s F1–F7 evidence, ADR-0015 unratified), recorded in both task files |
| TASK-0031 | ADR-0016, TASK-0027 | **planned** — **both dependencies now cleared** | The `gather_subset` guard + **7** fixture proofs (raised from 5 by `TASK-0052`). Shape is fixed: a custom `ansible-lint` rule via `enable_list:`, **which must ship a proof that it fires** |
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
