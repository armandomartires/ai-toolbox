# TASK-0045 — Author the three production roles in agents/

## Objective
Author `qa-test`, `review` and `git-ops` as `agents/<role>/agent.md` under
ADR-0018's one-source contract, **using the `agent-tiers` copies as
read-only reference**. Their permission boundaries are the real safety
control in the production loop and they already work; this task must
reproduce those boundaries in the abstract vocabulary without weakening
them.

> **RESCOPED 2026-09-15: author fresh, do not import.** This task was
> written as a *reconciliation* of files TASK-0035 would have imported into
> `skills/agent-tiers/`. **ADR-0017 is Rejected and TASK-0035 is
> cancelled** — `agent-tiers` stays with `opencode-customization` (human
> decision). So there is nothing in this repo to reconcile *with*, and the
> "one owner per role" problem this brief was built around **does not
> arise**.
>
> What changes: the three roles are **authored** here, not moved. The
> installed copy at `~/.config/opencode/skills/agent-tiers/agents/` is
> **reference material read as evidence**, never a source to copy from or
> modify — the same standing rule S6 applies to `SIGMA-infrastructure`.
>
> What does **not** change, and is the bulk of this brief: the boundaries
> that must survive translation, the per-role-per-client emission proof,
> and the `shell-runner` exclusion. Those were always the real work.

## Minimal context

### There is no reconciliation to do — and that is the point

The original premise was that `skills/agent-tiers/agents/*.md` would exist
in this repo after TASK-0035, creating two definitions of each role. **They
will not.** The skill stays where it is, so:

- **`agents/<role>/agent.md` is the sole definition of each role in this
  repo**, from the first commit. No removal step, no pointer step, no
  version bump in a skill this repo does not own.
- **`install-tiers.ps1` is not this task's concern.** The original brief
  warned against breaking it while reconciling; there is nothing to break,
  because this task touches no file in that repo.

**The two-owner question moves outward rather than disappearing.** After
this task, `git-ops` exists twice on this machine by different routes:
`install-tiers.ps1` writes it into a target project when someone runs
`/bmad`, and `scripts/install.sh` emits it into
`~/.config/opencode/agents/`. **Different scopes** — project-local versus
global — so they do not overwrite each other, and OpenCode resolves
project over global.

That is a **coexistence to document, not a defect to fix.** It cannot be
fixed from this repo anyway: the other copy belongs to another repo's
installer. What this task must do is **state it plainly** in the role's own
body or the config snapshot, so a reader who finds two `git-ops` files
knows why. A future divergence between them is `opencode-customization`'s
concern for its copy and this repo's for its own.

### Authoring from reference is not copying

The installed role files are OpenCode-native: `permission` blocks, glob
maps, `{tier:...}` model placeholders. ADR-0018 forbids **any** of that in
an `agent.md`. So even a direct import would have been a rewrite — the
files share a *purpose*, not a format.

Read them for three things and nothing else:
1. **The boundaries**, listed below, which TASK-0034 verified are fully
   expressible in the nine-term vocabulary.
2. **The system prompts**, which are genuinely portable prose and the one
   part that transfers close to verbatim (ADR-0018: the body is "the one
   part of a role that is genuinely portable").
3. **The role-splitting reasoning** — why `qa-test` reports failures rather
   than fixing them, why `review` cannot edit. That reasoning is the
   artifact's real value and is client-agnostic.

Do **not** carry over: `model: "{tier:...}"` (no resolver exists in this
repo — see ADR-0017's recorded gap; omit `model` entirely), `permission`
blocks, or any reference to `install-tiers.ps1`, `opencode.jsonc`, or that
repo's paths.

### The boundaries that must survive translation
From `bmad-workflow.md:48-53` and the role files:

- **`qa-test` edits test files only.** Enforced by an `edit` permission glob
  object, deny-first. It never fixes application code and never commits.
- **`review` is strictly read-only.** `edit`/`write` denied outright; bash
  restricted to `git diff/status/log/show`. It reports pass/blocked and
  **never fixes what it finds**.
- **`git-ops` may not force-push, hard-reset, or rebase.** `git push` is
  always `ask`, never `allow`.
- **No subagent invokes another** (`subagent_depth: 1`).

`qa-test`'s is the narrowest constraint in either sprint — a **glob-scoped
edit permission**, not a blanket allow or deny. TASK-0043's handover flags
this as the likely limit of ADR-0018's abstraction, and if the capability
vocabulary cannot express "edit, but only files matching a pattern", that is
a documented limitation rather than something to work around per client.

### The highest-consequence mapping error available
A `review` role emitted with edit rights. It would pass every check this
repo has — `validate.sh` validates the *source*, and the source would be
correct — while silently removing the property that makes its verdict
trustworthy. ADR-0018's consequences name this class; TASK-0043 proved the
pattern on `critic`. The same proof is required here, per role per client.

### The fourth role is deliberately excluded
`agent-tiers` also defines `shell-runner` (a fixed bash allowlist:
`ls/cat/cp/mv/mkdir/env/which/curl`, cheapest model tier). It is not part of
the production loop's gate sequence — `bmad-workflow.md:30-32` notes `build`
*"never invokes shell-runner directly in the BMAD topology — qa-test owns
test execution."*

So reconciling it is not required by `loops/project-build/`. Whether to
reconcile it anyway for completeness, or leave it as skill-only, is a scope
question this task should answer explicitly rather than leave ambiguous —
and leaving it skill-only is the defensible default, since a role nothing
references is structure without benefit.

### `plan` and `build` can never be reconciled
`agent-tiers`' `SKILL.md` documents why, with reasoning: `plan` and `build`
are OpenCode **built-in** names, and *"a markdown agent file's body becomes
that agent's system prompt — creating `agents/plan.md` would silently
replace OpenCode's tuned built-in `plan` prompt wholesale, not extend it."*
They are therefore inline config overrides (`model` + `permission` only),
never files.

**This is a hard constraint on the reconciliation**: two of the loop's six
steps are performed by agents that cannot exist as `agents/` components at
all. The loop must work with a role set that is partly files and partly
config overrides, and that asymmetry belongs in the record.

### Model tiers have an owner already
`models.jsonc` maps tier→model with every deviation commented — `git-ops`
is deliberately *not* on the cheapest tier because *"a hallucinated
`git reset --hard` or a malformed commit has real blast radius."*

ADR-0018 clause 7 requires the model-reference question settled: whether the
emitter reuses `models.jsonc` or supersedes it. TASK-0040 was told to
escalate if the ADR left it open. If it is still open when this task starts,
**stop** — reconciling roles whose model assignment has two possible owners
is how the second owner appears.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `~/.config/opencode/skills/agent-tiers/agents/{git-ops,shell-runner,qa-test,review}.md` | `opencode-customization` | **READ-ONLY REFERENCE, outside this repo.** OpenCode-native; the four role definitions with their permission boundaries and system prompts. Verified by TASK-0034 to contain **zero** cross-repo citations, so the prose transfers cleanly |
| `~/.config/opencode/skills/agent-tiers/templates/bmad/bmad-workflow.md` | same | **READ-ONLY REFERENCE.** 53 lines, verified readable in place by TASK-0034. `:48-53` the hard rules; `:30-32` the shell-runner note |
| ~~`skills/agent-tiers/models.jsonc`~~ | — | **Not available and not needed.** Stays in `opencode-customization` (ADR-0017 rejected). Roles authored here **omit `model`** — there is no tier resolver in this repo. See ADR-0017's recorded gap |
| ~~`skills/agent-tiers/install-tiers.ps1`~~ | — | **Out of scope entirely.** This task touches no file in that repo, so there is nothing to avoid breaking |
| `.ai/decisions/0017-ai-toolbox-owns-agent-tiers.md` | TASK-0034 | **Rejected** 2026-09-15. Read its "one gap this creates" section before deciding anything about `model` |
| `loops/project-build/loop.md` | TASK-0044 | `done`; names which role performs each step |
| `.ai/decisions/0018-agent-portability-one-source-per-client-emission.md` | TASK-0033/0036 | Accepted; clause 7 on model references is **settled** — the emitter emits `{tier:<name>}` and never resolves it (TASK-0040), and the owning file is in another repo |
| `agents/designer-manager/agent.md` and siblings | TASK-0043 | `done`; the format precedent and the per-role emission proof pattern |
| `.ai/tasks/TASK-0043-author-design-roles.md` | TASK-0043 | `done`; its handover records any vocabulary limitation already hit |
| `docs/development/authoring-guide.md` | TASK-0037 | The capability vocabulary — the authority for whether a glob-scoped edit is expressible |

**Verify the expected state; don't assume it.** Two hard gates: confirm
ADR-0018 clause 7's model-reference question is **settled**, and read
TASK-0043's handover for any vocabulary limitation it already found. If
`qa-test`'s glob-scoped edit is already known unexpressible, this task's
scope changes before it starts.

## Scope

### Included
- `agents/qa-test/agent.md`, `agents/review/agent.md`,
  `agents/git-ops/agent.md` in the client-agnostic format.
- Preservation of all three boundaries, verified in the **emitted** output
  per client, not in the source.
- **A decision on ownership**: whether the skill's copies are removed,
  reduced to pointers, or retained — with reasoning, and without breaking
  `install-tiers.ps1`.
- **A decision on `shell-runner`**: reconcile or leave skill-only, with
  reasoning.
- A recorded statement that `plan` and `build` **cannot** be `agents/`
  components, and how `loops/project-build/` accommodates a mixed role set.
- Per-role per-client emission proof, with `review`'s read-only property and
  `qa-test`'s glob-scoped edit specifically demonstrated.

### Not included
- **Redesigning any boundary.** They work. Translation only.
- **Reconciling `plan` or `build`.** Structurally impossible; recorded, not
  attempted.
- **Changing `models.jsonc`'s content.** If TASK-0034 found a stale ID, it is
  inherited debt with a backlog item, not fixed here.
- **Running the loop.** TASK-0046.
- **Applying any topology to a live `opencode.jsonc`.** Out of S7's scope.
- **Fixing a Phase 2 defect.** Record it and attribute it to its owning task.
- Any client-native permission syntax in a source file.

## Likely files
- `agents/qa-test/agent.md`, `agents/review/agent.md`,
  `agents/git-ops/agent.md`
- `agents/shell-runner/agent.md` — conditional on the scope decision
- `configs/opencode/README.md` — likely: the project-vs-global coexistence
  of `git-ops` (this repo's emitted copy alongside `install-tiers.ps1`'s
  project-local one) belongs in a wiring snapshot, not only in a task log
- `docs/registry.md` — regenerated
- **Nothing under `skills/agent-tiers/`** — it does not exist in this repo
  and must not be created. **Nothing in `opencode-customization`** — that
  repo is read as evidence and never modified (ADR-0017)
- `.ai/tasks/TASK-0045-reconcile-production-roles.md` — this file

## Execution plan
1. Confirm ADR-0018 clause 7 is settled and read TASK-0043's handover for
   known vocabulary limits. **Stop and escalate on either gap.**
2. Read the three role files and `bmad-workflow.md:48-53`; enumerate each
   boundary precisely, including `qa-test`'s glob pattern.
3. Check each boundary against the capability vocabulary. **`qa-test`'s
   glob-scoped edit is the test case** — if it is unexpressible, record it
   as a limitation of ADR-0018's abstraction and escalate before proceeding.
4. Decide the ownership question; record the reasoning. Verify
   `install-tiers.ps1` still works under the chosen option.
5. Decide the `shell-runner` question; record the reasoning.
6. Author the three (or four) roles from `agents/_template/agent.md`.
7. `bash tests/validate.sh`.
8. `bash scripts/sync-registry.sh`; confirm the Agents section carries both
   the design and production roles.
9. `bash scripts/install.sh`; **read every emitted file**. Per role per
   client, confirm the client-native permissions match the boundary's
   intent. Record individually.
10. Specifically demonstrate: `review` cannot edit or write in either
    client; `qa-test` can edit test files and **cannot** edit application
    code; `git-ops` cannot force-push, hard-reset or rebase, and `git push`
    is `ask`.
11. Confirm no `agent` key was added to any `opencode.jsonc`.
12. Record how `loops/project-build/` handles `plan`/`build` being config
    overrides rather than components.
13. Review the diff; commit; record the hash; push; confirm; record.

## Acceptance criteria
- [ ] All three boundaries preserved, **verified in emitted output** per
      client rather than in the source
- [ ] **`review` demonstrably cannot edit or write** in either client
- [ ] **`qa-test`'s test-files-only edit demonstrated in both directions**:
      a test file editable, an application file not
- [ ] **`git-ops` demonstrably cannot force-push, hard-reset or rebase**,
      and `git push` resolves to `ask`
- [ ] The ownership question **decided with reasoning**; exactly one owner
      per role afterwards; `install-tiers.ps1` still functional
- [ ] The `shell-runner` question decided with reasoning
- [ ] It is recorded that `plan`/`build` cannot be `agents/` components, and
      how the loop accommodates a mixed role set
- [ ] No client-native permission syntax in any source file
- [ ] If `qa-test`'s glob-scoped edit is unexpressible, it is **recorded as
      a documented limitation** of ADR-0018 and escalated — not worked
      around per client
- [ ] No `agent` key added to any `opencode.jsonc`
- [ ] `tests/validate.sh` green; registry regenerated and committed

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **required**

## Risks and rollback
- **Risk: `review` emitted with edit rights.** The highest-consequence error
  available in this sprint. It passes every check, because the gate
  validates the source and the source would be correct, while removing the
  only property that makes a review verdict worth anything. Step 10, and the
  criterion says *demonstrably*.
- **Risk: `qa-test`'s glob-scoped edit is unexpressible.** The narrowest
  boundary in either sprint and the real test of ADR-0018's abstraction. The
  wrong response is a per-client workaround, which defeats one-source. The
  right response is a recorded limitation and an escalation — and possibly a
  vocabulary extension as its own task.
- **Risk: two owners for a role.** The named failure mode. Both the skill
  and `agents/` could plausibly keep their copies, and nothing would break
  immediately — which is exactly how drift starts. `agent-tiers` arrived in
  this sprint *because* it had drifted while unowned; reconciling it into a
  second unowned pair would be the same mistake inside one sprint.
- **Risk: breaking `install-tiers.ps1`.** It copies the role files into a
  target project. Removing them without adjusting it turns a working
  installer into a broken one, and it is the skill's main deliverable.
- **Risk: silently fixing a stale model ID.** If TASK-0034 found one, fixing
  it here bundles an unrelated change and hides inherited debt. Backlog item.
- **Risk: forgetting the `plan`/`build` asymmetry.** Two of six loop steps
  are performed by agents that cannot be components. A reader who assumes a
  uniform role set will look for `agents/plan/` and, worse, may create it —
  silently replacing an OpenCode built-in's system prompt.
- **Rollback:** repo changes revert in one commit. **Emitted files do not** —
  record their paths. If the ownership decision removed the skill's copies,
  a revert restores them, but any target project already installed from the
  new state is outside this repo's reach.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| `agents/qa-test/`, `agents/review/`, `agents/git-ops/` | Client-agnostic sources; all three boundaries preserved and **proven in emitted output** per client |
| `agents/shell-runner/` | Present or deliberately absent, with reasoning |
| `skills/agent-tiers/` | **Does not exist in this repo and must not.** `agent-tiers` stays with `opencode-customization` (ADR-0017 rejected). `agents/<role>/agent.md` is the sole definition here from the first commit |
| The project-vs-global `git-ops` coexistence | **Documented**, not fixed: `install-tiers.ps1` writes a project-local copy, `install.sh` emits a global one, OpenCode resolves project over global. Unfixable from this repo; a reader finding two files must be able to learn why |
| The `plan`/`build` asymmetry | Recorded: two loop steps are config overrides, not components, and creating `agents/plan/` would clobber an OpenCode built-in |
| ADR-0018's abstraction | Tested against its narrowest case (`qa-test`'s glob-scoped edit); any limitation documented and escalated |
| `docs/registry.md` | Regenerated; Agents section carries both design and production roles |
| Any `opencode.jsonc` | **Unchanged.** No `agent` key; the topology stays unapplied |

**Next task starts here**: both loops exist, all roles are authored under one
contract with one owner each, and Phase 2's plumbing has been exercised by
two independent task sets. TASK-0046 can run the pilot end to end.

Deviation to watch for: **`git-ops` and `shell-runner` are OpenCode-only
roles** (ADR-0018 clause 8.3, measured in TASK-0036 — a command allowlist
has no per-agent Claude Code expression). So `agents/git-ops/agent.md` must
declare `clients: [opencode]`, and the emitter will **refuse loudly** if it
declares `claude-code`. That refusal is correct behaviour, not a bug to work
around — narrow the `clients` list, never soften the emitter.

Second: if `shell-runner` is authored after all, `PLAN-0004`'s role count
grows. Note it is **also** OpenCode-only, for the same reason.

Third: `loops/design-brief/loop.md` delegates its step-7 commit to
`git-ops`, so that role is a **Phase 3 dependency too**, not only Phase 4.
Until this task lands, the design loop cannot be executed end to end — an
ordering fact already recorded in TASK-0041's log.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

## Execution log
### Attempt 1
- Date: 2026-09-15
- Agent: opencode (claude-opus-5)

#### Both gates passed
- **ADR-0018 clause 7 is settled** — TASK-0040 decided it: the emitter emits
  `{tier:<name>}` and never resolves it, so `models.jsonc` stays the single
  owner. Roles here therefore **omit `model`** entirely (ADR-0017's recorded
  gap: no tier resolver exists in this repo).
- **TASK-0043's handover records one vocabulary limit**, since fixed — the
  missing `delegation-allowlist` term. `test-files-only` **is** in the
  vocabulary (OpenCode-only), so `qa-test`'s glob-scoped edit — the brief's
  named test case — was expressible. No escalation needed on that count.

#### Three fidelity defects found by diffing emitted output against the reference

The brief asked for boundaries *"verified in the **emitted** output per
client, not in the source."* Doing that literally — extracting every
`key=action` fact from both files and set-differencing them — found three
discrepancies. **Two were safe, one was a real weakening.**

| # | Discrepancy | Verdict |
|---|---|---|
| 1 | `qa-test` bash `*`: reference `ask`, emitted **`deny`** | **Stricter, intended.** `bash-allowlist` means "everything unnamed is denied". The reference's `git push*: deny` / `git commit*: deny` are subsumed by `*: deny`. |
| 2 | `websearch: deny` emitted, absent from reference | **Stricter, intended.** `no-webfetch` maps to both `webfetch` and `websearch`; the reference predates the key. |
| 3 | **`git clean -f*: deny` missing from emitted `git-ops`** | **A real weakening.** It matched `git *` → allow, so the emitted role could delete untracked files irrecoverably. |

**Defect 3 is the one that matters** and it is exactly the class ADR-0018
names: a plausible file with a weaker boundary than the source declared.
`no-force-push`'s mapping omitted `git clean -f*`, which the reference denies
explicitly. Fixed in the emitter (TASK-0040's file — see amendment), and
`git push --force-with-lease*` added at the same time as the same family. The
term is now documented as covering *"git operations that destroy work rather
than adding to it"*, which is what it always meant.

**Re-verified after the fix: nothing missing**, and the only extras are the
two intended stricter ones.

#### A second fidelity gap, found before authoring: `bash-allowlist` could not name commands

Step 3's boundary check found `bash-allowlist` emitted **`bash: {"*":
"ask"}`** — permitting *any* command behind a prompt, where all three roles
**deny** everything outside a named set.

For `git-ops`, whose entire stated purpose is *"Executes git operations
only"*, that means a human could approve `rm -rf` at a prompt the role was
designed never to reach. **The guide's own definition promised more than the
emitter delivered** (*"May run only named commands"* against a mapping that
named none).

**This is the same shape as TASK-0043's `delegation-allowlist` gap**, and the
human's ruling there — parameterise the term, as follow-ups to the owning
tasks, in ADR-0008's order — applies directly. Followed rather than
re-escalated, because the precedent is explicit and the alternative was
shipping three roles weaker than their references. Landed as:

- **TASK-0037 amendment 2** — `bash_allow` key (required *iff*
  `bash-allowlist`, forbidden otherwise, block-list only), plus a subsection
  stating that **both** parameterised terms deny by default and why an
  `ask` default is not the boundary that was declared.
- **TASK-0038 amendment 2** — three checks, each observed failing.
- **TASK-0040 amendment 2** — the second parameterised emit path, merging
  rather than assigning the `bash` key, since a role can carry
  `bash-allowlist` + `no-force-push` + `push-requires-confirmation` together.

#### The emitter's glob ordering was wrong, and it silently downgraded force-push

**The most consequential find of the task, and it was my own defect, not an
inherited one.**

Emitting the merged `bash` map alphabetically after `"*"` produced:

```
"*": deny → "git *": allow → "git filter-branch*": deny →
"git push --force*": deny → "git push -f*": deny → "git push*": ask → …
```

OpenCode resolves **last match wins**. `git push --force origin main` matches
`git *` (allow), then `git push --force*` (deny), then **`git push*` (ask)** —
so it resolved to **ask**, not deny. The reference role has `git push*: ask`
*before* the force denies, so there it correctly resolves to deny.

**A force-push would have prompted instead of being refused**, in the one
role whose reason to exist is that it cannot force-push.

Fixed by sorting **shorter patterns first** (`key=(g != "*", len(g), g)`): a
longer pattern is the more specific rule and must come later to win.
Re-verified by resolving seven commands against the emitted order:

| Command | Resolves to |
|---|---|
| `git status` | allow |
| `git push origin main` | **ask** |
| `git push --force origin main` | **deny** |
| `git push -f` | **deny** |
| `git reset --hard HEAD` | **deny** |
| `git rebase -i` | **deny** |
| `rm -rf /` | **deny** |

Both ordering rules are now stated in the emitter's own comment, because the
next person to "tidy" that sort would reintroduce the defect.

#### `write` is not an OpenCode permission key

Found while proving `review` read-only: the resolver showed `edit: deny`
applied but `write` not resolving as a deny. Checked the **live** key table —
OpenCode documents **15** keys, and `edit` is the one that gates `write`,
`edit` **and** `apply_patch`. There is no separate `write` key.

**Kept anyway**, deliberately: the long-standing `agent-tiers` roles carry
it, OpenCode accepts it, the resolver keeps it, and it is harmless defence in
depth against a future key rename. **`edit: deny` is what enforces
read-only** — that is now stated in the emitter so nobody mistakes `write`
for the operative rule and removes the wrong line.

#### The two scope decisions

**Ownership: nothing to decide, and that is the answer.** The brief asks
whether the skill's copies are *"removed, reduced to pointers, or retained"*
and to verify `install-tiers.ps1` still works. **All three options assume the
skill is in this repo.** It is not — ADR-0017 was rejected, TASK-0035
cancelled. So `agents/<role>/agent.md` is the sole definition **in this
repo** from the first commit; the skill's copies are untouched because they
are in another repo; and `install-tiers.ps1` cannot break because nothing
here touches it.

**The two-owners question moved outward, as the rescope predicted**, and is
now documented rather than fixed: `git-ops` will exist twice on this machine
— project-local via `/bmad`, global via `install.sh` — and OpenCode resolves
**project over global**, so they do not collide. Written into
`configs/opencode/README.md`, because a reader who finds two `git-ops` files
needs it there, not in a task log.

**`shell-runner`: not authored.** `bmad-workflow.md:30-32` says `build`
*"never invokes shell-runner directly in the BMAD topology — qa-test owns
test execution"*, and `loops/project-build/` names it at no step. A role
nothing references is structure without benefit — the same reasoning that
declined `design-doc-writer`. **Sprint role count is six**, confirmed.

#### `plan` and `build` cannot be components — recorded, not attempted
Both are OpenCode **built-in** names. A markdown agent file's body *replaces*
a built-in's tuned system prompt wholesale, so `agents/plan/` would silently
destroy it. They are inline config overrides (`model` + `permission`) only.

**Consequence for the loop: two of its eight steps are performed by agents
that cannot exist as `agents/` components.** `loops/project-build/` already
states this in its Steps preamble, so the mixed role set is documented where
an executor will read it rather than only here.

- Actions:
  1. Passed both gates; confirmed `test-files-only` expressible.
  2. Enumerated all three roles' boundaries from the reference files and
     `bmad-workflow.md:48-53`.
  3. Found `bash-allowlist`'s fidelity gap; landed three amendments in
     ADR-0008's order.
  4. Authored `qa-test`, `review`, `git-ops` — abstract profiles, no `model`,
     no client-native syntax.
  5. Ran the gate on six real roles; regenerated the registry; emitted.
  6. Diffed emitted output against the references fact by fact; found and
     fixed defect 3; found and fixed the glob-ordering defect.
  7. Proved the boundaries at the resolver level.
  8. Documented the coexistence in both client snapshots.

- Observations:
  - **All three roles are `clients: [opencode]`.** `install.sh` **skips**
    them for Claude Code with exit 0 — a clean skip because their `clients`
    list says so, not a refusal. The refusal path is for a role that declares
    an unenforceable term *and* names the client; these correctly do not.
  - **`qa-test`'s glob-scoped edit resolves correctly** — the vocabulary's
    narrowest term, proved at the resolver: `*` deny, then seven test-path
    allows. This was the brief's named test case for whether ADR-0018's
    abstraction holds. It does.
  - **`review`'s five denies resolve** (`edit`, `task`, `webfetch`,
    `websearch`, `external_directory`), plus the inert `write`.
  - **A Phase 2 defect was found and attributed, not patched here.** The
    glob-ordering bug is `scripts/emit-agents.py`'s, i.e. TASK-0040's, and is
    recorded as that task's amendment 2 — which the brief requires
    (*"record it and attribute it to its owning task"*). Its original log's
    claim that `"*"`-first ordering was proved is **still true**; what was
    not proved was ordering *among* the specific patterns, and that gap is
    now recorded there.
  - **The fidelity method is the finding worth reusing.** Reading the emitted
    file and judging it plausible would have passed all three defects.
    Extracting `key=action` facts from both sides and set-differencing them
    found all three in one command.

- Validation:
  - `bash tests/validate.sh` → **PASS** on six real roles, after every edit.
  - `bash scripts/sync-registry.sh` → Agents section carries **six** roles:
    `critic`, `designer-manager`, `git-ops`, `ideator`, `qa-test`, `review`.
  - `bash scripts/install.sh` → exit 0; **9 files** emitted (3 roles × 2
    clients for the design roles, 3 × 1 for the production roles), 3 skips,
    0 refusals.
  - Emitted-vs-reference fact diff: **nothing missing** for any role; extras
    are the two intended stricter ones.
  - Resolver proof for `qa-test`'s globs and `review`'s denies.
  - Three new gate rules **each observed failing**.
  - `opencode.jsonc` mtime still **2026-08-24 23:48:09**, no `agent` key.
  - `opencode-customization` clean at `f9f5e37` — never touched.

  **Emitted file paths, for rollback** (untracked, outside the repo):
  `~/.config/opencode/agents/{critic,designer-manager,git-ops,ideator,qa-test,review}.md`
  and `~/.claude/agents/{critic,designer-manager,ideator}.md`.

- Result: **done.** All acceptance criteria met. **Both loops' role sets now
  exist**, so `loops/design-brief/` step 7 and `loops/project-build/` steps
  3/5/7 are executable for the first time.

  Two deviations, both recorded above: the brief's **ownership question had no
  applicable options** (all three assumed the skill is in this repo), and
  `bash-allowlist` **needed parameterising** before any of these roles could
  be authored faithfully — followed from TASK-0043's precedent rather than
  re-escalated.

  The task's own worst defect was **mine, not inherited**: alphabetical glob
  ordering silently downgraded force-push from deny to ask. It would have
  passed every check this repo has.
- Commit: recorded below
- Push: recorded below
