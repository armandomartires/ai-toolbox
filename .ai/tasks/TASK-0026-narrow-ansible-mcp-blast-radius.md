# TASK-0026 — Correct the ansible MCP blast-radius claim and disable `ansible_navigator`

## Objective
Make this repo's own description of the `ansible` MCP server true, and
remove the one tool that can execute against production infrastructure
while being unable to express any of the safety steps that would make such
execution defensible.

Three separate corrections, one logical change: the manifest and the three
wiring snapshots all currently tell a reader something false about blast
radius, and all three restate it from the same source sentence.

## Minimal context

### The false claim
`mcp-servers/ansible/server.json:22` describes `WORKSPACE_ROOT` as "the
blast radius for the destructive tools below - set it to the project
directory, never to `$HOME` or `/`." That is true for the three filesystem
tools (`ansible_lint` with `fix: true`, `create_ansible_projects`,
`define_and_build_execution_env`) and **false for the other two**:

- `ansible_navigator` runs playbooks, which reach **remote managed
  infrastructure**. `WORKSPACE_ROOT` bounds which playbook files the server
  can read; it bounds nothing about what those playbooks then do to a
  cluster or a router.
- `ade_setup_environment` installs OS packages via dnf/apt/brew/pacman
  (`server.json:34`), which is **system-wide** and outside any workspace.

The sentence is then restated in all three `configs/*/README.md`
destructive warnings, so a reader is told the same wrong thing four times.
This is the standing lesson 6 pattern — the governance layer polices
components and nothing polices the governance layer — reappearing inside
`mcp-servers/` and `configs/`.

### Why `ansible_navigator` goes
Verified by live enumeration of the pinned server (PLAN-0003, finding F5):
`ansible_navigator`'s parameters are `userMessage`, `filePath`, `mode`,
`environment`, `disableExecutionEnvironment`. **There is no inventory
parameter, no limit, and no `--check`/`--diff` passthrough.**

So it cannot perform the graduated workflow this sprint is building a
skill and loop around — while it *can* run a playbook against a live
estate. The control venv's own `ansible-playbook` does everything this
tool does and everything it cannot. Keeping it enabled buys nothing and
risks a production change; the human authorized disabling it on
2026-09-14.

A second reason, worth recording because it undercuts a common argument
for MCP generally: `userMessage` is a natural-language string the server
parses to locate the playbook. The claim that MCP gives "deterministic
command invocation rather than inventing shell commands" does not hold for
this tool — invocation is LLM-message-parsed, not schema-pinned.

### What this task must not do
The 2026-09-13 authorization block (`server.json:40-45`) records a human
grant covering five destructive tools. This task **narrows** that grant.
Narrowing is the safe direction, but it is still an edit to a recorded
authorization, so the block must be re-recorded honestly — showing the
original grant, this narrowing, and its date — rather than silently
rewritten to look as though four was always the number.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `mcp-servers/ansible/server.json` | TASK-0007 | 46 lines; `:22` carries the false blast-radius sentence; `capabilities.destructive_tools` lists 5; `authorization.granted: true`, dated 2026-09-13 |
| `configs/claude-code/README.md` | TASK-0006 | 82 lines; destructive warning at `:40-47` restating the `WORKSPACE_ROOT` claim |
| `configs/opencode/README.md` | TASK-0006 | 87 lines; same warning at `:51-58` |
| `configs/lm-studio/README.md` | TASK-0006, TASK-0017 | 136 lines; same warning at `:36-43`; documents LM Studio as MCP-only with a verified UI check |
| `PLAN-0003` findings F5, F6 | this session | Written; F5 rests on a live tool enumeration, F6 on reading `server.json` |
| `tests/validate.sh` | TASK-0023 | 474 lines; `:168-185` checks `destructive_tools` non-empty and the `authorization` block when `destructive: true` |
| Human authorization to disable `ansible_navigator` | human, 2026-09-14 | Given during the PLAN-0003 planning session |

**Verify the expected state; don't assume it.** A stale row here is the
one failure this convention cannot catch for you. In particular: re-read
`server.json:22` and each README's warning before editing — F6 was derived
this session, but the line numbers were not re-checked after PLAN-0003 was
written.

## Scope

### Included
- Restate `WORKSPACE_ROOT`'s effect **per tool** in `server.json`, so the
  bound and the unbounded are distinguishable.
- Disable `ansible_navigator`: remove it from the enabled set in all three
  wiring snippets, with the reason stated in each.
- Re-record `authorization` to reflect the narrowed set without erasing the
  original grant.
- `configs/lm-studio/README.md`: state that LM Studio supplies models only
  and no agentic work is performed there (human decision, 2026-09-14).
- Keep `tests/validate.sh` green throughout.

### Not included
- Removing any other destructive tool. `ade_setup_environment`,
  `ansible_lint --fix`, `create_ansible_projects` and
  `define_and_build_execution_env` all stay enabled; only their
  description changes.
- Changing the pinned upstream version. `26.6.0` is deliberate
  (`server.json:7,12`) so upstream breaking changes cannot land silently.
- Authoring the skill, loop, or guard. Later tasks.
- Any change to `SIGMA-infrastructure`.
- Adding a validation check that a tool is disabled. Whether that is even
  expressible is unexamined, and `validate.sh` must stay hermetic.

## Likely files
- `mcp-servers/ansible/server.json`
- `configs/claude-code/README.md`
- `configs/opencode/README.md`
- `configs/lm-studio/README.md`
- `.ai/context/CURRENT_STATE.md` (environment notes; the ansible entry
  states "10 tools")
- possibly `docs/operations/runbook.md`, if it names `ansible_navigator`
  as an available operation — **check, do not assume**

## Execution plan
1. Re-read `server.json` and all three READMEs; confirm the line numbers
   and exact wording in the Inputs table still hold. Record any drift.
2. Decide how a disabled tool is expressed. The manifest schema
   (`validate.sh:146-156`) has no "enabled tools" concept, so this is
   either a new optional manifest key or a documented wiring instruction
   only. **Prefer the wiring snippets** unless a manifest key can be added
   without changing what `validate.sh` requires of every other server.
3. Rewrite the `WORKSPACE_ROOT` description per tool in `server.json`.
4. Re-record the `authorization` block: original grant, this narrowing,
   both dates, this task as the reference.
5. Update the three destructive warnings to match, each naming
   `ansible_navigator` as disabled and why.
6. Add the models-only statement to `configs/lm-studio/README.md`.
7. Run `bash tests/validate.sh`; confirm `validate.sh: OK`.
8. Deliberately break the `authorization` block (set `granted: false` with
   `destructive: true`) and confirm the gate fails for that reason, then
   restore. This check already exists, but it has never been observed
   failing against *this* manifest, and a check never seen to fail has not
   been validated.
9. `bash scripts/sync-registry.sh` — the description field is unchanged,
   so expect **no diff**. A diff here means step 3 touched
   `description`, which would alter the registry row.

## Acceptance criteria
- [x] `server.json` distinguishes what `WORKSPACE_ROOT` bounds from what it
      does not, per tool, with `ansible_navigator` and
      `ade_setup_environment` named explicitly — new `workspace_root_bounds`
      key with `bounded` / `not_bounded` arrays
- [x] `ansible_navigator` is disabled in all three wiring snippets, each
      carrying the reason (cannot express inventory/limit/check/diff, yet
      can execute against production) — and each stating the disablement is
      **advisory, not enforced**
- [x] The `authorization` block shows the original five-tool grant, this
      narrowing, and both dates — the original is not erased. Implemented as
      an explicit `history` array whose narrowing entry says in words that it
      reduces rather than widens the grant
- [x] ~~`configs/lm-studio/README.md` states models-only, no agentic work~~
      **DELIBERATELY NOT DONE — this criterion is refuted.** `ADR-0020` /
      `TASK-0047` established that claim is **false** and removed it; the
      client is **Bionic** and *is* agentic. Re-adding it would restore a
      known-false statement on a superseded decision's authority. See
      observation 7
- [x] `tests/validate.sh` reports OK, **and** was observed failing on a
      deliberately broken `authorization` block before being trusted —
      exit 1 with the authorization message, then restored byte-identically
      (SHA-256 `e41ee499…03743ab`)
- [x] `scripts/sync-registry.sh` produces no diff, or the diff is
      understood and intended — **no diff**, as forecast
- [x] No file under `/home/armando.martires/SIGMA-infrastructure` is
      modified — `git status` empty; not involved in this task

## Mandatory validations
- [x] tests/validate.sh — `validate.sh: OK`, and observed failing on a
      deliberately broken manifest
- [x] scripts/sync-registry.sh (components changed) — run; **no diff**, the
      correct result since `description` was untouched

## Risks and rollback
- **Risk: the manifest schema has no place to express "disabled".**
  Inventing a key that `validate.sh` does not check produces a claim
  nothing enforces — exactly the failure class this repo keeps finding. If
  a manifest key cannot be added cleanly, put the disablement in the
  wiring snippets only and record why in the task log.
- **Risk: narrowing an authorization reads as widening it if written
  carelessly.** A future reader must be able to see that a human reduced
  the grant, not that the record was quietly adjusted.
- **Risk: the disablement is advisory.** Nothing prevents a user from
  re-enabling the tool in their own client config. This task reduces
  default exposure; it does not enforce anything. Say so in the snippets
  rather than implying a guarantee.
- **Rollback:** single commit, no generated artifacts beyond
  `docs/registry.md` (expected unchanged). `git revert` is sufficient.

## Outputs / handover

**This section describes a verified state.** The task has run.

| Artifact | End state |
|----------|-----------|
| `mcp-servers/ansible/server.json` | `WORKSPACE_ROOT` described **per tool** via a new `workspace_root_bounds` key (`bounded` / `not_bounded`); new `disabled_tools` key carrying `ansible_navigator`'s reason and stating that `validate.sh` does **not** check it; `authorization` gains a `history` array showing the original five-tool grant **and** the narrowing; `upstream.version` **unchanged** at `26.6.0` |
| `configs/claude-code/README.md` | `ansible_navigator` disabled with the reason; per-tool `WORKSPACE_ROOT` scope; advisory-not-enforced stated |
| `configs/opencode/README.md` | Same, **plus** the verified OpenCode enforcement route (`tool.execute.before`, tool ID `ansible_ansible_navigator`) with a note that this repo ships no such plugin and declined to, and the `experimental.codeMode` caveat |
| `configs/lm-studio-bionic/README.md` | Same (path corrected — the brief named `configs/lm-studio/`). **No models-only statement**: `ADR-0020` refuted it. A second false claim at `:253` also corrected |
| `docs/operations/runbook.md` | **Not forecast by the brief.** The **fifth** repetition of the false claim, corrected at `:184-189` |
| `docs/registry.md` | **Unchanged** — `description` not edited; confirmed by running `sync-registry.sh` |
| `SIGMA-infrastructure` | **Untouched**, deliberately |

**Next task starts here**: the server's default posture is **four**
destructive tools rather than five, and this repo's description of its own
blast radius is accurate in all six places — so no component can now tell an
agent to "identify the inventory and limit before execution" while an enabled
tool has no such parameters. `TASK-0031` is the remaining implementation, and
`TASK-0032` records the target-repo evidence trail.

**Deviations from the Execution plan, recorded:**

1. **Step 2 chose BOTH surfaces, not one.** The brief said to prefer the
   wiring snippets and to add a manifest key only if it could be done without
   changing what `validate.sh` requires of other servers. It could, so both
   were used — but the manifest key **explicitly states that nothing checks
   it**, because the brief's own risk note is right that an unverified key is
   a claim nothing enforces. The *enforceable* half is the snippets. The
   brief's handover warned that `TASK-0029`/`ADR-0014` were scoped against a
   snippets-only outcome; **they are unaffected**, since the snippets remain
   the operative mechanism.
2. **The claim was in five places, not four — and the fifth was the
   runbook**, which the brief listed only as "check, do not assume". A sixth
   correction was needed in the Bionic README's *lessons* list. **The brief's
   own count of the defect was an instance of the defect.**
3. **Three Inputs rows were stale and one named a nonexistent file**
   (`configs/lm-studio/README.md`, renamed by `TASK-0047`). All four line-number
   claims were wrong. The brief's instruction to re-read first is what caught
   it.
4. **One acceptance criterion was deliberately not met**: the models-only
   statement is **refuted** by `ADR-0020` and re-adding it would have restored
   a known-false claim. Marked complete-as-declined with the reason, rather
   than silently skipped or mechanically executed.
5. **`ansible_navigator` was confirmed still enabled by `TASK-0028`** the same
   day, which is why this task mattered rather than being tidy-up.

## Status
- Status: done
- Owner: agent
- Created: 2026-09-14
- Updated: 2026-09-16

## Execution log
### Attempt 1
- Date: 2026-09-16
- Agent: opencode (claude-opus-5)
- Actions: Re-read every Inputs row against the file before editing (step 1)
  and found **three stale**. Rewrote `WORKSPACE_ROOT`'s effect **per tool** in
  the manifest, added a `disabled_tools` key carrying the reason, re-recorded
  `authorization` with an explicit `history` array, updated the destructive
  warning in **all three** wiring snippets, corrected a **fifth** location the
  brief had not predicted, observed the authorization check failing on a
  deliberately broken manifest, and restored it byte-identically.

- Observations:

  **1. Three Inputs rows were stale — and one names a file that no longer
  exists.** The brief predates `TASK-0047`/`ADR-0020`:
  - `configs/lm-studio/README.md` **is now
    `configs/lm-studio-bionic/README.md`**, and it is **261 lines, not 136**.
  - `configs/claude-code/README.md` is **129 lines, not 82**; the warning is
    at `:87-94`, not `:40-47`.
  - `configs/opencode/README.md` is **151 lines, not 87**; the warning is at
    `:115-122`, not `:51-58`.
  - `tests/validate.sh` is **732 lines, not 474**; the manifest checks are at
    `:140-200`, not `:168-185`.
  Only `server.json` matched exactly (46 lines, false claim at `:22`, five
  destructive tools, `granted: true` dated 2026-09-13). **The brief's own
  instruction — "re-read before editing… the line numbers were not
  re-checked" — was the single most useful line in it.**

  **2. The claim was in FIVE places, not four.** The brief said the sentence
  is restated in three `configs/*/README.md` plus `server.json`, "so a reader
  is told the same wrong thing four times". A grep found a **fifth**:
  `docs/operations/runbook.md:185`, which told an operator setting up a live
  client that `WORKSPACE_ROOT` is "the server's blast radius: it executes
  playbooks…". **The brief listed the runbook only as "check, do not
  assume"** — so the check was worth doing, and the count in the brief is
  itself an instance of the defect class it was written to fix.
  A **sixth** was found in the same file family:
  `configs/lm-studio-bionic/README.md:253` named `ansible_navigator` and
  `ade_setup_environment` as bounded by `WORKSPACE_ROOT` in a *lessons* list,
  which is the most quotable place to be wrong. Both corrected; a final grep
  for the phrase returns nothing outside `.ai/`.

  **3. Step 2's decision: BOTH, with the enforceable half in the snippets.**
  The manifest schema (`validate.sh:140-200`) has no enabled-tool concept and
  does not reject unknown keys, so a `disabled_tools` key was addable without
  changing what the gate requires of any other server — confirmed by running
  the gate before and after. But **a key nothing checks is a claim nothing
  enforces**, so the key's own `note` says exactly that: `validate.sh` does
  **not** verify it, deliberately, and the disablement is carried out by the
  wiring snippets. The manifest key exists so the *reason* travels with the
  manifest instead of living only in three client files. **This is the
  brief's "prefer the wiring snippets" instruction honoured on substance
  while keeping the reason discoverable.**

  **4. The authorization check was observed failing, for the right reason.**
  It exists at `:181-185` and had never been seen to fail against *this*
  manifest. Setting `authorization.granted: false` with `destructive: true`
  produced:

  ```
  INVALID MANIFEST: mcp-servers/ansible/server.json: capabilities.destructive
  is true but authorization.granted is not true (AGENTS.md requires explicit
  human authorization in the task file)
  ```
  exit **1**. Restored and confirmed **byte-identical by SHA-256**
  (`e41ee499…03743ab` before and after), not merely "looks right".

  **5. The narrowing is recorded as a reduction, in a way a future reader
  cannot misread.** `authorization` keeps `granted: true` (the gate requires
  it) and gains a `history` array: the **original five-tool grant** of
  2026-09-13, then the 2026-09-14 narrowing to four, each with its date and
  task, and the narrowing entry saying in words *"This REDUCES the grant; it
  does not widen it."* The original is **not erased**. The human re-confirmed
  the narrowing on 2026-09-16 before any edit was made, and that is recorded
  in both the manifest and the snippets.

  **6. Every snippet now states that the disablement is advisory.** Nothing in
  this repo can switch a tool off upstream: each documented command starts a
  server exposing all ten tools, and a user can re-enable `ansible_navigator`
  in their own config. Saying so was a brief requirement and matters more
  after `TASK-0028`, which found a *real* enforcement route in OpenCode. The
  OpenCode snippet therefore names it — `tool.execute.before`, tool ID
  `ansible_ansible_navigator` — **and says this repo ships no such plugin and
  declined to** (`ADR-0016`), plus the `experimental.codeMode` caveat where
  per-tool hooks do not fire. A reader who wants enforcement now knows the
  route and its limits instead of assuming the repo provided one.

  **7. The "LM Studio → models-only" scope item was NOT executed, because
  `ADR-0020` refuted it.** The brief's Included list says: *"state that LM
  Studio supplies models only and no agentic work is performed there (human
  decision, 2026-09-14)"*. That exact sentence was **already in the file and
  was already removed** by `TASK-0047` as **false** — the client is **Bionic**,
  it ships subagent identifiers, sessions, a permissions store and
  `bionic_tool` dispatch. `configs/lm-studio-bionic/README.md:96-99` now
  records the retraction explicitly. **Re-adding it would have re-introduced a
  known-false claim on the authority of a superseded decision.** Not
  escalated, because `ADR-0020` is accepted and unambiguous and the brief's
  own rule is to verify the expected state rather than assume it — the same
  resolution `TASK-0037` used when a brief contradicted an accepted ADR.

- Validation: `bash tests/validate.sh` → **`validate.sh: OK`** (run before,
  during, after, and once more via the pre-commit hook), **plus observed
  failing** on the deliberately broken authorization block and restored
  byte-identically by SHA-256.
  `bash scripts/sync-registry.sh` → **no diff**, exactly as the brief
  forecast, because `description` was not edited.
  `python3 -c json.load` on the manifest → valid JSON with the new keys.
  `git status` in `SIGMA-infrastructure` → **empty**; not touched.
- Result: **Done.** This repo's description of its own blast radius is now
  accurate in all six places, `ansible_navigator` is disabled by default with
  the reason stated per client, and the authorization record shows a human
  *reducing* a grant rather than the record being quietly adjusted.
- Commit:
- Push:
