# Roadmap

## Vision
A validated, indexed, versioned library of AI customization tools that
any agent or human can understand, trust, and deploy.

## Phase 1 — Foundation (complete, 2026-09-13)
- Objectives: scaffold structure; port existing components; validate
  install.sh for Claude Code.
- Milestone: first component installed and used in a real session — met
  (ansible MCP reached `✔ Connected` in a clean Claude Code install).
- Exit criteria: install, registry sync, and validate scripts pass; at
  least three components migrated. **Met** (2 skills + 1 MCP server).
- Note: the objective also named porting *loops*. No first-party loop
  artifact existed anywhere to port — see ADR-0006. Loops are authored
  instead, in Phase 2.

## Phase 2 — Multi-client deployment (complete, 2026-09-13)
- Objectives: OpenCode and LM Studio sync targets; configs/ snapshots;
  first loop component authored; MCP servers verified by a harness rather
  than by hand.
- Exit criteria (restated per ADR-0006 — the original "one skill and one
  MCP server working in all clients" was unmeetable, because LM Studio
  has no Agent Skills target):
  - One skill deployed and working in **every client that supports
    skills** — Claude Code and OpenCode. *Met* (TASK-0006).
  - One MCP server wired and verified in **all three** clients. ***Met*** —
    completed retroactively 2026-09-13 by TASK-0017: Claude Code
    `✔ Connected`; OpenCode in live use; LM Studio now verified in its own
    UI (server active in chat, tools enumerated by a loaded model), not
    merely at config + handshake level.
  - `configs/<client>/README.md` complete for every client. *Met*.
  - At least one loop component exists and is exercisable. *Met*
    (`loops/release-check`, TASK-0008).
  - MCP server startup verified by a repeatable check, not manual steps.
    *Met* (`tests/smoke-mcp.sh`, TASK-0009).
- Closed 2026-09-13 with one known gap, recorded not counted: LM Studio's
  ansible server was unverified in the app's own UI (needs the GUI launched
  interactively) — a client-side manual step, not repo work. See
  REVIEW-0004.
- **That gap is now closed (TASK-0017), so Phase 2 has no outstanding
  criteria.** It took a written procedure (TASK-0016) before the human could
  act on it — the gap survived three sprints as a candidate-list bullet and
  was closed within a day of becoming a documented procedure. The lesson is
  about the form of the record, not the difficulty of the work.
- The verification also *found* something, which is the argument for doing
  it rather than assuming it: `WORKSPACE_ROOT` was still the unreplaced
  placeholder, and the server connected and enumerated all its tools anyway.
  A green connection is not a validated configuration.

## Phase 3 — Automation (complete, 2026-09-13)
- Objectives: automated validation in the commit flow; registry staleness
  detection.
- Exit criterion, restated by ADR-0007 from the original "wired into CI or
  pre-commit": **`tests/validate.sh` runs automatically before every
  commit.** *Met* — `.githooks/pre-commit`, activated by
  `scripts/install.sh` (TASK-0010).
- Why restated: the original presumed CI, and therefore a remote. This
  repo has none, and the human rule is that local git is mandatory while a
  remote is only recommended (ADR-0007). A CI-only gate would have run
  nowhere while satisfying the criterion's wording.
- Also delivered: `scripts/sync-registry.sh` de-duplicated and a
  registry-staleness check added, closing a defect that had recurred three
  times (TASK-0011).
- CI ships as `.github/workflows/validate.yml`, **inert and unverified** —
  no remote exists to run it. Labelled as such rather than presented as
  working.
- Pattern worth remembering: ADR-0005, ADR-0006 and ADR-0007 all exist
  because a criterion written at scaffold time met reality and lost. Check
  a phase's assumptions against the environment before committing to them.

## Phase 4 — Closing the open loops (complete, 2026-09-13)
- Objective: close every backlog item that is actually closeable, and for
  the ones that are not, replace the perpetual "candidate" listing with
  either a decision or a documented human-action procedure. The defect
  being fixed is *process*, not code: B-002 sat `ready` for three sprints
  and two items recycled through three consecutive candidate lists,
  because nothing distinguished "not yet done" from "cannot be done by an
  agent".
- Exit criteria:
  - Skill linting enforces the rules that are actually defined. *Scoped
    to frontmatter only* — the originally-imagined "line budget" half had
    no threshold defined anywhere in the repo, so enforcing one would
    have meant inventing a requirement (TASK-0012, ADR-0008).
  - A `LICENSE` file exists, backing the `license: MIT` that both shipped
    skills already declare in frontmatter (TASK-0013).
  - `install.sh` warns about the `core.filemode=false` hook trap at the
    moment someone is most likely to hit it (TASK-0014).
  - Required environment variables are documented and validated, and the
    git remote is wired from them (TASK-0015, ADR-0009).
  - Every remaining gap that needs a human has a written procedure in
    `docs/operations/`, not a roadmap bullet (TASK-0016).
- Deliberately **not** in scope: authoring a Python MCP server purely to
  exercise that shape. `SPRINT-CURRENT.md` warned it "needs a real reason
  … not a synthetic one"; see TASK-0016 and ADR-0010 for the standing
  decision rather than a fourth candidate-list appearance.
- Outcome: all five exit criteria met; sprint S4 closed 2026-09-13,
  checkpoint REVIEW-0006. B-001, the last open item, was closed
  post-sprint by TASK-0018 as *superseded* (ADR-0011) — emptying the
  backlog for the first time. The header above read "in progress" until
  S5's planning session corrected it; every criterion had been met and
  the status line simply lagged.
- Pattern this phase was created to fix: an item can sit in a candidate
  list for sprints looking blocked when it is merely **undocumented**. The
  git remote was the clearest case — the credentials had been in the
  environment the entire time; nothing said so. Before carrying an item
  forward again, check whether it is actually blocked or just unwritten.

## Phase 5 — Session handover contract (complete, 2026-09-13)
- Objective: make every task resumable in a brand-new session. The
  `project-workflow` skill's task template names what a task *does* but
  never what it consumes or hands on, so a task file cannot be picked up
  cold — while the skill simultaneously presumes multi-session work in
  three separate places without ever stating a session boundary.
- Planned by `PLAN-0002`; decisions in ADR-0012. Sprint S5, tasks
  TASK-0020…0023.
- Exit criteria:
  - The skill states a session boundary rule and a cold-start read order
    — neither of which it states anywhere today (TASK-0020).
  - `00.CONVENTIONS.md` is back **under** its own declared ≲3 KB budget,
    measured. It is 3087 bytes today, and nobody had checked (TASK-0020).
  - The skill's task template names both what a task consumes and what
    the next task inherits; `metadata.version` → `3.1.0` with the
    deployed copy re-synced and verified (TASK-0021).
  - This repo's `.ai/templates/TASK.md` carries the same contract with
    **no net growth in section count** — a merge of four existing
    sections, not an addition of two more (TASK-0022).
  - `validate.sh` detects a deleted or empty handover section, is proven
    to fail for the right reason, and is honest in its own source about
    what it does not prove (TASK-0023).
- Deliberately **not** in scope: retrofitting TASK-0001…0019. They are
  records of what happened; a brief written retroactively to look tidy is
  not compliance (ADR-0012 Decision 4). The `≥ 0020` boundary encodes
  this in the check itself.
- Outcome: all five exit criteria met and independently re-verified;
  sprint S5 closed 2026-09-13, checkpoint REVIEW-0007. Commits
  `c240f02`, `0f36d66`, `cdedb45`, `7106f9c`.
- **What this phase set out to test, and could not.** The question was
  whether file-based handover makes a cold session cheap. All four tasks
  ran in **one** session, so every `Inputs` table was written and read by
  the same context that produced it. The contract is proven writable, and
  proven to catch stale declarations *within* a session — four times, see
  below. It is **not** proven to make a cold start cheap. That remains a
  hypothesis with supporting mechanism (REVIEW-0007, finding 8).
- What the phase did prove, unplanned: **the convention caught a defect
  in all four of its own tasks, and the check it built caught none of
  them.** A stale symlink claim, a false premise in ADR-0012, a
  four-section merge that would have destroyed 82 lines of narrative, and
  an escape hatch in the new check itself (`.ai/tasks/completed/`). Each
  found by opening the file named in a declaration rather than trusting
  it. Three of the four claims had been written by the same agent one
  session earlier — the defect is claim decay between writing and acting,
  not carelessness.
- Standing caution from this phase: the value delivered was the
  verification discipline, not the enforcement. A future sprint that
  keeps the gate and drops the read-order step keeps the part that found
  nothing.

## Phase 6 — Ansible agent guardrails (COMPLETE 2026-09-22)
- Objective: add the **instruct layer** the `ansible` MCP server has
  lacked since S1 — nothing tells an agent how or when to use it, what the
  estate's workflow is, or which actions need approval — correct two false
  claims in this repo's own MCP wiring, narrow that server's blast radius,
  and ground it all in evidence read from a real Ansible repository
  without modifying it.
- Planned by `PLAN-0003`; decisions ADR-0014…0016, bodies written
  2026-09-16 and **all three Accepted 2026-09-22** (`TASK-0054`), ratified by
  the human in answer to `REVIEW-0010`'s ratification packet. Sprint S6, tasks
  TASK-0026…0032 plus TASK-0052. Raised B-010…B-013.
- **This section was written on 2026-09-15, by TASK-0033, one sprint
  late.** The roadmap had no Phase 6 at all: S6 existed in
  `SPRINT-CURRENT.md`, `TODO.md`, `CURRENT_STATE.md` and `PLAN-0003`, but
  never here. That is the same roadmap-drift REVIEW-0007 caught for
  Phase 5 (its header still read "in progress" after completion),
  recurring one phase later — which is evidence for that review's own
  finding 6: **the lesson needed a mechanism, not more prose.** No
  mechanism was added then, and the omission repeated. Recorded rather
  than quietly backfilled.
- Exit criteria — ~~none met; the sprint was parked before implementation
  began~~ **ALL FIVE met as of 2026-09-16**; each is marked below. Wording is
  otherwise as written on 2026-09-14. **What remains for the phase is not an
  exit criterion but a judgment**: ratifying the three ADRs and writing the
  checkpoint. **Both are done. `REVIEW-0010` (2026-09-22, verdict approve)
  is the checkpoint, and the human ratified all three ADRs the same day, so
  the phase is COMPLETE.** Its four follow-ups are the review's and outlive
  the phase: the gate's undecided budget, a moved `ansible-core` version
  recorded nine times, whether anything re-checks external claims, and
  `skills/ansible-ops/` still unexercised against a live estate.
  - **MET** — `server.json` no longer claims `WORKSPACE_ROOT` bounds remote
    execution or system package installation (TASK-0026). It now carries a
    `workspace_root_bounds` key splitting `bounded` from `not_bounded` per
    tool. **The criterion named only `server.json`; the claim was in six
    places**, including this repo's own operations runbook.
  - **MET** — `ansible_navigator` disabled in all three wiring snippets with
    the reason, and `authorization` re-recorded for the narrowed set
    (TASK-0026), as a `history` array preserving the original five-tool
    grant. **With a stated limit: the disablement is advisory**, since this
    repo cannot switch off a tool in the upstream server.
  - **MET** — `skills/ansible-ops/` and `loops/ansible-change/` exist and pass
    the gate (TASK-0029, TASK-0030) — delivered by Phase 7's pilot.
  - **MET 2026-09-16 (TASK-0031), including the amendment below.** The
    `gather_subset`/`ansible_mounts` guard is **observed failing** on
    a broken fixture and on an ambiguous `hosts:` case, and observed
    silent on the two known-good playbooks (TASK-0031).
    **Met beyond the wording:** the *real* playbook was flipped to
    `gather_facts: true` in a `/tmp` copy and the guard fired naming
    `sigsrvpve1`, resolved through the real nested inventory — so the
    silence on the unmodified playbook is discriminating rather than
    inert, which is the gap D2 identified. A fires-proof ships
    (`tests/gather-subset-guard.sh`, 10 checks) with a negative control
    reproducing the `enable_list` silent-no-op trap.
    **Amended 2026-09-16 (D1/D2/D3):** this criterion as written is
    insufficient — all three of its cases pass for a guard that resolves no
    hostnames. It now additionally requires the guard **observed failing**
    on a PVE node addressed by **bare hostname** with `gather_facts: true`,
    and on a `module_defaults` block scoped to a non-`setup` target. Seven
    fixtures, not five.
  - **MET SO FAR** — `SIGMA-infrastructure`'s `git status` byte-identical
    before and after (all tasks). Verified at every task boundary on
    2026-09-16: empty both times, `HEAD` `d4e2dd1`, `[ahead 42]` unchanged,
    and its `ansible.log` mtime still `2026-09-12 16:15:01`. **`TASK-0027`
    found the real risk was not what the brief guarded against**:
    `ansible-lint` writes `ansible.log` into its working directory with no
    flag at all, so an in-place lint run would have written to the target
    repo. The copy-not-in-place decision is what prevented it.
- Status: **UN-PARKED 2026-09-16 by `TASK-0052`; this phase is current
  again** (human decision: finish S6 before S8). Restored to
  `.ai/planning/SPRINT-CURRENT.md`; **Phase 8 is re-queued.** Un-parking
  cost nothing for the same reason parking did — **S6 had zero
  implementation of its own at the moment it was un-parked.** That is no
  longer true: `TASK-0026` is the phase's first real implementation, so a
  second park would now cost reconciliation. Recorded because the original
  parking note made exactly this prediction.
  - ~~Outstanding: **ratification of the three ADRs, and a checkpoint**~~ —
    **both delivered 2026-09-22.** **All seven S6 tasks are done as of
    2026-09-16**: `TASK-0026`, both spikes (`0027`, `0028`), `0031`, `0032`,
    plus `0029`/`0030` delivered by Phase 7's pilot; and all three ADR bodies
    are written.
    **Three backlog items closed by S6's own execution:** B-012/B-013
    (`TASK-0026`) and **B-011 — the highest-value item in either sprint —
    by `TASK-0031`**, whose guard is delivered *and proven to fire*. **B-010 is
    closed too**, by Phase 7's pilot, so **all four of this phase's backlog
    items are now closed** — the first fully-cleared slice in this repo. B-010
    is closed **with its limitation stated**: components authored *from* the
    target estate, never executed *in* it.
    **`TASK-0031` also falsified `TASK-0027`'s own recommendation**: per-rule
    configuration in `.ansible-lint` is a **fatal** error for a custom rule
    (`additionalProperties: false`, exit 3), so the "declarative wiring
    tiebreaker" does not exist and configuration is by environment variable —
    a recorded downgrade, since rule config now sits outside the committed
    lint config. `TASK-0026` closed B-012/B-013 and found the false
    blast-radius claim in **six**
    places rather than the four its brief predicted, the extras being
    `docs/operations/runbook.md` and a *lessons* list. It also **declined one
    of its own acceptance criteria**: the "LM Studio supplies models only"
    statement is refuted by `ADR-0020`, so re-adding it would have restored a
    known-false claim. `TASK-0029`/`0030` are
    **done, delivered by Phase 7's pilot** — the sprint table said `planned`
    while both task files said `done`, corrected on the first read (the
    four-files-disagree class `REVIEW-0008` swept for Phase 7).
  - **ADR-0014/0015/0016 — bodies written 2026-09-16, all three Accepted
    2026-09-22.** Written from the spikes' observed evidence,
    explicitly **not** filled from `PLAN-0003`'s prose — that is how they
    reached skeleton state. **Two were retitled because the evidence
    contradicted their planned titles**, which is the substantive output of
    writing them at all:
    - **`ADR-0015`**: "portable core plus per-project `templates/`" is
      **refuted**. `install.sh:105` symlinks a deployed skill, so
      fill-in-place would write one estate's production facts into the
      portable component. The shipped skill chose **derive per change,
      persist nothing**. `templates/` survives for **copy-out** artifacts
      holding no estate facts. Its *filename* still names the rejected shape,
      deliberately, per `ADR-0017`'s precedent.
    - **`ADR-0016`**: still "no category", but **not** for the anticipated
      reason. Hook interception **works in both clients** — the opposite of
      the expected "no". What declines it is that the two clients
      **disagree on the tool's name**
      (`mcp__ansible__zen_of_ansible` vs `ansible_zen_of_ansible`), so no
      portable artifact can even match the same string.
  - **Both spikes inverted their own briefs, and each changed a downstream
    decision:**
    - `TASK-0027`: the target repo's gate **passes** on its two real
      playbooks — 0 failures across **53 rules**, exit 0 — the first run
      against real content since S004.T007 left it live and unproven. Guard's
      home: a custom `ansible-lint` rule via `enable_list:`, **conditional on
      a fires-proof**, because a rule outside the active profile is **loaded,
      listed and never evaluated at exit 0**. The honest answer needed four
      runs; the first was silent, which alone reads as "custom rules don't
      work".
    - `TASK-0028`: interception verified — Claude Code **documented-only**,
      OpenCode **observed live** (a probe blocked `ansible_zen_of_ansible`,
      then was reverted and the revert verified two ways). Recorded as
      could-not-determine rather than guessed: OpenCode's naming under
      `experimental.codeMode`, where per-tool hooks are not registered at all.
  - **Three independent mechanisms in this phase can each be installed and
    inert** — an `ansible-lint` rule outside its profile, a Claude Code
    matcher missing its `.*`, and OpenCode under `experimental.codeMode`.
    That is the phase's most transferable finding and it binds `TASK-0031`.
  - **`REVIEW-0009` is already reserved by Phase 8.** This phase's
    checkpoint must take the next free number.
  - B-010…B-013 stayed **ready** through the transition — nothing was resolved
    by it. **All four have since been closed** by the phase's execution (and,
    for B-010, by Phase 7's pilot).
- **Four defects were found in this phase's own remaining plan before it
  resumed** (`TASK-0052`), all bearing on the guard, all by opening the
  files the briefs name (lesson 7):
  - **D1:** the guard matched "PVE-class" by **group name**, but the
    estate's one PVE playbook uses `hosts: sigsrvpve1` — a **bare
    hostname**. Detection must resolve host→group membership from the
    inventory.
  - **D2:** the "two real playbooks → guard silent" acceptance criterion is
    satisfied equally by a correct guard and by a D1-afflicted guard that
    classifies nothing. **Five green fixtures would have proven nothing.** A
    sixth is now required — PVE host by bare hostname, `gather_facts: true`
    → must fail. **This is lesson 8's third instance**, and it was in the
    fixture design of the task written to avoid it.
  - **D3:** a `module_defaults` check matching the key rather than its
    `ansible.builtin.setup` entry would have over-accepted the real
    playbook, whose block is scoped to
    `group/community.proxmox.proxmox`. Seventh fixture added.
  - **D4:** `ansible-lint` is at `~/.venvs/sigma-ansible/bin/` and not on
    `PATH` — there is no venv in the target repo. Version `26.8.0` /
    `ansible-core 2.20.8` confirmed by running it.
  - The common cause: the plan was written from `ansible.cfg`'s prose,
    which is accurate about the hazard, **without opening the playbook the
    guard must classify.** The hazard was verified; the subject was not.
- **Phase 7 delivers two of this phase's artifacts.** `TASK-0046` produces
  `skills/ansible-ops/` and `loops/ansible-change/` *through* Phase 7's
  new design and build loops, as the pilot that proves those loops work.
  So this phase's highest-value item (TASK-0031, the guard) remains
  outstanding while its instruct layer arrives by another route.
- Limitation recorded at plan time and still true: under Option (a) the
  skill is authored *from* the target repo but never executed *in* it, so
  it would end the phase as unexercised scaffolding — the status
  `mcp-servers/_template/` already carries. Phase 7's pilot is a partial
  answer to that, since producing a component through a loop at least
  exercises the loop.

## Phase 7 — Design and production agent loops (complete 2026-09-16)
- Objective: build a two-stage agent system — an **interactive design
  stage** that converges a project idea into an accepted, locked brief,
  and a **largely autonomous production stage** that carries that brief
  through plan, implement, test, review and document. Make `agents/` a
  real component category so the roles involved are enforced rather than
  unpoliced text.
- Planned by `PLAN-0004`. Sprint S7, tasks TASK-0033…0046. Raised
  B-014…B-017. Decision status, **kept current here rather than left to
  drift** (lesson 6 has recurred three times in this file's own history):
  **ADR-0019 accepted** 2026-09-15 (ratification, no spike needed);
  **ADR-0018 accepted** 2026-09-15 on TASK-0036's evidence, with clause 2's
  reasoning replaced and a new clause 8; **ADR-0017 REJECTED** 2026-09-15
  (human decision) — TASK-0034 disproved its premise, so `agent-tiers`
  **stays with `opencode-customization`**. It is this repo's **first
  `Rejected` ADR**, and it carries a 3-condition reopen trigger plus the one
  gap the rejection creates (no `{tier:}` resolver here).
- **Closed by `REVIEW-0008` (approve), 2026-09-16.** All five phases
  complete: **13 tasks done**, TASK-0035 cancelled. Commits
  `9105246..ff212dd`. This line read *"eleven of the sprint's tasks"* until
  closure — true when written, decayed by the two tasks that followed
  (lesson 6 again, the **sixth** instance in this file's own history), and
  it was one of three files disagreeing about the count. **The
  pre-committed question is answered YES**: the pilot ran, and REVIEW-0008
  re-verified it from artifacts rather than task logs — the gate rejects a
  broken real role, the registry indexes six, nine files are emitted across
  two clients with the three OpenCode-only roles **skipped** rather than
  degraded, and the brief's lock is a dedicated commit.
  **Three findings on the record:** `validate.sh` left its sub-second
  budget (622→960 ms across S7 on like-for-like measurement, ~1150 ms at
  review time); four tasks including the pilot left **no session record**;
  and `qa-test` **cannot run tests**, now tracked as B-021.
  **Phases 1–4 built** two loops and six roles, all gated, indexed and
  emitted; **Phase 5 exercised all of it.**
  **Phase 1 closed with its reclamation withdrawn, not delivered**
  (ADR-0017 rejected): the spike meant to prepare the claim is what stopped
  it, which is the ordering principle earning its place rather than failing.
  **Phase 2's plumbing is no longer unexercised** — TASK-0043 authored three
  real roles through it: the gate passed on real content, the registry
  populated, and six client files were emitted and **inspected**.
  **Only TASK-0046's pilot remains.** Both loops' role sets now exist, so
  both are executable for the first time — and **neither has been run**.
  That is exactly the state the standing caution below describes and
  REVIEW-0008's pre-committed question was written for: everything is in
  place, and nothing is evidence yet.
- The second phase in a row planned from a **human-supplied analysis**
  rather than a backlog item. Eight of its claims were corrected before
  planning finished, against six in Phase 6. The three that reshaped the
  plan: half the production stage already exists unowned and switched off;
  agent definitions are **not portable** between clients; and Claude Code
  dynamic workflows cannot accept mid-run user input, so they cannot run
  an interactive design stage and are excluded.
- Exit criteria:
  - ~~`skills/agent-tiers/` exists in this repo, its drift resolved and
    recorded, version bumped, and the installed copy is a **symlink**
    rather than the real directory it is today~~ — **DROPPED 2026-09-15.**
    The criterion rested on a false premise: `agent-tiers` is not orphaned.
    `opencode-customization` kept it deliberately on 2026-09-13 with a
    stated reason and an unpulled reopen trigger (TASK-0034), and the human
    decided it **stays there** (ADR-0017 rejected, TASK-0035 cancelled).
    Dropped rather than left struck through as pending, because a tick-box
    invites someone to satisfy it by importing against another repo's
    recorded decision. **Replaced by the criterion below.**
  - **The three production roles exist as `agents/<role>/agent.md`**,
    authored under ADR-0018 with the `agent-tiers` copies read as reference,
    their boundaries proven in emitted output per client, and
    `git-ops`/`shell-runner` recorded **OpenCode-only** (TASK-0045).
    **Met 2026-09-15**, and the "proven in emitted output" clause earned its
    place: diffing emitted files against the references fact by fact found
    **two emitter defects** a read-through would have passed — alphabetical
    glob ordering downgrading `git push --force` from deny to **ask**, and
    `no-force-push` omitting `git clean -f*`. `shell-runner` was **not
    authored**: no loop step references it. The
    drift question is closed as *answered and not this repo's to resolve*:
    repo copy newer for both files, no unique fix installed-side, all four
    model IDs resolving (TASK-0034).
  - ADR-0018 records the per-client agent mapping, the emission
    mechanism, and **explicitly** that agents have no `link` mode and
    why — with the further note that no freshness check is possible
    (ADR-0009) and adding one would break every clone. **Met
    2026-09-15**, and it records two things the criterion did not
    anticipate: the superset alternative is rejected on an **observed
    safety failure** (an OpenCode `permission:` block is silently
    discarded by Claude Code, leaving the denied tools in the pool), and
    **five of eight capability terms are OpenCode-only**, making
    `git-ops` and `shell-runner` OpenCode-only roles.
  - `agents/` is a real category: template, a normative schema in
    `authoring-guide.md` written **before** enforcement, `validate.sh`
    checks **observed failing** on malformed fixtures, a generated
    registry section, and an `install.sh` emission path (TASK-0037…0040).
    **Met 2026-09-15**, every clause including the hard one: 17 checks each
    observed failing on a fixture violating exactly that rule, plus a valid
    control so the group is proven not to fail unconditionally. Note what
    the criterion does **not** require and therefore does not certify —
    that any of it has been exercised by a real role. ~~It has not.~~
    **It has, as of TASK-0043 (2026-09-15)**: three real roles authored,
    the gate passed on real content, the registry populated, six client
    files emitted and inspected, and `critic` proved read-only at runtime in
    both clients. What remains unexercised is the **loop**, not the
    plumbing — TASK-0046.
  - `loops/design-brief/` and `loops/project-build/` both carry a bounded
    iteration count and an explicit escalation path in
    `## Exit conditions` (TASK-0041, TASK-0044). **Met 2026-09-15.**
    `project-build` needed **three** bounds rather than two: the fix cap
    (3 `qa-test` failures), the review path that deliberately does *not*
    consume it, and — found while separating those — a bound on the review
    path itself, which no source supplied and which was otherwise unbounded.
  - ADR-0019 records the autonomy boundary against the four `AGENTS.md`
    rules it collides with, and records dynamic workflows as rejected with
    the vendor's own constraint quoted.
  - **The pilot ran**: `skills/ansible-ops/` and `loops/ansible-change/`
    were produced *through* the loops, with the execution log recording
    where each loop's exit conditions actually fired (TASK-0046).
- Known limitation, recorded at plan time: this phase adds two loops, one
  skill, **six** roles and a component category — `design-doc-writer` was
  declined by TASK-0041, which found the loop gives it nothing to do, and
  this line read "seven" until TASK-0036's session corrected it. **If the
  pilot does not
  run, all of it is scaffolding** — and the phase would have diagnosed
  that exact pattern in `agent-tiers` while reproducing it. Third instance
  of the pattern `mcp-servers/_template/` established. Hence REVIEW-0008's
  headline question is fixed in advance: *did anything get exercised?*
- Standing caution: Phase 2 of the plan (`agents/` plumbing) has no
  user-visible output and is the most skippable-looking work in the
  sprint. ADR-0016 already recorded what "later" has meant for `agents/`
  and `prompts/`: indefinitely. If the sprint shrinks, the honest cut is
  role reconciliation, never the plumbing and never the pilot.

## Phase 8 — Third-party agent extensions (COMPLETE 2026-09-23)

> **Closed 2026-09-23 on `REVIEW-0009`, with `ADR-0021` ratified as
> written.** Archived at
> `.ai/planning/sprints/SPRINT-S8-third-party-extensions.md` — **the path
> this section predicted**, which matters because the paragraph below has
> been wrong twice in opposite directions about where the file lives.
> Archiving to exactly that path makes the prediction true instead of adding
> a third correction.
>
> **All seven exit criteria met. Four are mechanically verifiable**, not
> asserted from a log:
>
> | Exit criterion | Evidence |
> |---|---|
> | `ADR-0021` ratified or rejected **on evidence** | **Ratified as written, 2026-09-23**, after `TASK-0048` overturned two of its three falsifiable claims. Ratification covers the Decision clauses; the falsified Context claims stay as written |
> | No `plugins/` directory; no new-category plumbing | **Mechanical:** no such directory exists, and `git diff feba3e0..HEAD -- scripts/install.sh scripts/sync-registry.sh tests/validate.sh` is **empty** |
> | Nothing vendored | **Mechanical:** the same diff over `skills/ agents/ loops/ prompts/` is **empty** |
> | graphify's manifest pinned, gate-valid, **observed failing** when broken | **Mechanical:** three deliberate breaks each produced their specific message; restore md5-verified |
> | `smoke-mcp.sh` returns PASS or SKIP for graphify, corrected outcome **observed** | **Both observed** — SKIP in the shipped state, PASS with a graph present. And the verification found `B-022` |
> | Every capability claim labelled *vendor doc* or *observed* | Done across three `configs/` sections and `third-party-tools.md`. `REVIEW-0009` finding 2 notes the label's limit: it records provenance, not which artifact |
> | Placement rule findable in the authoring guide, linking not restating | `docs/development/authoring-guide.md`, `## Placing a third-party extension` |
>
> **Backlog:** `B-019` and `B-020` closed — the sprint cleared its own
> slice, the second phase to do so. It also raised **and closed** `B-022`
> inside one task, and left `B-023` behind.
>
> **The prose-heavy outcome predicted at plan time did materialise** — two
> of three deliverables are documentation, the fourth instance of that
> pattern. The defence pre-committed against it (*"the honest cut is a
> product, never the spike"*) was **never exercised**, because nothing had
> to be cut. Recorded as an untested commitment rather than a vindicated
> one.
>
> **Phase 9 now exists below**, added 2026-09-23 by `TASK-0077` **in the same
> commit that promoted S9** — which is the whole point. This block used to say
> no Phase 9 existed and that whoever promoted the sprint had to add one here
> in the same change, because this file has had two phases go missing after
> the fact. There is still no *mechanism* enforcing that (`tests/validate.sh`
> has no roadmap/sprint agreement check and is not getting one — it is a
> judgment call), so the **atomic commit was the control**. Verify it with
> `git show --stat` on that commit if you doubt it.

*Everything below is the section as written at plan time.*

### Phase 8 as planned (CURRENT 2026-09-22, not started)

**This section was written at plan time, in the same change as
`PLAN-0005`.** The roadmap has now had two phases go missing from it —
Phase 5 was left reading "in progress" after completion (caught by
REVIEW-0007), and Phase 6 ran an entire planning cycle while this file
skipped from Phase 5 straight to Risks (caught by S7's planning). Both were
diagnosed as needing a *mechanism*; none was added, and it recurred. This
is a habit, not a mechanism, and it will fail the same way if the habit
lapses.

Planned by `.ai/planning/plans/PLAN-0005-third-party-agent-extensions.md`.
Sprint file: **`.ai/planning/sprints/SPRINT-S8-third-party-extensions.md`** —
**re-queued there 2026-09-16 by `TASK-0052`**, because the human chose to
un-park S6 and finish it first. It was briefly current after `REVIEW-0008`
closed S7.

**Re-queued is a third state, distinct from parked and closed:** this sprint
was promoted and then un-promoted **before doing any work**, so it gets no
checkpoint — there is nothing to check. All four briefs and `PLAN-0005` are
**unmodified**, and **B-019/B-020 stay `ready`** (re-queuing does not
un-scope a backlog item, the same rule that held B-010…B-013 through S6's
park). Re-queuing cost nothing because zero components had changed.

**This paragraph has now been wrong twice, in opposite directions**, which is
worth more than the correction itself. It first named a `sprints/` path and
said S8 was deliberately not current; then it named `SPRINT-CURRENT.md` after
promotion; now it names `sprints/` again. It also once said S7 had **six**
tasks (13 done, 1 cancelled). **A path recorded in prose is a claim that
decays every time the thing moves** — and this file cannot detect that
(`validate.sh` checks section presence, never whether a path assertion still
resolves).

**Decision status:** `ADR-0021` **proposed**. Ratification waits on
TASK-0048's evidence, per the ordering S7 established.

### Goal

Place three human-requested third-party extensions in the category each one
actually belongs to, cross-client where a client genuinely supports the
capability — without a new component category, without plumbing changes,
without vendoring, and without auto-installing anything.

- **graphify** → `mcp-servers/graphify/server.json`. The only one of the
  three that becomes a real, pinned, indexed component.
- **ponytail** → per-client wiring in `configs/*/README.md`.
- **omniroute** → **out of the component layer** (human decision,
  2026-09-16); one entry in a new `docs/development/third-party-tools.md`.

### Exit criteria
- `ADR-0021` ratified or rejected **on evidence**, not on agreement.
- No `plugins/` directory; no new-category plumbing in `install.sh`,
  `sync-registry.sh` or `validate.sh`.
- Nothing vendored into `skills/`, `agents/`, `loops/` or `mcp-servers/`
  from any of the three.
- graphify's manifest pinned, gate-valid, and **observed failing** when
  deliberately broken.
- `smoke-mcp.sh` returns PASS or SKIP for graphify — never a FAIL caused by
  an unmet precondition — with the corrected outcome *observed*.
- Every capability claim labelled *vendor doc* or *observed on <date>,
  <version>*.
- The placement rule findable in the authoring guide, linking to the ADR
  rather than restating it.

### Notes
- **The premise needed correcting before it could be built — the third
  sprint in a row.** The request named three things with one word;
  "plugin" turned out to name three unrelated mechanisms. ADR-0006's
  per-capability scoping applies directly.
- **Two upstream claims were falsified before the sprint began**, both by
  reading source rather than READMEs: graphify's README contradicts its
  own `src/cli.ts` about OpenCode, and `src/serve.ts:188-195` shows
  `graphify serve` exiting 1 without a pre-existing graph. Hence the spike
  runs first, and hence a spike that finds nothing should be read as weak
  rather than reassuring.
- **Two of three deliverables are prose.** Fourth instance of the class
  `mcp-servers/_template/` established (ADR-0010) and `agents/`/`prompts/`
  repeated (ADR-0016). Ordering is the only defence: the spike makes the
  prose *verified* rather than transcribed. **If the sprint shrinks, cut a
  product, never the spike.**
- **The sprint also found a latent defect in this repo's own harness**
  (B-020), not in a third party: `smoke-mcp.sh` cannot distinguish an unmet
  precondition from a protocol failure, which affects any future server
  with state requirements.

## Phase 9 — Unattended runs: the decision and the portable core (COMPLETE 2026-09-23)

> **Closed 2026-09-23 on `REVIEW-0011`** (`TASK-0081`), archived at
> `.ai/planning/sprints/SPRINT-S9-unattended-runs.md` — the path this section
> predicted. **All seven exit criteria met**, and the order in which the last
> one was met is the point: `REVIEW-0011` found **criterion 7 unmet** and
> recommended fixing it *before* closure rather than closing over it.
> `TASK-0080` did. A sprint that closes over its own unmet criterion teaches
> the next sprint that criteria are advisory.
>
> | Exit criterion | Evidence |
> |---|---|
> | 1 — `ADR-0022` ratified on evidence | **`Accepted` 2026-09-23** (`TASK-0076`), after both spikes ran. **F1 was falsified**, adding clause 5 — what was signed is *more* cautious than the draft |
> | 2 — the `mode` question decided **explicitly** | **`mode: all` rejected** (`TASK-0058`), three reasons and a reopening condition. `MODES` unchanged; the gate now refuses `all` **by name** rather than as a typo |
> | 3 — `worktree-only` settled **or** explicitly recorded open | **Recorded open**, with the reason (`TASK-0056`'s run was confounded) and the one question that settles it |
> | 4 — registry shows client coverage | **Mechanical:** `\| Name \| Clients \| Description \| Path \|`; eleven of fifteen rows read `opencode` |
> | 5 — loop authored **before** the roles | **Mechanical, in `git log`:** loop `e28e2da` → thinking roles `02c1cb2` → acting roles `69e6eb2` |
> | 6 — nine roles emit; emission **refuses** when widened | **Mechanical:** `opencode` exit 0/15 files, `claude-code` exit 0/4 files with five skipped. Refusal observed **twice**, exit 1, no file written |
> | 7 — asymmetry stated in the skill **and all three snapshots** | **Not met at checkpoint; met by `TASK-0080`.** Each snapshot now names its own coverage: Claude Code two of nine, OpenCode all nine, Bionic **zero** |
>
> **The sprint's defining finding: the false-boundary defect class appeared
> four times** — `qa-test` (`B-021`), `designer-manager` (`B-028`),
> `read-only` not stopping a shell, and `git-ops`'s `no-force-push` covering
> push only. Four mechanisms, one shape: **a component's self-description
> outrunning its enforcement.** Three of the four were caught by *resolving
> what a declaration actually produces* rather than reading the declaration,
> which is now this repo's standard move for capability work.
>
> **`ADR-0023` earned its evidence here.** Five concurrent sessions ran in
> their own worktrees and landed serially by rebase — no index collision, one
> registry conflict that resolved cleanly. The failure it was written for
> happened twice on 2026-09-23 before the mechanism existed and not once
> since. **It is still `Proposed`.**
>
> **Three holes remain open**, affecting `git-ops` and `closer` identically: a
> prefix glob cannot constrain a trailing flag, so `git commit -m x --amend`,
> `--no-verify` and **`git add -- .`** all resolve to *allow*. Closing them
> means editing `no-force-push`'s map, which moves four roles' boundaries — a
> decision, not a task.
>
> **Nothing runs unattended yet.** S9 delivered the portable core; **every
> binding is S10**, and none exists.
>
> **Originally opened 2026-09-23 by `TASK-0077`**, in the same commit as this
> section.
> Planned by `PLAN-0006`; held in `SPRINT-CURRENT.md`. Delivers `ADR-0022`
> **(already `Accepted`, `TASK-0076`)** and the client-agnostic half of an
> unattended-run harness: one loop, one skill, nine agent roles. The three
> client bindings and this repo's first authored MCP server are **S10**,
> deliberately split so a checkpoint can say which half worked.
>
> **Three of its twelve items are already done**, before the phase opened —
> the two spikes and the ADR they fed. That is unusual and deliberate: they
> change no component file, and `TASK-0055`'s brief said explicitly that they
> were *"not blocked by this ADR at all"*. The evidence had to exist before
> the decision could be signed.

**The headline fact, stated before the work rather than discovered by the
checkpoint:** **seven of the nine roles will be OpenCode-only**, under
`ADR-0018` clause 8.3. Seven of the eleven capability terms have no per-agent
Claude Code expression, and they are the seven carrying the safety value. The
two that port — `task-planner` and `adjudicator` — are **the two that only
think**. This harness is **OpenCode-first**, and the docs must say so rather
than describe three clients as equivalent.

### Exit criteria — written now, so the checkpoint is judged against them

| # | Criterion | How it will be judged |
|---|---|---|
| 1 | `ADR-0022` ratified on evidence | **Already met** — `Accepted` 2026-09-23 after both spikes ran and falsified **F1** |
| 2 | The `mode` question **decided explicitly** | `ADR-0022` clause 5.2: `mode: all` is admitted to `MODES` or rejected on purpose. *"Deciding it by leaving `MODES` alone is a decision; making it silently is not"* |
| 3 | `worktree-only`'s Claude Code emission settled **or explicitly recorded as not settled** | `TASK-0058`. `TASK-0056` already tried and was **confounded**; a second confounded attempt is an acceptable outcome only if it says so |
| 4 | The registry shows client coverage | `TASK-0060` closes `B-026` / `ADR-0018` clause 8.5, and **must land before `TASK-0064`** or the registry advertises OpenCode-only roles as universal |
| 5 | The loop is authored **before** the roles | Commit order, checkable in `git log` |
| 6 | Nine roles emit for their declared clients, and emission **refuses** when one is widened | Run `install.sh` for both clients; **prove the refusal**, do not infer it from a pass |
| 7 | The OpenCode-first asymmetry stated plainly in the skill and both wiring snapshots | `REVIEW-0011`'s pre-committed question |

### Pre-committed checkpoint question

> **Did the documentation state the OpenCode-first asymmetry plainly, or did
> it describe three clients as if they were equivalent?**

Committed before the work per `ADR-0012`, so the checkpoint cannot be written
to whatever the sprint happens to produce. The failure mode it targets is the
one `ADR-0020` recorded costing four tasks and two reviews: a capability claim
about a third-party client that nobody checked.

### What this phase does not do

- **It does not ship a binding.** No driver, no workflow script, no gate
  server — those are S10, which deliberately allocates **no task ids** after
  two sessions collided inside a reserved range in one afternoon.
- **It does not make an unattended run possible yet.** The portable core is
  reviewable on its own; without a binding nothing executes it. Anyone
  describing S9's completion as "unattended runs work" is overstating it, in
  the same way `ADR-0019` warned about end-to-end autonomy.

## Risks
- Client config format drift; symlink issues on Windows; skill spec
  evolution. Mitigations: configs/ snapshots, ADR-0002, spec templates.
- **The commit gate has left its stated budget, and each phase pays a
  little more.** `AGENTS.md` calls `tests/validate.sh` "fast, offline,
  hermetic; keep it that way", and TASK-0038 measured rather than assumed —
  606 ms. Phase 7 took it to **960 ms** and it is ~1150 ms today
  (REVIEW-0008, like-for-like on the repo's filesystem). The scaling is
  linear in component count, which is exactly what a component library
  grows, so the next category-sized addition inherits no headroom. **A
  measurement trap for whoever addresses it:** timing on `/tmp` (ext4) and
  comparing against `/mnt/c` (9p DrvFs) understates by ~40% and will make a
  regression look like an improvement.
- **A sprint's status records decay faster than its artifacts.** Closing
  Phase 7 found four files disagreeing about how many of its tasks were
  done, a task table calling the sprint's own opening task `planned`, and
  three backlog items still `ready` three tasks after being delivered. None
  is catchable by `validate.sh`, which checks section presence and never
  whether a status in one file matches the status in another. **Sweeping
  the status columns is part of closing a sprint**, not an optional tidy.
- **A phase can be executed without ever appearing on the roadmap.**
  Phase 6 ran a full planning cycle — a plan, ten artifacts, four backlog
  items, a sprint file, a commit — while this file went from Phase 5
  straight to Risks. REVIEW-0007 caught the same class one phase earlier
  and concluded the lesson needed a mechanism; none was added, and it
  recurred. Nothing here yet prevents a third instance.
- **Cross-client claims decay faster than internal ones.** Phase 7's
  decisions rest on two vendors' current documentation, both of which ship
  frequently and already qualify behaviour by patch version. A claim about
  external state must be re-verified at the moment it is acted on, not
  cited from a plan written days earlier.
- **An emitted artifact has no owner-of-record at its destination.**
  Phase 7 introduces generated per-client files that no check can verify
  are fresh, because ADR-0009 forbids validating runtime presence. The
  control is idempotent regeneration and nothing else; that is a real
  weakness, accepted deliberately rather than papered over.
- **A convention can grow the thing it exists to bound.** Phase 5 adds a
  reference file and template sections to a convention whose entry point
  is already over its own budget. New content goes to the load-on-demand
  tier, and the existing overage is paid rather than inherited —
  `reference/size-budgets.md:35-38` forbids raising a cap to fit what is
  already there.
- **A presence check can be read as a correctness check.** The likeliest
  failure of Phase 5 is social: a green gate taken to mean the handovers
  are good, when it only means no section is empty. Stated in the check's
  own source comment, where a reader will actually hit it.
- Client capability gaps are not repo defects and must not be recorded as
  such (ADR-0006). Check what a client actually supports before writing a
  criterion that assumes it.
- Aspirational verbs hide unchecked assumptions. "Port existing loops"
  survived a whole sprint before anyone verified a loop existed to port.
  Scope a task against observed reality, not against a plan's wording.
