# TASK-0032 — Record the target-repo findings and what was deliberately left alone

## Objective
Write the evidence trail for S6: the findings read out of
`SIGMA-infrastructure` that justify the skill, the loop and the guard —
and an explicit record that four known defects and 42 unpushed commits in
that repo were **left alone by decision**, not overlooked.

## Minimal context

### Why this is a task and not a footnote
Everything `ansible-ops` asserts rests on evidence from a repo this sprint
never modifies. If that evidence is not recorded here, the skill reads as
generic advice and the next session cannot tell which parts were derived
from observation and which were plausible-sounding.

There is a sharper reason. S6 leaves known defects unfixed in another
repo. Unrecorded, that is indistinguishable from not having noticed. This
repo has a standing lesson about exactly this asymmetry: a gap recorded
honestly is necessary but not sufficient — but an **unrecorded** gap is
strictly worse, because the next reader cannot tell a decision from an
oversight.

### The findings to record
From PLAN-0003, all read from files this session:

- **F1 — No staging inventory exists or can.** One inventory
  (`inventory/production.yml`, wired at `ansible.cfg:8`), one 6-node PVE
  cluster at 3-of-4 quorum with no verified margin, one DC holding all
  seven FSMO roles. `ci.yml:3-10` records the deliberate corollary: CI has
  no route to the estate and no credentials. **The source analysis's
  central worked example is unimplementable here.** This is the single most
  consequential correction in the sprint.
- **F2 — A documented, statically checkable, unenforced hazard.**
  `ansible.cfg:21-48`: `ansible_mounts` stats `/etc/pve`; on wedged pmxcfs
  that is an uninterruptible D-state hang `timeout` cannot kill. Both
  attempted global fixes fail (rejected in `[defaults]`; silently ignored
  in group_vars), verified empirically there. Concludes "Tracked as
  unenforced until then." → TASK-0031.
- **F3 — Four stale claims.** `.ansible-lint:4` and
  `.pre-commit-config.yaml:42` assert no playbooks exist; `ci.yml:44`
  repeats it — two playbooks exist. `ci.yml:13` says there is no GitHub
  remote; two remotes exist (`github`, `gitlab`). `requirements.yml:4-6`
  documents reinstallation in PowerShell/Windows syntax after that repo's
  ADR-0005 moved all administration to Linux.
- **F4 — Its `ansible-lint` gate has never had content to lint.**
  `profile: production` is set and `playbooks/` is *not* excluded, so the
  hook and CI should now lint both playbooks. Whether they pass was
  unverified until TASK-0027.

### Why F3 is recorded and not fixed
Human decision, 2026-09-14, Option (a): `ai-toolbox` ships portable
components; the target repo is read as evidence and never modified.
Adoption there is that repo's own sprint to open. The reasoning is
ownership — that repo runs the `project-workflow` framework
(`S###_Sprint.T###_Task`), has its own `AGENTS.md`, its own pre-commit
gate, its own CI, and its own conventions for task briefs. Reaching across
to edit it from this repo's sprint would put one change under two
governance regimes with no single owner.

The 42 unpushed commits reinforce it: that repo has uncommitted
intent of its own, predating this work. Pushing or rebasing them is not
this sprint's call, and `AGENTS.md` requires explicit authorization for
anything destructive.

### The limitation this task must state plainly
Under Option (a), `ansible-ops` is authored **from** the target repo but
never executed **in** it. It therefore ends S6 in the same epistemic
position as `mcp-servers/_template/`: plausible, unexercised scaffolding —
which `CURRENT_STATE.md` already flags as a known gap for that template,
with the instruction to treat it as unverified.

This must be recorded in the same register. S5's equivalent limitation
(four tasks in one session, leaving the cold-start benefit untested) was
only stated at its checkpoint; PLAN-0003 stated this one at plan time, and
this task carries it into the durable record.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `skills/ansible-ops/` | TASK-0029 | **done**; the component whose claims this evidence supports |
| `PLAN-0003` | this session | Written; findings F1–F7 with file:line citations |
| `ADR-0015` | this sprint | **accepted**; the decision this evidence underpins |
| TASK-0027 | this sprint | **done**; supplies F4's observed result and its fidelity caveat |
| `.ai/context/CURRENT_STATE.md` | ongoing | Carries known gaps, standing lessons, and environment notes — the durable home for this record |
| SIGMA repo | pre-existing, read-only | 42 commits ahead of `origin`; `git status` must be byte-identical before and after S6 |

**Verify the expected state; don't assume it.** Re-check each F3 citation
against the files before restating it — these were read once, this
session, and lesson 7 is precisely that a claim decays between being
written and being acted on. Three of S5's four tasks each found a false
claim in their own inputs, written by the same agent one session earlier.

## Scope

### Included
- Record F1–F4 as **dated, cited evidence** in the appropriate durable
  location — `ADR-0015`'s context, `skills/ansible-ops/references/`, or
  `CURRENT_STATE.md`'s known gaps, chosen per the one-owner-per-fact rule
  rather than written in all three.
- State explicitly that F3's four stale claims and the 42 unpushed commits
  were left alone **by decision**, with the decision, its date, and its
  reasoning.
- Record the sprint's limitation: the skill is unexercised, and why.
- Note that a follow-up in the target repo is **that repo's** sprint to
  open — without creating a task for it here, which would claim ownership
  this sprint declined.
- Verify and record that the target repo is byte-identical to its
  pre-sprint state.

### Not included
- **Fixing anything in `SIGMA-infrastructure`.** The point of the task.
- Creating task briefs for that repo. Its convention is
  `S###_Sprint.T###_Task`; authoring one from here would both violate its
  naming and presume its sprint planning.
- Pushing, rebasing, or touching its 42 commits.
- Re-deriving the findings from scratch. They are cited in PLAN-0003;
  this task verifies and durably records them.
- Copying facts into multiple places. One owner per fact; link from the
  others.

## Likely files
- `.ai/context/CURRENT_STATE.md`
- `.ai/decisions/0015-*.md` — if the evidence belongs in its context
- `skills/ansible-ops/references/` — if it belongs with the skill
- `.ai/planning/SPRINT-CURRENT.md` — the limitation may belong in the
  sprint record too, if it is not already sufficient there

## Execution plan
1. Re-verify each F3 citation by opening the file and reading the line.
   Record any that has changed since PLAN-0003 was written — and treat a
   change as a finding, not a nuisance.
2. Decide the single owner for each finding. F1 and F2 are *rationale* for
   the skill and guard, so they likely belong with those components; F3 and
   F4 are *observations about another repo*, so they likely belong in
   `CURRENT_STATE.md`'s known gaps. Justify the placement rather than
   defaulting.
3. Write each finding once, with its date and citation, and link from
   anywhere else that needs it.
4. Write the left-alone record: what, why, whose call, what date.
5. Write the limitation: `ansible-ops` is unexercised; compare explicitly
   to `mcp-servers/_template/`'s recorded status so the register is
   consistent.
6. Run `git status --short --branch` in the target repo; confirm
   byte-identical to the pre-sprint state recorded by TASK-0027 step 1.
   Record the output.
7. `bash tests/validate.sh`; confirm OK.
8. If `skills/ansible-ops/` changed, `bash scripts/sync-registry.sh` and
   check for an unintended diff.

## Acceptance criteria
- [x] F1–F4 each recorded once, with date and file:line citation, in a
      justified single location — all four in `CURRENT_STATE.md`, because
      `ADR-0015` forbids storing estate facts in the portable skill
- [x] Every F3 citation **re-verified** against the file, and any drift
      since PLAN-0003 recorded — **two had drifted**: `ci.yml`'s remote claim is
      now half-false (three remotes exist; `origin` is still a local path), and
      the pre-commit comment is at `:41-43` not `:42`
- [x] An explicit statement that F3's defects and the unpushed commits were
      left alone by decision, naming the decision, date and reasoning — human,
      2026-09-14, Option (a); reasoning is ownership, not indifference.
      **The "42" is also qualified**: it is 42 against a local-path `origin`
      and **8** against both real remotes
- [x] The unexercised-skill limitation recorded in the same register as
      `mcp-servers/_template/`'s known gap — *treat as unexercised scaffolding*,
      with two qualifications: the pilot exercised the **loops**, and
      `TASK-0031`'s guard **was** validated against real content
- [x] A note that follow-up belongs to the target repo, **without** a task
      brief being created for it here — none created; authoring one would
      violate its `S###.T###` convention and presume its sprint planning
- [x] `git status` in `/home/armando.martires/SIGMA-infrastructure`
      byte-identical to its pre-sprint state, with the output recorded — empty;
      `[ahead 42]`; `HEAD` `d4e2dd1`. **Plus `ansible.log`'s mtime unchanged**,
      which `git status` could not show (gitignored) and which is the direct
      evidence no lint ran in place
- [x] No fact duplicated across multiple files — one owner per fact; the
      skill links to reasoning rather than restating evidence
- [x] `tests/validate.sh` OK

## Mandatory validations
- [x] tests/validate.sh — `validate.sh: OK`
- [x] scripts/sync-registry.sh — **not applicable**; no component changed
      (this task writes only to `.ai/`)

## Risks and rollback
- **Risk: recording a stale claim while recording stale claims.** The
  irony would be total, and lesson 7 says it is the likely outcome, not a
  remote one. Step 1 is mandatory: open every file.
- **Risk: duplicating facts.** Writing F1 into the ADR, the skill and
  `CURRENT_STATE.md` creates three owners and guarantees drift — the exact
  defect `AGENTS.md`'s one-owner rule exists to prevent.
- **Risk: the record reading as an excuse.** "We noticed and chose not to
  act" is only legitimate with the reasoning and the decision-maker
  attached. Without them it is indistinguishable from neglect.
- **Risk: quietly taking ownership.** Creating a task brief for the target
  repo's work here would contradict Option (a) while appearing helpful.
- **Risk: the target repo changed during S6** for unrelated reasons — the
  human may work in it between sessions. If step 6 shows a difference,
  investigate before assuming this sprint caused it, and record the
  finding either way.
- **Rollback:** documentation only. `git revert`.

## Outputs / handover

**This section describes a verified state.** The task has run.

| Artifact | End state |
|----------|-----------|
| Findings F1–F4 | Each recorded **once**, dated and cited, in `CURRENT_STATE.md` — placement justified by `ADR-0015` rather than by default |
| The left-alone record | Four stale claims **plus the unpushed commits, with the count qualified per remote** (42 vs `origin`, **8** vs both real remotes), naming the decision, its date and its reasoning |
| The limitation record | `ansible-ops` unexercised, in the same register as `mcp-servers/_template/`, with two honest qualifications |
| `SIGMA-infrastructure` | **Untouched.** `git status` empty, `[ahead 42]`, `HEAD` `d4e2dd1`, playbook still `gather_facts: false`, **`ansible.log` mtime unchanged** |
| `.ai/context/CURRENT_STATE.md` | Updated; no fact duplicated; the skill links to reasoning rather than restating evidence |
| `skills/ansible-ops/` | **Unchanged by this task** — deliberately, since estate facts must not enter it |

**Deviations from the Execution plan, recorded:**

1. **The brief's suggested placement for F1/F2 would have violated
   `ADR-0015`.** Step 2 says they "likely belong with those components" as the
   skill's rationale. They cannot: the ADR's decision is *derive per change,
   never declared and never stored*, and `install.sh:105` symlinks a deployed
   skill, so an estate's inventory layout and quorum state would reach every
   consumer. All four findings went to `CURRENT_STATE.md`, with the reasoning
   recorded rather than the placement silently changed.
2. **Two citations had drifted** (`ci.yml`'s remote claim is now *half* false;
   the pre-commit comment is at `:41-43`). The brief's risk note called this the
   likely outcome and it was right.
3. **The "42 unpushed commits" figure needed qualifying, and the brief did not
   ask.** It is 42 against a local-path `origin` and **8** against both real
   remotes. Three files had repeated the larger number unqualified.
4. **One verification was added that the brief did not require**: `ansible.log`'s
   mtime. It is gitignored, so `git status` cannot show it, and `TASK-0027` found
   `ansible-lint` writes it with **no flag** — making the mtime the only direct
   evidence that no lint run happened in place.

**Next task starts here**: S6's deliverables and their evidence base are both on
the record, so the sprint can be closed by a checkpoint assessing it against
`PLAN-0003`'s criteria — including the one it declared in advance it would not
meet, the skill being unexercised.

**Two traps for whoever writes that checkpoint:**
- **The checkpoint is NOT `REVIEW-0008`**, as this brief's handover originally
  said — that number was consumed by S7's closure. S8 has reserved
  `REVIEW-0009`. S6's takes the **next free** number.
- **`TASK-0027`'s recommendation was falsified by `TASK-0031`**, the task that
  implemented it. The conclusion survived; the stated reason did not. Worth
  weighing rather than glossing.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-14
- Updated: 2026-09-16

## Execution log
### Attempt 1
- Date: 2026-09-16
- Agent: opencode (claude-opus-5)
- Actions: Re-opened and re-read **every** F3 citation and both F1 citations
  before restating them (step 1, mandatory). Measured the unpushed-commit count
  against each remote rather than repeating the recorded figure. Chose a single
  owner per fact and justified it. Wrote F1–F4, the left-alone record, the
  limitation and the untouched-verification into `CURRENT_STATE.md`. Verified
  the target repo unchanged and recorded the output verbatim.

- Observations:

  **1. Two recorded claims had DRIFTED, and the drift is the interesting
  part** — this task's own risk note predicted it ("recording a stale claim
  while recording stale claims… lesson 7 says it is the likely outcome, not a
  remote one"):

  - **`ci.yml:11-13` is now HALF false, which is harder to spot than wholly
    false.** It says *"There is currently no GitHub remote for this repo (origin
    is a local path)"*. `git remote -v` now shows **three** remotes: `github` →
    `github.com/armandomartires/SIGMA-infrastructure.git`, `gitlab` → an
    internal GitLab, and `origin` → **still a local path**. So the headline
    claim is false while its parenthetical is still true. `PLAN-0003` recorded
    "two remotes exist"; there are three.
  - **`.pre-commit-config.yaml`'s claim is at `:41-43`, not `:42`.** Same claim,
    corrected for precision.

  **2. THE UNPUSHED-COMMIT COUNT DEPENDS ON WHICH REMOTE, AND THE BRIEF DID NOT
  SAY.** `PLAN-0003`, the sprint file and this brief all say "42 unpushed
  commits". Measured:

  | Remote | Ahead |
  |---|---|
  | `origin` (a **local path**) | **42** |
  | `github` | **8** |
  | `gitlab` | **8** |

  So *"42 unpushed"* holds only against a local-path `origin`; against both
  **real** remotes it is **8**. The alarming number is the one that got
  recorded, three times, without qualification. **A count is not a fact until
  you name what it counts against** — and this is the same shape as
  `REVIEW-0008`'s timing trap, where a measurement compared filesystems rather
  than commits.

  **3. Placement: all four findings went to `CURRENT_STATE.md`, and the
  reasoning is `ADR-0015`'s.** The brief suggested F1/F2 might belong "with
  those components" since they are the skill's and guard's rationale. **They
  cannot.** `ADR-0015`'s decision is *derive per change, never declared and
  never stored*, so writing one estate's inventory layout, quorum state or FSMO
  topology into `skills/ansible-ops/` is the precise mechanism that ADR
  rejects — and `install.sh:105` symlinks a deployed skill, so those facts would
  reach every consumer. Verified the skill currently holds none: it says
  *"Nothing here is specific to one estate."* So the single owner for all four is
  this file, and the skill links to reasoning rather than restating evidence.
  **The brief's suggested placement would have violated the ADR the same
  sprint accepted.**

  **4. F2 is no longer an unenforced rule, and the record says so.** The
  citation ends *"Tracked as unenforced until then"* — `TASK-0031` closed that,
  so F2 is recorded as **historical** with a pointer to the guard, plus the
  standing fact that the guard is **available to** that repo and **not
  installed in** it.

  **5. F4 carries its fidelity limit at the point of the claim**, not in a
  footnote: the clean lint result came from a copy whose `ansible.cfg` had
  `vault_password_file` removed, so it describes a *modified* configuration.
  Both `group_vars/*/vault.yml` files were confirmed present and
  `$ANSIBLE_VAULT`-encrypted, and neither was decrypted or copied.

  **6. The untouched-verification includes one check the brief did not ask
  for, and it is the load-bearing one.** `ansible.log`'s mtime is still
  `2026-09-12 16:15:01` — which matters because `TASK-0027` found that
  **`ansible-lint` writes that file with no flag at all**. So the mtime is
  direct evidence that no lint run happened in place. `git status` alone would
  not have shown it, since the file is gitignored.

- Validation: `bash tests/validate.sh` → **`validate.sh: OK`**.
  `scripts/sync-registry.sh` → **not applicable**; no component changed (this
  task writes only to `.ai/`).
  **Target repo verified untouched, output recorded verbatim in
  `CURRENT_STATE.md`:** `git status --short` **empty**; `git status -sb` →
  `## master...origin/master [ahead 42]`; `HEAD` `d4e2dd1`;
  `capture_pve_baseline.yml:22` still `gather_facts: false`; `ansible.log`
  mtime unchanged. Every mutation this sprint performed was in a
  `/tmp/opencode/` copy.
- Result: **Done.** S6's evidence trail is durable, cited, dated and
  single-owned; the four stale claims and the unpushed commits are recorded as
  **left alone by a named human decision** rather than as oversights; and the
  unexercised-skill limitation is stated in the same register this file already
  uses for `mcp-servers/_template/`.
- Commit:
- Push:
