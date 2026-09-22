# ADR-0022 — Unattended task runs are a loop, a skill and nine roles; ADR-0019 clause 3 is narrowed to the component layer

## Status

**Proposed**, 2026-09-23. Opened by `PLAN-0006` (sprint S9).

**Proposed rather than accepted, deliberately.** This decision **narrows two
clauses of an accepted ADR**, and ADR-0019 set the rule for exactly this
situation: it was itself *"`proposed` rather than `accepted` at authoring time
because it **narrows a stated requirement**, and narrowing a requirement is the
human's call, not the agent's."* The same applies here, twice over, and nothing
this ADR unblocks may be authored until it is ratified.

**Blocked on two spikes** (`TASK-0055`, `TASK-0056`), unlike ADR-0019 and like
ADR-0018. Three of the nine falsifiable claims below can only be settled against
the installed clients, and one of them — **F1** — decides every role's `mode:`
field and therefore whether this repo's agent schema needs changing at all. An
ADR ratified ahead of F1 would be ratifying a guess.

## Context

### What already exists, and why it is the evidence rather than the proposal

A working unattended orchestrator exists in a sibling repository,
`asset-management`, as ad-hoc task **A119**. It is two files:
`build/scripts/Invoke-Gate.ps1` (a gate detached behind a watchdog and polled in
bounded calls) and `.claude/workflows/arm-autopilot.js` (700 lines: a serial loop
over the open worklist, six roles per task, the closer alone holding git and
tracker rights).

It has run live four times. Three tasks closed with commits (`S026.T001` →
`00a9660`, `S025.T001` → `ee183f9`, `S025.T002` → `ba18cc1`), one parked
correctly, and one run **closed nothing and was right to** — the adjudicator
established by `git show HEAD:` that a gate failure predated the task, declined
`retry`, `park` and `halt-run` each for a stated reason, and returned
`raise-adhoc` with a title only. That finding became `A120`: a role map missing
one entry, which made a gate exit 1 on an **untouched tree** and therefore check
nothing at all, for two stages.

**This is what makes the present ADR a narrowing rather than a proposal.**
ADR-0019 clause 3 closes with *"Not to be re-raised without new vendor
documentation."* There is new vendor documentation (below), and there is
something the clause did not ask for and could not have: a measured run.

### ADR-0019 clause 3, in full, and what it actually says

> *"**Clause 3 — Dynamic workflows are rejected, with the reason recorded.**
> Not to be re-raised without new vendor documentation. The two grounds are
> independent: they cannot accept mid-run user input, and they are
> single-client. Either alone is disqualifying **for a component in this
> repo**."*

The final four words are the clause's own scope, and they are currently
over-read. Clause 3 was written while planning two **interactive** loops —
`loops/design-brief/` and `loops/project-build/` — whose terminating condition is
a human's explicit acceptance. For those, "cannot pause for the user" is fatal,
and it remains fatal; nothing here touches that finding.

### Ground 1 is inapplicable by construction, not refuted

The vendor constraint ADR-0019 quoted reads:

> *"**No mid-run user input** — Only agent permission prompts can pause a run.
> For sign-off between stages, run each stage as its own workflow."*

For a run **defined** as unattended, that is the requirement, not the defect.
There is no human in the session to pause for, by design. A property that
disqualifies a mechanism for an interactive loop cannot disqualify it for a loop
whose first stated precondition is that nobody is watching.

**This must not be read as weakening ground 1 anywhere else.** For
`design-brief` and `project-build` it stands exactly as ADR-0019 wrote it.

### Ground 2 stands, and becomes the architecture rather than an exception

Single-client is a real disqualification and is **not waived**. It is answered
structurally: the loop, the skill and the nine roles are client-agnostic and
carry every rule; a workflow script is one **binding** among three, carrying
none. That is the shape ADR-0016 Decision 5 already established for per-client
wiring, and the shape ADR-0018 established for agent roles — one source,
per-client emission. Applied to a third mechanism, it is a precedent being
followed rather than an exception being carved.

### The new vendor documentation

Re-read 2026-09-23, against the reference the installed Claude Code ships. Four
facts post-date ADR-0019's 2026-09-15 reading:

| Fact | Bearing |
|---|---|
| Saved workflows load from `.claude/workflows/`, invoked by name | A binding can be a tracked file in the consuming repo, not a pasted script |
| `resumeFromRunId` replays the longest unchanged prefix from cache | An interrupted unattended run is resumable, which is the property that makes a multi-hour run practical |
| `budget` exposes a token ceiling with `spent()`/`remaining()` | A run can be bounded by spend, not only by task count |
| `agentType` selects a registered subagent type | A workflow can invoke **this repo's emitted roles** rather than anonymous workers |

The last row is the one that changes the argument. In 2026-09-15's reading a
workflow's agents were anonymous; they can now be this repo's own roles, which
means a Claude Code binding is not a parallel implementation of the harness but a
*caller* of the same artifacts OpenCode uses.

Two of ADR-0019's stated properties **still hold and are not disputed**:
`Date.now()` and `Math.random()` throw inside a workflow script, and `import()`
fails before the run starts. The existing `arm-autopilot.js` is written around
both — its run id is passed in as an argument for exactly this reason.

### The capability asymmetry, which decides the whole design

Measured against the closed vocabulary in
`docs/development/authoring-guide.md`, the harness's five rules are per-agent
*command* boundaries. Six of the ten terms are OpenCode-only, and they are the
six that carry the safety value — Claude Code's `tools`/`disallowedTools` gate
**whole tools**, with no intra-tool granularity and no third `ask` state.

**So seven of the nine roles will be OpenCode-only**, under ADR-0018 clause 8.3,
the same clause that already makes `git-ops`, `qa-test` and `review`
OpenCode-only. The honest statement, which the skill and both wiring snapshots
must carry: **this harness is OpenCode-first.** Under Claude Code and Bionic it
runs from the skill plus the gate server, with per-agent boundaries that are
weaker by construction — not equivalent, and not to be described as equivalent.

That is not a defect in the design. It is ADR-0018's finding arriving in
practice: *"Five of eight terms map to OpenCode only, and they are the five that
carry the safety value."*

### Two things the port makes *better* than the original, which belong in the record

Both were found while designing the OpenCode binding, and both are corrections
to `arm-autopilot.js` rather than concessions to it.

1. **Rule 2 can be made structural instead of instructed.** The JS hands a gate
   command string to an agent and asks it not to "correct" a switch. A driver
   has a shell and no ten-minute call cap, so the *driver* can invoke the gate
   from its own map and hand the agent only the evidence to read. No agent in
   the run then ever sees a verification command string, and the failure rule 2
   exists to prevent — 29 scripts that exit 0 silently without `-Run` — becomes
   unreachable rather than forbidden.
2. **A null refuter currently fails open.** In `arm-autopilot.js` a refuter
   returning nothing flows into the adjudicator as an absence of objections. A
   silent refuter is not a clean bill of health. Every binding must synthesise
   `refuted: true` on a null return.

### What an unattended run may never become

ADR-0019's consequence — *"Anyone describing it as end-to-end autonomous
production is overstating it"* — applies here unchanged and is the reason
clause 4 below exists. This decision widens *what may run unattended*. It does
not move the merge gate, and it does not make an agent's verdict an
authorization.

## Decision

**Four clauses, all normative.** Clauses 1 and 2 narrow ADR-0019; clause 3
instantiates an ADR-0019 term it left undefined; clause 4 is the boundary none
of them move.

### Clause 1 — ADR-0019 clause 3 is narrowed to the component layer

1. **Still forbidden, unchanged:** a *component* of this repo whose executable
   form is a dynamic workflow. No `workflows/` category (ADR-0016's plumbing
   finding stands: a new top-level directory is silently ignored by
   `sync-registry.sh`, `validate.sh` and `install.sh` alike). No loop or skill
   that only runs as a workflow script.
2. **Not forbidden:** a consuming repository binding this repo's portable
   artifacts to a client-local driver — including a Claude Code Workflow
   script — provided the driver ships as a **template** under the owning
   skill's `templates/bindings/` and **carries no rule of its own**. Rules live
   in the loop and the skill; a binding implements them and cites them.
3. **Ground 1 is inapplicable, not refuted.** For an unattended run the absence
   of mid-run input is the requirement. ADR-0019's finding stands unaltered for
   `loops/design-brief/` and `loops/project-build/`.
4. **Ground 2 is answered, not waived.** Client-specific code is confined to one
   binding template per client, and every rule it enforces has its source in a
   client-agnostic artifact. **A binding that states a rule the loop and skill do
   not is a defect**, and the skill ships a checker for exactly this.

### Clause 2 — ADR-0019 clause 2.5 is narrowed for unattended runs only

ADR-0019 clause 2.5 reads: *"a genuinely ambiguous requirement **stops the
loop**."* In an unattended run there is no addressee for the question.

1. A genuine ambiguity **parks the task**, journals the question, and reports it
   in the handover. The human's answer is still required; **only its timing
   moves**.
2. This is not licence to answer it. **Inventing an answer remains forbidden** —
   no id is allocated, no glyph outside the legend is written, no figure that did
   not come out of the evidence file reaches a task file. The alternative to
   asking is parking, never guessing.
3. Clause 2.5 is untouched for any loop with a human in the session.

### Clause 3 — ADR-0019's "locked plan" is instantiated as the committed task file

ADR-0019 clause 2.1 permits autonomy *"within a locked plan"* and never says what
locked means; ADR-0019 itself flagged, twice, that its lock mechanism was the
thing most likely to be assumed handled.

For an unattended run the lock is **the committed task file carrying acceptance
criteria**. A task whose file globs to zero or several files, or whose criteria
are absent, is a preflight **halt** rather than a task to be interpreted. This is
the same move `loops/design-brief/` made in the other direction: *"The commit is
the lock"*, because a field can be flipped by the next agent to open the file.

### Clause 4 — the boundary that does not move

1. **Merge and push remain the human's** (ADR-0019 clause 2.2, ADR-0009's
   credential rule). A binding expresses this by **denying** push, never by
   prompting: in an unattended run an `ask` is either a hang or, under an
   auto-approve flag, an approval. *"A boundary that degrades to a prompt is not
   the boundary that was declared."*
2. **A read-only reviewer is not an authorization** (ADR-0019 clause 2.4). The
   refuter and the adjudicator are a filter in front of the human gate. An
   `accept` verdict, an all-green gate set and a clean handover make work
   **ready** for that gate; none of them passes it.
3. **Nothing destructive, ever, without explicit human authorization in the task
   file** (`AGENTS.md`). Deletion, overwrite, history rewrite and force-push
   escalate without retrying.
4. **ADR-0019 clauses 1, 2.2, 2.3 and 2.4 are explicitly not narrowed**, and are
   listed here so a later reader does not have to infer it.

## Consequences

- **Two of nine roles are portable; seven are OpenCode-only.** The two that port
  are `task-planner` and `adjudicator` — **the two that only think**. Every role
  that acts needs a command boundary, and a command boundary has no per-agent
  Claude Code expression. Expect this to be felt as a limitation and resisted;
  ADR-0018 clause 8.4 already rejected the two workarounds, with reasons.
- **The registry will advertise nine roles as if universal unless it is fixed
  first.** ADR-0018 clause 8.5 requires the registry to show client coverage and
  is **currently unsatisfied** — `docs/registry.md`'s Agents section is
  `| Name | Description | Path |`. Adding seven OpenCode-only roles to a registry
  that cannot say so would be the same class of false self-claim as `B-021`.
  Raised as `B-026`; `TASK-0060` closes it, and it must land before `TASK-0064`.
- **The first authored (Python) MCP server arrives, and it arrives into a gap.**
  `validate.sh` runs its destructive-capability gate and its `.env.example`
  completeness check on `server.json` **only**. The first authored server this
  repo will ship is a command runner — the most destructive surface it could
  have — and `AGENTS.md`'s rule that destructive MCP capabilities need explicit
  authorization would be prose nothing checks. Raised as `B-024`. Closing it is
  an acceptance criterion of the server's own task, not a follow-up.
- **ADR-0010 is superseded, on its own terms.** It deferred the authored shape
  *"until the first time a real requirement calls for an MCP server this repo
  must author itself — a tool with no suitable upstream package."* That is this.
  Its three named obligations — `smoke-mcp.sh` authored-shape support, the
  authoring guide's authored section verified against reality, and a superseding
  ADR — all become due.
- **A second owner of the sequence appears, and is managed rather than avoided.**
  `loop.md` and each binding both express the order of steps. This is the
  two-owners risk `loops/project-build/` already accepted with `bmad-workflow.md`,
  handled the same way: **`loop.md` is authoritative, a binding cites it**, and
  the skill ships a checker asserting a binding declares every numbered step.
- **The bound is 2, and diverges from this repo's standing 3.** Every other bound
  here is 3. A retry in this loop costs a full implement-plus-gate cycle that can
  run an hour with no human to stop a bad third attempt, and 2 is the bound the
  live runs actually used. **A number that has run beats a number chosen for
  symmetry** — but the divergence is stated in the loop file rather than left for
  a reader to notice.
- **`B-021` is routed around, not closed.** `gate-runner` avoids B-021's defect
  by allowlisting one choke point — the binding's gate entry point — rather than
  a command list, so its description claims only what its allowlist permits.
  `qa-test` remains exactly as it is.
- **This ADR does not make the harness portable to Bionic.** Bionic gets the
  skill and the gate server. It has no user-authored agent-role directory
  (ADR-0020 clause 4) and no headless CLI, so there is no surface to bind an
  orchestrator into. Stated rather than implied.

## Falsifiable claims

Nine, each with what would falsify it and what happens then. Per ADR-0020's
closing instruction, **a future reader should re-verify rather than cite**: the
two clients' surfaces moved three times in four days during `TASK-0036`.

| # | Claim | Falsified by | If false |
|---|---|---|---|
| **F1** | `opencode run --agent <name> --format json` can select a role whose `mode:` is `subagent`. | A run that errors, or silently falls back to the default agent. | Every driver-invoked role becomes `mode: primary` — or `all`, which this repo's `MODES` set does not admit, forcing a schema and authoring-guide change. **Critical path; `TASK-0055` settles it.** |
| **F2** | `--format json` emits an envelope from which a role's final message is extractable without parsing prose. | Output interleaving tool logs with the answer, with no distinguishable final event. | The driver needs a delimiter convention stated in every role body. Contained: one extraction function, with raw stdout as the fallback. |
| **F3** | A prompt-stated return schema is honoured often enough to drive control flow. | The first verdict outside the five-value enum. | Already mitigated by construction — an unparseable or out-of-enum verdict is treated as `park`, **never** as `accept`. The claim measures how often that fires, and every reprompt is journaled so the rate is measurable rather than folklore. |
| **F4** | An OpenCode allow-glob of the form `git add -- *` matches `git add -- <path>` and does **not** match `git add -A` or `git add .`. | An emitted closer that stages everything. | Either accept a stated prompt-only rule, or define a new vocabulary term in the authoring guide first — definition → enforcement → emission (ADR-0008). **Do not widen `bash_allow` inside an implementation task.** A third option, preferred if it holds: the driver stages the named paths itself and the closer keeps only `git commit`. |
| **F5** | An emitted Claude Code role whose `tools: Agent(x)` names a role never emitted for Claude Code is a **silent** dead reference. | A load error or a warning naming the missing role. | If true it is a **live defect today**: `agents/designer-manager/` declares `clients: [claude-code, opencode]` and delegates to `git-ops`, which is OpenCode-only. `TASK-0056` settles it; `TASK-0059` adds the check with a fixture proving it fails before it passes. |
| **F6** | `scripts/emit-agents.py` emits all nine roles for their declared clients with exit 0, and **refuses** when an OpenCode-only role is widened to `claude-code`. | Running `install.sh` for both clients. | The emitter's refusal path is broken, which is worse than the roles being wrong — ADR-0018 clause 8.2's whole point. Prove the refusal before trusting any pass. |
| **F7** | Routing every gate through one detaching entry point keeps each agent shell call inside the client's cap. | A measured wait exceeding it. | Rule 3 does not generalise and the binding contract needs a second mechanism. |
| **F8** | The authored Python MCP shape works end to end — the server launches and answers `initialize` in all three clients. | A smoke test that never receives a reply. | This is ADR-0010's deferred discovery arriving, which is the return on having deferred it. Note Bionic's own MCP support is **inferred, not verified at any version** (ADR-0020 clause 5) and must not be upgraded without a GUI check. |
| **F9** | A run interrupted at any point between the gate step and the close step leaves the tracker untouched. | A ticked tracker row with no commit behind it. | Rule 1 is not enforced by the closer's position and the whole ordering argument fails. One window is irreducible — between `git commit` returning and the journal line reaching disk — and a binding closes it in practice with a `git log --grep <taskId>` guard on resume, never in theory. Say so rather than imply otherwise. |

## What ratification unblocks, and what it does not

**Unblocked on ratification.** `TASK-0058` (authoring guide), `TASK-0060`
(registry Clients column), `TASK-0061` (`loops/unattended-run/loop.md`) and
S10's gate-server deliverable each open with a gate requiring this ADR to be
`Accepted`.

**Still blocked, and deliberately.** `TASK-0063` and `TASK-0064` (the roles) need
`TASK-0059` and `TASK-0061` — the loop is authored **before** the roles so the
roles are shaped by the sequence rather than the reverse, the order S7 chose and
recorded. The bindings (S10.1, S10.2) need the skill and the roles.

**Not blocked by this ADR at all.** `TASK-0055` and `TASK-0056` are the spikes
that produce its evidence and must run first. They change no component file.

**Not settled here, and named so it is not assumed handled:**

- **Whether `worktree-only` emits `isolation: worktree` for Claude Code or
  refuses the client.** ADR-0018 left this to `TASK-0040` and it is still open.
  Every role in this set declares it, so resolving it silently would affect all
  nine. The two mechanisms are not the same guarantee — refusal versus
  redirection — and for the *acting* roles the difference is material: an
  isolated copy is the wrong confinement for a role that must commit to the real
  tree.
- **Where the binding templates live inside the skill**, and whether the
  binding-completeness checker is gated. `TASK-0062` decides both; the checker
  must carry the negative wiring-claim form (*"Nothing in this repository runs
  this script"*) or `validate.sh`'s wiring-claim check fails the commit, the way
  `skills/ansible-ops/scripts/check-change-record.sh` already does.
- **Whether S9 is promoted at all.** S8 closed on `REVIEW-0009` (2026-09-23)
  with `ADR-0021` ratified, and `SPRINT-CURRENT.md` records that no sprint is
  open and that this is *"a state, not an oversight"*. Nothing is contested;
  promotion is simply a decision nobody has taken, and it is the human's.
