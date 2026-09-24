# TASK-0090 — S10.5: install for both clients, verify the gates server in each, record it

## Objective

Deliver S10.5: run `scripts/install.sh` for Claude Code and OpenCode, record
its emission output **verbatim** in the wiring snapshots (`ADR-0022` F6), and
prove the `gates` server launches **inside each client** — then leave it
wired into none, as the human chose.

## Minimal context

### The human's choices, 2026-09-24 (multiple-choice; the agent chose none)

1. **Install:** `install.sh link`, both clients.
2. **Gates wiring:** *verify, then unwire* — register temporarily with the
   harmless fixture map, confirm each client connects, remove the
   registration; the snapshots record the working snippet.
3. **Pilot repository (S10.7):** ai-toolbox itself. Not acted on here; it
   only means nothing in this task is specific to another repository.

`TASK-0088`'s authorization condition (*not wired into clients by that
task*) is respected: this is a different task, the human chose the
temporary registration explicitly, and it ends with nothing wired.

### How the temporary registration stays contained

- **OpenCode:** a project-level `opencode.json` in a scratch directory,
  read by `opencode mcp list` run there. The global
  `~/.config/opencode/opencode.jsonc` is **not edited**.
- **Claude Code:** `claude mcp add --scope local`, run from the scratch
  directory, so the entry is keyed to that path; `claude mcp remove` after.
- Both point `GATES_MAP` at `mcp-servers/gates/tests/fixtures/gates.json`,
  whose gates are `true`, `false`, `sleep` and `printf`. No tool is invoked.

### What F6 asks, and how it is judged

*"`emit-agents.py` emits all nine roles for their declared clients with
exit 0, and refuses when an OpenCode-only role is widened to `claude-code`…
Prove the refusal before trusting any pass."* So the refusal path is run
first, against a copy, then the real install.

## Inputs

| Artifact | Produced by | Expected state |
|----------|-------------|----------------|
| `scripts/install.sh`, `scripts/emit-agents.py` | pre-existing | `link` mode default; emits per `clients:` |
| `~/.claude/{skills,agents}` | prior installs | 4 skill links + `synced/`; agents `critic`, `designer-manager`, `ideator` |
| `~/.config/opencode/{skills,agents}` | prior installs | 4 skill links + `agent-tiers/`; six agents |
| `agents/*` (S9 roles) | `TASK-0063`, `TASK-0064` | nine roles; `task-planner`, `adjudicator` declare `claude-code` |
| `mcp-servers/gates/` | `TASK-0088` | smoke PASS; wired nowhere |

## Scope

### Included

- F6's refusal path, proven on a scratch copy of the repo.
- `install.sh link` for both clients; its output and the resulting file
  listings recorded verbatim in `configs/claude-code/README.md` and
  `configs/opencode/README.md`.
- Temporary gates registration in both clients, a connection check, and
  removal — each step's output recorded.
- `ADR-0022` F6 and F8 verdicts updated; `CURRENT_STATE.md`.

### Not included

- Bionic (S10.4). No `--bionic-project`.
- Any permanent MCP registration, and any edit to
  `~/.config/opencode/opencode.jsonc`.
- Invoking any gates tool.
- The pilot (S10.7) and its bindings.

## Likely files

`configs/claude-code/README.md`, `configs/opencode/README.md`,
`.ai/decisions/0022-*.md` (F6, F8 rows), `.ai/context/CURRENT_STATE.md`,
`.ai/tasks/TODO.md`, `.ai/planning/SPRINT-CURRENT.md`.

## Execution plan

1. Snapshot both clients' skill and agent directories (`ls -la`).
2. F6 refusal: in a scratch clone, widen an OpenCode-only role to
   `claude-code`, run the emitter, expect `EMISSION REFUSED`.
3. `scripts/install.sh link`; capture stdout/stderr and exit code; list the
   directories again and diff against step 1.
4. Gates, per client: register in the scratch directory, list, confirm
   connected, remove, list again.
5. Record everything verbatim; update F6, F8, state; validate; commit; push.

## Acceptance criteria

- [x] The refusal path fails on cue *before* the real install is trusted.
- [x] `install.sh link` exits 0; its output is in both snapshots verbatim.
- [x] `unattended-ops` is linked in both clients' skill directories.
- [x] `~/.claude/agents/` gains exactly `task-planner` and `adjudicator` of
      the nine; `~/.config/opencode/agents/` gains all nine.
- [x] Each client reports `gates` connected while registered, and does not
      list it after removal.
- [x] `~/.config/opencode/opencode.jsonc` is byte-identical before and after.
- [x] F6 and F8 carry verdicts that say exactly what was observed.
- [x] `tests/validate.sh` passes.

## Mandatory validations

- [x] `tests/validate.sh`
- [x] `scripts/sync-registry.sh` (expect no diff)
- [x] `sha256sum ~/.config/opencode/opencode.jsonc` before and after
- [x] `git status --porcelain` clean after commit

## Risks and rollback

- **Writes into the user's home directory**, by the human's choice. Skill
  links are replaced only for skills this repo owns (install.sh's policy);
  agent files are regenerated. Rollback: delete the added links and agent
  files, listed in the snapshot diff.
- **A registration left behind** would wire a destructive server against the
  human's choice. Mitigated by removing it in the same step and listing
  afterwards; the listing is the proof.

## Outputs / handover

| Artifact | End state |
|----------|-----------|
| `~/.claude/skills/`, `~/.config/opencode/skills/` | `unattended-ops` linked in both (plus the four existing links, re-linked) |
| `~/.claude/agents/` | + `adjudicator.md`, `task-planner.md`; **`designer-manager.md` is stale** (OpenCode-only now; install never prunes) — left in place, a question for the human |
| `~/.config/opencode/agents/` | + all nine roles, each `(primary)` in `opencode agent list` |
| MCP registrations | **None added.** `gates` registered in each client, observed connected, removed; `~/.claude.json` has no `gates` entry; `opencode.jsonc` sha256 unchanged |
| `configs/claude-code/README.md`, `configs/opencode/README.md` | Install output verbatim; the connecting snippet; "verified, then unwired" |
| `configs/lm-studio-bionic/README.md` | `gates` section says it is neither wired nor verified there (S10.4) |
| `.ai/decisions/0022-*.md` | F6 **confirmed**; F8 two of three clients |

**Next task starts here**: both clients carry the skill and their roles; the
gates server is proven to connect in both and is wired in neither. S10.6
(registry — no diff here — and state) is effectively done by this task's
updates; S10.7, the pilot, runs against ai-toolbox itself.

**Deviations from the Plan:** none in the steps. One unforecast finding: the
stale `designer-manager.md`.

## Status
- Status: done
- Owner: agent (choices: human)
- Created: 2026-09-24
- Updated: 2026-09-24

## Execution log
### Attempt 1
- Date: 2026-09-24
- Agent: Claude Opus 5.5 (1M context)
- Actions: snapshotted the four client directories and hashed
  `opencode.jsonc`; proved the emitter's refusal on a scratch clone; ran
  `scripts/install.sh link`; listed again and diffed; registered `gates`
  temporarily in each client from a scratch directory, observed it
  connected, removed it and listed again; recorded everything.
- Observations:
  1. **The refusal is per role, not per run.** Widening `refuter` to
     `claude-code` refused that role with the right reason and exit 1 — and
     still emitted the other declared roles. Consistent with `emit-agents.py`
     ("refuse, never degrade") at the role level; worth knowing, since an
     `install.sh` run that refuses one role still changes the target.
  2. **A stale emission exists and nothing would ever remove it.**
     `~/.claude/agents/designer-manager.md` dates from before the role became
     OpenCode-only; this install skipped it (`not in its clients list`) and
     left the old file. install.sh documents that it never prunes. A Claude
     Code session can therefore still load a role the repo no longer emits
     for that client. Not deleted — it is in the human's home directory.
  3. **OpenCode could be verified without touching the global config**, via a
     project-level `opencode.json` in a scratch directory; `opencode mcp list`
     run there merged it. The global file's hash is identical before and after.
  4. **The skill reached this very session** — `unattended-ops` appeared in the
     live skill list once linked. A link install takes effect immediately.
- Validation:
  - F6 refusal: *"EMISSION REFUSED: role 'refuter' declares 'bash-allowlist',
    which Claude Code cannot enforce per-agent …"*, exit 1.
  - `install.sh link`: exit 0; before/after diff exactly as the criteria
    state.
  - `opencode agent list`: the nine roles `(primary)`.
  - Claude Code: `Status: ✔ Connected`, then *No MCP server named "gates"*;
    `~/.claude.json` scan: no `gates` in any project or at user scope.
  - OpenCode: `✓ gates connected`, then `gates` absent (count 0).
  - `sha256sum -c`: `opencode.jsonc: OK`. The gate run directory stayed
    empty — no tool was invoked.
  - `tests/validate.sh` OK; `scripts/sync-registry.sh` no diff.
- Result: **done.**
- Commit: `f0fcdd8`. Pre-commit hook ran `tests/validate.sh`: OK.
- Push: **confirmed** — `origin/master` `173dd20..f0fcdd8`.
