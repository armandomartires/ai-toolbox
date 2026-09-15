# TASK-0036 — Spike: verify the per-client agent schema mapping against live docs

## Objective
Establish, by observation against current vendor documentation, the facts
ADR-0018 depends on:

1. Whether the per-client field mapping in `PLAN-0004` (F2) still holds,
   field by field.
2. **Whether each client ignores or rejects unrecognised frontmatter keys** —
   because if both ignore them, a single superset file might work and the
   whole emission mechanism is unnecessary.
3. Whether OpenCode's agents directory is `agents/` or `agent/`, which the
   docs state but which no directory on this machine confirms.

This is a **spike**: it produces evidence and a mechanism recommendation,
not a component.

## Minimal context

### Why the mapping cannot be cited from the plan
`PLAN-0004`'s F2 table was read from live docs on **2026-09-15**. Both
clients ship frequently enough that their own documentation qualifies
behaviour by patch version in dozens of places — Claude Code's subagent page
alone carries version caveats such as "Before v2.1.251, `CLAUDE_CODE_SUBAGENT_MODEL`
came first in this order" and "As of v2.1.198, Explore inherits the main
conversation's model instead of always running on Haiku."

Writing ADR-0018's mechanism against a four-day-old reading of a
fast-moving API is the TASK-0019 error: a claim about external state
asserted without verification, then restated with growing confidence. This
repo's lesson 7 — a claim decays between being written and being acted on —
applies with more force to external state than to its own files.

**This spike must re-read the docs. It must not cite `PLAN-0004`.**

### The question that could invalidate the whole approach
The human chose one-source-per-client **emission**. Emission is only
necessary if a single file cannot serve both clients.

The blocker is believed to be semantic rather than syntactic: OpenCode's
`permission` model (keys gating tool groups, each `allow`/`ask`/`deny`,
optionally glob→action) and Claude Code's `tools`/`disallowedTools` model
(name allowlists and denylists) are different models, not different
spellings of one. A superset file would carry both and each client would
read its own.

**That only works if unrecognised keys are ignored rather than fatal.**
Claude Code's docs list conditions under which it *skips a subagent file
entirely* — no `name`, a `name` containing `:`, YAML that does not parse —
which shows it does validate frontmatter to some degree. Whether an unknown
key is among the fatal cases is unstated and must be tested.

This spike must genuinely ask the question rather than confirm the decision.
If both clients ignore unknown keys, ADR-0018 should reconsider a superset
file, because it would be simpler than an emitter and the ADR must not
pre-commit against evidence it has not seen.

### Why the directory name is genuinely uncertain
OpenCode's docs say markdown agents live in `~/.config/opencode/agents/`
(global) or `.opencode/agents/` (per-project). Neither `agents/` nor
`agent/` exists under `~/.config/opencode/` on this machine — only
`commands/`, `skills/`, `node_modules/`. And the config key is singular
(`"agent": { … }`) while the directory is documented plural, which is
exactly the kind of mismatch that produces a silently-ignored directory.

`~/.claude/agents/` also does not exist. So **both** clients' agent
directories are unconfirmed by observation, and this spike is the only
chance to confirm them before TASK-0040 writes emission paths against them.

### Two structural constraints already established, to be confirmed not
### rediscovered
- **Claude Code strips a fixed tool list from every subagent** regardless of
  its `tools` field, including `AskUserQuestion`. A subagent therefore
  cannot ask the user a question.
- **OpenCode's `subagent_depth: 1`** — set by `agent-tiers` and also the
  documented default — means a subagent cannot spawn subagents.

Together these force `designer-manager` to be a **primary** agent in both
clients. Confirm both; they constrain TASK-0043's role shapes, and a change
in either would change the design loop's topology.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `code.claude.com/docs/en/sub-agents` | vendor | Live. Frontmatter field table, the two tool filters, scope/precedence table, nesting depth |
| `opencode.ai/docs/agents/` | vendor | Live. Two agent types, `permission` key table, `mode`, `hidden`, `permission.task`, markdown discovery paths |
| `code.claude.com/docs/en/workflows` | vendor | Live. Needed only to re-confirm the "No mid-run user input" constraint ADR-0019 quotes |
| `.ai/decisions/0018-agent-portability-one-source-per-client-emission.md` | TASK-0033 | **Proposed**; carries the 2026-09-15 mapping table to be re-verified, and the "Not established" list this spike answers |
| `.ai/decisions/0006-lm-studio-is-mcp-only.md` | pre-existing | Accepted; the per-capability portability precedent ADR-0018 extends |
| `~/.config/opencode/` | pre-existing | Holds `commands/`, `skills/`, `node_modules/`, `opencode.jsonc`. **No `agents/` or `agent/`** |
| `~/.claude/` | pre-existing | Holds `skills/` (two symlinks). **No `agents/`** |
| `~/.config/opencode/skills/agent-tiers/agents/*.md` | `opencode-customization` | Four OpenCode-shaped role files — real examples of the target format |
| `~/.config/opencode/skills/agent-tiers/fragments/opencode.bmad.jsonc` | same | Shows `subagent_depth`, `default_agent`, `instructions`, and inline `agent` overrides |
| `/tmp/opencode/` | pre-approved scratch | Exists; pre-approved for work outside the workspace |

**Verify the expected state; don't assume it.** Re-fetch all three vendor
pages at execution time and **record the date of the reading** — that date
is what ADR-0018 must cite, not this brief's creation date.

## Scope

### Included
- Re-fetch all three vendor pages; record the retrieval date.
- Re-verify the mapping **field by field**, producing a table with a
  confirmed/changed/unverifiable marker per row.
- Determine each client's behaviour on an **unrecognised frontmatter key**:
  ignored, or fatal. Test empirically in `/tmp/opencode/` if the docs are
  silent — a fixture agent file with a junk key, loaded by each client, is
  the only way to answer this reliably.
- Confirm the actual agent directory name for each client, by observation
  where possible (create a minimal agent file in a scratch project and see
  whether the client discovers it) and by documentation otherwise.
- Confirm the two structural constraints: Claude Code's subagent tool
  filter includes `AskUserQuestion`, and OpenCode's default
  `subagent_depth`.
- Determine whether OpenCode's `permission` semantics can express Claude
  Code's `tools` allowlist **in both directions**, or only one. This decides
  how lossy the abstract capability profile has to be.
- Enumerate the **abstract capability vocabulary** the four existing
  `agent-tiers` roles would need (`read-only`, `test-files-only`,
  `no-force-push`, `bash-allowlist`), and check each maps to both clients.
  A term that maps to only one is a term the profile cannot offer.
- Recommend the mechanism for ADR-0018: emitter, or superset file, with
  reasoning.

### Not included
- **Authoring any role.** TASK-0043, TASK-0045.
- **Writing the emitter.** TASK-0040.
- **Creating `agents/` in this repo.** TASK-0037.
- **Modifying `~/.config/opencode/opencode.jsonc` or `~/.claude/`
  settings.** Fixture agent files in a scratch project under
  `/tmp/opencode/` only; nothing in a real config.
- **Accepting ADR-0018.** This spike feeds it.
- Evaluating LM Studio. Excluded by ADR-0006's logic — it supplies models
  and performs no agentic work.

## Likely files
- `/tmp/opencode/agent-schema-spike/` — scratch project with fixture agent
  files, not committed
- `.ai/tasks/TASK-0036-spike-agent-schema-mapping.md` — this file's
  execution log carries the findings
- Possibly a short evidence file under `.ai/` if the mapping table plus the
  fixture results are too long for the log; decide at execution time

## Execution plan
1. Re-fetch the three vendor pages; record the retrieval date and any
   version caveats attached to the fields in question.
2. Build the field-by-field verification table with a
   confirmed/changed/unverifiable marker per row. Any "changed" row is a
   finding that may reshape ADR-0018.
3. Search both docs for explicit statements about unrecognised frontmatter
   keys. Record what each says, including "says nothing".
4. Create `/tmp/opencode/agent-schema-spike/` as a scratch project. Write a
   minimal valid agent file for each client, plus a variant carrying a junk
   key and a variant carrying the *other* client's keys.
5. Have each client discover them; record whether the agent loads, loads
   with the key ignored, or is skipped. For Claude Code, `--debug` writes
   skip reasons to the debug log — use it.
6. Confirm the agent directory name for each client by which location the
   client actually discovers.
7. Confirm Claude Code's subagent tool filter includes `AskUserQuestion`,
   and OpenCode's documented default `subagent_depth`.
8. Build the capability-vocabulary table: for each of the four existing
   roles' boundaries, state the OpenCode expression and the Claude Code
   expression, or mark it unexpressible in one.
9. Assess directional expressiveness: can `permission` express a `tools`
   allowlist, and can `tools` express a glob→action bash policy? Record
   which direction loses information.
10. Write the mechanism recommendation with reasoning.
11. Confirm `~/.config/opencode/` and `~/.claude/` are unmodified apart from
    any scratch directory deliberately created and then removed.
12. `bash tests/validate.sh` in `ai-toolbox` — this task edits only its own
    brief, so the gate should be green throughout.

## Acceptance criteria
- [ ] All three vendor pages re-fetched, with the **retrieval date
      recorded** for ADR-0018 to cite
- [ ] A field-by-field table marking each row confirmed / changed /
      unverifiable; every "changed" row called out as a finding
- [ ] Each client's behaviour on an unrecognised frontmatter key
      **established by observation**, not inferred from silence in the docs
- [ ] The superset-file option genuinely assessed, with a stated reason for
      accepting or rejecting it — **not** assumed away because the human
      chose emission
- [ ] The actual agent directory name confirmed for both clients
- [ ] Claude Code's `AskUserQuestion` strip and OpenCode's default
      `subagent_depth` both confirmed, since they force
      `designer-manager` to be primary
- [ ] A capability-vocabulary table covering the four existing roles'
      boundaries, marking any term unexpressible in either client
- [ ] Directional expressiveness answered: which mapping direction loses
      information
- [ ] A mechanism recommendation sufficient for ADR-0018 to cite
- [ ] No real client config modified; scratch confined to `/tmp/opencode/`

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — **not expected**;
      this task adds no component

## Risks and rollback
- **Risk: confirming the plan instead of testing it.** The single most
  likely failure. The mapping table was written by the same agent lineage
  that will verify it, and agreement is the expected outcome — which is
  exactly why the acceptance criteria demand a per-row marker and an
  explicit assessment of the option the decision already rejected. S5's
  REVIEW-0007 finding 1 is the precedent: four confidently-written claims,
  all wrong, all caught only by opening the file named in the declaration.
- **Risk: concluding from documentation silence.** If neither doc states
  what happens to an unknown key, the answer is **unverified**, not
  "ignored". That is why step 4-5 test it. An unverifiable result recorded
  as unverified is correct; recorded as verified is the defect this repo
  keeps paying for.
- **Risk: a fixture file landing in a real config directory.** Writing an
  agent file into `~/.config/opencode/agents/` to test discovery would
  create the very directory whose existence is in question and pollute a
  live config. Use a scratch project and its project-local agent path; if a
  global test is unavoidable, record it and remove the file immediately.
- **Risk: the clients need a restart to discover a new directory.** Claude
  Code's docs state the watcher covers only directories that existed when
  the session started, so a first-ever agent file in a new directory needs a
  restart. A negative discovery result could therefore be a stale watcher
  rather than a wrong path. Restart before concluding.
- **Risk: an unexpressible capability discovered late.** If a boundary the
  existing roles rely on — `qa-test` editing test files only — cannot be
  expressed abstractly, the profile vocabulary shrinks and TASK-0045's
  reconciliation gets harder. Better found here than in TASK-0045.
- **Rollback:** nothing to roll back. Scratch is under `/tmp/opencode/`; the
  only committed change is this brief's execution log.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| This brief's execution log | Dated re-verification table with per-row markers; unknown-key behaviour per client, observed; confirmed directory names; the two structural constraints confirmed; capability-vocabulary table; directional expressiveness; mechanism recommendation |
| ADR-0018 | Unblocked: its "Not established" list answered, and its mapping table either confirmed or corrected with a dated source |
| `~/.config/opencode/`, `~/.claude/` | **Unmodified** apart from scratch deliberately created and removed |
| `/tmp/opencode/agent-schema-spike/` | Scratch; may be left or removed, never committed |
| TASK-0037's schema | Informed: the abstract capability vocabulary is enumerated, so the agent frontmatter schema can be written against terms known to map to both clients |

**Next task starts here**: ADR-0018 can be written and accepted against a
dated, observed mapping, and TASK-0037 can write the normative agent schema
using a capability vocabulary that is known to be expressible in both
clients rather than one assumed to be.

Deviation to watch for: **if both clients ignore unrecognised keys**, the
superset-file option becomes live and ADR-0018's expected mechanism may
change from emission to a single file — which would remove TASK-0040's
emitter entirely and restore `link` mode for agents. That is a large
simplification and must be escalated to the human rather than decided here,
since emission was their explicit choice. Second deviation: if any mapping
row has **changed** since 2026-09-15, note that four days was enough, and
that every future cross-client claim needs re-verification at the point of
use rather than at the point of planning.

## Status
- Status: planned
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

## Execution log
### Attempt 1
- Date:
- Agent:
- Actions:
- Observations:
- Validation:
- Result:
- Commit:
- Push:
