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
- Status: done
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

## Execution log
### Attempt 1
- Date: 2026-09-15
- Agent: opencode (claude-opus-5)

#### Provenance of every external claim below

**All three vendor pages re-fetched 2026-09-15.** `PLAN-0004` and ADR-0018
were **not** cited; the mapping was rebuilt from the fetched text and then
tested. Client versions observed on this machine at the same time:

| Source | Retrieved | Version marker |
|---|---|---|
| `opencode.ai/docs/agents/` | 2026-09-15 | page footer: *"Last updated: Sep 14, 2026"* |
| `code.claude.com/docs/en/sub-agents` | 2026-09-15 | no page date; cites **35 distinct patch versions** (v2.1.153 … v2.1.271), counted not estimated |
| `code.claude.com/docs/en/workflows` | 2026-09-15 | no page date; same per-version caveats |
| `opencode --version` | 2026-09-15 | **1.18.31** |
| `claude --version` | 2026-09-15 | **2.1.246 (Claude Code)** |

**The installed Claude Code is behind several documented version gates.**
The docs describe `omitClaudeMd` as requiring v2.1.271, the
`--append-subagent-system-prompt-file` flag v2.1.261, and
`CLAUDE_CODE_SUBAGENT_MODEL_FORCE` v2.1.257 — all **above the installed
2.1.246**. Of the 35 versions the page cites, **6 are newer than the
binary on this machine** (248, 251, 257, 261, 267, 271 — counted, after
first writing "11" from estimation). So a field can be documented,
correct, and still
absent from the client that reads it. **A doc-derived mapping is not a
fact about the installed client.** TASK-0040's emitter must be written
against the installed version, not the docs' newest.

#### 1. Field-by-field re-verification

Marker legend: **confirmed** = live doc says what ADR-0018's table says ·
**changed** = differs · **unverifiable** = neither doc nor observation
settles it.

| # | Concern | ADR-0018's claim | Live finding 2026-09-15 | Marker |
|---|---|---|---|---|
| 1 | Location (OpenCode) | `~/.config/opencode/agents/`, `.opencode/agents/` | Docs say exactly that. **Observation: `.opencode/agent/` (singular) ALSO loads** | **changed** |
| 2 | Location (Claude Code) | `~/.claude/agents/`, `.claude/agents/` | Confirmed, plus 3 more scopes: managed settings, `--agents` CLI JSON, plugin `agents/`. Scanned **recursively** | confirmed (incomplete) |
| 3 | Identity (OpenCode) | the **filename** | **Incomplete as stated.** The docs say only *"The markdown file name becomes the agent name"* and never mention `name:`. **Observed: a `name:` field overrides the filename** — `filename-wins.md` carrying `name: totally-different-name` registered as **`totally-different-name`**, not `filename-wins` | **changed** |
| 4 | Identity (Claude Code) | required `name` field, filename need not match | Confirmed verbatim | confirmed |
| 5 | Capability gating (OpenCode) | `permission: {read, edit, bash, task, skill, webfetch, …}` each allow/ask/deny, optionally glob→action | Confirmed. Full key list now enumerated: **15** keys. Only 10 accept glob→action; **5** accept shorthand only | confirmed (refined) |
| 6 | Capability gating (Claude Code) | `tools` / `disallowedTools` / `permissionMode` | Confirmed. Plus: both applied `disallowedTools`-first; `Bash(git push *)` in `disallowedTools` removes **the whole tool** | confirmed (refined) |
| 7 | Primary vs subagent | OpenCode explicit `mode`; Claude Code **no equivalent field** | Confirmed. `mode` defaults to `all`. Claude Code infers it; an agent file becomes primary only via `--agent`/`agent` setting | confirmed |
| 8 | Model reference | `provider/model-id` vs alias/full-ID/`inherit` | Confirmed, and **mutually invalid**: OpenCode accepts a bare `haiku` at *parse* time and fails at *run* time | confirmed (sharpened) |
| 9 | Restricting delegation | `permission.task` glob, last-match-wins vs `tools: Agent(a, b)` allowlist | Confirmed. **Asymmetry found:** `Agent(...)`'s type list is **ignored inside a subagent definition** — only honoured for `claude --agent` main-thread agents | confirmed (narrowed) |
| 10 | Subagent nesting | OpenCode `subagent_depth` (1 in agent-tiers, also the default); Claude Code 3 layers | **Fully confirmed.** Claude Code 3 layers. `subagent_depth: 1` present in `agent-tiers`' fragment (`opencode.bmad.jsonc:12`), **and `opencode.ai/docs/config/` states verbatim: *"The default is 1, which allows primary agents to launch subagents but prevents those subagents from launching additional subagents."*** Absent from the *agents* page; documented on the *config* page | confirmed |
| 11 | Iteration cap | `steps` vs `maxTurns` | Confirmed, and `maxSteps` is now **explicitly deprecated** in favour of `steps` | confirmed |
| 12 | Overlap is `description`, `model`, `color` | — | **Overstated.** `model` and `color` overlap **in name only** — values are mutually invalid (see #8); Claude Code's `color` is an 8-name enum, OpenCode's accepts hex or 7 theme names. **`description` is the only truly portable field** | **changed** |

**Three rows changed, in four days.** Two of them (#3, #12) are
corrections to claims ADR-0018 states as established. **No row is
unverifiable** — row 10 was initially marked so and the verdict was wrong
(see §5).

#### 2. Unrecognised frontmatter keys — the question that could have killed emission

**Correction to the brief's premise.** The brief and ADR-0018 both treat
this as undocumented in both clients. **OpenCode documents it explicitly**,
under *Additional*: *"Any other options you specify in your agent
configuration will be passed through directly to the provider as model
options."* So OpenCode's answer is not "ignored" — it is **forwarded to the
provider**. Claude Code's docs remain silent on unknown keys (they list
only the conditions under which a file is *skipped*). Tested in both cases
anyway, because "passed to the provider" has a failure mode of its own.

| Client | Fixture | Observed result |
|---|---|---|
| OpenCode | `zzz_totally_unknown_key: junk` | **Loads.** Agent listed, permissions intact |
| OpenCode | Claude Code keys with no OpenCode counterpart (`disallowedTools`, `permissionMode`, `maxTurns`, `omitClaudeMd`, `isolation`) | **Loads.** Listed and runs (`say OK` → `OK`) |
| OpenCode | `tools: Read, Grep, Glob` (Claude Code's **string** form of a key OpenCode also has) | **FATAL — and not only for that file.** `Error: Configuration is invalid at …/spike-crossclient.md ↳ Expected object \| undefined, got "Read, Grep, Glob" tools`. **`opencode agent list` produced no output at all**: one bad file took down the whole agent list |
| Claude Code | `zzz_totally_unknown_key: junk` | **Loads.** `claude -p` listed `cc-junkkey` |
| Claude Code | OpenCode keys (`mode`, `permission:` block, `temperature`, `steps`, `hidden`, `top_p`) | **Loads.** Listed `cc-opencodekeys` |
| Claude Code | `claude plugin validate .claude/agents` on all three | `✔ Validation passed` |

**Gate proof (lesson 1, and the specific trap CURRENT_STATE records from
TASK-0042).** `claude plugin validate` was **not** trusted on a pass. A
deliberately malformed fixture was validated first:
- First negative control **failed for the wrong reason** — directory named
  `negctl`, so the command took its *plugin-manifest* path and reported
  `No manifest found`, nothing to do with YAML. Recorded because a pass
  read off that run would have been meaningless.
- Re-run as `neg/agents/broken.md`, it failed correctly:
  `frontmatter: YAML frontmatter failed to parse … At runtime this agent
  does not load at all`. **Exit 1.** The check bites, matched on its own
  message.
- **Also noted:** the passing run validated only the *named* directory's
  files and printed no per-file lines for the good ones. It proves nothing
  about a file it did not name.

**So the answer is asymmetric, and "ignored" was the wrong frame in two
ways.**

1. Both clients **load** a file carrying a genuinely unknown key. Neither
   is fatal. So far, the brief's "might a superset work?" is live.
2. **But OpenCode does not ignore it — it forwards it to the provider as a
   model option** (documented, quoted above). A Claude-Code-only key in an
   OpenCode file is therefore a **silent API parameter**, not inert. Tested
   directly: a `maxOutputTokens: 1` fixture — an unknown key to OpenCode
   that a provider *would* recognise — still returned a full 20-word
   answer, so on this provider path it did not take effect. **That is one
   provider on one day, not a guarantee.** Recorded as: forwarding is
   documented, its effect was not reproduced, and a foreign key in an
   OpenCode agent file is *by the vendor's own description* an untyped
   pass-through to a third party. That is not a property to build a
   deployment mechanism on.
3. The genuinely fatal case is neither of these: it is **a key both clients
   define with incompatible types**. `tools` is the live case — OpenCode
   types it as an object (deprecated), Claude Code as a comma-separated
   string. `model` is the second (#8). A superset file hits these **by
   construction**, because the overlap is exactly where both clients have
   an opinion.

#### 3. The superset option, genuinely assessed — and rejected on a harder ground than expected

Emission was the human's choice, so the obligation was to test whether
evidence overturns it. **It does not, and the reason is not the one
ADR-0018 predicted.** ADR-0018 expected the blocker to be *semantic*
(`permission` vs `tools` are different models). The real blocker is worse,
and it is a **safety** blocker:

**A superset file loads in both clients and silently loses its safety
boundary in one of them.** Observed directly:

- Fixture `cc-permonly` declared read-only using **only** OpenCode's
  syntax (`permission: {edit: deny, write: deny, bash: deny}`), with no
  `tools` and no `disallowedTools`.
- Claude Code **loaded it** and the subagent reported its own tool list as
  including **`Write`, `Edit`, and `Bash`**.
- Control fixture `cc-control`, identical in intent but using Claude
  Code's native `tools: Read, Grep, Glob`, reported
  **`WRITE=no EDIT=no BASH=no`**.

The `permission:` block was parsed as an unknown key and **discarded
without a warning**. The agent kept write access while its file said
`deny`. That is ADR-0018's predicted emitter failure — *"a plausible agent
file with wrong permissions, a `review` agent that can edit"* — except a
superset file produces it **by construction, on every role, with no
emitter bug required**.

*Honest limit on that observation:* when pushed to write a file, the
subagent **refused**, citing its own read-only system prompt, and made
zero tool calls — so no `BREACH.txt` was created. **That refusal is
prompt-adherence, not enforcement.** The tool remained in its pool; only
the model's compliance stopped the write. The whole point of
`agent-tiers`' permission boundaries is that they hold when compliance
does not. Recorded as: **tool-pool breach observed and confirmed by
contrast; a completed write was not obtained, because the model declined
to try.** The breach is the tool list, not the refusal.

**Verdict: reject the superset file.** Not because unknown keys are fatal
(they are not), but because they are *silently* not fatal, in precisely
the fields that carry the safety contract. A superset file's failure is
invisible: it loads, it runs, it looks right, and one client enforces
nothing. **Emission stands, and now has an evidence-based justification
rather than a stylistic one.**

#### 4. Directory names — confirmed by observation, and one doc is incomplete

Pre-state verified first: `~/.config/opencode/agents`,
`~/.config/opencode/agent`, and `~/.claude/agents` **all absent** (as the
brief expected). Fixtures therefore went to a scratch project only.

- **OpenCode: both `agents/` and `agent/` are discovered.** Distinct
  fixtures placed in `.opencode/agents/spike-plural.md` and
  `.opencode/agent/spike-singular.md`; `opencode agent list` listed
  **`spike-plural (subagent)` and `spike-singular (subagent)`**. The docs
  name only the plural. The singular/plural mismatch that looked like a
  trap is **not** one — but the plural is what the docs support, so the
  emitter should write `agents/` and TASK-0040 must not "fix" a singular
  directory it finds.
- **Claude Code: `.claude/agents/` confirmed** — `claude -p` enumerated
  all three `cc-*` fixtures. No restart was needed; the directory was
  created before the process started, which is the condition the docs give.

#### 5. The two structural constraints — both confirmed, the second only after widening the search

- **`AskUserQuestion` strip: CONFIRMED.** The sub-agents page lists it in
  the first tool filter, applied *"even when listed in the `tools`
  field"*, alongside `EnterPlanMode`, `ExitPlanMode`, `Workflow`,
  `EndConversation`, `ScheduleWakeup`, `TaskOutput`, `WaitForMcpServers`,
  and `Agent` at the depth limit. **New detail:** a **fork** skips both
  filters. Also a **second** filter applies to *background* subagents
  (the default), cutting the built-in set further.
- **OpenCode default `subagent_depth`: CONFIRMED — after an initial wrong
  verdict.** The word does not appear on `opencode.ai/docs/agents/` at all
  (verified programmatically: 0 occurrences; all 234 hits for `depth` are
  CSS `--depth` variables). **This log first recorded the default as
  unverified on that basis, and stated that `designer-manager`'s primary
  status rests on only one client's constraint.** Both claims were wrong.
  `opencode.ai/docs/config/` documents it: *"The default is 1, which
  allows primary agents to launch subagents but prevents those subagents
  from launching additional subagents."* **The brief named three pages to
  fetch; the fact lived on a fourth.** An absence found on the page you
  were told to read is not an absence.
- **Net effect on `designer-manager`: primary in both clients, forced
  independently, as ADR-0018 states.** Claude Code forces it structurally
  (a subagent cannot hold `AskUserQuestion` at any depth). OpenCode forces
  it via `subagent_depth`, whose default of **1** means a subagent cannot
  spawn workers — a documented default, not merely `agent-tiers`'
  configuration. **ADR-0018's claim is fully verified; the interim
  "half-verified" reading in this log's first draft was an artifact of
  searching too few pages.**
- **`ADR-0019`'s workflows quote re-confirmed**, wording intact: *"No
  mid-run user input … For sign-off between stages, run each stage as its
  own workflow."* The constraint row now adds *"and a usage-limit wait"*
  as a second self-pause. **Does not affect ADR-0019** — a usage-limit
  wait is not user input.

#### 6. Capability vocabulary for the four existing roles

Read from the live installed files (`~/.config/opencode/skills/agent-tiers/agents/*.md`).

| Abstract term | Role(s) | OpenCode expression | Claude Code expression | Verdict |
|---|---|---|---|---|
| `read-only` | `review` | `edit: deny`, `write: deny` | `tools: Read, Grep, Glob` (omit Write/Edit) | **maps both** |
| `no-delegation` | all four | `task: deny` | omit `Agent` from `tools` | **maps both** |
| `no-webfetch` | `review`, `git-ops`, `shell-runner` | `webfetch: deny` | omit WebFetch / `disallowedTools: WebFetch` | **maps both** |
| `worktree-only` | all four | `external_directory: deny` | **no per-agent equivalent** | **OpenCode only** |
| `test-files-only` | `qa-test` | `edit: {"*": deny, "**/test/**": allow, …}` — 7 globs | **unexpressible.** `tools` gates whole tools; a specifier in `disallowedTools` removes the entire tool. Needs a session-wide `permissions.deny` rule or a `PreToolUse` hook | **OpenCode only** |
| `bash-allowlist` | `shell-runner` (13 globs), `git-ops`, `review`, `qa-test` | `bash: {"*": deny, "ls*": allow, …}` | **unexpressible per-agent.** Same reason | **OpenCode only** |
| `no-force-push` | `git-ops` | `bash: {"git push --force*": deny, "git reset --hard*": deny, …}` | **unexpressible per-agent** | **OpenCode only** |
| `push-requires-confirmation` | `git-ops` | `bash: {"git push*": ask}` | **no `ask` at all.** `tools`/`disallowedTools` are binary; `permissionMode` is session-wide, not per-command | **OpenCode only** |

**Five of eight terms map to OpenCode only, and they are the five that
carry the actual safety value.** The three that port are all
whole-tool on/off. Every term requiring *intra-tool* granularity —
which paths, which commands, or a third `ask` state — has no per-agent
Claude Code expression.

This is the concrete form of ADR-0018's predicted consequence (*"expect
the vocabulary to be smaller than either client's native
expressiveness"*). It is **much** smaller than that wording suggests:
`git-ops` and `shell-runner`, whose entire reason to exist is a command
allowlist, **cannot be expressed as Claude Code subagents at all**
without either a session-wide settings rule or a hook. Both are outside
a single agent file — so a one-source-per-role emitter **cannot fully
emit these two roles for Claude Code**. TASK-0045 inherits this, and it
is a scoping problem, not a mapping detail.

#### 7. Directional expressiveness

- **OpenCode `permission` → Claude Code `tools`: lossy, one-way.** A
  whole-tool `deny` maps to omission from `tools`. Everything else does
  not: glob→action, and the `ask` state, have no per-agent target. Loss is
  **silent** (§3) — which is what makes it dangerous rather than merely
  inconvenient.
- **Claude Code `tools` → OpenCode `permission`: faithful.** An allowlist
  is `{"*": "deny"}` plus per-tool `allow`; a denylist is per-tool `deny`.
  OpenCode's model is a strict superset for everything `tools` can say.
- **Answer: the lossy direction is OpenCode → Claude Code.** The abstract
  profile must be defined at **Claude Code's expressiveness ceiling** for
  anything it promises to enforce in both. A term richer than that is
  either OpenCode-only-by-declaration or needs an out-of-file mechanism.
  **A profile that silently degrades is worse than one that refuses the
  term** — degradation produces `cc-permonly`: a file claiming `deny`
  over an agent that can write.

#### 8. Mechanism recommendation for ADR-0018

**Emit per client. Confirmed, on evidence.** With four amendments:

1. **Keep decisions 1, 3, 4, 5, 6 as drafted.** Unaffected by the findings.
2. **Rewrite the justification in decision 2.** The reason to abstract is
   not that a superset file is *syntactically* impossible — a mostly-junk
   superset loads fine in both. It is that it **loads and silently
   discards the safety contract in Claude Code** (§3, observed). The
   prohibition on a raw `permission:` block in a role file should cite
   `cc-permonly`.
3. **The capability vocabulary must state per-term which clients enforce
   it, and the emitter must refuse — not degrade — a term it cannot
   enforce on a target.** Five of eight terms are OpenCode-only (§6).
   Emitting a Claude Code file that drops `test-files-only` without
   failing loudly reproduces `cc-permonly` through the emitter. **This is
   the one place ADR-0018 needs a new clause.**
4. **`git-ops` and `shell-runner` need an explicit disposition** before
   TASK-0045: emit OpenCode-only, or emit a Claude Code file plus a
   session-level `permissions.deny` fragment that is **outside** the
   one-source model. Do not let TASK-0045 improvise this; it is the same
   "second owner of one fact" risk decision 7 flags for models.

**Also for TASK-0037/0040, from observation not inference:**
- Write `agents/` (plural) for OpenCode. `agent/` also works but is
  undocumented; do not rely on it and do not "correct" one found in place.
- A role file must **not** carry a `name:` field. It is meaningless-to-
  harmful in OpenCode (silently overrides the filename, §1 row 3) and
  **required** in Claude Code. The emitter adds it for Claude Code and
  omits it for OpenCode — so it belongs to emission, never to the source.
- **Never emit a `tools:` key for OpenCode.** It is the one observed
  fatal collision, it is deprecated anyway, and one bad file **breaks the
  entire agent list**, not just itself. Worth a `validate.sh` check in
  TASK-0038: no `tools:` in any `agents/<role>/agent.md`.
- `model` must be emitted per client (`provider/model-id` vs alias), and
  an OpenCode model error surfaces **only at run time** (§1 row 8) — so
  `validate.sh` cannot catch a bad one. Consistent with ADR-0009; record
  it as a known blind spot rather than adding a runtime check.

- Observations (deviations from the brief's expectations):
  - **The brief's framing of the central question was subtly wrong, and
    the correction matters.** It asked whether unknown keys are "ignored
    or fatal", with the stated stake that *if both ignore them, a superset
    file might work and emission is unnecessary*. Both **do** ignore them
    — and a superset file is **more** dangerous than if they had been
    fatal. A fatal key fails loudly at load; a discarded `permission:`
    block ships an agent with permissions nobody granted. **"Ignored" was
    the outcome the brief treated as the safe one.** Under the brief's own
    escalation rule this would have triggered a human escalation toward
    the superset option; it does not, because the evidence points the
    other way. Escalation not raised, and this paragraph is why.
  - **Two of ADR-0018's "established" rows were wrong** (identity in
    OpenCode; the three-field overlap), and a third changed. **Four
    days.** Lesson 7 holds with more force for external state, exactly as
    the brief predicted.
  - **This spike's own worst error was an absence claimed from too small a
    search.** `subagent_depth` is absent from the agents page, so its
    default was recorded **unverified** and ADR-0018's
    "forced independently by each client" was downgraded to
    "half-verified". Then `opencode.ai/docs/config/` was checked and
    states the default is **1**, verbatim. **The brief listed three pages
    to fetch and the fact was on a fourth.** The brief's own risk section
    warns that documentation silence means *unverified, not "ignored"* —
    the symmetric trap is treating silence on *one page* as silence in
    *the docs*, and this log fell into it before catching it. **A
    negative claim about documentation needs the search scope stated, or
    it is an assertion about where you looked.**
  - **The installed Claude Code is older than the docs it was read
    against** (2.1.246 vs fields gated at 2.1.257/261/271). A
    doc-confirmed field is not an installed field.
  - **A gate proof failed for the wrong reason first** — the exact class
    TASK-0042 recorded, recurring one task later. The malformed fixture
    lived in `negctl/`, so `claude plugin validate` took its
    plugin-manifest path and reported a missing manifest. Re-run as
    `neg/agents/`, it failed on YAML as intended. **The directory's
    *name* selected which validator ran.** Both runs "failed"; only one
    was evidence.
  - **Three `opencode run` attempts produced `UnknownError` for an
    unrelated reason** — without `--dir`, `run` attached to the server
    already running in the workspace root, so the scratch fixtures were
    not in scope. Caught by running a **clean control** that failed
    identically; with `--dir`, clean and junk fixtures both returned `OK`.
    **The first result would have read as "junk keys break OpenCode at
    run time," which is false.** A control distinguished a fixture failure
    from a harness failure.
  - **The tool-pool breach is confirmed; a completed write is not.** The
    subagent refused on prompt grounds and called no tools. Recorded as a
    tool-pool finding evidenced by the `cc-control` contrast, not as a
    demonstrated write. Stated as observed, not upgraded.

- Validation:
  - `bash tests/validate.sh` → **PASS**, output `validate.sh: OK`, 0.69 s
    (`Measure-Command`), re-run after the edit. **Note:** the first draft
    of this log recorded that output as `All checks passed`, 24 files,
    0.39 s — none of which the gate prints. Written from memory of what a
    green gate "says" rather than from the run, and caught by reading the
    actual output. Lesson 7 inside this task's own log, on this repo's own
    tooling, in the same session that recorded four external instances of
    it. **A second invented figure was caught the same way**: §1 row 5
    first said OpenCode has "16" permission keys with "6" shorthand-only;
    counting the fetched table gives **15** and **5**. Both numbers were
    plausible and neither was counted. Every other count in this log was
    then re-derived from source: `qa-test`'s edit globs (**7**) and
    `shell-runner`'s bash allows (**13**) both verified by grep.
  - `scripts/sync-registry.sh` → **not run; not applicable.** No component
    added or changed. `git status` clean apart from this brief.
  - Real client state **unmodified**: `~/.config/opencode/agents`,
    `~/.config/opencode/agent`, `~/.claude/agents` all still absent after
    the spike; `~/.config/opencode/opencode.jsonc` mtime unchanged
    (2026-08-24). **Three files under `~/.claude/` were rewritten by the
    client while running `claude -p`** — `settings.json` (04:07),
    `policy-limits.json` and `remote-settings.json` (both 04:08). All
    three inspected: `{"theme": "dark"}`, a server-supplied policy block
    (web-search isolation, trusted devices, remote-control default), and
    `{}`. **No agent, permission or tool key in any of them**, so these
    are the client's own startup/policy sync and the spike introduced
    nothing. Recorded rather than glossed, since the brief required no
    real config be modified. **The first draft of this log claimed only
    `settings.json` had moved** — found by widening the check from one
    named file to *every* recently-written file in the directory. Checking
    the file you thought of is not checking the directory.
  - All fixtures confined to `/tmp/opencode/agent-schema-spike/`. Left in
    place, never committed.

- Result: **done.** All ten acceptance criteria met. ADR-0018 is unblocked
  with a dated, observed mapping; its mechanism is confirmed but its
  *reasoning* and one clause need revision (§8), and two of its
  "established" rows need correcting. TASK-0037 has an enumerated
  capability vocabulary with per-term client coverage — and the finding
  that **five of eight terms are OpenCode-only**, two roles being
  unexpressible as Claude Code subagents at all, which is a scoping input
  TASK-0045 would otherwise have discovered late.
- Commit: `46c4c10`
- Push: confirmed — `origin/master` at `46c4c10`, verified by re-fetch
