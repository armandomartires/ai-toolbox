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

## Sprint S6 — Ansible agent guardrails (PARKED 2026-09-15)
Planned by `.ai/planning/plans/PLAN-0003-ansible-agent-guardrails.md`;
decisions ADR-0014…0016 (all **proposed**, none accepted yet). Raised
B-010…B-013. **Planning only — no implementation, ever.** Sprint opened by
commit `9528d13`, pushed and confirmed.

**Parked by TASK-0033**, not closed and not abandoned. Human decision,
2026-09-15; S7 opened instead. Archived at
`.ai/planning/sprints/SPRINT-S6-ansible-agent-guardrails.md`. Every box
below stays unchecked and B-010…B-013 stay **ready** — parking a sprint does
not un-scope its backlog items. Parking cost nothing because nothing had
been implemented.

**S7's pilot (TASK-0046) delivers TASK-0029 and TASK-0030** by producing
`skills/ansible-ops/` and `loops/ansible-change/` *through* S7's new loops.
Their disposition afterwards — closed as delivered-by-S7, rewritten, or left
parked — is decided in TASK-0046's execution log, deliberately not
pre-empted. **TASK-0031, the highest-value item, is not delivered by that
pilot**; B-011 stays open.

Phase 0 (independent of each other, may run in parallel):
- [ ] TASK-0026 — Correct the `WORKSPACE_ROOT` blast-radius claim; disable
      `ansible_navigator` in 3 wiring snippets; LM Studio → models-only
- [ ] TASK-0027 — *Spike.* Lint the two real playbooks on a `/tmp/opencode/`
      copy; record what degraded; choose the guard's home
- [ ] TASK-0028 — *Spike.* Can a Claude Code `PreToolUse` hook match
      `mcp__ansible__*`? OpenCode's equivalent? Non-blocking

Phase 1 — decisions (each depends on its spike):
- [ ] ADR-0014 — Accept and narrow the MCP surface (needs TASK-0027)
- [ ] ADR-0015 — Portable core + templates; check+snapshot, not staging
      (needs TASK-0027)
- [ ] ADR-0016 — Hooks as a category, expected "no" (needs TASK-0028)

Phase 2 — instruct layer (ordered; the skill settles the vocabulary):
- [ ] TASK-0029 — `skills/ansible-ops/` (needs ADR-0015)
- [ ] TASK-0030 — `loops/ansible-change/` (needs TASK-0029)

Phase 3 — enforcement and record:
- [ ] TASK-0031 — The `gather_subset` guard + 5 fixture proofs (needs
      ADR-0016, TASK-0027). **The sprint's highest-value item**
- [ ] TASK-0032 — Record the target-repo findings; state what was
      deliberately left alone (needs TASK-0029)

**B-010…B-013 remain open and `ready`** despite the park, all raised by
PLAN-0003 and all still scoped against the S6 task numbers above.
B-001…B-009 remain closed. S7 raised B-014…B-017, so **eight items are open
in total**.

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
  TASK-0032 and fixed nowhere. **Still binding under S7** — parking does not
  relax it.

## Sprint S7 — Design and production agent loops (open)
Planned by `.ai/planning/plans/PLAN-0004-design-and-production-agent-loops.md`;
decisions ADR-0017…0019 (**0019 accepted 2026-09-15**; 0017 and 0018 still
proposed and blocked on their spikes). Raised B-014…B-017. **Planning only
so far — no implementation.** Sprint opened by TASK-0033.

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
- [ ] ADR-0017 — ~~ai-toolbox owns `agent-tiers`~~ **BLOCKED: do not accept
      as drafted.** Its premise is disproved. Three options with a
      recommendation (**option 3**: take the four *roles* into `agents/`
      under ADR-0018, leave the PowerShell installer where it was
      deliberately kept) are in TASK-0034's log. **Human decision required**
- [ ] TASK-0035 — ~~Import to `skills/agent-tiers/`~~ **blocked, and its
      justification is gone**: importing would create the second copy
      ADR-0004 exists to prevent, *against* the other repo's recorded
      decision. Do not start until ADR-0017's disposition is decided
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
- [ ] TASK-0043 — Roles: `designer-manager` (**primary**), `ideator`,
      `critic`, `design-doc-writer` (needs TASK-0040, TASK-0042)

Phase 4 — the production half, owned here:
- [ ] TASK-0044 — `loops/project-build/` — from `bmad-workflow.md:8-38`,
      with the merge gate explicit (needs ADR-0019; **its TASK-0035
      dependency is dropped** — TASK-0034 verified `bmad-workflow.md` is
      readable in place at 53 lines with every cited section present, and the
      dependency was for read access only)
- [ ] TASK-0045 — Reconcile `qa-test`/`review`/`git-ops` into `agents/`.
      **Reconcile, not duplicate** (needs TASK-0040, TASK-0044)

Phase 5 — exercise it:
- [ ] TASK-0046 — **Pilot.** Run both loops to produce S6's `ansible-ops`
      and `ansible-change` (needs TASK-0043, TASK-0045). **The task that
      decides whether S7 delivered anything**

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
  seven roles. If TASK-0046 does not run, all of it is scaffolding — the
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
