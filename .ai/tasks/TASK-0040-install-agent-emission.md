# TASK-0040 — install.sh: emit per-client agent files

## Objective
Implement ADR-0018's mechanism: generate a client-native agent file for each
role, for each client that supports agents, from the single client-agnostic
source in `agents/<role>/agent.md`.

This is the first thing this repo deploys that has **no tracked
counterpart**. Everything else is either a symlink to a tracked file or a
printed instruction.

## Minimal context

### Why emission and not symlinking
`install.sh:105` deploys skills with `ln -sfn` — one directory, linked into
each client, so a repo edit is live everywhere with no sync step.

An emitted agent file's content **differs per client by definition**
(OpenCode's `permission` model vs Claude Code's `tools`/`disallowedTools`),
so it cannot be a symlink to one source. Agents therefore deploy by
generation only: **no `link` mode, no `copy` mode**. ADR-0018 records this
asymmetry as a consequence of the human's chosen mechanism rather than an
oversight.

### The check that must not be added
ADR-0018 clause 4: emission creates a fourth copy whose currency nothing
verifies, and *"anyone who later 'fixes' this by checking the deployed copy
breaks every fresh clone and CI."* ADR-0009 is the underlying rule — *"a
gate that cannot pass on a clean checkout stops being run, and a gate that
is not run is worse than no gate, because it is still trusted."*

The mitigation is that emission is cheap and idempotent and `install.sh` is
re-run. **Not** that a check will catch staleness. This task must not add
one, and should leave a comment saying why at the point where someone would.

### The emitter is load-bearing and the gate cannot check it
ADR-0018's consequences state this plainly: a wrong mapping produces a
**plausible** agent file with wrong permissions — a `review` agent that can
edit, say. `validate.sh` validates the *source* contract, not the emitted
output. Only fixture-based testing of the emitter catches a bad mapping.

So this task's real deliverable is the emitter **plus evidence it maps
correctly**, demonstrated per capability term. Lesson 8 applies: the
intention to be careful is not the control.

### `CLIENTS` has three columns and the gate parses it
`install.sh:36-39`:

```
# name|skills target dir|parent dir that must already exist
CLIENTS="
claude-code|${HOME}/.claude/skills|${HOME}/.claude
opencode|${HOME}/.config/opencode/skills|${HOME}/.config/opencode
"
```

Its comment states: *"tests/validate.sh reads these names from here and
requires configs/<name>/README.md for each, so the names must match the
configs/ directory names exactly."* The gate parses this block with `sed`.

Adding an agents target means a fourth column or a second table, and either
way **the gate's parsing must follow**. Getting this wrong means a client
could be added with no wiring snapshot, which is the defect that check
exists to prevent.

LM Studio stays absent, per ADR-0006 — it supplies models and performs no
agentic work, so it supports neither skills nor agents.

### The directory name is not assumed
TASK-0036 confirms the actual agents directory per client by observation.
Neither `~/.config/opencode/agents/` nor `~/.claude/agents/` existed when
this brief was written, and OpenCode's config key is singular (`"agent"`)
while its documented directory is plural — exactly the mismatch that
produces a silently-ignored directory. **Use TASK-0036's confirmed paths,
not this brief's.**

### The client-skipping rule already exists and should be reused
`install.sh:86-89` skips a client whose parent directory is absent, printing
`client skipped: <name> (not installed: <parent> absent)`. It does **not**
create it. That behaviour is right for agents too: emitting into
`~/.claude/agents/` on a machine without Claude Code would create
configuration for a client that is not there.

But note the asymmetry to decide: the *parent* (`~/.claude`) may exist while
the *agents subdirectory* does not — which is the current state of this
machine. Creating the subdirectory under an existing parent is consistent
with what the skills path already does (`mkdir -p "$target"` at `:91`).

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `.ai/decisions/0018-agent-portability-one-source-per-client-emission.md` | TASK-0033/0036 | **Accepted**; the per-client mapping, the profile→native translation, clause 4's no-freshness-check rule, clause 7 on model references |
| `.ai/tasks/TASK-0036-spike-agent-schema-mapping.md` | TASK-0036 | `done`; **confirmed** agent directory names, capability vocabulary with both clients' expressions, directional expressiveness |
| `docs/development/authoring-guide.md` | TASK-0037 | Normative agent schema and the enumerated capability vocabulary |
| `agents/_template/agent.md` | TASK-0037 | The source shape to emit from |
| `scripts/install.sh` | pre-existing | 147 lines. `CLIENTS` `:36-39`; hook activation `:44-76`; client loop `:79-107`; real-directory `NOTICE` `:100-103`; MCP print-only after |
| `tests/validate.sh` | pre-existing + TASK-0038 | Parses the `CLIENTS` block with `sed` for the config-pairing check; agent source checks added by TASK-0038 |
| `configs/{claude-code,opencode,lm-studio}/README.md` | pre-existing | Wiring snapshots, verified 2026-09-13; all three need an agents statement, LM Studio's being "not supported" |
| `~/.config/opencode/skills/agent-tiers/models.jsonc` | TASK-0035 | In this repo after the import; `{tier:<name>}` placeholders substituted at install time — the existing precedent for model indirection (ADR-0018 clause 7) |

**Verify the expected state; don't assume it.** Take the agent directory
paths from TASK-0036's log, not from this brief. Re-read `install.sh` for
current line numbers.

## Scope

### Included
- Extend `CLIENTS` (a fourth column, or a second table — decide and record
  why) with each client's agents target.
- Update `validate.sh`'s `CLIENTS` parsing so the config-pairing check still
  works. Coordinated with TASK-0038 but a distinct concern: that task checks
  agent *sources*, this one keeps the *client* check correct.
- An emitter that reads `agents/<role>/agent.md` and writes a client-native
  file per client, translating the capability profile per ADR-0018.
- Skip `_template*`, matching `:94` and the registry's central skip.
- Reuse the absent-parent skip; `mkdir -p` the agents subdirectory under an
  existing parent, matching `:91`.
- A comment at the emission point stating that **no freshness check is
  possible or wanted**, citing ADR-0018 clause 4 and ADR-0009.
- An agents statement in all three `configs/*/README.md` — including LM
  Studio's, which states agents are **not supported** there, matching how it
  already handles skills.
- **Per-term mapping proof**: for each capability vocabulary term, emit and
  show the resulting client-native syntax is what the term means in that
  client.

### Not included
- **Any freshness or presence check.** ADR-0009, ADR-0018 clause 4.
- **`link` or `copy` mode for agents.** ADR-0018 clause 3.
- **Authoring a role.** TASK-0043, TASK-0045. This task emits from the
  template and from temporary fixtures.
- **Applying the BMAD topology to a live config.** Out of S7's scope
  entirely; emitting a role file is not the same as writing an `agent` block
  into `opencode.jsonc`.
- **Resolving the `models.jsonc` overlap.** ADR-0018 clause 7 requires the
  decision; if the ADR left it open, **stop and escalate** rather than
  improvising a second owner for model IDs.
- LM Studio as an emission target. ADR-0006.
- `prompts/`. B-016.

## Likely files
- `scripts/install.sh`
- `tests/validate.sh` — `CLIENTS` parsing only
- `configs/claude-code/README.md`, `configs/opencode/README.md`,
  `configs/lm-studio/README.md`
- Possibly a separate emitter script under `scripts/` if `install.sh` grows
  unwieldy — decide at execution time; recorded here as a genuine fork in
  the forecast rather than a prediction
- `.ai/tasks/TASK-0040-install-agent-emission.md` — this file

## Execution plan
1. Confirm ADR-0018 is `Accepted` and TASK-0036 is `done` with confirmed
   directory paths and a capability vocabulary. **Stop and escalate if
   clause 7's model-reference question was left open.**
2. Re-read `install.sh` and `validate.sh`'s `CLIENTS` parsing.
3. Decide fourth column vs second table; record the reasoning.
4. Extend `CLIENTS`; update the gate's parsing; run `validate.sh` to confirm
   the config-pairing check still passes for both clients.
5. **Prove the pairing check still bites**: temporarily add a bogus client
   row with no `configs/` directory and confirm the gate fails. Revert.
6. Implement the emitter with the profile→native translation.
7. Add the no-freshness-check comment at the emission point.
8. Create temporary fixture roles exercising **every** capability term, one
   per term.
9. Run `bash scripts/install.sh` and inspect each emitted file. For every
   term, confirm the emitted client-native syntax means what the term means.
   Record per term.
10. Confirm `_template*` is not emitted.
11. Confirm behaviour when a client's parent is absent (skip, no creation)
    and when the parent exists but the agents subdirectory does not (create
    it), matching the skills path.
12. Confirm no `agent` key was written to any `opencode.jsonc`.
13. Update the three `configs/*/README.md`.
14. Remove the fixtures; re-run `install.sh`; note whether stale emitted
    files persist — **they will**, since nothing prunes them, and that is
    worth recording as a known property rather than discovering later.
15. `bash tests/validate.sh`; `bash scripts/sync-registry.sh`.
16. Review the diff; commit; record the hash; push; confirm; record.

## Acceptance criteria
- [ ] `CLIENTS` carries each client's agents target; the choice of fourth
      column vs second table is **recorded with its reasoning**
- [ ] `validate.sh`'s config-pairing check still passes **and is observed
      still failing** on a bogus client row
- [ ] An emitted file is produced per role per supporting client, from one
      source
- [ ] **Every capability vocabulary term is demonstrated** emitting the
      correct client-native syntax in both clients — recorded per term, not
      summarised
- [ ] No `link` or `copy` mode for agents
- [ ] `_template*` not emitted
- [ ] A comment at the emission point states why no freshness check exists,
      citing ADR-0018 clause 4 and ADR-0009
- [ ] Absent-parent clients are skipped without creating anything; an
      existing parent's missing agents subdirectory **is** created
- [ ] No `agent` key written to any `opencode.jsonc`
- [ ] All three `configs/*/README.md` state their agents position; LM
      Studio's says not supported
- [ ] The **stale-emitted-file** behaviour after a role is removed is
      recorded as a known property
- [ ] `tests/validate.sh` green; `scripts/sync-registry.sh` run

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed) — run it; a diff is
      possible if fixtures were left, which would itself be the finding

## Risks and rollback
- **Risk: a plausible file with wrong permissions.** The named, expected
  failure mode. A `review` agent emitted with edit rights would pass every
  check this repo has, because the gate validates the source and the source
  would be correct. Only the per-term proofs catch it, which is why they are
  itemised rather than bundled.
- **Risk: someone adds a freshness check.** The most attractive wrong idea in
  this task. Two ADRs forbid it; the inline comment puts the reasoning where
  a reader hits it before writing the check.
- **Risk: breaking the config-pairing check while extending `CLIENTS`.** The
  gate parses that block with `sed`. A silently-broken parse would let a
  future client be added with no wiring snapshot — and the check would still
  report green. Step 5 proves it still bites.
- **Risk: writing into a live config.** Emitting a role file into a client's
  agents directory is intended; writing an `agent` block into
  `opencode.jsonc` is not, and the two are easy to conflate because
  `agent-tiers`' installer does the second. Never run `install-tiers.ps1`.
- **Risk: stale emitted files accumulate.** Nothing prunes an emitted file
  when its role is deleted or renamed, so a removed role's agent stays live
  in both clients. Step 14 records this deliberately. It is a real weakness
  of emission and belongs in a backlog item if it matters, not in an
  undocumented cleanup that deletes files in a user's config directory.
- **Risk: `core.filemode=false`.** If any emitted or new script needs the
  executable bit, `chmod +x` will not work in this tree — use
  `git update-index --chmod=+x`, per `docs/operations/runbook.md`.
- **Risk: two owners for model IDs.** `models.jsonc` already substitutes
  `{tier:<name>}` at install time. If the emitter grows its own model
  handling, the same fact has two owners — the defect class lesson 6 and the
  one-owner rule both address. Escalate rather than improvise.
- **Rollback:** repo changes revert cleanly in one commit. **Emitted files in
  client directories do not** — they are outside the repo and untracked.
  Rollback therefore means `git revert` plus manually removing the emitted
  files from both clients' agents directories. Record their paths in the
  execution log so that is possible.

## Outputs / handover

**Intended end state — this task has not run.** The table below is a plan.
`validate.sh` requires this section non-empty for briefs ≥ 0020 and cannot
distinguish an intention from a state (ADR-0012 Decision 3), so this
sentence does it.

| Artifact | Intended end state |
|----------|-------------------|
| `scripts/install.sh` | Emits per-client agent files from one source; `_template*` skipped; no `link`/`copy` for agents; the no-freshness-check comment in place |
| `tests/validate.sh` | `CLIENTS` parsing updated; config-pairing check still passing **and still able to fail** |
| `configs/*/README.md` (×3) | Each states its agents position; LM Studio's says not supported |
| This brief's execution log | Per-term mapping proof; the pairing-check failure demonstration; the emitted-file paths (needed for rollback); the stale-file property |
| Client agents directories | Created under existing parents; populated only from the template and removed fixtures at this point — **no real role exists until TASK-0043** |
| Any `opencode.jsonc` | **Unchanged.** No `agent` key. The topology stays unapplied |

**Next task starts here**: `agents/` is defined, enforced, indexed and
deployable. Phase 2 is complete, so TASK-0043 and TASK-0045 can author real
roles and have them gated, indexed and emitted with no further plumbing.

Deviation to watch for: if the fourth-column change to `CLIENTS` turns out to
break the gate's `sed` parsing in a way that is awkward to fix, a second
table is the fallback — record which was chosen and why, since TASK-0038's
author may have assumed the other shape. And if TASK-0036 found both clients
ignore unknown keys, ADR-0018 may have chosen a superset file instead, in
which case **this task's emitter does not exist** and the task reduces to
adding a symlink target — a large simplification that would have been
escalated by TASK-0036 rather than decided here.

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
