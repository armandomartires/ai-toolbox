# TODO

- [x] TASK-0001 — Port and harmonize the project-migration skill (done)
- [x] TASK-0002 — Extend the skill frontmatter schema (done)
- [x] TASK-0003 — Harmonize the project-workflow skill (done)
- [x] TASK-0004 — Allow external (Node/npm) MCP servers alongside authored Python ones (done)
- [x] TASK-0005 — External MCP server shape: manifest, scripts, validation (done)
- [x] TASK-0007 — Port the ansible MCP server (done)
- [x] TASK-0006 — Client config snapshots and multi-client skill deployment (done)

## Sprint S2 — Multi-client hardening
- [x] TASK-0008 — Author the first loop component (release-check) (done)
- [x] TASK-0009 — MCP server smoke-test harness (done)

## Sprint S3 — Automation
- [x] TASK-0011 — De-duplicate the registry generator; reject template rows (done)
- [x] TASK-0010 — Pre-commit hook running validate.sh; inert CI workflow (done)

## Sprint S4 — Closing the open loops
- [x] TASK-0012 — Skill linter, frontmatter rules only (done; B-002 closed)
- [x] TASK-0013 — MIT LICENSE backing the skills' `license:` claims (done; B-004 closed)
- [x] TASK-0014 — install.sh warns on the core.filemode=false hook trap (done)
- [x] TASK-0015 — Env vars documented + enforced; git remote wired; CI verified (done)
- [x] TASK-0016 — LM Studio UI runbook procedure; ADR-0010 on the Python shape (done)

## Post-S4 (no sprint open)
- [x] TASK-0017 — Record the LM Studio UI verification (PASS); fix the
      `WORKSPACE_ROOT` placeholder trap; close Phase 2's last criterion (done)
- [x] TASK-0018 — Close B-001 as superseded (ADR-0011); fix the registry
      quote leak and add three registry-integrity checks (done)
- [x] TASK-0019 — Retract the false default-branch mismatch claim (done)

## Sprint S5 — Session handover contract (open)
Planned by `.ai/planning/plans/PLAN-0002-session-handover-contract.md`;
decisions in ADR-0012. Run in order — each depends on the one above.
- [x] TASK-0020 — Skill: `reference/session-handover.md`; restore
      `00.CONVENTIONS.md` to its byte budget (done — 3087→3060; found
      the budget target was ambiguous, and that TASK-0021 has two checks
      that cannot fail)
- [x] TASK-0021 — Skill: task-template `Inputs`/`Outputs`; version
      `3.1.0` (done — merged `Files touched` into `Outputs`, correcting
      a false claim in ADR-0012; both clients are symlinks so two
      planned checks were struck as unfailable)
- [x] TASK-0022 — This repo: merge into the two contract sections in
      `.ai/templates/TASK.md` (done — **three** sections merged, not
      four: measuring showed `Minimal context` carries narrative up to 82
      lines that a table would destroy. 16→15 sections)
- [x] TASK-0023 — `validate.sh`: handover-omission check with the
      `≥ 0020` boundary (done — 7 proof cases; they exposed that
      `.ai/tasks/completed/` could hide a brief from the check, fixed
      before shipping)

**Sprint S5 complete.** Checkpoint: `REVIEW-0007`.

## Post-S5 (no sprint open)
- [x] TASK-0024 — Unify `.ai/decisions/` filenames on `NNNN-*`; close
      B-008 (done — 7 renames, and found `.ai/README.md` was prescribing
      the superseded scheme, which would have regenerated the
      inconsistency at the next ADR. Raised B-009)
- [x] TASK-0025 — Close B-009 as **decided, not implemented** (ADR-0013):
      the two skills scaffold two different frameworks, differing nine
      ways; its premise of a shared convention was false (done)

## Sprint S6 — Ansible agent guardrails (CLOSED 2026-09-22 by REVIEW-0010)
Planned by `.ai/planning/plans/PLAN-0003-ansible-agent-guardrails.md`;
decisions ADR-0014…0016 (**all three Accepted 2026-09-22**, `TASK-0054`).
Raised
B-010…B-013. Sprint opened by commit `9528d13`, pushed and confirmed.

**Un-parked 2026-09-16 by `TASK-0052`; S6 now holds `SPRINT-CURRENT.md`.**
Human decision: finish S6 before S8, which is **re-queued**. It had been
parked by TASK-0033 on 2026-09-15 (human decision, S7 opened instead).

**Un-parking cost nothing for the same reason parking did: S6 still has
zero implementation of its own.** The "Planning only — no implementation,
ever" note that stood here was true of S6's own execution and is now
retired, not because it was wrong but because the sprint is running.

**TASK-0029 and TASK-0030 are `done`, delivered by S7's pilot
(`TASK-0046`)** — produced *through* S7's loops on 2026-09-15, under an
**Option 2 waiver** (built from `PLAN-0003`'s F1–F7 evidence with ADR-0015
unratified), recorded in both task files. Their boxes are ticked below.
**TASK-0031, the highest-value item, was not delivered by that pilot**;
B-011 stays open.

**Outstanding: TASK-0026, TASK-0031, TASK-0032, ratification of the three
ADRs, and a checkpoint.** Both spikes and all three ADR bodies are **done**
(2026-09-16). Two things a cold reader needs:
- **All three ADRs have bodies and all three are now `Accepted`
(2026-09-22)** —
  written from the spikes' observed evidence, per the human decision, and
  **awaiting ratification, which is a human act**. Two were **retitled**
  because the evidence contradicted their planned titles: `ADR-0015` (its
  "portable core plus per-project templates" mechanism is **refuted** —
  `install.sh:105` symlinks a deployed skill, so fill-in-place would write
  one estate's facts into the portable component; the pilot chose **derive,
  persist nothing**), and `ADR-0016` (declined, but **not** for the
  anticipated reason — see below). `ADR-0015`'s *filename* still names the
  rejected shape, deliberately, per `ADR-0017`'s precedent.
- **`REVIEW-0009` is already reserved by S8.** S6's checkpoint takes the
  next free number.

**The two spikes both inverted their own briefs' expectations** — recorded
here because each changed a downstream decision:
- **TASK-0027:** the target repo's gate **passes** on its two real playbooks
  (0 failures across 53 rules, exit 0) — the first run against real content
  since S004.T007. The guard's home is a **custom `ansible-lint` rule** wired
  via `enable_list:`, **conditional on a fires-proof**: a custom rule outside
  the active profile is **loaded, listed and never evaluated at exit 0**. The
  answer needed four runs; the first was silent, which alone reads as "custom
  rules don't work" and would have forced `pre-commit` for no reason.
- **TASK-0028:** hook interception **works in both clients** — the opposite of
  the expected "no" — and `ADR-0016` still declines a category, because the
  two clients **disagree on the tool's name**
  (`mcp__ansible__zen_of_ansible` vs `ansible_zen_of_ansible`, observed).
  Claude Code is **documented-only**; OpenCode was **observed live** and then
  the probe reverted, verified two ways.

**Four defects were found in S6's own remaining plan before it resumed**
(`TASK-0052`), all bearing on TASK-0031, all from opening the files the
briefs name (lesson 7). **D1:** the guard matched PVE-class by group name,
but the estate's one PVE playbook uses `hosts: sigsrvpve1`, a bare hostname
— detection needs host→group resolution from the inventory. **D2:** the
"two real playbooks → guard silent" criterion is satisfied equally by a
correct guard and by a D1-afflicted one that classifies nothing, so **five
green fixtures would have proven nothing** — lesson 8's third instance, in
the fixture design of the task written to avoid it. **D3:** matching the
`module_defaults` key rather than its `ansible.builtin.setup` entry
over-accepts the real playbook, whose block is scoped to
`group/community.proxmox.proxmox`. **D4:** `ansible-lint` is at
`~/.venvs/sigma-ansible/bin/`, not in the target repo, and not on `PATH`
(`26.8.0` / `ansible-core 2.20.8`, confirmed by running it). Common cause:
the plan was written from `ansible.cfg`'s prose without opening the playbook
the guard must classify — **the hazard was verified, the subject was not.**

Phase 0 (independent of each other, may run in parallel):
- [x] TASK-0026 — Correct the `WORKSPACE_ROOT` blast-radius claim; disable
      `ansible_navigator` in 3 wiring snippets; ~~LM Studio → models-only~~
      (**done 2026-09-16; B-012 and B-013 closed**). The false claim was in
      **six** places, not the four the brief predicted — the extras were
      `docs/operations/runbook.md` and a *lessons* list. **The models-only
      item was deliberately NOT done**: `ADR-0020` refuted it, so re-adding it
      would have restored a known-false claim. Authorization re-recorded with
      a `history` array showing the original five-tool grant *and* the
      narrowing; the gate was **observed failing** on a broken authorization
      block, then restored byte-identically
- [x] TASK-0027 — *Spike.* Lint the two real playbooks on a `/tmp/opencode/`
      copy; record what degraded; choose the guard's home (**done** — gate
      passes, 0/53 violations; guard = custom `ansible-lint` rule via
      `enable_list:`, conditional on a fires-proof)
- [x] TASK-0028 — *Spike.* Can a Claude Code `PreToolUse` hook match
      `mcp__ansible__*`? OpenCode's equivalent? Non-blocking (**done** —
      **yes in both**, and the clients' MCP tool *names* are incompatible,
      which is what declines the category)

Phase 1 — decisions (each depends on its spike). **All three bodies written
2026-09-16; all three still `Proposed` and awaiting human ratification:**
- [x] ADR-0014 — Accept and narrow the MCP surface (**body written**; adds
      that a green MCP lint result is not evidence an estate's own rules ran)
- [x] ADR-0015 — ~~Portable core + templates~~ → **derive per change, persist
      nothing**; check+snapshot, not staging (**body written; retitled** —
      clause 1's mechanism refuted by `install.sh:105`)
- [x] ADR-0016 — Hooks as a category (**body written; retitled** — declined
      because the clients disagree on the tool's *name*, not because
      interception fails; it **works** in both)

Phase 2 — instruct layer (ordered; the skill settles the vocabulary):
- [x] TASK-0029 — `skills/ansible-ops/` (**done — delivered by S7's
      TASK-0046, 2026-09-15, under the Option 2 waiver**)
- [x] TASK-0030 — `loops/ansible-change/` (**done — same**)

Phase 3 — enforcement and record:
- [x] TASK-0031 — The `gather_subset` guard + **7** fixture proofs
      (**done 2026-09-16; closes B-011**). **The sprint's highest-value item,
      delivered.** A custom `ansible-lint` rule (`gather-subset-mounts`),
      **10/10** in its own fires-proof (`tests/gather-subset-guard.sh`)
      including a negative control that reproduces the `enable_list`
      silent-no-op trap. Fixture 6 **observed failing**, and the *real*
      playbook flipped to `gather_facts: true` in a `/tmp` copy produced
      `MISSING EXCLUSION` naming `sigsrvpve1` resolved through the real
      inventory — so the silence on the unmodified playbook is discriminating,
      not inert. **Three defects found during execution, two of them mine:**
      `TASK-0027`'s "declarative wiring" recommendation is **wrong** (per-rule
      config in `.ansible-lint` is fatal for a custom rule → env vars);
      fixture 4 could never reach the rule (`syntax-check` is unskippable);
      and my harness matched the rule **ID**, which appears in ansible-lint's
      error text, so four fixtures read as "fired" when nothing had run
- [x] TASK-0032 — Record the target-repo findings; state what was
      deliberately left alone (**done 2026-09-16**). F1–F4 all recorded in
      `CURRENT_STATE.md` — **not** with the skill, because `ADR-0015` forbids
      storing estate facts in a symlink-deployed component, which is where the
      brief suggested putting them. **Two citations had drifted**: `ci.yml`'s
      "no GitHub remote" is now *half* false (three remotes exist; `origin` is
      still a local path). **And the "42 unpushed commits" repeated in three
      files needed qualifying — it is 42 against a local-path `origin` and
      *8* against both real remotes**

Sprint transition:
- [x] TASK-0052 — Un-park S6, re-queue S8, correct D1–D4 in TASK-0031
      (**done**, commit `d278c64`, pushed)

**B-010…B-013 remain open and `ready`**, all raised by PLAN-0003 and all
still scoped against the S6 task numbers above — through the park *and* the
un-park, since neither a park nor a re-queue resolves a backlog item.
B-001…B-009 remain closed. **The count in this block was true when written
and has decayed**: B-014 closed and B-018, B-019, B-020, B-021 were raised
since, so "eight items are open" is no longer the number. `BACKLOG.md` is
the owner of that count — do not restate it here.

Notes on S6:
- The sprint began from a **human-supplied analysis**, not a backlog item —
  a first. Six of its claims were corrected before anything was planned.
  The largest: its central worked example gates on a **staging inventory
  that does not exist and cannot** in the target estate (one inventory, one
  6-node cluster at 3-of-4 quorum, one DC holding all seven FSMO roles).
  The real workflow is `--check --diff` plus snapshot/rollback.
- **Two spikes are numbered task briefs, not `SPIKE-####` files.**
  `tests/validate.sh:456-463` fails any file in `.ai/tasks/` not matching
  `TASK-####-*.md`, deliberately, so a renaming scheme cannot disable the
  handover check. Weakening the gate for a naming preference is the wrong
  trade.
- **Every unexecuted brief states an *intended* end state, labelled as
  such.** The handover check requires `## Outputs / handover` non-empty for
  briefs ≥ 0020 including unrun ones, and it detects omission rather than
  correctness (ADR-0012 Decision 3) — so it cannot tell an intention from a
  state. Each brief says which it is.
- **TASK-0031 is the highest-value item, and it is not the skill.** It
  enforces a rule already written in the target repo's `ansible.cfg:21-48`
  whose failure mode is an uninterruptible D-state hang on a cluster node,
  and which that file itself records as "Tracked as unenforced until then."
  It is *static*, so it survives TASK-0028 reporting either way.
- **Known limitation, recorded at plan time rather than at checkpoint:**
  under Option (a) the skill is authored *from* the target repo but never
  executed *in* it, so `ansible-ops` ends S6 as unexercised scaffolding —
  the same status `mcp-servers/_template/` already carries. S5's equivalent
  limitation was only stated at REVIEW-0007; this one is stated up front.
- `SIGMA-infrastructure` is **read as evidence and never modified**
  (Option a). Its four stale claims and 42 unpushed commits are recorded by
  TASK-0032 and fixed nowhere. **Still binding — it bound under S7 while S6
  was parked, and binds again now S6 is current.** Neither parking nor
  un-parking relaxes it. `git status` there was verified clean at the start
  of the un-parking session and must be verified clean at the end of every
  S6 task.

## Sprint S7 — Design and production agent loops (open)
Planned by `.ai/planning/plans/PLAN-0004-design-and-production-agent-loops.md`.
Raised B-014…B-017. Sprint opened by TASK-0033.

**Decisions, all settled 2026-09-15:** ADR-0018 **accepted** (on TASK-0036's
evidence), ADR-0019 **accepted** (ratification), ADR-0017 **rejected**
(human decision — `agent-tiers` stays with `opencode-customization`).

**Eleven tasks done** (counted, not estimated): TASK-0034, 0036, 0037, 0038,
0039, 0040, 0041, 0042, 0043, 0044, 0045. **Phases 1–4 complete** — both
loops exist and both their role sets are authored, gated, indexed and
emitted. TASK-0035 **cancelled**. **Only TASK-0046's pilot remains.**
The header previously read "planning only — no implementation"; that stopped
being true at TASK-0041.

Phase 0:
- [x] TASK-0033 — Park S6; open S7; add ROADMAP Phase 6 **and** 7; add the
      missing S6 session record; raise B-014…B-017 (done)

Phase 1 — reclaim, then decide (the two spikes are mutually independent):
- [x] TASK-0034 — *Spike.* Inventory the `agent-tiers` drift: 2 differing
      files, both claiming `1.0.0`, installed copy a real dir. Read-only
      (done — drift fully characterised: **repo copy newer for both files,
      consistently, from one commit**; installed copy carries **no unique
      fix**; all 4 model IDs still resolve against a live 2026-09-15
      listing; 5 dangling citations, **all in the installer half**; the two
      slash commands are client config and out of scope.
      **BLOCKING FINDING: `agent-tiers` is not unowned.**
      `opencode-customization` kept it deliberately — commit `9bae137`,
      2026-09-13, explicit user decision, stated reason, **unpulled reopen
      trigger**. S7 planned from a four-day-stale quotation of that repo's
      older roadmap)
- [x] ADR-0017 — ~~ai-toolbox owns `agent-tiers`~~ → **REJECTED 2026-09-15**
      (human decision). `agent-tiers` **stays with
      `opencode-customization`**. Premise disproved by TASK-0034; this repo
      has no standing to pull another repo's reopen trigger; and
      "OpenCode-specific" is substantively right — **Codex has no per-role
      agent mechanism at all** (verified) and `git-ops`/`shell-runner` are
      inexpressible as Claude Code subagents. Carries its own 3-condition
      reopen trigger, and records the `{tier:}`-resolver gap the rejection
      creates
- [x] TASK-0035 — ~~Import to `skills/agent-tiers/`~~ → **CANCELLED**,
      superseded by ADR-0017's rejection. Not blocked — its premise is gone,
      not pending. Brief retained unrun as the plan a future handover would
      start from (ADR-0017 trigger 1)
- [x] TASK-0036 — *Spike.* Verify the per-client agent field mapping against
      **live** docs; test unknown-key handling (done — emission confirmed on
      **new** evidence: a superset file loads in Claude Code and silently
      discards an OpenCode `permission:` block, leaving Write/Edit/Bash in
      the pool. 5 of 8 capability terms OpenCode-only; 4 ADR-0018 rows
      corrected)
- [x] ADR-0018 — Per-capability portability; one source, per-client
      **emission**; emission forbids `link` mode (**accepted** 2026-09-15 —
      ratified on evidence: clause 2's reasoning replaced with the observed
      safety failure, 4 facts corrected in place, and **new clause 8: the
      emitter refuses, never degrades**. `git-ops` and `shell-runner`
      recorded **OpenCode-only** rather than left for TASK-0045)

Phase 2 — make `agents/` a real category (0037 strictly first; then
0038/0039/0040 are independent):
- [x] TASK-0037 — `agents/_template/` + normative schema in
      `authoring-guide.md`. **Definition before enforcement** (ADR-0008)
      (done — 9-row rule table, **9**-term vocabulary. The brief's
      "a one-client term cannot be offered" rule was **overridden by
      ADR-0018 clause 8.3**: following it would have left a 3-term
      vocabulary unable to state any real role's safety boundary. Proved
      by test that `validate.sh` returns exit 0 on a deliberately
      malformed agent file — the category is genuinely unpoliced, which is
      what TASK-0038 fixes)
- [x] TASK-0038 — `validate.sh` agent checks, parsed not grepped, each
      **observed failing** on a fixture (done — 17 rules, one fixture each,
      plus a valid control so the group is proven not to fail
      unconditionally. Closed TASK-0039's finding: folded `description`
      now rejected two ways. The fixture harness was **unsound on its first
      run** — every case violated the name↔directory rule as well as its
      target, so the failures proved nothing; caught before recording.
      654→606 ms)
- [x] TASK-0039 — `sync-registry.sh`: `extract()` gains `agent`; one
      `emit_section` line (done — two lines plus a comment, as B-007's
      centralization intended. Proved the template skip is the exclusion by
      disabling it and watching all five templates appear; proved the
      section populates with a temporary fixture rather than trusting an
      empty header. **Finding handed to TASK-0038:** a folded
      `description: >-` produces a valid-looking registry row containing
      the literal `>-`, and nothing currently detects it)
- [x] TASK-0040 — `install.sh` emission + `CLIENTS` fourth column; 3 config
      snapshots gain an agents section (done — emitter is a separate
      `scripts/emit-agents.py`. **`validate.sh` needed no change**: its
      `CLIENTS` parse anchors on field 1, so extra columns are invisible to
      it — measured before choosing the shape. All 9 capability terms proven
      per client: 4 map, **5 refuse** for Claude Code rather than degrade.
      Two assigned decisions recorded: `worktree-only` emits
      `isolation: worktree`; the emitter emits `{tier:<name>}` and never
      resolves it. **Phase 2 complete** — `agents/` is defined, enforced,
      indexed and deployable)

Phase 3 — the design half (the genuine capability gap):
- [x] ADR-0019 — Convergence is **human acceptance**; autonomy stops at the
      merge gate; dynamic workflows rejected (**accepted 2026-09-15** — three
      clauses, not the "two" the proposed text miscounted; corrected in place
      at ratification. **Unblocks TASK-0041 and TASK-0044**, the only S7
      tasks that depend on no spike)
- [x] TASK-0041 — `loops/design-brief/` — clarify→ideate→critique→converge,
      capped, with the acceptance gate (done — **seven** steps not four: a
      constraint-verification step and a separate lock step earned their
      place. Cap **3**, unit stated as one pass through steps 2–6. Lock =
      frontmatter **plus a dedicated commit**, because a field alone can be
      flipped by the next agent to open the file. The executor read-back
      found the manager holding its own commit rights and delegated to
      `git-ops`. **`design-doc-writer` gets nothing to do**, so the sprint's
      role count is six, not seven)
- [x] TASK-0042 — `skills/design-flow/` — portable core + templates (done —
      3.3 KB core routing to 12.6 KB in `references/`; no budget invented.
      **Distinctness** = differing in a *load-bearing commitment*, one whose
      change forces rewriting rather than adjusting. **Critique has eight
      named obligations**, so an empty critique is a claim with content.
      Method covers 4 of the loop's 7 steps; 5–7 are sequence, not method.
      The read-back found **nothing** to move — the sequence/method split
      held, which is the evidence two artifacts were right. A gate proof
      nearly returned a false negative by grepping for a sibling check's
      wording: **match the check's own message or exit status**)
- [x] TASK-0043 — Roles: `designer-manager` (**primary**), `ideator`,
      `critic`; **`design-doc-writer` declined** on evidence — zero
      references anywhere in shipped content, and the manager + `git-ops`
      already own its work (done — **Phase 2 exercised end to end**: gate
      passes on real content, registry populates, 6 files emitted and
      inspected, **`critic` proved read-only at runtime in both clients**.
      Its step-2 gate found the vocabulary could not express a delegation
      allowlist — escalated, then added as a **tenth term** via follow-ups to
      TASK-0037/0038/0040 in definition→enforcement→emission order)

Phase 4 — the production half, owned here:
- [x] TASK-0044 — `loops/project-build/` — from `bmad-workflow.md:8-38`,
      with the merge gate explicit (done — 8 steps, 218 lines, source read
      **in place** since no import happened. Added a **`document` step**
      ADR-0019 requires and the inherited sequence lacks, labelled as the one
      addition. Added a **third bound** no source supplies: separating the
      fix cap from the review path left the review path unbounded. The
      two-owners question answered as *two artifacts, one ancestor, neither
      updating the other* — the brief's two options both assumed this repo
      can edit a skill in another repo, and it cannot)
- [x] TASK-0045 — **RESCOPED 2026-09-15**: ~~Reconcile~~ **author**
      `qa-test`/`review`/`git-ops` in `agents/`, with the installed
      `agent-tiers` copies as **read-only reference** (done — all three
      authored, **all three OpenCode-only**, so `install.sh` cleanly *skips*
      them for Claude Code. `shell-runner` **not authored**: no loop step
      references it. The ownership question had **no applicable options** —
      all three assumed the skill is in this repo. **Two emitter defects
      found by diffing emitted output against the references fact by fact**:
      alphabetical glob ordering downgraded `git push --force` from **deny to
      ask**, and `no-force-push` omitted `git clean -f*`. Both would have
      passed a read-through; both fixed in TASK-0040 and attributed there.
      `bash-allowlist` also needed **parameterising** (`bash_allow`) before
      any role could be authored faithfully, following TASK-0043's
      precedent. **Both loops' role sets now exist.**)

Phase 5 — exercise it:
- [ ] TASK-0046 — **Pilot.** Run both loops to produce S6's `ansible-ops`
      and `ansible-change` (needs TASK-0043, TASK-0045). **The task that
      decides whether S7 delivered anything**
      (Its task file has been `done` since 2026-09-15 with a recorded
      commit and push. This box is unticked in error — the *second* instance
      of the TASK-0019 omission class noted below, found by TASK-0047 while
      reading this file. Left unticked deliberately: correcting it belongs
      to a commit about the pilot, not to a commit about client naming.)

Out of sprint — corrections found by inspection:
- [x] TASK-0047 — The LM Studio client is **Bionic**;
      `configs/lm-studio` → `configs/lm-studio-bionic`. ADR-0020 supersedes
      ADR-0006's client findings: Bionic **does** have an Agent Skills
      target (`~/.lmstudio/skills/`, `<project>/.agents/skills/`) and
      **does** perform agentic work. The old claim rested on the
      `hub/skills/` cache. Raised B-018; retracted B-005's stated reason;
      re-grounded ADR-0018 clause 6. The 2026-09-13 UI pass is re-attributed
      to **classic LM Studio 0.4.24**, which is installed alongside Bionic;
      Bionic's MCP support is *inferred, not verified*, with a GUI check
      left open in the runbook (done)

## Sprint S8 — Third-party agent extensions (RE-QUEUED 2026-09-16, not started)
Planned by `.ai/planning/plans/PLAN-0005-third-party-agent-extensions.md`.
Raised B-019, B-020. Decision: `ADR-0021` (**proposed**).

**S8 no longer holds `SPRINT-CURRENT.md`.** Re-queued 2026-09-16 by
`TASK-0052` to `.ai/planning/sprints/SPRINT-S8-third-party-extensions.md`,
because the human chose to **un-park S6 and finish it first**. It had been
current since earlier the same day, promoted after `REVIEW-0008` closed S7
(**approve**).

**Re-queued is a third state, not parked and not closed:** promoted, then
un-promoted **before any work**, so no checkpoint — there is nothing to
check. All four briefs (`TASK-0048…0051`, all `planned`) and `PLAN-0005` are
**unmodified**; **B-019/B-020 stay `ready`**. It cost nothing because zero
components had changed, which was the planning-only instruction at the time.

The deviation recorded here previously — S8 sitting in `planning/sprints/`
because `REVIEW-0008` did not exist — was resolved in the correct order:
review first, then promotion. That note also said S7 had **six** tasks; it
had **13 done and 1 cancelled**, one of four files that disagreed about the
count. **This block has now stated three different locations for the same
file in one day**, which is the cost of recording a path in prose.

**Two S7 findings bind this sprint:** `tests/validate.sh` is at ~1150 ms,
past the sub-second property `AGENTS.md` treats as load-bearing (and timing
it on `/tmp` ext4 rather than `/mnt/c` understates by ~40%); and a finding
recorded only in a task log gets rediscovered rather than fixed (**B-021**),
so `TASK-0048`'s findings belong in `BACKLOG.md`, not only in prose.

Opened from a human request — *add ponytail, omniroute and graphify,
cross-agent compatible if possible* — which makes it the **third sprint in
a row started from a human-supplied premise, and the third where the
premise needed correcting first**. The correction: "plugin" named three
unrelated mechanisms, so there is no portable capability to abstract.

Scope, after the human narrowed it on 2026-09-16: **graphify** becomes a
real pinned component; **ponytail** becomes per-client documentation;
**omniroute is out of the component layer** and gets one entry in a new
third-party-tools document.

- [x] TASK-0048 — **Spike, runs first.** Verify both products on this
      machine: graphify's real OpenCode surface (its README and its
      `src/cli.ts` **disagree**), whether `graphify serve` can start
      without a graph (`src/serve.ts:188-195` says no), and whether
      ponytail loads from an npm `plugin` entry given its `main` points
      into `./.opencode/plugins/`. Writes no component files
      (done 2026-09-22, commit `90db5a4`. **Both products are
      multi-surface; 2 of 3 claims overturned.** This box was left unticked
      by that commit — the *third* instance of the omission class noted
      against TASK-0019 and TASK-0046 above, and ticked here rather than
      left false for a third time.)
- [x] TASK-0049 — `mcp-servers/graphify/server.json`, pinned exactly;
      registry regenerated; **the smoke-test precondition decided** — an
      unbuilt graph would make `smoke-mcp.sh` report FAIL where the truth
      is SKIP, the mirror of the defect its own header guards against
      (done 2026-09-23. Decided as a **manifest-driven**
      `smoke_test.requires_paths` → SKIP, human-authorized, so graphify is
      not named in the harness and the rule covers any future stateful
      server. Proving the SKIP was a precondition gate rather than an
      exemption uncovered a **second** harness defect: it waited for the
      server to *exit*, so a conforming long-lived MCP server was reported
      as never having spoken while holding its correct reply. Fixed under a
      second explicit authorization.)
- [x] TASK-0050 — ponytail wiring in all three `configs/*/README.md`, one
      mechanism per client; Bionic **unverified** (B-018 referenced, not
      restated); the state files upstream leaves outside its plugin
      directory listed, since nothing here prunes them
      (done 2026-09-23. `ponytail-mcp` re-checked under **both** the bare
      and scoped names — still 404, so the shape holds. **Two of the
      brief's own inputs were wrong**: the Claude Code plugin installs
      **three** hooks, not two (the two-hook figure came from a *different*
      client's manifest, and upstream's README repeats it), and the six
      skills are schema-compatible only in their *keys* — all six use a
      folded `description: >`, which this repo's gate rejects, giving the
      no-vendoring decision a second, mechanical reason.)
- [x] TASK-0051 — `ADR-0021`'s placement rule into the authoring guide
      (**linking** to the reasoning, never restating it) plus
      `docs/development/third-party-tools.md` with omniroute
      (done 2026-09-23. All three rows **Gated: no** — four claims about
      `validate.sh` grepped against the script, none recalled. `ADR-0021` is
      still `Proposed`, so the guide labels it rather than implying
      consensus. Non-exclusivity stated as fact, not hedged: graphify
      occupies two rows. **Raised B-023** — graphify has a manifest and a
      registry row but no `configs/` wiring section, a gap each of the two
      preceding briefs assigned to the other.)
- [x] REVIEW-0009 — Checkpoint. Question pre-committed: *did the spike
      change anything, or did it rubber-stamp the vendor READMEs?*
      (written 2026-09-23, `.ai/reviews/REVIEW-0009-sprint-s8-third-party-extensions.md`.
      **Answered with six corrections, three of them against this sprint's
      own artifacts.** Verdict: **approve the work; the review cannot close
      the sprint** — `ADR-0021` is still `Proposed` and `PLAN-0005`'s first
      criterion requires a *human* to ratify or reject it. Ratification
      packet is in the review. ~~**S8 stays current until then.**~~
      *(Resolved the same day — see TASK-0068 below.)*)
- [x] TASK-0068 — Ratify `ADR-0021`; close S8 on `REVIEW-0009`
      (done 2026-09-23. **The human ratified as written**, declining three
      alternatives including the clause-5 tightening `REVIEW-0009` proposed —
      so that stays an open follow-up rather than a silent amendment.
      `ADR-0021` is **Accepted — 2026-09-23**, with its two *falsified*
      Context claims preserved as written, because they are the evidence
      that the spike was load-bearing. S8 archived to
      `.ai/planning/sprints/SPRINT-S8-third-party-extensions.md`; `B-019`
      closed, so **S8 cleared its own backlog slice**. **No sprint was
      promoted** — S9/S10 exist as plans (`PLAN-0006`) but are queued, and
      S9 is gated on `ADR-0022` — so `SPRINT-CURRENT.md` now states plainly
      that no sprint is open and lists what is outstanding.)

## Post-S8 (no sprint open)

Opening the next sprint is a human decision. **S9 and S10 are planned**
(`PLAN-0006` — unattended task runs) and queued in `.ai/planning/sprints/`;
S9 is gated on `ADR-0022`, which is `Proposed` and blocked on its own two
spikes. The outstanding queue lives in `.ai/planning/SPRINT-CURRENT.md`.

- [x] TASK-0069 — Sweep two stale second-hand gate-cost claims; re-verify
      the `gather_subset` hazard under `ansible-core` 2.21.4 (done)
- [x] TASK-0070 — One git worktree per concurrent agent session
      (`scripts/worktree.sh`, ADR-0023 `Proposed`) (done)
- [x] TASK-0071 — **B-021**: `test-allowlist`, the eleventh capability term,
      so `qa-test`'s description stops being false. Definition→enforcement→
      emission per ADR-0008; five failure modes each observed failing.
      Raised **B-027** (the `bash_allow` sibling hazard) and corrected the
      authoring guide's claim about **`shell-runner`, a role that has never
      existed** (done)
- [x] TASK-0072 — **B-018**: `install.sh --bionic-project DIR` deploys skills
      to Bionic's **project** target. The global target stays manual — it is
      approval-gated, *and* `$HOME` in WSL is not the home Bionic uses (done)
- [x] TASK-0073 — **B-023**: the conditional wiring-section rule (required
      env, destructive, or a launch the manifest cannot express), gated for
      the two decidable triggers. graphify documented as exempt. **No
      graphify sections were written** — that was the decision (done)

## Sprint S9 — Unattended runs (OPEN — promoted 2026-09-23)

**Promoted by `TASK-0077`**, in the same commit as `ROADMAP.md`'s Phase 9.
The first three ran *before* promotion, because they are the evidence the
`ADR-0022` gate needed and they change no component file — `TASK-0055`'s own
brief says they are *"not blocked by this ADR at all"*.

- [x] TASK-0055 — **Spike.** OpenCode driver surface. **F1 FALSIFIED** —
      `run --agent` cannot select a `subagent`; it falls back to the default
      agent with normal stdout and exit 0. F2 confirmed, F4 confirmed with a
      constraint. `mode: all` is real and `MODES` rejects it (done)
- [x] TASK-0056 — **Spike.** Claude Code boundary surface. **F5 CONFIRMED** —
      a dead `Agent(...)` reference is silent; raised **B-028**.
      `isolation: worktree` left **unsettled**, attempt confounded (done)
- [x] TASK-0057 — `ADR-0022` reconciled with the evidence, six corrections
      made visibly, clause 5 added, **left `Proposed`** (done)
- [x] **GATE — human ratification of `ADR-0022`. CLEARED 2026-09-23**,
      recorded by `TASK-0076`. Ratified **as written**, after the spikes had
      corrected the draft. It unblocked the tasks below **without scheduling
      them**, and **did not promote S9**
- [x] TASK-0058 — Authoring guide: **`mode: all` REJECTED** with a reopening
      condition; `worktree-only` for Claude Code **left open, explicitly**;
      authored-MCP section verified against the template by reading (done)
- [x] TASK-0060 — Registry gains a **Clients** column; `B-026` closed. Also
      corrected `B-026`'s own justification — the separator is the emitter,
      not the closed set (done)
- [x] TASK-0061 — `loops/unattended-run/loop.md`: 14 steps, nine roles, three
      unmerged retry bounds, null refuter **fails closed** (done)
- [x] TASK-0059 — **B-024**: the authored MCP shape's destructive and
      `.env.example` declarations are gated, read from `[tool.ai-toolbox]`
      with `tomllib`; `mode: all` now fails as a named refusal (done)
- [x] TASK-0062 — `skills/unattended-ops/`: SKILL.md, seven references, the
      binding template and a completeness checker proved red-then-green (done)
- [x] TASK-0063 — The four thinking roles. Reported that `read-only` did not
      bind a shell, which is why `TASK-0078` exists (done)
- [x] TASK-0064 — The five acting roles. Seven of nine roles OpenCode-only,
      two portable, as the sprint claimed (done)
- [x] TASK-0078 — **`no-bash`**, the twelfth capability term, so `read-only`
      means what it says (done)
- [x] TASK-0079 — Narrow `git-ops`, on human authorization. Records three
      trailing-flag holes it did **not** close (done)
- [x] REVIEW-0011 — S9's checkpoint. **6 of 7 exit criteria met**; criterion 7
      (the asymmetry in all three wiring snapshots) is **not**, which is the
      gap the pre-committed question was written to catch (done)
- [x] TASK-0080 — Exit criterion 7: the OpenCode-first asymmetry now stated
      in all three `configs/*/README.md`, each naming its own coverage (done)
- [x] TASK-0081 — **Sprint S9 CLOSED** on `REVIEW-0011`, archived to
      `sprints/`, Phase 9 marked COMPLETE in the same commit (done)

**Sprint S9 complete.** Checkpoint: `REVIEW-0011`. All seven exit criteria
met, criterion 7 having been closed by `TASK-0080` **before** closure rather
than closing over it.

## Sprint S10 — Bindings, the gate server, the pilot (OPEN — promoted 2026-09-23)

**Promoted by `TASK-0085`**, in the same commit as `ROADMAP.md`'s Phase 10.
Both ADRs it rests on are `Accepted`. It **allocates no task ids** — one is
taken when a brief is written. **Next free: `TASK-0097`.**

- [x] TASK-0086 — S10.1 — the OpenCode driver, `run-gate.sh` and binding (done —
      proven against a **stub** `opencode` only; 23 tests, 18 reverts red)
- [x] TASK-0087 — S10.2 — the Claude Code Workflow binding (done — stub runtime only;
      23 tests, 18 reverts red)
- [x] TASK-0088 — S10.3 — `mcp-servers/gates/`, the first authored server (done —
      14 tests, 15 reverts red, smoke PASS; **not wired**, by the authorization).
      **Highest risk; authorization signed 2026-09-24** (not wired into clients). Independent of S10.1/S10.2
- [x] TASK-0089 — the gate-invoker rule, `ADR-0025` (done — human's decision;
      loop, role, references and both bindings now agree)
- [ ] S10.4 — the Bionic binding; *establish* the orchestration claim or drop
      it, since the snapshot already records the established coverage
- [x] TASK-0090 — S10.5 — `install.sh link` for both clients, output recorded;
      gates verified connected in Claude Code and OpenCode, then unwired
- [x] TASK-0091 — prune stale emitted agents, `ADR-0026` (done — human's decision;
      `designer-manager.md` pruned from Claude Code by the mechanism)
- [ ] TASK-0092 — S10.7 — **the pilot**: one unattended run, dry run first (target: ai-toolbox)
- [x] TASK-0093 — release-check step 8: record the hash in a follow-up commit, never amend (done)
- [ ] TASK-0094 — refresh the stale opening paragraph of CURRENT_STATE.md
- [x] TASK-0095 — roles read resolved paths, never glob (done — dry-run halt cause)
- [x] TASK-0096 — driver hands preflight its step-1 evidence (done — second dry-run halt)
- [ ] S10.6 — registry and state (effectively done by TASK-0090)
- [ ] REVIEW — checkpoint

## Post-S9 (superseded by the promotion above)

Promoting S10 is a human decision. The outstanding queue lives in
`.ai/planning/SPRINT-CURRENT.md`: two decisions waiting on a human (the three
trailing-flag holes; ratifying `ADR-0023`, which now has its evidence) and
seven carried-forward items. **Next free number: `TASK-0082`.** Promotion is a
      separate human decision and needs `ROADMAP.md`'s Phase 9 in the same
      change (`SPRINT-CURRENT.md` steps 3 and 4)

- [x] TASK-0074 — **B-027**: one entry guard for `bash_allow` *and*
      `test_allow`, and a correction to `TASK-0071` — its wildcard rule
      rejected `*pytest*`, which its own justification did not support.
      Narrowed to the bare `*` while being extended to the second key (done)

- [x] TASK-0075 — **B-028**: `designer-manager` narrowed to opencode, and a
      **cross-role** `delegates_to` gate added — written before the fix and
      **observed firing on the real defect**. `loops/design-brief/` is now
      OpenCode-only, which is the accurate state rather than a new loss (done)

**Backlog after TASK-0073 and the spikes:** `B-018`, `B-021` and `B-023` are
all closed. Unscheduled: **none** — `B-027` closed by `TASK-0074`,
`B-028` by `TASK-0075`. Ready but already scoped into S9 briefs: **B-024**
(`TASK-0059`), **B-026** (`TASK-0060`). Waiting on a second instance rather
than on a planner: **B-025**.

**Task numbering:** `PLAN-0006` reserved **TASK-0055…TASK-0067** for S9/S10,
but only **TASK-0055…TASK-0064** were ever written, and
`SPRINT-S10-unattended-bindings.md` **deliberately allocates no ids at all**
after two sessions collided inside the reserved range in one afternoon. So
the reservation above is stale as stated: S9 holds 0055–0064, S10 holds
none, and **0065–0067 are free**. Post-S8 work has run past the range
instead — 0068 (S8 closure), 0069, 0070, 0071. **Next free: TASK-0072.**

Notes on S8:
- **No new component category, no plumbing, nothing vendored, nothing
  auto-installed.** ADR-0016 declined a `hooks/` category and its three
  plumbing findings were **re-verified 2026-09-16**: four hardcoded
  `emit_section` calls, four hardcoded `validate.sh` roots, a four-column
  `install.sh` table. A new top-level directory is still silently ignored
  by all three and by CI.
- **ponytail cannot be an MCP server, on a checkable fact.** Upstream ships
  `ponytail-mcp/`, which would have been the portable answer — but it is
  `"private": true` and unpublished (npm → *Not found*, 2026-09-16), so
  ADR-0005's external shape has no `launch.command` to record.
- **Two upstream claims were falsified before the sprint began**, both by
  reading source instead of READMEs. That is why the spike is first, and
  why a spike that finds nothing should be read as weak rather than
  reassuring.
- **Two of three deliverables are prose** — the fourth instance of the
  class `mcp-servers/_template/` established and `agents/`/`prompts/`
  repeated. The only defence is ordering. **If the sprint shrinks, cut a
  product, never the spike.**

Notes on S7:
- **The second sprint in a row planned from a human-supplied analysis.**
  Eight of its claims were corrected before planning finished, against six
  in S6. The three that reshaped the plan: half the production stage already
  exists unowned and switched off; agent definitions are **not portable**
  between clients; and Claude Code dynamic workflows cannot accept mid-run
  user input, so they cannot run an interactive design stage.
- **`agent-tiers` is ADR-0004's unfinished half.** That ADR quoted the other
  repo's roadmap naming *both* skills, handed over `project-workflow` alone,
  and said nothing about the second. A decision that handles one item from a
  list of two without saying why the second was left produces an **orphan**
  rather than a deferral — a deferral has a reopen trigger (ADR-0010 has
  one); this had nothing.
- **Phase 2 is four tasks with no user-visible output**, and the most
  skippable-looking work in the sprint. ADR-0016 already recorded what
  "later" has meant for `agents/` and `prompts/`: indefinitely. If the
  sprint shrinks, the honest cut is **Phase 4**, never Phase 2 or Phase 5.
- **Emission has no freshness check and cannot have one.** ADR-0009 forbids
  validating runtime presence. Anyone who "fixes" this by checking the
  deployed copy breaks every fresh clone and CI. ADR-0018 clause 4 exists to
  be cited when they try.
- **Cross-client claims decay faster than internal ones.** Every mapping fact
  was fetched 2026-09-15, not recalled. TASK-0036 must **re-verify rather
  than cite the plan**, and every ADR records the date it read what it read.
- **Four proposals were rejected outright**, each recreating a defect already
  paid for: a second `agent-skills` repo (ADR-0004's three-copies problem),
  in-repo `.claude/skills/` (a second install path), a `workflows/` category
  (`loops/` already exists with enforcement), and `ci-skills-sync.yml`
  (ADR-0009's forbidden runtime check). Recorded in `SPRINT-CURRENT.md` so
  they are not re-raised.
- **Known limitation, stated up front and given a pre-committed review
  question:** this sprint adds two loops, one skill, a category and six or
  **six** roles (design-doc-writer declined, TASK-0043). If TASK-0046 does not run, all of it is scaffolding — the
  **third** instance of the pattern `mcp-servers/_template/` established and
  `agent-tiers` continued. REVIEW-0008 opens with *did anything get
  exercised?*
- **`designer-manager` must be a primary agent**, forced independently by
  Claude Code stripping `AskUserQuestion` from every subagent and by
  OpenCode's `subagent_depth: 1`. Structural, not stylistic.
- **`plan` and `build` can never be `agents/` components.** They are
  OpenCode built-in names, and a markdown agent body *replaces* a built-in's
  tuned system prompt wholesale. Two of the production loop's steps are
  therefore config overrides, not components (TASK-0045 records this).

Notes:
- "Port first MCP server" was split into 0005 (mechanism) + 0007 (payload)
  by `.ai/planning/plans/PLAN-0001-port-ansible-mcp-server.md`.
- S3 ran 0011 before 0010 despite the numbering, so the new commit gate
  would guard an already-corrected generator.
- S4's TASK-0016 was `done` as *documentation*: it turned an uncompletable
  item into a written human procedure. The human then ran that procedure,
  and TASK-0017 records the result — so the pair is the intended shape:
  agent writes the procedure, human executes, agent records the evidence.
  The check passed **and** found a defect (placeholder `WORKSPACE_ROOT`),
  which is the argument for running verifications rather than assuming them.
- **TASK-0019 was missing from this list entirely** until S5's planning
  session added it. It was done, recorded in `SPRINT-CURRENT.md` and in
  `.ai/tasks/`, and simply never checked off here — a small instance of
  exactly the omission class S5 exists to catch, found by reading this
  file rather than by any check.
- S5 is the first sprint since S1 planned from a written plan
  (`PLAN-0002`) rather than a backlog item. Its ordering is a dependency
  chain, not a preference: the skill is canonical (ADR-0004), so its
  shape settles before this repo adopts it, and nothing is enforced
  until the shape stops moving.
