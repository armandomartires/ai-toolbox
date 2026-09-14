# PLAN-0003 — Ansible agent guardrails: skill, loop, and a working safety guard

## Objective

Add the **instruct layer** that the `ansible` MCP server lacks, correct
two false claims in this repo's own MCP wiring, narrow that server's
blast radius, and ground all of it in evidence read from a real Ansible
repository — without modifying that repository.

The premise came from a human-supplied analysis arguing that an MCP
server without a skill or hooks gives "connectivity and structured tool
use, but not reliable operational discipline," and recommending four
layers: MCP (capability), skill (runbook), hooks (enforcement), Ansible
(execution). That framing is sound. **Its specifics did not survive
contact with either the pinned server or the target repository**, and the
corrections are the substance of this plan — see "Findings" below.

Scope decisions taken by the human before planning (do not re-open):

1. **MCP surface: accept-and-document.** No Python MCP server is
   authored. ADR-0010 stays closed; its reopen trigger is *not* pulled.
2. **Skill name: `ansible-ops`.**
3. **Clients: Claude Code + OpenCode only.** LM Studio supplies models
   and performs no agentic work; its README is corrected to say so.
4. **`ansible_navigator` is disabled** in the wiring snippets.
5. **Option (a) for cross-repo governance:** `ai-toolbox` ships portable
   components only. The target repo, `SIGMA-infrastructure`, is **read
   as evidence and never modified**; adopting anything there is that
   repo's own sprint to open, per ADR-0004's ownership logic.
6. **The working guard beats the portable abstraction.** If the guard can
   ship usefully without a new component category, it does.
7. **Spike linting happens on a copy under `/tmp/opencode/`,** not in the
   target repo.

## Context consulted

### This repo
- `AGENTS.md` — component layer, git rules, definition of done,
  destructive-change authorization, and the portability requirement
  ("portable across every client that supports its capability").
- `.ai/context/CURRENT_STATE.md` — backlog empty, nothing in flight, S5
  closed; the eight standing lessons, of which 1, 2, 7 and 8 bind this
  plan directly.
- `.ai/planning/SPRINT-CURRENT.md` — reads "Sprint closed", so opening S6
  is a deliberate act, not a continuation.
- `.ai/planning/BACKLOG.md` — "The backlog is empty… New work needs a new
  item with its own justification." Hence B-010…B-013.
- `.ai/tasks/TODO.md` — ends "Confirm scope with the human before
  starting anything." Confirmed, this session.
- `.ai/templates/TASK.md` (57 lines) — 15 sections including the two
  contract sections S5 added.
- `ADR-0002` (symlink-first), `ADR-0003` (skill frontmatter schema),
  `ADR-0004` (this repo is canonical for the skills it ships),
  `ADR-0005`/Clarification (two MCP shapes, derived from marker file),
  `ADR-0006` (LM Studio is MCP-only; loops are authored, not ported),
  `ADR-0008` (skill linting is frontmatter-only — **no invented size
  budget**), `ADR-0009` (validation checks documentation completeness,
  never runtime presence), `ADR-0010` (Python MCP shape deferred, with a
  reopen trigger this plan deliberately does not pull), `ADR-0012`
  (handover is a contract; resumability is the invariant), `ADR-0013`
  (the two shipped skills scaffold two *different* frameworks —
  `ansible-ops` must not become a third).
- `mcp-servers/ansible/server.json` (46 lines) — the pinned manifest.
- `configs/{claude-code,opencode,lm-studio}/README.md` — the three wiring
  snapshots, each restating the manifest's destructive warning.
- `loops/release-check/loop.md` (96 lines) — the existing loop shape:
  numbered steps with *expected outputs*, bounded retries (3), hard stops,
  and escalate-without-retry for destructive actions.
- `docs/development/authoring-guide.md:17-21` — no line or byte budget for
  `SKILL.md` is defined, and inventing one is forbidden; to add one,
  define it here first in bytes with a rationale.
- `tests/validate.sh` (474 lines) — the commit gate. Two properties
  discovered while planning are load-bearing for this plan's file layout:
  - `:456-463` **fails** on any file in `.ai/tasks/` whose name does not
    match `TASK-####-*.md`. A file named `SPIKE-0001-*.md` would break the
    gate. **Therefore the two spikes are numbered tasks**, not a new
    artifact type.
  - `:402`, `:450-465` require `## Inputs` and `## Outputs / handover` to
    be present *and non-empty* for every brief numbered ≥ 0020 — including
    briefs not yet executed. Unexecuted briefs in this plan therefore
    carry an explicitly-labelled **intended** end state, never a claimed
    one.
- `scripts/sync-registry.sh:114-124` — three hardcoded sections
  (`skills`, `mcp-servers`, `loops`). A new top-level category is
  **silently ignored** by the generator, by `validate.sh`, and by CI's
  staleness check. Relevant to ADR-0016's expected "no".
- `scripts/install.sh:36-39` — one hardcoded skills-target path per
  client; MCP is print-only. A hooks category would need a new data
  structure, not a new row.

### Live verification of the MCP server
Tool enumeration of the pinned `@ansible/ansible-mcp-server@26.6.0`
returned exactly ten tools: `zen_of_ansible`,
`ansible_content_best_practices`, `list_available_tools`, `ansible_lint`,
`ansible_navigator`, `ade_environment_info`, `ade_setup_environment`,
`adt_check_env`, `create_ansible_projects`,
`define_and_build_execution_env`.

### The target repository (read-only)
`/home/armando.martires/SIGMA-infrastructure` — a mature ops workspace:
42 commits ahead of `origin`, 14 sprints, 8 ADRs, an ISO/IEC 20000-1
documented-information layer, a working `pre-commit` gate (`ruff`,
`pytest`, `ansible-lint`, `detect-secrets`, large-file check) and CI.
Files read: `AGENTS.md`, `ansible.cfg`, `.ansible-lint`,
`requirements.yml`, `inventory/production.yml`,
`playbooks/capture_pve_baseline.yml`,
`playbooks/report_pve_baseline_drift.yml`, `.pre-commit-config.yaml`,
`.github/workflows/ci.yml`, `.ai/20.PLAN.md`, `.ai/35.AD_HOC_TASKS.md`,
`docs/tooling/control-node.md`. It runs the `project-workflow` framework
(`S###_Sprint.T###_Task`, `00.CONVENTIONS.md`) — the framework this repo
publishes but does not itself run (ADR-0013).

## Findings that shape this plan

These are why the plan is not a transcription of the source analysis.
Each is a claim in that analysis, or in this repo, that failed contact
with a file.

### F1 — There is no staging inventory, and there cannot be one
`inventory/production.yml` is the only inventory; `ansible.cfg:8` points
at it directly. The managed estate is one 6-node PVE cluster running at
3-of-4 quorum with no verified margin, plus a single domain controller
holding all seven FSMO roles. `ci.yml:3-10` states the deliberate
consequence: CI has no route to `192.168.88.0/24` and no credentials, and
`tests/` is fixture-only for that reason.

The source analysis's central worked example —
`ansible-playbook --check --diff -l staging` then
`ansible-playbook -l staging` — is **unimplementable here**. The real
graduated workflow is `--check --diff` against production *plus PVE
snapshot and rollback*, which is already that repo's `AGENTS.md` "Change
safety" section. **This is the plan's most consequential correction:**
authoring the skill from the source text would have produced a runbook
gating on an inventory that does not exist.

### F2 — A documented, machine-checkable, explicitly unenforced hazard
`ansible.cfg:21-48` carries a capitalised warning: `ansible.builtin.setup`'s
default fact gathering collects `ansible_mounts`, which stats every mount
point including `/etc/pve`; on a node with wedged pmxcfs that stat is an
uninterruptible D-state FUSE hang, and `timeout` cannot kill it. The file
then records that the intended fix **does not work**: `gather_subset` is
rejected by `ansible-config validate` as an unknown `[defaults]` key, and
is silently ignored when set in inventory group_vars. It is a play-level
keyword and per-module argument only — there is no global mechanism in
ansible-core 2.20.8. It concludes:

> THE FIRST PLAYBOOK THAT TARGETS A PVE HOST MUST include
> `gather_subset: "!mounts"` … A code-review or CI check should confirm
> this before that playbook is trusted against a live node. **Tracked as
> unenforced until then.**

A written rule, with a node-hanging failure mode, that is statically
checkable and currently enforced by nothing. This is the strongest
available instance of "a skill says follow this process; a hook says it
cannot be bypassed" — and unlike the source analysis's examples, it is
checkable **without** depending on whether hooks can intercept MCP tool
calls. It is the highest-value deliverable in this plan.

### F3 — Four stale claims in the target repo
`.ansible-lint:4` and `.pre-commit-config.yaml:42` both assert the
workspace has no playbooks or roles yet; `ci.yml:44` says the same. Two
playbooks exist. `ci.yml:13` states "there is currently no GitHub remote
for this repo"; two remotes now exist (`github`, `gitlab`).
`requirements.yml:4-6` documents reinstallation with PowerShell/Windows
syntax (`$env:ANSIBLE_COLLECTIONS_PATH`, `.venv\Scripts\`) after ADR-0005
there moved all administration to Linux.

**Recorded as evidence, fixed nowhere** — decision 5 above. They matter
here only because they are the same "a claim decays between being written
and being acted on" class as this repo's own lesson 7, observed
independently in another repo, which strengthens the case for the skill
stating verification as an invariant.

### F4 — That repo's `ansible-lint` gate has never had content to lint
`profile: production` is set and `exclude_paths` covers `.cache/`,
`tools/`, `state/` — **not** `playbooks/`. So both playbooks should now be
linted by the hook and by CI. Whether they pass is **unverified**; the
gate was authored when nothing existed to check. Cheap to establish, and
it is the empirical basis for anything the skill says about linting.

### F5 — The MCP server exposes 2 of the 7 recommended capabilities
The source analysis's recommended MCP layer was "`ansible-doc`, linting,
syntax checks, inventory inspection, playbook preview, execution, and
verification." Against the live enumeration: **linting** and **execution**
are present. `ansible-doc`, discrete syntax check, inventory inspection,
`--check/--diff` preview, and verification are **absent**. The two
present are precisely the two destructive ones.

Worse for the recommendation's own contrast: `ansible_navigator`'s
parameters are `userMessage`, `filePath`, `mode`, `environment`,
`disableExecutionEnvironment`. There is **no inventory parameter, no
limit, and no `--check`/`--diff` passthrough**, so the safe workflow
cannot be expressed through it at all — while unsafe execution against
production can. And `userMessage` is a natural-language string the server
parses to locate the playbook, which undercuts the "deterministic command
invocation rather than inventing shell commands" claim: invocation is
LLM-message-parsed, not schema-pinned.

Hence decision 4. The control venv's own `ansible-playbook` strictly
dominates this tool for every safety-relevant purpose.

### F6 — This repo overstates its own blast radius
`server.json:22` describes `WORKSPACE_ROOT` as "the blast radius for the
destructive tools below." True for the filesystem tools; **false for at
least two of the five listed**. `ansible_navigator` runs playbooks against
remote managed infrastructure, which `WORKSPACE_ROOT` does not bound at
all; `ade_setup_environment` installs OS packages via dnf/apt/brew/pacman,
system-wide. The wording is restated in all three `configs/*/README.md`
destructive warnings. Same defect class this repo keeps catching, in this
repo, uncaught until now.

### F7 — Value ranking inverts relative to the source analysis
Given F1–F6, and that both existing playbooks are read-only
(`*_info` modules under a PVEAuditor token; the second runs on
`hosts: localhost`) with zero roles, zero custom modules, zero vendored
collections, and no `shell`/`command`/`raw` anywhere:

| Layer | Real value here | Why |
|---|---|---|
| Guard (F2) | **highest** | Written, unenforced, statically checkable, node-hanging failure mode |
| Skill | high | check+snapshot discipline, Vault/log hygiene, `forks=2` rationale, the Ansible-vs-Python boundary |
| Loop | moderate | Encodes the real gate sequence; short, because the surface is small |
| MCP | **low** | Both playbooks are read-only; `navigator` adds nothing safe and real risk |

## Phases / steps

Ordered so ground truth precedes decisions, decisions precede the
canonical shape, and enforcement lands last. This is S5's sequencing
lesson: enforcing a still-moving shape is how a check ends up written
against headings that then change.

### Phase 0 — Cheap truths and safety posture
`TASK-0026` (wiring correction + `navigator` disabled + LM Studio
corrected), `TASK-0027` (lint spike, on a `/tmp/opencode/` copy),
`TASK-0028` (hook-interception spike, non-blocking). 0026 is independent
of both spikes; the two spikes are independent of each other.

### Phase 1 — Decisions
`ADR-0014` (accept and narrow the MCP surface), `ADR-0015` (portable core
plus per-project templates; **check+snapshot, not staging promotion**),
`ADR-0016` (hooks as a category — expected "no", written only after
TASK-0028 reports).

### Phase 2 — Instruct layer
`TASK-0029` (`skills/ansible-ops/`), then `TASK-0030`
(`loops/ansible-change/`). The skill settles the vocabulary the loop
references.

### Phase 3 — The working guard
`TASK-0031` (the guard, with fixture proofs), then `TASK-0032` (record
the target-repo findings and state plainly what was left alone).

## Tasks generated

| ID | Depends on | What |
|---|---|---|
| TASK-0026 | — | Correct `WORKSPACE_ROOT` (F6); disable `ansible_navigator` in 3 snippets with reasoning (F5); re-record `authorization` for the narrowed set; LM Studio README → models-only |
| TASK-0027 | — | **Spike.** Lint the two real playbooks on a `/tmp/opencode/` copy; record output *and* what degraded; choose the guard's home |
| TASK-0028 | — | **Spike.** Whether Claude Code `PreToolUse` can match `mcp__ansible__*`; OpenCode's plugin equivalent. Non-blocking |
| ADR-0014 | TASK-0027 | Accept the pinned surface; record the 2-of-7 gap, the NL-parsed invocation, the `navigator` disablement |
| ADR-0015 | TASK-0027 | Portable invariant core + per-project `templates/`; the graduated workflow is check+snapshot (F1) |
| ADR-0016 | TASK-0028 | Hooks as a component category, or not. Expected: not |
| TASK-0029 | ADR-0015 | `skills/ansible-ops/` — core, `templates/`, `references/` |
| TASK-0030 | TASK-0029 | `loops/ansible-change/` — the real gate sequence with exit conditions |
| TASK-0031 | ADR-0016, TASK-0027 | The `gather_subset`/`ansible_mounts` guard + fixture proofs |
| TASK-0032 | TASK-0029 | Record F1–F4 as dated evidence; state what was deliberately left alone |

Backlog items: **B-010** (no instruct layer for the ansible MCP server),
**B-011** (the unenforced `gather_subset` guard), **B-012** (this repo
overstates its own blast radius), **B-013** (`ansible_navigator` cannot
express the safe workflow but can execute unsafely).

## Acceptance criteria

- [ ] `server.json` no longer claims `WORKSPACE_ROOT` bounds remote
      execution or system package installation; the per-tool reality is
      stated instead
- [ ] `ansible_navigator` is disabled in all three wiring snippets, each
      carrying the reason, and the `authorization` block reflects the
      narrowed set rather than the original five
- [ ] `configs/lm-studio/README.md` states models-only, no agentic work
- [ ] `skills/ansible-ops/SKILL.md` passes every ADR-0003 frontmatter
      rule; **no size budget is invented** (ADR-0008)
- [ ] `loops/ansible-change/loop.md` carries `## Trigger`, `## Steps`,
      `## Exit conditions`, with bounded retries and explicit
      escalate-without-retry for destructive actions
- [ ] The guard **is observed failing** on a deliberately broken fixture
      and on an ambiguous `hosts:` case, and observed silent on the two
      known-good playbooks. All four demonstrated, none asserted
- [ ] `tests/validate.sh` green; `scripts/sync-registry.sh` regenerated
      and the result committed
- [ ] `.ai/context/CURRENT_STATE.md` updated
- [ ] **`git status` in `/home/armando.martires/SIGMA-infrastructure` is
      byte-identical before and after S6**, and its 42 unpushed commits
      are untouched
- [ ] Every ADR records evidence read, not belief

## Risks

- **A skill nobody executes is scaffolding.** Under Option (a) the skill
  is authored *from* the target repo as evidence but never *run* there in
  S6. It therefore ends S6 in the same epistemic position as
  `mcp-servers/_template/`: plausible, unexercised. That is the honest
  price of clean repo ownership and should be S6's headline checkpoint
  finding, exactly as S5's untested cold-start claim was for REVIEW-0007.
  **Recorded now, at plan time, rather than discovered at review.**
- **The guard is heuristic.** `hosts:` can be a pattern, a variable, or a
  group-of-groups, so deciding "does this play target a PVE host"
  statically is imperfect. It must fail loudly on ambiguity rather than
  pass silently, and the fixture set must include an ambiguous case.
- **The guard is validated against syntax, not against the hazard.** The
  D-state hang is documented but not reproducible on demand. ADR-0016 and
  the guard's own source must say so: it proves a keyword is present, not
  that a node cannot hang.
- **A third framework.** ADR-0013 records two shipped skills scaffolding
  two deliberately different governance frameworks. `ansible-ops` is
  operational, not governance, and must not acquire a `.ai/`-shaped
  opinion.
- **Scope creep toward a Python MCP server.** Excluded by decision 1;
  ADR-0014 closes the door explicitly so it cannot be re-raised by the
  next reader who notices the 2-of-7 gap.
- **Planning prose is a hypothesis about files** (lesson 7). This plan
  already corrected six claims; assume it still contains one. Every task
  brief's Inputs table must be verified, not trusted, and F1–F6 must be
  re-checked against the files before being restated in an ADR.
- **Authoring an unfailable check** (lesson 8). Knowing the rule has not
  prevented it twice. The control is TASK-0031's fixture proofs, run
  before the guard is trusted, not the intention to be careful.

## Human decisions required

All resolved before this plan was written; recorded so the sequence shows
the decisions preceding the work.

| Question | Answer | Where it binds |
|---|---|---|
| MCP surface: accept, or author a Python server? | **Accept and document** | ADR-0014; ADR-0010 stays closed |
| Skill name | **`ansible-ops`** | TASK-0029 |
| Hooks in S6, or spike first? | **Spike first** (agent's preference, accepted) | TASK-0028 → ADR-0016 |
| Which clients? | **Claude Code + OpenCode**; LM Studio is models-only | TASK-0026 |
| Keep `ansible_navigator` enabled? | **No — disable it** | TASK-0026, ADR-0014 |
| Cross-repo governance | **Option (a)** — portable components only | TASK-0032, all Phase 3 |
| The 42 unpushed commits in the target repo | **Leave alone** | TASK-0032 acceptance |
| Guard vs. portable abstraction, if forced | **Working guard wins** | ADR-0016, TASK-0031 |
| Lint the target repo in place? | **No — copy to `/tmp/opencode/`** | TASK-0027 |

One decision was made by the agent and needs no ratification but is
recorded for traceability: **the two spikes are numbered task briefs**
(`TASK-0027`, `TASK-0028`) rather than a `SPIKE-####` artifact type,
because `tests/validate.sh:456-463` fails any file in `.ai/tasks/` not
matching `TASK-####-*.md`. Introducing a new artifact type would have
meant weakening the gate to accommodate a naming preference.
