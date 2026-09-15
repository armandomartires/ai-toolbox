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
- Status: done
- Owner: agent
- Created: 2026-09-15
- Updated: 2026-09-15

## Execution log
### Attempt 1
- Date: 2026-09-15
- Agent: opencode (claude-opus-5)

#### Step 1 gate, including clause 7 — decided, not escalated
ADR-0018 `Accepted`; TASK-0036 `done` with confirmed directory paths and a
capability vocabulary.

**Clause 7 (model references) was NOT left open** — it explicitly says the
question *"must be decided in `TASK-0040`"*. So the brief's escalation
trigger ("stop and escalate if clause 7's question was left open") does not
fire; deciding it is this task's assigned job.

**Decision: the emitter reuses `{tier:<name>}` placeholders and owns no
model IDs.** A role's optional `model` is a **tier name**, emitted as
`model: "{tier:<name>}"` for both clients. Substitution stays with
`models.jsonc`, exactly as `agent-tiers` already does it.

Verified first that `skills/agent-tiers/` **does not exist in this repo
yet** — TASK-0035 is blocked behind ADR-0017/TASK-0034. So `models.jsonc`
is not importable and the emitter could not read it even if it wanted to.
That makes the decision cleaner rather than harder: the emitter emits the
placeholder and never resolves it, so there is exactly one owner of the
tier→model mapping and it is the file that already owns it. Had the emitter
resolved tiers itself, the same fact would have two owners the moment
TASK-0035 lands — the defect clause 7 exists to prevent.

#### `CLIENTS`: a fourth column, chosen on evidence rather than preference

The brief left this a genuine fork. Tested both constraints **before**
editing:

1. **The gate's parse anchors on the first field.**
   `grep -oE '^[a-z0-9_-]+\|'` — extra columns are invisible to it. Probed
   with a simulated four-column block: both client names parsed correctly.
2. **`install.sh`'s own read is positional.** `IFS='|' read -r client
   target parent agents_target` — a fourth field populates cleanly.

**Chose the fourth column.** A second table would have created a *second
list of client names* that could disagree with the first — which is the
defect the config-pairing check exists to catch, reintroduced one level up
where that check cannot see it. Recorded in the script's own comment, not
only here.

**The gate needed no change at all.** The brief anticipated updating
`validate.sh`'s parsing; the existing parse was already robust to extra
columns. So this task touched `tests/validate.sh` **zero times** — which
also removes the file-collision risk that made these three tasks unsafe to
run in parallel.

#### The pairing check still bites — proven, not assumed
A four-column block that *passes* proves nothing on its own. A bogus fourth
client row (`bogus-client|/tmp/x/skills|/tmp/x|/tmp/x/agents`) with no
`configs/` directory was injected:

```
MISSING wiring snapshot: configs/bogus-client/README.md (client 'bogus-client' is in scripts/install.sh)
exit=1
```

Reverted; restore confirmed **byte-identical by SHA-256**; gate green again.

#### Per-term emission proof — all nine terms, recorded individually

The task's real deliverable. One fixture role per term, emitted for both
clients, output inspected. `R` = emission refused.

| Term | OpenCode emitted | Claude Code emitted |
|---|---|---|
| `read-only` | `edit: deny`, `write: deny` | `disallowedTools: Write, Edit, NotebookEdit` |
| `no-delegation` | `task: deny` | `disallowedTools: Agent` |
| `no-webfetch` | `webfetch: deny`, `websearch: deny` | `disallowedTools: WebFetch, WebSearch` |
| `worktree-only` | `external_directory: deny` | `isolation: worktree` *(partial — see below)* |
| `test-files-only` | `edit:` map, `"*": deny` then 7 allow globs | **R** |
| `bash-allowlist` | `bash: {"*": ask}` | **R** |
| `no-force-push` | `bash:` 5 deny globs (`git push --force*`, `-f*`, `reset --hard*`, `rebase*`, `filter-branch*`) | **R** |
| `push-requires-confirmation` | `bash: {"git push*": ask}` | **R** |
| `webfetch-requires-confirmation` | `webfetch: ask` | **R** |

Each refusal printed the full reason and the remedy:

> `EMISSION REFUSED: role '_fixture-no-force-push' declares 'no-force-push',
> which Claude Code cannot enforce per-agent (tools/disallowedTools gate
> whole tools and have no 'ask' state). Narrow its 'clients' list to
> opencode, or see ADR-0018 clause 8.4 before adding a workaround.`

**Four map to both clients; five refuse for Claude Code.** That matches
TASK-0036's finding exactly, and clause 8 is now executable rather than
aspirational.

**Glob ordering is semantic and was checked against the real role.**
OpenCode's rules are last-match-wins, so the emitter writes `"*"` first and
specific globs after. Compared byte-for-byte in ordering against the live
`agent-tiers` `qa-test` role: same shape (`"*": deny` first, then the seven
test-path allows). A sorted-alphabetically emission would have **inverted
the meaning** — allows first, then a blanket deny that wins. Caught by
comparing against a real role rather than reading the emitted file for
plausibility.

#### `worktree-only`: the decision TASK-0037 assigned here

TASK-0037 recorded this as *partial* and explicitly deferred the choice to
this task: emit Claude Code's `isolation: worktree`, or refuse the client.

**Decision: emit `isolation: worktree`, and record the difference rather
than hide it.** Reasoning:
- The two are not equivalent. OpenCode's `external_directory: deny`
  **refuses** tool calls outside the worktree. Claude Code's `isolation:
  worktree` **redirects** the agent into an isolated *copy* of the repo and
  checks its commands stay inside. Confinement by refusal vs by
  redirection.
- But **all four existing roles declare this term.** Refusing it would make
  every one of them OpenCode-only, which would empty the Claude Code target
  entirely and make the emitter's Claude Code half dead code before its
  first real role.
- Both genuinely narrow blast radius, which is the term's *intent*. This is
  the weakest mapping in the vocabulary, and clause 8's "refuse, never
  degrade" rule is about a boundary **vanishing**, not about two
  mechanisms with the same purpose differing in kind.

Recorded in the emitter's `VOCAB` table (with a `partial: True` marker), in
`configs/claude-code/README.md`, and here. **This is the one mapping a
future reader should re-examine first** if a role turns out to behave
differently across clients.

#### Behavioural proofs

| Behaviour | Result |
|---|---|
| `_template*` not emitted | Target directory **not even created** |
| `clients` narrowing honoured | `agent skipped: … (not in its clients list)`, **exit 0** — a skip, not a refusal |
| Agents dir created under existing parent | `~/.claude/agents/` and `~/.config/opencode/agents/` both created by the run; both previously absent |
| Absent parent | `client skipped: claude-code (not installed: /tmp/opencode/absent absent)`; **directory not created** |
| No `agent` key in `opencode.jsonc` | Confirmed absent; mtime still **2026-08-24**, untouched |
| Refusal propagates | `agent emission failed for claude-code`, **install.sh exit 1** |

The skip-vs-refuse distinction matters: an OpenCode-only role (`git-ops`,
`shell-runner`) declaring `clients: [opencode]` is **correct**, so it skips
silently. A role listing `claude-code` *and* an unenforceable term is a
**contradiction**, so it fails the whole install. Two different situations,
two different outcomes.

#### The stale-emitted-file property, demonstrated

Step 14 asked for this to be recorded rather than discovered later:
1. Fixture role emitted → `~/.config/opencode/agents/_fixture-stale.md`
   present.
2. Role **deleted** from the repo; `install.sh` re-run.
3. **The emitted file is still there.**

Nothing prunes it. A deleted or renamed role stays live in both clients
until removed by hand. This is a real weakness of emission, documented in
both client READMEs. **Not** patched with an automatic cleanup: an installer
that deletes files from a user's config directory needs its own decision,
and a `rm` driven by "files I don't recognise" would eventually delete a
hand-written role this repo does not own — the mistake the skills path
already avoids by only replacing skills the repo owns.

**Emitted file paths, for rollback:**
`~/.claude/agents/<role>.md` and `~/.config/opencode/agents/<role>.md`.
Both directories are currently **empty** — no real role exists — so nothing
outside the repo needs removing to roll this task back today.

- Actions:
  1. Verified the gate; decided clause 7 (tier placeholders, one owner).
  2. Probed the gate's parse and the installer's read; chose a fourth
     column on that evidence and recorded the reasoning in the script.
  3. Extended `CLIENTS` with TASK-0036's **observed** directory names.
  4. Wrote `scripts/emit-agents.py` — a separate script, taking the brief's
     recorded fork. **264 lines**, of which the 9-term `VOCAB` table is
     **60** (counted, after first writing "~110" from estimation). Inlining
     that into `install.sh` would have nearly tripled a 147-line script and
     buried the skills path in the middle of a permission-mapping table.
  5. Wired emission into the client loop; added the no-freshness-check and
     no-pruning comments at the emission point.
  6. Proved the pairing check still bites; restored and hash-verified.
  7. Ran the nine per-term proofs; compared glob ordering against the live
     `qa-test` role.
  8. Ran the six behavioural proofs.
  9. Demonstrated the stale-file property.
  10. Added an Agents section to all three `configs/*/README.md`.
  11. Removed every fixture; verified `agents/` and both client directories.

- Observations:
  - **`tests/validate.sh` was not touched.** The brief's scope included
    updating its `CLIENTS` parsing; measurement showed no change was
    needed, because the parse anchors on the first field. Recorded because
    the brief's "deviation to watch for" warned TASK-0038's author may have
    assumed a particular shape — in the event, neither task's changes
    interact at all.
  - **Emission is idempotent**, which is load-bearing given clause 4 rules
    out a freshness check — re-running *is* the control, so it must be safe
    to repeat. **Proved with a fixture, not asserted**: a role emitted twice
    into one target and once into another produced **SHA-256-identical**
    files. The same fixture also proved the multi-term merge works — a role
    declaring `read-only` + `worktree-only` emitted a single `permission:`
    block carrying `edit: deny`, `write: deny` and
    `external_directory: deny` together, rather than one term overwriting
    the other.
  - **The emitter uses no third-party YAML parser.** A narrow regex parser,
    for the same reason `validate.sh` avoids dependencies: the repo's
    tooling must stay hermetic. Safe here because `validate.sh` has already
    enforced the schema by the time emission runs — the emitter is not the
    validator and does not duplicate it.
  - **`scripts/emit-agents.py` is recorded `100644`**, matching every other
    script in `scripts/` and `tests/` (only `.githooks/pre-commit` is
    `100755`). It is invoked as `python3 scripts/emit-agents.py`, so no
    executable bit is needed and the `core.filemode=false` trap is not
    reachable.
  - **Skills still deploy by symlink and are unaffected.** The `link|copy`
    mode is now documented as skills-only in the usage text, since a reader
    could reasonably have expected it to cover agents.

- Validation:
  - `bash tests/validate.sh` → **PASS** (`validate.sh: OK`, exit 0). Also
    observed **failing (exit 1)** on a bogus client row, proving the
    config-pairing check survives the fourth column.
  - `bash scripts/sync-registry.sh` → **no diff**. No fixture survived into
    the registry, which the brief flagged as a possible finding.
  - `bash scripts/install.sh` → ran end to end: six skills linked, both
    agents directories created, zero agents emitted (correct — no real role
    exists), MCP commands printed.
  - `install.sh` exit **1** on a refused emission; exit **0** with a
    narrowed `clients` list.
  - `opencode.jsonc` unmodified (mtime 2026-08-24). No `agent` key.
  - `git status` clean of `_fixture-*`; `agents/` holds only `_template/`
    and `README.md`; both client agents directories empty.

- Result: **done.** All twelve acceptance criteria met. **Phase 2 is
  complete**: `agents/` is defined (TASK-0037), enforced (TASK-0038),
  indexed (TASK-0039) and deployable (this task). TASK-0043 and TASK-0045
  can author real roles and have them gated, indexed and emitted with no
  further plumbing.

  Two decisions the brief assigned here, both recorded with reasoning
  rather than improvised: **clause 7** — the emitter emits `{tier:<name>}`
  and never resolves it, so `models.jsonc` stays the single owner; and
  **`worktree-only`** — emit `isolation: worktree` for Claude Code and
  document the refusal-vs-redirection difference, because refusing would
  have made all four existing roles OpenCode-only and left the Claude Code
  emitter dead on arrival.
### Amendment 1 — 2026-09-15: emit the tenth vocabulary term
Attributed here because this task owns the emitter. Definition (TASK-0037)
and enforcement (TASK-0038) landed first, in that order.

`delegation-allowlist` is the vocabulary's **first parameterised term**: its
output depends on the role's `delegates_to` list rather than on a static
value, so both emit paths special-case it. `VOCAB` carries a
`"PARAMETERISED"` marker for it so the table remains the single index of
what the vocabulary contains — a term absent from `VOCAB` would be
invisible to a reader checking coverage.

Emitted output, verified by inspection for a primary declaring
`delegation-allowlist` + `no-webfetch` + `worktree-only`:

**OpenCode** — `permission.task` with `"*": deny` first, then each allowed
name:
```
  task:
    "*": deny
    "worker-a": allow
    "worker-b": allow
```
**Claude Code** — `tools: Agent(worker-a, worker-b)`, alongside
`disallowedTools: WebFetch, WebSearch` and `isolation: worktree`.

**Two things proved rather than assumed:**

1. **`"*"` is first by guarantee, not by luck.** OpenCode's rules are
   last-match-wins, so allowed names emitted before the blanket deny would
   leave the deny winning and block *everything*. Tested with names chosen to
   sort *before* `*` under a naive sort (`AAA-first`, `!bang`): `"*"` still
   emitted first, because the sort key is `(g != "*", g)` rather than plain
   alphabetical. Without this the emitter would produce a file that reads
   correctly and enforces the opposite.
2. **`tools` carries only `Agent(...)` entries, never concrete tool names.**
   `tools` is an *allowlist* in Claude Code, so adding a tool name would
   silently remove every tool **not** named — a far wider change than the
   capability requested. Commented at the emission point, since the natural
   next edit is to "also list the tools it needs".

**No regression:** a role declaring an OpenCode-only term (`bash-allowlist`)
alongside the allowlist and targeting `claude-code` still **refuses** with
exit 1 and the remedy named.

- Commit: `36cab90` (original), amendment in the TASK-0043 commit below
- Push: confirmed — see below
