# PLAN-0004 — Design and production agent loops: reclaim, decide, enforce, exercise

## Objective

Build the two-stage agent system this repo has been asked for: an
**interactive design stage** that converges a project idea into an
accepted, locked brief, and a **largely autonomous production stage** that
carries that brief through plan, implement, test, review and document.

The premise came from a human-supplied analysis (a Perplexity research
thread) arguing that Claude Code and OpenCode already supply the
primitives — subagents, skills, workflows, agent teams — and that the
missing pieces are orchestration glue, guardrails and CI hooks rather than
fundamental capability. **That framing is correct.** The concrete
architecture it proposed is not, and the corrections are the substance of
this plan — see "Findings" below.

The single most important finding: **roughly half of the production stage
already exists on this machine, is owned by another repo, has already
drifted, and has never been switched on.** Any plan that starts by
authoring new roles builds a fifth copy of something this repo has already
paid twice to consolidate (ADR-0004, ADR-0013).

Scope decisions taken by the human before planning (do not re-open):

1. **Sprint S6 is parked, not absorbed and not finished first.** S7 opens
   now. S6's ten artifacts stay `planned`/`proposed` and `ready`.
2. **Agent portability is one source with per-client emission.** Not
   OpenCode-only, and not two hand-maintained per-client files.
3. **The pilot is S6's `ansible-ops` skill and `ansible-change` loop.** The
   new loops are exercised by producing real, already-scoped components,
   not a throwaway.

## Context consulted

### This repo
- `AGENTS.md` — the component layer, the portability requirement
  ("portable across every client that supports its capability"), git
  rules, the definition of done, the destructive-change authorization
  rule, and the ambiguity policy. Three of these constrain the "no human
  intervention" requirement directly; see F6.
- `.ai/context/CURRENT_STATE.md` (302 lines) — S6 open and planning-only;
  the eight standing lessons, of which 1, 2, 6, 7 and 8 bind this plan;
  and the standing note that `mcp-servers/_template/` is the repo's
  reference case for **plausible, unexercised scaffolding**.
- `.ai/planning/SPRINT-CURRENT.md` — S6, open, zero implemented. Parking
  it is therefore a deliberate act on a sprint that has consumed no
  implementation effort, which is the cheapest possible moment to park.
- `.ai/planning/BACKLOG.md` — B-010…B-013 open and all scoped to S6; they
  stay open and scoped there. New work needs new items, hence B-014…B-017.
- `.ai/planning/ROADMAP.md` (177 lines) — Phases 1–5 complete. **It has no
  Phase 6 section at all**: S6 exists only in `SPRINT-CURRENT.md`,
  `TODO.md`, `CURRENT_STATE.md` and `PLAN-0003`. This is the same
  roadmap-drift REVIEW-0007 caught for Phase 5 ("in progress" after
  completion), recurring one phase later — evidence that its finding 6
  ("the lesson needs a mechanism, not more prose") was correct.
- `.ai/templates/TASK.md` (57 lines) — the 15 sections, including the two
  contract sections `validate.sh` enforces.
- `ADR-0001` (the component layer, which already names `agents/` and
  `prompts/` as first-class), `ADR-0002` (symlink-first), `ADR-0003`
  (skill frontmatter schema), `ADR-0004` (**the ownership precedent this
  plan reuses verbatim**), `ADR-0005`/Clarification (two shapes, derived
  from a marker file, never self-declared — the pattern ADR-0018 borrows),
  `ADR-0006` (**portability is scoped per capability** — the precedent
  ADR-0018 extends to a third capability class), `ADR-0008` (enforcement
  follows definition; no invented budgets), `ADR-0009` (validation checks
  documentation completeness, **never runtime presence**), `ADR-0010`
  (unexercised scaffolding, recorded as a limitation rather than pending
  work), `ADR-0012` (handover is a contract; resumability is the
  invariant), `ADR-0013` (two skills, two deliberately different
  frameworks — the design loop must not become a third governance
  opinion).
- `loops/release-check/loop.md` (96 lines) — the established loop shape:
  numbered steps with expected outputs, retries bounded at 3, hard stops,
  and escalate-without-retry for destructive actions. **This is already
  the shape the proposal asked a new `workflows/` category to provide.**
- `docs/development/authoring-guide.md` (98 lines) — the normative schema
  tables for skills, MCP servers and loops, each mirrored by
  `validate.sh` so guide and gate cannot drift; and the explicit record
  that no `SKILL.md` size budget exists and inventing one is forbidden.
- `tests/validate.sh` (474 lines) — the commit gate, offline, hermetic,
  sub-second, all three load-bearing. Eight check groups; **none of them
  reads `agents/`**.
- `scripts/sync-registry.sh` (125 lines) — a single-emit-path generator.
  `extract()` at `:44-82` switches on kind; `emit_section()` at `:87-112`
  is kind-agnostic; THE template skip is at `:103`, in one place. Adding a
  kind is genuinely small — this is the one piece of plumbing that is
  already shaped for extension.
- `scripts/install.sh` (147 lines) — the `CLIENTS` heredoc at `:36-39`
  with **three** columns (`name|skills target|parent`), and skill
  deployment by `ln -sfn` at `:105`. Both matter to ADR-0018; see F4.
- `configs/{claude-code,opencode,lm-studio}/README.md` — the three wiring
  snapshots, all verified 2026-09-13.

### The live machine (read as evidence)
- `~/.config/opencode/skills/agent-tiers/` — a complete, installed skill
  implementing a plan→build→qa-test→review→git-ops loop. Twelve files.
  **Not owned by this repo.**
- `~/AI_Workspaces/opencode-customization/opencode/skills/agent-tiers/` —
  the source of that skill, with `.ai/decisions/0001-agent-tier-model-assignment.md`
  and the `/tier3` + `/bmad` commands.
- `~/.config/opencode/opencode.jsonc` (20 KB) — the live global config.
  MCP servers, providers, plugin. **Zero occurrences of `"agent"`.**
- `~/.config/opencode/skills/` — `project-migration` and
  `project-workflow` are **symlinks** into this repo; `agent-tiers` is a
  **real directory**.
- `~/.claude/skills/` — the same two symlinks. `~/.claude/agents/`
  **does not exist**.

### Vendor documentation (fetched this session, not recalled)
- `code.claude.com/docs/en/workflows` — dynamic workflows: what they are,
  their constraints table, and the sentence that decides F3.
- `code.claude.com/docs/en/sub-agents` — the frontmatter field table, the
  tool filters, and the nesting-depth default.
- `opencode.ai/docs/agents/` — the two agent types, the `permission` key
  table, `mode`, `hidden`, and markdown agent discovery paths.

## Findings that shape this plan

Each is a claim in the source analysis, or in this repo, that failed
contact with a file or a doc. They are why this plan is not a
transcription of the proposal.

### F1 — Half the production stage already exists, unowned and unexercised

`~/.config/opencode/skills/agent-tiers/` implements, in
`templates/bmad/bmad-workflow.md:8-38`, almost exactly the loop the
proposal asks for:

```
plan → build → qa-test → (fix loop, max 3 iterations) → review → git-ops commit
```

with permission-enforced role boundaries that are the real safety control:
`qa-test` may edit **test files only**; `review` is **strictly read-only**,
`edit`/`write` denied outright; `git-ops` may not force-push, hard-reset or
rebase; and `subagent_depth: 1` so no subagent invokes another. It ships
artifact contracts (`docs/stories/`, `docs/specs/`, `docs/qa/`), a
tier→model mapping in `models.jsonc` whose every ID was verified against a
live `opencode models` listing, and a deterministic idempotent installer.

Three things are wrong with it, and all three are this repo's known defect
classes:

1. **Ownership.** It belongs to `opencode-customization`. That repo's own
   roadmap sequenced **`S027`** to hand `project-workflow` *and*
   `agent-tiers` to `ai-toolbox`. ADR-0004 executed that handover early —
   **for `project-workflow` only**. `agent-tiers` was left behind and has
   been unowned since.
2. **Drift, already.** `diff -rq` between the installed copy and the
   source repo reports two differing files — `SKILL.md` and
   `templates/bmad/docs/stories/README.md` — while both declare
   `metadata.version: "1.0.0"`. This is precisely ADR-0004's
   "three files claim `2.1.0` while differing in content"
   version-integrity defect, recurring on a second skill. And the
   installed copy is a **real directory** while this repo's two skills are
   symlinks, so `install.sh:100-103` would announce a `NOTICE` and replace
   it — the trap that code comment exists for.
3. **Never switched on.** The live `~/.config/opencode/opencode.jsonc`
   contains **no `agent` key**. The BMAD topology — every permission
   boundary quoted above — is unapplied. It is unexercised scaffolding, in
   exactly the sense `CURRENT_STATE.md` uses for `mcp-servers/_template/`,
   and this is now the third instance of that pattern.

**The proposal does not mention any of this.** Reclaiming it is the
highest-value item in Phase 1, and skipping it would have produced a
fifth copy of a role set that already works.

### F2 — Agent definitions are not portable between clients

This is the load-bearing correction. The proposal's Repo-1 layout puts
`designer-manager.md`, `qa-reviewer.md` and so on in one
`.claude/agents/` directory and assumes the same file serves every client.
It cannot. From the two vendors' current docs:

| Concern | OpenCode | Claude Code |
|---|---|---|
| Location | `~/.config/opencode/agents/` | `~/.claude/agents/`, `.claude/agents/` |
| Identity | the **filename** | a required `name` field; filename need not match |
| Capability gating | `permission: {read, edit, bash, task, skill, webfetch, …}`, each `allow`/`ask`/`deny`, optionally a glob→action object | `tools` allowlist / `disallowedTools` denylist / `permissionMode` |
| Primary vs sub | explicit `mode: primary\|subagent\|all` | inferred; no equivalent field |
| Model reference | `perplexity-agent/anthropic/claude-opus-5` | `opus`, or a full ID, or `inherit` |
| Subagent nesting | `subagent_depth`, set to `1` here | 3 layers by default, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` |
| Restricting delegation | `permission.task: {"*": "deny", "x": "allow"}` | `tools: Agent(worker, researcher)` |

The overlap is `description`, `model` and `color`. **Everything that makes
an agent safe differs in name, in syntax and in semantics.** A single
markdown file cannot serve both.

This is ADR-0006's situation exactly — a criterion that assumed
cross-client uniformity and turned out unsatisfiable once tested — and its
resolution generalizes: portability is scoped **per capability**. Skills
port to two clients; MCP servers port to three; agents are a third
capability class and need their own decision **before any role is
authored**, or four role files get written and then discovered to work in
one client only.

Corroborating detail: `~/.claude/agents/` does not exist on this machine.
Claude Code has zero custom agents today, so there is no installed base to
preserve and no drift to inherit — the cleanest possible starting point.

### F3 — Claude Code dynamic workflows cannot do the design stage

The proposal leans on dynamic workflows for planning and implementation.
Two facts rule them out for the interactive half, and one rules them out
of this repo entirely.

From `code.claude.com/docs/en/workflows`, the constraints table, verbatim:

> **No mid-run user input** — Only agent permission prompts can pause a
> run. For sign-off between stages, run each stage as its own workflow

Requirement 1 is an interactive back-and-forth until a design is accepted.
A workflow cannot do that; the vendor's own remedy is to run each stage as
a separate workflow, which is to say the orchestration returns to the
session between stages anyway.

And workflows are a **Claude-Code-only JavaScript runtime**. Anything built
on them is unportable by construction, which `AGENTS.md` forbids for a
component. They are also explicitly non-deterministic-hostile in a way that
matters: `Date.now()` and `Math.random()` throw inside the script.

**Dynamic workflows are therefore excluded from the architecture.** The
portable primitive set is: primary agent + subagents + skills + loops. All
four exist in both clients, and three of the four already have plumbing and
enforcement in this repo.

### F4 — Emission and symlinking are incompatible, and `CLIENTS` has three columns

`install.sh:105` deploys skills with `ln -sfn` — one directory, linked into
each client, so an edit in the repo is live everywhere with no sync step.
That is why `configs/opencode/README.md` records a drift incident as
notable rather than normal.

**A per-client emitted agent file cannot be a symlink**: it is generated
from a client-agnostic source, so its content differs per client by
definition. Agents therefore deploy by **generation only** — no `link`
mode, no `copy` mode, no symlink. That asymmetry with `skills/` is a
consequence of the human's chosen portability mechanism, and it must be
stated in ADR-0018 rather than discovered while writing `install.sh`.

It has a second-order cost worth naming now: an emitted file is a **fourth
copy** whose freshness nothing checks. ADR-0009 forbids validating runtime
presence, so the gate cannot verify the deployed copy matches its source.
The honest mitigation is that emission is cheap and idempotent, and
`install.sh` is re-run — not that a check will catch staleness.

Separately, the `CLIENTS` heredoc at `:36-39` is `name|skills target|parent`
— **three** columns, and `validate.sh` parses this block with `sed` to
require `configs/<client>/README.md` per client. Adding an agents target
means a fourth column or a second table, and either way it touches the
block the gate reads. Not a large change, but not an isolated one.

### F5 — Subagents cannot ask the user, so the design manager must be primary

Claude Code strips a fixed list of tools from **every** subagent
regardless of its `tools` field. `AskUserQuestion` is on that list, as are
`EnterPlanMode` and `Workflow`. A subagent therefore cannot conduct the
clarify-and-converge conversation the design stage is built on.

OpenCode reaches the same conclusion by a different route: with
`subagent_depth: 1` — set by `agent-tiers` and also the OpenCode default —
a subagent cannot spawn subagents, so a designer-manager implemented as a
subagent could not delegate to ideation and critique workers even if it
could talk to the user.

So `designer-manager` is a **primary** agent in both clients, and
`ideator`, `critic` and `design-doc-writer` are subagents. This is a
structural constraint, not a style preference, and it is the kind of thing
that is cheap to honour now and expensive to retrofit.

### F6 — "No human intervention" collides with this repo's own rules

Requirement 3 asked for implementation cycles managed without human
intervention. Taken literally it contradicts four rules in `AGENTS.md`:
destructive changes require explicit human authorization **in the task
file**; pushing requires `GITHUB_TOKEN` from the environment; the
ambiguity policy says stop and ask rather than invent requirements; and the
definition of done requires a **reviewed** diff.

The defensible scope — and the one the source analysis itself lands on in
its final section — is **autonomous within a locked plan, with a mandatory
human gate before merge and push**. `agent-tiers` already encodes half of
this: `git push` is `ask`, never `allow`.

This is not a limitation to work around later. It is a boundary that
belongs in an accepted ADR before the build loop is authored, because a
loop's `## Exit conditions` section has to name it.

### F7 — `agents/` is a declared category with nothing behind it

`agents/README.md` is 141 bytes, three lines, and the only file. Yet
`agents/` is named as a first-class component category in `AGENTS.md`,
`README.md`, `ADR-0001`, `GLOSSARY.md` and `PROJECT_MAP.md`. There is no
`_template/`, no schema in `authoring-guide.md`, no `validate.sh` check, no
`sync-registry.sh` section, and no `install.sh` path. `prompts/` is in the
identical position at 127 bytes.

ADR-0016 already recorded this precedent and drew the correct conclusion
about it: *"A declared category can exist indefinitely with nothing behind
it."* It cited `prompts/` and `agents/` as the reason to be sceptical of
adding a `hooks/` category.

The consequence for this plan is unavoidable: authoring agent roles
without the plumbing means the newest category is the **only** one the gate
does not police, while the repo's other three are all enforced. That is
four tasks of unglamorous work in Phase 2 whose entire justification is
that the alternative is unenforced text. Recorded plainly, because it is
the least interesting and most skippable part of this plan, and skipping it
is how `agents/` stays a 141-byte README for another six sprints.

### F8 — The value ranking, and what this plan is really buying

| Layer | Real value here | Why |
|---|---|---|
| Reclaiming `agent-tiers` (F1) | **highest** | A working, permission-enforced loop already exists; it is unowned, drifted and switched off. Consolidation, not construction |
| The design loop (Phase 3) | high | The genuine capability gap. `agent-tiers`' `plan` writes stories and specs but has **no** ideate→critique→converge cycle and no convergence criterion |
| `agents/` plumbing (Phase 2) | moderate | Pure enforcement. Invisible, and the precondition for everything after it being more than text |
| The build loop (Phase 4) | moderate | Mostly re-expressing `bmad-workflow.md` as a validated loop with exit conditions and the F6 gate made explicit |
| The pilot (Phase 5) | **decisive** | Without it the whole sprint is a fourth instance of the pattern in F1 |

## Phases / steps

Ordered on one principle: **reclaim before authoring, decide before
authoring, enforce before piloting, pilot last.** Each ordering constraint
is a defect this repo has already paid for — a duplicated skill (ADR-0004),
an unsatisfiable portability criterion (ADR-0006), an unpoliced category
(F7), and unexercised scaffolding (ADR-0010).

### Phase 0 — Park S6, open S7
`TASK-0033`. Also repairs the roadmap's missing Phase 6 and the missing S6
session record, both found while planning.

### Phase 1 — Reclaim, then decide
`TASK-0034` (drift spike) → `ADR-0017` (ownership) → `TASK-0035` (import).
`TASK-0036` (schema-mapping spike) → `ADR-0018` (portability mechanism).
The two spikes are independent of each other and may run in parallel.

### Phase 2 — Make `agents/` a real category
`TASK-0037` (template + normative schema), then `TASK-0038`
(`validate.sh`), `TASK-0039` (`sync-registry.sh`), `TASK-0040`
(`install.sh` + `CLIENTS`). Definition precedes enforcement (ADR-0008), so
0037 is strictly first; the three plumbing tasks are then independent.

### Phase 3 — The design half
`ADR-0019` (convergence criterion + the autonomy boundary), then
`TASK-0041` (`loops/design-brief/`), `TASK-0042` (`skills/design-flow/`),
`TASK-0043` (the four roles).

### Phase 4 — The production half, owned here
`TASK-0044` (`loops/project-build/`), `TASK-0045` (reconcile the three
existing `agent-tiers` roles into `agents/`).

### Phase 5 — Exercise it
`TASK-0046` (run both loops to produce S6's `ansible-ops` and
`ansible-change`), then `REVIEW-0008`.

## Tasks generated

| ID | Depends on | What |
|---|---|---|
| TASK-0033 | — | Park S6; open S7; add ROADMAP Phase 6 **and** 7; add the missing S6 session record; raise B-014…B-017 |
| TASK-0034 | — | **Spike.** Inventory the `agent-tiers` drift: 2 differing files, both claiming `1.0.0`, installed copy a real dir not a symlink. Read-only |
| ADR-0017 | TASK-0034 | ai-toolbox owns `agent-tiers`. Mirrors ADR-0004, including leaving the other repo's cleanup out of scope |
| TASK-0035 | ADR-0017 | Import to `skills/agent-tiers/`; resolve drift; bump version; symlink replaces the real directory |
| TASK-0036 | — | **Spike.** Confirm the per-client agent field mapping empirically (F2's table), and that `~/.claude/agents/` is absent |
| ADR-0018 | TASK-0036 | Agent portability is per-capability; one source, per-client **emission**; emission forbids `link` mode (F4) |
| TASK-0037 | ADR-0018 | `agents/_template/` + the normative schema in `authoring-guide.md`. **Definition before enforcement** |
| TASK-0038 | TASK-0037 | `validate.sh`: agent frontmatter checks, parsed not grepped. Must stay offline, hermetic, sub-second |
| TASK-0039 | TASK-0037 | `sync-registry.sh`: `extract()` gains `agent`; one `emit_section` line |
| TASK-0040 | TASK-0037 | `install.sh` emission + the `CLIENTS` fourth column; all three `configs/*/README.md` gain an agents section |
| ADR-0019 | — | Design-stage convergence is **human acceptance**; the autonomy boundary is a mandatory pre-merge gate (F6); dynamic workflows rejected (F3) |
| TASK-0041 | ADR-0019 | `loops/design-brief/` — clarify→ideate→critique→converge, with an iteration cap and the acceptance gate as exit conditions |
| TASK-0042 | TASK-0041 | `skills/design-flow/` — portable core + per-project templates |
| TASK-0043 | TASK-0040, TASK-0042 | Roles: `designer-manager` (**primary**, F5), `ideator`, `critic`, `design-doc-writer` |
| TASK-0044 | ADR-0019, TASK-0035 | `loops/project-build/` — derived from `bmad-workflow.md:8-38`, with the F6 gate explicit |
| TASK-0045 | TASK-0040, TASK-0044 | Reconcile `qa-test`/`review`/`git-ops` into `agents/`. **Reconcile, not duplicate** |
| TASK-0046 | TASK-0043, TASK-0045 | **Pilot.** Run both loops to produce S6's `skills/ansible-ops/` and `loops/ansible-change/` |

Backlog items: **B-014** (`agent-tiers` is unowned, drifted and never
switched on), **B-015** (agent definitions are not portable and no decision
records it), **B-016** (`agents/` and `prompts/` are declared categories
with no template, schema, validation or registry section), **B-017** (no
design stage exists — `plan` writes specs but never ideates or critiques).

Note that **TASK-0046 delivers S6's TASK-0029 and TASK-0030**. Whether
those two briefs are then closed as delivered-by-S7, or rewritten, or left
parked, is a decision for the pilot's own execution log — recorded there,
not pre-empted here.

## Acceptance criteria

- [ ] `.ai/planning/sprints/SPRINT-S6-ansible-agent-guardrails.md` exists;
      `SPRINT-CURRENT.md` is S7; S6's parked status and reason are recorded
      in both `SPRINT-CURRENT.md` and `BACKLOG.md`
- [ ] `ROADMAP.md` has a **Phase 6** section (currently missing entirely)
      and a Phase 7 section
- [ ] `agent-tiers` exists at `skills/agent-tiers/`, its drift resolved
      with the resolution recorded, `metadata.version` bumped, and the
      installed copy is a **symlink** into this repo
- [ ] ADR-0018 states the per-client mapping, the emission mechanism, and
      **explicitly** that agents have no `link` mode and why
- [ ] `docs/development/authoring-guide.md` carries a normative agent
      schema table **before** `validate.sh` enforces any of it; no budget
      is invented (ADR-0008)
- [ ] `validate.sh` fails on a deliberately malformed agent file, **observed
      failing**, and stays offline, hermetic and sub-second (measured)
- [ ] `docs/registry.md` has an Agents section, generated, with no
      `_template*` row
- [ ] `install.sh` emits per-client agent files; `validate.sh`'s
      client↔config pairing still passes with the extended `CLIENTS` block
- [ ] `loops/design-brief/loop.md` and `loops/project-build/loop.md` both
      carry `## Trigger`, `## Steps`, `## Exit conditions`, each with a
      bounded iteration count and an explicit escalation path
- [ ] ADR-0019 records the autonomy boundary against `AGENTS.md`'s four
      colliding rules (F6), and records dynamic workflows as rejected with
      the vendor's own constraint quoted (F3)
- [ ] The pilot **ran**: `skills/ansible-ops/` and `loops/ansible-change/`
      exist and were produced *through* the loops, with the execution log
      recording where each loop's exit conditions actually fired
- [ ] `SIGMA-infrastructure`'s `git status` is byte-identical before and
      after, and its unpushed commits are untouched (S6's standing
      constraint, unchanged by parking)
- [ ] `tests/validate.sh` green; `scripts/sync-registry.sh` regenerated and
      committed
- [ ] `.ai/context/CURRENT_STATE.md` updated
- [ ] No secrets in any emitted file, any config snippet, or any commit

## Risks

- **A fourth instance of unexercised scaffolding.** This plan adds two
  loops, one skill, seven roles and a whole component category. If Phase 5
  does not run, all of it is scaffolding — and the sprint would have
  *diagnosed* the pattern in F1 while reproducing it. This is why the pilot
  produces real components rather than a throwaway, and why REVIEW-0008's
  headline question is fixed in advance: **did anything get exercised?**
- **Phase 2 is skippable-looking and load-bearing.** Four tasks of
  `validate.sh`/`sync-registry.sh`/`install.sh` work with no user-visible
  output. The temptation under time pressure is to author roles first and
  add plumbing "later". F7 records what "later" has meant for `agents/` and
  `prompts/` so far: indefinitely.
- **Reaching into another repo's territory.** Phase 1 does to
  `agent-tiers` what ADR-0004 did to `project-workflow`. That precedent's
  handling is deliberately reused: `opencode-customization`'s retirement of
  its own copy is **explicitly out of scope**, left as a real acknowledged
  gap rather than silently fixed across a repo boundary.
- **Emission has no freshness check, by construction.** F4. ADR-0009
  forbids checking runtime presence, so nothing can verify a deployed
  emitted file matches its source. The mitigation is idempotent
  regeneration, not a gate. Anyone who later "fixes" this by adding a
  presence check to `validate.sh` will break every fresh clone and CI —
  ADR-0018 must say so.
- **Vendor APIs are a moving target.** F2's table and F3's quote were
  fetched this session, not recalled. Both clients ship frequently and
  their docs already carry per-version caveats. TASK-0036 must **re-verify
  rather than cite this plan**, and every ADR must record the date it read
  what it read. Lesson 7: a claim decays between being written and being
  acted on.
- **Seven roles is a large surface for one sprint.** Claude Code warns when
  combined subagent descriptions exceed 15,000 tokens; OpenCode requires a
  `description` per agent and matches subagents by it. Descriptions must
  stay short with detail in the prompt body. If the sprint has to shrink,
  the honest cut is Phase 4 (reconciliation of roles that already work
  where they are), never Phase 2 or Phase 5.
- **A third governance framework.** ADR-0013 records two skills scaffolding
  two deliberately different frameworks. `design-flow` is a **design**
  playbook, not a governance one, and must not acquire a `.ai/`-shaped
  opinion or a third task-ID scheme.
- **Planning prose is a hypothesis about files** (lesson 7). This plan
  corrected eight claims from the source analysis; assume it still contains
  one. Every brief's `Inputs` table is to be verified, not trusted, and
  F1–F8 re-checked against the files before being restated in an ADR.
- **Authoring an unfailable check** (lesson 8, which knowing has not
  prevented twice). TASK-0038's control is observing the new agent checks
  **fail** on malformed fixtures before they are trusted — not the
  intention to be careful. Note the specific trap here: on this
  `core.filemode=false` WSL checkout every file reports `rwxrwxrwx`, which
  is how an earlier `[ -x ]` check could never fail.

## Human decisions required

All three resolved before this plan was written, so the sequence shows
decisions preceding work.

| Question | Answer | Where it binds |
|---|---|---|
| S6: finish first, park, or absorb? | **Park it, open S7 now** | TASK-0033; S6's 10 artifacts stay `planned`/`ready` |
| Agent portability mechanism? | **One source, per-client emission** | ADR-0018; TASK-0040; F4's no-`link` consequence |
| Phase 5 pilot target? | **S6's `ansible-ops` + `ansible-change`** | TASK-0046; S6's read-only constraint on `SIGMA-infrastructure` still binds |

Decisions taken by the agent, recorded for traceability rather than
ratification:

1. **Dynamic workflows are excluded** (F3) — the vendor's own constraint
   table rules them out for an interactive stage, and they are
   single-client. Ratified by ADR-0019 rather than assumed.
2. **`designer-manager` is a primary agent** (F5) — forced independently by
   Claude Code's subagent tool filter and by OpenCode's
   `subagent_depth: 1`.
3. **Four items from the proposal are rejected outright**: a second
   `agent-skills` repo, in-repo `.claude/skills/`, a `workflows/`
   category, and `ci-skills-sync.yml`. Each recreates a defect this repo
   has already paid for — respectively ADR-0004's three-copies problem, a
   second install path competing with the validated one, a parallel
   unvalidated category when `loops/` already exists with enforcement, and
   ADR-0009's forbidden runtime-presence check. Recorded in S7's
   `SPRINT-CURRENT.md` "Out of scope" so they are not re-raised.
