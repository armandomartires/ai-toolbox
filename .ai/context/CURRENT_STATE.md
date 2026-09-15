# Current State

Last updated 2026-09-15, after **parking sprint S6 and opening sprint S7**
(planning only — no implementation yet, in either sprint).

## Sprint S7 is open; S6 is parked with zero implementation

`PLAN-0004` opened Phase 7: a **two-stage agent system** — an interactive
design stage that converges an idea into an accepted, locked brief, and a
largely autonomous production stage that carries it through plan,
implement, test, review and document — plus making `agents/` a real
component category. Seventeen artifacts written, zero components changed:
TASK-0033…0046, ADR-0017…0019, B-014…B-017.

**All three S7 decisions are settled (2026-09-15): ADR-0018 and ADR-0019
accepted, ADR-0017 REJECTED.** Accepting 0019 needed
ratification rather than evidence — it *narrows a stated requirement*,
which is the human's call. Ratification also caught a defect in the ADR's
own text: it said "two clauses" while containing three, corrected in place
rather than silently. **0018 was the opposite case**: it needed evidence,
got it from TASK-0036, and its mechanism survived while its reasoning did
not (detail below). **0017 is a third case: it needed evidence, got it, and
the evidence killed it** — `agent-tiers` stays with
`opencode-customization`, so this repo's first `Rejected` ADR withdraws a
claim rather than declining a proposal.

**TASK-0041 is done — S7's first implementation.** `loops/design-brief/` is
a gated component: **seven** steps rather than the four planned, cap **3**
with its unit stated as one pass through steps 2–6, and the lock mechanism
ADR-0019 left open now decided as **frontmatter plus a dedicated commit** —
the commit being the lock, because a frontmatter field alone can be flipped
by the next agent to open the file. Three gate checks were **observed
failing** on broken copies before the loop was trusted.

Three findings from it that change downstream scope:
- **The executor read-back earned its place.** The draft had the design
  manager committing at step 7, which would have widened that manager's
  blast radius and created a second owner of a concern `git-ops` already
  owns under a guarded boundary. Delegating fixes it, and `TASK-0044`
  inherits the same split rather than inventing one.
- **`design-doc-writer` has nothing to do.** The manager owns the brief
  because it is the only role that has spoken to the human. TASK-0043's open
  question is answered from the sequence side, and the sprint's role count
  is **six, not seven**.
- **`git-ops` is a Phase 3 dependency, not only a Phase 4 one.** It is
  reconciled into `agents/` by TASK-0045, which sits after TASK-0043, so the
  design loop cannot be *executed* end to end until that lands — TASK-0046's
  ordering problem, recorded rather than discovered there.

**TASK-0042 is done — the design stage now has both halves.**
`skills/design-flow/` is the *method* the loop references: a 3.3 KB core
routing to 12.6 KB in `references/` (no budget invented, ADR-0008), plus a
brief template carrying the three lock fields. Three skills now ship.

Its two substantive contributions are the ones that stop the method being
decorative:

- **Distinctness is defined as differing in a load-bearing commitment** —
  one whose change would force *rewriting* rather than *adjusting*. With five
  worked examples of load-bearing (where a fact lives; derived vs declared;
  the unit of deployment; where a boundary sits; enforced vs documented) and
  five of not. Without a test this concrete, step 2 produces variants and the
  critique compares near-identical candidates.
- **A critique carries eight named obligations**, so "found nothing" is a
  claim with content rather than an absence of effort. This is lesson 1's
  shape in content form: an empty critique recorded as a pass is a check that
  cannot fail.

Two findings from it:
- **The read-back found nothing to move**, and no cap number is restated
  anywhere in the skill (verified by grep — every `3` is a step number or
  list index). The sequence-vs-method boundary held under authoring, which is
  the evidence that splitting them across two artifacts was right rather
  than bureaucratic.
- **A gate proof nearly produced a false negative.** The name-mismatch test
  appeared to output nothing — which would have been recorded as "the check
  does not fire," exactly the claim class lesson 1 covers. The check fired
  correctly; the grep matched `NAME MISMATCH`, which is the *loops* check's
  wording, while skills emit `INVALID SKILL: … does not match directory`.
  **When proving a check bites, match on that check's own message or on exit
  status — never on a message remembered from a sibling check.**

**TASK-0036 is done — ADR-0018 is unblocked, its mechanism confirmed and
its reasoning replaced.** All three vendor pages re-fetched 2026-09-15
against installed `opencode 1.18.31` and `claude 2.1.246`. Emission stands,
but on different evidence than the ADR predicted, and four of its stated
facts were wrong.

The finding that changes the design:

- **A superset file is not merely inelegant — it silently drops the safety
  contract.** A fixture declaring read-only using *only* OpenCode's
  `permission:` syntax **loaded in Claude Code with `Write`, `Edit` and
  `Bash` in its tool pool**, while the native-syntax control reported
  `WRITE=no EDIT=no BASH=no`. The block was discarded with no warning. That
  is ADR-0018's predicted emitter bug — *"a `review` agent that can
  edit"* — except a superset file produces it **on every role, with no bug
  required**. Honest limit: the subagent then *refused* to write, on prompt
  grounds, so the breach is the **tool pool**, not a completed write.
- **Five of eight capability terms map to OpenCode only**, and they are the
  five carrying the safety value. Everything needing *intra-tool*
  granularity — which paths, which commands, or an `ask` state — has no
  per-agent Claude Code expression. **`git-ops` and `shell-runner` cannot
  be expressed as Claude Code subagents at all** without a session-wide
  rule or a hook, both outside a single agent file. TASK-0045 inherits a
  scoping problem, not a mapping detail.
- **The lossy direction is OpenCode → Claude Code.** So the abstract
  profile must sit at Claude Code's ceiling for anything it claims to
  enforce in both, and the emitter must **refuse** a term it cannot
  enforce rather than degrade it. That is ADR-0018's one needed new clause.
- **Four of ADR-0018's "established" rows were wrong in four days**:
  OpenCode identity (a `name:` field overrides the filename, undocumented),
  the three-field overlap (`description` is the *only* portable field —
  `model` and `color` overlap in name but their values are mutually
  invalid), unknown-key behaviour (OpenCode **documents** forwarding
  unknown keys *to the provider*, so they are not inert), and
  `.opencode/agent/` singular **also loads**.
- **The installed client is older than the docs describing it.** 6 of the
  35 patch versions the subagent page cites are newer than 2.1.246. A
  doc-confirmed field is not an installed field.

**This task's own log had to be corrected five times**, which is the
recurring lesson arriving inside the task written to guard against it:
a `validate.sh` output invented from memory (`All checks passed, 24 files,
0.39s` — the gate prints `validate.sh: OK`); a permission-key count of
"16/6" that is **15/5** when counted; "11" newer patch versions that is
**6**; one changed `~/.claude/` file when **three** were rewritten; and
worst, **an absence asserted from too small a search** — `subagent_depth`'s
default was recorded *unverified* because it is missing from the agents
page, then found stated verbatim on the *config* page. **The brief named
three pages; the fact was on a fourth.** A negative claim about
documentation is a claim about where you looked.

**ADR-0018 is accepted (2026-09-15), and Phase 2 is unblocked.** Ratified
on TASK-0036's evidence rather than on agreement: the mechanism it proposed
survived, its *reasoning* did not. Four corrections were made in place
(ADR-0019's precedent — a decision whose factual basis changed must show
it), and **one new clause** was added, which is the substantive output:

> **Clause 8 — the emitter refuses; it never degrades.** A capability term
> declares which clients can enforce it. When a role declares a term a
> target cannot enforce, emission for that target **fails loudly** rather
> than dropping or weakening it. Silent degradation would reproduce the
> observed breach *through* the emitter.

Clause 8 also **settles `git-ops` and `shell-runner` as OpenCode-only
roles**, rather than leaving TASK-0045 to meet the problem at
implementation time and reach for a workaround. Both workarounds are
rejected with reasons: a session-wide `permissions.deny` rule leaks one
role's boundary into every agent in the session, and a `PreToolUse` hook
puts enforcement in a second artifact the role file does not own. Either
may return via a later ADR **with a worked example** — never inside an
implementation task.

**Two roadmap staleness items were found and fixed while propagating**, both
instances of lesson 6 rather than new problems: the Phase 7 section still
said ADR-0017…0019 were "all proposed" (two are now accepted), and still
said "seven roles" after TASK-0041 declined `design-doc-writer` and
established six. The phase now carries a decision-status line kept current
in place. **That is the fourth and fifth instance of this class in a file
whose own text records the first three** — still no mechanism, only a
habit of checking.

**TASK-0037 is done — `agents/` is now a *defined* category.** The
`authoring-guide.md` Agents section is its fourth component section: a
9-row frontmatter rule table with a reason per row, a **9**-term capability
vocabulary mapped to both clients, the forbidden-client-native-syntax rule,
a no-budget statement, and Claude Code's 15,000-token description warning
documented as a **vendor threshold, explicitly not gated** (this repo
cannot measure it — it spans roles this repo never emitted). `validate.sh`,
`sync-registry.sh` and `install.sh` are **untouched**, so ADR-0008's
definition-before-enforcement order held.

Four findings, the first of which nearly inverted the task:

- **The brief contradicted ADR-0018, and the ADR won.** The brief (written
  pre-spike) says twice that a term mapping to only one client *"cannot be
  offered"* and *"must be excluded"*. ADR-0018 clause 8.3, written on the
  evidence, says such a term **is** legal — the role narrows `clients` and
  the emitter refuses rather than degrades. **Following the brief would
  have produced a three-term vocabulary and silently discarded the safety
  boundary of every existing role**, since `bash-allowlist` alone is
  load-bearing in all four. Resolved for the ADR: a decision ratified on
  observed evidence outranks a brief written on a prediction. Not
  escalated, because the ADR is accepted and unambiguous.
- **A ninth vocabulary term was missing, found only by testing the
  abstraction against real files.** TASK-0036's table has eight;
  `qa-test`'s `webfetch: ask` is neither `no-webfetch` nor absent. Added
  `webfetch-requires-confirmation`. All four roles now map with **no
  leftover boundary** — verified by script, not by eye.
- **`worktree-only` is *partial*, not OpenCode-only.** The spike said "no
  per-agent equivalent"; Claude Code does have `isolation: worktree`. But
  it is a different guarantee — OpenCode **refuses** calls outside the
  worktree, Claude Code **redirects** into an isolated *copy*. Recorded as
  a semantic gap with the decision assigned to TASK-0040, because **all
  four roles declare this term**, so choosing silently would affect every
  one of them.
- **`color` is dropped from the schema.** ADR-0018 called it "overlap in
  name only"; counted, the value sets share **zero** members
  (`red…cyan` vs hex-or-`primary…info`). A key with no portable value has
  no place in a client-agnostic source.

**A green gate here proves nothing about `agents/` — and that was
*observed*, not asserted.** The template was replaced with unparseable
YAML, no delimiters, an invalid `mode` and a forbidden `permission:` block;
`validate.sh` returned **exit 0**. Restored and confirmed byte-identical by
SHA-256. The inverse of lesson 1: the usual risk is a check that cannot
fail, and here the point was proving a check is genuinely *absent*, so
TASK-0038 is known-necessary rather than presumed so.

**Phase 2 is complete. `agents/` is defined, enforced, indexed and
deployable** (TASK-0037…0040, run in that order after checking they were
safe to sequence rather than parallelise — see below).

- **TASK-0039 (registry)** — two lines plus a comment, which is what B-007's
  centralization was for. Three things proven rather than assumed: the
  template's exclusion comes from **the central skip** (shown by disabling
  it and watching all five templates appear), the section genuinely
  **populates** (a temporary fixture, since an empty header looks correct
  either way), and the registry-integrity checks **extend automatically**
  (observed failing in both directions with correct section attribution).
- **TASK-0038 (the gate)** — a ninth check group, **17 rules each observed
  failing** on a single-rule fixture plus a valid control. `agents/` is no
  longer the only unpoliced category. Runtime 654→606 ms, still sub-second,
  with linear scaling in role count recorded as a known property.
- **TASK-0040 (emission)** — `scripts/emit-agents.py` plus a fourth
  `CLIENTS` column. **All nine capability terms proven per client: four map,
  five refuse for Claude Code** with the remedy named. ADR-0018 clause 8 is
  now executable rather than aspirational.

**Three findings from the sequence that matter beyond it:**

1. **A finding travelled between tasks and was closed by the next one.**
   TASK-0039 discovered that a folded `description: >-` reaches the registry
   as the literal `>-` with the text dropped — and **`validate.sh` passes
   it**, because the column count is still right. It could not fix that
   (wrong task's file), so it handed it to TASK-0038, which now rejects
   folded descriptions two ways. Worth noting the shape: the defect was
   invisible to the check that "covers" the registry.
2. **A fixture harness was unsound on its first run, and its output looked
   like success.** TASK-0038's 17 fixtures each violated the name↔directory
   rule *as well as* their target rule, so every case failed — for the wrong
   reason. A careless reading records "17 for 17 proven". Fixed and re-run
   so each case emits exactly one message. **A fixture meant to isolate one
   rule can violate several, and then the failure proves nothing about the
   rule under test.**
3. **The three tasks were dependency-independent but not safely
   concurrent**, which is why they were sequenced after checking rather than
   run in parallel as first proposed. Two would have edited
   `tests/validate.sh`; and TASK-0038's `agents/_fixture-*` directories are
   **not** covered by the `_template*` skip, so a concurrent TASK-0039
   regeneration would have committed fixture rows into `docs/registry.md`.
   Verified directly — the fixture *did* appear in the registry while it
   existed. In the event TASK-0040 needed **no** `validate.sh` change at
   all, so the file collision never materialised, but that was not knowable
   in advance.

**Two decisions the plan assigned to TASK-0040, both recorded with
reasoning rather than improvised:**
- **`worktree-only` emits Claude Code's `isolation: worktree`.** Not
  equivalent to OpenCode's `external_directory: deny` — refusal versus
  redirection into an isolated *copy*. Emitted anyway because all four
  existing roles declare the term, so refusing would have made every one of
  them OpenCode-only and left the Claude Code emitter dead on arrival. **The
  weakest mapping in the vocabulary; re-examine it first** if roles ever
  behave differently across clients.
- **ADR-0018 clause 7: the emitter emits `{tier:<name>}` and never resolves
  it**, so `models.jsonc` remains the single owner of tier→model. **That
  owner is now permanently in another repo** (ADR-0017 rejected), so the
  placeholder resolves nowhere. Harmless today — `model` is optional and no
  role uses it — and documented in three places. **Do not add a second
  mapping here to close it**; that is the defect clause 7 forbids.

**Emission's two accepted weaknesses, both documented in the client
READMEs rather than patched:** no freshness check is possible (ADR-0009
forbids checking runtime presence, so re-running `install.sh` *is* the
control), and **nothing prunes a stale emitted file** — demonstrated by
emitting a fixture role, deleting it, re-running, and finding the emitted
file still live. An installer that deletes from a user's config directory
needs its own decision, not a convenience.

**Phase 1 is closed — with its reclamation withdrawn rather than
delivered.** TASK-0034 done, ADR-0017 rejected, TASK-0035 cancelled. The
spike written to *prepare* the claim is what **stopped** it, which is the
sprint's "verify before claiming" ordering earning its place rather than
failing. The sprint's ordering principle was amended accordingly:
*reclaim before authoring* → **verify before claiming**.

**TASK-0043 is done — `agents/` now holds three real roles and Phase 2 is
exercised end to end.** `designer-manager` (primary), `ideator` and `critic`
are authored, gated, indexed and emitted; six client files exist where both
directories were empty. **Phase 2's artifacts are no longer plausible-but-
unproven**: the gate passed on real content for the first time, the registry
populated, and the emitter produced output that was *inspected* rather than
assumed.

**`critic` is proved read-only at runtime in both clients** — the task's
highest-consequence risk. Claude Code reports `WRITE=no EDIT=no AGENT=no`
from the subagent's own tool list (contrast TASK-0036's `cc-permonly`
fixture, which *had* Write and merely declined to use it), and OpenCode's
resolver applies all six of its denies. `designer-manager`'s allowlist
resolves deny-first: `task */deny`, then `critic`, `git-ops`, `ideator`.

**Two decisions it settled:**

- **`design-doc-writer` is declined**, on evidence: **zero** references
  across all shipped content. The manager writes the brief at step 4 and
  `git-ops` commits at step 7, so the role would exist to perform a
  mechanical write another role must do anyway. **The sprint's role count is
  six, not seven.**
- **The capability vocabulary needed a tenth term.** TASK-0043's step-2 gate
  found it could not express its central role's boundary — a primary
  delegating to *exactly* three named subagents. Crucially this was a
  **vocabulary gap, not a client limitation**: both clients can enforce an
  allowlist, and `agent-tiers`' own primaries each carry one. Escalated
  rather than worked around, then fixed as **follow-ups to the owning
  tasks** in ADR-0008's order — definition (TASK-0037), enforcement
  (TASK-0038), emission (TASK-0040) — each recorded in its own log rather
  than patched from TASK-0043.

**`delegation-allowlist` carries a schema rule worth knowing:** it requires
`mode: primary`. Claude Code **ignores** an `Agent(...)` type list in a
subagent definition, so a subagent declaring it would be enforced in
OpenCode and **silently widened** in Claude Code — ADR-0018 clause 8's exact
failure mode, now rejected by the gate. It is also the vocabulary's first
**parameterised** term (`delegates_to`), and the first beyond the basic three
that maps to *both* clients.

**TASK-0044 is done — both loops now exist.** `loops/project-build/` is 218
lines, 8 steps, derived from `agent-tiers`' `bmad-workflow.md` **read in
place** (the import never happened — ADR-0017 rejected). Three findings the
brief did not forecast:

- **ADR-0019 requires a step the inherited sequence lacks.** Clause 2.1's
  autonomous list names *document*; `bmad-workflow.md` has seven numbered
  items and **zero** mentions of documentation (verified by grep). Added as
  step 6 and **labelled in the loop as the one addition**, so a reader
  comparing the two files finds an explanation rather than a discrepancy.
- **Separating the two known bounds left a third one missing.** A `review`
  block correctly does not consume the fix-cycle budget — but stated only
  that way, the review path is **unbounded**: block → fix → block, forever.
  Neither `bmad-workflow.md` nor ADR-0019 addresses it. Added: the **same
  finding** surviving three review rounds stops and escalates, because that
  is a `review`-vs-`build` disagreement about what the story requires. **The
  brief anticipated conflating the two bounds; it did not anticipate the gap
  conflation was hiding.**
- **The two-owners question had no available answer from the brief's
  options.** It offered "the loop is authoritative and the skill points at
  it" or the reverse — **both assume this repo can edit the skill**, which
  ADR-0017 settled it cannot. Recorded instead as **two artifacts with one
  shared ancestor, neither updating the other**, with this loop governing
  work in this repo and any divergence a finding to record. Weaker than one
  owner, and stated as such rather than implying a sync that cannot happen.

`release-check` is **referenced, not restated**, for the commit step — with
the caveat that it is scoped to *this* repo and names
`tests/validate.sh`/`sync-registry.sh` directly, so elsewhere it is the
pattern rather than the procedure.

The executor read-back confirmed the sequence is executable under
`subagent_depth: 1`: every subagent step (test, review, commit) is invoked
**by `build`, a primary** — never subagent-to-subagent, which is the natural
way to write it wrong.

**S7's remaining work is TASK-0045, then the pilot.** Both loops are gated
components and **neither can execute yet**: `project-build` names `qa-test`,
`review` and `git-ops`, and `design-brief`'s step 7 delegates its commit to
`git-ops` — all three authored by TASK-0045. That task is now the single
thing standing between the sprint and TASK-0046's pilot, which is what
REVIEW-0008's pre-committed question is about.

**S6 is parked, not closed and not abandoned** (human decision,
2026-09-15). Archived at
`.ai/planning/sprints/SPRINT-S6-ansible-agent-guardrails.md` with a parking
note. Its ten artifacts stay `planned`/`proposed` and B-010…B-013 stay
**ready** — parking a sprint does not un-scope its backlog items. **Parking
cost nothing precisely because nothing had been implemented**; the same
decision one sprint later would have needed reconciliation.

**The second sprint in a row planned from a human-supplied analysis**, and
**eight of its claims were corrected before planning finished** (against
six in S6). In order of consequence:

1. ~~**Half the production stage already exists, unowned**~~ — **the
   "unowned" half of this claim is RETRACTED as false (TASK-0034,
   2026-09-15).** `~/.config/opencode/skills/agent-tiers/` does implement
   `plan → build → qa-test → (fix loop, max 3) → review → git-ops commit`
   with permission-enforced boundaries, it *has* drifted, and it *has*
   never been switched on. But it is **not unowned**:
   `opencode-customization` **deliberately kept it** by explicit user
   decision on 2026-09-13, in commit `9bae137` — *"agent-tiers is
   deliberately kept in this repo (user decision) — confirmed
   OpenCode-specific by design"* — corroborated by that repo's
   `.ai/30.ROADMAP.md:45` and by a written, **unpulled reopen trigger** at
   `:240` (*"Revisit `agent-tiers` → `ai-toolbox` if a concrete reason
   emerges (not scheduled)"*).

   S7 planned from ADR-0004's quotation of that repo's **older** roadmap
   ("`S027` hands `project-workflow` (and `agent-tiers`)") without re-reading
   that roadmap after `S027` actually ran four days later. So this was not
   lesson 9 (an orphan) but **lesson 7 (a decayed claim)** — and the decayed
   claim was a quotation of an *external* document, the class this file
   already flags as fastest-decaying.

   The drift itself is fully characterised and harmless: **two** files
   differ, the **repo copy is newer for both, consistently, from that one
   commit**, and both changes merely remove `project-workflow`
   cross-references. **The installed copy carries no unique fix**, so
   nothing would be lost by preferring either side. Both still declare
   `metadata.version: "1.0.0"`, which remains a real version-integrity
   defect — but in *that* repo's component, not an unowned one. The installed
   copy is a **real directory** where this repo's skills are symlinks, and
   `opencode.jsonc` still contains **no `agent` key**, so the topology has
   never been in effect.

   **DECIDED 2026-09-15 (human): `agent-tiers` stays with
   `opencode-customization`.** ADR-0017 is **Rejected** — this repo's first
   — with a 3-condition reopen trigger. **TASK-0035 is cancelled** (its
   premise is gone, not pending) and **TASK-0045 is rescoped** to *author*
   the three production roles in `agents/` under ADR-0018, reading the
   installed copies as reference. Nothing is imported; nothing in that repo
   changes.

   The "OpenCode-specific" scoping that repo relied on is **substantively
   correct**, not just a boundary of convenience — verified while deciding:
   - `install-tiers.ps1` depends on `plan`/`build` being **OpenCode
     built-in names overridable by config while keeping their tuned system
     prompts**. Claude Code's custom files *replace* a built-in instead, so
     the mechanism does not exist there.
   - **Codex has no per-role agent definition at all** (`codex-cli
     0.154.0`, checked on this machine): `codex agents` browses *sessions*;
     there is no subagent, delegation or task-spawn concept; `--profile`
     layers one whole config bundle, not a set of named roles. ADR-0006's
     situation exactly — the gap is in the client.
   - `git-ops` and `shell-runner` are **inexpressible as Claude Code
     subagents** (TASK-0036), both existing purely to enforce a command
     allowlist.

   Supporting the split: all five dangling cross-repo citations live in the
   *installer* half, and the four role files contain **zero** — verified,
   so the roles are separable from the installer that ships them.

   **One gap the rejection creates, recorded not left to surface:**
   ADR-0018 clause 7 names `models.jsonc` the single owner of tier→model,
   and that file is now permanently in another repo. `emit-agents.py` emits
   `model: "{tier:<name>}"` with **no resolver in this repo**. Harmless
   today — `model` is optional and no role uses it — and documented in the
   authoring guide, the emitter's header and ADR-0017. **Do not close it by
   adding a second mapping here**; that is the two-owners defect clause 7
   exists to prevent.
2. **Agent definitions are not portable between clients.** Location,
   identity (filename vs a required `name` field), capability gating
   (`permission` vs `tools`/`disallowedTools`), primary-vs-subagent (an
   explicit `mode` vs no equivalent field), model IDs, nesting defaults, and
   delegation restriction **all** differ. The overlap is `description`,
   `model`, `color` — **everything that makes an agent safe differs.** This
   is ADR-0006's situation exactly, and its resolution generalizes:
   portability is scoped **per capability**. Hence ADR-0018, before any role
   is authored.
3. **Claude Code dynamic workflows cannot do the design stage.** Their own
   constraints table: *"No mid-run user input — Only agent permission
   prompts can pause a run. For sign-off between stages, run each stage as
   its own workflow."* An interactive design stage is mid-run user input by
   definition. They are also a Claude-Code-only JS runtime, so a component
   built on them is unportable by construction. **Excluded from the
   architecture.**
4. **Subagents cannot ask the user.** Claude Code strips a fixed tool list
   from every subagent regardless of its `tools` field, including
   `AskUserQuestion`. OpenCode reaches the same place via
   `subagent_depth: 1`, under which a subagent cannot spawn workers. So
   `designer-manager` must be a **primary** agent — forced independently by
   each client, structural rather than stylistic.
5. **`agents/` is a declared category with nothing behind it.** A 141-byte
   README is the only file, yet it is named first-class in `AGENTS.md`,
   `README.md`, ADR-0001, `GLOSSARY.md` and `PROJECT_MAP.md`. No template,
   schema, check, registry section or install path. `prompts/` is identical
   at 127 bytes. ADR-0016 already recorded this and drew the right
   conclusion — *"A declared category can exist indefinitely with nothing
   behind it"* — while deciding a different question.
6. **Emission and symlinking are incompatible.** `install.sh:105` deploys
   skills with `ln -sfn`, so a repo edit is live everywhere with no sync
   step. A per-client **emitted** agent file cannot be a symlink — its
   content differs per client by definition. Agents therefore deploy by
   generation only: no `link`, no `copy`. That makes an emitted file a
   fourth copy whose freshness **nothing can verify**, because ADR-0009
   forbids checking runtime presence. The control is idempotent
   regeneration, not a gate.
7. **"No human intervention" collides with four `AGENTS.md` rules** —
   destructive changes need authorization *in the task file*; pushing needs
   `GITHUB_TOKEN` from the environment; the ambiguity policy says stop and
   ask; the definition of done requires a *reviewed* diff. The defensible
   scope is **autonomous within a locked plan, with a mandatory human gate
   before merge and push**. ADR-0019 records it.
8. **Value inverts from the proposal's ordering.** Highest value is
   *reclaiming what already exists*, not authoring new roles; the genuine
   capability gap is the **design** stage, since `agent-tiers`' `plan` writes
   a spec in one pass with no ideation, no critique, and **no convergence
   criterion**.

**Four proposals were rejected outright**, each recreating a defect already
paid for: a second `agent-skills` repo (ADR-0004's three-copies problem);
in-repo `.claude/skills/` and `.claude/agents/` (a self-referential fourth
copy and a second install path competing with the validated one); a
`workflows/` category (`loops/` already is this, with mandatory exit
conditions enforced at `validate.sh:193-213`); and `ci-skills-sync.yml` (a
machine-specific runtime check, forbidden by ADR-0009). Recorded in S7's
`SPRINT-CURRENT.md` "Out of scope" so they are not re-raised.

**S7's known limitation, stated up front and given a pre-committed review
question:** the sprint adds two loops, one skill, a component category and
**six** roles (settled: `design-doc-writer` declined by TASK-0043). **If the pilot (TASK-0046) does not run, all of it is
scaffolding** — and the sprint would have diagnosed that exact pattern in
`agent-tiers` while reproducing it. This would be the **third** instance
after `mcp-servers/_template/` (ADR-0010) and `agent-tiers` itself. Hence
REVIEW-0008 opens with: *did anything get exercised?*

**Two omissions were found and repaired while planning:**
- **The ROADMAP had no Phase 6 section at all.** S6 existed in
  `SPRINT-CURRENT.md`, `TODO.md`, this file and `PLAN-0003`, but never in
  the roadmap — the same drift REVIEW-0007 caught for Phase 5 ("in progress"
  after completion), **recurring one phase after being diagnosed.** That is
  evidence for its finding 6: the lesson needed a mechanism, not more prose.
  No mechanism was added, and it repeated. Recorded in the new Phase 6
  section rather than quietly backfilled.
- **The S6 planning session left no `SESSION-*.md` record and no `INDEX.md`
  row.** ADR-0012's invariant is that a task be startable cold from its own
  file **plus the two index files**, so a missing row is a hole in the
  mechanism this repo relies on for resumability. Reconstructed as
  `SESSION-20260914-0330`, labelled as reconstructed, with unrecoverable
  fields marked rather than guessed.

**Cross-client claims decay faster than internal ones.** Every mapping fact
above was **fetched 2026-09-15, not recalled**, from
`code.claude.com/docs/en/{workflows,sub-agents}` and
`opencode.ai/docs/agents/`. Both clients ship frequently and their docs
already qualify behaviour by patch version in dozens of places. TASK-0036
must **re-verify rather than cite `PLAN-0004`**, and every ADR records the
date it read what it read.

## Sprint S6, as planned and parked — still the plan of record

Everything in this section remains accurate and unexecuted. It is the plan
B-010…B-013 are still scoped against.
`PLAN-0003` opened Phase 6: an **instruct layer** for the `ansible` MCP
server (skill + loop), a narrowing of that server's blast radius, and one
real enforcement. Ten artifacts written, zero components changed:
TASK-0026…0032, ADR-0014…0016 (all **proposed**), B-010…B-013. Opened by
commit `9528d13`, pushed to `origin/master` and confirmed by re-fetch.

**S7's pilot (TASK-0046) delivers TASK-0029 and TASK-0030** — `ansible-ops`
and `ansible-change` — by producing them *through* S7's new loops. Their
disposition afterwards is decided in that task's execution log, deliberately
not pre-empted. **TASK-0031, the highest-value item below, is not delivered
by that pilot**; B-011 stays open. ADR-0014 and ADR-0015 remain unratified
and still depend on TASK-0027, an unrun spike — a gap TASK-0046 must resolve
explicitly rather than gloss.

**The sprint began from a human-supplied analysis rather than a backlog
item** — a first for this repo at the time — and **six of its claims were
corrected before planning finished**. In order of consequence:

1. **There is no staging inventory in the target estate, and there cannot
   be one.** The analysis's central worked example
   (`--check --diff -l staging`, then `-l staging`, then production) is
   unimplementable against one inventory file, one 6-node PVE cluster at
   3-of-4 quorum with no verified margin, and one DC holding all seven FSMO
   roles. The real workflow is **`--check --diff` plus snapshot and
   rollback**. Building from the source text would have produced a runbook
   gating on an inventory that does not exist.
2. **The pinned MCP server exposes 2 of the 7 capabilities the analysis
   recommends** — and they are the two destructive ones. Verified by live
   tool enumeration, not by reading its README.
3. **`ansible_navigator` has no inventory, limit, `--check` or `--diff`
   parameter**, so it cannot perform the safe workflow while it *can*
   execute against production. Human authorized disabling it (2026-09-14).
4. **This repo overstates its own blast radius.** `server.json:22` calls
   `WORKSPACE_ROOT` "the blast radius for the destructive tools below" —
   false for `ansible_navigator` (reaches remote infrastructure) and
   `ade_setup_environment` (installs OS packages system-wide). Restated in
   all three `configs/*/README.md`, so a reader is told the same wrong
   thing four times. **Lesson 6 reappearing inside `mcp-servers/` and
   `configs/`.**
5. **`userMessage` undercuts the determinism argument for MCP.** It is a
   natural-language string the server parses to locate a playbook, so
   invocation is LLM-message-parsed, not schema-pinned.
6. **Value inverts from the analysis's ranking.** Highest value is the
   *guard*, not the skill; MCP is lowest.

**S6's highest-value item is TASK-0031**, and it is not a component. The
target repo's `ansible.cfg:21-48` documents that default fact-gathering
stats `/etc/pve`, which on wedged pmxcfs is an uninterruptible D-state hang
that `timeout` cannot kill; records that **both** global fixes fail
(rejected in `[defaults]`, silently ignored in group_vars — verified
empirically there); and concludes "A code-review or CI check should confirm
this… **Tracked as unenforced until then.**" A written rule, node-hanging
failure mode, statically checkable, enforced by nothing. Being static, it
survives TASK-0028 reporting either way.

**Limitation recorded at plan time, not at checkpoint:** under Option (a)
`ansible-ops` is authored *from* `SIGMA-infrastructure` but never executed
*in* it, so it will end S6 as **unexercised scaffolding — the same status
`mcp-servers/_template/` already carries**. S5's equivalent limitation
surfaced only at REVIEW-0007; this one is stated up front and should be
S6's headline checkpoint finding.

**`SIGMA-infrastructure` is read as evidence and never modified** (human
decision, Option a). Its four stale claims (`.ansible-lint:4`,
`.pre-commit-config.yaml:42`, `ci.yml:13,44`, `requirements.yml:4-6`) and
its 42 unpushed commits are recorded by TASK-0032 and fixed nowhere;
adoption there is that repo's own sprint to open. Its `ansible-lint` gate
has also never had content to lint — `profile: production` is set and
`playbooks/` is not excluded, so it should now be linting two committed
playbooks, but no run has ever been recorded.

Two gate properties discovered while planning, both of which changed the
file layout:
- `tests/validate.sh:456-463` **fails** any file in `.ai/tasks/` not
  matching `TASK-####-*.md`. So the two spikes are **numbered task briefs**,
  not a new `SPIKE-####` artifact type — weakening the gate for a naming
  preference would have been the wrong trade.
- `:402`, `:450-465` require `## Inputs` and `## Outputs / handover`
  non-empty for **every** brief ≥ 0020, including unexecuted ones. So each
  planned brief states an explicitly-labelled *intended* end state; the
  check detects omission, not correctness, and cannot tell the difference.

## Where the project is
- **Phases 1–4 complete, with no outstanding criteria in any of them.**
  S1–S4 are archived in `.ai/planning/sprints/`; checkpoints
  REVIEW-0003…REVIEW-0006. Phase 2's last partial criterion closed
  retroactively by TASK-0017.
- **Phase 5 / sprint S5 complete** (`PLAN-0002`, ADR-0012,
  TASK-0020…0023, checkpoint REVIEW-0007). The skill now states a session
  boundary, a read order and a handover contract; both task templates
  carry `## Inputs` and `## Outputs / handover`; `validate.sh` enforces
  their presence. Skill at `3.1.0`.
- **S5's headline benefit is untested.** All four tasks ran in one
  session, so no `Inputs` table was ever read by a context that had not
  written it. The contract is proven writable and proven to catch stale
  declarations within a session; making a *cold* start cheap remains a
  hypothesis (REVIEW-0007 finding 8). **The next task started after a real
  session gap should record whether its `Inputs` table sufficed.**
- **All three clients are now fully verified** for the ansible MCP server:
  Claude Code `✔ Connected`, OpenCode in live use, and LM Studio verified
  in its own UI (not merely at handshake level).
- B-001…B-008 are all closed. The supposed `main`/`master` default-branch
  mismatch was **retracted as false** by TASK-0019 — it never existed.
- **`.ai/decisions/` filenames are now uniform** (`NNNN-short-title.md`,
  TASK-0024, closing B-008), matching the `project-workflow` convention
  this repo publishes. The *identifier* remains `ADR-NNNN` in every H1 and
  throughout prose — only filenames changed.
- **B-001…B-009 are all closed; eight items are open** — B-010…B-013 (S6,
  still `ready` despite the park) and B-014…B-017 (S7). B-009 closed by
  TASK-0025/ADR-0013 as *decided, not implemented*: its premise — that the
  two skills share a convention — was false. Two of S6's four items (B-012,
  B-013) are corrections to **this repo's own claims** rather than to a
  component. **Two of S7's four (B-014, B-015) describe state _outside_ this
  repo** — a skill living in another repo plus a live machine config, and
  two vendors' file formats. That is a new class here, and it decays faster:
  both must be re-verified at the moment they are acted on.
- **The two skills scaffold two different frameworks, deliberately**
  (ADR-0013). `project-migration`: `context/`, `planning/`, `sessions/`,
  `templates/`, `TASK-####`, `ADR-NNNN-*.md`, entry `AGENTS.md` — **this
  repo runs it** (ADR-0001, `.ai-layout.json`). `project-workflow`:
  `00.CONVENTIONS.md` + `20/30/35` + `reference/`, `S###.T###`,
  `NNNN-title.md`. Nine structural differences. Each `SKILL.md` now names
  the other; do not "align" them.
- Three live components: the `project-migration` (`1.1.0`) and
  `project-workflow` (`3.2.0`) skills (deployed to Claude Code and
  OpenCode), and the `ansible` external MCP server. One loop:
  `loops/release-check`.
- **A fourth skill exists on this machine but not in this repo, and it has
  an owner.** `agent-tiers` (`1.0.0`) is installed at
  `~/.config/opencode/skills/agent-tiers/` as a **real directory**, **owned
  by `opencode-customization` by an explicit 2026-09-13 decision to keep
  it** (TASK-0034), drifted from its source by two files (repo copy newer,
  no unique fix on the installed side), and with its topology never applied
  (no `agent` key in the live config). **It is not "deployed but unowned"** —
  that earlier characterisation was wrong. **ADR-0017 is rejected
  (2026-09-15), so it stays there permanently** unless one of that ADR's
  three reopen conditions is met. Its drift and its unapplied topology are
  **that repo's business, not this one's** — do not "fix" either from here.
- **`agents/` is now a real, fully-plumbed category** (TASK-0037…0040):
  schema, template, gate checks, registry section and per-client emission.
  It holds **no role yet**. `prompts/` remains an empty declared category
  (127-byte README), deliberately left alone — it needs its own
  justification rather than symmetry (B-016).

## What S5 is fixing, and why it is not obvious
The `project-workflow` skill's task template has Goal, Plan, Files
touched, Verification, Status notes. **Nothing names what a task consumes
and nothing names what the next task picks up**, so a task file cannot be
picked up cold in a fresh session. Meanwhile the skill presumes
multi-session work in three places — `00.CONVENTIONS.md:6`,
`reference/size-budgets.md:6`, and the byte budgets themselves, which
exist *because* files are re-read cold — without ever stating a session
boundary or a read order. The presumption is load-bearing and unwritten.

This repo is **ahead of the skill it owns**: `.ai/templates/TASK.md`
already carries `Minimal context`/`Preconditions`/`Dependencies`/
`Expected result`, and `.ai/sessions/` has been a working narrative
bridge for eleven sessions. None of it propagated back, which
`reference/skill-maintenance.md:23-26` requires and ADR-0004 makes this
repo's job. The skill is not behind through neglect of the skill — it is
behind because nobody checked the repo's own practice against it.

## Infrastructure now in place
- **Remote:** `origin` → `armandomartires/ai-toolbox`, **private**, wired by
  TASK-0015 from `GITHUB_URL`/`GITHUB_TOKEN`. Remote URL is token-free and
  must stay that way.
- **CI:** `.github/workflows/validate.yml` is **verified** — run #1 passed
  all 7 steps. It re-runs `validate.sh` and the registry-staleness check.
  A second opinion, not the gate.
- **Commit gate:** `tests/validate.sh` via `.githooks/pre-commit`. Offline,
  hermetic, ~0.37 s, and passes with the entire environment unset. All three
  properties are load-bearing.
- **Environment:** `.env.example` documents every variable (names and
  meanings only, never values). Copy to `.env` (gitignored). Nothing is
  needed for local development or validation.
- **Licensing:** MIT `LICENSE` at the repo root, backing both skills'
  `license: MIT` frontmatter.

## What `validate.sh` enforces
Skill frontmatter (parsed, not grepped: delimiters, name/directory equality,
single-line description, non-empty license, semver version) · MCP shape and
manifest integrity incl. destructive-capability authorization · loop
structure incl. mandatory exit conditions · every `install.sh` client having
a `configs/*/README.md` · the pre-commit hook's git-recorded mode · no
`_template` row in the registry · registry content integrity (no leaked
YAML quotes, no unescaped `|` in a cell, column count matching each
section's own header) · every manifest-required env var appearing in
`.env.example` · **handover sections** — `.ai/templates/TASK.md` carries
`## Inputs` and `## Outputs / handover`, and every task brief numbered
≥ 0020 (walked recursively, including `completed/`) has both, non-empty.

**What the handover check does not prove:** that declared inputs are the
real inputs, or that a declared end state matches the tree. It detects
omission, not correctness. A green gate means no section is missing or
empty — nothing more (ADR-0012 Decision 3; ADR-0009).

## Known gaps — recorded, not hidden
- **`skills/project-workflow/templates/00.CONVENTIONS.md` is 3087 bytes
  against its own declared ≲3 KB (3072) cap.** Fifteen bytes over, and
  nobody had measured it — the budget was stated in the file's header and
  never checked. Found while reading for PLAN-0002. TASK-0020 pays it by
  moving content to `reference/`, because
  `reference/size-budgets.md:35-38` forbids raising a cap to fit what is
  already there.
- **Hand-maintained tables in `.ai/` are unchecked.** `validate.sh`
  verifies column counts and pipe escaping in the *generated*
  `docs/registry.md` (TASK-0018), while B-004's row in
  `.ai/planning/BACKLOG.md` had sat *outside* its own table since
  TASK-0013 appended instead of inserted. Fixed by S5's planning session.
  The defect class was fixed downstream and live upstream the whole time.
  Not proposed as a new check — noted so the asymmetry is known.
- **The authored (Python) MCP shape has never run.** Only
  `mcp-servers/_template/` uses it and `smoke-mcp.sh` covers external
  manifests only. Deferred **by decision** with a reopen trigger — ADR-0010.
  Treat `mcp-servers/_template/` as unverified scaffolding. Do not re-add
  this to a candidate list.
- ~~**Default branch mismatch.**~~ **Not a gap — retracted as false**
  (TASK-0019, 2026-09-13). `default_branch` is `master` and `main` never
  existed. The claim came from reading a repo-creation response field that,
  with `auto_init: false`, reports the account's default branch *name
  preference* rather than an existing ref. Kept visible because the error
  pattern matters more than the non-gap: **a claim about external state
  restated three times without re-verification, each time more specific.**
- `opencode-customization` (a separate repo) has a stale project-workflow
  copy and an unresolved `S025_WorkflowHarmonization` sprint — that repo's
  follow-up, not this one's, per ADR-0004.
- `skills/*.zip` sit untracked: pre-existing artifacts, deliberately
  untouched.

## Standing decisions not to re-litigate
ADR-0002 symlink-first · ADR-0003 skill frontmatter schema · ADR-0004
ai-toolbox is canonical for project-workflow · ADR-0005 (+Clarification) two
MCP shapes, *derived* from which marker file is present · ADR-0006 LM Studio
is MCP-only, and loops are authored not ported · ADR-0007 local git
mandatory / remote recommended, automation is hook-first · ADR-0008 skill
linting is frontmatter-only, no invented line budget · ADR-0009
configuration is environment-supplied and validation checks documentation
completeness, never runtime presence · ADR-0010 Python MCP shape deferred ·
ADR-0011 registry validation is deterministic and hermetic, never
subagent-driven — a subagent cannot gate a commit · ADR-0012 task handover
is an explicit contract, **resumability** is the mandatory invariant while
one-task-one-session is only the default, and the handover check detects
omission rather than correctness.

Also settled: ansible's destructive tools are human-authorized (2026-09-13)
to ship enabled, disclosed in the manifest and every wiring snippet, and
enforced by `validate.sh`; its launch command is version-pinned so upstream
breaking changes cannot land silently.

## Environment notes (re-verified 2026-09-13)
- ansible MCP connects, 10 tools. proxmox still lacks `numpy` for its
  router; obsidian's desktop app still isn't running.
- Upstream ansible declares `node>=24.0` while this machine runs node
  v22.23.2 — npm warns `EBADENGINE` and it works, because `engines` is
  advisory unless `engine-strict` is set. If that changes, ansible launches
  break with no repo-side change.
- **`core.filemode=false` on this `/mnt/c` checkout**, and the 9p mount
  reports every file `rwxrwxrwx` while ignoring `chmod -x`. So `chmod +x`
  never reaches git's index and `[ -x ]` can never fail. Use
  `git update-index --chmod=+x`; `install.sh` warns and `validate.sh` fails
  on the mode git *records*. Full explanation in the runbook.

## Lessons that keep recurring
1. **A check that cannot fail is worse than no check, because it is still
   trusted.** Prove every new check fails for the right reason. Corollary
   from TASK-0017: **a green connection is not a validated configuration.**
   The ansible server connected and enumerated all 10 tools with
   `WORKSPACE_ROOT` set to a nonexistent placeholder path, because nothing
   in the MCP handshake touches the filesystem.
2. **An item can look blocked when it is merely undocumented.** S4 found two
   (the remote, and B-002's mis-titled scope). Check which before carrying
   anything forward again. Corollary from TASK-0018: **an item's age is not
   an argument for implementing it.** B-001 and B-002 were both scaffold
   boilerplate; one held a real requirement, one did not. Scope each on its
   merits — but *do* scope it, because scoping B-001 found two defects even
   though the item itself was closed as superseded.
   **Now four for fourteen** (B-001 superseded, B-002 split, B-009 false
   premise, **B-014 false premise**): a backlog item's *title* encodes an
   assumption, and roughly a third of them do not survive contact with the
   files. B-009 was the sharpest case — written one task earlier, by this
   agent, from a single grep hit, proposing to change the scaffold that
   produced the very structure the repo runs. **B-014 is now sharper
   still**: its title asserted `agent-tiers` was *unowned*, an entire sprint
   phase was ordered around reclaiming it, and the premise was false the
   whole time because it rested on a **four-day-old quotation of another
   repo's roadmap**. **Read the artifacts before estimating the work — and
   when the artifact is in another repo, re-read it rather than the
   quotation.**
3. **The obvious check is often the wrong one.** "Is the env var set" and
   `grep -q '^name:'` both looked reasonable and both would have been
   useless or harmful.
4. **A criterion written at scaffold time may meet reality and lose.**
   ADR-0005 through ADR-0010 all exist for that reason.
5. **A test that clones for isolation may isolate itself from the change it
   verifies** (TASK-0014's first harness reported clean against the old
   script).
6. **A budget nobody measures is not a budget.** `00.CONVENTIONS.md`
   declared ≲3 KB in its own header and sat 15 bytes over it; Phase 4's
   roadmap header read "in progress" after every criterion was met;
   TASK-0019 was done but never ticked in `TODO.md`; B-004's table row had
   fallen out of its table. Four independent instances, all found by
   *reading* the governance files during S5 planning rather than by any
   check. The pattern: **the governance layer polices components and
   nothing polices the governance layer.** That is the argument for S5, and
   also the caution against over-trusting the check S5 adds.
   **Recurred immediately:** Phase 5's own roadmap header read "in
   progress" after every criterion was met, fixed by REVIEW-0007. The
   lesson needs a mechanism, not more prose.
   **Recurred again, worse:** the roadmap had **no Phase 6 section at all**
   while S6 was planned, opened, committed and pushed — found by TASK-0033
   one sprint later. The same session also found the S6 planning session had
   left no `SESSION-*.md` record. No mechanism was added after REVIEW-0007
   said one was needed, so the class recurred twice in two sprints. **Still
   nothing prevents a third.**
7. **A claim decays between being written and being acted on.** S5's four
   tasks each found a false claim in their own inputs — a stale symlink
   assertion, a false premise in ADR-0012, a four-way merge that would
   have destroyed narrative, and an escape hatch in the new check. Three
   had been written by the same agent one session earlier. Not
   carelessness: **planning prose is a hypothesis about files, not a
   description of them.** Open the file named in a declaration.
8. **Knowing "a check that cannot fail is worse than no check" does not
   prevent authoring one.** PLAN-0002 specified two deployment checks that
   compare a symlink with its own target; they were written in the sprint
   that cites this very lesson, by an agent that had just restated it.
   The control is not knowing the rule — it is running the check against
   a deliberately broken input before trusting it.
9. **A decision that handles one item from a list of two, without saying why
   the second was left, produces an orphan rather than a deferral.**
   ADR-0004 quoted the other repo's roadmap naming **both**
   `project-workflow` and `agent-tiers`, handed over the first, and said
   nothing about the second. A deferral has a reopen trigger — ADR-0010 has
   one, and it is explicitly *not* pulled. **When a decision narrows a list,
   record what happened to the remainder.**

   **The lesson stands; its worked example was wrong, and the correction is
   more instructive than the original.** S7 read ADR-0004's silence as an
   orphan and planned a reclamation around it. TASK-0034 found the *other*
   repo had closed the gap itself four days later (commit `9bae137`,
   2026-09-13): a stated reason, a scope banner, and a written reopen
   trigger — a textbook deferral. **The orphan existed only in this repo's
   copy of the story.** So the real failure was not ADR-0004's omission but
   **acting on a four-day-old quotation of an external document without
   re-reading the source** — lesson 7, in the class this file already calls
   fastest-decaying. Two lessons pointed at the same facts and the wrong one
   was applied, because the orphan reading was the one this repo had a name
   for.
10. **An unexercised artifact is the repo's most reliable failure mode.**
    `mcp-servers/_template/` (ADR-0010) established it, `agent-tiers`
    continued it — installed, drifted, never switched on (though **owned**;
    see lesson 9's correction) — and S7 is
    structured to avoid being the third instance, with a pilot that produces
    real components and a pre-committed review question. The pattern is
    common enough that a plan adding new component surface should now name,
    at plan time, **what will exercise it**.

## Validations
`tests/validate.sh` (mandatory, automatic via hook) · `scripts/sync-registry.sh`
· `tests/smoke-mcp.sh` (network-dependent, manual, PASS/FAIL/SKIP as three
distinct outcomes — a SKIP is not a pass) · CI on every push.

Validated in WSL (development). Deployment targets: local agent clients via
`scripts/install.sh`.
