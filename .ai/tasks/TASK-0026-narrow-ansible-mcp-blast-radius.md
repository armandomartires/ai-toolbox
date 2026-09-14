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
- [ ] `server.json` distinguishes what `WORKSPACE_ROOT` bounds from what it
      does not, per tool, with `ansible_navigator` and
      `ade_setup_environment` named explicitly
- [ ] `ansible_navigator` is disabled in all three wiring snippets, each
      carrying the reason (cannot express inventory/limit/check/diff, yet
      can execute against production)
- [ ] The `authorization` block shows the original five-tool grant, this
      narrowing, and both dates — the original is not erased
- [ ] `configs/lm-studio/README.md` states models-only, no agentic work
- [ ] `tests/validate.sh` reports OK, **and** was observed failing on a
      deliberately broken `authorization` block before being trusted
- [ ] `scripts/sync-registry.sh` produces no diff, or the diff is
      understood and intended
- [ ] No file under `/home/armando.martires/SIGMA-infrastructure` is
      modified

## Mandatory validations
- [ ] tests/validate.sh
- [ ] scripts/sync-registry.sh (if components changed)

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

**Intended end state — this task has not run.** Everything below is a
plan, not a description. `validate.sh:402` requires this section to be
non-empty for any brief ≥ 0020, including unexecuted ones; the check
detects omission, not correctness (ADR-0012 Decision 3), so it cannot tell
an intention from a state. This paragraph is the disambiguation.

| Artifact | Intended end state |
|----------|-------------------|
| `mcp-servers/ansible/server.json` | `WORKSPACE_ROOT` described per tool; `authorization` re-recorded showing the narrowing; `upstream.version` **unchanged** at `26.6.0` |
| `configs/claude-code/README.md` | `ansible_navigator` disabled with reason |
| `configs/opencode/README.md` | Same |
| `configs/lm-studio/README.md` | Same, plus models-only / no-agentic-work statement |
| `docs/registry.md` | **Unchanged** — `description` is not edited |
| `SIGMA-infrastructure` | **Untouched**, deliberately |

**Next task starts here**: the ansible MCP server's default posture is
four destructive tools rather than five, and this repo's description of
its own blast radius is accurate — so TASK-0029 can write a skill whose
"identify the inventory and limit before execution" invariant does not
contradict an enabled tool that has no such parameters.

Record any deviation from the Execution plan here: TASK-0029 and ADR-0014
are both scoped against the assumption that the disablement lands in the
wiring snippets. If step 2 chooses a manifest key instead, both need
re-reading.

## Status
- Status: planned
- Owner: agent
- Created: 2026-09-14
- Updated: 2026-09-14

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
