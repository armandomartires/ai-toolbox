# PLAN-0006 — Unattended task runs: one harness, three clients, and the decision that permits it

## Objective

Give this repo a **portable unattended-run harness**: a loop, a skill and nine
agent roles that drive a queue of settled tasks to committed, evidenced
completion with no human in the session — parking anything that cannot be
proven, and stopping before push.

The harness is authored once and **bound** per client:

- **OpenCode** — an external driver script. The only client that can *enforce*
  the harness's rules, via per-agent `permission` glob maps.
- **Claude Code** — a Workflow-script binding. Runs today; the rules are
  prompt-level.
- **Bionic** — the skill and the gate server only. It cannot orchestrate, and
  the docs say so rather than implying partial support.

Everything rests on `ADR-0022` and on two spikes that run first.

## Context consulted

### The thing being generalised

`asset-management`'s ad-hoc task **A119** — `build/scripts/Invoke-Gate.ps1` and
`.claude/workflows/arm-autopilot.js` (700 lines). Read end to end, including its
task file's four run reports. It is not a prototype: it has closed three tasks
with commits, parked one correctly, and found a real defect (`A120`) that two
stages of green gates had missed.

**This plan generalises the harness, not the worklist.** The project-specific
half — worklist, gate command map, tracker paths, house rules, commit shape —
becomes a *binding*, and every unfilled slot in a binding reads `unknown`, which
is a stop. The same rule `skills/ansible-ops/` already uses for its change
record.

### This repo

- `AGENTS.md` — the objective ("portable across every client that supports its
  capability"), the destructive-changes rule, the ambiguity policy, the
  definition of done.
- **`ADR-0019`** — the decision this plan narrows. Clause 3 (dynamic workflows
  rejected) and clause 2.5 (ambiguity stops the loop). Clause 2.2 (stops before
  merge and push) and clause 2.4 (a read-only reviewer is not an authorization)
  are **not** narrowed and bound this plan.
- **`ADR-0018`** — one source, per-client emission; clause 8 (*"the emitter
  refuses; it never degrades"*); clause 8.3, which is why seven of nine roles
  will be OpenCode-only; clause 8.5, which is **unsatisfied** and which this
  plan must satisfy before adding roles.
- **`ADR-0010`** — the authored (Python) MCP shape, deliberately unexercised
  *"until the first time a real requirement calls for an MCP server this repo
  must author itself."* This plan is that requirement, and inherits its three
  named obligations.
- `ADR-0016` — a new top-level category is silently ignored by three hardcoded
  lists. **This plan creates none.**
- `ADR-0020` — Bionic has skills and is agentic, but no user-authored agent-role
  directory; its MCP support is *inferred, not verified*, and must not be
  upgraded without a GUI check.
- `ADR-0005` (shape derived from the marker file), `ADR-0008` (definition before
  enforcement), `ADR-0009` (no runtime-presence validation), `ADR-0013` (this is
  not a third governance framework).
- `docs/development/authoring-guide.md` — the closed ten-term capability
  vocabulary and its per-client coverage table; the Loops gated schema; the
  `server.json` schema; the "Claims a component makes about its own wiring" rule.
- `tests/validate.sh` — the agent checks (`VOCAB`, `bash_allow`/`delegates_to`
  iff-rules), the loop section checks, the manifest and `.env.example` checks
  (**both `server.json`-only**), the wiring-claim check, and the
  `## Inputs` / `## Outputs / handover` contract.
- `scripts/emit-agents.py` — the vocabulary-to-client mapping and its `Refused`
  path; the last-match-wins glob ordering and the two bugs its comments record.
- `loops/design-brief/` and `loops/project-build/` — the house style, and the
  interactive siblings this loop must be distinguished from.
- `.ai/planning/BACKLOG.md` — **B-021**, which this work routes around rather
  than closing, and whose lesson shapes the `gate-runner` role.

### Vendor documentation

Re-read 2026-09-23. The Claude Code Workflow reference (saved workflows in
`.claude/workflows/`, `resumeFromRunId`, `budget`, `agentType`) — four facts
post-dating ADR-0019's reading, and the basis for re-raising clause 3.
OpenCode's `run` / `serve` / agents / plugins / commands pages, checked against
the installed `opencode 1.18.31`.

## The shape of the work

### Phase 0 — evidence before decision

Two read-only spikes. Neither changes a component file. `TASK-0055` is the
**critical path**: whether `opencode run --agent` can select a `subagent`-mode
role decides every role's frontmatter and possibly this repo's `MODES` set.

### Phase 1 — decide

`ADR-0022` is authored from that evidence and left **`Proposed`**. It narrows
two clauses of an accepted ADR, and narrowing a stated requirement is the
human's call — the rule ADR-0019 set for itself. **Human ratification is a
gate, not a task.**

### Phase 2 — define, then enforce, then emit (ADR-0008 order)

The authoring guide first, `validate.sh` second, `sync-registry.sh` in parallel.
Two of these close standing defects rather than serving this plan alone:
ADR-0018 clause 8.5 (registry client coverage) and the authored-MCP gap in
`validate.sh`.

### Phase 3 — the portable artifacts, loop first

`loop.md`, then the skill, then the roles — **the loop before the roles**, so the
roles are shaped by the sequence rather than the reverse. That is the order S7
chose deliberately and recorded. The roles split on the read-only/acting seam,
because every hard boundary decision lives on the acting side.

### Phase 4 (sprint S10) — bindings, the gate server, the pilot

Deliberately a second sprint. The portable core is useful on its own and can be
reviewed on its own; the bindings are three client-specific artifacts plus this
repo's first authored MCP server, which carries its own ADR supersession and its
own human authorization step.

## Scope

### Included (S9)

- `ADR-0022`, proposed.
- Authoring-guide, `validate.sh` and `sync-registry.sh` changes needed *before*
  the roles exist.
- `loops/unattended-run/loop.md`.
- `skills/unattended-ops/` — `SKILL.md` and its references.
- Nine agent roles.
- `B-024`, `B-025`, `B-026` raised.

### Included (S10, planned here, not detailed here)

- The OpenCode driver, the Claude Code workflow binding, the Bionic binding, and
  the binding contract plus its checker.
- `mcp-servers/gates/` — the first authored Python server; `smoke-mcp.sh`
  authored-shape support; ADR-0010 superseded.
- `configs/*/README.md` for all three clients; registry regenerated.
- A live pilot run.

### Not included, anywhere in this plan

- **Any change to `asset-management`.** A119 stays `🚧` with its instance intact.
  This repo generalises from it; it does not edit it.
- **Closing B-021.** `qa-test` remains as it is; this work routes around it.
- **A `workflows/` component category.** ADR-0016's finding stands.
- **Removing the human gate.** Push remains the operator's step.
- **Promoting S9.** S8 closed on `REVIEW-0009` (2026-09-23) and no sprint is
  open, so there is nothing to displace — but promotion is still a human
  decision, and this plan does not make it.

## Known unknowns, stated before they are discovered

1. **F1** — whether `opencode run --agent` selects a `subagent`-mode role. If
   not, every role's `mode:` changes and this repo's `MODES` set may need a third
   value. `TASK-0055`.
2. **F4** — whether an OpenCode allow-glob can express "explicit paths only, not
   `-A`". If not, the closer's staging moves into the driver, or a new vocabulary
   term is defined first. `TASK-0055`.
3. **F5** — whether a Claude Code `tools: Agent(x)` naming a never-emitted role
   is silent. If it is, `agents/designer-manager/` has a live defect today.
   `TASK-0056`.
4. **`worktree-only` for Claude Code** — ADR-0018 left this to `TASK-0040`, still
   open. All nine roles declare it. For the acting roles an isolated *copy* is
   the wrong confinement, so this cannot be resolved silently.
5. **The authored-MCP validation gap** — `B-024`. The first authored server is a
   command runner, and its authorization block would be prose nothing checks.

## Success, and how it will be judged

S9 succeeds when a reader can answer, from the repo alone: what the harness
does, which client enforces which rule, why seven roles do not port, and what a
consuming project must supply. `REVIEW-0011`'s pre-committed question:
**did the docs state the OpenCode-first asymmetry plainly, or did they describe
three clients as if they were equivalent?**

S10's pre-committed question: **did the OpenCode port actually enforce what the
Claude one only asks for?**
