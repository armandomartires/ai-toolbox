# TASK-0017 — Record the LM Studio UI verification; fix the WORKSPACE_ROOT placeholder trap

## Objective
Record the observed result of the LM Studio UI verification procedure
(TASK-0016), close the last known gap in Phase 2's exit criteria, and fix
the defect the verification exposed: the wiring works with an unreplaced
placeholder `WORKSPACE_ROOT`.

## Minimal context
The human ran the procedure from
`docs/operations/runbook.md` ("Verifying an MCP server in LM Studio's UI")
and reported the server active in LM Studio chat, with `qwen3.8 27b`
enumerating the tool list on request.

This was the one verification step no script in this repo could perform —
`tests/smoke-mcp.sh` proves a server speaks MCP, not that LM Studio surfaces
its tools in the app's own UI. It had been an open, honestly-labelled gap
since TASK-0006 and was carried through three sprint candidate lists before
TASK-0016 turned it into a written procedure.

### What the human observed (pass)
Nine functional tools listed, grouped by the model into knowledge/guidance,
development/validation, and execution/environment:
`zen_of_ansible`, `ansible_content_best_practices`, `ansible_lint`,
`create_ansible_projects`, `define_and_build_execution_env`,
`ansible_navigator`, `ade_environment_info`, `ade_setup_environment`,
`adt_check_env`.

### Cross-check performed, and a number reconciled
The repo has recorded "10 tools" since TASK-0007. The model's first list had
9. Queried the live server directly (`list_available_tools`): it returns
**10**, the tenth being `list_available_tools` itself — the meta-tool that
enumerates the others. So both figures are right and neither record needs
correcting: **10 tools exposed, 9 functional.** Worth stating explicitly,
because a future reader comparing the two lists would otherwise see a
discrepancy and suspect drift.

Asked to re-review, the model produced the full 10 and identified the
omission as `list_available_tools`, independently matching the direct query.
Two things follow, and only one of them is about the tool count:

- The repo's figure of 10 is confirmed by two independent observations.
- **The model's first answer was incomplete and confidently presented.**
  The count was only caught because it was checked against the server rather
  than accepted. A model enumerating its own tool list is a convenient
  source, not an authoritative one; `list_available_tools` is.

### Defect found: the placeholder was never replaced — **fixed by the human**
Reading the live `/mnt/c/Users/<user>/.lmstudio/mcp.json` at first check:

```
WORKSPACE_ROOT = /absolute/path/to/your/project
```

That is the **literal placeholder string** copied verbatim out of
`configs/lm-studio/README.md`. The path did not exist on this machine
(checked). The server still started, connected, and enumerated its full tool
list — which is exactly what makes this dangerous:

- Connection success is **not** evidence that `WORKSPACE_ROOT` is sane. The
  handshake and tool enumeration do not touch the filesystem.
- `WORKSPACE_ROOT` is this server's **blast radius**. The manifest's own
  authorization disclosure calls it that: `ansible_navigator` executes
  playbooks, `ade_setup_environment` installs OS packages,
  `ansible_lint --fix` rewrites files in place.
- The failure would surface only at the moment a destructive tool ran
  against a path that does not resolve — the worst possible time to discover
  it, and with unpredictable behaviour rather than a clean error.

The repo's own documentation pointed straight at this and was not enough:
`configs/lm-studio/README.md` already says "Use an **absolute**
`WORKSPACE_ROOT`" and "set it to the project directory, never `$HOME` or
`/`". The guidance was correct and still got copy-pasted past, because a
ready-to-paste JSON block invites pasting without editing. That is a
documentation-design defect, not a user error.

**Resolved the same day.** The human corrected it to:

```
WORKSPACE_ROOT = C:/Users/<user>/AI Workspaces/SIGMA-infrastructure
```

Re-verified: the directory exists and is a real Ansible project
(`ansible.cfg`, `inventory/`, `requirements.yml`, `.ansible-lint`) — an
appropriate blast radius for a server whose tools run playbooks and lint in
place. The value is a **Windows-style path with a drive letter**, which is
correct here: LM Studio is a Windows application and resolves it natively.
Note for future checks that a naive POSIX `os.path.isabs()` reports `False`
for `C:/...`, so a WSL-side script must not treat that as "not absolute" —
translate to `/mnt/c/...` and test for directory existence instead.

## Scope
### Included
- Update `configs/lm-studio/README.md`: `Verified` row, and replace the
  "Not verified" note with what was actually observed.
- Close Phase 2's second exit criterion in `ROADMAP.md`
  (*partly met* → met), and note it was closed retroactively.
- Make the placeholder trap harder to fall into: an obviously-invalid
  sentinel plus an explicit "replace this before starting LM Studio" step in
  the runbook procedure.
- Update `CURRENT_STATE.md` and `SPRINT-CURRENT.md` — the gap is closed and
  must stop being listed as open.

### Not included
- Editing the human's live `mcp.json`. It is their app config, outside the
  repo. The correct `WORKSPACE_ROOT` for their machine is their choice —
  flagged prominently instead, and they fixed it themselves the same day.
- A `validate.sh` check on `WORKSPACE_ROOT`. It is a value in an
  out-of-repo config on one machine; the gate is hermetic and must not read
  a user's app configuration.
- Re-verifying the other two clients. Claude Code and OpenCode were already
  verified by TASK-0006/0007 and are unaffected.
- Changing the pinned version. `26.6.0` is what was verified, and it is what
  ran.

## Preconditions
- Human has run the procedure and reported the result. **Done.**

## Likely files
- `configs/lm-studio/README.md`, `.ai/planning/ROADMAP.md`,
  `docs/operations/runbook.md`, `.ai/context/CURRENT_STATE.md`,
  `.ai/planning/SPRINT-CURRENT.md`

## Execution plan
1. Cross-check the reported tool list against the live server. **Done** —
   reconciled 9 vs 10 above.
2. Inspect the live `mcp.json` to confirm what was actually wired. **Done** —
   found the placeholder.
3. Record the pass with its evidence; do not overwrite the existing
   handshake-level evidence, add to it.
4. Close the Phase 2 criterion.
5. Harden the placeholder: sentinel + explicit runbook step.
6. Validate, commit, push.

## Acceptance criteria
- [x] `configs/lm-studio/README.md` records the UI verification with the
      date, the model used, and the tool count reconciliation.
- [x] No "Not verified" claim remains for the UI step, and no fabricated
      claim replaces it — only what was reported and cross-checked.
- [x] Phase 2's second exit criterion reads *met*, with the closing date.
- [x] The `WORKSPACE_ROOT` placeholder is an obviously-invalid sentinel
      (`REPLACE_ME_absolute_path_to_your_project`) and the runbook tells the
      reader to replace it **before** launching (now its own step 2).
- [x] The 10-vs-9 tool count is explained where a reader would hit it:
      the client README and runbook step 5.
- [x] `CURRENT_STATE.md` no longer lists the LM Studio UI gap as open.
- [x] `tests/validate.sh` passes.
- [x] The live `WORKSPACE_ROOT` fix re-verified: real directory, real
      Ansible project, drive-letter path correct for a Windows app.

## Mandatory validations
- [x] tests/validate.sh — OK
- [x] scripts/sync-registry.sh — no diff (no component changed)

## Risks and rollback
- Risk: recording a pass more strongly than the evidence supports.
  Mitigation: the record states exactly what was observed (server active,
  tools enumerated by a named model) and separately notes what was
  cross-checked against the live server.
- Risk: the human's placeholder `WORKSPACE_ROOT` stays unfixed and a
  destructive tool is later invoked against it. Mitigation: flagged
  explicitly to the human, not just committed to a file they may not read.
- Rollback: documentation-only; revert the commit.

## Dependencies
TASK-0016 wrote the procedure this task records the result of.

## Expected result
Phase 2 fully closed; the last known gap resolved with observed evidence;
the copy-paste trap that produced a placeholder blast radius is made
resistant to recurrence.

## Status
- Status: done   # planned|ready|in_progress|blocked|review|done|cancelled
- Owner: human (verification) + agent (record and hardening)
- Created: 2026-09-13
- Updated: 2026-09-13

## Execution log
### Attempt 1
- Date: 2026-09-13
- Agent: opencode
- Actions:
  - Cross-checked the reported 9-tool list against the live server via
    `list_available_tools`; reconciled to 10 exposed / 9 functional.
  - Read the live `mcp.json`; found `WORKSPACE_ROOT` still set to the
    literal placeholder and confirmed the path does not exist.
  - Recorded the pass in `configs/lm-studio/README.md`; closed Phase 2's
    second exit criterion; replaced the placeholder with an invalid-looking
    sentinel and added an explicit pre-launch replacement step.
- Observations:
  - **The verification passed and simultaneously exposed a defect.** A
    successful MCP handshake and a full tool enumeration say nothing about
    whether `WORKSPACE_ROOT` points anywhere real, because neither touches
    the filesystem. A server can look perfectly healthy while its blast
    radius is a nonexistent path.
  - The repo's guidance was already correct and still insufficient. Both
    "use an absolute path" and "never `$HOME` or `/`" were written down.
    A ready-to-paste JSON block invites pasting, so the fix is to make the
    placeholder *fail loudly* rather than to add more prose.
  - The 9-vs-10 tool count looked like drift and was not. Recording the
    reconciliation prevents a future reader from "fixing" a correct number.
- Validation:
  - Live server queried: 10 tools, matching the repo's recorded figure.
  - Live `mcp.json`: `command`/`args` match the manifest's pinned
    `npx -y @ansible/ansible-mcp-server@26.6.0 --stdio` exactly.
  - `/absolute/path/to/your/project` confirmed nonexistent (before fix).
  - **After the human's fix:** `WORKSPACE_ROOT` re-read from the live config
    and confirmed to be a real directory containing `ansible.cfg`,
    `inventory/`, `requirements.yml`, `.ansible-lint` — a genuine Ansible
    project, and an appropriate blast radius.
  - Tool count independently confirmed twice: direct `list_available_tools`
    query, and the model's own corrected re-review (both 10).
  - `tests/validate.sh` OK; `scripts/sync-registry.sh` no diff.
- Second observation worth recording: the model's **first** tool list was
  incomplete (9 of 10) and confidently presented, with no hedge. It was only
  caught by querying the server. Treat a model's self-report of its own
  capabilities as a convenience, not a source of truth — the same instinct
  that makes `smoke-mcp.sh` assert on the server's actual `initialize` reply
  rather than on whether the process started.
- Result: success. Phase 2's last gap closed on observed evidence; the
  placeholder trap hardened in the repo *and* fixed in the live config.
- Commit: see below
- Push: to `origin master`
