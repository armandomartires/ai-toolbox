# Sprint S7 — Design and production agent loops

**Phase 7. Opened 2026-09-15, planning only — no implementation yet.**
Planned by `PLAN-0004`. The third sprint since S1 to start from a written
plan, and the second in a row to start from a **human-supplied analysis
that had to be corrected before it could be built** — eight corrections
this time, against six in S6.

**Sprint S6 is parked, not closed** (human decision, 2026-09-15). It is
archived at `.ai/planning/sprints/SPRINT-S6-ansible-agent-guardrails.md`
with a parking note. Its ten artifacts stay `planned`/`proposed` and
B-010…B-013 stay **ready** — parking a sprint does not un-scope its
backlog items. Nothing in S6 was implemented, which is why parking cost
nothing.

## What this sprint is for

Build the two-stage agent system: an **interactive design stage** that
converges an idea into an accepted, locked brief, and a **largely
autonomous production stage** that carries that brief through plan,
implement, test, review and document.

The premise — that Claude Code and OpenCode already supply the primitives
and the gap is orchestration glue, guardrails and CI hooks — holds. **The
proposed architecture did not survive contact with this machine or with the
two vendors' current docs.** Three corrections matter most:

- **Half the production stage already exists, is owned by another repo, has
  already drifted, and has never been switched on.**
  `~/.config/opencode/skills/agent-tiers/` implements
  `plan → build → qa-test → (fix loop, max 3) → review → git-ops commit`
  with permission-enforced boundaries that are the real safety control.
  `opencode-customization`'s own roadmap sequenced `S027` to hand
  **`project-workflow` and `agent-tiers`** to this repo; ADR-0004 executed
  that handover for `project-workflow` **only**. Two files differ between
  the installed copy and its source while both claim `1.0.0`, and the live
  `~/.config/opencode/opencode.jsonc` contains **no `agent` key at all**.
  Reclaiming it is Phase 1, and skipping it would have built a fifth copy.
- **Agent definitions are not portable between clients.** Location,
  identity, capability gating, primary-vs-subagent, model IDs and nesting
  **all** differ. The overlap is `description`, `model`, `color` —
  everything that makes an agent *safe* differs. This is ADR-0006's
  situation exactly (a criterion assuming cross-client uniformity, found
  unsatisfiable once tested), and its resolution generalizes: portability
  is scoped **per capability**. Hence ADR-0018, before any role is written.
- **Claude Code dynamic workflows cannot do the design stage.** Their own
  constraints table: *"No mid-run user input — Only agent permission
  prompts can pause a run. For sign-off between stages, run each stage as
  its own workflow."* Requirement 1 is an interactive back-and-forth. They
  are also a Claude-Code-only JS runtime, so anything built on them is
  unportable by construction. **Excluded from the architecture.**

## Tasks

| Task | Depends on | Status | What |
|------|-----------|--------|------|
| TASK-0033 | — | **planned** | Park S6; open S7; add ROADMAP Phase 6 **and** 7; add the missing S6 session record; raise B-014…B-017 |
| TASK-0034 | — | **done** | *Spike.* Drift fully characterised: **2** files, repo copy newer for **both**, consistently, from one commit; installed copy carries **no unique fix**; all 4 model IDs still resolve. **But the spike's premise is false** — `agent-tiers` is **not unowned**: `opencode-customization` kept it deliberately (commit `9bae137`, 2026-09-13, user decision) with a stated reason and an unpulled reopen trigger |
| ADR-0017 | TASK-0034 | **BLOCKED — do not accept as drafted** | Asserts ai-toolbox owns `agent-tiers`, on a premise TASK-0034 disproved. Three options + a recommendation (**option 3**: take the four *roles* into `agents/` under ADR-0018, leave the PowerShell installer where it was deliberately kept) are in TASK-0034's log. **Human decision required** |
| TASK-0035 | ADR-0017 | **blocked — justification gone** | Its import would create the second copy ADR-0004 exists to prevent, *against* the other repo's recorded decision. Do not start until ADR-0017's disposition is decided |
| TASK-0036 | — | **done** | *Spike.* Emission **confirmed on new evidence**: a superset file loads in Claude Code and silently drops an OpenCode `permission:` block, leaving Write/Edit/Bash in the pool. **5 of 8 capability terms are OpenCode-only**; `git-ops`/`shell-runner` unexpressible as CC subagents. 4 ADR-0018 rows corrected |
| ADR-0018 | TASK-0036 | **accepted** 2026-09-15 | Per-capability portability; one source, per-client **emission**; emission forbids `link` mode. Ratified on evidence: clause 2's reasoning replaced (safety, not syntax), 4 facts corrected, **new clause 8 — the emitter refuses, never degrades**, and `git-ops`/`shell-runner` recorded **OpenCode-only**. Unblocks TASK-0037, now the critical path |
| TASK-0037 | ADR-0018 | **done** | `agents/_template/` + normative schema in `authoring-guide.md`. **Definition before enforcement** held — gate, registry and installer untouched. Vocabulary is **9** terms, not 8: `qa-test`'s `webfetch: ask` was unexpressible. The brief's "exclude one-client terms" rule was **overridden by ADR-0018 clause 8.3** — following it would have cut the vocabulary to 3 and dropped every real role's safety boundary. `worktree-only` is **partial**, not OpenCode-only; `color` dropped (**zero** shared values) |
| TASK-0040 (addendum) | TASK-0037 | **done** | `worktree-only` **decided: emit `isolation: worktree`** for Claude Code, documenting the refusal-vs-redirection difference. Refusing would have made all four existing roles OpenCode-only and left the Claude Code emitter dead on arrival. **The weakest mapping in the vocabulary — re-examine it first** if roles ever diverge across clients. ADR-0018 clause 7 also decided: the emitter emits `{tier:<name>}` and never resolves it, so `models.jsonc` stays the single owner |
| TASK-0038 | TASK-0037 | **done** | `validate.sh` agent checks, parsed not grepped. **17 rules each observed failing** on a single-rule fixture, plus a valid control. The harness was **wrong on its first run** — fixtures violated two rules each, so the gate's failure proved nothing about the rule under test; found and fixed before recording. Parse-not-grep proved by a body discussing `permission:`/`tools:` that correctly **passes**. 654→606 ms, still sub-second |
| TASK-0039 | TASK-0037 | **done** | `sync-registry.sh`: `extract()` gains `agent`; one `emit_section` line — exactly as predicted. Template skip proven to be the exclusion by **disabling it**; section proven to populate by fixture; integrity checks observed firing in **both** directions on the new section. **Finding for 0038:** a folded `description: >-` yields a structurally valid row containing `>-` and `validate.sh` passes it |
| TASK-0040 | TASK-0037 | **done** | `install.sh` emission via a new `scripts/emit-agents.py`; `CLIENTS` gains a **fourth column**, chosen on evidence (the gate's parse anchors on field 1, so a second table would have created a rival client list where the pairing check cannot see it). **`validate.sh` needed no change at all.** All 9 terms proven per client: 4 map, **5 refuse** for Claude Code with the remedy named. Idempotency and the multi-term merge proven by hash. Phase 2 complete |
| ADR-0019 | — | **accepted** 2026-09-15 | Convergence is **human acceptance**; the autonomy boundary is a pre-merge gate; workflows rejected. Unblocks TASK-0041 and TASK-0044 |
| TASK-0041 | ADR-0019 | **done** | `loops/design-brief/` — **seven** steps, not four; cap 3 with its unit stated; lock = frontmatter **plus the commit**. Read-back caught the manager holding commit rights; delegated to `git-ops` |
| TASK-0042 | TASK-0041 | **done** | `skills/design-flow/` — 3.3 KB core + 3 `references/` + brief template. Distinctness = a **load-bearing commitment**; critique has **8 named obligations** |
| TASK-0043 | TASK-0040, TASK-0042 | **planned** | Roles: `designer-manager` (**primary**), `ideator`, `critic`. **`design-doc-writer` expected to be declined** — the loop gives it nothing to do |
| TASK-0044 | ADR-0019, ~~TASK-0035~~ | **planned — NOT blocked** | `loops/project-build/` — from `bmad-workflow.md:8-38`, with the merge gate explicit. Its TASK-0035 dependency was for **read access only**, and TASK-0034 verified the file is readable in place (53 lines, every cited section present) at `~/AI_Workspaces/opencode-customization/opencode/skills/agent-tiers/templates/bmad/bmad-workflow.md`. Read it there; do not wait on an import that may never happen |
| TASK-0045 | TASK-0040, TASK-0044 | **planned** | Reconcile `qa-test`/`review`/`git-ops` into `agents/`. **Reconcile, not duplicate** |
| TASK-0046 | TASK-0043, TASK-0045 | **planned** | **Pilot.** Run both loops to produce S6's `ansible-ops` and `ansible-change` |

Order follows one principle: **reclaim before authoring, decide before
authoring, enforce before piloting, pilot last.** Each constraint is a
defect already paid for — a duplicated skill (ADR-0004), an unsatisfiable
portability criterion (ADR-0006), an unpoliced category, and unexercised
scaffolding (ADR-0010). The two Phase-1 spikes are mutually independent;
so are TASK-0038/0039/0040 once 0037 lands.

## Decisions taken at plan time — do not re-open

All from the planning session; recorded in `PLAN-0004`'s "Human decisions
required" table with where each binds.

1. **S6 is parked, not finished first and not absorbed.** S7 opens now.
2. **Agent portability is one source with per-client emission** — not
   OpenCode-only, and not two hand-maintained per-client files.
3. **The pilot is S6's `ansible-ops` + `ansible-change`.** The loops are
   exercised by producing real, already-scoped components.
4. **Dynamic workflows are excluded** (agent decision, ratified by
   ADR-0019): the vendor's own constraint table rules them out for an
   interactive stage, and they are single-client.
5. **`designer-manager` is a primary agent** (agent decision): forced
   independently by Claude Code's subagent tool filter, which strips
   `AskUserQuestion` from **every** subagent, and by OpenCode's
   `subagent_depth: 1`, under which a subagent cannot spawn workers.

## Emission has no freshness check, and cannot have one

Decision 2's consequence, stated up front because it looks like an
oversight later. `install.sh:105` deploys skills with `ln -sfn`, so an edit
in the repo is live everywhere with no sync step. **A per-client emitted
agent file cannot be a symlink** — its content differs per client by
definition. So agents deploy by **generation only**: no `link` mode, no
`copy` mode.

That makes an emitted file a fourth copy whose freshness nothing verifies.
ADR-0009 forbids checking runtime presence — a gate that cannot pass on a
clean checkout stops being run. The mitigation is that emission is cheap
and idempotent and `install.sh` is re-run; **not** that a check will catch
staleness. Anyone who later "fixes" this by adding a presence check to
`validate.sh` breaks every fresh clone and CI. ADR-0018 must say so
explicitly.

## The least interesting item, and why it cannot be cut

`agents/README.md` is 141 bytes and the only file in that directory, yet
`agents/` is named a first-class component category in `AGENTS.md`,
`README.md`, ADR-0001, `GLOSSARY.md` and `PROJECT_MAP.md`. No template, no
schema, no `validate.sh` check, no registry section, no `install.sh` path.
`prompts/` is identical at 127 bytes.

ADR-0016 already recorded this and drew the right conclusion: *"A declared
category can exist indefinitely with nothing behind it."* Phase 2 is four
tasks with no user-visible output whose entire justification is that the
alternative leaves the newest category the **only** one the gate does not
police, while the other three are all enforced.

**If this sprint has to shrink, the honest cut is Phase 4** — reconciling
roles that already work where they are — never Phase 2 and never Phase 5.

## Known limitation, recorded at plan time

**This sprint adds two loops, one skill, seven roles and a whole component
category. If Phase 5 does not run, all of it is scaffolding** — and the
sprint would have diagnosed that exact pattern in `agent-tiers` while
reproducing it. Third instance of the pattern `mcp-servers/_template/`
established and ADR-0010 recorded.

That is why the pilot produces real components rather than a throwaway, and
why **REVIEW-0008's headline question is fixed in advance: did anything get
exercised?** S5's equivalent limitation was only stated at its checkpoint;
S6's was stated up front; this one is stated up front *and* given a
pre-committed review question.

## Standing constraints

Unchanged, and five bind this sprint directly:

- `tests/validate.sh` is a commit gate: offline, hermetic, sub-second —
  all three load-bearing. TASK-0038 adds checks to it and must measure that
  it is still sub-second, not assume it.
- **A check that cannot fail is worse than no check, because it is still
  trusted.** Lesson 8 records that knowing this has not prevented
  authoring one — twice. TASK-0038's control is *observing* the new checks
  fail on malformed fixtures. Note the local trap: on this
  `core.filemode=false` WSL checkout every file reports `rwxrwxrwx`, which
  is how an earlier `[ -x ]` check could never fail.
- **Enforcement follows definition** (ADR-0008). TASK-0037 writes the agent
  schema into `authoring-guide.md` **before** TASK-0038 enforces any of it,
  and **no size budget is invented** for any new file type.
- **Validation checks documentation completeness, never runtime presence**
  (ADR-0009). Binds TASK-0038 and TASK-0040 directly.
- `SIGMA-infrastructure` is **read as evidence and never modified**, its
  unpushed commits untouched. Inherited from S6 and **not relaxed by
  parking it**; binds the pilot.

## Vendor APIs are a moving target

Every cross-client claim in `PLAN-0004` was **fetched this session, not
recalled**: `code.claude.com/docs/en/workflows`,
`code.claude.com/docs/en/sub-agents`, `opencode.ai/docs/agents/`. Both
clients ship frequently and their docs already carry per-version caveats
(Claude Code's subagent page qualifies behaviour by patch version in a
dozen places).

**TASK-0036 must re-verify against live docs rather than cite this plan**,
and every ADR must record the date it read what it read. Lesson 7: a claim
decays between being written and being acted on — and this sprint's claims
are about *external* state, which decays faster than this repo's own.

## Out of scope, recorded not hidden

Four items from the source proposal are **rejected**, each because it
recreates a defect this repo has already paid for. Recorded here so they
are not re-raised:

- **A second `agent-skills` repo.** ai-toolbox *is* the component library;
  it has no product code to separate from. A second repo recreates
  ADR-0004's "three copies all claiming 2.1.0" version-integrity defect.
- **In-repo `.claude/skills/` and `.claude/agents/`.** This repo is the
  *source*; `install.sh` deploys outward. Symlinking back inward creates a
  self-referential fourth copy and a second install path competing with the
  one `validate.sh` actually checks.
- **A `workflows/` category.** `loops/` already is "a repeatable multi-step
  agent workflow", with mandatory `## Exit conditions`, enforced by
  `validate.sh:193-213` and emitted to the registry. Mandatory exit
  conditions are precisely what "iterate until the design is accepted"
  needs in order not to run forever.
- **`ci-skills-sync.yml`.** Checking that `~/.claude/skills/` matches the
  repo is machine-specific runtime state; it would fail on every clone and
  in CI. Forbidden by ADR-0009.

Also out of scope:

- **Modifying `SIGMA-infrastructure`** — S6's decision 3, unchanged.
- **`opencode-customization`'s retirement of its own `agent-tiers` copy.**
  ADR-0017 reuses ADR-0004's handling: left as a real, acknowledged gap for
  that repo's own task, never fixed across a repo boundary.
- **A `prompts/` category build-out.** `prompts/` stays a 127-byte README.
  This sprint makes `agents/` real; extending the same treatment to
  `prompts/` needs its own justification, not momentum.
- **Applying the BMAD topology to the live global `opencode.jsonc`.**
  Reclaiming the skill (Phase 1) and switching it on are different acts;
  the second is a change to live machine configuration and needs its own
  task and its own authorization.
